


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  const NS = window.SignalNoirVanessa;
  if (!studio || !NS?.executor || !NS?.cards) return;
  const esc = studio.escapeHtml;
  const $ = selector => document.querySelector(selector);
  const project = () => studio.state.project;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;


  const access = () => window.SignalNoir?.access;
  const can = id => !access() || access().can(id);
  const QUICK = [
    ["Analyze data", "Analyze this dataset", "analysis.basic"], ["Clean data", "Clean this dataset", "data.clean"], ["Compare files", "Compare these files", "data.transform"],
    ["Find patterns", "Find anything unusual", "analysis.advanced"], ["Build dashboard", "Build me a dashboard", "dashboards.create"], ["Create report", "Create a report for my manager", "reports.create"],
    ["Forecast", "Forecast the next six months", "analysis.advanced"], ["Run statistics", "Run the appropriate statistical test", "analysis.advanced"], ["Automate", "Run this analysis every month", "workflows.create"]
  ];
  const history = [];
  let historyIndex = -1;

  const input = $("#vn-input"), form = $("#vn-form"), fileInput = $("#vn-file"), viewEl = $("#view-vanessa"), feed = $("#vn-feed");


  function shell(record) {
    const article = document.createElement("article");
    article.className = "vn-run";
    article.id = `run-${record.id}`;
    article.setAttribute("aria-label", `Request: ${record.prompt}`);
    article.innerHTML = `<div class="vn-ask"><p>${esc(record.prompt)}</p><time datetime="${new Date(record.createdAt).toISOString()}">${new Date(record.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>
      <div class="vn-reply">${NS.cards.headerHtml(record)}<div class="vn-reply-grid"><div class="vn-plan"><p class="sn-eyebrow">Plan</p><div class="vn-workflow"></div><div class="vn-toollog-slot"></div></div><div class="vn-results"><div class="vn-thinking" role="status"><span class="sn-spinner" aria-hidden="true"></span><span data-live>Reading the request…</span></div></div></div></div>`;
    return article;
  }

  function liveUi() {
    let node = null, flow = null;
    return {
      start(record) { node = shell(record); feed.appendChild(node); viewEl.classList.add("has-runs"); $("#vn-empty").innerHTML = ""; setRunning(true); node.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); },
      plan(plan) {
        flow = SN.Workflow.create(node.querySelector(".vn-workflow"), { steps: plan.steps.map(step => ({ id: step.id, label: `${step.stage} · ${step.label}`, status: "pending" })) });
        return flow;
      },
      status(text) { const live = node?.querySelector("[data-live]"); if (live) live.textContent = text; },
      finish(record) { renderRunInto(node, record, { keepFlow: flow }); setRunning(false); announce(record); }
    };
  }

  function renderRunInto(node, record, { keepFlow } = {}) {
    node.querySelector(".vn-reply-head").outerHTML = NS.cards.headerHtml(record);
    if (!keepFlow) {
      if (record.steps?.length) SN.Workflow.create(node.querySelector(".vn-workflow"), { steps: record.steps }).el.removeAttribute("aria-live");
      else { node.querySelector(".vn-plan").remove(); node.querySelector(".vn-reply-grid").classList.add("is-single"); }
    } else if (!record.steps?.length) { node.querySelector(".vn-plan")?.remove(); node.querySelector(".vn-reply-grid").classList.add("is-single"); }
    const slot = node.querySelector(".vn-toollog-slot");
    if (slot) slot.innerHTML = NS.cards.toolLogHtml(record);
    node.querySelector(".vn-results").innerHTML = NS.cards.resultsHtml(record);
  }

  function announce(record) {
    const region = $("#vn-announcer");
    if (region) region.textContent = `Vanessa ${record.status === "complete" ? "finished" : record.status === "waiting" ? "needs your input" : record.status}: ${record.summary?.slice(0, 160) || record.intentLabel}`;
  }

  function setRunning(on) {
    const button = $("#vn-submit");
    button.dataset.mode = on ? "stop" : "run";
    button.innerHTML = on ? '<span class="sn-spinner" aria-hidden="true"></span> Stop' : 'Run <span aria-hidden="true">↵</span>';
    button.setAttribute("aria-label", on ? "Stop Vanessa" : "Run request");
    document.body.classList.toggle("vn-running", on);
  }


  async function run(prompt, options = {}) {
    if (NS.executor.isRunning()) { studio.toast("Vanessa is still working. Stop the current request first."); return null; }
    studio.showView("vanessa");
    history.unshift(prompt); historyIndex = -1;
    const record = await NS.executor.run(prompt, { ui: liveUi(), ...options });
    renderChrome();
    return record;
  }

  async function importFiles(files) {
    const list = Array.from(files || []).filter(file => file.size <= 50 * 1024 * 1024);
    if (!list.length) return [];
    if (project().isDemo) {
      await studio.createProject(list.length === 1 ? `Analysis · ${list[0].name.replace(/\.[a-z0-9]+$/i, "")}` : "New analysis");
      studio.toast("Started a new project so your data stays separate from the demo.");
    }
    const added = await studio.addFiles(list);
    if (added.length) NS.context.setFocus({ datasetId: added[0].id });
    renderChrome();
    return added;
  }


  function addContext(context) {
    NS.context.startConversation(`From ${context.sourceLabel || context.source}`);
    const conv = NS.context.conversation();
    const record = { id: studio.uid("run"), conversationId: conv.id, prompt: `Context from ${context.sourceLabel || context.source}`, createdAt: Date.now(), status: "complete", intent: "context", intentLabel: "Handoff", steps: [], toolLog: [], blocks: [{ type: "context", ...context }], findings: [], summary: "", followups: context.suggestedPrompt ? [{ label: context.suggestedPrompt, prompt: context.suggestedPrompt }] : [] };
    project().vanessaRuns.unshift(record);
    studio.markDirty();
    renderFeed(); renderChrome();
  }


  function renderFeed() {
    const conv = NS.context.conversation();
    const runs = (project()?.vanessaRuns || []).filter(record => record.conversationId === conv?.id).slice().reverse();
    feed.innerHTML = "";
    runs.forEach(record => { const node = shell(record); feed.appendChild(node); renderRunInto(node, record); });
  }

  function suggestions() {
    const dataset = NS.context.resolveDataset("").dataset;
    const f = NS.context.focus();
    if (!dataset) return [];
    const prof = NS.context.profileOf(dataset);
    const measure = f.measure || window.SignalNoir.analysis.pickMeasure(prof, "");
    const dimension = prof.dimensions[0];
    return [
      "What is in this file?",
      measure && prof.times.length && `Why did ${measure.replace(/_/g, " ")} change last month?`,
      measure && dimension && `Which ${dimension.replace(/_/g, " ")} performed worst?`,
      prof.measures.length > 1 && "Which numeric column has the highest average?",
      can("data.transform") && project().datasets.length > 1 && "Compare these files",
      can("analysis.advanced") && measure && prof.times.length && `Forecast ${measure.replace(/_/g, " ")} for the next quarter`,
      can("reports.create") && "Create a report for my manager",
      can("dashboards.create") && "Build me a dashboard"
    ].filter(Boolean).slice(0, 4);
  }

  function renderChrome() {
    const p = project();
    if (!p) return;
    NS.context.ensureProjectShape();
    const conv = NS.context.conversation();
    const runs = p.vanessaRuns.filter(record => record.conversationId === conv.id);
    viewEl.classList.toggle("has-runs", runs.length > 0);

    $("#vn-conversations").innerHTML = p.vanessaConversations.map(item => `<option value="${esc(item.id)}" ${item.id === conv.id ? "selected" : ""}>${esc(item.title)} · ${p.vanessaRuns.filter(record => record.conversationId === item.id).length}</option>`).join("");

    const resolved = NS.context.resolveDataset("");
    $("#vn-scope").innerHTML = `<option value="">${resolved.dataset && !conv.selectedDatasetId ? `Auto · ${esc(resolved.dataset.name)}` : "Auto"}</option>${p.datasets.map(dataset => `<option value="${esc(dataset.id)}" ${dataset.id === conv.selectedDatasetId ? "selected" : ""}>${esc(dataset.name)} (${dataset.rows.length.toLocaleString()})</option>`).join("")}`;
    $("#vn-scope").disabled = !p.datasets.length;

    const provider = SN.providers?.preferred();
    $("#vn-provider").innerHTML = `<span class="sn-dot ${provider?.kind === "llm" ? "sn-dot-accent" : ""}" aria-hidden="true"></span>${provider?.kind === "llm" ? esc(provider.label) : "Rules engine"} · local`;

    $("#vn-empty").innerHTML = runs.length ? "" : `<div class="vn-hello"><div class="vn-avatar-lg" aria-hidden="true">V</div><h2>${p.datasets.length ? "What are you trying to accomplish?" : "Start with a question or add data."}</h2><p>${p.datasets.length ? `I can work with ${p.datasets.map(dataset => esc(dataset.name)).slice(0, 3).join(", ")}${p.datasets.length > 3 ? "…" : ""}. Describe the outcome; I’ll plan it, run Signal Noir’s tools on this device and show the evidence.` : "Describe what you need and add the files you have. I’ll plan the work, run it on this device and show my evidence."}</p></div>
      ${p.datasets.length ? `<div class="vn-suggest-grid">${suggestions().map(text => `<button type="button" class="sn-card is-interactive" data-vn-prompt="${esc(text)}"><span class="sn-card-title">${esc(text)}</span></button>`).join("")}</div>` : `<div class="vn-dropzone" data-vn-drop tabindex="0" role="button" aria-label="Add data files"><strong>Drop CSV, Excel, JSON or other supported files here</strong><span>or click to choose · files are read in this browser and never uploaded</span></div>`}
      ${!p.isDemo && !p.datasets.length ? '<p class="sn-muted sn-small" style="text-align:center;margin-top:18px">New here? <button type="button" class="sn-link" data-open-demo>Open the demo project</button> to watch Vanessa work.</p>' : ""}`;
    $("#vn-quick").innerHTML = QUICK.filter(([, , capability]) => can(capability)).map(([label, prompt]) => `<button type="button" class="sn-chip sn-chip-sm" data-vn-prompt="${esc(prompt)}">${esc(label)}</button>`).join("");
    renderContextExtras();
  }

  function renderContextExtras() {
    const f = NS.context.focus();
    const dataset = NS.context.datasetById(f.datasetId);
    const parts = [dataset && ["Dataset", dataset.name], f.measure && ["Measure", f.measure], f.dimension && ["Grouped by", f.dimension], f.time && ["Timeline", `${f.time}${f.grain ? ` · ${f.grain}` : ""}`], f.filters?.length && ["Filters", f.filters.map(window.SignalNoir.analysis.describeFilter).join(", ")], f.subject && ["Subject", f.subject]].filter(Boolean);
    const focusEl = $("#ctx-focus");
    if (focusEl) focusEl.innerHTML = parts.length ? `<dl class="ctx-kv">${parts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl><button type="button" class="sn-link sn-xs" data-clear-focus>Clear focus</button>` : '<p class="ctx-empty">Nothing yet. When you ask about a number, Vanessa keeps track of it here so “why?” and “chart that” work.</p>';
    const memEl = $("#ctx-memory");
    if (memEl) {
      const list = NS.context.memory();
      memEl.innerHTML = (list.length ? `<ul class="ctx-memory">${list.map(item => `<li><span><strong>${esc(item.label)}</strong><small>${esc(item.key === "preferred-dataset" ? NS.context.datasetById(item.value)?.name || "missing dataset" : item.key === "fiscal-year-start" ? new Date(2020, Number(item.value) - 1, 1).toLocaleString([], { month: "long" }) : item.value)} · ${esc(item.kind)}</small></span><button type="button" class="sn-btn sn-btn-ghost sn-btn-icon sn-btn-sm" data-forget="${esc(item.id)}" aria-label="Forget ${esc(item.label)}">✕</button></li>`).join("")}</ul>` : '<p class="ctx-empty">Definitions and preferences Vanessa should reuse appear here. Try “Remember that our fiscal year starts in July”.</p>') + `<button type="button" class="sn-link sn-xs" data-add-memory>Add a note</button>`;
    }
  }


  async function openProviders() {
    const list = await SN.providers.detectAll();
    const current = SN.providers.preferred();
    const badge = provider => provider.status === "available" ? '<span class="sn-badge sn-badge-success">Available</span>' : provider.status === "planned" ? '<span class="sn-badge sn-badge-preview">Planned</span>' : provider.status === "requires-user" ? '<span class="sn-badge sn-badge-warning">Needs setup</span>' : '<span class="sn-badge sn-badge-muted">Not found</span>';
    studio.dialog(`<span class="eyebrow">How Vanessa thinks</span><h2>Reasoning provider</h2><p class="muted">Calculations always run in Signal Noir’s engine. A model is optional and only helps route unclear requests and write labeled interpretations. It receives column names, types and calculated results, never your rows.</p>
      <div class="sn-stack" style="--sn-stack-gap:8px;margin-top:16px" role="radiogroup" aria-label="Reasoning provider">${list.map(provider => `<label class="sn-panel vn-provider-row"><input type="radio" name="vn-provider" value="${provider.id}" ${provider.id === current.id ? "checked" : ""} ${provider.status === "available" ? "" : "disabled"}><span><strong>${esc(provider.label)}</strong> ${badge(provider)} <span class="sn-badge">${provider.locality === "remote" ? "Leaves device" : "On device"}</span><br><small class="sn-muted">${esc(provider.description)}${provider.model ? ` Model: ${esc(provider.model)}.` : ""}</small></span></label>`).join("")}</div>
      <div class="action-row" style="justify-content:flex-end;margin-top:16px"><button class="button primary" id="vn-provider-save">Use selected</button></div>`);
    $("#vn-provider-save").onclick = () => { const chosen = document.querySelector('input[name="vn-provider"]:checked')?.value || "rules"; SN.providers.choose(chosen); studio.closeDialog(); renderChrome(); renderFeed(); studio.toast(`Vanessa will use ${SN.providers.preferred().label}.`); };
  }


  function autosize() { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 220)}px`; }
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
    else if (event.key === "Escape" && NS.executor.isRunning()) { event.preventDefault(); NS.executor.cancel(); }
    else if (event.key === "ArrowUp" && !input.value && history.length) { event.preventDefault(); historyIndex = Math.min(historyIndex + 1, history.length - 1); input.value = history[historyIndex]; autosize(); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (NS.executor.isRunning()) { NS.executor.cancel(); return; }
    const prompt = input.value.trim();
    if (!prompt) { input.focus(); return; }
    input.value = ""; autosize();
    await run(prompt);
    input.focus();
  });
  $("#vn-scope").addEventListener("change", event => { const conv = NS.context.conversation(); conv.selectedDatasetId = event.target.value || null; if (conv.selectedDatasetId) NS.context.setFocus({ datasetId: conv.selectedDatasetId }); studio.markDirty(); renderChrome(); });
  $("#vn-conversations").addEventListener("change", event => { NS.context.selectConversation(event.target.value); renderFeed(); renderChrome(); });
  $("#vn-new-conversation").addEventListener("click", () => { NS.context.startConversation(); studio.markDirty(); renderFeed(); renderChrome(); input.focus(); studio.toast("New conversation. Your data and outputs are unchanged."); });
  $("#vn-provider").addEventListener("click", openProviders);
  $("#vn-attach").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => { await importFiles(fileInput.files); fileInput.value = ""; input.focus(); });

  let dragDepth = 0;
  viewEl.addEventListener("dragenter", event => { if (!event.dataTransfer?.types?.includes("Files")) return; event.preventDefault(); dragDepth += 1; document.body.classList.add("vn-dragging"); form.classList.add("is-dragging"); });
  viewEl.addEventListener("dragover", event => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault(); });
  viewEl.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { document.body.classList.remove("vn-dragging"); form.classList.remove("is-dragging"); } });
  viewEl.addEventListener("drop", async event => { event.preventDefault(); dragDepth = 0; document.body.classList.remove("vn-dragging"); form.classList.remove("is-dragging"); if (event.dataTransfer.files.length) await importFiles(event.dataTransfer.files); });
  viewEl.addEventListener("keydown", event => { if (event.target.closest("[data-vn-drop]") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); fileInput.click(); } });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && studio.state.activeView === "vanessa") { event.preventDefault(); input.focus(); }
    if (event.key === "Escape" && NS.executor.isRunning()) NS.executor.cancel();
  });


  function datasetCsv(dataset) {
    const cell = value => { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
    return [dataset.columns.map(cell).join(","), ...dataset.rows.map(row => dataset.columns.map(column => cell(row[column])).join(","))].join("\n");
  }

  async function openInTool(toolId) {
    const platform = SN.platform;
    const dataset = NS.context.resolveDataset("").dataset;
    if (platform && dataset) {
      try { await platform.workspace.set(new File([datasetCsv(dataset)], `${dataset.name.replace(/\.[a-z0-9]+$/i, "")}.csv`, { type: "text/csv" })); }
      catch (error) { studio.toast("Couldn’t hand the data over; load it in the tool manually."); }
    }
    await studio.saveProject(true);
    platform ? platform.navigate(platform.url(`tools/${toolId}/index.html`)) : (location.href = `../${toolId}/index.html`);
  }

  function findRun(id) { return project().vanessaRuns.find(item => item.id === id) || null; }
  function findFinding(id) {
    for (const record of project().vanessaRuns) { const hit = record.findings?.find(item => item.id === id); if (hit) return hit; }
    for (const output of project().outputs) { const hit = output.findings?.find(item => item.id === id); if (hit) return hit; }
    return project().findings.find(item => item.id === id) || null;
  }

  document.addEventListener("click", async event => {
    const target = event.target.closest("button, a[data-open-tool]");
    if (!target) return;
    if (target.closest("#studio-context")) {
      if (target.dataset.forget) { NS.context.forget(target.dataset.forget); renderContextExtras(); studio.saveProject(true); }
      if (target.matches("[data-clear-focus]")) { NS.context.clearFocus(); renderContextExtras(); }
      if (target.matches("[data-add-memory]")) { input.value = "Remember that "; studio.showView("vanessa"); input.focus(); }
      return;
    }
    if (!target.closest("#view-vanessa, .sn-drawer, .dialog-card")) return;
    const p = project();
    if (target.dataset.vnPrompt !== undefined) {
      if (target.dataset.vnRemember) { try { NS.context.remember({ ...JSON.parse(target.dataset.vnRemember), source: "user" }); } catch (error) {                        } }
      const prompt = target.dataset.vnPrompt;
      if (!prompt || /\s$/.test(prompt)) { input.value = prompt; input.focus(); autosize(); return; }
      run(prompt);
      return;
    }
    if (target.dataset.vnAction === "attach") fileInput.click();
    if (target.dataset.saveFinding) {
      const item = findFinding(target.dataset.saveFinding);
      if (!item) return;
      const index = p.findings.findIndex(entry => entry.id === item.id);
      if (index >= 0) p.findings.splice(index, 1); else p.findings.unshift({ ...item, savedAt: Date.now(), runId: target.dataset.run });
      target.setAttribute("aria-pressed", String(index < 0)); target.textContent = index < 0 ? "Saved" : "Save";
      studio.saveProject(true);
      window.dispatchEvent(new CustomEvent("vanessa:outputs-changed"));
    }
    if (target.dataset.findingTask) {
      const item = findFinding(target.dataset.findingTask);
      if (!item || p.tasks.some(task => task.findingId === item.id)) { studio.toast("That finding is already a task."); return; }
      p.tasks.unshift({ id: studio.uid("task"), title: `Follow up: ${item.title}`.slice(0, 180), owner: localStorage.getItem("datahub_chat_name") || "Unassigned", due: "", priority: "Medium", status: "Open", createdAt: Date.now(), source: "vanessa", findingId: item.id });
      studio.addActivity("Task created from a finding"); studio.saveProject(true);
      target.textContent = "Task added"; target.disabled = true;
      window.dispatchEvent(new CustomEvent("vanessa:outputs-changed"));
    }
    if (target.dataset.applyCleaning) {
      const box = document.querySelector(`[data-cleaning="${target.dataset.applyCleaning}"]`);
      const fixes = Array.from(box.querySelectorAll("input:checked")).map(check => check.value);
      if (!fixes.length) { studio.toast("Choose at least one fix."); return; }
      const dataset = p.datasets.find(item => item.id === target.dataset.dataset);
      target.disabled = true;
      await run(`Apply ${fixes.length} cleaning fix${fixes.length === 1 ? "" : "es"} to ${dataset?.name || "the dataset"}`, { overrides: { datasetId: target.dataset.dataset }, route: { kind: "plan", intent: "confirmed", label: "Apply fixes (confirmed)", confidence: 1, reason: "you confirmed these fixes", steps: [{ tool: "clean_dataset", args: { fixes, datasetId: target.dataset.dataset } }] } });
    }
    if (target.dataset.createNext) {
      const [runId, index] = target.dataset.createNext.split(":");
      const record = findRun(runId);
      const item = (record?.blocks?.find(block => block.type === "next") || record?.extras?.find(extra => extra.type === "next"))?.items[Number(index)];
      if (!item) return;
      const owner = localStorage.getItem("datahub_chat_name") || "Unassigned";
      if (item.kind === "task") p.tasks.unshift({ id: studio.uid("task"), title: item.title, owner, due: "", priority: "Medium", status: "Open", createdAt: Date.now(), source: "vanessa" });
      else p.decisions.unshift({ id: studio.uid("decision"), title: item.title, owner, evidence: record.summary || "Vanessa analysis", status: "Proposed", createdAt: Date.now(), source: "vanessa" });
      studio.addActivity(`${item.kind === "task" ? "Task" : "Decision"} added from Vanessa`);
      await studio.saveProject(true);
      target.disabled = true; target.textContent = "Added";
      window.dispatchEvent(new CustomEvent("vanessa:outputs-changed"));
    }
    if (target.dataset.interpret) {
      target.disabled = true; target.innerHTML = '<span class="sn-spinner" aria-hidden="true"></span> Interpreting…';
      try { await NS.executor.interpret(target.dataset.interpret); renderFeed(); }
      catch (error) { console.error("[vanessa] interpretation failed", error); studio.toast("The local model didn’t respond, so no interpretation was added."); target.disabled = false; target.textContent = "Interpret with local model"; }
    }
    if (target.dataset.openOutput) window.SignalNoirStudio?.openOutput(target.dataset.openOutput);
    if (target.dataset.openTool) { event.preventDefault(); openInTool(target.dataset.openTool); }
    if (target.dataset.goto) studio.showView(target.dataset.goto);
    if (target.matches("[data-open-demo]")) window.SignalNoirStudio?.openDemo();
    if (target.closest("[data-vn-drop]")) fileInput.click();
  });

  $("#vn-quick-toggle")?.addEventListener("click", event => { const open = event.currentTarget.getAttribute("aria-expanded") !== "true"; event.currentTarget.setAttribute("aria-expanded", String(open)); $("#vn-quick").hidden = !open; });
  window.addEventListener("datahub:project-render", () => { NS.context.ensureProjectShape(); renderFeed(); renderChrome(); });
  window.addEventListener("vanessa:run-complete", renderContextExtras);
  SN.Evidence?.bind(document.body, findFinding);
  SN.providers?.detectAll().then(renderChrome);

  NS.workspace = { run, importFiles, addContext, renderFeed, renderChrome, findFinding, chartHtml: NS.cards.chartHtml, datasetCsv, isRunning: () => NS.executor.isRunning() };
})();
