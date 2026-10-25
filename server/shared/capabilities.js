


export const CATEGORIES = [
  "data", "analysis", "vanessa", "visualization", "reporting", "workflows",
  "operations", "collaboration", "governance", "projects", "administration",
  "utilities"
];


export const CAPABILITIES = [
  { id: "data.import",        category: "data",           risk: "low" },
  { id: "data.clean",         category: "data",           risk: "medium" },
  { id: "data.transform",     category: "data",           risk: "medium" },
  { id: "data.export",        category: "data",           risk: "high" },

  { id: "analysis.basic",     category: "analysis",       risk: "low" },
  { id: "analysis.advanced",  category: "analysis",       risk: "low" },
  { id: "sql.use",            category: "analysis",       risk: "medium" },

  { id: "vanessa.use",        category: "vanessa",        risk: "low" },
  { id: "vanessa.model",      category: "vanessa",        risk: "medium" },

  { id: "charts.create",      category: "visualization",  risk: "low" },
  { id: "dashboards.view",    category: "visualization",  risk: "low" },
  { id: "dashboards.create",  category: "visualization",  risk: "low" },

  { id: "reports.view",       category: "reporting",      risk: "low" },
  { id: "reports.create",     category: "reporting",      risk: "low" },
  { id: "findings.save",      category: "reporting",      risk: "low" },

  { id: "workflows.view",     category: "workflows",      risk: "low" },
  { id: "workflows.run",      category: "workflows",      risk: "medium" },
  { id: "workflows.create",   category: "workflows",      risk: "medium" },


  { id: "workflows.approve",  category: "workflows",      risk: "medium" },

  { id: "operations.view",    category: "operations",     risk: "low" },
  { id: "automation.create",  category: "operations",     risk: "medium" },
  { id: "automation.activate", category: "operations",    risk: "high" },
  { id: "monitor.create",     category: "operations",     risk: "medium" },
  { id: "alert.manage",       category: "operations",     risk: "medium" },

  { id: "decisions.manage",   category: "collaboration",  risk: "low" },
  { id: "tasks.manage",       category: "collaboration",  risk: "low" },

  { id: "metrics.manage",     category: "governance",     risk: "medium" },
  { id: "privacy.manage",     category: "governance",     risk: "high" },
  { id: "governance.manage",  category: "governance",     risk: "high" },
  { id: "audit.view",         category: "governance",     risk: "medium" },

  { id: "projects.create",    category: "projects",       risk: "low" },
  { id: "projects.share",     category: "projects",       risk: "high" },
  { id: "projects.delete",    category: "projects",       risk: "high" },

  { id: "organization.manage", category: "administration", risk: "high" },
  { id: "teams.manage",       category: "administration", risk: "high" },
  { id: "members.manage",     category: "administration", risk: "high" },
  { id: "access.manage",      category: "administration", risk: "high" },

  { id: "tools.developer",    category: "utilities",      risk: "low" },
  { id: "tools.utility",      category: "utilities",      risk: "low" }
];

export const CAPABILITY_IDS = CAPABILITIES.map(item => item.id);

const INDEX = new Set(CAPABILITY_IDS);


export function isCapability(id) {
  return typeof id === "string" && INDEX.has(id);
}


export const CAPABILITY_ALIASES = {
  "workflow.run": ["workflows.run", "workflows.approve"]
};

export function migrateCapabilityIds(ids) {
  const out = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    const alias = CAPABILITY_ALIASES[id];
    if (alias) { alias.forEach(mapped => out.add(mapped)); continue; }
    if (INDEX.has(id)) out.add(id);
  }
  return [...out];
}


const CORE = [
  "vanessa.use", "data.import", "analysis.basic", "charts.create",
  "dashboards.view", "reports.view", "reports.create", "findings.save",
  "tools.utility", "projects.create"
];

export const DEFAULT_PROFILES = [
  { key: "core", name: "Core", builtin: true,
    description: "Everyday analysis. Ask Vanessa, bring in a file, get answers, make a chart or a report.",
    capabilities: CORE.slice() },
  { key: "analyst", name: "Analyst", builtin: true,
    description: "The full analytical toolkit: SQL, statistics, forecasting, transformations and workflows.",
    capabilities: [...CORE, "data.clean", "data.transform", "data.export", "sql.use",
      "analysis.advanced", "vanessa.model", "dashboards.create", "workflows.view",
      "workflows.run", "workflows.create", "metrics.manage", "projects.share",
      "tools.developer", "automation.create", "monitor.create"] },
  { key: "operations", name: "Operations", builtin: true,
    description: "Recurring work: run the approved workflows, report on them, and own what happens next.",
    capabilities: [...CORE, "data.clean", "workflows.view", "workflows.run",
      "workflows.approve", "dashboards.create", "decisions.manage", "tasks.manage",
      "automation.create", "automation.activate", "monitor.create", "alert.manage"] },
  { key: "leadership", name: "Leadership", builtin: true,
    description: "Read the numbers and decide. Dashboards, reports, findings and Vanessa, without the tooling.",
    capabilities: ["vanessa.use", "analysis.basic", "dashboards.view", "reports.view",
      "findings.save", "decisions.manage", "audit.view", "operations.view"] },
  { key: "administrator", name: "Administrator", builtin: true,
    description: "Everything, including the organization itself: teams, members, access profiles and governance.",
    capabilities: CAPABILITY_IDS.slice() },
  { key: "read-only", name: "Read only", builtin: true,
    description: "See what has already been produced. Nothing can be created or changed.",
    capabilities: ["dashboards.view", "reports.view"] }
];


export const PROJECT_ROLES = ["owner", "editor", "contributor", "viewer"];
export const ROLE_RANK = { owner: 4, editor: 3, contributor: 2, viewer: 1 };


export const CAPABILITY_MIN_ROLE = {
  "data.import": "editor",
  "data.clean": "editor",
  "data.transform": "editor",
  "data.export": "contributor",
  "findings.save": "contributor",
  "charts.create": "contributor",
  "dashboards.create": "contributor",
  "reports.create": "contributor",
  "workflows.create": "editor",
  "workflows.run": "contributor",
  "workflows.approve": "editor",
  "automation.create": "editor",
  "automation.activate": "editor",
  "monitor.create": "editor",
  "alert.manage": "contributor",
  "decisions.manage": "contributor",
  "tasks.manage": "contributor",
  "projects.share": "owner",
  "projects.delete": "owner"
};


export const ORGANIZATION_CAPABILITIES = new Set([
  "organization.manage", "teams.manage", "members.manage", "access.manage",
  "audit.view", "privacy.manage", "governance.manage",
  "projects.create",
  "tools.utility", "tools.developer"
]);
