


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  const NS = window.SignalNoirVanessa;
  const A = SN.analysis;
  if (!studio || !NS?.planner || !A) return;
  const RUN_LIMIT = 60;
  let current = null;

  const debug = () => { try { return SN.debug || localStorage.getItem("sn_debug") === "1"; } catch (error) { return false; } };

  const log = (...args) => { if (debug()) console.debug("[vanessa]", ...args); };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
  const pause = ms => new Promise(resolve => setTimeout(resolve, reduced() ? 0 : ms));
  const project = () => studio.state.project;

  function environment(prompt, overrides = {}) {
    const p = NS.context.ensureProjectShape();
    const focus = NS.context.focus();
    const resolved = overrides.datasetId ? { dataset: NS.context.datasetById(overrides.datasetId), reason: "requested" } : NS.context.resolveDataset(prompt);
    const dataset = resolved.dataset;
    const prof = dataset ? NS.context.profileOf(dataset) : null;
    const conv = NS.context.conversation();
    const runs = p.vanessaRuns.filter(run => run.conversationId === conv.id);
    return {
      project: p, focus, dataset, datasetReason: resolved.reason, prof, text: prompt.toLowerCase(),
      entities: NS.router.entities(prompt, dataset), datasetCount: p.datasets.length,
      hasTime: Boolean(prof?.times.length || (dataset && NS.context.memoryValue(`time-column:${dataset.id}`))),
      lastRun: runs.find(run => run.intent !== "clarify"), conversationFindings: runs.reduce((sum, run) => sum + (run.findings?.length || 0), 0)
    };
  }


  function prepared(dataset, state) {
    const key = `${dataset.id}:${dataset.rows.length}`;
    if (!state.prepared[key]) {
      const audit = A.qualityAudit(dataset);
      const safe = audit.issues.filter(issue => issue.safe).map(issue => issue.id);
      const cleaned = safe.length ? A.applyCleaning(dataset, safe) : { rows: dataset.rows, columns: dataset.columns, log: [] };
      const log = cleaned.log.filter(line => !/\b0 (values|labels|blank rows|rows)\b/.test(line));
      const working = { ...dataset, rows: cleaned.rows, columns: cleaned.columns };
      const notes = log.length ? [`Labels and values were normalized in memory for this analysis (${log.join("; ")}). ${dataset.name} itself is unchanged.`] : [];
      if (audit.issues.some(issue => issue.kind === "duplicate-rows")) notes.push(`${audit.issues.find(issue => issue.kind === "duplicate-rows").title} are still included; review them with “Clean this dataset”.`);
      state.prepared[key] = { audit, working, prof: A.profile(working), log, notes };
    }
    return state.prepared[key];
  }

  function toolContext(step, run, env, state, signal) {
    const datasetId = step.args.datasetId || state.datasetId || env.dataset?.id;
    const dataset = NS.context.datasetById(datasetId) || env.dataset;
    const base = { prompt: run.prompt, run, state, signal, project: env.project, datasets: env.project.datasets, focus: NS.context.focus(), notes: [] };
    if (!dataset) return base;
    const prep = prepared(dataset, state);
    return { ...base, dataset, working: prep.working, prof: prep.prof, audit: prep.audit, normalizationLog: prep.log, notes: prep.notes };
  }

  function friendlyError(error, step) {
    const tool = NS.registry.get(step.tool);
    return { title: `${tool?.name || "This step"} didn’t complete`, what: error?.message && !/undefined|null|is not a function|Cannot read/.test(error.message) ? error.message : "An unexpected problem stopped this step.", why: "The data may have a shape this step doesn’t handle yet.", affected: "Steps after this one were not run. Nothing in your project was changed by the failed step.", next: [{ label: "Inspect the dataset", prompt: "What is in this file?" }] };
  }

  async function runStep(step, run, env, state, signal) {
    if (step.tool === "@import") {
      if (!env.project.datasets.length) return { status: "failed", stop: true, items: [{ text: "No data in this project yet", tone: "failed" }], blocks: [{ type: "needs-data" }], summary: "I need data first. Add a CSV, Excel or JSON file and I’ll continue with this request." };
      const items = env.project.datasets.slice(0, 4).map(dataset => ({ text: `${dataset.name} · ${dataset.rows.length.toLocaleString()} rows` }));
      if (env.dataset && env.datasetReason) items.push({ text: `Working on ${env.dataset.name} (${env.datasetReason})`, tone: "info" });
      return { items };
    }
    const tool = NS.registry.get(step.tool);
    const ctx = toolContext(step, run, env, state, signal);
    const check = NS.registry.validate(step.tool, step.args, { dataset: ctx.dataset, datasetCount: env.project.datasets.length });
    if (!check.ok) return { status: "failed", error: { title: `${tool?.name || step.tool} can’t run yet`, what: check.errors.join(" "), next: env.project.datasets.length ? [] : [{ label: "Add data", action: "attach" }] } };
    return await tool.run(step.args, ctx);
  }

  function clarifyRun(prompt, env, route) {
    const catalog = SN.catalog;
    const ranked = catalog.rankTools(prompt, 1)[0];
    const blocks = [];
    if (ranked && ranked.tool.accepts !== "tabular" && ranked.score >= 8) blocks.push({ type: "capability", status: "available", title: `${ranked.tool.title} does this`, text: ranked.tool.description, tool: ranked.tool.id });
    else {
      const options = (route.candidates?.length ? route.candidates : [{ intent: "analyze" }, { intent: "compare-periods" }, { intent: "clean" }, { intent: "dashboard" }]).map(item => catalog.intent(item.intent) || { label: item.label, starter: item.label }).filter(Boolean).map(item => ({ label: item.label, prompt: item.starter }));
      blocks.push({ type: "clarify", question: env.focus?.subject ? `I’m not sure what you want me to do with ${env.focus.subject}. Did you mean one of these?` : "I want to get this right. What kind of result do you need?", options: options.slice(0, 4) });
    }
    return blocks;
  }


  async function run(prompt, { ui, overrides = {}, intent, route: forced } = {}) {
    prompt = String(prompt || "").trim();
    if (!prompt || current) return null;
    const started = performance.now();
    const env = environment(prompt, overrides);
    let route = forced ? forced : intent ? { kind: "plan", intent, label: SN.catalog.intent(intent)?.label || intent, confidence: 1, reason: "chosen explicitly" } : NS.router.route(prompt, env);
    log("request", { intent: route.intent || route.kind, confidence: route.confidence, dataset: env.dataset?.name });

    if (route.kind === "rerun") {
      NS.context.setFocus({ datasetId: route.datasetId });
      return run(route.rerun, { ui, overrides: { datasetId: route.datasetId } });
    }

    const conv = NS.context.conversation();
    const record = { id: studio.uid("run"), conversationId: conv.id, prompt, createdAt: Date.now(), status: "running", intent: route.intent || "clarify", intentLabel: route.label || "Clarify", route: { reason: route.reason || "", confidence: route.confidence ?? 0, provider: route.provider || "rules" }, steps: [], toolLog: [], blocks: [], findings: [], followups: [], next: [], summary: "", datasetIds: env.dataset ? [env.dataset.id] : [] };
    if (conv.title === "New conversation") conv.title = prompt.slice(0, 60);

    const controller = new AbortController();
    current = { record, controller };
    ui?.start(record);
    try {
      if (route.kind === "clarify") {
        ui?.status("Checking whether a local model can route this…");
        const modelRoute = await NS.router.modelRoute(prompt, env, controller.signal).catch(error => { log("model routing failed", error.message); NS.router.disableModelRouting(); return null; });
        if (modelRoute) { route = modelRoute; Object.assign(record, { intent: route.intent, intentLabel: route.label, route: { reason: route.reason, confidence: route.confidence, provider: route.provider } }); }
      }
      if (route.kind === "clarify") {
        record.blocks = clarifyRun(prompt, env, route);
        record.status = "waiting";
        record.intent = "clarify";
        return finish(record, ui, started);
      }

      const plan = NS.planner.plan(route, env);
      log("plan", plan.steps.map(step => step.tool));


      if (plan.restricted.length) {
        const first = plan.restricted[0];
        record.blocks.push({ type: "restricted", title: first.title, text: plan.blocked ? first.text : `${first.text} I left ${plan.restricted.length === 1 ? "that step" : `those ${plan.restricted.length} steps`} out and did the rest.`, capability: first.capability });
        log("restricted", plan.restricted.map(step => step.tool));
      }
      if (plan.blocked) {
        record.status = "waiting";
        record.steps = [];
        return finish(record, ui, started);
      }
      const flow = ui?.plan(plan) || null;
      const state = { prepared: {}, findings: [], summaries: [], datasetId: overrides.datasetId || null };
      record.steps = plan.steps.map(step => ({ id: step.id, label: `${step.stage} · ${step.label}`, status: "pending", items: [] }));

      const setStep = (id, patch) => { const entry = record.steps.find(step => step.id === id); if (entry) Object.assign(entry, patch); flow?.update(id, patch); };
      let stopped = null;
      for (const step of plan.steps) {
        if (stopped) { setStep(step.id, { status: "skipped", detail: stopped === "cancel" ? "Cancelled" : "" }); continue; }
        if (controller.signal.aborted) { stopped = "cancel"; setStep(step.id, { status: "skipped", detail: "Cancelled" }); continue; }
        setStep(step.id, { status: "running" });
        ui?.status(`${step.stage}: ${step.label}…`);
        await pause(120);
        const t0 = performance.now();
        let result;
        try { result = (await runStep(step, record, env, state, controller.signal)) || {}; }
        catch (error) { console.error("[vanessa] step failed", step.tool, error); result = { status: "failed", error: friendlyError(error, step) }; }
        const ms = Math.round(performance.now() - t0);
        const status = result.status || "complete";
        record.toolLog.push({ tool: step.tool, label: step.label, status, ms });
        log("tool", step.tool, status, `${ms}ms`);
        setStep(step.id, { status, items: result.items || [] });

        if (result.summary) state.summaries.push(result.summary);
        (result.blocks || []).forEach(block => record.blocks.push(block));
        if (result.findings?.length) { record.findings.push(...NS.fx.light(result.findings)); state.findings.push(...result.findings); }
        if (result.focus) NS.context.setFocus(result.focus);
        if (result.data?.datasetId) { state.datasetId = result.data.datasetId; env.dataset = NS.context.datasetById(result.data.datasetId); }
        if (result.data?.suggestions) state.suggestions = result.data.suggestions;
        if (result.followups?.length) record.followups = result.followups;
        if (result.next?.length) record.next.push(...result.next);
        if (result.outputs?.length) (record.outputs = record.outputs || []).push(...result.outputs);
        if (result.error) record.blocks.push({ type: "error", ...result.error });

        if (status === "failed" || status === "waiting" || result.stop) stopped = status;
      }
      if (flow) record.steps = flow.snapshot();
      record.summary = state.summaries.join(" ");
      record.status = stopped === "cancel" ? "cancelled" : stopped === "waiting" ? "waiting" : stopped === "failed" ? "failed" : "complete";
      if (stopped === "cancel") record.blocks.push({ type: "warning", title: "Stopped", text: "You stopped this request. Results above are from the steps that finished; nothing after that ran." });
      if (record.next.length && record.status === "complete") record.blocks.push({ type: "next", items: record.next.slice(0, 4) });
      return finish(record, ui, started);
    } finally {
      current = null;
    }
  }

  function finish(record, ui, started) {
    const p = project();
    record.durationMs = Math.round(performance.now() - started);
    p.vanessaRuns = [record, ...p.vanessaRuns.filter(item => item.id !== record.id)].slice(0, RUN_LIMIT);
    const conv = NS.context.conversation();
    if (conv) conv.updatedAt = Date.now();
    studio.addActivity(`Vanessa: ${record.intentLabel.toLowerCase()}${record.findings.length ? ` (${record.findings.length} findings)` : ""}`);
    studio.markDirty();
    studio.saveProject(true);
    log("done", record.status, `${record.durationMs}ms`);
    ui?.finish(record);
    window.dispatchEvent(new CustomEvent("vanessa:run-complete", { detail: record }));
    return record;
  }

  function cancel() { if (current) { current.controller.abort(); return true; } return false; }


  async function interpret(runId) {
    const record = project().vanessaRuns.find(item => item.id === runId);
    if (!record?.findings?.length) return null;
    const providers = SN.providers;
    const facts = record.findings.map(item => `- ${item.title}`).join("\n");
    const { provider, result } = await providers.complete({ system: "You interpret calculated analytics findings for a business reader. Use only the facts given. Do not add numbers that are not in the facts. Say what is uncertain. Three sentences at most.", prompt: `Calculated facts:\n${facts}\n\nWrite a short interpretation.` });
    const block = { type: "interpretation", source: "ai", provider: provider.label, text: String(result).trim().slice(0, 1200), basis: `${record.findings.length} calculated findings`, confidence: "unverified" };
    record.blocks.push(block);
    studio.markDirty();
    studio.saveProject(true);
    return block;
  }

  NS.executor = { run, cancel, interpret, isRunning: () => Boolean(current), environment };
})();
