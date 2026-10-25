


import {
  PROJECT_FOR_USER, CAPABILITIES_FOR_USER, CAPABILITY_OVERRIDES_FOR_USER
} from "./queries.js";
import { authorize, projectRole, effectiveCapabilities, DENIED } from "./authorize.js";

export async function loadOrganizationContext(env, user, organizationId) {
  const organization = await env.DB.prepare(
    `SELECT id, name, slug, status FROM organizations WHERE id = ?`
  ).bind(organizationId).first();
  if (!organization) return { organization: null, membership: null, capabilities: new Set() };

  const membership = await env.DB.prepare(
    `SELECT id, status, org_role, access_profile_id
       FROM organization_memberships
      WHERE organization_id = ? AND user_id = ?`
  ).bind(organizationId, user.id).first();

  if (!membership) return { organization, membership: null, capabilities: new Set() };

  const [held, overrides] = await Promise.all([
    env.DB.prepare(CAPABILITIES_FOR_USER).bind(user.id, organizationId).all(),
    env.DB.prepare(CAPABILITY_OVERRIDES_FOR_USER).bind(user.id, organizationId).all()
  ]);

  const rows = overrides.results || [];
  const capabilities = effectiveCapabilities({
    memberProfileCapabilities: (held.results || [])
      .filter(r => r.source === "profile").map(r => r.capability_id),
    teamProfileCapabilities: (held.results || [])
      .filter(r => r.source === "team").map(r => r.capability_id),
    grants: rows.filter(r => r.effect === "grant").map(r => r.capability_id),
    restrictions: rows.filter(r => r.effect === "restrict").map(r => r.capability_id)
  });

  return {
    organization: { id: organization.id, name: organization.name, status: organization.status },
    membership: { id: membership.id, status: membership.status, orgRole: membership.org_role },
    capabilities
  };
}


export async function requireProject(env, user, projectId, capability) {
  const row = await env.DB.prepare(PROJECT_FOR_USER).bind(user.id, projectId).first();


  if (!row) return { ok: false, code: DENIED.PROJECT_ACCESS_DENIED };


  if (row.membership_status !== "active") {
    return { ok: false, code: DENIED.PROJECT_ACCESS_DENIED, organizationId: row.organization_id };
  }

  const project = {
    id: row.project_id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status,
    visibility: row.visibility,
    revision: row.revision,
    updatedAt: row.updated_at
  };

  const role = projectRole({
    project,
    directRole: row.direct_role,
    teamRoles: [row.team_role]
  });

  const { capabilities } = await loadOrganizationContext(env, user, row.organization_id);

  const decision = authorize(capability, {
    actor: user,
    organization: { id: row.organization_id, status: row.organization_status },
    membership: { status: row.membership_status, orgRole: row.org_role },
    capabilities,
    project,
    role
  });

  if (!decision.ok) return { ok: false, code: decision.code, organizationId: row.organization_id };
  return { ok: true, project, role, capabilities, organizationId: row.organization_id };
}


export async function requireOrganization(env, user, organizationId, capability) {
  const context = await loadOrganizationContext(env, user, organizationId);
  const decision = authorize(capability, {
    actor: user,
    organization: context.organization,
    membership: context.membership,
    capabilities: context.capabilities
  });
  if (!decision.ok) return { ok: false, code: decision.code };
  return { ok: true, ...context };
}
