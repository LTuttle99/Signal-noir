


(function (root) {
  "use strict";

  const SN = root.SignalNoir = root.SignalNoir || {};
  const access = () => SN.access || null;

  const arr = value => Array.isArray(value) ? value : [];
  const str = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;


  const TYPES = {
    dataset: { label: "Dataset", plural: "Datasets", icon: "▦", collection: "datasets", capability: "data.import", archivable: false,
      empty: "Add a CSV, Excel or JSON file and it becomes the data this project works from." },
    finding: { label: "Finding", plural: "Findings", icon: "✦", collection: "findings", capability: "findings.save", archivable: true,
      empty: "Important analytical findings you save will appear here, each with the evidence behind it." },
    chart: { label: "Chart", plural: "Charts", icon: "◔", collection: "outputs", capability: "charts.create", archivable: true,
      empty: "Charts you save from an analysis appear here." },
    dashboard: { label: "Dashboard", plural: "Dashboards", icon: "▥", collection: "outputs", capability: "dashboards.view", archivable: true,
      empty: "Ask Vanessa to build a dashboard, or design one in Dashboard Builder." },
    report: { label: "Report", plural: "Reports", icon: "▤", collection: "outputs", capability: "reports.view", archivable: true,
      empty: "Create a report from your project findings and charts." },
    workflow: { label: "Workflow", plural: "Workflows", icon: "↻", collection: "outputs", capability: "workflows.view", archivable: true,
      empty: "Repeatable analysis you save becomes a workflow you can run again." },
    decision: { label: "Decision", plural: "Decisions", icon: "◇", collection: "decisions", capability: "decisions.manage", archivable: true,
      empty: "Record important decisions and the evidence behind them." },
    task: { label: "Task", plural: "Tasks", icon: "☐", collection: "tasks", capability: "tasks.manage", archivable: true,
      empty: "Turn findings into follow-up work." }
  };

  const TYPE_IDS = Object.keys(TYPES);


  const STATUS = {
    finding: ["draft", "validated", "published", "archived"],
    report: ["draft", "review", "published", "archived"],
    dashboard: ["draft", "published", "archived"],
    chart: ["draft", "published", "archived"],
    workflow: ["draft", "active", "archived"],
    decision: ["proposed", "approved", "rejected", "archived"],
    task: ["todo", "in-progress", "blocked", "done"],
    dataset: ["active", "archived"]
  };
  const STATUS_LABEL = { todo: "To do", "in-progress": "In progress", blocked: "Blocked", done: "Done", draft: "Draft", review: "In review", validated: "Validated", published: "Published", approved: "Approved", proposed: "Proposed", rejected: "Rejected", active: "Active", archived: "Archived" };
  const DEFAULT_STATUS = { finding: "draft", report: "draft", dashboard: "draft", chart: "draft", workflow: "draft", decision: "proposed", task: "todo", dataset: "active" };

  const PROJECT_STATUSES = [
    { id: "active", label: "Active", description: "Work is happening here now." },
    { id: "paused", label: "Paused", description: "On hold, but expected to resume." },
    { id: "completed", label: "Completed", description: "The question was answered." },
    { id: "archived", label: "Archived", description: "Kept for the record. Hidden from the active list." }
  ];

  const typeOf = id => TYPES[id] || null;
  const statusLabel = value => STATUS_LABEL[value] || (value ? String(value) : "");
  const statusesFor = type => STATUS[type] || [];


  function base(project, type, raw, extra = {}) {
    return {
      id: str(raw?.id, uid(type)),
      type,
      title: str(extra.title ?? raw?.title ?? raw?.name, `Untitled ${TYPES[type].label.toLowerCase()}`),
      description: str(extra.description ?? raw?.description ?? raw?.summary, ""),
      projectId: project.id,
      createdBy: str(raw?.createdBy ?? raw?.owner ?? raw?.author, ""),
      createdAt: Number(raw?.createdAt ?? raw?.savedAt ?? raw?.at ?? extra.createdAt) || null,
      updatedAt: Number(raw?.updatedAt ?? raw?.savedAt ?? raw?.createdAt ?? extra.createdAt) || null,
      status: str(raw?.status, DEFAULT_STATUS[type]),
      tags: arr(raw?.tags).filter(tag => typeof tag === "string"),
      sources: arr(raw?.sources),


      evidence: (raw?.evidence && typeof raw.evidence === "object" ? raw.evidence : null) || extra.evidence || null,
      meta: extra.meta || {},
      raw
    };
  }


  function recoveredSources(project, type, raw) {
    const out = [];
    const byName = name => project.datasets.find(item => item.name === name);
    if (raw?.evidence?.dataset) { const ds = byName(raw.evidence.dataset); if (ds) out.push({ type: "dataset", id: ds.id, recovered: true }); }
    arr(raw?.findings).forEach(item => { if (item?.id) out.push({ type: "finding", id: item.id, recovered: true }); });
    arr(raw?.findingIds).forEach(id => out.push({ type: "finding", id }));
    arr(raw?.datasetIds).forEach(id => out.push({ type: "dataset", id }));
    if (raw?.datasetId) out.push({ type: "dataset", id: raw.datasetId });
    const seen = new Set();
    return out.filter(edge => { const key = `${edge.type}:${edge.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }

  function project_artifacts(project) {
    const p = shape(project);
    const list = [];

    p.datasets.forEach(raw => list.push(base(p, "dataset", raw, {
      title: raw.name,
      createdAt: raw.addedAt || p.createdAt,
      description: `${arr(raw.rows).length.toLocaleString()} rows · ${arr(raw.columns).length} columns`,
      meta: { rows: arr(raw.rows).length, columns: arr(raw.columns).length, version: Number(raw.version) || 1, originalRowCount: raw.originalRowCount ?? null, derivedFrom: raw.derivedFrom || null, source: raw.source || "Uploaded file" }
    })));

    p.findings.forEach(raw => {
      const artifact = base(p, "finding", raw, { title: raw.title, createdAt: raw.savedAt || raw.createdAt, meta: { statement: raw.statement || raw.title, metric: raw.metric || null, tone: raw.tone || "neutral", chart: raw.chart || null, runId: raw.runId || null } });
      if (!artifact.sources.length) artifact.sources = recoveredSources(p, "finding", raw);
      list.push(artifact);
    });

    p.outputs.forEach(raw => {
      const type = TYPE_IDS.includes(raw.kind) ? raw.kind : "report";
      const artifact = base(p, type, raw, { title: raw.title, description: raw.summary, meta: { kind: raw.kind, spec: raw.spec || null, visual: raw.visual || null, audience: raw.audience || null, runId: raw.runId || null, prompt: raw.prompt || null, lastRunAt: raw.lastRunAt || null, steps: raw.steps || null } });
      if (!artifact.sources.length) artifact.sources = recoveredSources(p, type, raw);
      list.push(artifact);
    });

    p.decisions.forEach(raw => list.push(base(p, "decision", raw, {
      description: raw.rationale || raw.summary || "",
      meta: { owner: raw.owner || "", rationale: raw.rationale || "", evidenceNote: raw.evidence || "" }
    })));
    p.tasks.forEach(raw => list.push(base(p, "task", raw, {
      description: raw.description || "",
      meta: { assignee: raw.assignee || raw.owner || "", due: raw.due || "", priority: raw.priority || "Medium" }
    })));


    list.forEach(item => {
      if (item.type === "task") item.status = normalizeTaskStatus(item.raw?.status);
      if (item.type === "decision") item.status = normalizeDecisionStatus(item.raw?.status);
      if (!item.sources.length) item.sources = recoveredSources(p, item.type, item.raw);
      const extra = arr(p.links).filter(link => link.from === item.id).map(link => ({ type: link.toType, id: link.to, rel: link.rel }));
      extra.forEach(edge => { if (!item.sources.some(existing => existing.id === edge.id)) item.sources.push(edge); });
    });
    return list;
  }

  function normalizeTaskStatus(value) {
    const text = String(value || "").toLowerCase();
    if (/done|complete|closed/.test(text)) return "done";
    if (/progress|doing|active/.test(text)) return "in-progress";
    if (/block|stuck|wait/.test(text)) return "blocked";
    return "todo";
  }
  function normalizeDecisionStatus(value) {
    const text = String(value || "").toLowerCase();
    if (/approv|accept|done|agreed/.test(text)) return "approved";
    if (/reject|declin|no\b/.test(text)) return "rejected";
    if (/archiv/.test(text)) return "archived";
    return "proposed";
  }


  const SCHEMA_VERSION = 3;

  function shape(project) {
    if (!project || typeof project !== "object") return project;
    for (const key of ["datasets", "findings", "outputs", "decisions", "tasks", "activities", "links", "comments", "artifactHistory", "glossary", "metrics"]) {
      if (!Array.isArray(project[key])) project[key] = [];
    }
    if (typeof project.description !== "string") project.description = project.goal || "";
    if (!PROJECT_STATUSES.some(item => item.id === project.status)) project.status = "active";
    if (!Array.isArray(project.tags)) project.tags = [];
    if (project.ownerId === undefined) project.ownerId = null;
    if (project.teamId === undefined) project.teamId = null;
    if (project.organizationId === undefined) project.organizationId = null;
    if (project.templateId === undefined) project.templateId = null;
    if (!project.createdAt) project.createdAt = Date.now();
    if (!project.updatedAt) project.updatedAt = project.createdAt;


    project.datasets.forEach(dataset => {
      if (!dataset.id) dataset.id = uid("dataset");
      if (!Number.isFinite(Number(dataset.version))) dataset.version = 1;
      if (!dataset.addedAt) dataset.addedAt = project.createdAt;
    });
    return project;
  }


  const ACTIVITY_LIMIT = 120;

  function actorName() {
    const info = access()?.summary();
    if (info && !info.personal && info.member) return info.member.name;
    try { return localStorage.getItem("datahub_chat_name") || "You"; } catch (error) { return "You"; }
  }

  function recordActivity(project, { type = "note", text, artifactId = null, artifactType = null, actor = null }) {
    const p = shape(project);
    const entry = { id: uid("activity"), type, text: str(text, "Something happened"), artifactId, artifactType, actor: actor || actorName(), at: Date.now() };
    p.activities.unshift(entry);
    p.activities = p.activities.slice(0, ACTIVITY_LIMIT);
    return entry;
  }


  function activity(project, { limit = 30, type = null } = {}) {
    return shape(project).activities
      .map(item => ({ id: item.id || uid("activity"), type: item.type || "note", text: item.text || "", actor: item.actor || "Project", artifactId: item.artifactId || null, artifactType: item.artifactType || null, at: typeof item.at === "number" ? item.at : Date.parse(item.at) || null, label: typeof item.at === "string" ? item.at : null }))
      .filter(item => !type || item.type === type)
      .slice(0, limit);
  }


  function canReach(project) {
    const a = access();
    if (!a) return true;
    return a.projectAccess.canSee(project.id);
  }

  function list(project, { type = null, types = null, status = null, includeArchived = false, limit = null, sort = "recent" } = {}) {
    if (!project || !canReach(project)) return [];
    let items = project_artifacts(project);
    if (type) items = items.filter(item => item.type === type);
    if (types) items = items.filter(item => types.includes(item.type));
    if (status) items = items.filter(item => item.status === status);
    if (!includeArchived) items = items.filter(item => item.status !== "archived");
    if (sort === "recent") items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return limit ? items.slice(0, limit) : items;
  }

  function get(project, id) {
    if (!project || !canReach(project)) return null;
    return project_artifacts(project).find(item => item.id === id) || null;
  }

  function counts(project) {
    const out = {};
    TYPE_IDS.forEach(id => { out[id] = 0; });
    list(project, { includeArchived: false }).forEach(item => { out[item.type] = (out[item.type] || 0) + 1; });
    return out;
  }


  function upstream(project, id, { depth = 3, seen = new Set() } = {}) {
    const artifact = get(project, id);
    if (!artifact || depth <= 0 || seen.has(id)) return [];
    seen.add(id);
    const all = project_artifacts(project);
    const out = [];
    artifact.sources.forEach(edge => {
      const source = all.find(item => item.id === edge.id);
      if (!source || seen.has(source.id)) return;
      out.push({ ...source, rel: edge.rel || "derived-from", recovered: Boolean(edge.recovered) });
      out.push(...upstream(project, source.id, { depth: depth - 1, seen }));
    });
    return out;
  }

  function downstream(project, id) {
    return project_artifacts(project).filter(item => item.sources.some(edge => edge.id === id));
  }


  function lineage(project, id) {
    const artifact = get(project, id);
    if (!artifact) return null;
    return { artifact, upstream: upstream(project, id), downstream: downstream(project, id) };
  }

  function link(project, fromId, toId, rel = "derived-from") {
    const p = shape(project);
    const target = get(p, toId);
    if (!target || p.links.some(item => item.from === fromId && item.to === toId)) return null;
    const edge = { id: uid("link"), from: fromId, to: toId, toType: target.type, rel, at: Date.now() };
    p.links.push(edge);
    return edge;
  }


  function create(project, type, data = {}) {
    const p = shape(project);
    const def = TYPES[type];
    if (!def) throw new Error(`Unknown artifact type "${type}"`);
    const now = Date.now();
    const common = {
      id: data.id || uid(type),
      title: str(data.title, `Untitled ${def.label.toLowerCase()}`),
      createdAt: now, updatedAt: now,
      createdBy: data.createdBy || actorName(),
      status: data.status || DEFAULT_STATUS[type],
      tags: arr(data.tags),
      sources: arr(data.sources)
    };
    let record;
    if (type === "finding") {
      record = { ...common, statement: str(data.statement, common.title), tone: data.tone || "neutral", metric: data.metric || null, evidence: data.evidence || null, chart: data.chart || null, savedAt: now, runId: data.runId || null };
      p.findings.unshift(record);
    } else if (type === "decision") {
      record = { ...common, owner: data.owner || common.createdBy, rationale: str(data.rationale, ""), summary: str(data.description, "") };
      p.decisions.unshift(record);
    } else if (type === "task") {
      record = { ...common, description: str(data.description, ""), assignee: data.assignee || "", owner: data.assignee || "", due: data.due || "", priority: data.priority || "Medium" };
      p.tasks.unshift(record);
    } else if (type === "dataset") {
      throw new Error("Datasets are added through the import path, not created as artifacts.");
    } else {
      record = { ...common, kind: type, summary: str(data.description, ""), spec: data.spec || null, visual: data.visual || null, audience: data.audience || null, runId: data.runId || null, prompt: data.prompt || null, findings: arr(data.findings), steps: data.steps || null };
      p.outputs.unshift(record);
      p.outputs = p.outputs.slice(0, 120);
    }
    recordActivity(p, { type: `${type}-created`, text: `${def.label} created: ${record.title}`, artifactId: record.id, artifactType: type });
    p.updatedAt = now;
    return get(p, record.id);
  }

  function rawOf(project, id) {
    const p = shape(project);
    for (const key of ["findings", "outputs", "decisions", "tasks", "datasets"]) {
      const found = p[key].find(item => item.id === id);
      if (found) return { record: found, collection: key };
    }
    return { record: null, collection: null };
  }

  function update(project, id, patch = {}) {
    const p = shape(project);
    const { record } = rawOf(p, id);
    if (!record) return null;
    const before = get(p, id);

    const changed = Object.keys(patch).filter(key => JSON.stringify(record[key]) !== JSON.stringify(patch[key]));
    if (!changed.length) return before;
    p.artifactHistory.unshift({ id: uid("revision"), artifactId: id, at: Date.now(), actor: actorName(), fields: changed, from: Object.fromEntries(changed.map(key => [key, record[key]])) });
    p.artifactHistory = p.artifactHistory.slice(0, 200);
    Object.assign(record, patch, { updatedAt: Date.now() });
    if (patch.status && patch.status !== before.status) {
      recordActivity(p, { type: "status-changed", text: `${before.title} marked ${statusLabel(patch.status).toLowerCase()}`, artifactId: id, artifactType: before.type });
    }
    p.updatedAt = Date.now();
    return get(p, id);
  }

  function history(project, id) { return shape(project).artifactHistory.filter(item => item.artifactId === id); }

  function archive(project, id) {
    const artifact = get(project, id);
    if (!artifact) return null;
    if (!TYPES[artifact.type].archivable) return null;
    return update(project, id, { status: "archived" });
  }


  function removalImpact(project, id) {
    const dependents = downstream(project, id);
    return { count: dependents.length, dependents: dependents.map(item => ({ id: item.id, type: item.type, title: item.title })) };
  }

  function remove(project, id) {
    const p = shape(project);
    const artifact = get(p, id);
    if (!artifact) return false;
    const { collection } = rawOf(p, id);
    if (!collection) return false;
    p[collection] = p[collection].filter(item => item.id !== id);
    p.links = p.links.filter(item => item.from !== id && item.to !== id);
    recordActivity(p, { type: "deleted", text: `${TYPES[artifact.type].label} deleted: ${artifact.title}`, artifactType: artifact.type });
    p.updatedAt = Date.now();
    return true;
  }


  function comment(project, artifactId, content) {
    const p = shape(project);
    const text = str(content, "");
    if (!text) return null;
    const names = (access()?.members?.list() || []).map(member => member.name);
    const mentions = names.filter(name => new RegExp(`@${name.split(/\s+/)[0]}\\b`, "i").test(text));
    const entry = { id: uid("comment"), artifactId, author: actorName(), content: text.slice(0, 2000), mentions, resolved: false, createdAt: Date.now() };
    p.comments.unshift(entry);
    const artifact = get(p, artifactId);
    recordActivity(p, { type: "comment", text: `Comment on ${artifact ? artifact.title : "the project"}`, artifactId, artifactType: artifact?.type || null });
    mentions.forEach(name => recordActivity(p, { type: "mention", text: `${name} was mentioned in a comment`, artifactId, artifactType: artifact?.type || null }));
    return entry;
  }

  function comments(project, artifactId) { return shape(project).comments.filter(item => item.artifactId === artifactId).sort((a, b) => a.createdAt - b.createdAt); }
  function resolveComment(project, id, resolved = true) {
    const entry = shape(project).comments.find(item => item.id === id);
    if (entry) entry.resolved = resolved;
    return entry || null;
  }

  function assign(project, id, assignee) {
    const artifact = get(project, id);
    if (!artifact) return null;
    const patch = artifact.type === "task" ? { assignee, owner: assignee } : { owner: assignee };
    const updated = update(project, id, patch);
    recordActivity(project, { type: "assigned", text: `${artifact.title} assigned to ${assignee || "nobody"}`, artifactId: id, artifactType: artifact.type });
    return updated;
  }


  function search(projects, query, { limit = 20, types = null, includeArchived = false } = {}) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const reachable = arr(projects).filter(canReach);
    const hits = [];
    reachable.forEach(project => {
      list(project, { types, includeArchived }).forEach(item => {
        const haystack = `${item.title} ${item.description} ${item.tags.join(" ")} ${item.meta.statement || ""}`.toLowerCase();
        if (!haystack.includes(q)) return;
        let score = haystack.indexOf(q) === 0 ? 10 : 4;
        if (item.title.toLowerCase().includes(q)) score += 6;
        hits.push({ ...item, projectName: project.name, score });
      });
    });
    return hits.sort((a, b) => b.score - a.score || (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, limit);
  }


  function projectContext(project) {
    if (!project || !canReach(project)) return null;
    const p = shape(project);
    const a = access();
    const items = list(p);
    const byType = type => items.filter(item => item.type === type);
    return {
      project: { id: p.id, name: p.name, description: p.description, status: p.status, mode: p.mode, isDemo: Boolean(p.isDemo), updatedAt: p.updatedAt, tags: p.tags.slice() },
      ownership: { ownerId: p.ownerId, teamId: p.teamId, teamName: p.teamId ? a?.teams.get(p.teamId)?.name || null : null, organizationId: p.organizationId },
      role: a ? a.projectAccess.roleOn(p.id) : "owner",
      datasets: byType("dataset").map(item => ({ id: item.id, name: item.title, rows: item.meta.rows, columns: item.meta.columns, version: item.meta.version })),
      findings: byType("finding").slice(0, 25).map(item => ({ id: item.id, title: item.title, status: item.status, hasEvidence: Boolean(item.evidence) })),
      outputs: ["chart", "dashboard", "report", "workflow"].flatMap(type => byType(type).slice(0, 10).map(item => ({ id: item.id, type: item.type, title: item.title, status: item.status }))),
      decisions: byType("decision").slice(0, 15).map(item => ({ id: item.id, title: item.title, status: item.status, owner: item.meta.owner })),
      tasks: byType("task").slice(0, 25).map(item => ({ id: item.id, title: item.title, status: item.status, assignee: item.meta.assignee, due: item.meta.due })),
      openTasks: byType("task").filter(item => item.status !== "done").length,
      definitions: [...arr(p.metrics).map(item => ({ kind: "metric", term: item.name, definition: item.formula })), ...arr(p.glossary).map(item => ({ kind: "term", term: item.term, definition: item.definition }))],
      activity: activity(p, { limit: 8 }).map(item => ({ text: item.text, actor: item.actor, at: item.at })),
      capabilities: a ? a.summary().capabilities : null
    };
  }

  const api = {
    SCHEMA_VERSION, TYPES, TYPE_IDS, STATUS, PROJECT_STATUSES, DEFAULT_STATUS,
    typeOf, statusLabel, statusesFor, shape, uid,
    list, get, counts, search, activity, recordActivity, actorName,
    create, update, remove, archive, removalImpact, history, assign,
    lineage, upstream, downstream, link,
    comment, comments, resolveComment,
    projectContext, canReach
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  SN.artifacts = api;
})(typeof window !== "undefined" ? window : globalThis);
