#!/usr/bin/env python3
"""
A D1 stand-in for end-to-end testing.

Wrangler is not available in every environment, but D1 *is* SQLite, so the
real Worker can be exercised by giving it a `env.DB` that speaks to a real
SQLite database over HTTP. tests/worker.test.html does exactly that: it
imports the actual server/worker.js and calls its fetch handler.

This exists only for tests. It is not part of the deployment and is never
served in production.

Run:  python3 server/tests/d1_server.py [port]
"""

import http.server
import json
import pathlib
import socketserver
import sqlite3
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "server" / "migrations" / "0001_init.sql"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8032

lock = threading.Lock()
db = sqlite3.connect(":memory:", check_same_thread=False)
db.row_factory = sqlite3.Row


def reset():
    """Rebuild the database from the real migration, then seed fixtures."""
    global db
    with lock:
        fresh = sqlite3.connect(":memory:", check_same_thread=False)
        fresh.row_factory = sqlite3.Row
        fresh.executescript(MIGRATION.read_text())
        fresh.execute("PRAGMA foreign_keys = ON")
        db = fresh
        seed()
        db.commit()


NOW = 1_700_000_000_000


def seed():
    """
    Two organizations. Ana is an Acme analyst with access to one project;
    Eve belongs to a different organization entirely. Their sessions are
    seeded with known token hashes so the test can present real cookies.

    The hashes are SHA-256 of 'ana-token' and 'eve-token', computed by the
    test page and inserted there — here we only create the people and data.
    """
    def ins(table, **cols):
        keys = ",".join(cols)
        marks = ",".join("?" * len(cols))
        db.execute(f"INSERT INTO {table} ({keys}) VALUES ({marks})", tuple(cols.values()))

    for uid, email in [("u_ana", "ana@acme.test"), ("u_eve", "eve@rival.test"),
                       ("u_ben", "ben@acme.test")]:
        ins("users", id=uid, email=email, email_lower=email,
            display_name=email.split("@")[0], created_at=NOW)

    ins("organizations", id="org_acme", name="Acme", slug="acme", created_at=NOW)
    ins("organizations", id="org_rival", name="Rival", slug="rival", created_at=NOW)

    ins("access_profiles", id="ap_analyst", organization_id="org_acme", key="analyst",
        name="Analyst", created_at=NOW, updated_at=NOW)
    for cap in ["analysis.basic", "reports.create", "findings.save", "data.import",
                "projects.create", "vanessa.use"]:
        ins("access_profile_capabilities", profile_id="ap_analyst", capability_id=cap)

                                                        
    ins("access_profiles", id="ap_readonly", organization_id="org_acme", key="read-only",
        name="Read only", created_at=NOW, updated_at=NOW)
    for cap in ["analysis.basic", "reports.view"]:
        ins("access_profile_capabilities", profile_id="ap_readonly", capability_id=cap)

                                                                             
                                                                          
                                                          
    ins("access_profiles", id="ap_rival", organization_id="org_rival", key="administrator",
        name="Administrator", builtin=1, created_at=NOW, updated_at=NOW)
    for cap in ["analysis.basic", "reports.create", "members.manage", "teams.manage",
                "access.manage", "organization.manage", "audit.view", "projects.create"]:
        ins("access_profile_capabilities", profile_id="ap_rival", capability_id=cap)

    ins("organization_memberships", id="m_ana", organization_id="org_acme",
        user_id="u_ana", status="active", access_profile_id="ap_analyst", created_at=NOW)
    ins("organization_memberships", id="m_ben", organization_id="org_acme",
        user_id="u_ben", status="active", access_profile_id="ap_readonly", created_at=NOW)
    ins("organization_memberships", id="m_eve", organization_id="org_rival",
        user_id="u_eve", status="active", org_role="administrator",
        access_profile_id="ap_rival", created_at=NOW)

    ins("projects", id="p_acme", organization_id="org_acme", name="Attendance",
        created_at=NOW, updated_at=NOW, created_by="u_ana")
    ins("projects", id="p_rival", organization_id="org_rival", name="Rival work",
        created_at=NOW, updated_at=NOW, created_by="u_eve")

    ins("project_memberships", id="pm_ana", project_id="p_acme", user_id="u_ana",
        role="editor", created_at=NOW)
    ins("project_memberships", id="pm_eve", project_id="p_rival", user_id="u_eve",
        role="owner", created_at=NOW)

    ins("artifacts", id="a_acme", project_id="p_acme", type="finding",
        title="Acme finding", created_at=NOW, updated_at=NOW)
    ins("artifacts", id="a_rival", project_id="p_rival", type="finding",
        title="Rival finding", created_at=NOW, updated_at=NOW)

    ins("organization_ai_policy", organization_id="org_acme", updated_at=NOW)


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, payload, status=200):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for key, value in CORS.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        for key, value in CORS.items():
            self.send_header(key, value)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        try:
            request = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send({"error": "bad json"}, 400)

        if self.path == "/reset":
            reset()
            return self._send({"ok": True})

        if self.path != "/sql":
            return self._send({"error": "not found"}, 404)

        sql = request.get("sql", "")
        params = request.get("params", [])
                                                                           
                                                                           
        sql, params = renumber(sql, params)

        try:
            with lock:
                cursor = db.execute(sql, params)
                rows = [dict(row) for row in cursor.fetchall()]
                db.commit()
                return self._send({"results": rows, "changes": cursor.rowcount})
        except Exception as error:                                           
            return self._send({"error": str(error)}, 500)

    def log_message(self, *args):
        pass


def renumber(sql, params):
    """
    Translate ?1, ?2 … into positional ? placeholders in the order they
    appear, duplicating arguments where a statement reuses one (which the
    scoped queries do constantly, since ?1 is the user id).
    """
    import re
    order = []

    def swap(match):
        order.append(int(match.group(1)) - 1)
        return "?"

    converted = re.sub(r"\?(\d+)", swap, sql)
    if order:
        return converted, [params[i] if i < len(params) else None for i in order]
    return sql, params


if __name__ == "__main__":
    reset()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"D1 shim on http://127.0.0.1:{PORT}")
        httpd.serve_forever()
