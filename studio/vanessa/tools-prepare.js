


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const NS = window.SignalNoirVanessa;
  const A = window.SignalNoir?.analysis;
  if (!studio || !NS?.registry || !A) return;
  const { register } = NS.registry;
  const { fmt, human, plural, sample, finding, cap } = NS.fx;

  register({
    id: "inspect_dataset", name: "Inspect dataset", category: "inspect", output: "profile", relatedTool: "column-stats",
    description: "Describe a dataset from its real metadata: rows, columns, inferred types, missing values, dates, measures, categories and identifiers.",
    requires: ["dataset"], inputs: { detail: { type: "enum", values: ["full", "lite"] } },
    run(args, ctx) {
      const { dataset, prof } = ctx;
      const quality = A.qualityAudit(dataset);
      const time = prof.times[0] && A.column(prof, prof.times[0]);
      const items = [{ text: `${plural(prof.rows, "row")} · ${plural(prof.columnCount, "column")}` }];
      if (prof.missing) items.push({ text: `${plural(prof.missing, "missing value")}`, tone: "warning" });
      if (time) items.push({ text: `Timeline: ${time.name} (${time.from} → ${time.to})` });
      const candidates = !time ? A.dateCandidates(dataset) : [];
      if (!prof.measures.length) items.push({ text: "No numeric measures detected", tone: "warning" });
      if (args.detail === "lite") return { items, status: prof.missing ? "warning" : "complete", focus: { datasetId: dataset.id }, data: { quality } };

      const typeCount = type => prof.columns.filter(col => col.type === type).length;
      const summary = `${dataset.name} has ${plural(prof.rows, "row")} and ${plural(prof.columnCount, "column")}: ${[`${typeCount("number")} numeric`, `${typeCount("category")} categorical`, `${typeCount("date")} date`, typeCount("id") && `${typeCount("id")} identifier`, typeCount("text") && `${typeCount("text")} free-text`].filter(Boolean).join(", ")}.${time ? ` It covers ${time.from} to ${time.to}.` : ""}${quality.issues.length ? ` I found ${plural(quality.issues.length, "quality issue")} (score ${quality.score}/100).` : " No quality issues found."}`;
      const findings = [finding({ title: summary.split(". ")[0], dataset, evidence: { dataset: dataset.name, rows: prof.rows, rowsTotal: prof.rowsTotal, calculation: "Type inference over every value in each column", method: "Dataset profile" } })];
      const blocks = [
        { type: "metrics", items: [{ label: "Rows", value: prof.rows.toLocaleString() }, { label: "Columns", value: String(prof.columnCount) }, { label: "Missing values", value: prof.missing.toLocaleString(), tone: prof.missing ? "warn" : "" }, { label: "Quality score", value: `${quality.score}/100`, tone: quality.score < 80 ? "warn" : "" }] },
        { type: "table", title: "Columns", columns: ["Column", "Type", "Missing", "Distinct", "Example"], rows: prof.columns.map(col => [col.name, col.type, col.missing, col.unique, String(dataset.rows.find(row => !A.isBlank(row[col.name]))?.[col.name] ?? "").slice(0, 40)]), note: "Types are inferred from the values, not the headers." }
      ];
      if (quality.issues.length) blocks.push({ type: "warning", title: "Data quality", text: quality.issues.slice(0, 4).map(issue => issue.title).join(" · ") });
      if (candidates.length) blocks.push({ type: "warning", title: "No date column recognized", text: `“${candidates[0].column}” may be the time field (${Math.round(candidates[0].dateShare * 100)}% of its values parse as dates).` });
      const measure = A.pickMeasure(prof, ctx.prompt);
      const dimension = A.pickDimension(prof, ctx.prompt);
      const followups = [
        measure && dimension && { label: `${cap(human(measure))} by ${human(dimension)}`, prompt: `Total ${human(measure)} by ${human(dimension)}` },
        measure && time && { label: `What changed last ${time ? "month" : "period"}?`, prompt: `Why did ${human(measure)} change last month?` },
        quality.issues.length && { label: "Clean this dataset", prompt: "Clean this dataset" },
        prof.measures.length > 1 && { label: "Highest average column", prompt: "Which numeric column has the highest average?" }
      ].filter(Boolean);
      return { summary, items, blocks, findings, followups, focus: { datasetId: dataset.id, measure, dimension, time: time?.name || null, subjectItem: null, change: null, subject: dataset.name }, data: { quality } };
    }
  });

  register({
    id: "audit_quality", name: "Audit data quality", category: "prepare", output: "quality", relatedTool: "data-cleaner",
    description: "Find blank rows, duplicates, stray spaces, numbers stored as text, inconsistent labels and missing values.",
    requires: ["dataset"], inputs: { mode: { type: "enum", values: ["report", "normalize"] } },
    run(args, ctx) {
      const { dataset } = ctx;
      const audit = ctx.audit || A.qualityAudit(dataset);
      const review = audit.issues.filter(issue => !issue.safe);
      const items = (ctx.normalizationLog || []).map(line => ({ text: `${line} (analysis copy)` }));
      review.forEach(issue => items.push({ text: issue.title, tone: "warning" }));
      if (!audit.issues.length) items.push({ text: "No quality issues found" });
      if (args.mode === "normalize") return { status: review.length ? "warning" : "complete", items };
      const findings = audit.issues.map(issue => finding({ title: issue.title, tone: issue.severity === "high" ? "negative" : "warning", dataset, evidence: { dataset: dataset.name, rows: issue.count, rowsTotal: dataset.rows.length, filters: issue.column ? [`column = ${issue.column}`] : [], calculation: { "blank-rows": "COUNT(rows where every column is blank)", "duplicate-rows": "COUNT(rows identical to an earlier row on every column)", whitespace: `COUNT(values in ${issue.column} with leading/trailing spaces)`, missing: `COUNT(blank values in ${issue.column})`, "numeric-text": `COUNT(values in ${issue.column} that parse as numbers once $ , % are removed)`, "inconsistent-labels": `COUNT(values in ${issue.column} spelled differently from the most common form)` }[issue.kind], method: "Data quality audit", notes: issue.examples ? [`Examples: ${issue.examples.map(list => list.join(" / ")).join("; ")}`] : [] } }));
      return {
        status: review.length ? "warning" : "complete", items, findings,
        summary: audit.issues.length ? `${dataset.name} scores ${audit.score}/100 for quality with ${plural(audit.issues.length, "issue")}. ${audit.issues.filter(issue => issue.fix).length} can be fixed automatically; nothing changes until you approve.` : `${dataset.name} looks clean: no blank rows, duplicates, stray spaces or inconsistent labels.`,
        blocks: audit.issues.length ? [{ type: "quality", datasetId: dataset.id, datasetName: dataset.name, score: audit.score, issues: audit.issues.map(({ id, title, fix, safe, severity, count }) => ({ id, title, fix, safe, severity, count })) }] : [],
        followups: audit.issues.some(issue => issue.kind === "duplicate-rows") ? [{ label: "Look for near-duplicates too", tool: "fuzzy-dupes" }] : [],
        focus: { datasetId: dataset.id, subject: `quality of ${dataset.name}` }
      };
    }
  });

  register({
    id: "clean_dataset", name: "Apply cleaning fixes", category: "prepare", output: "dataset", modifiesData: true, confirm: true, routable: false, relatedTool: "data-cleaner",
    description: "Create a cleaned copy of a dataset with the selected fixes. The original is never changed.",
    requires: ["dataset"], inputs: { fixes: { type: "list", required: true } },
    run(args, ctx) {
      const cleaned = A.applyCleaning(ctx.dataset, args.fixes);
      const copy = { id: studio.uid("data"), name: `${ctx.dataset.name.replace(/\.[a-z0-9]+$/i, "")} (cleaned).csv`, columns: cleaned.columns, rows: cleaned.rows, originalRowCount: cleaned.rows.length, source: "vanessa-clean", derivedFrom: ctx.dataset.id, cleaningLog: cleaned.log, addedAt: Date.now() };
      ctx.project.datasets.push(copy);
      ctx.project.activeDatasetId = copy.id;
      studio.addActivity(`Cleaned copy created: ${cleaned.log.join("; ")}`);
      return { summary: `Created ${copy.name}: ${cleaned.log.join("; ")}. ${ctx.dataset.name} is unchanged.`, items: cleaned.log.map(text => ({ text })), focus: { datasetId: copy.id }, data: { datasetId: copy.id }, outputs: [{ kind: "dataset", id: copy.id, title: copy.name }] };
    }
  });

  register({
    id: "append_datasets", name: "Combine files", category: "prepare", output: "dataset", modifiesData: true, relatedTool: "converter",
    description: "Stack datasets that share columns into one new dataset with a source_file column. Originals stay unchanged.",
    requires: ["two-datasets"], inputs: { datasetIds: { type: "list" } },
    run(args, ctx) {
      const chosen = (args.datasetIds || []).map(id => NS.context.datasetById(id)).filter(Boolean);
      const sets = chosen.length > 1 ? chosen : ctx.datasets;
      const combined = A.appendDatasets(sets);
      if (combined.shared.length < Math.max(2, Math.min(...sets.map(set => set.columns.length)) * .5)) {
        return { status: "failed", error: { title: "These files don’t share enough columns to stack", what: `Only ${combined.shared.length} of the columns appear in every file.`, why: "Stacking rows only makes sense when the files describe the same kind of record.", next: [{ label: "Join them on a shared key instead", prompt: "Join these files on a shared key" }, { label: "Compare the files", prompt: "Compare these two files" }] } };
      }
      const dataset = { id: studio.uid("data"), name: `Combined (${sets.length} files).csv`, columns: combined.columns, rows: combined.rows.slice(0, studio.MAX_ROWS), originalRowCount: combined.rows.length, source: "vanessa-append", derivedFrom: sets.map(set => set.id), addedAt: Date.now() };
      ctx.project.datasets.push(dataset);
      ctx.project.activeDatasetId = dataset.id;
      studio.addActivity(`Combined ${sets.length} files into ${dataset.name}`);
      const items = [{ text: `${plural(combined.rows.length, "row")} from ${plural(sets.length, "file")}` }];
      if (combined.partial.length) items.push({ text: `${plural(combined.partial.length, "column")} only in some files (left blank elsewhere): ${combined.partial.slice(0, 3).join(", ")}`, tone: "warning" });
      if (combined.rows.length > studio.MAX_ROWS) items.push({ text: `Kept the first ${studio.MAX_ROWS.toLocaleString()} rows`, tone: "warning" });
      return { summary: `Combined ${sets.map(set => set.name).join(", ")} into ${dataset.name} (${plural(combined.rows.length, "row")}). A source_file column records where each row came from.`, items, status: combined.partial.length ? "warning" : "complete", focus: { datasetId: dataset.id }, data: { datasetId: dataset.id }, outputs: [{ kind: "dataset", id: dataset.id, title: dataset.name }] };
    }
  });

  register({
    id: "suggest_join", name: "Find join keys", category: "prepare", output: "join", relatedTool: "lookup-merge",
    description: "Find columns that link datasets and how well their values match.",
    requires: ["two-datasets"], inputs: {},
    run(args, ctx) {
      const suggestions = A.joinSuggestions(ctx.datasets).filter(item => item.matchRate >= .5).slice(0, 3);
      if (suggestions.length) {
        return { items: suggestions.map(item => ({ text: `${item.leftName} ↔ ${item.rightName} on ${item.column} (${Math.round(item.matchRate * 100)}% match)` })), data: { suggestions }, blocks: [{ type: "join", suggestions }],
          findings: suggestions.map(item => finding({ title: `${item.leftName} can be joined to ${item.rightName} on ${item.column}: ${Math.round(item.matchRate * 100)}% of keys match`, tone: item.matchRate < .9 ? "warning" : "positive", evidence: { dataset: `${item.leftName} + ${item.rightName}`, calculation: `distinct ${item.column} values present in both / distinct values in ${item.rightName}`, method: "Key overlap analysis", inputs: { "Matching keys": item.overlap, "Match rate": `${Math.round(item.matchRate * 100)}%` } } })),
          summary: `The best join is ${suggestions[0].leftName} → ${suggestions[0].rightName} on ${suggestions[0].column} (${Math.round(suggestions[0].matchRate * 100)}% of keys match).` };
      }

      const [a, b] = ctx.datasets;
      const candidates = A.keyCandidates(a, b);
      return {
        status: candidates.length ? "waiting" : "failed",
        items: [{ text: "No exact shared key column", tone: "warning" }],
        error: candidates.length ? null : { title: "No shared key between these datasets", what: `${a.name} and ${b.name} have no columns with matching names or values.`, why: "A join needs a column that identifies the same thing in both files.", next: [{ label: "Stack them instead", prompt: "Combine these files" }] },
        blocks: candidates.length ? [{ type: "clarify", question: `I couldn’t find an exact shared key between ${a.name} and ${b.name}. These look like possible matches. Which should I use?`, options: candidates.map(item => ({ label: `${item.left} ↔ ${item.right} (${Math.round(item.valueMatch * 100)}% values match)`, prompt: `Join ${a.name} and ${b.name} using ${item.left} and ${item.right}`, remember: { key: `join-key:${a.id}:${b.id}`, kind: "mapping", label: `Join key for ${a.name} ↔ ${b.name}`, value: `${item.left} ↔ ${item.right}` } })) }] : []
      };
    }
  });

  register({
    id: "join_datasets", name: "Join datasets", category: "prepare", output: "dataset", modifiesData: true, relatedTool: "lookup-merge",
    description: "Left-join two datasets on a key into a new dataset. Unmatched rows are kept and counted.",
    requires: ["two-datasets"], inputs: { leftId: { type: "dataset" }, rightId: { type: "dataset" }, leftKey: { type: "text" }, rightKey: { type: "text" } },
    run(args, ctx) {
      let { leftId, rightId, leftKey, rightKey } = args;
      if (!leftKey) {
        const remembered = ctx.datasets.length > 1 && NS.context.memoryValue(`join-key:${ctx.datasets[0].id}:${ctx.datasets[1].id}`);
        const suggestion = ctx.state.suggestions?.[0] || A.joinSuggestions(ctx.datasets).find(item => item.matchRate >= .5);
        if (remembered) { [leftKey, rightKey] = remembered.split(" ↔ "); leftId = ctx.datasets[0].id; rightId = ctx.datasets[1].id; }
        else if (suggestion) { leftId = suggestion.left; rightId = suggestion.right; leftKey = rightKey = suggestion.column; }
        else return { status: "skipped", items: [{ text: "Waiting for a join key", tone: "info" }] };
      }
      const left = NS.context.datasetById(leftId), right = NS.context.datasetById(rightId);
      if (!left || !right) return { status: "failed", error: { title: "Couldn’t find both datasets", what: "One of the datasets to join is no longer in the project.", next: [] } };
      const renamed = rightKey && rightKey !== leftKey ? { ...right, columns: right.columns.map(name => name === rightKey ? leftKey : name), rows: right.rows.map(row => { const copy = { ...row, [leftKey]: row[rightKey] }; delete copy[rightKey]; return copy; }) } : right;
      const joined = A.leftJoin(left, renamed, leftKey);
      const dataset = { id: studio.uid("data"), name: `${left.name.replace(/\.[a-z0-9]+$/i, "")} + ${right.name.replace(/\.[a-z0-9]+$/i, "")}.csv`, columns: joined.columns, rows: joined.rows.slice(0, studio.MAX_ROWS), originalRowCount: joined.rows.length, source: "vanessa-join", derivedFrom: [left.id, right.id], addedAt: Date.now() };
      ctx.project.datasets.push(dataset);
      ctx.project.joins.push({ id: studio.uid("join"), left: left.id, right: right.id, key: leftKey, rightKey: rightKey || leftKey, createdAt: Date.now() });
      ctx.project.activeDatasetId = dataset.id;
      studio.addActivity(`Joined ${left.name} and ${right.name} on ${leftKey}`);
      const matchRate = joined.matched / Math.max(1, left.rows.length);
      return {
        status: matchRate < .8 ? "warning" : "complete", summary: `Joined ${left.name} to ${right.name} on ${leftKey}${rightKey && rightKey !== leftKey ? ` ↔ ${rightKey}` : ""}: ${plural(joined.matched, "row")} matched and ${plural(joined.unmatched, "row")} had no match (kept with blanks).`,
        items: [{ text: `${joined.matched} matched · ${joined.unmatched} unmatched`, tone: matchRate < .8 ? "warning" : "ok" }],
        findings: [finding({ title: `${Math.round(matchRate * 100)}% of ${left.name} rows found a match in ${right.name}`, tone: matchRate < .8 ? "warning" : "positive", dataset, evidence: { dataset: `${left.name} ⟕ ${right.name}`, rows: left.rows.length, calculation: `matched rows / rows in ${left.name} = ${joined.matched} / ${left.rows.length}`, method: `Left join on ${leftKey}${rightKey && rightKey !== leftKey ? ` = ${rightKey}` : ""}` } })],
        focus: { datasetId: dataset.id }, data: { datasetId: dataset.id }, outputs: [{ kind: "dataset", id: dataset.id, title: dataset.name }]
      };
    }
  });

  register({
    id: "compare_datasets", name: "Compare datasets", category: "analyze", output: "comparison", relatedTool: "file-diff",
    description: "Compare two versions of a file: schema changes, rows added, removed and changed, and movement in numeric totals.",
    requires: ["two-datasets"], inputs: { beforeId: { type: "dataset" }, afterId: { type: "dataset" } },
    run(args, ctx) {
      let before = NS.context.datasetById(args.beforeId), after = NS.context.datasetById(args.afterId);
      if (!before || !after) {
        const pairs = [];
        ctx.datasets.forEach((a, i) => ctx.datasets.slice(i + 1).forEach(b => { const shared = a.columns.filter(name => b.columns.includes(name)).length; pairs.push({ a, b, shared, similarity: shared / Math.max(a.columns.length, b.columns.length) }); }));
        const pair = pairs.sort((x, y) => y.similarity - x.similarity)[0];
        if (pair.similarity < .5) return { status: "warning", summary: "These datasets hold different kinds of data rather than two versions of one file, so a row-by-row comparison wouldn’t mean much.", items: [{ text: `Closest pair shares ${Math.round(pair.similarity * 100)}% of columns`, tone: "warning" }], followups: [{ label: "Join them instead", prompt: "Join these files on a shared key" }] };
        [before, after] = (pair.a.addedAt || 0) <= (pair.b.addedAt || 0) ? [pair.a, pair.b] : [pair.b, pair.a];
      }
      const res = A.compareDatasets(before, after);
      const base = { dataset: `${before.name} → ${after.name}`, rows: res.rowsA + res.rowsB };
      const findings = [];
      if (res.columnsAdded.length || res.columnsRemoved.length) findings.push(finding({ title: `${after.name}${res.columnsAdded.length ? ` adds ${res.columnsAdded.join(", ")}` : ""}${res.columnsRemoved.length ? ` drops ${res.columnsRemoved.join(", ")}` : ""}`, tone: "warning", evidence: { ...base, calculation: "Columns in B not in A; columns in A not in B", method: "Schema comparison" } }));
      if (res.key) findings.push(finding({ title: `${plural(res.addedRows.length, "row")} added, ${plural(res.removedRows.length, "row")} removed and ${plural(res.changedRows.length, "row")} changed (matched on ${res.key})`, tone: res.changedRows.length || res.removedRows.length ? "warning" : "neutral", evidence: { ...base, filters: [`Matched on ${res.key}`], calculation: `added = keys only in ${after.name}\nremoved = keys only in ${before.name}\nchanged = shared keys where any shared column differs`, method: "Key-based row comparison", inputs: { Added: res.addedRows.length, Removed: res.removedRows.length, Changed: res.changedRows.length }, sample: sample(after.rows.filter(row => res.changedRows.slice(0, 8).some(change => change.id === String(row[res.key]).trim())), after.columns) } }));
      else findings.push(finding({ title: `No unique key, so whole rows were compared: ${plural(res.onlyInB, "row")} only in ${after.name}, ${plural(res.onlyInA, "row")} only in ${before.name}`, tone: "warning", evidence: { ...base, calculation: "Rows compared on all shared columns", method: "Row-set comparison" } }));
      res.measureChanges.filter(item => item.delta).slice(0, 3).forEach(item => findings.push(finding({ title: `Total ${human(item.measure)} ${item.delta < 0 ? "fell" : "rose"} ${NS.fx.absPct(item.pct)} (${fmt(item.before, item.measure)} → ${fmt(item.after, item.measure)})`, tone: item.delta < 0 ? "negative" : "positive", evidence: { ...base, calculation: `SUM(${item.measure}) in ${after.name} − SUM in ${before.name} = ${NS.fx.delta(item.delta, item.measure)}`, method: "Column total comparison" } })));
      const blocks = [];
      if (res.fieldChanges?.length) blocks.push({ type: "chart", title: "Rows changed per column", chart: NS.fx.chartFrom("bars", res.fieldChanges.slice(0, 10).map(item => ({ label: item.field, value: item.count }))) });
      return { findings, blocks, summary: `Compared ${before.name} (older) with ${after.name} (newer). ${res.key ? `Matched on ${res.key}: ${res.addedRows.length} added, ${res.removedRows.length} removed, ${res.changedRows.length} changed.` : "No unique key, so rows were compared whole."}`, items: [{ text: `${before.name} → ${after.name}` }, { text: res.key ? `Matched on ${res.key}` : "Compared whole rows", tone: res.key ? "ok" : "warning" }], focus: { datasetId: after.id, otherDatasetId: before.id, subject: `changes from ${before.name} to ${after.name}` }, followups: res.fieldChanges?.length ? [{ label: `Show the changed rows in File Diff`, tool: "file-diff" }] : [] };
    }
  });
})();
