


(function () {
  "use strict";

  const NS = window.SignalNoirVanessa;
  const A = window.SignalNoir?.analysis;
  if (!NS?.router || !A) return;

  const STAGE = { attention_summary: "Review", run_history: "Review", check_monitors: "Check", propose_monitor: "Propose", project_status: "Review", list_findings: "Review", open_work: "Review", inspect_dataset: "Validate", audit_quality: "Clean", clean_dataset: "Clean", append_datasets: "Combine", suggest_join: "Join", join_datasets: "Join", compare_datasets: "Compare", aggregate: "Analyze", rank_columns: "Analyze", breakdown: "Analyze", compare_periods: "Analyze", trend: "Visualize", forecast: "Forecast", detect_anomalies: "Analyze", statistical_test: "Test", assess_change: "Assess", evaluate_metric: "Calculate", explain_subject: "Explain", create_chart: "Visualize", create_dashboard: "Build", create_report: "Report", save_findings: "Save", search_project: "Search", remember: "Remember", define_metric: "Define", create_workflow: "Automate" };
  const LITE = { tool: "inspect_dataset", args: { detail: "lite" } };
  const NORMALIZE = { tool: "audit_quality", args: { mode: "normalize" } };

  function similarSchemas(datasets) {
    if (datasets.length < 2) return false;
    const [a, ...rest] = datasets;
    return rest.every(b => a.columns.filter(name => b.columns.includes(name)).length / Math.max(a.columns.length, b.columns.length) >= .6);
  }

  const RECIPES = {

    "project-status": () => [{ tool: "project_status", args: {} }],
    "list-findings": () => [{ tool: "list_findings", args: {} }],
    "open-work": () => [{ tool: "open_work", args: {} }],
    attention: () => [{ tool: "attention_summary", args: {} }],
    "run-history": () => [{ tool: "run_history", args: {} }],
    "check-monitors": () => [{ tool: "check_monitors", args: {} }],
    "create-monitor": (env, e) => [{ tool: "propose_monitor", args: { measure: e.measure, op: env.text.includes("below") || env.text.includes("under") || env.text.includes("less") ? "lt" : "gt", threshold: (env.text.match(/(-?\d+(?:\.\d+)?)\s*%?/) || [])[1] } }],
    inspect: () => [{ tool: "inspect_dataset", args: { detail: "full" } }],
    question: (env, e) => /\bwhich (numeric )?(column|field|measure)s?\b/.test(env.text) ? [{ tool: "rank_columns", args: { op: e.op && e.op !== "count" ? e.op : "mean" } }] : [NORMALIZE, { tool: "aggregate", args: { op: e.op, measure: e.measure, group: e.dimension, filters: e.filters } }],
    analyze: (env, e) => [LITE, NORMALIZE, { tool: "aggregate", args: { op: "sum", measure: e.measure, filters: e.filters } }, env.prof?.dimensions.length && { tool: "breakdown", args: { measure: e.measure, dimension: e.dimension, filters: e.filters } }, env.hasTime && { tool: "compare_periods", args: { measure: e.measure, drivers: "no", filters: e.filters } }],
    explain: (env, e) => RECIPES.analyze(env, e),
    "compare-periods": (env, e) => [LITE, NORMALIZE, { tool: "compare_periods", args: { measure: e.measure, grain: e.grain, filters: e.filters } }],
    "compare-files": () => [{ tool: "compare_datasets", args: {} }],
    combine: env => similarSchemas(env.project.datasets) ? [{ tool: "append_datasets", args: {} }, LITE] : [{ tool: "suggest_join", args: {} }, { tool: "join_datasets", args: {} }],
    join: (env) => { const m = env.text.match(/\busing (\S+) and (\S+)$/i); const [a, b] = env.project.datasets; return m && a && b ? [{ tool: "join_datasets", args: { leftId: a.id, rightId: b.id, leftKey: m[1], rightKey: m[2] } }] : [{ tool: "suggest_join", args: {} }, { tool: "join_datasets", args: {} }]; },
    clean: () => [LITE, { tool: "audit_quality", args: { mode: "report" } }],
    statistics: (env, e) => [NORMALIZE, { tool: "statistical_test", args: { a: e.columns[0], b: e.columns[1] } }],
    forecast: (env, e) => [LITE, NORMALIZE, { tool: "forecast", args: { measure: e.measure, horizon: e.horizon, grain: e.grain === "week" ? "week" : undefined } }],
    anomalies: (env, e) => [LITE, NORMALIZE, { tool: "detect_anomalies", args: { measure: e.measure } }],
    dashboard: () => [LITE, NORMALIZE, { tool: "create_dashboard", args: {} }],
    chart: (env, e) => [NORMALIZE, env.hasTime && /time|trend|month|week|year|over/.test(env.text) ? { tool: "trend", args: { measure: e.measure, filters: e.filters, grain: e.grain } } : { tool: "create_chart", args: {} }],
    report: (env, e) => env.conversationFindings > 0 ? [{ tool: "create_report", args: {} }] : [...RECIPES.analyze(env, e), { tool: "create_report", args: {} }],
    automate: (env, e) => [...RECIPES.analyze(env, e), { tool: "create_workflow", args: {} }],
    search: env => [{ tool: "search_project", args: { query: env.text.replace(/^(search|look up|find)( for)?\s+/i, "").replace(/\s+in (the |this |my )?project\??$/i, "") } }]
  };

  function steps(route, env) {
    let list;
    if (route.steps) list = route.steps;
    else if (route.intent === "multi") {

      let produced = env.conversationFindings || 0;
      list = route.clauses.flatMap(clause => {
        const e = NS.router.entities(clause.text, env.dataset);
        const recipe = RECIPES[clause.intent] || RECIPES.analyze;
        const steps = (recipe({ ...env, text: clause.text.toLowerCase(), conversationFindings: produced }, e) || []).filter(Boolean);
        if (steps.some(step => !["inspect_dataset", "audit_quality"].includes(step.tool))) produced += 1;
        return steps;
      });
      if (!list.some(step => step.tool === "create_report") && /\breport\b/i.test(env.text)) list.push({ tool: "create_report", args: {} });
    } else {
      const recipe = RECIPES[route.intent] || RECIPES.analyze;
      list = recipe(env, env.entities).filter(Boolean);
    }

    const seen = new Set();
    list = list.filter(step => { const key = step.tool === "inspect_dataset" || step.tool === "audit_quality" && step.args?.mode === "normalize" ? `${step.tool}:${step.args?.mode || step.args?.detail}` : null; if (!key) return true; if (seen.has(key)) return false; seen.add(key); return true; });
    return list.map((step, index) => {
      const tool = NS.registry.get(step.tool);
      return { id: `s${index + 1}_${step.tool}`, tool: step.tool, args: { ...step.args }, label: step.label || tool?.name || step.tool, stage: STAGE[step.tool] || "Step", needsData: tool?.requires.includes("dataset") || tool?.requires.includes("two-datasets") };
    });
  }

  const SETUP = new Set(["inspect_dataset", "audit_quality", "@import"]);

  function plan(route, env) {
    const all = steps(route, env);


    const restricted = all.filter(step => !NS.registry.allows(step.tool));
    const list = all.filter(step => NS.registry.allows(step.tool));
    const blocked = restricted.length && !list.some(step => !SETUP.has(step.tool));
    if (list.some(step => step.needsData)) list.unshift({ id: "s0_import", tool: "@import", args: {}, label: env.project.datasets.length > 1 ? `Load ${env.project.datasets.length} datasets` : "Load data", stage: "Import" });
    return {
      id: `plan_${Date.now().toString(36)}`, intent: route.intent, label: route.label, reason: route.reason,
      confidence: route.confidence, provider: route.provider || "rules",
      steps: blocked ? [] : list,
      restricted: restricted.map(step => ({ tool: step.tool, label: step.label, ...NS.registry.refusal(step.tool) })),
      blocked
    };
  }

  NS.planner = { plan, steps, RECIPES, STAGE };
})();
