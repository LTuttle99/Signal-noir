#!/usr/bin/env python3
"""
Security tests for the scoped queries.

D1 is SQLite, so these run the *actual* SQL from server/lib/queries.js against
a real database built from the real migration. Nothing is re-implemented here:
the statements are extracted from the source file, so a query that is weakened
later fails this suite.

The data is deliberately adversarial. Two organizations hold projects with the
same names, and ids are passed across boundaries the way an attacker would.

Run:  python3 server/tests/test_queries.py
"""

import re
import sqlite3
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "server" / "migrations" / "0001_init.sql"
QUERIES = ROOT / "server" / "lib" / "queries.js"

NOW = 1_700_000_000_000

results = []


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))


def load_sql():
    """Pull the exported SQL constants straight out of the module."""
    src = QUERIES.read_text()
    found = dict(re.findall(r"export const (\w+) = `(.*?)`;", src, re.S))
    if not found:
        raise SystemExit("No SQL statements could be extracted from queries.js")
    return found


def build_db(sql):
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript(MIGRATION.read_text())
    db.execute("PRAGMA foreign_keys = ON")

    def ins(table, **cols):
        keys = ",".join(cols)
        marks = ",".join("?" * len(cols))
        db.execute(f"INSERT INTO {table} ({keys}) VALUES ({marks})", tuple(cols.values()))

                                                                        
    for uid, email in [
        ("u_ana", "ana@acme.test"),                                        
        ("u_ben", "ben@acme.test"),                                        
        ("u_cleo", "cleo@acme.test"),                                  
        ("u_dan", "dan@acme.test"),                            
        ("u_eve", "eve@rival.test"),                                        
        ("u_sus", "sus@acme.test"),                                    
    ]:
        ins("users", id=uid, email=email, email_lower=email,
            display_name=email.split("@")[0], created_at=NOW)

                                                                        
    ins("organizations", id="org_acme", name="Acme", slug="acme", created_at=NOW)
    ins("organizations", id="org_rival", name="Rival", slug="rival", created_at=NOW)

              
    ins("access_profiles", id="ap_analyst", organization_id="org_acme", key="analyst",
        name="Analyst", created_at=NOW, updated_at=NOW)
    ins("access_profiles", id="ap_readonly", organization_id="org_acme", key="read-only",
        name="Read only", created_at=NOW, updated_at=NOW)
    ins("access_profiles", id="ap_team", organization_id="org_acme", key="ops",
        name="Operations", created_at=NOW, updated_at=NOW)
    ins("access_profiles", id="ap_rival", organization_id="org_rival", key="analyst",
        name="Analyst", created_at=NOW, updated_at=NOW)

    for cap in ["analysis.basic", "sql.use", "reports.create", "findings.save"]:
        ins("access_profile_capabilities", profile_id="ap_analyst", capability_id=cap)
    for cap in ["reports.view", "dashboards.view"]:
        ins("access_profile_capabilities", profile_id="ap_readonly", capability_id=cap)
    for cap in ["workflows.run", "operations.view"]:
        ins("access_profile_capabilities", profile_id="ap_team", capability_id=cap)
    for cap in ["analysis.basic", "sql.use"]:
        ins("access_profile_capabilities", profile_id="ap_rival", capability_id=cap)

                 
    ins("organization_memberships", id="m_ana", organization_id="org_acme",
        user_id="u_ana", status="active", access_profile_id="ap_analyst", created_at=NOW)
    ins("organization_memberships", id="m_ben", organization_id="org_acme",
        user_id="u_ben", status="active", access_profile_id="ap_readonly", created_at=NOW)
    ins("organization_memberships", id="m_cleo", organization_id="org_acme",
        user_id="u_cleo", status="active", access_profile_id="ap_readonly", created_at=NOW)
    ins("organization_memberships", id="m_dan", organization_id="org_acme",
        user_id="u_dan", status="active", org_role="administrator",
        access_profile_id="ap_analyst", created_at=NOW)
    ins("organization_memberships", id="m_eve", organization_id="org_rival",
        user_id="u_eve", status="active", access_profile_id="ap_rival", created_at=NOW)
    ins("organization_memberships", id="m_sus", organization_id="org_acme",
        user_id="u_sus", status="suspended", access_profile_id="ap_analyst", created_at=NOW)

                                       
    ins("teams", id="t_ops", organization_id="org_acme", name="Operations",
        access_profile_id="ap_team", created_at=NOW, updated_at=NOW)
    ins("team_memberships", id="tm_cleo", team_id="t_ops", user_id="u_cleo", created_at=NOW)

                                                                         
    ins("projects", id="p_acme_a", organization_id="org_acme", name="Attendance",
        created_at=NOW, updated_at=NOW, created_by="u_ana")
    ins("projects", id="p_acme_secret", organization_id="org_acme", name="Attendance",
        created_at=NOW, updated_at=NOW, created_by="u_dan")
    ins("projects", id="p_acme_open", organization_id="org_acme", name="Company wide",
        visibility="organization", created_at=NOW, updated_at=NOW)
    ins("projects", id="p_rival", organization_id="org_rival", name="Attendance",
        created_at=NOW, updated_at=NOW, created_by="u_eve")

    ins("project_memberships", id="pm1", project_id="p_acme_a", user_id="u_ana",
        role="editor", created_at=NOW)
    ins("project_memberships", id="pm2", project_id="p_acme_secret", user_id="u_dan",
        role="owner", created_at=NOW)
    ins("project_memberships", id="pm3", project_id="p_rival", user_id="u_eve",
        role="owner", created_at=NOW)
    ins("project_memberships", id="pm4", project_id="p_acme_a", user_id="u_sus",
        role="editor", created_at=NOW)
                                                      
    ins("project_team_access", project_id="p_acme_secret", team_id="t_ops",
        role="viewer", created_at=NOW)

                                                                        
    ins("artifacts", id="a_secret", project_id="p_acme_secret", type="finding",
        title="Confidential finding", created_at=NOW, updated_at=NOW)
    ins("artifacts", id="a_open", project_id="p_acme_a", type="finding",
        title="Ordinary finding", created_at=NOW, updated_at=NOW)
    ins("artifacts", id="a_rival", project_id="p_rival", type="finding",
        title="Rival finding", created_at=NOW, updated_at=NOW)

    ins("datasets", id="d_secret", project_id="p_acme_secret", name="payroll.csv",
        created_at=NOW, updated_at=NOW)
    ins("dataset_versions", id="dv_secret", dataset_id="d_secret", version_no=1,
        r2_key="org_acme/p_acme_secret/payroll.v1.csv", uploaded_at=NOW)

    db.commit()
    return db


def main():
    sql = load_sql()
    db = build_db(sql)
    q = lambda name, *args: db.execute(sql[name], args).fetchall()

                                                                     
                               
                                                                     
    check("a member of another organization cannot load a project by id",
          len(q("PROJECT_FOR_USER", "u_eve", "p_acme_secret")) == 0)

    check("and the reverse direction is equally closed",
          len(q("PROJECT_FOR_USER", "u_ana", "p_rival")) == 0)

    check("an artifact id from another organization returns nothing",
          len(q("ARTIFACT_FOR_USER", "u_ana", "a_rival")) == 0)

    check("listing projects in an organization you do not belong to is empty",
          len(q("PROJECTS_FOR_USER", "u_eve", "org_acme")) == 0)

                                                                     
                                                  
                                                                     
    rows = q("PROJECT_FOR_USER", "u_ben", "p_acme_secret")
    check("an org member with no route to a project gets no role",
          len(rows) == 1 and rows[0]["direct_role"] is None and rows[0]["team_role"] is None,
          "the row is an internal probe; the handler must return NOT_FOUND")

    rows = q("PROJECT_FOR_USER", "u_ana", "p_acme_a")
    check("direct project membership resolves its role",
          len(rows) == 1 and rows[0]["direct_role"] == "editor")

    rows = q("PROJECT_FOR_USER", "u_cleo", "p_acme_secret")
    check("team access resolves a role without direct membership",
          len(rows) == 1 and rows[0]["direct_role"] is None and rows[0]["team_role"] == "viewer")

    names = [r["name"] for r in q("PROJECTS_FOR_USER", "u_ben", "org_acme")]
    check("a member with no project access still sees organization-wide projects only",
          names == ["Company wide"], f"got {names}")

    ids = sorted(r["id"] for r in q("PROJECTS_FOR_USER", "u_cleo", "org_acme"))
    check("team access puts the project in the list",
          ids == ["p_acme_open", "p_acme_secret"], f"got {ids}")

                                                                     
                                         
                                                                     
    check("a suspended membership cannot list projects",
          len(q("PROJECTS_FOR_USER", "u_sus", "org_acme")) == 0)

    check("a suspended membership holds no capabilities",
          len(q("CAPABILITIES_FOR_USER", "u_sus", "org_acme")) == 0)

    check("a suspended member cannot read artifacts they used to reach",
          len(q("ARTIFACTS_FOR_USER", "u_sus", "p_acme_a", "")) == 0)

    db.execute("UPDATE organization_memberships SET status='removed' WHERE user_id='u_ana'")
    check("removing a membership empties the project list at once",
          len(q("PROJECTS_FOR_USER", "u_ana", "org_acme")) == 0)
    check("and closes artifact access by direct id",
          len(q("ARTIFACT_FOR_USER", "u_ana", "a_open")) == 0)
    db.execute("UPDATE organization_memberships SET status='active' WHERE user_id='u_ana'")

                                                                     
                          
                                                                     
    check("an artifact in a project you cannot reach is not returned by id",
          len(q("ARTIFACT_FOR_USER", "u_ben", "a_secret")) == 0)

    check("the person with team access can read that same artifact",
          len(q("ARTIFACT_FOR_USER", "u_cleo", "a_secret")) == 1)

    titles = [r["title"] for r in q("SEARCH_FOR_USER", "u_ben", "org_acme", "%finding%")]
    check("search never returns work from inaccessible projects",
          "Confidential finding" not in titles, f"got {titles}")

    titles = [r["title"] for r in q("SEARCH_FOR_USER", "u_cleo", "org_acme", "%finding%")]
    check("search does return work the user can legitimately reach",
          "Confidential finding" in titles, f"got {titles}")

    titles = [r["title"] for r in q("SEARCH_FOR_USER", "u_eve", "org_acme", "%finding%")]
    check("search scoped to another organization returns nothing",
          titles == [], f"got {titles}")

                                                                     
                    
                                                                     
    check("a dataset's storage key is not reachable without project access",
          len(q("DATASET_VERSION_FOR_USER", "u_ben", "dv_secret")) == 0)

    rows = q("DATASET_VERSION_FOR_USER", "u_cleo", "dv_secret")
    check("and is reachable with it",
          len(rows) == 1 and rows[0]["r2_key"].startswith("org_acme/"))

    check("a dataset version id from another organization is refused",
          len(q("DATASET_VERSION_FOR_USER", "u_eve", "dv_secret")) == 0)

                                                                     
                  
                                                                     
    caps = {r["capability_id"] for r in q("CAPABILITIES_FOR_USER", "u_ana", "org_acme")}
    check("a member profile supplies its capabilities",
          "sql.use" in caps and "reports.create" in caps, f"got {sorted(caps)}")

    caps = {r["capability_id"] for r in q("CAPABILITIES_FOR_USER", "u_cleo", "org_acme")}
    check("team profile capabilities are unioned with the member profile",
          {"reports.view", "workflows.run"} <= caps, f"got {sorted(caps)}")

    caps = {r["capability_id"] for r in q("CAPABILITIES_FOR_USER", "u_ben", "org_acme")}
    check("a read-only member does not pick up another team's capabilities",
          "workflows.run" not in caps, f"got {sorted(caps)}")

                                                                          
    db.execute("INSERT INTO teams (id, organization_id, name, access_profile_id,"
               " created_at, updated_at) VALUES ('t_rival','org_rival','Rival ops',"
               " 'ap_rival', ?, ?)", (NOW, NOW))
    db.execute("INSERT INTO team_memberships (id, team_id, user_id, created_at)"
               " VALUES ('tm_x','t_rival','u_ben', ?)", (NOW,))
    caps = {r["capability_id"] for r in q("CAPABILITIES_FOR_USER", "u_ben", "org_acme")}
    check("membership of a team in another organization grants nothing here",
          "sql.use" not in caps, f"got {sorted(caps)}")

                                                                     
              
                                                                     
    db.execute("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)"
               " VALUES ('s1','u_ana','hash-live', ?, ?)", (NOW, NOW + 1000))
    db.execute("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)"
               " VALUES ('s2','u_ana','hash-expired', ?, ?)", (NOW, NOW - 1))
    db.execute("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at,"
               " revoked_at) VALUES ('s3','u_ana','hash-revoked', ?, ?, ?)",
               (NOW, NOW + 10_000, NOW))

    check("a live session resolves to its user",
          len(q("SESSION_BY_HASH", "hash-live", NOW)) == 1)
    check("an expired session does not",
          len(q("SESSION_BY_HASH", "hash-expired", NOW)) == 0)
    check("a revoked session does not",
          len(q("SESSION_BY_HASH", "hash-revoked", NOW)) == 0)
    check("an unknown token does not",
          len(q("SESSION_BY_HASH", "hash-guessed", NOW)) == 0)

                                                                     
                             
                                                                     
    hostile = "' OR 1=1 --"
    check("a SQL metacharacter in a project id matches nothing",
          len(q("PROJECT_FOR_USER", "u_ana", hostile)) == 0)
    check("and in a search term is treated as text",
          len(q("SEARCH_FOR_USER", "u_ana", "org_acme", f"%{hostile}%")) == 0)

    before = db.execute("SELECT COUNT(*) c FROM projects").fetchone()["c"]
    q("SEARCH_FOR_USER", "u_ana", "org_acme", "%'; DROP TABLE projects; --%")
    after = db.execute("SELECT COUNT(*) c FROM projects").fetchone()["c"]
    check("an injection attempt cannot alter the database", before == after)

    try:
        db.execute("INSERT INTO artifacts (id, project_id, type, title, created_at,"
                   " updated_at) VALUES ('bad','p_nonexistent','finding','x', ?, ?)",
                   (NOW, NOW))
        orphan = True
    except sqlite3.IntegrityError:
        orphan = False
    check("an artifact cannot be created outside a real project", not orphan)

    try:
        db.execute("INSERT INTO artifacts (id, project_id, type, title, created_at,"
                   " updated_at) VALUES ('bad2','p_acme_a','malware','x', ?, ?)",
                   (NOW, NOW))
        bad_type = True
    except sqlite3.IntegrityError:
        bad_type = False
    check("an unknown artifact type is rejected by the schema", not bad_type)

    try:
        db.execute("INSERT INTO project_memberships (id, project_id, user_id, role,"
                   " created_at) VALUES ('x','p_acme_a','u_ben','superuser', ?)", (NOW,))
        bad_role = True
    except sqlite3.IntegrityError:
        bad_role = False
    check("an invented project role is rejected by the schema", not bad_role)

                                                                         
    db.execute("INSERT INTO audit_events (id, organization_id, actor_id, actor_email,"
               " action, created_at) VALUES ('ae1','org_rival','u_eve','eve@rival.test',"
               " 'organization.delete', ?)", (NOW,))
    db.execute("DELETE FROM organizations WHERE id='org_rival'")
    kept = db.execute("SELECT COUNT(*) c FROM audit_events WHERE organization_id='org_rival'").fetchone()["c"]
    check("audit history survives deletion of what it describes", kept == 1)

    projects_gone = db.execute("SELECT COUNT(*) c FROM projects WHERE organization_id='org_rival'").fetchone()["c"]
    check("but the organization's projects are removed with it", projects_gone == 0)

                                                                     
    passed = sum(1 for _, ok, _ in results if ok)
    for name, ok, detail in results:
        print(f"{'  ok' if ok else 'FAIL'}  {name}" + (f"\n        {detail}" if not ok and detail else ""))
    print(f"\n{passed} / {len(results)} passing")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
