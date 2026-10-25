


import {
  CAPABILITY_MIN_ROLE, ROLE_RANK, ORGANIZATION_CAPABILITIES, isCapability
} from "../shared/capabilities.js";


export const DENIED = {
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  USER_SUSPENDED: "USER_SUSPENDED",
  ORGANIZATION_INACTIVE: "ORGANIZATION_INACTIVE",
  NOT_A_MEMBER: "NOT_A_MEMBER",
  MEMBERSHIP_INACTIVE: "MEMBERSHIP_INACTIVE",
  UNKNOWN_CAPABILITY: "UNKNOWN_CAPABILITY",
  CAPABILITY_DENIED: "CAPABILITY_DENIED",
  PROJECT_ACCESS_DENIED: "PROJECT_ACCESS_DENIED",
  PROJECT_ROLE_INSUFFICIENT: "PROJECT_ROLE_INSUFFICIENT",
  CROSS_ORGANIZATION: "CROSS_ORGANIZATION",
  RESOURCE_NOT_AVAILABLE: "RESOURCE_NOT_AVAILABLE"
};

const allow = detail => ({ ok: true, ...detail });
const deny = (code, detail) => ({ ok: false, code, ...detail });


export function effectiveCapabilities({
  memberProfileCapabilities = [],
  teamProfileCapabilities = [],
  grants = [],
  restrictions = []
} = {}) {
  const set = new Set();
  for (const id of memberProfileCapabilities) if (isCapability(id)) set.add(id);
  for (const id of teamProfileCapabilities) if (isCapability(id)) set.add(id);
  for (const id of grants) if (isCapability(id)) set.add(id);
  for (const id of restrictions) set.delete(id);
  return set;
}


export function projectRole({ project, directRole = null, teamRoles = [] } = {}) {
  if (!project) return null;
  const candidates = [];
  if (directRole) candidates.push(directRole);
  for (const role of teamRoles) if (role) candidates.push(role);
  if (project.visibility === "organization") candidates.push("viewer");
  if (!candidates.length) return null;
  return candidates.reduce((best, role) =>
    (ROLE_RANK[role] || 0) > (ROLE_RANK[best] || 0) ? role : best);
}


export function authorize(capability, context = {}) {
  const { actor, organization, membership, capabilities, project, role } = context;


  if (!actor || !actor.id) return deny(DENIED.NOT_AUTHENTICATED);
  if (actor.status === "suspended") return deny(DENIED.USER_SUSPENDED);


  if (!isCapability(capability)) return deny(DENIED.UNKNOWN_CAPABILITY, { capability });


  if (!organization || !organization.id) return deny(DENIED.NOT_A_MEMBER);
  if (organization.status !== "active") return deny(DENIED.ORGANIZATION_INACTIVE);


  if (!membership) return deny(DENIED.NOT_A_MEMBER);
  if (membership.status !== "active") return deny(DENIED.MEMBERSHIP_INACTIVE, { status: membership.status });


  const held = capabilities instanceof Set ? capabilities : new Set(capabilities || []);
  if (!held.has(capability)) return deny(DENIED.CAPABILITY_DENIED, { capability });


  if (ORGANIZATION_CAPABILITIES.has(capability)) {
    return allow({ capability, scope: "organization", organizationId: organization.id });
  }


  if (!project || !project.id) {


    return deny(DENIED.RESOURCE_NOT_AVAILABLE, { capability });
  }


  if (project.organizationId !== organization.id) return deny(DENIED.CROSS_ORGANIZATION);

  if (project.status === "deleted") return deny(DENIED.RESOURCE_NOT_AVAILABLE);

  if (!role) return deny(DENIED.PROJECT_ACCESS_DENIED, { projectId: project.id });

  const needed = CAPABILITY_MIN_ROLE[capability];
  if (needed && (ROLE_RANK[role] || 0) < ROLE_RANK[needed]) {
    return deny(DENIED.PROJECT_ROLE_INSUFFICIENT, { capability, role, needed });
  }


  if (project.status === "archived" && needed) {
    return deny(DENIED.RESOURCE_NOT_AVAILABLE, { reason: "archived" });
  }

  return allow({ capability, scope: "project", projectId: project.id, role });
}


export function wouldRemoveLastAdministrator({ administrators = [], targetUserId, change }) {
  const active = administrators.filter(admin =>
    admin.status === "active" && admin.orgRole === "administrator");
  if (!active.some(admin => admin.userId === targetUserId)) return false;
  if (change === "demote" || change === "remove" || change === "suspend") {
    return active.length <= 1;
  }
  return false;
}
