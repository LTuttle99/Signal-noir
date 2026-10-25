


import { json, fail, requestId, readJson, v, Invalid } from "./lib/http.js";
import {
  currentUser, createSession, revokeSession,
  issueSignInToken, consumeSignInToken, sessionCookie, clearedCookie,
  originAllowed, newToken, hashToken
} from "./lib/session.js";
import { requireProject, requireOrganization, loadOrganizationContext } from "./lib/context.js";
import {
  PROJECTS_FOR_USER, ARTIFACTS_FOR_USER, ARTIFACT_FOR_USER,
  DATASET_VERSION_FOR_USER, SEARCH_FOR_USER, ADMINISTRATORS
} from "./lib/queries.js";


import { wouldRemoveLastAdministrator } from "./lib/authorize.js";
import { CAPABILITIES, DEFAULT_PROFILES, PROJECT_ROLES } from "./shared/capabilities.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_UPLOAD_TYPES = new Set([
  "text/csv", "text/plain", "application/json", "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);


function log(env, fields) {
  if (env.LOG_LEVEL === "silent") return;
  const safe = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (/token|secret|cookie|password|key/i.test(key)) continue;
    safe[key] = typeof value === "string" ? value.slice(0, 200) : value;
  }
  console.log(JSON.stringify(safe));
}

async function audit(env, { organizationId, actor, action, entityType = "", entityId = "", detail = "", reqId }) {
  if (!organizationId) return;
  try {
    await env.DB.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_id, actor_email, action,
                                 entity_type, entity_id, detail, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), organizationId, actor?.id || null, actor?.email || "",
           action, entityType, entityId, String(detail).slice(0, 500), reqId || "", Date.now()).run();
  } catch (error) {


    log(env, { level: "error", op: "audit.write", action, error: error.message });
  }
}


const LIMITS = {
  "auth.request": { max: 5, windowMs: 15 * 60_000 },
  "auth.verify":  { max: 10, windowMs: 15 * 60_000 },
  "invite":       { max: 20, windowMs: 60 * 60_000 },
  "upload":       { max: 60, windowMs: 60 * 60_000 },
  "ai":           { max: 60, windowMs: 60 * 60_000 }
};

async function rateLimited(env, bucket, key) {
  const limit = LIMITS[bucket];
  if (!limit) return false;
  const since = Date.now() - limit.windowMs;
  const id = `${bucket}:${key}`;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS rate_events (id TEXT, at INTEGER)`
    ).run();
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM rate_events WHERE id = ? AND at > ?`
    ).bind(id, since).first();
    if ((row?.n || 0) >= limit.max) return true;
    await env.DB.prepare(`INSERT INTO rate_events (id, at) VALUES (?, ?)`)
      .bind(id, Date.now()).run();
    await env.DB.prepare(`DELETE FROM rate_events WHERE at < ?`)
      .bind(Date.now() - 24 * 3600_000).run();
    return false;
  } catch (error) {


    log(env, { level: "warn", op: "ratelimit", bucket, error: error.message });
    return false;
  }
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {

      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    }

    const reqId = requestId();
    const started = Date.now();

    if (!originAllowed(request, env)) {
      return fail("ORIGIN_REJECTED", { requestId: reqId });
    }

    try {
      const response = await route(request, env, url, reqId);
      log(env, {
        reqId, op: `${request.method} ${url.pathname}`,
        status: response.status, ms: Date.now() - started
      });
      return response;
    } catch (error) {
      if (error instanceof Invalid) {
        return fail("INVALID_INPUT", { requestId: reqId, detail: error.message });
      }

      log(env, {
        level: "error", reqId, op: `${request.method} ${url.pathname}`,
        error: error.message, stack: String(error.stack || "").slice(0, 500)
      });
      return fail("INTERNAL", { requestId: reqId });
    }
  }
};

async function route(request, env, url, reqId) {
  const segments = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [head, ...rest] = segments;


  if (head === "health") {

    return json({ ok: true }, { requestId: reqId });
  }

  if (head === "capabilities") {


    return json({ capabilities: CAPABILITIES, profiles: DEFAULT_PROFILES, roles: PROJECT_ROLES },
                { requestId: reqId });
  }

  if (head === "auth") return authRoutes(request, env, rest, reqId);


  const user = await currentUser(request, env);
  if (!user) return fail("NOT_AUTHENTICATED", { requestId: reqId });
  if (user.status === "suspended") return fail("USER_SUSPENDED", { requestId: reqId });

  if (head === "me") return meRoute(request, env, user, reqId);
  if (head === "organizations") return organizationRoutes(request, env, user, rest, url, reqId);
  if (head === "projects") return projectRoutes(request, env, user, rest, url, reqId);
  if (head === "search") return searchRoute(request, env, user, url, reqId);
  if (head === "datasets") return datasetRoutes(request, env, user, rest, url, reqId);
  if (head === "ai") return aiRoute(request, env, user, reqId);

  return fail("NOT_FOUND", { requestId: reqId });
}


async function authRoutes(request, env, rest, reqId) {
  const [action] = rest;

  if (action === "request" && request.method === "POST") {
    const body = await readJson(request);
    const email = v.email(body.email);

    if (await rateLimited(env, "auth.request", email)) {
      return fail("RATE_LIMITED", { requestId: reqId });
    }

    const { token, expiresAt } = await issueSignInToken(env, email);
    const link = `${new URL(request.url).origin}/connect.html?token=${encodeURIComponent(token)}`;

    const configured = Boolean(env.EMAIL_PROVIDER);
    if (configured) {


      log(env, { reqId, op: "auth.email.send", to: "[redacted]" });
    }

    log(env, { reqId, op: "auth.request", delivered: configured });


    return json({
      ok: true,
      delivery: configured ? "email" : "manual",
      message: configured
        ? "Check your email for a sign-in link."
        : "Automated email delivery is not configured for this deployment. Use the link below to sign in.",
      ...(configured ? {} : { link, expiresAt })
    }, { requestId: reqId });
  }

  if (action === "verify" && request.method === "POST") {
    const body = await readJson(request);
    const token = v.text(body.token, "token", { min: 16, max: 200 });

    if (await rateLimited(env, "auth.verify", token.slice(0, 12))) {
      return fail("RATE_LIMITED", { requestId: reqId });
    }

    const email = await consumeSignInToken(env, token);
    if (!email) {
      log(env, { reqId, op: "auth.verify", outcome: "rejected" });
      return fail("NOT_AUTHENTICATED", {
        requestId: reqId,
        message: "That sign-in link has expired or has already been used."
      });
    }

    let user = await env.DB.prepare(`SELECT id, status FROM users WHERE email_lower = ?`)
      .bind(email).first();

    if (!user) {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO users (id, email, email_lower, display_name, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, email, email, email.split("@")[0], Date.now(), Date.now()).run();
      user = { id, status: "active" };
    }

    if (user.status === "suspended") return fail("USER_SUSPENDED", { requestId: reqId });

    await claimInvitations(env, user.id, email, reqId);

    const token2 = await createSession(env, user.id, {
      userAgent: request.headers.get("user-agent") || ""
    });
    return json({ ok: true }, {
      requestId: reqId,
      headers: { "Set-Cookie": sessionCookie(token2) }
    });
  }

  if (action === "signout" && request.method === "POST") {
    const user = await currentUser(request, env);
    if (user) await revokeSession(env, user.sessionId);
    return json({ ok: true }, {
      requestId: reqId,
      headers: { "Set-Cookie": clearedCookie() }
    });
  }

  return fail("METHOD_NOT_ALLOWED", { requestId: reqId });
}


async function claimInvitations(env, userId, email, reqId) {
  const now = Date.now();
  const pending = await env.DB.prepare(
    `SELECT id, organization_id, access_profile_id, team_id, org_role, invited_by
       FROM invitations
      WHERE email_lower = ? AND consumed_at IS NULL AND expires_at > ?`
  ).bind(email, now).all();

  for (const invite of pending.results || []) {
    const claimed = await env.DB.prepare(
      `UPDATE invitations SET consumed_at = ?, consumed_by = ?
        WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`
    ).bind(now, userId, invite.id, now).run();
    if (!claimed.meta.changes) continue;

    await env.DB.prepare(
      `INSERT INTO organization_memberships
         (id, organization_id, user_id, status, org_role, access_profile_id,
          joined_at, invited_by, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET
         status = 'active', joined_at = excluded.joined_at`
    ).bind(crypto.randomUUID(), invite.organization_id, userId, invite.org_role,
           invite.access_profile_id, now, invite.invited_by, now).run();

    if (invite.team_id) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO team_memberships (id, team_id, user_id, created_at)
         VALUES (?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), invite.team_id, userId, now).run();
    }

    await audit(env, {
      organizationId: invite.organization_id,
      actor: { id: userId, email },
      action: "membership.joined", entityType: "user", entityId: userId,
      detail: "accepted invitation", reqId
    });
  }
}


async function meRoute(request, env, user, reqId) {
  const memberships = await env.DB.prepare(
    `SELECT o.id, o.name, o.slug, o.status, m.status AS membership_status, m.org_role
       FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ? AND m.status = 'active' AND o.status = 'active'
      ORDER BY o.name`
  ).bind(user.id).all();

  await env.DB.prepare(`UPDATE users SET last_active_at = ? WHERE id = ?`)
    .bind(Date.now(), user.id).run();

  return json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
    organizations: (memberships.results || []).map(row => ({
      id: row.id, name: row.name, slug: row.slug,
      role: row.org_role
    }))
  }, { requestId: reqId });
}


async function organizationRoutes(request, env, user, rest, url, reqId) {
  const [organizationId, section, targetId] = rest;


  if (!organizationId && request.method === "POST") {
    const body = await readJson(request);
    const name = v.text(body.name, "name", { min: 1, max: 120 });
    const slug = slugify(name);
    const now = Date.now();
    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO organizations (id, name, slug, created_at, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, name, `${slug}-${id.slice(0, 6)}`, now, user.id).run();


    let adminProfileId = null;
    for (const profile of DEFAULT_PROFILES) {
      const profileId = crypto.randomUUID();
      if (profile.key === "administrator") adminProfileId = profileId;
      await env.DB.prepare(
        `INSERT INTO access_profiles (id, organization_id, key, name, description,
                                      builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(profileId, id, profile.key, profile.name, profile.description, now, now).run();
      for (const capability of profile.capabilities) {
        await env.DB.prepare(
          `INSERT INTO access_profile_capabilities (profile_id, capability_id) VALUES (?, ?)`
        ).bind(profileId, capability).run();
      }
    }

    await env.DB.prepare(
      `INSERT INTO organization_memberships
         (id, organization_id, user_id, status, org_role, access_profile_id, joined_at, created_at)
       VALUES (?, ?, ?, 'active', 'administrator', ?, ?, ?)`
    ).bind(crypto.randomUUID(), id, user.id, adminProfileId, now, now).run();

    await env.DB.prepare(
      `INSERT INTO organization_ai_policy (organization_id, updated_at, updated_by)
       VALUES (?, ?, ?)`
    ).bind(id, now, user.id).run();

    await audit(env, { organizationId: id, actor: user, action: "organization.create",
                       entityType: "organization", entityId: id, detail: name, reqId });

    return json({ organization: { id, name } }, { status: 201, requestId: reqId });
  }

  if (!organizationId) return fail("METHOD_NOT_ALLOWED", { requestId: reqId });
  v.id(organizationId, "organizationId");


  if (section === "members") {
    if (request.method === "GET") {
      const guard = await requireOrganization(env, user, organizationId, "members.manage");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      const rows = await env.DB.prepare(
        `SELECT m.id, m.user_id, m.status, m.org_role, m.access_profile_id,
                u.email, u.display_name
           FROM organization_memberships m
           JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = ?
          ORDER BY u.email`
      ).bind(organizationId).all();
      return json({ members: rows.results || [] }, { requestId: reqId });
    }


    if (request.method === "PATCH" && targetId) {
      const guard = await requireOrganization(env, user, organizationId, "members.manage");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      const body = await readJson(request);
      v.id(targetId, "userId");

      const change = body.status === "removed" ? "remove"
        : body.status === "suspended" ? "suspend"
        : body.orgRole === "member" ? "demote" : null;

      if (change) {
        const admins = await env.DB.prepare(ADMINISTRATORS).bind(organizationId).all();
        const locked = wouldRemoveLastAdministrator({
          administrators: (admins.results || []).map(r => ({
            userId: r.user_id, status: r.status, orgRole: r.org_role
          })),
          targetUserId: targetId,
          change
        });
        if (locked) {
          return fail("INVALID_INPUT", {
            requestId: reqId,
            message: "This is the only administrator. Make someone else an administrator first."
          });
        }
      }

      const fields = [];
      const values = [];
      if (body.status !== undefined) {
        fields.push("status = ?");
        values.push(v.oneOf(body.status, ["active", "suspended", "removed"], "status"));
      }
      if (body.orgRole !== undefined) {
        fields.push("org_role = ?");
        values.push(v.oneOf(body.orgRole, ["member", "administrator"], "orgRole"));
      }
      if (body.accessProfileId !== undefined) {


        const profile = await env.DB.prepare(
          `SELECT id FROM access_profiles WHERE id = ? AND organization_id = ?`
        ).bind(v.id(body.accessProfileId, "accessProfileId"), organizationId).first();
        if (!profile) return fail("INVALID_INPUT", { requestId: reqId, detail: "unknown access profile" });
        fields.push("access_profile_id = ?");
        values.push(profile.id);
      }
      if (!fields.length) return fail("INVALID_INPUT", { requestId: reqId });

      await env.DB.prepare(
        `UPDATE organization_memberships SET ${fields.join(", ")}
          WHERE organization_id = ? AND user_id = ?`
      ).bind(...values, organizationId, targetId).run();


      await audit(env, { organizationId, actor: user, action: "membership.update",
                         entityType: "user", entityId: targetId,
                         detail: JSON.stringify(body).slice(0, 200), reqId });

      return json({ ok: true }, { requestId: reqId });
    }
  }


  if (section === "invitations" && request.method === "POST") {
    const guard = await requireOrganization(env, user, organizationId, "members.manage");
    if (!guard.ok) return fail(guard.code, { requestId: reqId });
    if (await rateLimited(env, "invite", organizationId)) {
      return fail("RATE_LIMITED", { requestId: reqId });
    }

    const body = await readJson(request);
    const email = v.email(body.email);
    const orgRole = v.oneOf(body.orgRole || "member", ["member", "administrator"], "orgRole");

    let profileId = null;
    if (body.accessProfileId) {
      const profile = await env.DB.prepare(
        `SELECT id FROM access_profiles WHERE id = ? AND organization_id = ?`
      ).bind(v.id(body.accessProfileId, "accessProfileId"), organizationId).first();
      if (!profile) return fail("INVALID_INPUT", { requestId: reqId, detail: "unknown access profile" });
      profileId = profile.id;
    }

    const token = newToken();
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO invitations (id, organization_id, email_lower, token_hash,
                                access_profile_id, team_id, org_role, invited_by,
                                created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), organizationId, email, await hashToken(token),
           profileId, body.teamId ? v.id(body.teamId, "teamId") : null,
           orgRole, user.id, now, now + 7 * 86400_000).run();

    await audit(env, { organizationId, actor: user, action: "invitation.create",
                       entityType: "email", entityId: email, reqId });

    const link = `${new URL(request.url).origin}/connect.html?invite=${encodeURIComponent(token)}`;
    return json({
      ok: true,
      delivery: env.EMAIL_PROVIDER ? "email" : "manual",
      message: env.EMAIL_PROVIDER
        ? "An invitation has been emailed."
        : "Automated email delivery is not configured. Copy this link and send it yourself.",
      ...(env.EMAIL_PROVIDER ? {} : { link }),
      expiresAt: now + 7 * 86400_000
    }, { status: 201, requestId: reqId });
  }


  if (section === "audit" && request.method === "GET") {
    const guard = await requireOrganization(env, user, organizationId, "audit.view");
    if (!guard.ok) return fail(guard.code, { requestId: reqId });
    const rows = await env.DB.prepare(
      `SELECT id, actor_email, action, entity_type, entity_id, detail, created_at
         FROM audit_events WHERE organization_id = ?
        ORDER BY created_at DESC LIMIT 200`
    ).bind(organizationId).all();
    return json({ events: rows.results || [] }, { requestId: reqId });
  }


  if (section === "projects" && request.method === "GET") {
    const context = await loadOrganizationContext(env, user, organizationId);


    if (!context.organization || context.organization.status !== "active") {
      return fail("NOT_A_MEMBER", { requestId: reqId });
    }
    if (!context.membership || context.membership.status !== "active") {
      return fail("NOT_A_MEMBER", { requestId: reqId });
    }
    const rows = await env.DB.prepare(PROJECTS_FOR_USER).bind(user.id, organizationId).all();
    return json({ projects: rows.results || [] }, { requestId: reqId });
  }

  return fail("NOT_FOUND", { requestId: reqId });
}

const slugify = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "").slice(0, 40) || "org";


async function projectRoutes(request, env, user, rest, url, reqId) {
  const [projectId, section, itemId] = rest;

  if (!projectId && request.method === "POST") {
    const body = await readJson(request);
    const organizationId = v.id(body.organizationId, "organizationId");
    const guard = await requireOrganization(env, user, organizationId, "projects.create");
    if (!guard.ok) return fail(guard.code, { requestId: reqId });

    const name = v.text(body.name, "name", { min: 1, max: 160 });
    const now = Date.now();
    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO projects (id, organization_id, name, description, visibility,
                             created_by, created_at, updated_at, migrated_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, organizationId, name,
           v.text(body.description || "", "description", { max: 2000 }),
           v.oneOf(body.visibility || "members", ["members", "organization"], "visibility"),
           user.id, now, now,
           body.migratedFrom ? v.text(body.migratedFrom, "migratedFrom", { max: 64 }) : null).run();

    await env.DB.prepare(
      `INSERT INTO project_memberships (id, project_id, user_id, role, granted_by, created_at)
       VALUES (?, ?, ?, 'owner', ?, ?)`
    ).bind(crypto.randomUUID(), id, user.id, user.id, now).run();

    await audit(env, { organizationId, actor: user, action: "project.create",
                       entityType: "project", entityId: id, detail: name, reqId });

    return json({ project: { id, name, organizationId } }, { status: 201, requestId: reqId });
  }

  if (!projectId) return fail("METHOD_NOT_ALLOWED", { requestId: reqId });
  v.id(projectId, "projectId");


  if (!section) {
    if (request.method === "GET") {
      const guard = await requireProject(env, user, projectId, "analysis.basic");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      return json({ project: guard.project, role: guard.role }, { requestId: reqId });
    }

    if (request.method === "PATCH") {
      const guard = await requireProject(env, user, projectId, "data.import");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      const body = await readJson(request);


      const expected = v.integer(body.revision, "revision", { min: 1 });
      const result = await env.DB.prepare(
        `UPDATE projects SET name = ?, description = ?, updated_at = ?, revision = revision + 1
          WHERE id = ? AND revision = ?`
      ).bind(v.text(body.name ?? guard.project.name, "name", { min: 1, max: 160 }),
             v.text(body.description ?? "", "description", { max: 2000 }),
             Date.now(), projectId, expected).run();

      if (!result.meta.changes) {
        const current = await env.DB.prepare(`SELECT revision FROM projects WHERE id = ?`)
          .bind(projectId).first();
        return fail("REVISION_CONFLICT", {
          requestId: reqId,
          detail: `stored revision is ${current?.revision}`
        });
      }
      return json({ ok: true, revision: expected + 1 }, { requestId: reqId });
    }

    if (request.method === "DELETE") {
      const guard = await requireProject(env, user, projectId, "projects.delete");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });

      await env.DB.prepare(
        `UPDATE projects SET status = 'deleted', deleted_at = ? WHERE id = ?`
      ).bind(Date.now(), projectId).run();
      await audit(env, { organizationId: guard.organizationId, actor: user,
                         action: "project.delete", entityType: "project",
                         entityId: projectId, reqId });
      return json({ ok: true }, { requestId: reqId });
    }
  }


  if (section === "artifacts") {
    if (request.method === "GET") {
      const guard = await requireProject(env, user, projectId, "analysis.basic");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      const type = url.searchParams.get("type") || "";
      if (type && !["finding", "chart", "dashboard", "report", "workflow",
                    "decision", "task", "dataset"].includes(type)) {
        return fail("INVALID_INPUT", { requestId: reqId, detail: "unknown type" });
      }
      const rows = await env.DB.prepare(ARTIFACTS_FOR_USER)
        .bind(user.id, projectId, type).all();
      return json({ artifacts: rows.results || [] }, { requestId: reqId });
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const type = v.oneOf(body.type, ["finding", "chart", "dashboard", "report",
                                       "workflow", "decision", "task", "dataset"], "type");


      const needed = {
        finding: "findings.save", chart: "charts.create", dashboard: "dashboards.create",
        report: "reports.create", workflow: "workflows.create",
        decision: "decisions.manage", task: "tasks.manage", dataset: "data.import"
      }[type];
      const guard = await requireProject(env, user, projectId, needed);
      if (!guard.ok) return fail(guard.code, { requestId: reqId });

      const id = crypto.randomUUID();
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO artifacts (id, project_id, type, title, body, created_by,
                                created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, projectId, type,
             v.text(body.title || "", "title", { max: 300 }),
             v.jsonBlob(body.body, "body"),
             user.id, now, now).run();

      await env.DB.prepare(
        `INSERT INTO activity_events (id, project_id, actor_id, verb, object_type,
                                      object_id, summary, created_at)
         VALUES (?, ?, ?, 'created', ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), projectId, user.id, type, id,
             String(body.title || "").slice(0, 200), now).run();

      return json({ artifact: { id, type } }, { status: 201, requestId: reqId });
    }

    if (request.method === "PATCH" && itemId) {
      v.id(itemId, "artifactId");
      const existing = await env.DB.prepare(ARTIFACT_FOR_USER).bind(user.id, itemId).first();
      if (!existing || existing.project_id !== projectId) {
        return fail("NOT_FOUND", { requestId: reqId });
      }
      const needed = {
        finding: "findings.save", chart: "charts.create", dashboard: "dashboards.create",
        report: "reports.create", workflow: "workflows.create",
        decision: "decisions.manage", task: "tasks.manage", dataset: "data.import"
      }[existing.type];
      const guard = await requireProject(env, user, projectId, needed);
      if (!guard.ok) return fail(guard.code, { requestId: reqId });

      const body = await readJson(request);
      const expected = v.integer(body.revision, "revision", { min: 1 });
      const result = await env.DB.prepare(
        `UPDATE artifacts SET title = ?, body = ?, updated_at = ?, revision = revision + 1
          WHERE id = ? AND revision = ?`
      ).bind(v.text(body.title ?? existing.title, "title", { max: 300 }),
             v.jsonBlob(body.body, "body"), Date.now(), itemId, expected).run();

      if (!result.meta.changes) {
        return fail("REVISION_CONFLICT", { requestId: reqId });
      }
      return json({ ok: true, revision: expected + 1 }, { requestId: reqId });
    }
  }


  if (section === "activity" && request.method === "GET") {
    const guard = await requireProject(env, user, projectId, "analysis.basic");
    if (!guard.ok) return fail(guard.code, { requestId: reqId });
    const rows = await env.DB.prepare(
      `SELECT a.id, a.verb, a.object_type, a.object_id, a.summary, a.created_at,
              u.display_name AS actor
         FROM activity_events a
         LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.project_id = ? ORDER BY a.created_at DESC LIMIT 100`
    ).bind(projectId).all();
    return json({ activity: rows.results || [] }, { requestId: reqId });
  }


  if (section === "comments") {
    if (request.method === "GET") {
      const guard = await requireProject(env, user, projectId, "analysis.basic");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      const rows = await env.DB.prepare(
        `SELECT c.id, c.artifact_id, c.body, c.created_at, c.resolved_at,
                u.display_name AS author
           FROM comments c LEFT JOIN users u ON u.id = c.author_id
          WHERE c.project_id = ? ORDER BY c.created_at DESC LIMIT 200`
      ).bind(projectId).all();
      return json({ comments: rows.results || [] }, { requestId: reqId });
    }
    if (request.method === "POST") {
      const guard = await requireProject(env, user, projectId, "tasks.manage");
      if (!guard.ok) return fail(guard.code, { requestId: reqId });
      const body = await readJson(request);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO comments (id, project_id, artifact_id, author_id, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, projectId, body.artifactId ? v.id(body.artifactId, "artifactId") : null,
             user.id, v.text(body.body, "body", { min: 1, max: 5000 }), Date.now()).run();
      return json({ comment: { id } }, { status: 201, requestId: reqId });
    }
  }


  if (section === "datasets" && request.method === "POST") {
    return uploadDataset(request, env, user, projectId, reqId);
  }

  return fail("NOT_FOUND", { requestId: reqId });
}


async function uploadDataset(request, env, user, projectId, reqId) {
  const guard = await requireProject(env, user, projectId, "data.import");
  if (!guard.ok) return fail(guard.code, { requestId: reqId });
  if (await rateLimited(env, "upload", user.id)) {
    return fail("RATE_LIMITED", { requestId: reqId });
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES) return fail("PAYLOAD_TOO_LARGE", { requestId: reqId });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("INVALID_INPUT", { requestId: reqId, detail: "no file" });
  if (file.size > MAX_UPLOAD_BYTES) return fail("PAYLOAD_TOO_LARGE", { requestId: reqId });


  const type = (file.type || "application/octet-stream").split(";")[0];
  if (type !== "application/octet-stream" && !ALLOWED_UPLOAD_TYPES.has(type)) {
    return fail("UNSUPPORTED_MEDIA_TYPE", { requestId: reqId, detail: type });
  }

  const filename = v.filename(form.get("filename") || file.name || "upload");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");

  const now = Date.now();
  const datasetName = v.text(form.get("name") || filename, "name", { max: 200 });

  let dataset = await env.DB.prepare(
    `SELECT id FROM datasets WHERE project_id = ? AND name = ?`
  ).bind(projectId, datasetName).first();

  if (!dataset) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO datasets (id, project_id, name, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, projectId, datasetName, user.id, now, now).run();
    dataset = { id };
  }

  const previous = await env.DB.prepare(
    `SELECT MAX(version_no) AS n FROM dataset_versions WHERE dataset_id = ?`
  ).bind(dataset.id).first();
  const versionNo = (previous?.n || 0) + 1;


  const key = `${guard.organizationId}/${projectId}/${dataset.id}/v${versionNo}`;
  await env.R2.put(key, bytes, {
    httpMetadata: { contentType: type },
    customMetadata: { checksum, uploadedBy: user.id }
  });

  const versionId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO dataset_versions (id, dataset_id, version_no, r2_key, original_filename,
                                   content_type, byte_size, checksum_sha256,
                                   uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(versionId, dataset.id, versionNo, key, filename, type,
         bytes.byteLength, checksum, user.id, now).run();

  await env.DB.prepare(`UPDATE datasets SET current_version_id = ?, updated_at = ? WHERE id = ?`)
    .bind(versionId, now, dataset.id).run();

  await audit(env, { organizationId: guard.organizationId, actor: user,
                     action: "dataset.upload", entityType: "dataset", entityId: dataset.id,
                     detail: `v${versionNo} ${bytes.byteLength} bytes`, reqId });

  return json({
    dataset: { id: dataset.id, name: datasetName },
    version: { id: versionId, versionNo, checksum, byteSize: bytes.byteLength }
  }, { status: 201, requestId: reqId });
}

async function datasetRoutes(request, env, user, rest, url, reqId) {
  const [versionId, action] = rest;
  if (!versionId || action !== "content" || request.method !== "GET") {
    return fail("NOT_FOUND", { requestId: reqId });
  }
  v.id(versionId, "versionId");


  const row = await env.DB.prepare(DATASET_VERSION_FOR_USER).bind(user.id, versionId).first();
  if (!row) return fail("NOT_FOUND", { requestId: reqId });

  const object = await env.R2.get(row.r2_key);
  if (!object) return fail("NOT_FOUND", { requestId: reqId });

  return new Response(object.body, {
    headers: {
      "Content-Type": row.content_type || "application/octet-stream",


      "Content-Disposition": `attachment; filename="${row.original_filename.replace(/["\\]/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
      "X-Request-Id": reqId
    }
  });
}


async function searchRoute(request, env, user, url, reqId) {
  const organizationId = v.id(url.searchParams.get("organizationId") || "", "organizationId");
  const term = v.text(url.searchParams.get("q") || "", "q", { min: 1, max: 100 });

  const context = await loadOrganizationContext(env, user, organizationId);
  if (!context.membership || context.membership.status !== "active") {
    return fail("NOT_A_MEMBER", { requestId: reqId });
  }


  const pattern = `%${term.toLowerCase().replace(/[%_]/g, ch => `\\${ch}`)}%`;
  const rows = await env.DB.prepare(SEARCH_FOR_USER)
    .bind(user.id, organizationId, pattern).all();

  return json({ results: rows.results || [] }, { requestId: reqId });
}


async function aiRoute(request, env, user, reqId) {
  if (request.method !== "POST") return fail("METHOD_NOT_ALLOWED", { requestId: reqId });

  const body = await readJson(request, { maxBytes: 256 * 1024 });
  const projectId = v.id(body.projectId, "projectId");

  const guard = await requireProject(env, user, projectId, "vanessa.model");
  if (!guard.ok) return fail(guard.code, { requestId: reqId });

  if (await rateLimited(env, "ai", user.id)) {
    return fail("RATE_LIMITED", { requestId: reqId });
  }

  const policy = await env.DB.prepare(
    `SELECT mode, allowed_providers, allowed_models, share_level, max_request_bytes
       FROM organization_ai_policy WHERE organization_id = ?`
  ).bind(guard.organizationId).first();

  if (!policy || policy.mode !== "remote-allowed") {
    return fail("AI_POLICY_DENIED", {
      requestId: reqId,
      message: "This organization allows on-device models only."
    });
  }

  if (!env.AI_PROVIDER_KEY || !env.AI_PROVIDER_URL) {
    return fail("AI_NOT_CONFIGURED", { requestId: reqId });
  }

  const allowedModels = JSON.parse(policy.allowed_models || "[]");
  const model = v.text(body.model || "", "model", { min: 1, max: 100 });
  if (allowedModels.length && !allowedModels.includes(model)) {
    return fail("AI_POLICY_DENIED", { requestId: reqId, detail: "model not approved" });
  }


  if (Array.isArray(body.rows) && body.rows.length) {
    return fail("AI_POLICY_DENIED", {
      requestId: reqId,
      message: "Dataset rows are never sent to a model."
    });
  }

  const payload = JSON.stringify({ model, messages: body.messages || [] });
  if (payload.length > (policy.max_request_bytes || 131072)) {
    return fail("PAYLOAD_TOO_LARGE", { requestId: reqId });
  }

  await audit(env, { organizationId: guard.organizationId, actor: user,
                     action: "ai.request", entityType: "project", entityId: projectId,
                     detail: `model=${model} bytes=${payload.length}`, reqId });

  const upstream = await fetch(env.AI_PROVIDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.AI_PROVIDER_KEY}`
    },
    body: payload
  });

  if (!upstream.ok) {
    log(env, { level: "warn", reqId, op: "ai.upstream", status: upstream.status });
    return fail("INTERNAL", {
      requestId: reqId,
      message: "The AI provider could not be reached. Local analysis is unaffected."
    });
  }


  return new Response(upstream.body, {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": reqId }
  });
}
