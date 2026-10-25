


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  if (!studio || !SN.artifacts) return;
  const A = SN.artifacts;
  const PS = SN.projectService;
  const access = () => SN.access;
  const esc = studio.escapeHtml;
  const $ = selector => document.querySelector(selector);
  const project = () => studio.state.project;

  let openArtifactId = null;
  let artifactFilter = "all";
  let artifactQuery = "";
  let showArchived = false;

  const relative = value => {
    if (!value) return "";
    const diff = Date.now() - value;
    const day = 86400000;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < day) return `${Math.round(diff / 3600000)}h ago`;
    if (diff < day * 7) return `${Math.round(diff / day)}d ago`;
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const can = id => !access() || access().can(id);

  const may = capability => {
    const a = access();
    if (!a) return true;
    return a.projectAccess.allows(capability, project().id);
  };

  const statusBadge = item => {
    const label = A.statusLabel(item.status);
    if (!label) return "";
    const tone = /published|validated|approved|done|active/i.test(item.status) ? " sn-badge-success"
      : /blocked|rejected/i.test(item.status) ? " sn-badge-danger"
      : /review|in-progress|proposed/i.test(item.status) ? " sn-badge-warning"
      : /archived/i.test(item.status) ? " sn-badge-muted" : "";
    return `<span class="sn-badge${tone}">${esc(label)}</span>`;
  };

  const emptyPanel = text => `<p class="project-empty">${esc(text)}</p>`;


  function renderHome() {
    const p = project();
    if (!p || !$("#project-home-meta")) return;
    const summary = PS.summarize(p);
    $("#overview-title").textContent = p.name;
    const description = $("#project-home-description");
    description.textContent = p.description || "";
    description.hidden = !p.description;

    const mode = SN.catalog.projectModes.find(item => item.id === p.mode) || SN.catalog.projectModes[0];
    const bits = [
      summary.teamName ? `<span class="sn-badge">${esc(summary.teamName)}</span>` : "",
      summary.ownerName ? `<span class="sn-muted">Owner: ${esc(summary.ownerName)}</span>` : "",
      `<span class="sn-badge${summary.status === "active" ? " sn-badge-success" : " sn-badge-muted"}">${esc(A.PROJECT_STATUSES.find(item => item.id === summary.status)?.label || summary.status)}</span>`,
      p.isDemo ? '<span class="sn-badge sn-badge-preview">Demo · sample data</span>' : `<span class="sn-muted">${esc(mode.label)}</span>`,
      summary.role && summary.role !== "owner" ? `<span class="sn-badge sn-badge-muted">Your role: ${esc(summary.role)}</span>` : "",
      `<span class="sn-muted">Updated ${esc(relative(summary.updatedAt))}</span>`,
      ...summary.tags.map(tag => `<span class="sn-chip sn-chip-sm">${esc(tag)}</span>`)
    ].filter(Boolean);
    $("#project-home-meta").innerHTML = bits.join("");

    renderData(summary);
    renderFindings();
    renderOutputs();
    renderWork();
    renderActivity();
    renderStarters();
    const total = A.list(p).length;
    const count = $("#nav-artifacts-count");
    if (count) count.textContent = total ? String(total) : "";
  }

  function renderData(summary) {
    const p = project();
    const datasets = A.list(p, { type: "dataset" });
    $("#ph-data").innerHTML = datasets.length
      ? `<ul class="project-list">${datasets.slice(0, 5).map(item => `<li><button type="button" class="project-row" data-artifact="${esc(item.id)}"><span class="project-row-icon" aria-hidden="true">▦</span><span class="project-row-body"><strong>${esc(item.title)}</strong><small>${esc(item.description)}${item.meta.version > 1 ? ` · v${item.meta.version}` : ""}</small></span></button></li>`).join("")}</ul>
         ${datasets.length > 5 ? `<p class="project-more">${datasets.length - 5} more</p>` : ""}
         <p class="project-foot">${summary.rows.toLocaleString()} rows in this project.</p>`
      : `${emptyPanel("Add a CSV, Excel or JSON file and it becomes the data this project works from.")}${may("data.import") ? '<div class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-ph-goto="data">Add data</button></div>' : ""}`;
  }

  function renderFindings() {
    const findings = A.list(project(), { type: "finding", limit: 5 });
    $("#ph-findings").innerHTML = findings.length
      ? `<ul class="project-list">${findings.map(item => `<li><button type="button" class="project-row" data-artifact="${esc(item.id)}"><span class="project-row-icon" aria-hidden="true">✦</span><span class="project-row-body"><strong>${esc(item.title)}</strong><small>${item.evidence ? `${esc(item.evidence.dataset || "")} · ${esc(item.evidence.method || "calculated")}` : "No evidence recorded"}</small></span>${statusBadge(item)}</button></li>`).join("")}</ul>`
      : emptyPanel("Important analytical findings you save will appear here, each with the evidence behind it.");
  }

  function renderOutputs() {
    const outputs = A.list(project(), { types: ["chart", "dashboard", "report", "workflow"], limit: 5 });
    $("#ph-outputs").innerHTML = outputs.length
      ? `<ul class="project-list">${outputs.map(item => `<li><button type="button" class="project-row" data-artifact="${esc(item.id)}"><span class="project-row-icon" aria-hidden="true">${A.typeOf(item.type).icon}</span><span class="project-row-body"><strong>${esc(item.title)}</strong><small>${esc(A.typeOf(item.type).label)}${item.description ? ` · ${esc(item.description.slice(0, 70))}` : ""}</small></span>${statusBadge(item)}</button></li>`).join("")}</ul>`
      : emptyPanel("Create a report or dashboard from your project findings and charts.");
  }

  function renderWork() {
    const p = project();
    const tasks = A.list(p, { type: "task" }).filter(item => item.status !== "done");
    const decisions = A.list(p, { type: "decision", limit: 3 });
    const rows = [...decisions, ...tasks.slice(0, 4)];
    $("#ph-work").innerHTML = rows.length
      ? `<ul class="project-list">${rows.map(item => `<li><button type="button" class="project-row" data-artifact="${esc(item.id)}"><span class="project-row-icon" aria-hidden="true">${A.typeOf(item.type).icon}</span><span class="project-row-body"><strong>${esc(item.title)}</strong><small>${esc([A.typeOf(item.type).label, item.meta.assignee || item.meta.owner, item.meta.due && `due ${item.meta.due}`].filter(Boolean).join(" · "))}</small></span>${statusBadge(item)}</button></li>`).join("")}</ul>`
      : emptyPanel("Record decisions and the evidence behind them, and turn findings into follow-up work.");
  }

  function renderActivity() {
    const items = A.activity(project(), { limit: 8 });
    $("#ph-activity").innerHTML = items.length
      ? `<ul class="project-activity">${items.map(item => `<li><span class="project-activity-dot" aria-hidden="true"></span><span><strong>${esc(item.text)}</strong><small>${esc(item.actor)}${item.at || item.label ? ` · ${esc(item.label || relative(item.at))}` : ""}</small></span></li>`).join("")}</ul>`
      : emptyPanel("Project activity will appear here as work is created.");
  }


  function renderStarters() {
    const p = project();
    const node = $("#project-home-starters");
    if (!node) return;
    const findings = A.list(p, { type: "finding" }).length;
    const tasks = A.list(p, { type: "task" }).filter(item => item.status !== "done").length;
    const options = [
      !p.datasets.length && { label: "What can I do without data?", prompt: "What can you help me with?" },
      p.datasets.length && { label: "What is in this data?", prompt: "What is in this file?" },
      findings >= 2 && can("reports.create") && { label: "Put the findings in a report", prompt: "Create a report from the findings in this project" },
      tasks > 0 && { label: "What's still open?", prompt: "What is still unresolved in this project?" },
      findings > 0 && { label: "What are the key findings?", prompt: "What are the most important findings in this project?" }
    ].filter(Boolean).slice(0, 3);
    node.innerHTML = options.map(item => `<button type="button" class="sn-chip sn-chip-sm" data-ph-prompt="${esc(item.prompt)}">${esc(item.label)}</button>`).join("");
  }


  function renderArtifacts() {
    const p = project();
    if (!p || !$("#artifact-list")) return;
    const all = A.list(p, { includeArchived: showArchived });
    const counts = {};
    all.forEach(item => { counts[item.type] = (counts[item.type] || 0) + 1; });
    const tabs = [{ id: "all", label: "All", count: all.length }, ...A.TYPE_IDS.filter(id => counts[id]).map(id => ({ id, label: A.typeOf(id).plural, count: counts[id] }))];
    if (!tabs.some(tab => tab.id === artifactFilter)) artifactFilter = "all";
    $("#artifact-tabs").innerHTML = tabs.map(tab => `<button type="button" class="sn-tab" role="tab" aria-selected="${tab.id === artifactFilter}" data-artifact-tab="${tab.id}">${esc(tab.label)}<span class="sn-count">${tab.count}</span></button>`).join("");

    const query = artifactQuery.trim().toLowerCase();
    let items = artifactFilter === "all" ? all : all.filter(item => item.type === artifactFilter);
    if (query) items = items.filter(item => `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(query));

    $("#artifact-list").innerHTML = items.length
      ? items.map(artifactRow).join("")
      : `<div class="sn-empty"><div class="sn-empty-icon">${artifactFilter === "all" ? "◈" : A.typeOf(artifactFilter).icon}</div><div class="sn-empty-title">${query ? "Nothing matches that" : `No ${artifactFilter === "all" ? "work" : A.typeOf(artifactFilter).plural.toLowerCase()} yet`}</div><div class="sn-empty-text">${esc(query ? "Try a different word." : artifactFilter === "all" ? "Findings, charts, reports, decisions and tasks you create will collect here." : A.typeOf(artifactFilter).empty)}</div></div>`;
  }

  function artifactRow(item) {
    const def = A.typeOf(item.type);
    const lineage = A.lineage(project(), item.id);
    const from = lineage.upstream.slice(0, 2).map(source => source.title);
    const used = lineage.downstream.length;
    return `<article class="artifact-row" data-artifact-card="${esc(item.id)}">
      <span class="artifact-icon" aria-hidden="true">${def.icon}</span>
      <div class="artifact-body">
        <div class="artifact-title"><strong>${esc(item.title)}</strong>${statusBadge(item)}</div>
        ${item.description ? `<p class="artifact-desc">${esc(item.description.slice(0, 160))}</p>` : ""}
        <p class="artifact-meta">${esc(def.label)}${item.createdBy ? ` · ${esc(item.createdBy)}` : ""}${item.createdAt ? ` · ${esc(relative(item.createdAt))}` : ""}${from.length ? ` · from ${esc(from.join(", "))}` : ""}${used ? ` · used by ${used}` : ""}</p>
      </div>
      <div class="artifact-actions sn-cluster">
        <button type="button" class="sn-btn sn-btn-sm" data-artifact="${esc(item.id)}">Open</button>
      </div>
    </article>`;
  }


  function openArtifact(id) {
    const p = project();
    const item = A.get(p, id);
    if (!item) return;
    openArtifactId = id;
    const def = A.typeOf(item.type);
    const lineage = A.lineage(p, id);
    const notes = A.comments(p, id);
    const revisions = A.history(p, id);
    const statuses = A.statusesFor(item.type);
    const members = access() && !access().isPersonal() ? access().members.list() : [];

    const sourceHtml = lineage.upstream.length
      ? `<ul class="lineage-list">${lineage.upstream.map(source => `<li><span aria-hidden="true">${A.typeOf(source.type).icon}</span><button type="button" class="sn-link" data-artifact="${esc(source.id)}">${esc(source.title)}</button><span class="sn-faint sn-xs">${esc(A.typeOf(source.type).label)}${source.recovered ? " · inferred" : ""}</span></li>`).join("")}</ul>`
      : '<p class="project-empty">No upstream source was recorded for this.</p>';
    const usedHtml = lineage.downstream.length
      ? `<ul class="lineage-list">${lineage.downstream.map(child => `<li><span aria-hidden="true">${A.typeOf(child.type).icon}</span><button type="button" class="sn-link" data-artifact="${esc(child.id)}">${esc(child.title)}</button><span class="sn-faint sn-xs">${esc(A.typeOf(child.type).label)}</span></li>`).join("")}</ul>`
      : '<p class="project-empty">Nothing else references this yet.</p>';

    const evidenceHtml = item.evidence
      ? `<dl class="artifact-evidence"><dt>Source</dt><dd>${esc(item.evidence.dataset || "—")}</dd><dt>Rows used</dt><dd>${esc(String(item.evidence.rows ?? "—"))}${item.evidence.rowsTotal != null ? ` of ${esc(String(item.evidence.rowsTotal))}` : ""}</dd><dt>Filters</dt><dd>${esc((item.evidence.filters || []).join("; ") || "None")}</dd><dt>Calculation</dt><dd><code>${esc(item.evidence.calculation || "—")}</code></dd><dt>Method</dt><dd>${esc(item.evidence.method || "—")}</dd></dl>`
      : "";

    studio.dialog(`<div class="artifact-detail">
      <span class="eyebrow">${esc(def.label)}</span>
      <h2 style="margin:8px 0 6px">${esc(item.title)}</h2>
      ${item.description ? `<p class="muted">${esc(item.description)}</p>` : ""}
      <div class="sn-cluster" style="margin:14px 0 4px">
        ${statuses.length ? `<label class="sn-sr-only" for="artifact-status">Status</label><select class="sn-select sn-select-sm" id="artifact-status" ${may(def.capability) ? "" : "disabled"}>${statuses.map(status => `<option value="${esc(status)}" ${status === item.status ? "selected" : ""}>${esc(A.statusLabel(status))}</option>`).join("")}</select>` : ""}
        ${members.length && (item.type === "task" || item.type === "decision") ? `<label class="sn-sr-only" for="artifact-assignee">Assigned to</label><select class="sn-select sn-select-sm" id="artifact-assignee"><option value="">Unassigned</option>${members.map(member => `<option value="${esc(member.name)}" ${member.name === (item.meta.assignee || item.meta.owner) ? "selected" : ""}>${esc(member.name)}</option>`).join("")}</select>` : ""}
      </div>
      ${evidenceHtml}
      <div class="artifact-panels">
        <section><h3 class="sn-h4">Came from</h3>${sourceHtml}</section>
        <section><h3 class="sn-h4">Used by</h3>${usedHtml}</section>
      </div>
      <section class="artifact-comments">
        <h3 class="sn-h4">Notes</h3>
        ${notes.length ? `<ul class="comment-list">${notes.map(note => `<li><strong>${esc(note.author)}</strong><span>${esc(note.content)}</span><small>${esc(relative(note.createdAt))}${note.mentions.length ? ` · mentioned ${esc(note.mentions.join(", "))}` : ""}</small></li>`).join("")}</ul>` : '<p class="project-empty">No notes yet.</p>'}
        <form id="artifact-comment-form" class="comment-form"><label class="sn-sr-only" for="artifact-comment">Add a note</label><input class="sn-input" id="artifact-comment" placeholder="Add a note${members.length ? ", @name to mention someone" : ""}" maxlength="2000"><button class="sn-btn sn-btn-sm">Add</button></form>
        ${members.length ? '<p class="sn-faint sn-xs">A mention is recorded in this project’s activity. Nothing is emailed or sent anywhere.</p>' : ""}
      </section>
      ${revisions.length ? `<p class="sn-faint sn-xs" style="margin-top:12px">${revisions.length} recorded change${revisions.length === 1 ? "" : "s"}, most recently ${esc(relative(revisions[0].at))} by ${esc(revisions[0].actor)}.</p>` : ""}
      <div class="sn-split" style="margin-top:20px;gap:10px">
        <span class="sn-cluster">
          ${can("vanessa.use") ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-accent" data-artifact-ask="${esc(item.id)}">Ask Vanessa</button>` : ""}
          ${item.type === "finding" && may("reports.create") ? `<button type="button" class="sn-btn sn-btn-sm" data-artifact-report="${esc(item.id)}">Add to report</button>` : ""}
          ${item.type === "finding" && may("tasks.manage") ? `<button type="button" class="sn-btn sn-btn-sm" data-artifact-task="${esc(item.id)}">Create task</button>` : ""}
          ${item.type === "finding" && may("decisions.manage") ? `<button type="button" class="sn-btn sn-btn-sm" data-artifact-decision="${esc(item.id)}">Record decision</button>` : ""}
        </span>
        <span class="sn-cluster">
          ${def.archivable && item.status !== "archived" && may(def.capability) ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-artifact-archive="${esc(item.id)}">Archive</button>` : ""}
          ${def.archivable && may("projects.delete") ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-artifact-delete="${esc(item.id)}">Delete</button>` : ""}
        </span>
      </div>
    </div>`);
  }


  function askVanessa(id) {
    const item = A.get(project(), id);
    if (!item) return;
    const prompts = {
      finding: `Explain why this happened: ${item.title}`,
      dataset: `Check ${item.title} for quality problems`,
      dashboard: `What is driving the change in ${item.title}?`,
      report: `Summarize ${item.title} for leadership`,
      chart: `Explain what ${item.title} shows`,
      decision: `What evidence supports the decision "${item.title}"?`,
      workflow: `What does the ${item.title} workflow do?`,
      task: `What analysis would help with: ${item.title}?`
    };
    studio.closeDialog();
    studio.showView("vanessa");
    window.SignalNoirVanessa?.workspace?.addContext({
      source: "artifact", sourceLabel: `${A.typeOf(item.type).label}: ${item.title}`,
      summary: item.description || item.meta.statement || `${A.typeOf(item.type).label} in this project.`,
      facts: item.evidence ? [`Source: ${item.evidence.dataset || "—"}`, `Method: ${item.evidence.method || "—"}`].filter(Boolean) : [],
      suggestedPrompt: prompts[item.type] || `Tell me about ${item.title}`
    });
    const input = document.getElementById("vn-input");
    if (input) { input.value = prompts[item.type] || `Tell me about ${item.title}`; input.focus(); }
  }

  function createFrom(id, type) {
    const p = project();
    const source = A.get(p, id);
    if (!source) return;
    const defaults = {
      task: { title: `Investigate: ${source.title}`, description: `Follow-up from the finding “${source.title}”.` },
      decision: { title: `Decision on: ${source.title}`, description: "", rationale: `Based on the finding “${source.title}”.` },
      report: { title: `Report: ${source.title}`, description: `Assembled from ${source.title}.` }
    }[type];
    const created = A.create(p, type, { ...defaults, sources: [{ type: source.type, id: source.id, rel: type === "report" ? "includes" : "based-on" }] });
    if (type === "report") A.update(p, created.id, { findingIds: [source.id] });
    studio.markDirty();
    studio.saveProject(true);
    studio.closeDialog();
    studio.toast(`${A.typeOf(type).label} created and linked to ${source.title}.`);
    refresh();
    openArtifact(created.id);
  }


  function openSettings() {
    const p = project();
    const a = access();
    const teams = a && !a.isPersonal() ? a.teams.list() : [];
    const members = a && !a.isPersonal() ? a.members.list() : [];
    studio.dialog(`<form id="project-settings-form">
      <span class="eyebrow">Project settings</span>
      <h2 style="margin:8px 0 14px">${esc(p.name)}</h2>
      <div class="form-grid">
        <label class="sn-label" for="ps-name">Name</label>
        <input class="sn-input" id="ps-name" name="name" value="${esc(p.name)}" required maxlength="120">
        <label class="sn-label" for="ps-description">Description</label>
        <textarea class="sn-textarea" id="ps-description" name="description" rows="2" maxlength="400" placeholder="What is this project for?">${esc(p.description)}</textarea>
        <label class="sn-label" for="ps-status">Status</label>
        <select class="sn-select" id="ps-status" name="status">${A.PROJECT_STATUSES.map(status => `<option value="${esc(status.id)}" ${status.id === p.status ? "selected" : ""}>${esc(status.label)} — ${esc(status.description)}</option>`).join("")}</select>
        ${teams.length ? `<label class="sn-label" for="ps-team">Owning team</label><select class="sn-select" id="ps-team" name="teamId"><option value="">No team</option>${teams.map(team => `<option value="${esc(team.id)}" ${team.id === p.teamId ? "selected" : ""}>${esc(team.name)}</option>`).join("")}</select>` : ""}
        ${members.length ? `<label class="sn-label" for="ps-owner">Project owner</label><select class="sn-select" id="ps-owner" name="ownerId"><option value="">Nobody</option>${members.map(member => `<option value="${esc(member.id)}" ${member.id === p.ownerId ? "selected" : ""}>${esc(member.name)}</option>`).join("")}</select>` : ""}
        <label class="sn-label" for="ps-tags">Tags <span class="sn-muted sn-xs">(comma separated)</span></label>
        <input class="sn-input" id="ps-tags" name="tags" value="${esc(p.tags.join(", "))}" maxlength="200">
      </div>
      ${teams.length ? '<p class="sn-faint sn-xs" style="margin-top:10px">Who can reach this project is set under Organization → Project access.</p>' : ""}
      <div class="sn-split" style="margin-top:20px;gap:10px">
        <span class="sn-cluster">
          <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-project-duplicate>Duplicate</button>
          <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-project-import>Import a bundle</button>
        </span>
        <span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">Save</button></span>
      </div>
    </form>`);
    document.querySelector("#project-settings-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      const p2 = project();
      p2.name = String(data.get("name") || p2.name).trim() || p2.name;
      p2.description = String(data.get("description") || "").trim();
      p2.tags = String(data.get("tags") || "").split(",").map(tag => tag.trim()).filter(Boolean);
      PS.setStatus(p2, data.get("status"));
      if (data.has("teamId") || data.has("ownerId")) PS.setOwnership(p2, { teamId: data.get("teamId") || null, ownerId: data.get("ownerId") || null });
      studio.markDirty();
      studio.saveProject(true);
      studio.closeDialog();
      studio.renderAll();
      studio.toast("Project settings saved.");
    });
    document.querySelector("[data-project-duplicate]").addEventListener("click", duplicateProject);
    document.querySelector("[data-project-import]").addEventListener("click", importBundle);
  }

  function duplicateProject() {
    const p = project();
    studio.dialog(`<form id="duplicate-form">
      <span class="eyebrow">Duplicate project</span>
      <h2 style="margin:8px 0 6px">Reuse this project's shape</h2>
      <p class="muted">Useful for a recurring process: the structure, description and definitions carry over.</p>
      <div class="form-grid" style="margin-top:16px">
        <label class="sn-label" for="dup-name">New project name</label>
        <input class="sn-input" id="dup-name" name="name" value="${esc(p.name)} (copy)" required maxlength="120">
      </div>
      <fieldset class="org-fieldset"><legend>Also copy</legend>
        <label class="org-check"><input type="checkbox" name="data"><span>The data <small>${p.datasets.length} dataset(s). Copies can use a lot of browser storage.</small></span></label>
        <label class="org-check"><input type="checkbox" name="artifacts"><span>Findings, outputs, decisions and tasks <small>Off by default: a new cycle usually starts empty.</small></span></label>
      </fieldset>
      <div class="sn-cluster" style="justify-content:flex-end;margin-top:18px"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">Duplicate</button></div>
    </form>`);
    document.querySelector("#duplicate-form").addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.target);
      const copy = PS.duplicate(project(), { name: data.get("name"), includeData: data.get("data") === "on", includeArtifacts: data.get("artifacts") === "on" });
      studio.closeDialog();
      await studio.adoptProject(copy);
      studio.toast(`${copy.name} created.`);
    });
  }

  function exportBundle() {
    const p = project();
    const hasRows = p.datasets.some(dataset => (dataset.rows || []).length);
    const includeData = !hasRows || confirm("Include the data itself in the bundle?\n\nOK: a complete, larger file.\nCancel: metadata, findings and outputs only.");
    const bundle = PS.exportProject(p, { includeData });
    studio.download(`${studio.slug(p.name)}-project.json`, JSON.stringify(bundle, null, 2), "application/json");
    studio.toast(`Project exported${includeData ? " with its data" : " without data"}.`);
  }

  function importBundle() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      let parsed = null;
      try { parsed = JSON.parse(await file.text()); }
      catch (error) { studio.toast("That file isn’t valid JSON."); return; }
      const result = PS.importProject(parsed);
      if (!result.ok) { studio.toast(result.error); return; }
      studio.closeDialog();
      await studio.adoptProject(result.project);
      result.warnings.forEach(warning => studio.toast(warning));
      studio.toast(`${result.project.name} imported.`);
    });
    input.click();
  }


  function refresh() { renderHome(); renderArtifacts(); }

  document.addEventListener("click", event => {
    const target = event.target;
    const goto = target.closest("[data-ph-goto]");
    if (goto) { studio.showView(goto.dataset.phGoto); return; }
    const prompt = target.closest("[data-ph-prompt]");
    if (prompt) { studio.showView("vanessa"); window.SignalNoirStudio?.run(prompt.dataset.phPrompt); return; }
    const tab = target.closest("[data-artifact-tab]");
    if (tab) { artifactFilter = tab.dataset.artifactTab; renderArtifacts(); return; }
    const open = target.closest("[data-artifact]");
    if (open) { openArtifact(open.dataset.artifact); return; }
    const ask = target.closest("[data-artifact-ask]");
    if (ask) { askVanessa(ask.dataset.artifactAsk); return; }
    const toTask = target.closest("[data-artifact-task]");
    if (toTask) { createFrom(toTask.dataset.artifactTask, "task"); return; }
    const toDecision = target.closest("[data-artifact-decision]");
    if (toDecision) { createFrom(toDecision.dataset.artifactDecision, "decision"); return; }
    const toReport = target.closest("[data-artifact-report]");
    if (toReport) { createFrom(toReport.dataset.artifactReport, "report"); return; }
    const archive = target.closest("[data-artifact-archive]");
    if (archive) {
      A.archive(project(), archive.dataset.artifactArchive);
      studio.markDirty(); studio.saveProject(true); studio.closeDialog(); refresh();
      studio.toast("Archived. It stays in the project and still appears in lineage.");
      return;
    }
    const remove = target.closest("[data-artifact-delete]");
    if (remove) {
      const id = remove.dataset.artifactDelete;
      const impact = A.removalImpact(project(), id);
      const warning = impact.count ? `\n\nThis is used by ${impact.count} other item${impact.count === 1 ? "" : "s"}: ${impact.dependents.map(item => item.title).join(", ")}. Deleting it breaks that lineage.` : "";
      if (!confirm(`Delete this permanently?${warning}\n\nArchiving keeps it and its lineage instead.`)) return;
      A.remove(project(), id);
      studio.markDirty(); studio.saveProject(true); studio.closeDialog(); refresh();
      studio.toast("Deleted.");
      return;
    }
    if (target.closest("#project-settings-btn")) openSettings();
    if (target.closest("#export-project-btn")) exportBundle();
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "project-home-form") {
      event.preventDefault();
      const input = $("#project-home-prompt");
      const value = input.value.trim();
      if (!value) return;
      input.value = "";
      studio.showView("vanessa");
      window.SignalNoirStudio?.run(value);
    }
    if (event.target.id === "artifact-comment-form") {
      event.preventDefault();
      const id = openArtifactId;
      const field = $("#artifact-comment");
      if (!id || !field.value.trim()) return;
      A.comment(project(), id, field.value);
      studio.markDirty(); studio.saveProject(true);
      openArtifact(id);
      refresh();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "artifact-status" || event.target.id === "artifact-assignee") {
      const id = openArtifactId;
      if (!id) return;
      if (event.target.id === "artifact-status") A.update(project(), id, { status: event.target.value });
      else A.assign(project(), id, event.target.value);
      studio.markDirty(); studio.saveProject(true); refresh();
      studio.toast("Updated.");
    }
    if (event.target.id === "artifact-archived") { showArchived = event.target.checked; renderArtifacts(); }
  });

  document.addEventListener("input", event => {
    if (event.target.id === "artifact-search") { artifactQuery = event.target.value; renderArtifacts(); }
  });

  window.addEventListener("datahub:project-render", refresh);
  window.addEventListener("vanessa:run-complete", refresh);
  window.addEventListener("vanessa:outputs-changed", refresh);

  window.SignalNoirProjectHome = { refresh, openArtifact, openSettings, exportBundle, importBundle, setFilter(next) { artifactFilter = next || "all"; renderArtifacts(); } };
})();
