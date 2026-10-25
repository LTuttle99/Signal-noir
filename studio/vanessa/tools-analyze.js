


(function () {
  "use strict";

  const NS = window.SignalNoirVanessa;
  const A = window.SignalNoir?.analysis;
  if (!NS?.registry || !A) return;
  const { register } = NS.registry;
  const { fmt, pct, absPct, delta, human, cap, plural, pValue, sample, finding, interpretation, chartFrom, isMoney } = NS.fx;
  const same = (value, label) => String(value ?? "").trim() === label;
  const filterNote = filters => filters?.length ? ` (${filters.map(A.describeFilter).join(", ")})` : "";

  function pickMeasure(args, ctx) { return args.measure || A.mentioned(ctx.prompt, ctx.prof.measures) || ctx.focus.measure && ctx.prof.measures.includes(ctx.focus.measure) && ctx.focus.measure || A.pickMeasure(ctx.prof, ctx.prompt); }
  function pickTime(args, ctx) { return args.time || NS.context.memoryValue(`time-column:${ctx.dataset.id}`) || ctx.prof.times[0] || null; }
  function driverDims(prof, exclude = []) { return prof.dimensions.filter(name => !exclude.includes(name) && A.column(prof, name).unique <= 40).slice(0, 5); }

  function missingTime(ctx, purpose, prompt) {
    const candidates = A.dateCandidates(ctx.dataset);
    if (!candidates.length) return { status: "failed", error: { title: `No date column in ${ctx.dataset.name}`, what: `${purpose} needs a column of dates or periods.`, why: "None of the columns hold values that parse as dates.", next: [{ label: "Summarize instead", prompt: "Analyze this dataset" }] } };
    return { status: "waiting", items: [{ text: "Which column is the timeline?", tone: "warning" }], blocks: [{ type: "clarify", question: `I don’t see a clear date column in ${ctx.dataset.name}. ${candidates.map(item => `“${item.column}”`).slice(0, 2).join(" or ")} may be the time field. Should I use it?`, options: candidates.slice(0, 3).map(item => ({ label: `Use ${item.column}`, prompt, remember: { key: `time-column:${ctx.dataset.id}`, kind: "mapping", label: `Time column for ${ctx.dataset.name}`, value: item.column } })) }] };
  }

  register({
    id: "aggregate", name: "Calculate a value", category: "analyze", output: "metric", relatedTool: "pivot-explorer",
    description: "Total, average, minimum, maximum or count of a column, optionally grouped and filtered.",
    requires: ["dataset"], inputs: { op: { type: "enum", values: ["sum", "mean", "min", "max", "count"] }, measure: { type: "column" }, group: { type: "column" }, filters: { type: "list" } },
    run(args, ctx) {
      const rows = A.applyFilters(ctx.working.rows, args.filters);
      const scoped = { ...ctx.working, rows };
      const res = A.answer(scoped, [ctx.prompt, args.op && { sum: "total", mean: "average", min: "minimum", max: "maximum", count: "how many" }[args.op], args.measure, args.group && `by ${args.group}`].filter(Boolean).join(" "));
      const measure = res.measure, group = res.group;
      const label = `${A.opLabel[res.op]} ${res.op === "count" ? "records" : human(measure)}${group ? ` by ${human(group)}` : ""}${filterNote(args.filters)}`;
      const chart = res.groups.length ? chartFrom("bars", res.groups.slice(0, 12).map(item => ({ label: item.label, value: item.value })), { measure }) : null;
      const top = res.groups[0], bottom = res.groups[res.groups.length - 1];
      const title = group && top ? `${label}: ${top.label} is highest at ${fmt(top.value, measure)}${res.groups.length > 1 ? `; ${bottom.label} is lowest at ${fmt(bottom.value, measure)}` : ""}` : `${label}: ${fmt(res.value, measure)}`;
      const f = finding({ title, dataset: ctx.dataset, metric: { value: group ? top?.value : res.value, measure }, evidence: { dataset: ctx.dataset.name, rows: rows.length, rowsTotal: ctx.dataset.rows.length, filters: (args.filters || []).map(A.describeFilter), calculation: A.formula(res.op, measure, group), method: `${A.opLabel[res.op]} over ${group ? `groups of ${group}` : "all rows in scope"}`, inputs: res.groups.length ? Object.fromEntries(res.groups.slice(0, 10).map(item => [item.label, fmt(item.value, measure)])) : { Result: fmt(res.value, measure) }, notes: ctx.notes } , chart });
      return {
        summary: group ? `${label}: ${res.groups.slice(0, 3).map(item => `${item.label} ${fmt(item.value, measure)}`).join(", ")}${res.groups.length > 3 ? "…" : ""}.` : `${label}: ${fmt(res.value, measure)} across ${plural(rows.length, "row")}.`,
        items: [{ text: A.formula(res.op, measure, group) }], findings: [f],
        blocks: chart ? [{ type: "chart", title: label, chart, findingId: f.id }] : [{ type: "metrics", items: [{ label, value: fmt(res.value, measure) }] }],
        focus: { datasetId: ctx.dataset.id, measure, dimension: group || ctx.focus.dimension, op: res.op, filters: args.filters || [], subject: group && top ? `${top.label} (${human(group)})` : label, subjectItem: group && top ? { dimension: group, label: (/lowest|worst|least|smallest|bottom/i.test(ctx.prompt) ? bottom : top).label } : null, lastChart: chart ? { title: label, chart } : ctx.focus.lastChart, lastFindingIds: [f.id] },
        followups: [group && { label: `Why is ${(/lowest|worst/i.test(ctx.prompt) ? bottom : top)?.label} ${/lowest|worst/i.test(ctx.prompt) ? "lowest" : "highest"}?`, prompt: "Why?" }, group && ctx.prof.times.length && { label: "Show this over time", prompt: "Show this over time" }, !chart && { label: "Break it down", prompt: `Break that down by ${human(driverDims(ctx.prof)[0] || "")}` }].filter(item => item && item.prompt !== "Break that down by ")
      };
    }
  });

  register({
    id: "rank_columns", name: "Compare numeric columns", category: "analyze", output: "ranking", relatedTool: "column-stats",
    description: "Rank every numeric column by its average, total, minimum or maximum.",
    requires: ["dataset"], inputs: { op: { type: "enum", values: ["sum", "mean", "min", "max"] } },
    run(args, ctx) {
      const op = args.op || "mean";
      const ranked = A.rankColumns(ctx.working, op);
      if (!ranked.length) return { status: "failed", error: { title: "No numeric columns", what: `${ctx.dataset.name} has no columns that are mostly numbers.`, why: "Values may be stored as text with symbols.", next: [{ label: "Check data quality", prompt: "Clean this dataset" }] } };
      const top = ranked[0];
      const chart = chartFrom("bars", ranked.map(item => ({ label: item.column, value: item.value })));
      const f = finding({ title: `${top.column} has the highest ${A.opLabel[op].toLowerCase()} of the ${plural(ranked.length, "numeric column")}: ${fmt(top.value, top.column)}`, dataset: ctx.dataset, metric: { value: top.value, measure: top.column }, evidence: { dataset: ctx.dataset.name, rows: ctx.working.rows.length, calculation: ranked.map(item => `${op.toUpperCase()}(${item.column}) = ${fmt(item.value, item.column)}`).join("\n"), method: `${A.opLabel[op]} of each numeric column, then ranked`, notes: ["Columns use different units, so compare within context."].concat(ctx.notes) }, chart });
      return { summary: `${top.column} has the highest ${A.opLabel[op].toLowerCase()} (${fmt(top.value, top.column)}).${ranked.length > 1 ? ` Next: ${ranked.slice(1, 3).map(item => `${item.column} ${fmt(item.value, item.column)}`).join(", ")}.` : ""}`, findings: [f], items: [{ text: `${plural(ranked.length, "column")} ranked by ${op}` }],
        blocks: [{ type: "table", title: `${A.opLabel[op]} per numeric column`, columns: ["Column", A.opLabel[op]], rows: ranked.map(item => [item.column, fmt(item.value, item.column)]) }],
        focus: { datasetId: ctx.dataset.id, measure: top.column, op, subjectItem: null, subject: `${A.opLabel[op].toLowerCase()} of ${top.column}`, lastChart: { title: `${A.opLabel[op]} per numeric column`, chart }, lastFindingIds: [f.id] },
        followups: [{ label: "Show that as a chart", prompt: "Show that as a chart" }, driverDims(ctx.prof)[0] && { label: `${top.column} by ${human(driverDims(ctx.prof)[0])}`, prompt: `Break ${top.column} down by ${driverDims(ctx.prof)[0]}` }].filter(Boolean) };
    }
  });

  register({
    id: "breakdown", name: "Break down a measure", category: "analyze", output: "breakdown", relatedTool: "pivot-explorer",
    description: "Split a measure by a category, optionally within filters, and show each group's share.",
    requires: ["dataset"], inputs: { measure: { type: "column" }, dimension: { type: "column" }, filters: { type: "list" }, op: { type: "enum", values: ["sum", "mean", "count"] } },
    run(args, ctx) {
      const measure = pickMeasure(args, ctx);
      const dimension = args.dimension || A.mentioned(ctx.prompt, ctx.prof.dimensions) || driverDims(ctx.prof, [ctx.focus.dimension])[0] || ctx.prof.dimensions[0];
      if (!dimension) return { status: "failed", error: { title: "Nothing to break it down by", what: `${ctx.dataset.name} has no categorical columns with a manageable number of values.`, next: [] } };
      const filters = args.filters || [];
      const rows = A.applyFilters(ctx.working.rows, filters);
      const op = measure ? (args.op || "sum") : "count";
      const groups = A.breakdown(rows, measure, dimension, op);
      const total = op === "count" ? rows.length : A.aggregate(rows, measure, "sum");
      const top = groups[0];
      const chart = chartFrom("bars", groups.slice(0, 12).map(item => ({ label: item.label, value: item.value })), { measure });
      const share = total ? top.value / total : 0;
      const label = `${op === "count" ? "Rows" : cap(human(measure))} by ${human(dimension)}${filterNote(filters)}`;
      const f = finding({ title: `${top.label} is the largest ${human(dimension)}${filterNote(filters)}: ${fmt(top.value, measure)}${op === "sum" ? `, ${Math.round(share * 100)}% of the total` : ""}`, dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: rows.length, rowsTotal: ctx.dataset.rows.length, filters: filters.map(A.describeFilter), calculation: A.formula(op, measure, dimension), method: `Breakdown by ${dimension}`, inputs: Object.fromEntries(groups.slice(0, 10).map(item => [item.label, fmt(item.value, measure)])), notes: ctx.notes, sample: sample(rows.filter(row => same(row[dimension], top.label)), ctx.working.columns) }, chart });
      const blocks = [{ type: "chart", title: label, chart, findingId: f.id }];
      if (groups.length > 1 && share > .5) blocks.push(interpretation(`${top.label} dominates: more than half of ${op === "count" ? "all rows" : human(measure)} sits in one ${human(dimension)}, so overall trends will mostly reflect it.`, { basis: `share ${Math.round(share * 100)}%` }));
      return { summary: `${label}: ${groups.slice(0, 4).map(item => `${item.label} ${fmt(item.value, measure)}`).join(", ")}${groups.length > 4 ? "…" : ""}.`, findings: [f], blocks, items: [{ text: A.formula(op, measure, dimension) }],
        focus: { datasetId: ctx.dataset.id, measure, dimension, filters, subject: label, subjectItem: { dimension, label: top.label }, lastChart: { title: label, chart }, lastFindingIds: [f.id] },
        followups: [pickTime(args, ctx) && { label: `${top.label} over time`, prompt: "Show this over time" }, driverDims(ctx.prof, [dimension])[0] && { label: `Now by ${human(driverDims(ctx.prof, [dimension])[0])}`, prompt: `Break that down by ${driverDims(ctx.prof, [dimension])[0]}` }, groups.length > 1 && { label: "Are these groups really different?", prompt: `Are the ${human(dimension)} groups actually different?` }].filter(Boolean) };
    }
  });

  function drivers(ctx, res, measure, time, periodFilter) {
    const findings = [];
    let summary = "";
    const next = [];
    res.drivers.slice(0, 2).forEach((driver, index) => {
      const top = driver.items[0];
      if (!top || !top.delta) return;
      const f = finding({ title: `${cap(human(driver.dimension))} “${top.label}” ${top.delta < 0 ? "fell" : "rose"} ${absPct(top.pct)} (${delta(top.delta, measure)}), ${Math.round(top.shareOfMovement * 100)}% of all movement across ${human(driver.dimension)} values`, tone: top.delta < 0 ? "negative" : "positive", dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: top.rowsCurrent + top.rowsPrevious, rowsTotal: ctx.working.rows.length, filters: [`${driver.dimension} = ${top.label}`, periodFilter], calculation: `Δ = ${fmt(top.current, measure)} − ${fmt(top.previous, measure)} = ${delta(top.delta, measure)}\nShare of movement = |Δ| / Σ|Δ| over ${driver.items.length} values = ${Math.round(top.shareOfMovement * 100)}%`, method: `Driver decomposition of SUM(${measure}) by ${driver.dimension}`, inputs: Object.fromEntries(driver.items.slice(0, 6).map(entry => [entry.label, `${delta(entry.delta, measure)} (${pct(entry.pct)})`])), notes: ctx.notes }, chart: chartFrom("bars", driver.items.map(entry => ({ label: entry.label, value: entry.delta })), { measure, signed: true }) });
      findings.push(f);
      if (index === 0) {
        summary = ` The biggest driver was ${human(driver.dimension)} ${top.label} (${pct(top.pct)}, ${Math.round(top.shareOfMovement * 100)}% of the movement)`;
        const subset = { ...ctx.working, rows: ctx.working.rows.filter(row => same(row[driver.dimension], top.label)) };
        const drill = A.comparePeriods(subset, { measure, time, dimensions: driverDims(ctx.prof, [driver.dimension]), grain: res.grain, fiscalStart: NS.context.fiscalStart() });
        const inner = drill.ok ? drill.drivers[0]?.items[0] : null;
        if (inner && inner.delta && Math.sign(inner.delta) === Math.sign(top.delta)) {
          summary += `, mostly ${human(drill.drivers[0].dimension)} ${inner.label}`;
          findings.push(finding({ title: `Within ${top.label}, ${human(drill.drivers[0].dimension)} “${inner.label}” accounts for ${Math.round(inner.shareOfMovement * 100)}% of the change (${delta(inner.delta, measure)})`, tone: inner.delta < 0 ? "negative" : "positive", dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: inner.rowsCurrent + inner.rowsPrevious, filters: [`${driver.dimension} = ${top.label}`, `${drill.drivers[0].dimension} = ${inner.label}`, periodFilter], calculation: `Δ = ${fmt(inner.current, measure)} − ${fmt(inner.previous, measure)}`, method: `Drill-down inside ${driver.dimension} = ${top.label}`, notes: ctx.notes, sample: sample(subset.rows.filter(row => same(row[drill.drivers[0].dimension], inner.label)), ctx.working.columns) } }));
          next.push({ dimension: driver.dimension, label: top.label, innerDimension: drill.drivers[0].dimension, innerLabel: inner.label });
        } else next.push({ dimension: driver.dimension, label: top.label });
      }
    });
    return { findings, summary, next };
  }

  register({
    id: "compare_periods", name: "Compare periods", category: "analyze", output: "comparison", relatedTool: "data-analyzer",
    description: "Compare the latest period with the previous one (month, quarter, week or year) and find what drove the change.",
    requires: ["dataset"], inputs: { measure: { type: "column" }, time: { type: "column" }, grain: { type: "enum", values: ["day", "week", "month", "quarter", "year"] }, filters: { type: "list" }, drivers: { type: "enum", values: ["yes", "no"] } },
    run(args, ctx) {
      const measure = pickMeasure(args, ctx);
      const time = pickTime(args, ctx);
      if (!measure) return { status: "failed", error: { title: "Nothing numeric to compare", what: `${ctx.dataset.name} has no numeric measure.`, next: [{ label: "Inspect the dataset", prompt: "What is in this file?" }] } };
      if (!time) return missingTime(ctx, "A period comparison", ctx.prompt);
      const filters = args.filters || [];
      const scoped = { ...ctx.working, rows: A.applyFilters(ctx.working.rows, filters) };
      const dims = args.drivers === "no" ? [] : driverDims(ctx.prof, filters.map(filter => filter.column));
      const fiscalStart = NS.context.fiscalStart();
      const res = A.comparePeriods(scoped, { measure, time, dimensions: dims, grain: args.grain, fiscalStart });
      if (!res.ok) return { status: "failed", error: { title: "Couldn’t compare periods", what: res.reason, why: `Grouping ${time} by ${args.grain || "the detected grain"} produced fewer than two periods.`, next: [{ label: "Compare by month", prompt: `Compare ${human(measure)} month over month` }] } };
      const { current: cur, previous: prev } = res;
      const periodFilter = `${time} ∈ {${prev.label}, ${cur.label}}`;
      const verb = res.delta < 0 ? "fell" : res.delta > 0 ? "rose" : "was flat";
      const headline = finding({ title: `${cap(human(measure))}${filterNote(filters)} ${verb} ${absPct(res.pct)} from ${prev.label} to ${cur.label} (${delta(res.delta, measure)})`, tone: res.delta < 0 ? "negative" : res.delta > 0 ? "positive" : "neutral", dataset: ctx.dataset, metric: { value: res.pct, measure, kind: "pct-change" },
        evidence: { dataset: ctx.dataset.name, rows: cur.rows.length + prev.rows.length, rowsTotal: ctx.working.rows.length, filters: [periodFilter, ...filters.map(A.describeFilter)], calculation: `(${cur.label} − ${prev.label}) / ${prev.label}\n= (${fmt(cur.value, measure)} − ${fmt(prev.value, measure)}) / ${fmt(prev.value, measure)}\n= ${pct(res.pct)}`, method: `Period-over-period comparison of SUM(${measure}) by ${res.grain}${fiscalStart > 1 && /quarter|year/.test(res.grain) ? ` (fiscal year starts in month ${fiscalStart})` : ""}`, validation: res.notes.length ? "partial" : "computed", inputs: { [cur.label]: fmt(cur.value, measure), [prev.label]: fmt(prev.value, measure), Change: delta(res.delta, measure) }, notes: res.notes.concat(ctx.notes), sample: sample(cur.rows, ctx.working.columns) },
        chart: chartFrom("line", res.series.slice(-12).map(item => ({ label: item.label, value: item.value })), { measure, label: `${measure} by ${res.grain}` }) });
      const found = drivers(ctx, res, measure, time, periodFilter);
      const findings = [headline, ...found.findings];
      const askedDrop = /\b(drop|declin|fell|fall|down|decreas|lower)/i.test(ctx.prompt), askedRise = /\b(rise|rose|grew|grow|increas|higher|spike)/i.test(ctx.prompt);
      const contradiction = askedDrop && res.delta > 0 ? "The latest period actually shows an increase, not a drop. " : askedRise && res.delta < 0 ? "The latest period actually shows a decline. " : "";
      const blocks = [{ type: "metrics", items: [{ label: cur.label, value: fmt(cur.value, measure) }, { label: prev.label, value: fmt(prev.value, measure) }, { label: "Change", value: pct(res.pct), tone: res.delta < 0 ? "down" : "up" }] }];
      if (found.findings[0]) blocks.push({ type: "chart", title: `Change in ${human(measure)} by ${human(res.drivers[0].dimension)}, ${prev.label} → ${cur.label}`, chart: found.findings[0].chart, findingId: found.findings[0].id });
      else blocks.push({ type: "chart", title: headline.chart.label, chart: headline.chart, findingId: headline.id });
      const top = res.drivers[0]?.items[0];
      if (top && top.shareOfMovement >= .6) blocks.push(interpretation(`The change looks concentrated rather than broad-based: one ${human(res.drivers[0].dimension)} explains ${Math.round(top.shareOfMovement * 100)}% of the movement, so it is worth investigating ${top.label} specifically before drawing company-wide conclusions.`, { basis: `share of movement ${Math.round(top.shareOfMovement * 100)}%`, confidence: "medium" }));
      if (res.notes.length) blocks.push({ type: "warning", title: "Incomplete period", text: res.notes.join(" ") });
      const n = found.next[0];
      const followups = [
        n?.innerLabel && { label: `Break ${n.label} down by ${human(driverDims(ctx.prof, [n.dimension, n.innerDimension])[0] || n.innerDimension)}`, prompt: `Break that down by ${driverDims(ctx.prof, [n.dimension, n.innerDimension])[0] || n.innerDimension}` },
        { label: "Is this change unusual?", prompt: "Is this change unusual?" },
        { label: `Show ${human(measure)} over time`, prompt: "Show this over time" },
        { label: "Put these findings in a report", prompt: "Put these findings into a report" }
      ].filter(Boolean);
      const next = [n && { kind: "task", title: `Investigate ${n.innerLabel ? `${n.innerLabel} in ` : ""}${n.label}: ${human(measure)} ${res.delta < 0 ? "fell" : "rose"} in ${cur.label}` }, { kind: "decision", title: `Decide on a response to the ${pct(res.pct)} change in ${human(measure)}` }].filter(Boolean);
      return { summary: `${contradiction}${cap(human(measure))} ${verb} ${absPct(res.pct)} (${delta(res.delta, measure)}) from ${prev.label} to ${cur.label}.${found.summary}${found.summary ? "." : ""}`, findings, blocks, followups, next,
        items: [{ text: `SUM(${measure}) by ${res.grain}: ${plural(res.series.length, "period")}` }, { text: `Compared ${cur.label} with ${prev.label}` }, { text: `${plural(dims.length, "dimension")} checked for drivers` }, ...res.notes.map(text => ({ text, tone: "warning" }))], status: res.notes.length ? "warning" : "complete",
        focus: { datasetId: ctx.dataset.id, measure, time, grain: res.grain, filters, dimension: res.drivers[0]?.dimension || ctx.focus.dimension, subject: `${human(measure)} ${cur.label} vs ${prev.label}`, subjectItem: top ? { dimension: res.drivers[0].dimension, label: top.label } : null, change: { pct: res.pct, delta: res.delta, current: cur.label, previous: prev.label, series: res.series.map(item => item.value) }, lastChart: { title: headline.chart.label, chart: headline.chart }, lastFindingIds: findings.map(item => item.id) } };
    }
  });

  register({
    id: "trend", name: "Show a trend", category: "visualize", output: "chart", relatedTool: "chart-builder",
    description: "Plot a measure over time, optionally filtered to one group.",
    requires: ["dataset"], inputs: { measure: { type: "column" }, time: { type: "column" }, grain: { type: "enum", values: ["day", "week", "month", "quarter", "year"] }, filters: { type: "list" } },
    run(args, ctx) {
      const measure = pickMeasure(args, ctx), time = pickTime(args, ctx);
      if (!time) return missingTime(ctx, "A trend", ctx.prompt);
      const filters = args.filters || [];
      const ts = A.timeSeries(A.applyFilters(ctx.working.rows, filters), time, measure, { grain: args.grain, fiscalStart: NS.context.fiscalStart() });
      if (ts.series.length < 2) return { status: "failed", error: { title: "Not enough periods for a trend", what: `Only ${ts.series.length} ${ts.grain} of data after filters${filterNote(filters)}.`, next: [] } };
      const first = ts.series[0], last = ts.series[ts.series.length - 1];
      const label = `${cap(human(measure || "rows"))}${filterNote(filters)} by ${ts.grain}`;
      const chart = chartFrom("line", ts.series.map(item => ({ label: item.label, value: item.value })), { measure, label });
      const change = first.value ? (last.value - first.value) / Math.abs(first.value) : null;
      const f = finding({ title: `${label}: ${fmt(first.value, measure)} in ${first.label} to ${fmt(last.value, measure)} in ${last.label} (${pct(change)})`, dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: ts.datedRows, rowsTotal: ctx.dataset.rows.length, filters: filters.map(A.describeFilter), calculation: `SUM(${measure}) GROUP BY ${ts.grain}(${time})`, method: "Time series aggregation", notes: ts.undated ? [`${ts.undated} rows had no parseable date and were left out.`] : [] }, chart });
      return { summary: `${label} moved from ${fmt(first.value, measure)} (${first.label}) to ${fmt(last.value, measure)} (${last.label}), ${pct(change)} overall.`, findings: [f], blocks: [{ type: "chart", title: label, chart, findingId: f.id }], items: [{ text: `${plural(ts.series.length, ts.grain)} plotted` }],
        focus: { datasetId: ctx.dataset.id, measure, time, grain: ts.grain, filters, subjectItem: null, subject: label, lastChart: { title: label, chart }, lastFindingIds: [f.id] },
        followups: [{ label: "Forecast what comes next", prompt: "What happens next?" }, { label: "Find unusual periods", prompt: "Find anything unusual" }] };
    }
  });

  register({
    id: "forecast", name: "Forecast", category: "analyze", output: "forecast", relatedTool: "data-analyzer",
    description: "Project a measure forward with a linear trend and an 80% prediction range.",
    requires: ["dataset"], inputs: { measure: { type: "column" }, horizon: { type: "number" }, grain: { type: "enum", values: ["week", "month", "quarter"] } },
    run(args, ctx) {
      const measure = pickMeasure(args, ctx), time = pickTime(args, ctx);
      if (!measure) return { status: "failed", error: { title: "Nothing numeric to forecast", what: `${ctx.dataset.name} has no numeric columns to project forward.`, why: "Every column is text, dates or identifiers, or the numbers are stored with symbols that make them text.", next: [{ label: "See what's in this file", prompt: "What is in this file?" }, { label: "Check for numbers stored as text", prompt: "Clean this dataset" }, { label: "Use a different dataset", action: "attach" }] } };
      if (!time) return missingTime(ctx, "A forecast", ctx.prompt);
      const ts = A.timeSeries(ctx.working.rows, time, measure, { grain: args.grain });
      let series = ts.series;
      const notes = [...ctx.notes];
      const typical = A.quantile(series.slice(0, -1).map(item => item.rows.length).sort((a, b) => a - b), .5);
      if (series.length > 4 && series[series.length - 1].rows.length < typical * .5) { notes.push(`${series[series.length - 1].label} looks incomplete and was left out of the fit.`); series = series.slice(0, -1); }
      const horizon = Math.max(1, Math.min(24, Number(args.horizon) || (ts.grain === "month" ? 3 : 4)));
      const f = A.forecast(series, horizon);
      if (!f.ok) return { status: "failed", error: { title: "Not enough history to forecast", what: f.reason, next: [] } };
      const labels = A.nextPeriodLabels(series[series.length - 1].key, ts.grain, horizon);
      const projection = f.projection.map((point, index) => ({ ...point, label: labels[index] }));
      const sum = key => projection.reduce((total, point) => total + point[key], 0);
      const chart = chartFrom("line", series.slice(-18).map(item => ({ label: item.label, value: item.value })), { measure, projection, label: `${measure} forecast` });
      const evidence = { dataset: ctx.dataset.name, rows: series.reduce((total, item) => total + item.rows.length, 0), filters: [`${plural(series.length, ts.grain)} of history`], validation: "estimated", calculation: `ŷ(t) = ${fmt(f.fit.intercept, measure)} + ${fmt(f.fit.slope, measure)} × t\n80% range = ŷ ± 1.28 × ${fmt(f.fit.residualSd, measure)} × √(1 + 1/n + (t − t̄)²/Sxx)`, method: `${f.method} on SUM(${measure}) per ${ts.grain}`, inputs: { "R²": f.fit.r2.toFixed(2), ...Object.fromEntries(projection.map(point => [point.label, `${fmt(point.value, measure)} (${fmt(point.low, measure)} – ${fmt(point.high, measure)})`])) }, notes: notes.concat(["A linear trend ignores seasonality and one-off events."]) };
      const findings = [finding({ title: `Next ${plural(horizon, ts.grain)} (${labels[0]} – ${labels[labels.length - 1]}): about ${fmt(sum("value"), measure)} of ${human(measure)}, 80% range ${fmt(sum("low"), measure)} – ${fmt(sum("high"), measure)}`, tone: "estimate", dataset: ctx.dataset, evidence, chart })];
      if (f.fit.r2 < .3) findings.push(finding({ title: `The trend explains only ${Math.round(f.fit.r2 * 100)}% of the variation, so treat this forecast as a rough guide`, tone: "warning", evidence: { ...evidence, inputs: { "R²": f.fit.r2.toFixed(2) } } }));
      return { summary: `Based on ${plural(series.length, ts.grain)} of history, ${human(measure)} over the next ${plural(horizon, ts.grain)} projects to about ${fmt(sum("value"), measure)} (80% range ${fmt(sum("low"), measure)} – ${fmt(sum("high"), measure)}). This is an estimate, not an observed value.`,
        findings, blocks: [{ type: "metrics", items: [{ label: "Projected total", value: fmt(sum("value"), measure) }, { label: "Low (80%)", value: fmt(sum("low"), measure) }, { label: "High (80%)", value: fmt(sum("high"), measure) }, { label: "Fit (R²)", value: f.fit.r2.toFixed(2), tone: f.fit.r2 < .3 ? "warn" : "" }] }, { type: "chart", title: `${cap(human(measure))}: history and ${horizon}-${ts.grain} projection`, chart, findingId: findings[0].id }],
        items: [{ text: `${plural(series.length, ts.grain)} of history` }, { text: `Linear trend, R² ${f.fit.r2.toFixed(2)}`, tone: f.fit.r2 < .3 ? "warning" : "ok" }],
        focus: { datasetId: ctx.dataset.id, measure, time, grain: ts.grain, subjectItem: null, subject: `${human(measure)} forecast`, lastChart: { title: `${measure} forecast`, chart }, lastFindingIds: findings.map(item => item.id) },
        followups: [{ label: "Add to a report", prompt: "Put these findings into a report" }] };
    }
  });

  register({
    id: "detect_anomalies", name: "Find anomalies", category: "analyze", output: "anomalies", relatedTool: "data-analyzer",
    description: "Flag unusual periods (robust z-score) and extreme rows (3×IQR fence).",
    requires: ["dataset"], inputs: { measure: { type: "column" } },
    run(args, ctx) {
      const measure = pickMeasure(args, ctx);
      if (!measure) return { status: "failed", error: { title: "Nothing numeric to check", what: `${ctx.dataset.name} has no numeric columns to screen for outliers.`, next: [{ label: "See what's in this file", prompt: "What is in this file?" }] } };
      const time = pickTime(args, ctx);
      const findings = [], blocks = [];
      let unusual = [];
      if (time) {
        const ts = A.timeSeries(ctx.working.rows, time, measure);
        unusual = A.seriesAnomalies(ts.series);
        unusual.forEach(item => findings.push(finding({ title: `${item.label} is unusual: ${fmt(item.value, measure)} versus a typical ${fmt(item.median, measure)} (robust z = ${item.score.toFixed(1)})`, tone: "warning", dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: item.rows.length, filters: [`${time} in ${item.label}`], calculation: `z = 0.6745 × (value − median) / MAD = ${item.score.toFixed(2)}`, method: "Median absolute deviation on period totals (|z| ≥ 3.5)", sample: sample(item.rows, ctx.working.columns) } })));
        blocks.push({ type: "chart", title: `${cap(human(measure))} by ${ts.grain}`, chart: chartFrom("line", ts.series.map(item => ({ label: item.label, value: item.value })), { measure }) });
      }
      const outliers = A.valueOutliers(ctx.working.rows, measure);
      if (outliers.rows.length) {
        findings.push(finding({ title: `${plural(outliers.rows.length, "row")} have extreme ${human(measure)} values (outside ${fmt(outliers.low, measure)} – ${fmt(outliers.high, measure)})`, tone: "warning", dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: outliers.rows.length, calculation: `Outside Q1 − 3×IQR … Q3 + 3×IQR (Q1 ${fmt(outliers.q1, measure)}, Q3 ${fmt(outliers.q3, measure)})`, method: "Interquartile range fence", sample: sample(outliers.rows, ctx.working.columns) } }));
        blocks.push({ type: "table", title: "Extreme rows", columns: ctx.working.columns.slice(0, 6), rows: outliers.rows.slice(0, 8).map(row => ctx.working.columns.slice(0, 6).map(column => row[column])) });
      }
      if (!findings.length) findings.push(finding({ title: `Nothing unusual in ${human(measure)}: no period or row crosses the robust thresholds`, dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: ctx.working.rows.length, calculation: "MAD z-score on periods; 3×IQR fence on rows", method: "Robust outlier screening" } }));
      return { summary: unusual.length || outliers.rows.length ? `I found ${plural(unusual.length, "unusual period")} and ${plural(outliers.rows.length, "extreme row")} in ${human(measure)}.` : `${cap(human(measure))} looks stable.`, findings, blocks, items: [{ text: `${plural(unusual.length, "unusual period")} · ${plural(outliers.rows.length, "extreme row")}` }], focus: { datasetId: ctx.dataset.id, measure, subject: `anomalies in ${human(measure)}`, lastFindingIds: findings.map(item => item.id) } };
    }
  });

  register({
    id: "statistical_test", name: "Statistical test", category: "statistics", output: "test", relatedTool: "stat-tests",
    description: "Pick and run the right test from the column types: Welch t-test (2 groups), ANOVA (3+ groups), correlation and regression (two numbers), chi-square (two categories).",
    requires: ["dataset"], inputs: { a: { type: "column" }, b: { type: "column" } },
    run(args, ctx) {
      const stats = window;
      if (typeof stats.statsAnova !== "function") return { status: "failed", error: { title: "Statistics library didn’t load", what: "stats.js is missing from this page.", next: [{ label: "Open Statistical Tests", tool: "stat-tests" }] } };
      const { prof, working } = ctx;
      const mentionedCols = prof.columns.map(col => col.name).filter(name => A.mentioned(ctx.prompt, [name]));
      const numbers = [args.a, args.b, ...mentionedCols, ctx.focus.measure].filter(name => name && prof.measures.includes(name));
      const cats = [args.a, args.b, ...mentionedCols, ctx.focus.dimension].filter(name => name && prof.dimensions.includes(name));
      const measure = numbers[0] || A.pickMeasure(prof, ctx.prompt);
      const group = cats[0] || driverDims(prof)[0];
      const num = column => working.rows.map(row => A.toNumber(row[column]));
      let result;
      if (numbers.length >= 2 && new Set(numbers).size >= 2) {
        const [x, y] = [...new Set(numbers)];
        const corr = stats.statsCorrelation(num(x), num(y)), fit = stats.statsLinearFit(num(x), num(y));
        if (!corr.ok) return { status: "failed", error: { title: "Couldn’t run a correlation", what: corr.reason, next: [] } };
        const strength = Math.abs(corr.r) >= .7 ? "strong" : Math.abs(corr.r) >= .4 ? "moderate" : Math.abs(corr.r) >= .2 ? "weak" : "negligible";
        result = { test: "Pearson correlation and linear regression", verdict: `${x} and ${y} have a ${strength} ${corr.r >= 0 ? "positive" : "negative"} relationship (r = ${corr.r.toFixed(2)}, p = ${pValue(corr.p)}).${fit.ok ? ` Each 1-unit increase in ${x} goes with a ${fit.slope.toFixed(3)} change in ${y} (R² ${fit.rSquared.toFixed(2)}).` : ""}`, significant: corr.p < .05, inputs: { r: corr.r.toFixed(3), "p-value": pValue(corr.p), n: corr.n, Spearman: corr.spearman?.toFixed(3) }, subject: `${x} vs ${y}` };
      } else if (measure && group) {
        const labels = [...new Set(working.rows.map(row => String(row[group] ?? "").trim()).filter(Boolean))];
        const groups = labels.map(label => ({ label, values: working.rows.filter(row => same(row[group], label)).map(row => A.toNumber(row[measure])).filter(Number.isFinite) }));
        if (labels.length === 2) {
          const t = stats.statsTTest(groups[0].values, groups[1].values);
          if (!t.ok) return { status: "failed", error: { title: "Couldn’t run a t-test", what: t.reason, next: [] } };
          result = { test: "Welch two-sample t-test", verdict: `${labels[0]} averages ${fmt(t.groups[0].mean, measure)} and ${labels[1]} averages ${fmt(t.groups[1].mean, measure)}. ${t.p < .05 ? "The difference is statistically significant" : "The difference is not statistically significant"} (t = ${t.t.toFixed(2)}, p = ${pValue(t.p)}).`, significant: t.p < .05, inputs: { t: t.t.toFixed(3), df: t.df.toFixed(1), "p-value": pValue(t.p), [`n ${labels[0]}`]: t.groups[0].n, [`n ${labels[1]}`]: t.groups[1].n }, subject: `${measure} by ${group}` };
        } else {
          const anova = stats.statsAnova(groups);
          if (!anova.ok) return { status: "failed", error: { title: "Couldn’t run ANOVA", what: anova.reason, next: [] } };
          result = { test: "One-way ANOVA", verdict: `Average ${measure} ${anova.p < .05 ? "differs significantly" : "does not differ significantly"} across ${plural(anova.groups.length, group + " group")} (F = ${anova.f.toFixed(2)}, p = ${pValue(anova.p)}); ${group} explains ${Math.round(anova.etaSquared * 100)}% of the variation (η²).`, significant: anova.p < .05, inputs: { F: anova.f.toFixed(3), "df between": anova.dfBetween, "df within": anova.dfWithin, "p-value": pValue(anova.p), "η²": anova.etaSquared.toFixed(3) }, groups: anova.groups, subject: `${measure} by ${group}` };
        }
      } else if (cats.length >= 2) {
        const [r, c] = [...new Set(cats)];
        const rowsL = [...new Set(working.rows.map(row => String(row[r] ?? "")))], colsL = [...new Set(working.rows.map(row => String(row[c] ?? "")))];
        const table = rowsL.map(a => colsL.map(b => working.rows.filter(row => String(row[r] ?? "") === a && String(row[c] ?? "") === b).length));
        const chi = stats.statsChiSquareIndependence(table);
        if (!chi.ok) return { status: "failed", error: { title: "Couldn’t run chi-square", what: chi.reason, next: [] } };
        result = { test: "Chi-square test of independence", verdict: `${r} and ${c} ${chi.p < .05 ? "are associated" : "look independent"} (χ² = ${chi.chiSquare?.toFixed?.(2) ?? chi.statistic?.toFixed?.(2)}, p = ${pValue(chi.p)}).`, significant: chi.p < .05, inputs: { "p-value": pValue(chi.p), df: chi.df }, subject: `${r} vs ${c}` };
      } else return { status: "waiting", blocks: [{ type: "clarify", question: "Which columns should I test? A test needs a number and a category (are groups different?), or two numbers (are they related?).", options: driverDims(prof).slice(0, 2).flatMap(dim => prof.measures.slice(0, 2).map(m => ({ label: `${m} by ${dim}`, prompt: `Is ${m} different across ${dim}?` }))).slice(0, 4) }] };
      const f = finding({ title: result.verdict, tone: result.significant ? "positive" : "neutral", dataset: ctx.dataset, evidence: { dataset: ctx.dataset.name, rows: working.rows.length, calculation: Object.entries(result.inputs).map(([k, v]) => `${k} = ${v}`).join("\n"), method: result.test, inputs: result.inputs, notes: ["Statistical significance is not the same as practical importance. Check the effect size.", ...ctx.notes] } });
      const blocks = [{ type: "metrics", items: Object.entries(result.inputs).slice(0, 4).map(([label, value]) => ({ label, value: String(value) })) }];
      if (result.groups) blocks.push({ type: "chart", title: `Average ${measure} by ${group}`, chart: chartFrom("bars", result.groups.map(item => ({ label: item.label, value: item.mean })), { measure }) });
      blocks.push(interpretation(result.significant ? "The pattern is unlikely to be chance alone at the 5% level. That doesn’t establish cause: other differences between the groups could explain it." : "The data doesn’t give strong evidence of a real difference. That isn’t proof there’s no difference; more data could change this.", { basis: `p = ${result.inputs["p-value"]}` }));
      return { summary: result.verdict, findings: [f], blocks, items: [{ text: result.test }], focus: { datasetId: ctx.dataset.id, measure, dimension: group, subject: result.subject, lastFindingIds: [f.id] }, followups: [{ label: "Open in Statistical Tests", tool: "stat-tests" }] };
    }
  });

  register({
    id: "assess_change", name: "Judge whether a change is unusual", category: "statistics", output: "assessment",
    description: "Compare the latest period-over-period change with the historical spread of changes.",
    requires: ["dataset"], inputs: {},
    run(args, ctx) {
      const change = ctx.focus.change;
      if (!change?.series || change.series.length < 5) return { status: "waiting", blocks: [{ type: "clarify", question: "Good or unusual compared with what? I need a baseline to judge against.", options: [{ label: "Versus the previous period", prompt: "Compare the latest period with the previous one" }, { label: "Versus the average", prompt: `Average ${ctx.focus.measure || "value"} by ${ctx.focus.dimension || "group"}` }, { label: "Versus a target (define one)", prompt: "Define target as " }] }] };
      const changes = change.series.slice(1).map((value, i) => change.series[i] ? (value - change.series[i]) / Math.abs(change.series[i]) : null).filter(Number.isFinite);
      const history = changes.slice(0, -1);
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, history.length - 1));
      const z = sd ? (change.pct - mean) / sd : 0;
      const unusual = Math.abs(z) >= 2;
      const f = finding({ title: `A ${pct(change.pct)} move is ${unusual ? "unusual" : "within the normal range"}: typical period-to-period changes average ${pct(mean)} with a spread of ±${absPct(sd)} (z = ${z.toFixed(1)})`, tone: unusual ? "warning" : "neutral", evidence: { dataset: NS.context.datasetById(ctx.focus.datasetId)?.name, rows: change.series.length, calculation: `z = (${pct(change.pct)} − ${pct(mean)}) / ${absPct(sd)} = ${z.toFixed(2)}`, method: `Latest change versus ${plural(history.length, "earlier period-over-period change")}` } });
      return { summary: `${cap(ctx.focus.subject || "The change")}: ${f.title}. Whether that is “good” depends on your target; I don’t have one defined in this project.`, findings: [f], items: [{ text: `z = ${z.toFixed(1)} against ${plural(history.length, "prior change")}` }], blocks: [interpretation(unusual ? "This is larger than the usual fluctuation, so it is probably a real shift rather than noise." : "This is within normal fluctuation, so it may be noise rather than a real shift.", { basis: `|z| ${unusual ? "≥" : "<"} 2` })], focus: { lastFindingIds: [f.id] }, followups: [{ label: "Define a target", prompt: "Remember that our monthly target is " }] };
    }
  });

  register({
    id: "evaluate_metric", name: "Use a project metric", category: "analyze", output: "metric", relatedTool: null,
    description: "Calculate a metric using the project's own definition from Intelligence → Metrics.",
    requires: ["dataset"], inputs: { name: { type: "text", required: true } },
    run(args, ctx) {
      const defs = NS.context.definitions(args.name);
      if (defs.metrics.length > 1) return { status: "waiting", blocks: [{ type: "clarify", question: `This project has ${defs.metrics.length} definitions matching “${args.name}”. Which one?`, options: defs.metrics.map(metric => ({ label: `${metric.name}: ${metric.formula}`, prompt: `Calculate ${metric.name}` })) }] };
      const metric = defs.metrics[0];
      if (!metric) {
        const glossary = defs.glossary[0];
        return { status: "waiting", summary: glossary ? `“${glossary.term}” is defined in the glossary as “${glossary.definition}”, but there’s no formula I can calculate.` : `This project has no definition for “${args.name}”, and I won’t guess one.`, blocks: [{ type: "clarify", question: `Tell me how to calculate ${args.name} and I’ll save it as a project metric. Use SUM, AVG, MIN, MAX, COUNT, COUNTD with column names.`, options: ctx.prof.measures.slice(0, 2).map(measure => ({ label: `e.g. SUM(${measure}) / COUNT()`, prompt: `Define ${args.name} as SUM(${measure}) / COUNT()` })) }] };
      }
      const dataset = NS.context.datasetById(metric.datasetId) || ctx.dataset;
      const res = A.evaluateMetric(metric.formula, dataset);
      if (!res.ok) return { status: "failed", error: { title: `Couldn’t calculate ${metric.name}`, what: res.reason, why: `The saved formula is “${metric.formula}”.`, next: [{ label: "Edit metrics in Intelligence", view: "intelligence" }] } };
      const f = finding({ title: `${metric.name} is ${fmt(res.value, metric.name)} (project definition: ${metric.formula})`, dataset, metric: { value: res.value, measure: metric.name }, evidence: { dataset: dataset.name, rows: dataset.rows.length, calculation: `${metric.formula}\n${res.parts.join("\n")}`, method: "Project metric definition (Intelligence → Metrics)" } });
      return { summary: f.title + ".", findings: [f], blocks: [{ type: "metrics", items: [{ label: metric.name, value: fmt(res.value, metric.name) }] }], items: [{ text: metric.formula }], focus: { subject: metric.name, lastFindingIds: [f.id] } };
    }
  });
})();
