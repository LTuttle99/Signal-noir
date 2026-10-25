


(function (root) {
  "use strict";

  const STORAGE_KEY = "sn_access_v1";
  const PREVIEW_KEY = "sn_access_preview";
  const VERSION = 1;
  const PERSONAL = "personal";


  const CATEGORIES = [
    { id: "data", label: "Data", description: "Bringing data in, cleaning it and getting it back out" },
    { id: "analysis", label: "Analysis", description: "Calculating the numbers that answer a question" },
    { id: "vanessa", label: "Vanessa", description: "The analytics operator and how she is allowed to reason" },
    { id: "visualization", label: "Visualization", description: "Charts and dashboards" },
    { id: "reporting", label: "Reporting", description: "Reports, findings and the evidence behind them" },
    { id: "workflows", label: "Workflows", description: "Repeatable analysis that runs the same way each time" },
    { id: "collaboration", label: "Collaboration", description: "Decisions and the work that follows them" },
    { id: "operations", label: "Operations", description: "Recurring processes, monitoring and what needs attention" },
    { id: "governance", label: "Governance", description: "Definitions, privacy, approvals and history" },
    { id: "projects", label: "Projects", description: "Creating, sharing and removing projects" },
    { id: "administration", label: "Administration", description: "Running the organization itself" },
    { id: "utilities", label: "Utilities", description: "Standalone tools that don't touch project data" }
  ];


  const CAPABILITIES = [
    { id: "data.import", name: "Import data", category: "data", risk: "low", implemented: true,
      description: "Add CSV, Excel, JSON and other files to a project, or connect a public source.",
      surfaces: { studio: ["data"], vanessa: ["connect_database", "cloud_sync"] } },
    { id: "data.clean", name: "Clean data", category: "data", risk: "medium", implemented: true,
      description: "Fix blanks, duplicates, whitespace and inconsistent labels, and create cleaned copies of a dataset.",
      surfaces: { tools: ["data-cleaner", "fuzzy-dupes"], studio: ["quality"], vanessa: ["clean_dataset", "audit_quality"] } },
    { id: "data.transform", name: "Transform and combine data", category: "data", risk: "medium", implemented: true,
      description: "Join, append and compare datasets, and derive new columns from existing ones.",
      surfaces: { tools: ["lookup-merge", "file-diff"], vanessa: ["join_datasets", "suggest_join", "compare_datasets", "append_datasets"] } },
    { id: "data.export", name: "Export data", category: "data", risk: "high", implemented: true,
      description: "Download datasets and converted files out of Signal Noir.",
      surfaces: { tools: ["converter"], vanessa: ["export_dataset"] } },

    { id: "analysis.basic", name: "Basic analysis", category: "analysis", risk: "low", implemented: true,
      description: "Totals, averages, breakdowns, rankings, trends and dataset profiles.",
      surfaces: { tools: ["data-analyzer", "column-stats", "pivot-explorer"], studio: ["overview"], vanessa: ["aggregate", "breakdown", "rank_columns", "trend", "inspect_dataset", "compare_periods", "explain_subject", "assess_change", "search_project", "project_status", "list_findings", "open_work"] } },
    { id: "analysis.advanced", name: "Advanced statistics and forecasting", category: "analysis", risk: "low", implemented: true,
      description: "Regression, hypothesis testing, correlation, anomaly detection and forecasting.",
      surfaces: { tools: ["stat-tests"], studio: ["intelligence"], vanessa: ["statistical_test", "forecast", "detect_anomalies"] } },
    { id: "sql.use", name: "SQL analysis", category: "analysis", risk: "medium", implemented: true,
      description: "Load files as tables and query them directly with SQL, including joins across files.",
      surfaces: { tools: ["sql-workbench"], vanessa: ["run_sql"] } },

    { id: "vanessa.use", name: "Use Vanessa", category: "vanessa", risk: "low", implemented: true,
      description: "Ask Vanessa questions and let her plan and run analysis. She can only use capabilities this profile already includes.",
      surfaces: { studio: ["vanessa"] } },
    { id: "vanessa.model", name: "Let Vanessa use a language model", category: "vanessa", risk: "medium", implemented: true,
      description: "Allow an optional on-device model to route unclear requests and write labelled interpretations. Column names and calculated results are shared with it; rows never are.",
      surfaces: {} },

    { id: "charts.create", name: "Create charts", category: "visualization", risk: "low", implemented: true,
      description: "Build charts from project data and attach them to findings.",
      surfaces: { tools: ["chart-builder"], vanessa: ["create_chart"] } },
    { id: "dashboards.view", name: "View dashboards", category: "visualization", risk: "low", implemented: true,
      description: "Open dashboards saved in projects and in the library.",
      surfaces: { studio: ["dashboard"] } },
    { id: "dashboards.create", name: "Create dashboards", category: "visualization", risk: "low", implemented: true,
      description: "Design and publish dashboards, including the instant dashboard from a dropped file.",
      surfaces: { tools: ["instant-dashboard", "dashboard-builder"], vanessa: ["create_dashboard"] } },

    { id: "reports.view", name: "View reports", category: "reporting", risk: "low", implemented: true,
      description: "Read reports and saved analyses in the library and in project outputs.",
      surfaces: { nav: ["library"], studio: ["outputs"] } },
    { id: "reports.create", name: "Create reports", category: "reporting", risk: "low", implemented: true,
      description: "Assemble findings and charts into a report that can be exported as one HTML file.",
      surfaces: { studio: ["report"], vanessa: ["create_report"] } },
    { id: "findings.save", name: "Save findings and evidence", category: "reporting", risk: "low", implemented: true,
      description: "Keep a calculated finding in the project with the evidence that produced it.",
      surfaces: { vanessa: ["save_findings"] } },

    { id: "workflows.view", name: "View workflows", category: "workflows", risk: "low", implemented: true,
      description: "See the steps a repeatable analysis takes, without changing them.",
      surfaces: { studio: ["workflow"] } },
    { id: "workflows.run", name: "Run workflows", category: "workflows", risk: "medium", implemented: true,
      description: "Run an existing workflow against current data. Does not allow editing the steps.",
      surfaces: { vanessa: ["schedule_delivery"] } },
    { id: "workflows.create", name: "Create and edit workflows", category: "workflows", risk: "medium", implemented: true,
      description: "Build new workflows and change the logic of existing ones.",
      surfaces: { studio: ["builder"], vanessa: ["create_workflow"] } },
    { id: "workflows.approve", name: "Approve workflow runs", category: "workflows", risk: "medium", implemented: true,
      description: "Approve a run that paused and asked for review. Separate from running a workflow, so the person who approves need not be the person who started it.",
      surfaces: { vanessa: ["run_workflow"] } },

    { id: "operations.view", name: "See recurring operations", category: "operations", risk: "low", implemented: true,
      description: "Open the operations area: what runs, what happened, and what needs attention.",
      surfaces: { studio: ["operations-hub"], vanessa: ["attention_summary", "run_history"] } },
    { id: "automation.create", name: "Design automations", category: "operations", risk: "medium", implemented: true,
      description: "Create and edit automations and monitors as drafts. Designing one does not make it run.",
      surfaces: { vanessa: ["propose_automation"] } },
    { id: "automation.activate", name: "Activate automations", category: "operations", risk: "high", implemented: true,
      description: "Switch an automation on so it repeats. Kept separate from designing one, so an analyst can propose a process and an operations lead decides it goes live.",
      surfaces: {} },
    { id: "monitor.create", name: "Create monitors", category: "operations", risk: "medium", implemented: true,
      description: "Watch a metric, a quality score, data freshness or an automation's health.",
      surfaces: { vanessa: ["propose_monitor", "check_monitors"] } },
    { id: "alert.manage", name: "Handle alerts", category: "operations", risk: "medium", implemented: true,
      description: "Acknowledge, resolve, ignore and assign alerts raised by monitors.",
      surfaces: {} },

    { id: "decisions.manage", name: "Record decisions", category: "collaboration", risk: "low", implemented: true,
      description: "Log a decision with the evidence behind it and track its status.",
      surfaces: { studio: ["operations"] } },
    { id: "tasks.manage", name: "Manage tasks", category: "collaboration", risk: "low", implemented: true,
      description: "Create and assign the follow-up work that comes out of an analysis.",
      surfaces: { vanessa: ["create_task"] } },

    { id: "metrics.manage", name: "Manage metric definitions", category: "governance", risk: "medium", implemented: true,
      description: "Define what a metric means for the organization so every analysis calculates it the same way.",
      surfaces: { studio: ["dictionary"], vanessa: ["define_metric", "evaluate_metric"] } },
    { id: "privacy.manage", name: "Privacy controls", category: "governance", risk: "high", implemented: true,
      description: "Scan datasets for sensitive fields and create redacted copies for sharing.",
      surfaces: { studio: ["portfolio"] } },
    { id: "governance.manage", name: "Governance and approvals", category: "governance", risk: "high", implemented: true,
      description: "Quality rules, data contracts, approval status and organizational knowledge.",
      surfaces: { org: ["governance"] } },
    { id: "audit.view", name: "View history", category: "governance", risk: "medium", implemented: true,
      description: "Read the local record of what changed, who recorded it and when.",
      surfaces: { org: ["audit", "activity"] } },

    { id: "projects.create", name: "Create projects", category: "projects", risk: "low", implemented: true,
      description: "Start a new project in this workspace.",
      surfaces: {} },
    { id: "projects.share", name: "Share and export projects", category: "projects", risk: "high", implemented: true,
      description: "Export a project bundle or publish an output for someone outside Signal Noir.",
      surfaces: { studio: ["automate"], vanessa: ["share_with_team"] } },
    { id: "projects.delete", name: "Delete projects", category: "projects", risk: "high", implemented: true,
      description: "Permanently remove a project and its data from this browser.",
      surfaces: {} },

    { id: "organization.manage", name: "Manage the organization", category: "administration", risk: "high", implemented: true,
      description: "Rename the organization, change its settings and remove it.",
      surfaces: { org: ["settings", "overview"] } },
    { id: "teams.manage", name: "Manage teams", category: "administration", risk: "high", implemented: true,
      description: "Create teams, change who belongs to them and choose the access profile each team gets.",
      surfaces: { org: ["teams"] } },
    { id: "members.manage", name: "Manage members", category: "administration", risk: "high", implemented: true,
      description: "Add people to the organization and change their team and profile.",
      surfaces: { org: ["members"] } },
    { id: "access.manage", name: "Manage access profiles", category: "administration", risk: "high", implemented: true,
      description: "Create and edit access profiles, and decide which capabilities each one includes. This capability can grant every other capability.",
      surfaces: { org: ["profiles", "projects"] } },

    { id: "tools.developer", name: "Developer utilities", category: "utilities", risk: "low", implemented: true,
      description: "JSON, regex, tokens, encoding, generated test data and code snippets.",
      surfaces: { tools: ["json-formatter", "regex-tester", "jwt-decoder", "encode-decode", "code-helper", "data-generator"] } },
    { id: "tools.utility", name: "General utilities", category: "utilities", risk: "low", implemented: true,
      description: "Text, colour, units, timestamps, Markdown and QR codes.",
      surfaces: { tools: ["text-diff", "markdown-preview", "text-analyzer", "color-tools", "qr-generator", "timestamp-converter", "unit-converter"] } }
  ];

  const byId = new Map(CAPABILITIES.map(item => [item.id, item]));
  const ALL_IDS = CAPABILITIES.map(item => item.id);
  const capability = id => byId.get(id) || null;
  const capabilitiesIn = category => CAPABILITIES.filter(item => item.category === category);


  const surfaceIndex = { tools: {}, studio: {}, nav: {}, org: {}, vanessa: {} };
  CAPABILITIES.forEach(item => {
    Object.entries(item.surfaces || {}).forEach(([kind, ids]) => {
      if (!surfaceIndex[kind]) surfaceIndex[kind] = {};
      ids.forEach(id => { if (!surfaceIndex[kind][id]) surfaceIndex[kind][id] = item.id; });
    });
  });
  function requiredFor(kind, id) { return surfaceIndex[kind]?.[id] || null; }


  const CORE = ["vanessa.use", "data.import", "analysis.basic", "charts.create", "dashboards.view", "reports.view", "reports.create", "findings.save", "projects.create", "tools.utility", "operations.view"];

  const DEFAULT_PROFILES = [
    { id: "core", name: "Core", builtin: true,
      description: "Everyday analysis. Ask Vanessa, bring in a file, get answers, make a chart or a report.",
      capabilities: CORE.slice() },
    { id: "analyst", name: "Analyst", builtin: true,
      description: "The full analytical toolkit: SQL, statistics, forecasting, transformations and workflows.",
      capabilities: [...CORE, "data.clean", "data.transform", "data.export", "sql.use", "analysis.advanced", "vanessa.model", "dashboards.create", "workflows.view", "workflows.run", "workflows.create", "metrics.manage", "projects.share", "tools.developer", "automation.create", "monitor.create"] },
    { id: "operations", name: "Operations", builtin: true,
      description: "Recurring work: run the approved workflows, report on them, and own what happens next.",
      capabilities: [...CORE, "data.clean", "workflows.view", "workflows.run", "dashboards.create", "decisions.manage", "tasks.manage", "automation.create", "automation.activate", "workflows.approve", "monitor.create", "alert.manage"] },
    { id: "leadership", name: "Leadership", builtin: true,
      description: "Read the numbers and decide. Dashboards, reports, findings and Vanessa, without the tooling.",
      capabilities: ["vanessa.use", "analysis.basic", "dashboards.view", "reports.view", "findings.save", "decisions.manage", "audit.view", "operations.view"] },
    { id: "administrator", name: "Administrator", builtin: true,
      description: "Everything, including the organization itself: teams, members, access profiles and governance.",
      capabilities: ALL_IDS.slice() },
    { id: "read-only", name: "Read only", builtin: true,
      description: "See what has already been produced. Nothing can be created or changed.",
      capabilities: ["dashboards.view", "reports.view"] }
  ];

  const PROJECT_ROLES = [
    { id: "owner", label: "Owner", description: "Full control of the project, including access to it." },
    { id: "editor", label: "Editor", description: "Can change data, analysis and outputs." },
    { id: "contributor", label: "Contributor", description: "Can add analysis and outputs, but not change the data." },
    { id: "viewer", label: "Viewer", description: "Can read the project and its outputs." }
  ];
  const ROLE_RANK = { owner: 4, editor: 3, contributor: 2, viewer: 1 };


  const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
  const arr = value => Array.isArray(value) ? value : [];
  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;

  function blankState() {
    return { version: VERSION, workspaceId: PERSONAL, memberId: null, organizations: [] };
  }


  const CAPABILITY_ALIASES = { "workflow.run": ["workflows.run", "workflows.approve"] };

  function migrateCapabilityIds(ids) {
    const out = [];
    for (const id of arr(ids)) {
      if (CAPABILITY_ALIASES[id]) { out.push(...CAPABILITY_ALIASES[id]); continue; }
      out.push(id);
    }
    return out.filter(id => byId.has(id));
  }

  function normalizeProfile(raw) {
    const known = migrateCapabilityIds(raw?.capabilities);
    return {
      id: text(raw?.id, uid("profile")),
      name: text(raw?.name, "Untitled profile"),
      description: text(raw?.description, ""),
      builtin: raw?.builtin === true,
      capabilities: [...new Set(known)],
      createdAt: Number(raw?.createdAt) || Date.now()
    };
  }

  function normalizeTeam(raw) {
    return {
      id: text(raw?.id, uid("team")),
      name: text(raw?.name, "Untitled team"),
      description: text(raw?.description, ""),
      profileId: text(raw?.profileId, "") || null,
      ownerId: text(raw?.ownerId, "") || null,
      createdAt: Number(raw?.createdAt) || Date.now()
    };
  }

  function normalizeMember(raw) {
    return {
      id: text(raw?.id, uid("member")),
      name: text(raw?.name, "Unnamed person"),
      email: text(raw?.email, ""),
      title: text(raw?.title, ""),
      profileId: text(raw?.profileId, "") || null,
      teamIds: arr(raw?.teamIds).filter(id => typeof id === "string"),


      grants: migrateCapabilityIds(raw?.grants),
      restrictions: migrateCapabilityIds(raw?.restrictions),
      status: ["active", "invited", "suspended"].includes(raw?.status) ? raw.status : "active",
      createdAt: Number(raw?.createdAt) || Date.now()
    };
  }

  function normalizeAccessRecord(raw) {
    const role = value => ROLE_RANK[value] ? value : "viewer";
    return {
      visibility: raw?.visibility === "restricted" ? "restricted" : "organization",
      defaultRole: role(raw?.defaultRole || "viewer"),
      teams: arr(raw?.teams).map(item => ({ id: text(item?.id, ""), role: role(item?.role) })).filter(item => item.id),
      members: arr(raw?.members).map(item => ({ id: text(item?.id, ""), role: role(item?.role) })).filter(item => item.id)
    };
  }

  function normalizeOrganization(raw) {
    const profiles = arr(raw?.profiles).map(normalizeProfile);
    const org = {
      id: text(raw?.id, uid("org")),
      name: text(raw?.name, "Untitled organization"),
      description: text(raw?.description, ""),
      isDemo: raw?.isDemo === true,
      createdAt: Number(raw?.createdAt) || Date.now(),
      profiles: profiles.length ? profiles : DEFAULT_PROFILES.map(normalizeProfile),
      teams: arr(raw?.teams).map(normalizeTeam),
      members: arr(raw?.members).map(normalizeMember),
      projectAccess: {},
      auditEvents: arr(raw?.auditEvents).slice(0, 500),
      settings: { defaultProfileId: text(raw?.settings?.defaultProfileId, "core") }
    };
    const access = raw?.projectAccess && typeof raw.projectAccess === "object" ? raw.projectAccess : {};
    Object.keys(access).forEach(projectId => { org.projectAccess[projectId] = normalizeAccessRecord(access[projectId]); });

    const teamIds = new Set(org.teams.map(team => team.id));
    const profileIds = new Set(org.profiles.map(profile => profile.id));
    org.teams.forEach(team => { if (team.profileId && !profileIds.has(team.profileId)) team.profileId = null; });
    org.members.forEach(member => {
      member.teamIds = member.teamIds.filter(id => teamIds.has(id));
      if (member.profileId && !profileIds.has(member.profileId)) member.profileId = null;
    });
    return org;
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object") return blankState();
    const state = {
      version: VERSION,
      workspaceId: text(raw.workspaceId, PERSONAL),
      memberId: text(raw.memberId, "") || null,
      organizations: arr(raw.organizations).map(normalizeOrganization)
    };
    if (state.workspaceId !== PERSONAL && !state.organizations.some(org => org.id === state.workspaceId)) state.workspaceId = PERSONAL;
    if (state.workspaceId === PERSONAL) state.memberId = null;
    else {
      const org = state.organizations.find(item => item.id === state.workspaceId);
      if (state.memberId && !org.members.some(member => member.id === state.memberId)) state.memberId = null;
      if (!state.memberId && org.members.length) state.memberId = org.members[0].id;
    }
    return state;
  }

  let state = null;
  const listeners = new Set();

  function load() {
    if (state) return state;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch (error) { raw = null; }
    state = normalizeState(raw);
    return state;
  }

  function save() {
    load();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) {                                                       }
    cache = null;
    listeners.forEach(fn => { try { fn(state); } catch (error) {                                        } });
    try { root?.dispatchEvent?.(new CustomEvent("sn:access-changed", { detail: summary() })); } catch (error) {                       }
    return state;
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }


  function organizations() { return load().organizations; }
  function organization(id) {
    const s = load();
    return s.organizations.find(org => org.id === (id || s.workspaceId)) || null;
  }
  function isPersonal() { return load().workspaceId === PERSONAL; }
  function member() {
    const org = organization();
    if (!org) return null;
    return org.members.find(item => item.id === load().memberId) || null;
  }

  function setWorkspace(id) {
    const s = load();
    if (id !== PERSONAL && !s.organizations.some(org => org.id === id)) return null;
    exitPreview(false);
    s.workspaceId = id;
    s.memberId = null;
    if (id !== PERSONAL) {
      const org = s.organizations.find(item => item.id === id);
      s.memberId = org.members[0]?.id || null;
    }
    save();
    return s.workspaceId;
  }

  function setMember(id) {
    const s = load();
    const org = organization();
    if (!org) return null;
    if (id && !org.members.some(item => item.id === id)) return null;
    exitPreview(false);
    s.memberId = id || null;
    save();
    return s.memberId;
  }


  function previewState() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || "null");
      if (!raw?.profileId) return null;
      const org = organization();
      const profile = org?.profiles.find(item => item.id === raw.profileId);
      return profile ? { profileId: profile.id, name: profile.name } : null;
    } catch (error) { return null; }
  }

  function preview(profileId) {
    const org = organization();
    const profile = org?.profiles.find(item => item.id === profileId);
    if (!profile) return null;
    try { sessionStorage.setItem(PREVIEW_KEY, JSON.stringify({ profileId, at: Date.now() })); } catch (error) { return null; }
    cache = null;
    listeners.forEach(fn => { try { fn(state); } catch (error) {              } });
    try { root?.dispatchEvent?.(new CustomEvent("sn:access-changed", { detail: summary() })); } catch (error) {              }
    return { profileId, name: profile.name };
  }

  function exitPreview(notify = true) {
    try { sessionStorage.removeItem(PREVIEW_KEY); } catch (error) {              }
    cache = null;
    if (notify) {
      listeners.forEach(fn => { try { fn(state); } catch (error) {              } });
      try { root?.dispatchEvent?.(new CustomEvent("sn:access-changed", { detail: summary() })); } catch (error) {              }
    }
  }


  let cache = null;

  function profilesFor(org, viewer) {
    const list = [];
    if (viewer.profileId) {
      const profile = org.profiles.find(item => item.id === viewer.profileId);
      if (profile) list.push({ source: "member", profile });
    }
    viewer.teamIds.forEach(teamId => {
      const team = org.teams.find(item => item.id === teamId);
      const profile = team?.profileId ? org.profiles.find(item => item.id === team.profileId) : null;
      if (profile) list.push({ source: "team", team, profile });
    });
    return list;
  }

  function effective() {
    if (cache) return cache;
    const s = load();
    if (s.workspaceId === PERSONAL) { cache = new Set(ALL_IDS); return cache; }
    const org = organization();
    const active = previewState();
    if (active) {
      const profile = org.profiles.find(item => item.id === active.profileId);
      cache = new Set(profile ? profile.capabilities : []);
      return cache;
    }
    const viewer = member();
    if (!viewer) { cache = new Set(); return cache; }
    const set = new Set();
    profilesFor(org, viewer).forEach(entry => entry.profile.capabilities.forEach(id => set.add(id)));
    viewer.grants.forEach(id => set.add(id));
    viewer.restrictions.forEach(id => set.delete(id));
    cache = set;
    return cache;
  }

  function can(id) { return effective().has(id); }
  function canAny(ids) { return arr(ids).some(can); }
  function canAll(ids) { return arr(ids).every(can); }

  function canUse(kind, id) { const required = requiredFor(kind, id); return !required || can(required); }

  function summary() {
    const s = load();
    const org = organization();
    const active = previewState();
    const viewer = member();
    const sources = org && viewer && !active ? profilesFor(org, viewer) : [];
    return {
      workspaceId: s.workspaceId,
      workspaceName: org ? org.name : "Personal workspace",
      personal: s.workspaceId === PERSONAL,
      organizationId: org?.id || null,
      isDemo: org?.isDemo === true,
      member: viewer ? { id: viewer.id, name: viewer.name, email: viewer.email, title: viewer.title } : null,
      preview: active,
      profileName: active ? active.name : sources.find(entry => entry.source === "member")?.profile.name || null,
      teams: viewer ? viewer.teamIds.map(id => org.teams.find(team => team.id === id)).filter(Boolean).map(team => ({ id: team.id, name: team.name })) : [],
      sources: sources.map(entry => ({ source: entry.source, teamName: entry.team?.name || null, profileName: entry.profile.name })),
      grants: viewer ? viewer.grants.slice() : [],
      restrictions: viewer ? viewer.restrictions.slice() : [],
      capabilities: [...effective()],
      capabilityCount: effective().size,
      totalCapabilities: ALL_IDS.length
    };
  }


  function explain(id) {
    const cap = capability(id);
    if (!cap) return { id, allowed: false, reason: "That capability does not exist." };
    const s = load();
    if (s.workspaceId === PERSONAL) return { id, allowed: true, reason: "The personal workspace includes every capability." };
    const org = organization();
    const active = previewState();
    if (active) return { id, allowed: can(id), reason: `Previewing as ${active.name}.`, preview: true };
    const viewer = member();
    if (!viewer) return { id, allowed: false, reason: "No member is selected for this organization." };
    if (viewer.restrictions.includes(id)) return { id, allowed: false, reason: `${cap.name} is restricted for ${viewer.name} specifically.` };
    if (viewer.grants.includes(id)) return { id, allowed: true, reason: `${cap.name} was granted to ${viewer.name} specifically.` };
    const from = profilesFor(org, viewer).filter(entry => entry.profile.capabilities.includes(id));
    if (from.length) return { id, allowed: true, reason: `Included in ${from.map(entry => entry.source === "team" ? `${entry.profile.name} (via ${entry.team.name})` : entry.profile.name).join(" and ")}.` };
    return { id, allowed: false, reason: `Not included in ${profilesFor(org, viewer).map(entry => entry.profile.name).join(" or ") || "any assigned access profile"}.` };
  }


  function record(action, detail = "", entity = "") {
    const org = organization();
    if (!org) return null;
    const viewer = member();
    const event = { id: uid("event"), action, detail, entity, actor: viewer?.name || "This browser", at: Date.now() };
    org.auditEvents.unshift(event);
    org.auditEvents = org.auditEvents.slice(0, 500);
    return event;
  }

  function auditEvents() { return organization()?.auditEvents || []; }


  function createOrganization(name, { isDemo = false, adminName = "" } = {}) {
    const s = load();
    const org = normalizeOrganization({ id: uid("org"), name: text(name, "New organization"), isDemo, profiles: DEFAULT_PROFILES });
    if (adminName) {
      const admin = normalizeMember({ name: adminName, profileId: "administrator", title: "Organization administrator" });
      org.members.push(admin);
    }
    s.organizations.push(org);
    save();
    return org;
  }

  function updateOrganization(patch) {
    const org = organization();
    if (!org) return null;
    if (patch.name != null) org.name = text(patch.name, org.name);
    if (patch.description != null) org.description = String(patch.description).trim();
    if (patch.defaultProfileId != null) org.settings.defaultProfileId = patch.defaultProfileId;
    record("Organization updated", org.name, "Organization");
    save();
    return org;
  }

  function removeOrganization(id) {
    const s = load();
    const index = s.organizations.findIndex(org => org.id === id);
    if (index === -1) return false;
    s.organizations.splice(index, 1);
    if (s.workspaceId === id) { s.workspaceId = PERSONAL; s.memberId = null; exitPreview(false); }
    save();
    return true;
  }


  function administrators(org = organization()) {
    if (!org) return [];
    return org.members.filter(candidate => {
      const set = new Set();
      profilesFor(org, candidate).forEach(entry => entry.profile.capabilities.forEach(id => set.add(id)));
      candidate.grants.forEach(id => set.add(id));
      candidate.restrictions.forEach(id => set.delete(id));
      return set.has("access.manage");
    });
  }

  const profiles = {
    list() { return organization()?.profiles || []; },
    get(id) { return organization()?.profiles.find(item => item.id === id) || null; },
    create({ name, description = "", capabilities = [], copyFrom = null } = {}) {
      const org = organization();
      if (!org) return null;
      const base = copyFrom ? org.profiles.find(item => item.id === copyFrom) : null;
      const profile = normalizeProfile({ id: uid("profile"), name, description, capabilities: base ? base.capabilities : capabilities });
      org.profiles.push(profile);
      record("Access profile created", profile.name, "Access profile");
      save();
      return profile;
    },
    update(id, patch = {}) {
      const org = organization();
      const profile = org?.profiles.find(item => item.id === id);
      if (!profile) return null;
      if (patch.name != null) profile.name = text(patch.name, profile.name);
      if (patch.description != null) profile.description = String(patch.description).trim();
      if (patch.capabilities) {
        const next = [...new Set(arr(patch.capabilities).filter(cap => byId.has(cap)))];
        const added = next.filter(cap => !profile.capabilities.includes(cap));
        const removed = profile.capabilities.filter(cap => !next.includes(cap));
        profile.capabilities = next;
        if (added.length) record("Capability granted", `${profile.name}: ${added.map(cap => capability(cap).name).join(", ")}`, "Access profile");
        if (removed.length) record("Capability removed", `${profile.name}: ${removed.map(cap => capability(cap).name).join(", ")}`, "Access profile");
      } else record("Access profile modified", profile.name, "Access profile");
      save();
      return profile;
    },


    remove(id, { reassignTo = null } = {}) {
      const org = organization();
      const profile = org?.profiles.find(item => item.id === id);
      if (!profile) return { ok: false, reason: "That access profile no longer exists." };
      const teams = org.teams.filter(team => team.profileId === id);
      const members = org.members.filter(item => item.profileId === id);
      if ((teams.length || members.length) && !reassignTo) {
        return { ok: false, reason: "in-use", teams: teams.map(team => team.name), members: members.map(item => item.name) };
      }
      if (reassignTo && !org.profiles.some(item => item.id === reassignTo && item.id !== id)) {
        return { ok: false, reason: "The replacement access profile no longer exists." };
      }
      teams.forEach(team => { team.profileId = reassignTo; });
      members.forEach(item => { item.profileId = reassignTo; });
      org.profiles = org.profiles.filter(item => item.id !== id);
      if (org.settings.defaultProfileId === id) org.settings.defaultProfileId = reassignTo || org.profiles[0]?.id || null;
      if (!administrators(org).length) {

        state = null; cache = null; load();
        return { ok: false, reason: "last-admin" };
      }
      record("Access profile deleted", profile.name, "Access profile");
      save();
      return { ok: true };
    }
  };

  const teams = {
    list() { return organization()?.teams || []; },
    get(id) { return organization()?.teams.find(item => item.id === id) || null; },
    members(id) { return (organization()?.members || []).filter(item => item.teamIds.includes(id)); },
    create({ name, description = "", profileId = null, ownerId = null } = {}) {
      const org = organization();
      if (!org) return null;
      const team = normalizeTeam({ id: uid("team"), name, description, profileId, ownerId });
      org.teams.push(team);
      record("Team created", team.name, "Team");
      save();
      return team;
    },
    update(id, patch = {}) {
      const org = organization();
      const team = org?.teams.find(item => item.id === id);
      if (!team) return null;
      if (patch.name != null) team.name = text(patch.name, team.name);
      if (patch.description != null) team.description = String(patch.description).trim();
      if (patch.ownerId !== undefined) team.ownerId = patch.ownerId || null;
      if (patch.profileId !== undefined) {
        const next = patch.profileId || null;
        if (next !== team.profileId) {
          team.profileId = next;
          const profile = next ? org.profiles.find(item => item.id === next) : null;
          record("Team access profile changed", `${team.name} → ${profile ? profile.name : "no profile"}`, "Team");
        }
      } else record("Team updated", team.name, "Team");
      save();
      return team;
    },
    remove(id) {
      const org = organization();
      if (!org) return false;
      const team = org.teams.find(item => item.id === id);
      if (!team) return false;
      org.teams = org.teams.filter(item => item.id !== id);
      org.members.forEach(item => { item.teamIds = item.teamIds.filter(teamId => teamId !== id); });
      Object.values(org.projectAccess).forEach(access => { access.teams = access.teams.filter(entry => entry.id !== id); });
      record("Team deleted", team.name, "Team");
      save();
      return true;
    },
    setMembers(id, memberIds) {
      const org = organization();
      if (!org?.teams.some(item => item.id === id)) return false;
      const wanted = new Set(arr(memberIds));
      org.members.forEach(item => {
        const has = item.teamIds.includes(id);
        if (wanted.has(item.id) && !has) { item.teamIds.push(id); record("Member added to team", `${item.name} → ${teams.get(id).name}`, "Team"); }
        if (!wanted.has(item.id) && has) { item.teamIds = item.teamIds.filter(teamId => teamId !== id); record("Member removed from team", `${item.name} → ${teams.get(id).name}`, "Team"); }
      });
      save();
      return true;
    }
  };

  const members = {
    list() { return organization()?.members || []; },
    get(id) { return organization()?.members.find(item => item.id === id) || null; },
    create({ name, email = "", title = "", profileId = null, teamIds = [] } = {}) {
      const org = organization();
      if (!org) return null;
      const person = normalizeMember({ id: uid("member"), name, email, title, profileId: profileId || org.settings.defaultProfileId, teamIds });
      org.members.push(person);
      record("Member added", person.name, "Member");
      save();
      return person;
    },
    update(id, patch = {}) {
      const org = organization();
      const person = org?.members.find(item => item.id === id);
      if (!person) return null;
      const wasAdmin = administrators(org).some(item => item.id === id);
      if (patch.name != null) person.name = text(patch.name, person.name);
      if (patch.email != null) person.email = String(patch.email).trim();
      if (patch.title != null) person.title = String(patch.title).trim();
      if (patch.status != null && ["active", "invited", "suspended"].includes(patch.status)) person.status = patch.status;
      if (patch.profileId !== undefined) person.profileId = patch.profileId || null;
      if (patch.teamIds) person.teamIds = arr(patch.teamIds).filter(teamId => org.teams.some(team => team.id === teamId));
      if (patch.grants) person.grants = [...new Set(arr(patch.grants).filter(cap => byId.has(cap)))];
      if (patch.restrictions) person.restrictions = [...new Set(arr(patch.restrictions).filter(cap => byId.has(cap)))];
      if (wasAdmin && !administrators(org).length) { state = null; cache = null; load(); return { error: "last-admin" }; }
      record("Member updated", person.name, "Member");
      save();
      return person;
    },
    remove(id) {
      const org = organization();
      if (!org) return { ok: false };
      const person = org.members.find(item => item.id === id);
      if (!person) return { ok: false };
      const remaining = administrators(org).filter(item => item.id !== id);
      if (administrators(org).some(item => item.id === id) && !remaining.length) return { ok: false, reason: "last-admin" };
      org.members = org.members.filter(item => item.id !== id);
      Object.values(org.projectAccess).forEach(access => { access.members = access.members.filter(entry => entry.id !== id); });
      if (load().memberId === id) load().memberId = org.members[0]?.id || null;
      record("Member removed", person.name, "Member");
      save();
      return { ok: true };
    }
  };


  const projectAccess = {
    get(projectId) {
      const org = organization();
      if (!org) return null;
      return org.projectAccess[projectId] || null;
    },
    set(projectId, patch = {}) {
      const org = organization();
      if (!org) return null;
      const current = org.projectAccess[projectId] || normalizeAccessRecord({});
      const next = normalizeAccessRecord({ ...current, ...patch });
      org.projectAccess[projectId] = next;
      record("Project access changed", `${projectId}: ${next.visibility === "restricted" ? `restricted to ${next.teams.length} team(s) and ${next.members.length} person(s)` : "everyone in the organization"}`, "Project");
      save();
      return next;
    },
    clear(projectId) {
      const org = organization();
      if (!org) return false;
      delete org.projectAccess[projectId];
      save();
      return true;
    },

    roleOn(projectId, viewer = member()) {
      if (isPersonal()) return "owner";
      const org = organization();
      if (!org || !viewer) return null;
      const access = org.projectAccess[projectId];
      if (!access) return "editor";
      let best = null;
      const consider = role => { if (!best || ROLE_RANK[role] > ROLE_RANK[best]) best = role; };
      access.members.filter(entry => entry.id === viewer.id).forEach(entry => consider(entry.role));
      access.teams.filter(entry => viewer.teamIds.includes(entry.id)).forEach(entry => consider(entry.role));
      if (!best && access.visibility === "organization") consider(access.defaultRole);
      return best;
    },
    canSee(projectId, viewer = member()) { return Boolean(projectAccess.roleOn(projectId, viewer)); },

    allows(capabilityId, projectId) {
      if (!can(capabilityId)) return false;
      const role = projectAccess.roleOn(projectId);
      if (!role) return false;
      if (role === "viewer") return /\.(view)$/.test(capabilityId) || capabilityId === "vanessa.use" || capabilityId === "analysis.basic";
      if (role === "contributor") return !/^data\.(clean|transform|export)$/.test(capabilityId) && capabilityId !== "projects.delete";
      return true;
    },
    visible(projects) {
      if (isPersonal()) return arr(projects);
      return arr(projects).filter(project => projectAccess.canSee(project.id));
    }
  };


  function createDemoOrganization() {
    const s = load();
    const existing = s.organizations.find(org => org.isDemo);
    if (existing) return existing;
    const org = normalizeOrganization({ id: uid("org"), name: "Signal Noir Demo Organization", isDemo: true, profiles: DEFAULT_PROFILES,
      description: "Sample teams, people and access profiles for seeing how the interface adapts. Nothing here is real and it can be removed at any time." });
    const tourGuide = normalizeProfile({ id: uid("profile"), name: "Tour Guide", description: "Front-line staff who read the daily numbers and record what they saw. No data tooling.", capabilities: ["vanessa.use", "dashboards.view", "reports.view", "tasks.manage"] });
    org.profiles.push(tourGuide);
    const team = (name, description, profileId) => { const item = normalizeTeam({ id: uid("team"), name, description, profileId }); org.teams.push(item); return item; };
    const leadership = team("Admissions Leadership", "Reads the numbers and decides what changes.", "leadership");
    const analytics = team("Data Analytics", "Builds the analysis everyone else reads.", "analyst");
    const operations = team("Operations", "Runs the recurring reporting and owns the follow-up.", "operations");
    const guides = team("Admissions Tour Guides", "Campus tour staff who log daily visit numbers.", tourGuide.id);
    const admins = team("Administrators", "Runs the organization itself.", "administrator");
    const person = (name, title, profileId, teamIds) => org.members.push(normalizeMember({ id: uid("member"), name, title, profileId, teamIds, email: "" }));
    person("Avery Lin", "Director of Admissions", "leadership", [leadership.id]);
    person("Jordan Reyes", "Senior Data Analyst", "analyst", [analytics.id]);
    person("Sam Okafor", "Operations Coordinator", "operations", [operations.id]);
    person("Riley Chen", "Tour Programme Lead", tourGuide.id, [guides.id]);
    person("Morgan Diaz", "Systems Administrator", "administrator", [admins.id]);
    org.auditEvents.unshift({ id: uid("event"), action: "Demo organization created", detail: "Sample teams, people and access profiles", entity: "Organization", actor: "Signal Noir", at: Date.now() });
    s.organizations.push(org);
    save();
    return org;
  }

  function demoOrganization() { return load().organizations.find(org => org.isDemo) || null; }

  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {              }
    try { sessionStorage.removeItem(PREVIEW_KEY); } catch (error) {              }
    state = null;
    cache = null;
    load();
    listeners.forEach(fn => { try { fn(state); } catch (error) {              } });
    return state;
  }

  const api = {
    PERSONAL, VERSION, STORAGE_KEY, CATEGORIES, CAPABILITIES, DEFAULT_PROFILES, PROJECT_ROLES, ROLE_RANK,
    capability, capabilitiesIn, allCapabilityIds: () => ALL_IDS.slice(), requiredFor,
    load, save, reset, onChange, summary, explain,
    organizations, organization, createOrganization, updateOrganization, removeOrganization, administrators,
    isPersonal, member, setWorkspace, setMember,
    preview, exitPreview, previewState,
    can, canAny, canAll, canUse, effective: () => new Set(effective()),
    profiles, teams, members, projectAccess,
    record, auditEvents,
    createDemoOrganization, demoOrganization,

    _replace(next) { state = normalizeState(next); cache = null; return state; }
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.SignalNoir = root.SignalNoir || {};
    root.SignalNoir.access = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
