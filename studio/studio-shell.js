


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  if (!studio || !window.SignalNoirVanessa?.workspace) return;
  const { catalog, Workflow, Evidence, viz, analysis: A } = SN;
  const esc = studio.escapeHtml;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const CTX_KEY = "sn_studio_context";
  const project = () => studio.state.project;
  const wide = () => matchMedia("(min-width: 1281px)").matches;
  const OUTPUT_KINDS = [
    { id: "insight", label: "Insights", icon: "✦" },
    { id: "chart", label: "Charts", icon: "◔" },
    { id: "dashboard", label: "Dashboards", icon: "▥" },
    { id: "report", label: "Reports", icon: "▤" },
    { id: "decision", label: "Decisions", icon: "◇" },
    { id: "task", label: "Tasks", icon: "☐" },
    { id: "workflow", label: "Workflows", icon: "↻" }
  ];
  let outputsTab = "insight";


  function setNav(open) {
    document.body.classList.toggle("nav-open", open);
    $("#sidebar-toggle").setAttribute("aria-expanded", String(open));
    syncScrim();
  }
  function setContext(open, remember = true) {
    if (wide()) {
      document.body.classList.toggle("ctx-collapsed", !open);
      document.body.classList.remove("ctx-open");
      if (remember) try { localStorage.setItem(CTX_KEY, open ? "open" : "closed"); } catch (error) {                }
    } else document.body.classList.toggle("ctx-open", open);
    $("#context-toggle").setAttribute("aria-expanded", String(open));
    syncScrim();
  }
  function contextOpen() { return wide() ? !document.body.classList.contains("ctx-collapsed") : document.body.classList.contains("ctx-open"); }
  function syncScrim() {
    const show = document.body.classList.contains("nav-open") || (!wide() && document.body.classList.contains("ctx-open"));
    $("#studio-scrim").hidden = !show;
  }
  $("#sidebar-toggle").addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
  $("#context-toggle").addEventListener("click", () => setContext(!contextOpen()));
  $("#studio-scrim").addEventListener("click", () => { setNav(false); if (!wide()) setContext(false); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { if (document.body.classList.contains("nav-open")) setNav(false); if (!wide() && document.body.classList.contains("ctx-open")) setContext(false); } });
  window.addEventListener("datahub:view", () => { setNav(false); if (!wide()) setContext(false); });
  matchMedia("(min-width: 1281px)").addEventListener("change", () => { document.body.classList.remove("ctx-open"); applyStoredContext(); syncScrim(); });
  function applyStoredContext() {
    let stored = null;
    try { stored = localStorage.getItem(CTX_KEY); } catch (error) {                }
    if (wide()) setContext(stored !== "closed", false);
    else $("#context-toggle").setAttribute("aria-expanded", "false");
  }

  const more = $(".studio-more");
  document.addEventListener("click", event => { if (more.open && !more.contains(event.target)) more.open = false; });
  more.querySelector(".studio-more-menu").addEventListener("click", event => { if (event.target.closest("button")) setTimeout(() => { more.open = false; }, 0); });
  $("[data-theme-toggle]").addEventListener("click", () => SN.platform?.toggleTheme());

  function syncNavGroups() {
    $$(".nav-group").forEach(group => { group.hidden = group.querySelectorAll(".nav-item:not([hidden])").length === 0; });
  }
  window.addEventListener("datahub:mode", syncNavGroups);


  function openModes() {
    const current = project().mode || "local";
    const icons = { local: "◉", "private-cloud": "☁", team: "◎" };
    studio.dialog(`<span class="eyebrow">Project mode</span><h2>Where this project lives</h2><p class="muted">Local is fully available today. Private Cloud and Team need Signal Noir services that are still being built, so they can’t be switched on yet.</p>
      <div class="sn-stack" style="--sn-stack-gap:10px;margin-top:18px">${catalog.projectModes.map(mode => `<div class="sn-panel sn-panel-pad" style="padding:16px"><div class="sn-split"><span class="sn-cluster"><span class="sn-card-icon" aria-hidden="true">${icons[mode.id]}</span><span><strong style="color:var(--sn-text)">${esc(mode.label)}</strong><br><span class="sn-muted sn-small">${esc(mode.tagline)}</span></span></span>${mode.id === current ? '<span class="sn-badge sn-badge-success"><i></i>Current</span>' : mode.status === "available" ? "" : '<span class="sn-badge sn-badge-preview">Not available yet</span>'}</div><p class="sn-body" style="margin-top:10px;font-size:13px">${esc(mode.detail)}</p>${mode.id === "private-cloud" ? '<div class="sn-cluster" style="margin-top:10px"><button type="button" class="sn-btn sn-btn-sm" data-mode-export>Export a project bundle instead</button></div>' : mode.id === "team" ? '<div class="sn-cluster" style="margin-top:10px"><button type="button" class="sn-btn sn-btn-sm" data-mode-chat>Configure a live chat room</button></div>' : ""}</div>`).join("")}</div>`);
    document.querySelector("[data-mode-export]")?.addEventListener("click", () => { studio.closeDialog(); $("#share-project-btn")?.click(); });
    document.querySelector("[data-mode-chat]")?.addEventListener("click", () => { studio.closeDialog(); $("#open-chat-btn")?.click(); setTimeout(() => $("#chat-settings-btn")?.click(), 200); });
  }
  $("#project-mode-btn").addEventListener("click", openModes);


  const vanessa = () => window.SignalNoirVanessa.workspace;
  const input = $("#vn-input");
  function autosize() { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 220)}px`; }
  const runPrompt = (prompt, options = {}) => vanessa().run(prompt, options);

  function renderWorkspace() {
    const p = project();
    if (!p) return;
    const rows = p.datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
    const mode = catalog.projectModes.find(item => item.id === p.mode) || catalog.projectModes[0];
    $("#topbar-project-name").textContent = p.name;
    $("#project-mode-label").textContent = mode.label;
    $("#vanessa-title").textContent = p.name;
    $("#vn-project-kind").textContent = p.isDemo ? "Demo project · sample data" : `${mode.label} project · ${mode.tagline}`;
    $("#vn-project-summary").textContent = p.datasets.length ? `${p.datasets.length} dataset${p.datasets.length === 1 ? "" : "s"} · ${rows.toLocaleString()} rows${p.goal ? ` · ${p.goal}` : ""}` : "No data yet. Start with a question or add data.";
    $("#vn-demo-banner").hidden = !p.isDemo;
    vanessa().renderChrome();
    renderContext();
    renderOutputs();
  }
  $("[data-ctx-add]").addEventListener("click", () => $("#vn-file").click());
  $("[data-leave-demo]").addEventListener("click", () => $("#new-project-btn").click());


  function renderContext() {
    const p = project();
    const active = studio.activeDataset();
    $("#ctx-data").innerHTML = p.datasets.length ? p.datasets.map(dataset => `<button type="button" class="ctx-dataset ${dataset.id === active?.id ? "is-active" : ""}" data-ctx-dataset="${esc(dataset.id)}" aria-pressed="${dataset.id === active?.id}"><span class="sn-card-icon" aria-hidden="true">${esc((dataset.name.split(".").pop() || "DAT").slice(0, 4).toUpperCase())}</span><span style="min-width:0"><strong>${esc(dataset.name)}</strong><small>${dataset.rows.length.toLocaleString()} rows · ${dataset.columns.length} cols</small></span>${dataset.id === active?.id ? '<span class="sn-badge sn-badge-success">Active</span>' : ""}</button>`).join("") : '<p class="ctx-empty">Drop CSV, Excel, JSON or other supported files into the Vanessa workspace, or use Add.</p>';
    const last = p.vanessaRuns[0];
    $("#ctx-workflow").innerHTML = last?.steps?.length ? `<p class="sn-muted sn-xs" style="margin-bottom:12px">${esc(last.intentLabel)} · ${esc(new Date(last.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</p>${Workflow.html(last.steps, { compact: true })}` : '<p class="ctx-empty">Ask Vanessa to perform a multi-step task. Her plan and its progress appear here.</p>';
    const findings = (last?.findings || []).slice(0, 6);
    $("#ctx-evidence").innerHTML = findings.length ? `<div class="ctx-evidence">${findings.map(item => `<button type="button" data-evidence="${esc(item.id)}"><span>${esc(item.title.length > 90 ? `${item.title.slice(0, 88)}…` : item.title)}</span><span>${item.evidence ? "⌕" : "∅"}</span></button>`).join("")}</div>` : '<p class="ctx-empty">No supporting evidence has been generated yet.</p>';
    const counts = outputCounts();
    $("#ctx-outputs").innerHTML = Object.values(counts).some(Boolean) ? `<div class="ctx-outputs">${OUTPUT_KINDS.map(kind => `<button type="button" data-ctx-kind="${kind.id}"><span>${kind.label}</span><b>${counts[kind.id] || 0}</b></button>`).join("")}</div>` : '<p class="ctx-empty">Your dashboards, reports, and findings will appear here.</p>';
    $("#ctx-activity").innerHTML = p.activities.length ? `<ul class="ctx-activity">${p.activities.slice(0, 6).map(item => `<li><span>${esc(item.text)}<small>${esc(item.at)}</small></span></li>`).join("")}</ul>` : '<p class="ctx-empty">No activity yet.</p>';
  }
  $("#studio-context").addEventListener("click", event => {
    const dataset = event.target.closest("[data-ctx-dataset]");
    if (dataset) { project().activeDatasetId = dataset.dataset.ctxDataset; studio.addActivity("Active dataset changed"); studio.renderAll(); }
    const kind = event.target.closest("[data-ctx-kind]");
    if (kind) { studio.showView("artifacts"); window.SignalNoirProjectHome?.setFilter?.(kind.dataset.ctxKind === "insight" ? "finding" : kind.dataset.ctxKind); }
  });
  $("[data-ctx-outputs]").addEventListener("click", () => studio.showView("artifacts"));


  function allOutputs() {
    const p = project();
    const list = [];
    p.findings.forEach(item => list.push({ kind: "insight", id: item.id, title: item.title, at: item.savedAt, detail: item.evidence ? `${item.evidence.dataset || ""} · ${item.evidence.method || ""}` : "No evidence", ref: item }));
    p.pinnedInsights.forEach(item => list.push({ kind: "insight", id: item.id, title: `${item.title}: ${item.subtitle || ""}`, at: Date.parse(item.at) || null, detail: `${item.dataset || ""} · pinned from Ask your data`, legacy: true }));
    p.findings.filter(item => item.chart).forEach(item => list.push({ kind: "chart", id: `chart_${item.id}`, title: item.title, at: item.savedAt, detail: item.chart.type === "line" ? "Line chart" : "Bar chart", ref: item }));
    p.outputs.forEach(item => list.push({ kind: item.kind, id: item.id, title: item.title, at: item.createdAt, detail: item.summary || "", ref: item }));
    if (p.report) list.push({ kind: "report", id: "studio-report", title: p.report.title, at: Date.parse(p.report.generatedAt), detail: `Studio report · ${p.report.dataset}`, legacy: "report" });
    p.stories.forEach(item => list.push({ kind: "report", id: item.id, title: item.title || "Executive story", at: item.createdAt || null, detail: "Story from Analyst Lab", legacy: "analyst" }));
    if (p.dashboardWidgets.length) list.push({ kind: "dashboard", id: "studio-canvas", title: "Dashboard canvas", at: p.updatedAt, detail: `${p.dashboardWidgets.length} widgets`, legacy: "dashboard" });
    p.decisions.forEach(item => list.push({ kind: "decision", id: item.id, title: item.title, at: item.createdAt, detail: [item.status, item.owner].filter(Boolean).join(" · "), legacy: "operations" }));
    p.tasks.forEach(item => list.push({ kind: "task", id: item.id, title: item.title, at: item.createdAt, detail: [item.status, item.owner, item.due].filter(Boolean).join(" · "), legacy: "operations" }));
    if (p.steps.length) list.push({ kind: "workflow", id: "studio-workflow", title: "Project workflow", at: p.updatedAt, detail: p.steps.map(step => step.name).join(" → "), legacy: "workflow" });
    p.customTools.forEach(item => list.push({ kind: "workflow", id: item.id, title: item.name, at: null, detail: item.purpose, legacy: "builder" }));
    return list;
  }
  function outputCounts() { const counts = {}; allOutputs().forEach(item => { counts[item.kind] = (counts[item.kind] || 0) + 1; }); return counts; }

  const EMPTY_OUTPUTS = {
    insight: "Save findings from Vanessa’s results and they’ll collect here with their evidence.",
    chart: "Charts attached to saved findings appear here.",
    dashboard: "Ask Vanessa to “build me a dashboard”, or use the Dashboards view.",
    report: "Ask Vanessa to “create a report”, or choose Create report under any result.",
    decision: "Decisions recorded from Vanessa’s suggestions or the Decisions & tasks view appear here.",
    task: "Tasks you add from Vanessa’s follow-ups appear here.",
    workflow: "Repeatable workflows appear here. Try “run this analysis every month”."
  };

  function renderOutputs() {
    const list = allOutputs();
    const counts = outputCounts();
    const total = list.length;
    const outputsBadge = $("#nav-outputs-count"); if (outputsBadge) outputsBadge.textContent = total ? String(total) : "";
    $("#outputs-tabs").innerHTML = OUTPUT_KINDS.map(kind => `<button type="button" class="sn-tab" role="tab" aria-selected="${kind.id === outputsTab}" data-output-tab="${kind.id}">${kind.label}<span class="sn-count">${counts[kind.id] || 0}</span></button>`).join("");
    const items = list.filter(item => item.kind === outputsTab).sort((a, b) => (b.at || 0) - (a.at || 0));
    const kind = OUTPUT_KINDS.find(entry => entry.id === outputsTab);
    $("#outputs-list").innerHTML = items.length ? items.map(item => `<div class="output-row"><span class="sn-card-icon" aria-hidden="true">${kind.icon}</span><span style="min-width:0"><strong>${esc(item.title)}</strong><small>${esc(item.detail || "")}${item.at ? ` · ${esc(new Date(item.at).toLocaleDateString())}` : ""}</small></span><span class="sn-cluster">${outputActions(item)}</span></div>`).join("")
      : `<div class="sn-empty"><div class="sn-empty-icon">${kind.icon}</div><div class="sn-empty-title">No ${kind.label.toLowerCase()} yet</div><div class="sn-empty-text">${EMPTY_OUTPUTS[outputsTab]}</div><div class="sn-empty-actions"><button type="button" class="sn-btn sn-btn-sm" data-goto-vanessa>Ask Vanessa</button></div></div>`;
  }
  function outputActions(item) {
    if (item.kind === "insight" || item.kind === "chart") return item.ref ? `${Evidence.button(item.ref)}` : '<button type="button" class="sn-btn sn-btn-sm" data-goto="overview">Open</button>';
    if (item.legacy) return `<button type="button" class="sn-btn sn-btn-sm" data-goto="${esc(item.legacy)}">Open</button>`;
    if (item.kind === "report" || item.kind === "dashboard") return `<button type="button" class="sn-btn sn-btn-sm" data-open-output="${esc(item.id)}">Open</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-download-output="${esc(item.id)}">Download</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-delete-output="${esc(item.id)}" aria-label="Delete ${esc(item.title)}">Delete</button>`;
    if (item.kind === "workflow") return '<button type="button" class="sn-btn sn-btn-sm" data-goto="workflow">Open</button>';
    return "";
  }
  $("#view-outputs").addEventListener("click", event => {
    const tab = event.target.closest("[data-output-tab]");
    if (tab) { outputsTab = tab.dataset.outputTab; renderOutputs(); $(`[data-output-tab="${outputsTab}"]`)?.focus(); return; }
    if (event.target.closest("[data-goto-vanessa]")) { studio.showView("vanessa"); input.focus(); }
    const go = event.target.closest("[data-goto]");
    if (go) studio.showView(go.dataset.goto);
    const download = event.target.closest("[data-download-output]");
    if (download) downloadOutput(download.dataset.downloadOutput);
    const remove = event.target.closest("[data-delete-output]");
    if (remove && confirm("Delete this output from the project?")) { project().outputs = project().outputs.filter(item => item.id !== remove.dataset.deleteOutput); studio.addActivity("Output deleted"); studio.saveProject(true); renderOutputs(); renderContext(); }
  });
  $("#outputs-tabs").addEventListener("keydown", event => {
    if (!["ArrowRight", "ArrowLeft"].includes(event.key)) return;
    const index = OUTPUT_KINDS.findIndex(kind => kind.id === outputsTab);
    outputsTab = OUTPUT_KINDS[(index + (event.key === "ArrowRight" ? 1 : OUTPUT_KINDS.length - 1)) % OUTPUT_KINDS.length].id;
    renderOutputs(); $(`[data-output-tab="${outputsTab}"]`)?.focus();
  });


  const DOC_CSS = `body{margin:0;background:#f6f5f8;color:#16121e;font:15px/1.6 Inter,system-ui,-apple-system,sans-serif}main{max-width:900px;margin:0 auto;padding:48px 28px}h1{font:600 34px/1.15 Georgia,serif;letter-spacing:-.02em;margin:8px 0 12px}h2{font-size:18px;margin:36px 0 12px}.eyebrow{color:#6e6779;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}.summary{font-size:17px;color:#2a2433}.finding{border:1px solid #e3dfea;border-radius:12px;background:#fff;padding:16px 18px;margin:10px 0}.finding p{margin:0 0 10px;font-weight:600}dl{display:grid;grid-template-columns:130px 1fr;margin:0;font-size:13px;border-top:1px solid #eee}dt,dd{margin:0;padding:7px 0;border-bottom:1px solid #eee}dt{color:#6e6779;font-size:11px;text-transform:uppercase;letter-spacing:.08em}pre{margin:0;white-space:pre-wrap;font:12.5px/1.5 ui-monospace,Menlo,monospace}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.kpi{background:#fff;border:1px solid #e3dfea;border-radius:12px;padding:14px}.kpi span{display:block;color:#6e6779;font-size:11px;text-transform:uppercase;letter-spacing:.1em}.kpi strong{font-size:22px}.chart{background:#fff;border:1px solid #e3dfea;border-radius:12px;padding:16px;margin:10px 0}.sn-bars{display:grid;gap:8px}.sn-bar-row{display:grid;grid-template-columns:140px 1fr auto;gap:10px;align-items:center;font-size:12.5px}.sn-bar-track{height:8px;border-radius:9px;background:#efecf4;position:relative;overflow:hidden}.sn-bar-fill{position:absolute;inset:0 auto 0 0;border-radius:9px;background:#c42aa9}.sn-bar-fill.is-negative{background:#c93a3a}.sn-bar-fill.is-positive{background:#13925a}.sn-chart svg{width:100%;height:auto}.sn-grid-line{stroke:#eee}.sn-series{fill:none;stroke:#c42aa9;stroke-width:2}.sn-series-2{fill:none;stroke:#6b55f0;stroke-width:2;stroke-dasharray:5 4}.sn-band{fill:rgba(107,85,240,.12)}.sn-chart text{fill:#6e6779;font:10.5px ui-monospace,Menlo,monospace}footer{margin-top:48px;color:#6e6779;font-size:12px;border-top:1px solid #e3dfea;padding-top:16px}@media print{body{background:#fff}}`;

  function findingDoc(item) {
    const ev = item.evidence;
    return `<div class="finding"><p>${esc(item.title)}</p>${ev ? `<dl><dt>Source</dt><dd>${esc(ev.dataset || "")}</dd><dt>Rows used</dt><dd>${esc(ev.rows ?? "")}${ev.rowsTotal != null ? ` of ${esc(ev.rowsTotal)}` : ""}</dd><dt>Filters</dt><dd>${esc((ev.filters || []).join("; ") || "None")}</dd><dt>Calculation</dt><dd><pre>${esc(ev.calculation || "")}</pre></dd><dt>Method</dt><dd>${esc(ev.method || "")}</dd><dt>Validation</dt><dd>${esc(Evidence.VALIDATION[Evidence.validationOf(item)].label)}</dd></dl>` : "<em>No supporting evidence was generated for this statement.</em>"}</div>`;
  }

  function outputDocument(output, { standalone = true } = {}) {
    const p = project();
    const kpis = output.spec?.kpis?.length ? `<div class="kpis">${output.spec.kpis.map(kpi => `<div class="kpi"><span>${esc(kpi.label)}</span><strong>${esc(kpi.value)}</strong></div>`).join("")}</div>` : "";
    const charts = (output.spec?.charts || (output.visual ? [output.visual] : [])).map(chart => `<div class="chart"><div class="eyebrow">${esc(chart.title)}</div>${window.SignalNoirVanessa.cards.chartHtml(chart.chart)}</div>`).join("");
    const body = `<main><div class="eyebrow">${esc(output.kind === "dashboard" ? "Dashboard" : "Report")} · ${esc(p.name)}${p.isDemo ? " · sample data" : ""}</div><h1>${esc(output.title)}</h1>${output.summary ? `<p class="summary">${esc(output.summary)}</p>` : ""}${kpis}${charts}${output.findings?.length ? `<h2>Findings and evidence</h2>${output.findings.map(findingDoc).join("")}` : ""}<footer>Generated by Signal Noir on ${esc(new Date(output.createdAt).toLocaleString())}. Every number was calculated on-device from the listed source rows; no language model produced these figures.${output.prompt ? ` Request: “${esc(output.prompt)}”.` : ""}</footer></main>`;
    return standalone ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(output.title)}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>` : body;
  }

  function downloadOutput(id) {
    const output = project().outputs.find(item => item.id === id);
    if (!output) return;
    studio.download(`${studio.slug(output.title)}.html`, outputDocument(output), "text/html");
    studio.toast(`${output.kind === "dashboard" ? "Dashboard" : "Report"} downloaded as HTML.`);
  }

  function openOutput(id) {
    const output = project().outputs.find(item => item.id === id);
    if (!output) return;
    studio.dialog(`<div class="sn-cluster" style="justify-content:space-between;margin-bottom:12px"><span class="eyebrow">${esc(output.kind)} · saved in Outputs</span><span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-dialog-download="${esc(output.id)}">Download HTML</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-dialog-print>Print / PDF</button></span></div><iframe title="${esc(output.title)}" style="width:100%;height:min(70vh,760px);border:1px solid var(--sn-line);border-radius:12px;background:#fff" title="Exported documents are light-themed by design" sandbox="allow-same-origin allow-modals"></iframe>`);
    const frame = document.querySelector(".dialog-card iframe");
    frame.srcdoc = outputDocument(output);
    document.querySelector("[data-dialog-download]").addEventListener("click", () => downloadOutput(output.id));
    document.querySelector("[data-dialog-print]").addEventListener("click", () => frame.contentWindow?.print());
  }


  async function openDemo(prompt) {
    let demo = studio.state.projects.find(item => item.isDemo);
    if (demo) studio.selectProject(demo.id);
    else {
      const data = SN.demo.build();
      demo = await studio.createProject(data.name, { isDemo: true, goal: data.goal, datasets: data.datasets, activeDatasetId: data.datasets[0].id, activities: [{ text: "Demo project created with generated sample data", at: studio.nowLabel() }] });
      seedDemoOperations(demo);
      await studio.saveProject(true);
    }
    studio.showView("vanessa");
    renderWorkspace();
    if (prompt || !project().vanessaRuns.length) await runPrompt(prompt || SN.demo.build().starterPrompt);
  }


  function seedDemoOperations(demo) {
    const O = SN.operations;
    if (!O) return;
    const dataset = demo.datasets[0];
    const workflow = O.workflows.create(demo, {
      name: "Weekly revenue review",
      description: "Validate the export, compare with the previous period, save what changed and prepare a summary.",
      steps: [
        { type: "require-data" },
        { type: "check-rows", args: { minRows: 10 } },
        { type: "quality-check" },
        { type: "compare-periods", args: { measure: "revenue" } },
        { type: "save-finding" },
        { type: "build-report" }
      ]
    });
    O.automations.create(demo, {
      name: "Monday revenue review", description: "Runs before the Monday meeting.",
      workflowId: workflow.id, triggerType: "local-schedule",
      schedule: O.scheduler.makeSchedule({ frequency: "weekly", day: 1, hour: 8 }),
      datasetId: dataset.id
    });
    O.monitors.create(demo, {
      name: "Revenue drop watch", kind: "metric-threshold", datasetId: dataset.id,
      measure: "revenue", aggregate: "sum", op: "pct_change_below", threshold: 5, severity: "warning"
    });

    try { O.runs.execute(demo, { workflowId: workflow.id, triggerType: "manual", triggeredBy: "Demo setup" }); }
    catch (error) { console.error("[demo] operations seed run failed", error); }
  }


  async function takeHandoff() {
    const platform = SN.platform;
    const payload = platform?.handoff.take();
    if (!payload) return;
    if (payload.openDemo) return openDemo(payload.prompt);
    if (payload.openProject) { if (studio.selectProject(payload.openProject)) studio.showView("vanessa"); return; }
    if (payload.context || payload.dataset) {

      let files = [];
      try { if (payload.stash) files = await platform.workspace.takeStash(); } catch (error) { studio.toast("Couldn’t read the handed-over data. Add it again here."); }
      const p = project();
      if (files.length && (p.isDemo || p.datasets.length || p.vanessaRuns.length)) await studio.createProject(`${payload.context?.sourceLabel || "Tool"} · ${files[0].name.replace(/\.[a-z0-9]+$/i, "")}`);
      if (files.length) await studio.addFiles(files);
      studio.showView("vanessa");
      if (payload.context) vanessa().addContext(payload.context);
      renderWorkspace();
      if (payload.prompt) { input.value = payload.prompt; autosize(); input.focus(); }
      return;
    }
    let files = [];
    try {
      if (payload.stash) files = await platform.workspace.takeStash();
      else if (payload.importWorkspace) { const record = await platform.workspace.get(); if (record) files = [platform.workspace.makeFile(record)]; }
    } catch (error) { studio.toast("Couldn’t read the hand-off files. Add them again here."); }
    if (files.length) {
      const p = project();
      const reuse = !p.isDemo && !p.datasets.length && !p.vanessaRuns.length;
      if (!reuse) await studio.createProject(files.length === 1 ? `Analysis · ${files[0].name.replace(/\.[a-z0-9]+$/i, "")}` : `Analysis · ${new Date().toLocaleDateString()}`);
      await studio.addFiles(files);
    }
    renderWorkspace();
    if (!payload.prompt && payload.intent && catalog.intent(payload.intent)) {
      input.value = catalog.intent(payload.intent).starter; autosize(); input.focus();
      if (files.length) studio.toast(`${files[0].name} is ready. Press Run, or ask something else.`);
    }
    if (payload.prompt) {
      if (project().isDemo && !files.length) await studio.createProject("New analysis");
      input.value = payload.prompt; autosize();
      if (project().datasets.length) { input.value = ""; await runPrompt(payload.prompt, { intent: payload.intent || undefined }); }
      else { studio.toast("Add your data and press Run. Your request is ready."); input.focus(); }
    }
  }


  window.addEventListener("datahub:project-render", () => { renderWorkspace(); syncNavGroups(); });
  window.addEventListener("vanessa:run-complete", () => { renderContext(); renderOutputs(); });
  window.addEventListener("vanessa:outputs-changed", () => { renderContext(); renderOutputs(); });
  const domReady = new Promise(resolve => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", resolve, { once: true }) : resolve());

  Promise.all([studio.ready, domReady]).then(async () => {
    applyStoredContext();

    studio.renderAll();
    syncNavGroups();
    await takeHandoff();
  });

  window.SignalNoirStudio = { openDemo, openOutput, run: runPrompt, renderWorkspace };
})();
