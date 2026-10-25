


(function (root) {
  "use strict";

  const SN = root.SignalNoir = root.SignalNoir || {};
  const artifacts = () => SN.artifacts;
  const access = () => SN.access || null;
  const arr = value => Array.isArray(value) ? value : [];
  const str = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;


  const TEMPLATES = [
    { id: "blank", name: "Blank project", sample: false,
      description: "Start from nothing. Add data or ask a question.",
      summary: "", prompts: [], expects: [], definitions: [], tags: [] },

    { id: "weekly-operations", name: "Weekly operations review", sample: false,
      description: "A recurring review: what changed this week, what needs attention, who owns the follow-up.",
      summary: "Weekly review of operational performance and the actions that come out of it.",
      expects: ["A weekly export with a date column and at least one measure"],
      prompts: ["Compare this week to last week and show what drove the change", "Build me a dashboard of the key numbers"],
      definitions: [{ term: "Week", definition: "Weeks start on Monday unless the data says otherwise." }],
      tags: ["recurring", "operations"] },

    { id: "survey-analysis", name: "Survey analysis", sample: false,
      description: "Summarize responses, break them down by group, and find which groups differ.",
      summary: "Analysis of survey responses, by segment.",
      expects: ["A survey export with a score column and a group column"],
      prompts: ["Analyze these survey responses and break the scores down by group", "Which groups differ most?"],
      definitions: [], tags: ["research"] },

    { id: "enrollment-analysis", name: "Enrollment analysis", sample: false,
      description: "Track enrollment against target, find where the gap is opening, and forecast the rest of the cycle.",
      summary: "Enrollment performance against plan.",
      expects: ["A dated enrollment export", "A target or plan file, if you have one"],
      prompts: ["How are we tracking against target?", "Forecast the rest of the cycle"],
      definitions: [{ term: "Yield", definition: "Enrolled ÷ admitted, for the same cohort." }],
      tags: ["enrollment"] },

    { id: "campaign-review", name: "Marketing campaign review", sample: false,
      description: "What the campaign produced, which channels carried it, and what to do next time.",
      summary: "Campaign performance by channel.",
      expects: ["A campaign export with channel and spend or response columns"],
      prompts: ["Which channel performed best?", "Create a report for my manager"],
      definitions: [], tags: ["marketing"] },

    { id: "financial-review", name: "Financial review", sample: false,
      description: "Period-over-period movement with the drivers behind it, and the decisions that follow.",
      summary: "Financial performance review.",
      expects: ["A dated financial export"],
      prompts: ["Why did the total change this quarter?", "Break it down by category"],
      definitions: [{ term: "Fiscal year", definition: "Set the fiscal year start under project definitions so periods line up." }],
      tags: ["finance"] },

    { id: "tour-operations", name: "Admissions tour operations", sample: true,
      description: "Sample template showing how a recurring operational process fits in a project. Attendance, cancellations, staffing.",
      summary: "Campus tour attendance and staffing review.",
      expects: ["A tour booking export with a date and an attendance status column"],
      prompts: ["How many tours were completed this month?", "Why did cancellations change?"],
      definitions: [{ term: "Completed tour", definition: "A scheduled tour where attendance_status = completed." }],
      tags: ["sample", "operations"] }
  ];

  const template = id => TEMPLATES.find(item => item.id === id) || null;


  function initialize(project, { description = "", templateId = null, teamId = null, tags = [] } = {}) {
    const A = artifacts();
    const p = A.shape(project);
    const a = access();
    const info = a?.summary();
    p.description = str(description, p.description);
    p.tags = arr(tags).filter(tag => typeof tag === "string");
    p.status = "active";
    p.ownerId = info && !info.personal ? info.member?.id || null : null;
    p.teamId = teamId || null;
    p.organizationId = info && !info.personal ? info.organizationId : null;
    const seed = templateId ? template(templateId) : null;
    if (seed && seed.id !== "blank") {
      p.templateId = seed.id;
      if (!p.description) p.description = seed.summary || seed.description;
      p.tags = [...new Set([...p.tags, ...seed.tags])];
      seed.definitions.forEach(item => { if (!p.glossary.some(entry => entry.term === item.term)) p.glossary.push({ term: item.term, definition: item.definition }); });
      A.recordActivity(p, { type: "project-created", text: `Project started from the ${seed.name} template` });
    }
    p.updatedAt = Date.now();
    return p;
  }

  function setStatus(project, status) {
    const A = artifacts();
    const p = A.shape(project);
    if (!A.PROJECT_STATUSES.some(item => item.id === status) || p.status === status) return p;
    p.status = status;
    A.recordActivity(p, { type: "project-status", text: `Project marked ${status}` });
    p.updatedAt = Date.now();
    return p;
  }

  function setOwnership(project, { ownerId, teamId } = {}) {
    const A = artifacts();
    const p = A.shape(project);
    const a = access();
    if (ownerId !== undefined) p.ownerId = ownerId || null;
    if (teamId !== undefined) p.teamId = teamId || null;
    const owner = p.ownerId ? a?.members.get(p.ownerId)?.name : null;
    const team = p.teamId ? a?.teams.get(p.teamId)?.name : null;
    A.recordActivity(p, { type: "ownership", text: `Ownership set to ${[team, owner].filter(Boolean).join(" · ") || "nobody"}` });
    p.updatedAt = Date.now();
    return p;
  }


  function visible(projects, { includeArchived = true } = {}) {
    const A = artifacts();
    const a = access();
    let list = arr(projects).map(A.shape);
    if (a) list = a.projectAccess.visible(list);
    if (!includeArchived) list = list.filter(project => project.status !== "archived");
    return list.sort((a2, b) => (a2.status === "archived") - (b.status === "archived") || (b.updatedAt || 0) - (a2.updatedAt || 0));
  }


  function duplicate(project, { name = null, includeData = false, includeArtifacts = false } = {}) {
    const A = artifacts();
    const source = A.shape(project);
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = A.uid("project");
    copy.name = str(name, `${source.name} (copy)`);
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.status = "active";
    copy.isDemo = false;
    copy.duplicatedFrom = source.id;

    if (!includeData) copy.datasets = [];
    if (!includeArtifacts) {
      copy.findings = []; copy.outputs = []; copy.decisions = []; copy.tasks = [];
      copy.links = []; copy.comments = []; copy.artifactHistory = [];
      copy.vanessaRuns = []; copy.vanessaConversations = [];
    }
    copy.activities = [];
    A.recordActivity(copy, { type: "project-created", text: `Duplicated from ${source.name}${includeData ? " with its data" : ""}` });
    return copy;
  }


  const BUNDLE_FORMAT = "signal-noir-project";
  const BUNDLE_VERSION = 3;


  const SENSITIVE = ["collaborationConfig", "connections", "installedConnectors", "chatMessages"];

  function exportProject(project, { includeData = true } = {}) {
    const A = artifacts();
    const p = A.shape(project);
    const copy = JSON.parse(JSON.stringify(p));
    SENSITIVE.forEach(key => { delete copy[key]; });
    if (!includeData) copy.datasets = copy.datasets.map(dataset => ({ ...dataset, rows: [], rowsOmitted: arr(dataset.rows).length }));
    return {
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      includesData: includeData,
      counts: A.counts(p),
      project: copy
    };
  }


  function validateBundle(bundle) {
    if (!bundle || typeof bundle !== "object") return { ok: false, error: "That file isn’t a Signal Noir project bundle." };
    if (bundle.format !== BUNDLE_FORMAT) return { ok: false, error: `That bundle says it is “${str(bundle.format, "unknown")}”, not a Signal Noir project.` };
    const version = Number(bundle.version);
    if (!Number.isFinite(version) || version < 1) return { ok: false, error: "That bundle has no readable version." };
    if (version > BUNDLE_VERSION) return { ok: false, error: `That bundle was exported by a newer version of Signal Noir (schema ${version}). Update before importing it.` };
    if (!bundle.project || typeof bundle.project !== "object") return { ok: false, error: "That bundle has no project in it." };
    if (!str(bundle.project.name)) return { ok: false, error: "That bundle’s project has no name." };
    return { ok: true, version };
  }

  function importProject(bundle, { name = null } = {}) {
    const check = validateBundle(bundle);
    if (!check.ok) return check;
    const A = artifacts();
    const incoming = JSON.parse(JSON.stringify(bundle.project));
    SENSITIVE.forEach(key => { delete incoming[key]; });

    incoming.id = A.uid("project");
    incoming.name = str(name, incoming.name);
    incoming.isDemo = false;
    incoming.importedAt = Date.now();
    incoming.updatedAt = Date.now();
    const project = A.shape(incoming);

    const info = access()?.summary();
    project.ownerId = info && !info.personal ? info.member?.id || null : null;
    project.organizationId = info && !info.personal ? info.organizationId : null;
    project.teamId = null;
    A.recordActivity(project, { type: "project-imported", text: `Imported from a project bundle exported ${str(bundle.exportedAt, "at an unknown time")}` });
    const omitted = project.datasets.filter(dataset => dataset.rowsOmitted > 0);
    return { ok: true, project, warnings: omitted.length ? [`${omitted.length} dataset${omitted.length === 1 ? " was" : "s were"} exported without their rows, so ${omitted.length === 1 ? "it is" : "they are"} empty. Add the file again to restore the data.`] : [] };
  }


  function summarize(project) {
    const A = artifacts();
    const p = A.shape(project);
    const a = access();
    const counts = A.counts(p);
    const items = A.list(p);
    const tasks = items.filter(item => item.type === "task");
    const rows = p.datasets.reduce((sum, dataset) => sum + arr(dataset.rows).length, 0);
    return {
      id: p.id, name: p.name, description: p.description, status: p.status, isDemo: Boolean(p.isDemo),
      updatedAt: p.updatedAt, createdAt: p.createdAt, tags: p.tags.slice(),
      counts, rows,
      openTasks: tasks.filter(item => item.status !== "done").length,
      ownerName: p.ownerId ? a?.members.get(p.ownerId)?.name || null : null,
      teamName: p.teamId ? a?.teams.get(p.teamId)?.name || null : null,
      role: a ? a.projectAccess.roleOn(p.id) : "owner",
      template: p.templateId ? template(p.templateId)?.name || null : null
    };
  }

  const api = { TEMPLATES, template, BUNDLE_FORMAT, BUNDLE_VERSION, initialize, setStatus, setOwnership, visible, duplicate, exportProject, validateBundle, importProject, summarize };
  if (typeof module === "object" && module.exports) module.exports = api;
  SN.projectService = api;
})(typeof window !== "undefined" ? window : globalThis);
