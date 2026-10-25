


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const NS = window.SignalNoirVanessa;
  const A = window.SignalNoir?.analysis;
  if (!studio || !NS?.registry || !A) return;
  const { register, get } = NS.registry;
  const { fmt, pct, delta, human, cap, plural, finding, interpretation, chartFrom, light } = NS.fx;


  function saveOutput(ctx, output) {
    const A = window.SignalNoir?.artifacts;
    const findingIds = (output.findings || []).map(item => item.id).filter(Boolean);
    const datasetIds = ctx.dataset ? [ctx.dataset.id] : [];
    const sources = [
      ...findingIds.map(id => ({ type: "finding", id, rel: "includes" })),
      ...datasetIds.map(id => ({ type: "dataset", id, rel: "derived-from" }))
    ];
    if (A) {
      const created = A.create(ctx.project, output.kind, {
        title: output.title, description: output.summary, sources,
        spec: output.spec || null, visual: output.visual || null, audience: output.audience || null,
        runId: ctx.run.id, prompt: ctx.prompt, steps: output.steps || null,
        findings: output.findings ? light(output.findings) : []
      });
      const record = ctx.project.outputs.find(item => item.id === created.id);
      record.findingIds = findingIds;
      record.datasetIds = datasetIds;
      studio.markDirty();
      return record;
    }
    const record = { id: studio.uid("output"), createdAt: Date.now(), runId: ctx.run.id, prompt: ctx.prompt, ...output, findingIds, datasetIds, findings: output.findings ? light(output.findings) : [] };
    ctx.project.outputs.unshift(record);
    ctx.project.outputs = ctx.project.outputs.slice(0, 80);
    studio.addActivity(`${cap(record.kind)} created: ${record.title}`);
    return record;
  }


  function conversationFindings(ctx, ids) {
    const runs = ctx.project.vanessaRuns.filter(run => run.conversationId === ctx.run.conversationId);
    const all = runs.flatMap(run => run.findings || []).concat(ctx.state.findings || []);
    const chosen = ids?.length ? all.filter(item => ids.includes(item.id)) : all;
    const seen = new Set();
    return chosen.filter(item => !seen.has(item.id) && seen.add(item.id));
  }

  register({
    id: "explain_subject", name: "Explain why", category: "analyze", output: "explanation",
    description: "Explain the item currently in focus: what changed for it over time, or how it differs from the rest.",
    requires: ["dataset"], inputs: {},
    run(args, ctx) {
      const item = ctx.focus.subjectItem;
      const measure = ctx.focus.measure;
      if (!item || !measure) {
        if (ctx.focus.change) return get("compare_periods").run({ measure, time: ctx.focus.time, grain: ctx.focus.grain }, ctx);
        return { status: "waiting", blocks: [{ type: "clarify", question: "Why what? Tell me which number or group you want explained.", options: [{ label: "Why did the latest period change?", prompt: "Why did it change last month?" }] }] };
      }
      const time = NS.context.memoryValue(`time-column:${ctx.dataset.id}`) || ctx.prof.times[0];
      if (time) {
        const result = get("compare_periods").run({ measure, time, grain: ctx.focus.grain, filters: [{ column: item.dimension, op: "=", value: item.label }] }, ctx);
        result.summary = `Looking at ${item.label} only: ${result.summary}`;
        return result;
      }

      const inside = ctx.working.rows.filter(row => String(row[item.dimension] ?? "").trim() === item.label);
      const outside = ctx.working.rows.filter(row => String(row[item.dimension] ?? "").trim() !== item.label);
      const dim = ctx.prof.dimensions.find(name => name !== item.dimension && A.column(ctx.prof, name).unique <= 40);
      if (!dim) return { status: "failed", error: { title: `Nothing else to explain ${item.label} with`, what: `${ctx.dataset.name} has no timeline and no other category to compare against.`, next: [] } };
      const avgIn = A.aggregate(inside, measure, "mean"), avgOut = A.aggregate(outside, measure, "mean");
      const mixIn = A.breakdown(inside, measure, dim), mixOut = A.breakdown(outside, measure, dim);
      const totalIn = mixIn.reduce((s, g) => s + g.value, 0) || 1, totalOut = mixOut.reduce((s, g) => s + g.value, 0) || 1;
      const gaps = mixIn.map(g => ({ label: g.label, gap: g.value / totalIn - (mixOut.find(o => o.label === g.label)?.value || 0) / totalOut })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
      const f1 = finding({ title: `${item.label} averages ${fmt(avgIn, measure)} per row versus ${fmt(avgOut, measure)} for the rest`, dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: inside.length + outside.length, filters: [`${item.dimension} = ${item.label} vs ≠ ${item.label}`], calculation: `AVG(${measure}) inside vs outside`, method: "Group versus rest comparison" } });
      const f2 = finding({ title: `${item.label}’s ${human(dim)} mix differs most on “${gaps[0].label}”: ${pct(gaps[0].gap)} points of share versus the rest`, dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: inside.length, calculation: `share of ${measure} by ${dim} inside ${item.label} − share outside`, method: "Mix comparison" }, chart: chartFrom("bars", gaps.slice(0, 8).map(g => ({ label: g.label, value: g.gap * 100 })), { signed: true }) });
      return { summary: `${item.label} differs from the rest in two measurable ways: ${f1.title.toLowerCase()}, and its ${human(dim)} mix leans ${gaps[0].gap < 0 ? "away from" : "towards"} ${gaps[0].label}.`, findings: [f1, f2], blocks: [{ type: "chart", title: `${item.label}: ${human(dim)} share gap vs rest (points)`, chart: f2.chart, findingId: f2.id }, interpretation(`These are associations in the data, not proven causes. The mix difference is one plausible reason ${item.label} stands out.`, { confidence: "low" })], items: [{ text: `${item.label} vs rest by ${dim}` }], focus: { lastFindingIds: [f1.id, f2.id] } };
    }
  });

  register({
    id: "create_chart", name: "Create a chart", category: "visualize", output: "chart", relatedTool: "chart-builder",
    description: "Chart the current result, or a measure by a category or over time.",
    requires: ["dataset"], inputs: { kind: { type: "enum", values: ["auto", "line", "bars"] } },
    run(args, ctx) {
      const last = ctx.focus.lastChart;
      if (last && args.kind !== "line") {
        const f = finding({ title: `Chart: ${last.title}`, dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, calculation: "Re-plots the values from the previous calculation", method: "Chart of the focused result" }, chart: last.chart });
        return { summary: `Here is ${last.title} as a chart. Save it to keep it in Outputs.`, findings: [f], blocks: [{ type: "chart", title: last.title, chart: last.chart, findingId: f.id }], items: [{ text: last.chart.type === "line" ? "Line chart" : "Bar chart" }], focus: { lastFindingIds: [f.id] } };
      }
      if (ctx.focus.time || ctx.prof.times.length) return get("trend").run({ measure: ctx.focus.measure, filters: ctx.focus.filters }, ctx);
      return get("breakdown").run({ measure: ctx.focus.measure, dimension: ctx.focus.dimension }, ctx);
    }
  });

  register({
    id: "create_dashboard", name: "Build a dashboard", category: "build", output: "dashboard", relatedTool: "dashboard-builder",
    description: "Lay out headline numbers and charts for a dataset as a saved, downloadable dashboard.",
    requires: ["dataset"], inputs: {},
    run(args, ctx) {
      const { prof, working, dataset } = ctx;
      const measure = ctx.focus.measure || A.pickMeasure(prof, ctx.prompt);
      const charts = [];
      const time = prof.times[0];
      if (measure && time) { const ts = A.timeSeries(working.rows, time, measure); charts.push({ title: `${cap(human(measure))} by ${ts.grain}`, chart: chartFrom("line", ts.series.slice(-18).map(item => ({ label: item.label, value: item.value })), { measure }) }); }
      prof.dimensions.filter(name => A.column(prof, name).unique <= 40).slice(0, 2).forEach(dimension => measure && charts.push({ title: `${cap(human(measure))} by ${human(dimension)}`, chart: chartFrom("bars", A.breakdown(working.rows, measure, dimension).slice(0, 10).map(item => ({ label: item.label, value: item.value })), { measure }) }));
      const recent = conversationFindings(ctx, ctx.focus.lastFindingIds).filter(item => item.chart).slice(0, 2);
      recent.forEach(item => charts.push({ title: item.title, chart: item.chart }));
      const kpis = prof.measures.slice(0, 4).map(name => ({ label: `Total ${human(name)}`, value: fmt(A.column(prof, name).sum, name) })).concat([{ label: "Rows", value: prof.rows.toLocaleString() }]);
      if (!charts.length) return { status: "failed", error: { title: "Nothing to chart", what: `${dataset.name} has no numeric measure to put on a dashboard.`, next: [{ label: "Inspect the dataset", prompt: "What is in this file?" }] } };
      const output = saveOutput(ctx, { kind: "dashboard", title: `${dataset.name.replace(/\.[a-z0-9]+$/i, "")} dashboard`, summary: `${kpis.length} headline numbers and ${charts.length} charts from ${dataset.name}`, spec: { kpis, charts }, findings: recent });
      return { summary: `I laid out a dashboard with ${plural(kpis.length, "headline number")} and ${plural(charts.length, "chart")} from ${dataset.name}. It’s saved in Outputs and downloads as one HTML file. For slicers and publishing, continue in Dashboard Builder.`, blocks: [{ type: "metrics", items: kpis }, { type: "output", outputId: output.id, kind: "dashboard" }], items: [{ text: `${plural(charts.length, "chart")} · ${plural(kpis.length, "KPI")}` }], outputs: [{ kind: "dashboard", id: output.id, title: output.title }], followups: [{ label: "Continue in Dashboard Builder", tool: "dashboard-builder" }] };
    }
  });

  register({
    id: "create_report", name: "Create a report", category: "build", output: "report", relatedTool: "markdown-preview",
    description: "Assemble the findings from this conversation (or the latest result) into a saved report with evidence.",
    requires: [], inputs: { audience: { type: "enum", values: ["executive", "analyst"] } },
    run(args, ctx) {
      const findings = conversationFindings(ctx, /\b(these|those|that|this|the) findings?\b|\bthat\b/i.test(ctx.prompt) ? ctx.focus.lastFindingIds : null);
      if (!findings.length) return { status: "skipped", items: [{ text: "No findings yet to report on", tone: "info" }] };
      const exec = args.audience === "executive" || /boss|manager|executive|leadership|exec/i.test(ctx.prompt);
      const chosen = exec ? findings.filter(item => item.evidence).slice(0, 6) : findings;
      const summary = ctx.state.summaries?.filter(Boolean).join(" ") || chosen.slice(0, 3).map(item => item.title).join(". ");
      const visual = chosen.find(item => item.chart);
      const output = saveOutput(ctx, { kind: "report", title: `${exec ? "Executive summary" : "Analysis report"}: ${ctx.project.name}`, summary, findings: chosen, visual: visual ? { title: visual.title, chart: visual.chart } : null, audience: exec ? "executive" : "analyst" });
      return { summary: `Report saved with ${plural(chosen.length, "finding")} and their evidence${exec ? ", trimmed for an executive audience" : ""}.`, blocks: [{ type: "output", outputId: output.id, kind: "report" }], items: [{ text: `${plural(chosen.length, "finding")} with evidence` }], outputs: [{ kind: "report", id: output.id, title: output.title }] };
    }
  });

  register({
    id: "save_findings", name: "Save findings", category: "project", output: "findings",
    description: "Save findings to the project so they appear in Outputs and the Library.",
    requires: [], inputs: {},
    run(args, ctx) {
      const A = window.SignalNoir?.artifacts;
      const findings = conversationFindings(ctx, ctx.focus.lastFindingIds);
      const datasetId = ctx.dataset?.id || null;
      let added = 0;
      findings.forEach(item => {
        if (ctx.project.findings.some(entry => entry.id === item.id)) return;


        const sources = datasetId ? [{ type: "dataset", id: datasetId, rel: "derived-from" }] : [];
        ctx.project.findings.unshift({ ...item, savedAt: Date.now(), createdAt: Date.now(), createdBy: A ? A.actorName() : "Vanessa", status: "draft", sources, runId: ctx.run.id });
        if (A) A.recordActivity(ctx.project, { type: "finding-created", text: `Finding saved: ${item.title}`, artifactId: item.id, artifactType: "finding" });
        added += 1;
      });
      return { summary: added ? `Saved ${plural(added, "finding")} to this project’s Outputs.` : "Those findings were already saved.", items: [{ text: `${added} saved` }] };
    }
  });

  register({
    id: "search_project", name: "Search the project", category: "project", output: "search",
    description: "Search datasets, columns, findings, outputs, metrics and project memory.",
    requires: [], inputs: { query: { type: "text", required: true } },
    run(args, ctx) {
      const q = String(args.query || "").toLowerCase().trim();
      const hits = [];
      ctx.project.datasets.forEach(dataset => { if (dataset.name.toLowerCase().includes(q)) hits.push(["Dataset", dataset.name]); dataset.columns.filter(col => col.toLowerCase().includes(q)).forEach(col => hits.push(["Column", `${col} in ${dataset.name}`])); });
      ctx.project.findings.concat(ctx.project.vanessaRuns.flatMap(run => run.findings || [])).filter(item => item.title.toLowerCase().includes(q)).slice(0, 10).forEach(item => hits.push(["Finding", item.title]));
      ctx.project.outputs.filter(item => item.title.toLowerCase().includes(q)).forEach(item => hits.push([cap(item.kind), item.title]));
      (ctx.project.metrics || []).filter(item => item.name.toLowerCase().includes(q)).forEach(item => hits.push(["Metric", `${item.name} = ${item.formula}`]));
      NS.context.memory().filter(item => `${item.label} ${item.value}`.toLowerCase().includes(q)).forEach(item => hits.push(["Memory", `${item.label}: ${item.value}`]));
      const unique = [...new Map(hits.map(hit => [hit.join("|"), hit])).values()].slice(0, 25);
      return { summary: unique.length ? `Found ${plural(unique.length, "match")} for “${args.query}” in this project.` : `Nothing in this project matches “${args.query}”.`, blocks: unique.length ? [{ type: "table", title: "Project search", columns: ["Type", "Match"], rows: unique }] : [], items: [{ text: `${unique.length} matches` }] };
    }
  });

  register({
    id: "remember", name: "Remember for this project", category: "project", output: "memory",
    description: "Store a project definition or preference (fiscal year, preferred dataset, a definition) that Vanessa will reuse. Visible and deletable in the context panel.",
    requires: [], inputs: { key: { type: "text" }, label: { type: "text", required: true }, value: { type: "text", required: true }, kind: { type: "enum", values: ["definition", "preference", "mapping", "note"] } },
    run(args) {
      const record = NS.context.remember({ key: args.key, label: args.label, value: args.value, kind: args.kind || "note", source: "user" });
      return { summary: `Noted for this project: ${record.label}: ${record.value}. You can edit or delete it under Project memory.`, items: [{ text: `${record.label}: ${record.value}` }] };
    }
  });

  register({
    id: "define_metric", name: "Define a project metric", category: "project", output: "metric",
    description: "Save a named formula (SUM, AVG, MIN, MAX, COUNT, COUNTD) as a project metric shared with Intelligence.",
    requires: ["dataset"], inputs: { name: { type: "text", required: true }, formula: { type: "text", required: true } },
    run(args, ctx) {
      const test = A.evaluateMetric(args.formula, ctx.dataset);
      if (!test.ok) return { status: "failed", error: { title: `Couldn’t save ${args.name}`, what: test.reason, why: `I tested “${args.formula}” against ${ctx.dataset.name} before saving.`, next: [{ label: "See the columns", prompt: "What is in this file?" }] } };
      const existing = (ctx.project.metrics || []).find(metric => metric.name.toLowerCase() === args.name.toLowerCase());
      if (existing) Object.assign(existing, { formula: args.formula, datasetId: ctx.dataset.id, updatedAt: Date.now() });
      else ctx.project.metrics.push({ id: studio.uid("metric"), name: args.name, formula: args.formula, datasetId: ctx.dataset.id, createdAt: Date.now(), source: "vanessa" });
      studio.addActivity(`Metric ${existing ? "updated" : "defined"}: ${args.name}`);
      return { summary: `${existing ? "Updated" : "Saved"} ${args.name} = ${args.formula}. On ${ctx.dataset.name} it’s currently ${fmt(test.value, args.name)}. It’s also listed in Intelligence → Metrics.`, items: [{ text: `${args.name} = ${args.formula}` }], blocks: [{ type: "metrics", items: [{ label: args.name, value: fmt(test.value, args.name) }] }] };
    }
  });

  register({
    id: "create_workflow", name: "Save a repeatable workflow", category: "act", output: "workflow",
    description: "Save cleaning, analysis and reporting steps as the project workflow so the analysis can be rerun.",
    requires: [], inputs: {},
    run(args, ctx) {
      const recipe = studio.recipes.find(item => /monthly/i.test(item.name)) || studio.recipes[0];
      ctx.project.steps = recipe.steps.map(type => ({ id: studio.uid("step"), type, ...studio.stepDefinitions.find(item => item.id === type) }));
      const output = saveOutput(ctx, { kind: "workflow", title: `${recipe.name} workflow`, summary: ctx.project.steps.map(step => step.name).join(" → ") });
      return { summary: `Saved a repeatable “${recipe.name}” workflow (${output.summary}). Add a schedule under Automate & share for a calendar reminder; Studio runs due schedules when it next opens. Unattended cloud runs aren’t available.`, items: [{ text: `${ctx.project.steps.length} steps saved` }], blocks: [{ type: "capability", status: "requires-user", title: "Scheduling", text: "Set the cadence under Automate & share." }], outputs: [{ kind: "workflow", id: output.id, title: output.title }] };
    }
  });


  register({ id: "open_tool", name: "Open a Signal Noir tool", category: "act", availability: "requires-user", routable: false, description: "Hands the active dataset to a standalone tool (SQL Workbench, File Diff, Dashboard Builder…) when you click." });
  register({ id: "run_sql", name: "Run SQL", category: "analyze", availability: "requires-user", relatedTool: "sql-workbench", description: "SQL runs in SQL Workbench (SQLite in your browser). Vanessa hands the dataset over; you write or paste the query." });
  register({ id: "export_dataset", name: "Download a dataset", category: "act", availability: "requires-user", description: "Downloads a dataset as CSV when you click. Nothing is uploaded." });
  register({ id: "create_task", name: "Create a task or decision", category: "act", availability: "requires-user", description: "Vanessa suggests follow-ups; each becomes a task or decision only when you click." });


  const artifactsApi = () => window.SignalNoir?.artifacts;

  register({
    id: "project_status", name: "Review the project", category: "project", output: "summary",
    description: "Summarize what this project contains: data, saved findings, outputs, open tasks and decisions.",
    requires: [], inputs: {},
    run(args, ctx) {
      const context = artifactsApi()?.projectContext(ctx.project);
      if (!context) return { summary: "I can't read this project's contents.", items: [] };
      const open = context.tasks.filter(task => task.status !== "done");
      const parts = [
        `${plural(context.datasets.length, "dataset")}`,
        `${plural(context.findings.length, "saved finding")}`,
        `${plural(context.outputs.length, "output")}`,
        `${plural(open.length, "open task")}`,
        `${plural(context.decisions.length, "decision")}`
      ];
      const blocks = [];
      if (context.findings.length) blocks.push({ type: "table", title: "Saved findings", columns: ["Finding", "Status"], rows: context.findings.slice(0, 8).map(item => [item.title, item.status]) });
      if (open.length) blocks.push({ type: "table", title: "Open work", columns: ["Task", "Assigned to", "Status"], rows: open.slice(0, 8).map(item => [item.title, item.assignee || "Unassigned", item.status]) });
      if (!context.findings.length && !context.outputs.length) blocks.push({ type: "warning", title: "Nothing saved yet", text: "This project has no saved findings or outputs. Run an analysis and save what matters, and it will be here next time." });
      return {
        summary: `${context.project.name} holds ${parts.join(", ")}.`,
        blocks, items: parts.map(text => ({ text })),
        next: context.findings.length >= 2 ? [{ label: "Put the findings in a report", prompt: "Create a report from the findings in this project" }] : []
      };
    }
  });

  register({
    id: "list_findings", name: "List saved findings", category: "project", output: "findings",
    description: "List the findings already saved in this project, with their status and evidence.",
    requires: [], inputs: {},
    run(args, ctx) {
      const items = artifactsApi()?.list(ctx.project, { type: "finding" }) || [];
      if (!items.length) return { summary: "No findings have been saved in this project yet. When an analysis produces something worth keeping, choose Save and it will be here.", items: [{ text: "0 saved findings" }], blocks: [{ type: "warning", title: "Nothing saved yet", text: "Findings live in the project once you save them, separately from the conversation they came from." }] };
      return {
        summary: (() => { const withEvidence = items.filter(item => item.evidence).length; return `This project has ${plural(items.length, "saved finding")}. ${withEvidence} of them ${withEvidence === 1 ? "carries" : "carry"} evidence.`; })(),
        blocks: [{ type: "table", title: "Saved findings", columns: ["Finding", "Status", "Source"], rows: items.slice(0, 15).map(item => [item.title, item.status, item.evidence?.dataset || "—"]) }],
        items: [{ text: `${items.length} findings` }],
        focus: { lastFindingIds: items.slice(0, 10).map(item => item.id) }
      };
    }
  });

  register({
    id: "open_work", name: "Check what is unresolved", category: "project", output: "summary",
    description: "Report open tasks, draft findings and decisions still awaiting a call.",
    requires: [], inputs: {},
    run(args, ctx) {
      const list = artifactsApi()?.list(ctx.project) || [];
      const tasks = list.filter(item => item.type === "task" && item.status !== "done");
      const drafts = list.filter(item => item.type === "finding" && item.status === "draft");
      const pending = list.filter(item => item.type === "decision" && item.status === "proposed");
      const rows = [
        ...tasks.map(item => ["Task", item.title, item.meta.assignee || "Unassigned"]),
        ...pending.map(item => ["Decision", item.title, item.meta.owner || "No owner"]),
        ...drafts.slice(0, 6).map(item => ["Draft finding", item.title, "Not yet validated"])
      ];
      if (!rows.length) return { summary: "Nothing is outstanding in this project: no open tasks, no decisions awaiting a call, and no findings still in draft.", items: [{ text: "Nothing open" }] };
      return {
        summary: `${plural(tasks.length, "open task")}, ${plural(pending.length, "decision")} awaiting a call, and ${plural(drafts.length, "finding")} still in draft.`,
        blocks: [{ type: "table", title: "Outstanding", columns: ["Type", "Item", "Owner"], rows: rows.slice(0, 15) }],
        items: [{ text: `${rows.length} open items` }]
      };
    }
  });


  const ops = () => window.SignalNoir?.operations;

  register({
    id: "attention_summary", name: "What needs attention", category: "project", output: "summary",
    description: "List open alerts, failed runs, approvals waiting, missed schedules and work assigned to this person.",
    requires: [], inputs: {},
    run(args, ctx) {
      const O = ops();
      if (!O) return { summary: "The operations layer isn't available.", items: [] };
      const items = O.attention(ctx.project);
      if (!items.length) return { summary: "Nothing needs your attention in this project: no open alerts, no failed runs, nothing waiting for approval.", items: [{ text: "All clear" }] };
      const critical = items.filter(item => item.severity === "critical").length;
      return {
        summary: `${plural(items.length, "thing")} need${items.length === 1 ? "s" : ""} attention${critical ? `, ${critical} critical` : ""}.`,
        blocks: [{ type: "table", title: "Needs attention", columns: ["Severity", "What", "Where from"], rows: items.slice(0, 12).map(item => [item.severity, item.title, item.source]) }],
        items: [{ text: `${items.length} open` }],
        next: [{ label: "Open the inbox", view: "operations-hub" }]
      };
    }
  });

  register({
    id: "run_history", name: "Review workflow runs", category: "project", output: "summary",
    description: "Report what ran, when, and whether it succeeded, including why a run failed.",
    requires: [], inputs: {},
    run(args, ctx) {
      const O = ops();
      if (!O) return { summary: "The operations layer isn't available.", items: [] };
      const list = O.runs.list(ctx.project, { limit: 20 });
      if (!list.length) return { summary: "No workflow has been run in this project yet.", items: [{ text: "0 runs" }], blocks: [{ type: "warning", title: "Nothing has run", text: "Create an automation from a template in Operations, then run it once by hand to see what it produces." }] };
      const failed = list.filter(run => run.status === "failed");
      const blocks = [{ type: "table", title: "Recent runs", columns: ["Workflow", "Trigger", "Result", "When"], rows: list.slice(0, 10).map(run => [run.workflowName || "Workflow", O.trigger(run.triggerType)?.label || run.triggerType, O.runStatus(run.status).label, run.startedAt ? new Date(run.startedAt).toLocaleString() : `due ${new Date(run.dueAt).toLocaleString()}`]) }];
      if (failed.length) {
        const recent = failed[0];
        const error = recent.errors[0];
        blocks.push({ type: "error", title: `${recent.workflowName} failed`, what: error?.what || recent.summary, why: error?.why || "", affected: error?.affected || "", next: [{ label: "Open the run", view: "operations-hub" }] });
      }
      const health = O.health(ctx.project);
      return {
        summary: `${plural(list.length, "run")} recorded. ${health.succeeded} succeeded, ${health.warnings} with warnings, ${health.failed} failed${health.missed ? `, ${health.missed} missed while Signal Noir was closed` : ""}.`,
        blocks, items: [{ text: `${health.failed} failed` }, { text: `${health.succeeded} succeeded` }]
      };
    }
  });

  register({
    id: "check_monitors", name: "Check the monitors", category: "project", output: "summary",
    description: "Evaluate every active monitor now and report which conditions are met.",
    requires: [], inputs: {},
    run(args, ctx) {
      const O = ops();
      if (!O) return { summary: "The operations layer isn't available.", items: [] };
      const results = O.monitors.checkAll(ctx.project);
      if (!results.length) return { summary: "This project has no active monitors. Add one in Operations to watch a metric, a quality score or how fresh the data is.", items: [{ text: "0 monitors" }] };
      const met = results.filter(item => item.result.met);
      return {
        summary: met.length ? `${plural(met.length, "monitor")} met ${met.length === 1 ? "its" : "their"} condition; an alert was raised for each.` : `All ${results.length} monitors are within range.`,
        blocks: [{ type: "table", title: "Monitor check", columns: ["Monitor", "Result", "Detail"], rows: results.map(item => [item.monitor.name, item.result.met ? "Condition met" : "Within range", item.result.reason]) }],
        items: [{ text: `${met.length} of ${results.length} met` }]
      };
    }
  });


  register({
    id: "propose_monitor", name: "Propose a monitor", category: "project", output: "proposal",
    description: "Draft a monitor configuration from a described condition, for the user to review before it is created.",
    requires: ["dataset"], inputs: { measure: { type: "column" }, op: { type: "text" }, threshold: { type: "number" } },
    run(args, ctx) {
      const O = ops();
      if (!O) return { summary: "The operations layer isn't available.", items: [] };
      const measure = args.measure || ctx.prof?.measures[0];
      const op = O.operator(args.op) ? args.op : "gt";
      const threshold = Number(args.threshold);
      if (!measure) return { summary: `${ctx.dataset.name} has no numeric column to watch.`, items: [], blocks: [{ type: "warning", title: "Nothing to watch", text: "A metric monitor needs a numeric column." }] };
      if (!Number.isFinite(threshold)) return { summary: "I need a threshold number before I can draft this monitor.", status: "waiting", blocks: [{ type: "clarify", question: `What value should ${measure} be compared against?`, options: [] }] };
      const draft = { name: `${measure} ${O.operator(op).label} ${threshold}`, kind: "metric-threshold", datasetId: ctx.dataset.id, measure, aggregate: "sum", op, threshold, severity: "warning" };
      return {
        summary: `Here is the monitor I'd create. Nothing is watching yet — review it and create it in Operations.`,
        blocks: [
          { type: "table", title: "Proposed monitor", columns: ["Setting", "Value"], rows: [["Name", draft.name], ["Watches", `${draft.aggregate} of ${measure} in ${ctx.dataset.name}`], ["Alerts when", O.describeCondition(draft)], ["Severity", draft.severity]] },
          { type: "capability", status: "requires-user", title: "You create it", text: "I've drafted the configuration; creating and activating a monitor is your decision." }
        ],
        items: [{ text: "Draft ready" }],
        data: { monitorDraft: draft },
        next: [{ label: "Open Operations", view: "operations-hub" }]
      };
    }
  });

  register({ id: "propose_automation", name: "Propose an automation", category: "project", availability: "requires-user", description: "Vanessa can draft a recurring process, but you review the schedule and activate it in Operations." });
  register({ id: "run_workflow", name: "Run a workflow", category: "act", availability: "requires-user", description: "Running a saved workflow is a click in Operations, so the run and its outputs are always attributable to a person." });


  register({ id: "schedule_delivery", name: "Scheduled delivery", category: "act", availability: "planned", description: "Email or chat delivery of reports on a schedule. Needs a server that can send on your behalf, which Signal Noir does not have yet." });
  register({ id: "share_with_team", name: "Share with team", category: "act", availability: "planned", description: "Genuinely shared projects, with access enforced on a server rather than in the browser. Teams, access profiles and project access can be configured locally under Organization today." });
  register({ id: "cloud_sync", name: "Private cloud sync", category: "project", availability: "planned", description: "Sync projects across your devices. Needs an encrypted sync service that does not exist yet; export a project bundle instead." });
  register({ id: "connect_database", name: "Query a live database", category: "prepare", availability: "planned", description: "Direct database connections need a secure server-side gateway; see Sources → setup guides." });

  NS.saveOutput = saveOutput;
  NS.conversationFindings = conversationFindings;
})();
