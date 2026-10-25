(function () {
  "use strict";
  const studio = window.DataHubStudio;
  if (!studio) return;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const esc = studio.escapeHtml;
  let codeLanguage = "python";
  let lastQueryRows = [];

  const packages = [
    { name: "Recruitment analysis", detail: "Pipeline, source performance, conversion, and time-to-fill.", goal: "Explain recruiting pipeline performance and recommend where to improve conversion", steps: ["clean", "dedupe", "quality", "analyze", "dashboard", "report"] },
    { name: "Admissions insights", detail: "Application volume, stages, outcomes, regions, and equity review.", goal: "Analyze admissions volume, progress, outcomes, and geographic patterns", steps: ["clean", "quality", "analyze", "dashboard", "report"] },
    { name: "Monthly business review", detail: "KPI movement, exceptions, causes, forecast, and actions.", goal: "Prepare a monthly business review with KPI changes, risks, and next actions", steps: ["clean", "quality", "analyze", "dashboard", "report"] },
    { name: "Survey intelligence", detail: "Response quality, scores, segments, sentiment, and themes.", goal: "Explain survey results, segment differences, sentiment, and recurring themes", steps: ["clean", "quality", "analyze", "report"] },
    { name: "Budget vs actuals", detail: "Variance, burn rate, cost centers, forecast, and risk.", goal: "Compare budget with actual spending, explain variance, and forecast the remaining period", steps: ["clean", "derive", "quality", "analyze", "report"] },
    { name: "Board-ready report", detail: "Evidence, definitions, privacy review, narrative, and decisions.", goal: "Create a defensible board report with evidence, risks, and recommended decisions", steps: ["quality", "analyze", "dashboard", "report"] }
  ];
  const stepDetail = { clean: "Trim values and remove empty records", dedupe: "Remove identical duplicate records", derive: "Create a useful calculated field", quality: "Run repeatable quality checks", analyze: "Profile measures and categories", dashboard: "Create a decision dashboard", report: "Generate an executive narrative" };
  const stopWords = new Set("the a an and or but to of in for on with is are was were be been this that these those it its from by as at we our you your they their i me my have has had do does did not no yes very can could should would will about into than then also just more most some any all each other what when where who why how".split(" "));
  const positiveWords = new Set("good great excellent helpful easy love liked positive satisfied success successful clear fast best improve improved strong happy recommend valuable amazing".split(" "));
  const negativeWords = new Set("bad poor difficult hard hate disliked negative unsatisfied failure failed confusing slow worst problem issue broken frustrating concern decline declined".split(" "));

  function project() { return studio.state.project; }
  function dataset() { return studio.activeDataset(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function columns(data = dataset()) { return data?.rows?.length ? Object.keys(data.rows[0]) : (data?.columns || []); }
  function numberValue(value) { const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, "")); return Number.isFinite(parsed) ? parsed : null; }
  function numericValues(data, column) { return (data?.rows || []).map(row => numberValue(row[column])).filter(value => value !== null); }
  function isNumeric(data, column) { const nonblank = (data?.rows || []).filter(row => row[column] !== "" && row[column] != null); return nonblank.length > 0 && numericValues(data, column).length >= nonblank.length * .75; }
  function isDate(data, column) { const values = (data?.rows || []).map(row => row[column]).filter(Boolean).slice(0, 200); return values.length > 0 && values.filter(value => !Number.isNaN(Date.parse(value))).length >= values.length * .75 && /date|time|month|year|week|quarter/i.test(column); }
  function format(value) { return Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : "—"; }
  function slug(value) { return String(value || "analysis").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function now() { return new Date().toLocaleString(); }
  function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN; }
  function touch(message) { studio.addActivity(message); studio.markDirty(); renderAll(); }
  function downloadBlob(name, content, type) { studio.download(name, content, type); }
  function barRows(items) {
    const max = Math.max(1, ...items.map(item => Math.abs(item.value)));
    return `<div class="mini-bars">${items.slice(0, 12).map(item => `<div class="mini-bar-row"><span title="${esc(item.label)}">${esc(item.label)}</span><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${Math.max(2, Math.abs(item.value) / max * 100)}%"></div></div><strong>${format(item.value)}</strong></div>`).join("")}</div>`;
  }
  function snapshotPayload() {
    const p = project(); return clone({ datasets: p.datasets, activeDatasetId: p.activeDatasetId, steps: p.steps, rules: p.rules, goal: p.goal, stories: p.stories, reportDesigns: p.reportDesigns, branding: p.branding });
  }
  function checkpoint(label) {
    const p = project(); if (!p) return;
    p.changeHistory.unshift({ id: studio.uid("change"), label, at: Date.now(), snapshot: snapshotPayload() });
    p.changeHistory = p.changeHistory.slice(0, 10); studio.markDirty(); renderHistory();
  }
  function undoLast() {
    const entry = project().changeHistory.shift(); if (!entry) return studio.toast("There is no Analyst Lab change to undo.");
    Object.assign(project(), clone(entry.snapshot)); studio.addActivity(`Undid: ${entry.label}`); studio.markDirty(); studio.renderAll(); studio.toast(`Undid “${entry.label}”.`);
  }
  window.DataHubAnalyst = { checkpoint, undo: undoLast };

  function bindTabs() {
    $$('[data-analyst-tab]').forEach(button => button.onclick = () => {
      $$('[data-analyst-tab]').forEach(node => node.classList.toggle("active", node === button));
      $$(".analyst-panel").forEach(panel => panel.classList.toggle("active", panel.id === `analyst-${button.dataset.analystTab}`));
      if (project().learningMode) renderLearning(button.dataset.analystTab);
    });
  }
  function inferPlan(goal) {
    const lower = goal.toLowerCase(), data = dataset(), plan = [];
    plan.push({ name: "Confirm the decision", detail: `Frame the analysis for ${$("#copilot-audience").value.toLowerCase()} and define what action the evidence should support.` });
    if (!data) plan.push({ name: "Connect the evidence", detail: "Add the source files, document where they came from, and choose the primary dataset." });
    else plan.push({ name: "Profile the evidence", detail: `Review ${data.rows.length} rows and ${columns(data).length} fields in ${data.name}; confirm roles and sensitive fields.` });
    plan.push({ name: "Review data fixes", detail: "Scan duplicates, inconsistent labels, whitespace, numeric formatting, dates, and missing values before applying changes." });
    if (/compare|change|month|year|before|after|declin|increase|trend/.test(lower)) plan.push({ name: "Compare periods", detail: "Select baseline and current versions, match stable IDs, and explain material movement." });
    if (/forecast|future|next|project|scenario|budget/.test(lower)) plan.push({ name: "Model the future", detail: "Build a baseline forecast and test an optimistic and conservative scenario." });
    if (/survey|comment|feedback|response|review|theme|sentiment/.test(lower)) plan.push({ name: "Analyze language", detail: "Identify themes, sentiment, common concerns, and representative comments." });
    if (/region|state|location|geograph|city|country/.test(lower)) plan.push({ name: "Map concentration", detail: "Detect location fields and identify regions with unusual volume or outcomes." });
    plan.push({ name: "Test the explanation", detail: "Use a suitable statistical test and distinguish evidence from interpretation." });
    plan.push({ name: "Build the decision story", detail: "Present the situation, strongest evidence, limitation, recommendation, owner, and next action." });
    return plan;
  }
  function buildCopilotPlan(goal) {
    const steps = inferPlan(goal), plan = { id: studio.uid("plan"), goal, audience: $("#copilot-audience").value, mode: $("#copilot-confidence").value, steps, createdAt: Date.now() };
    project().analystPlans.unshift(plan); project().goal = goal; studio.markDirty();
    const target = $("#copilot-response"); target.hidden = false; target.innerHTML = `<strong>Recommended analysis plan</strong><ol>${steps.map(step => `<li><b>${esc(step.name)}</b> — ${esc(step.detail)}</li>`).join("")}</ol><button class="button white" id="approve-copilot-plan">Add this plan to the workflow</button>`;
    $("#approve-copilot-plan").onclick = () => {
      checkpoint("Copilot workflow plan");
      const ids = ["clean", "quality", "analyze", "dashboard", "report"]; project().steps = ids.map(type => ({ id: studio.uid("step"), type, name: type[0].toUpperCase() + type.slice(1), detail: stepDetail[type] }));
      studio.addActivity("Vanessa's analysis plan approved"); studio.markDirty(); studio.renderAll(); studio.toast("Plan added to the project workflow.");
    };
  }
  function renderPackages() {
    $("#analysis-package-grid").innerHTML = packages.map((item, index) => `<div class="package-card"><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small><button class="button ghost" data-analysis-package="${index}">Start package</button></div>`).join("");
    $$('[data-analysis-package]').forEach(button => button.onclick = () => applyPackage(Number(button.dataset.analysisPackage)));
  }
  function applyPackage(index) {
    const item = packages[index]; if (!item) return; checkpoint(`${item.name} package`); project().goal = item.goal; project().steps = item.steps.map(type => ({ id: studio.uid("step"), type, name: type[0].toUpperCase() + type.slice(1), detail: stepDetail[type] || "Analysis step" }));
    $("#project-goal").value = item.goal; $("#copilot-goal").value = item.goal; studio.addActivity(`${item.name} analysis package started`); studio.markDirty(); studio.renderAll(); studio.toast("Analysis package applied.");
  }

  function completionItems() {
    const p = project(), data = dataset();
    return [
      ["Evidence connected", !!p.datasets.length, p.datasets.length ? `${p.datasets.length} dataset${p.datasets.length === 1 ? "" : "s"}` : "Add a source"],
      ["Decision defined", !!String(p.goal || "").trim(), p.goal ? "Goal documented" : "Describe the decision"],
      ["Meaning documented", !!(p.glossary.length || p.mappings.length), `${p.glossary.length} terms · ${p.mappings.length} mappings`],
      ["Quality checked", !!(p.rules.length || p.anomalies.length || p.cleaningSuggestions.length), `${p.rules.length} rules`],
      ["Privacy reviewed", !!p.privacyFindings.length || !!data?.redacted, p.privacyFindings.length ? `${p.privacyFindings.length} findings` : "Run privacy scan"],
      ["Analysis completed", !!(p.metrics.length || p.analystPlans.length || p.dashboardPlans.length), `${p.metrics.length} metrics · ${p.analystPlans.length} plans`],
      ["Story prepared", !!(p.stories.length || p.report), p.stories.length ? "Executive story ready" : "Generate a story"],
      ["Approval recorded", p.projectStatus === "Approved" || p.projectStatus === "Published", p.projectStatus || "Draft"]
    ];
  }
  function renderCompletion() {
    const items = completionItems(), done = items.filter(item => item[1]).length, score = Math.round(done / items.length * 100); $("#completion-score").textContent = `${score}%`;
    $("#completion-checklist").innerHTML = items.map(([title, complete, detail]) => `<div class="completion-item ${complete ? "done" : ""}"><i>${complete ? "✓" : "·"}</i><div><strong>${esc(title)}</strong><span>${esc(detail)}</span></div></div>`).join("");
  }

  function scanCleaning() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first."); const suggestions = [];
    const blankRows = data.rows.filter(row => columns(data).every(column => String(row[column] ?? "").trim() === "")).length;
    if (blankRows) suggestions.push({ id: studio.uid("fix"), datasetId: data.id, type: "blankRows", title: "Remove fully blank rows", detail: `${blankRows} rows contain no values.`, count: blankRows, selected: true });
    const seen = new Set(), duplicates = data.rows.reduce((count, row) => { const key = JSON.stringify(row); if (seen.has(key)) return count + 1; seen.add(key); return count; }, 0);
    if (duplicates) suggestions.push({ id: studio.uid("fix"), datasetId: data.id, type: "duplicates", title: "Remove exact duplicates", detail: `${duplicates} repeated rows detected.`, count: duplicates, selected: true });
    columns(data).forEach(column => {
      const values = data.rows.map(row => row[column]).filter(value => typeof value === "string" && value);
      const whitespace = values.filter(value => value !== value.trim()).length;
      if (whitespace) suggestions.push({ id: studio.uid("fix"), datasetId: data.id, type: "trim", column, title: `Trim ${column}`, detail: `${whitespace} values contain leading or trailing whitespace.`, count: whitespace, selected: true });
      const numericLike = values.filter(value => /^\s*[-+]?[$€£]?\s*\d[\d,]*(\.\d+)?%?\s*$/.test(value)).length;
      if (numericLike >= Math.max(3, values.length * .7) && values.some(value => /[$€£,%]/.test(value))) suggestions.push({ id: studio.uid("fix"), datasetId: data.id, type: "numeric", column, title: `Standardize ${column} as numbers`, detail: `${numericLike} formatted numeric values can be converted for analysis.`, count: numericLike, selected: true });
      const groups = new Map(); values.forEach(value => { const key = value.trim().toLowerCase(); if (!groups.has(key)) groups.set(key, new Map()); const forms = groups.get(key); forms.set(value.trim(), (forms.get(value.trim()) || 0) + 1); });
      const variant = [...groups].find(([, forms]) => forms.size > 1);
      if (variant) { const canonical = [...variant[1]].sort((a, b) => b[1] - a[1])[0][0]; suggestions.push({ id: studio.uid("fix"), datasetId: data.id, type: "case", column, fromKey: variant[0], to: canonical, title: `Unify labels in ${column}`, detail: `${[...variant[1].keys()].join(", ")} → ${canonical}`, selected: true }); }
      const nonblank = data.rows.filter(row => row[column] !== "" && row[column] != null), missing = data.rows.length - nonblank.length;
      if (missing && isNumeric(data, column)) { const valuesNum = numericValues(data, column).sort((a, b) => a - b), median = valuesNum[Math.floor(valuesNum.length / 2)]; suggestions.push({ id: studio.uid("fix"), datasetId: data.id, type: "median", column, value: median, title: `Review missing ${column}`, detail: `${missing} blanks; optionally fill with median ${format(median)}.`, count: missing, selected: false }); }
    });
    project().cleaningSuggestions = project().cleaningSuggestions.filter(item => item.datasetId !== data.id).concat(suggestions); studio.markDirty(); renderCleaning(); studio.toast(suggestions.length ? `${suggestions.length} suggested fix${suggestions.length === 1 ? "" : "es"} ready for review.` : "No common cleaning issues found.");
  }
  function renderCleaning() {
    const data = dataset(), items = project().cleaningSuggestions.filter(item => item.datasetId === data?.id); const target = $("#cleaning-queue");
    target.innerHTML = items.length ? items.map(item => `<label class="review-item"><input type="checkbox" data-cleaning-id="${item.id}" ${item.selected ? "checked" : ""}><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div><code>${esc(item.type)}</code></label>`).join("") : '<div class="lab-result empty">Scan the active dataset to create a review queue.</div>';
    $$('[data-cleaning-id]').forEach(input => input.onchange = () => { const item = project().cleaningSuggestions.find(entry => entry.id === input.dataset.cleaningId); if (item) item.selected = input.checked; studio.markDirty(); });
  }
  function applyCleaning() {
    const data = dataset(), items = project().cleaningSuggestions.filter(item => item.datasetId === data?.id && item.selected); if (!data || !items.length) return studio.toast("Select at least one suggested fix."); checkpoint(`Cleaned ${data.name}`);
    items.forEach(item => {
      if (item.type === "blankRows") data.rows = data.rows.filter(row => columns(data).some(column => String(row[column] ?? "").trim() !== ""));
      if (item.type === "duplicates") { const seen = new Set(); data.rows = data.rows.filter(row => { const key = JSON.stringify(row); if (seen.has(key)) return false; seen.add(key); return true; }); }
      if (item.type === "trim") data.rows.forEach(row => { if (typeof row[item.column] === "string") row[item.column] = row[item.column].trim(); });
      if (item.type === "numeric") data.rows.forEach(row => { const value = numberValue(row[item.column]); if (value !== null) row[item.column] = value; });
      if (item.type === "case") data.rows.forEach(row => { if (String(row[item.column] ?? "").trim().toLowerCase() === item.fromKey) row[item.column] = item.to; });
      if (item.type === "median") data.rows.forEach(row => { if (row[item.column] === "" || row[item.column] == null) row[item.column] = item.value; });
    });
    project().cleaningSuggestions = project().cleaningSuggestions.filter(item => item.datasetId !== data.id); studio.addActivity(`${items.length} reviewed cleaning fixes applied`); studio.markDirty(); studio.renderAll(); studio.toast("Selected fixes applied. You can undo them.");
  }
  function renderCompareControls() {
    const options = project().datasets.map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join(""), before = $("#compare-before"), after = $("#compare-after"), previousBefore = before.value, previousAfter = after.value;
    before.innerHTML = options; after.innerHTML = options; if (project().datasets.some(item => item.id === previousBefore)) before.value = previousBefore; if (project().datasets.some(item => item.id === previousAfter)) after.value = previousAfter; else if (project().datasets[1]) after.value = project().datasets[1].id;
  }
  function compareDatasets() {
    const before = project().datasets.find(item => item.id === $("#compare-before").value), after = project().datasets.find(item => item.id === $("#compare-after").value), key = $("#compare-key").value.trim(); if (!before || !after || before.id === after.id) return studio.toast("Choose two different datasets.");
    const beforeCols = columns(before), afterCols = columns(after), addedCols = afterCols.filter(column => !beforeCols.includes(column)), removedCols = beforeCols.filter(column => !afterCols.includes(column)); let added = 0, removed = 0, changed = 0;
    if (key && beforeCols.includes(key) && afterCols.includes(key)) {
      const a = new Map(before.rows.map(row => [String(row[key]), row])), b = new Map(after.rows.map(row => [String(row[key]), row])); added = [...b.keys()].filter(id => !a.has(id)).length; removed = [...a.keys()].filter(id => !b.has(id)).length; changed = [...a.keys()].filter(id => b.has(id) && JSON.stringify(a.get(id)) !== JSON.stringify(b.get(id))).length;
    } else { const a = new Set(before.rows.map(JSON.stringify)), b = new Set(after.rows.map(JSON.stringify)); added = [...b].filter(row => !a.has(row)).length; removed = [...a].filter(row => !b.has(row)).length; }
    const movements = beforeCols.filter(column => afterCols.includes(column) && isNumeric(before, column) && isNumeric(after, column)).map(column => { const oldValue = numericValues(before, column).reduce((a, b) => a + b, 0), newValue = numericValues(after, column).reduce((a, b) => a + b, 0); return { column, oldValue, newValue, delta: newValue - oldValue, pct: oldValue ? (newValue - oldValue) / Math.abs(oldValue) * 100 : null }; }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
    $("#compare-result").className = "lab-result"; $("#compare-result").innerHTML = `<strong>${esc(before.name)} → ${esc(after.name)}</strong><br>${added} added · ${removed} removed${key ? ` · ${changed} changed by ${esc(key)}` : ""}<br>${addedCols.length} new fields · ${removedCols.length} removed fields${movements.length ? `<br><br><b>Largest numeric movements</b><br>${movements.map(item => `${esc(item.column)}: ${format(item.oldValue)} → ${format(item.newValue)} (${item.pct == null ? "new baseline" : `${item.pct >= 0 ? "+" : ""}${format(item.pct)}%`})`).join("<br>")}` : ""}`;
  }
  function renderHistory() { const items = project().changeHistory || []; $("#change-history").innerHTML = items.length ? items.map((item, index) => `<div class="history-entry"><strong>${index === 0 ? "Undo available · " : ""}${esc(item.label)}</strong><span>${new Date(item.at).toLocaleString()}</span></div>`).join("") : '<div class="lab-result empty">Analyst Lab changes will appear here with an undo snapshot.</div>'; }

  function renderFieldControls() {
    const data = dataset(), names = columns(data), option = (blank = false) => `${blank ? '<option value="">None</option>' : ""}${names.map(name => `<option>${esc(name)}</option>`).join("")}`;
    $("#field-chips").innerHTML = names.map(name => `<button class="field-chip" draggable="true" data-field="${esc(name)}">${esc(name)}</button>`).join("");
    $("#explore-category").innerHTML = option(true); $("#explore-value").innerHTML = option(true); $("#explore-filter").innerHTML = option(true); $("#text-column").innerHTML = names.filter(name => !isNumeric(data, name)).map(name => `<option>${esc(name)}</option>`).join("");
    const numeric = names.filter(name => isNumeric(data, name)), dates = names.filter(name => isDate(data, name));
    $("#forecast-value").innerHTML = numeric.map(name => `<option>${esc(name)}</option>`).join(""); $("#forecast-time").innerHTML = '<option value="">Row order</option>' + dates.map(name => `<option>${esc(name)}</option>`).join("");
    $("#stats-field-a").innerHTML = option(); $("#stats-field-b").innerHTML = option();
    $$('[data-field]').forEach(chip => chip.ondragstart = event => event.dataTransfer.setData("text/plain", chip.dataset.field));
    $$('.field-drop').forEach(zone => { zone.ondragover = event => { event.preventDefault(); zone.classList.add("dragover"); }; zone.ondragleave = () => zone.classList.remove("dragover"); zone.ondrop = event => { event.preventDefault(); zone.classList.remove("dragover"); const field = event.dataTransfer.getData("text/plain"), select = zone.querySelector("select"); if ([...select.options].some(item => item.value === field)) select.value = field; }; });
  }
  function buildExploration() {
    const data = dataset(), category = $("#explore-category").value, value = $("#explore-value").value, filter = $("#explore-filter").value; if (!data || (!category && !value)) return studio.toast("Choose a category or value field.");
    let rows = data.rows; if (filter) rows = rows.filter(row => row[filter] !== "" && row[filter] != null); const groups = new Map();
    rows.forEach(row => { const label = category ? String(row[category] ?? "(blank)") : "All records", amount = value ? numberValue(row[value]) : 1; if (amount !== null) groups.set(label, (groups.get(label) || 0) + amount); });
    const items = [...groups].map(([label, amount]) => ({ label, value: amount })).sort((a, b) => b.value - a.value); $("#exploration-result").innerHTML = `<strong>${esc(value || "Records")} ${category ? `by ${esc(category)}` : ""}</strong><div style="height:10px"></div>${barRows(items)}`;
  }
  function runGeography() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first."); const names = columns(data), lat = names.find(name => /^lat(itude)?$/i.test(name)), lon = names.find(name => /^(lon|lng|longitude)$/i.test(name));
    if (lat && lon) { const points = data.rows.map(row => ({ x: numberValue(row[lon]), y: numberValue(row[lat]) })).filter(point => point.x !== null && point.y !== null); if (!points.length) return studio.toast("Location fields were found but contain no usable coordinates."); const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y)); $("#geography-result").className = "visual-result"; $("#geography-result").innerHTML = `<strong>${points.length} coordinate records</strong><svg viewBox="0 0 600 260" role="img" aria-label="Coordinate distribution" style="width:100%;margin-top:10px;background:var(--sn-surface-2);border-radius:10px">${points.slice(0, 800).map(point => { const x = 20 + (point.x - minX) / Math.max(1, maxX - minX) * 560, y = 240 - (point.y - minY) / Math.max(1, maxY - minY) * 220; return `<circle cx="${x}" cy="${y}" r="3" fill="#0062f1" opacity=".55"/>`; }).join("")}</svg>`; return; }
    const region = names.find(name => /state|region|country|province|territory|zip|postal|city/i.test(name)); if (!region) { $("#geography-result").className = "visual-result empty"; $("#geography-result").textContent = "No geographic field was detected. Rename a field to state, region, country, city, ZIP, latitude, or longitude."; return; }
    const counts = new Map(); data.rows.forEach(row => { const key = String(row[region] ?? "(blank)"); counts.set(key, (counts.get(key) || 0) + 1); }); $("#geography-result").className = "visual-result"; $("#geography-result").innerHTML = `<strong>Concentration by ${esc(region)}</strong><div style="height:10px"></div>${barRows([...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value))}`;
  }
  function analyzeText() {
    const data = dataset(), column = $("#text-column").value; if (!data || !column) return studio.toast("Choose a text field."); const responses = data.rows.map(row => String(row[column] ?? "").trim()).filter(Boolean); if (!responses.length) return studio.toast("That field has no text to analyze.");
    const counts = new Map(); let positive = 0, negative = 0;
    responses.forEach(response => response.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word)).forEach(word => { counts.set(word, (counts.get(word) || 0) + 1); if (positiveWords.has(word)) positive++; if (negativeWords.has(word)) negative++; }));
    const themes = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10), sentiment = positive + negative ? Math.round((positive - negative) / (positive + negative) * 100) : 0, quote = responses.sort((a, b) => Math.abs(a.length - 130) - Math.abs(b.length - 130))[0];
    $("#text-analysis-result").innerHTML = `<div class="text-insight"><strong>Top themes</strong><p>${themes.map(([word, count]) => `${esc(word)} (${count})`).join(" · ")}</p></div><div class="text-insight"><strong>Sentiment signal</strong><p>${sentiment > 20 ? "Mostly positive" : sentiment < -20 ? "Mostly negative" : "Mixed or neutral"} (${sentiment >= 0 ? "+" : ""}${sentiment}). Based on ${positive + negative} recognized sentiment words.</p></div><div class="text-insight"><strong>Representative response</strong><p>“${esc(quote.slice(0, 260))}${quote.length > 260 ? "…" : ""}”</p></div>`;
  }

  function linearRegression(values) {
    const n = values.length, xMean = (n - 1) / 2, yMean = mean(values), numerator = values.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0), denominator = values.reduce((sum, _, x) => sum + (x - xMean) ** 2, 0), slope = denominator ? numerator / denominator : 0, intercept = yMean - slope * xMean; return { slope, intercept };
  }
  function runForecast() {
    const data = dataset(), valueColumn = $("#forecast-value").value, timeColumn = $("#forecast-time").value, periods = Math.max(1, Math.min(24, Number($("#forecast-periods").value) || 6)), adjustment = Number($("#scenario-adjustment").value) / 100; if (!data || !valueColumn) return studio.toast("Choose a measurable field.");
    let rows = [...data.rows]; if (timeColumn) rows.sort((a, b) => new Date(a[timeColumn]) - new Date(b[timeColumn])); const values = rows.map(row => numberValue(row[valueColumn])).filter(value => value !== null); if (values.length < 3) return studio.toast("At least three numeric observations are required.");
    const model = linearRegression(values), forecast = Array.from({ length: periods }, (_, index) => Math.max(0, (model.intercept + model.slope * (values.length + index)) * (1 + adjustment))), all = values.concat(forecast), max = Math.max(...all), min = Math.min(...all), points = all.map((value, index) => `${20 + index / Math.max(1, all.length - 1) * 560},${230 - (value - min) / Math.max(1, max - min) * 200}`).join(" "); const split = 20 + (values.length - 1) / Math.max(1, all.length - 1) * 560;
    $("#forecast-result").className = "visual-result"; $("#forecast-result").innerHTML = `<strong>${esc(valueColumn)} forecast · ${model.slope >= 0 ? "upward" : "downward"} baseline</strong><p class="fine-print">Linear trend across ${values.length} observations; scenario adjustment ${adjustment >= 0 ? "+" : ""}${Math.round(adjustment * 100)}%. This is a planning baseline, not a guarantee.</p><svg viewBox="0 0 600 250" role="img" aria-label="Forecast line" style="width:100%"><line x1="${split}" x2="${split}" y1="15" y2="235" stroke="#dc6803" stroke-dasharray="5 5"/><polyline points="${points}" fill="none" stroke="#0062f1" stroke-width="4" stroke-linejoin="round"/><text x="${Math.min(525, split + 8)}" y="28" fill="#dc6803" font-size="11">Forecast</text></svg><b>Next values:</b> ${forecast.map(format).join(" · ")}`;
  }
  function pearson(a, b) { const pairs = a.map((x, i) => [x, b[i]]).filter(pair => pair.every(value => value !== null)); if (pairs.length < 3) return { r: NaN, n: pairs.length }; const ma = mean(pairs.map(p => p[0])), mb = mean(pairs.map(p => p[1])), numerator = pairs.reduce((sum, [x, y]) => sum + (x - ma) * (y - mb), 0), da = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - ma) ** 2, 0)), db = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - mb) ** 2, 0)); return { r: da && db ? numerator / (da * db) : NaN, n: pairs.length }; }
  function runStats() {
    const data = dataset(), a = $("#stats-field-a").value, b = $("#stats-field-b").value; if (!data || !a || !b || a === b) return studio.toast("Choose two different fields."); const aNum = isNumeric(data, a), bNum = isNumeric(data, b), target = $("#stats-result"); target.className = "lab-result";
    if (aNum && bNum) { const result = pearson(data.rows.map(row => numberValue(row[a])), data.rows.map(row => numberValue(row[b]))), strength = Math.abs(result.r) >= .7 ? "strong" : Math.abs(result.r) >= .4 ? "moderate" : Math.abs(result.r) >= .2 ? "weak" : "little"; target.innerHTML = `<strong>Pearson correlation</strong><br>r = ${format(result.r)} across ${result.n} complete pairs. This is a ${strength} ${result.r >= 0 ? "positive" : "negative"} linear relationship.<br><br><b>Plain-language meaning:</b> As ${esc(a)} increases, ${esc(b)} tends to ${result.r >= 0 ? "increase" : "decrease"}. Correlation alone does not establish causation.`; return; }
    const category = aNum ? b : a, measure = aNum ? a : b; if (isNumeric(data, measure)) { const groups = new Map(); data.rows.forEach(row => { const label = String(row[category] ?? "(blank)"), value = numberValue(row[measure]); if (value !== null) { if (!groups.has(label)) groups.set(label, []); groups.get(label).push(value); } }); const summaries = [...groups].map(([label, values]) => ({ label, value: mean(values), n: values.length })).sort((x, y) => y.value - x.value); const overall = mean(summaries.map(item => item.value)), spread = summaries.length ? (summaries[0].value - summaries[summaries.length - 1].value) : 0; target.innerHTML = `<strong>Group comparison</strong><br>Recommended next test: one-way ANOVA (or a nonparametric alternative if assumptions fail). The group means span ${format(spread)} around an overall mean of ${format(overall)}.<br><br>${summaries.slice(0, 8).map(item => `${esc(item.label)}: ${format(item.value)} (n=${item.n})`).join("<br>")}<br><br><b>Interpretation:</b> This preview shows practical differences; formal significance requires assumption checks and an inferential calculation.`; return; }
    const combos = new Map(); data.rows.forEach(row => { const key = `${row[a] ?? "(blank)"} × ${row[b] ?? "(blank)"}`; combos.set(key, (combos.get(key) || 0) + 1); }); const top = [...combos].sort((x, y) => y[1] - x[1]).slice(0, 8); target.innerHTML = `<strong>Categorical association</strong><br>Recommended test: chi-square test of independence. Review expected cell counts before trusting the test.<br><br>Most common combinations:<br>${top.map(([label, count]) => `${esc(label)}: ${count}`).join("<br>")}`;
  }

  function numericSummary(data = dataset()) { const names = columns(data).filter(name => isNumeric(data, name)); return names.slice(0, 4).map(name => { const values = numericValues(data, name); return { name, total: values.reduce((a, b) => a + b, 0), average: mean(values), count: values.length }; }); }
  function generateStory() {
    const p = project(), data = dataset(); if (!data) return studio.toast("Add a dataset first."); const nums = numericSummary(data), quality = p.rules.length ? `${p.rules.length} repeatable quality rules are defined` : "quality expectations still need to be formalized", privacy = p.privacyFindings.length ? `${p.privacyFindings.length} potentially sensitive fields require deliberate handling` : "no sensitive fields have been documented yet";
    const beats = [
      { title: "Situation", text: p.goal || `The team needs a trustworthy understanding of ${data.name}.` },
      { title: "Evidence", text: nums.length ? `${data.rows.length} records were reviewed. ${nums.map(item => `${item.name} totals ${format(item.total)} and averages ${format(item.average)}`).join("; ")}.` : `${data.rows.length} records and ${columns(data).length} fields were reviewed.` },
      { title: "Confidence", text: `The project currently has ${quality}; ${privacy}. Conclusions should be read within those limits.` },
      { title: "Meaning", text: p.glossary.length ? `${p.glossary.length} business definitions anchor the interpretation, reducing ambiguity across audiences.` : "The central business terms should be defined before broad distribution." },
      { title: "Recommendation", text: "Focus the decision on the largest measurable movement, validate it against a stable comparison period, and assign an owner to the response." },
      { title: "Next action", text: "Complete the quality and privacy gates, approve the evidence, then publish the report with a named follow-up date." }
    ];
    const story = { id: studio.uid("story"), title: `${p.name} decision story`, beats, createdAt: Date.now() }; p.stories.unshift(story); studio.markDirty(); renderStory(); studio.toast("Executive story generated.");
  }
  function renderStory() { const story = project().stories[0], target = $("#story-preview"); if (!story) { target.className = "story-preview empty"; target.textContent = "Generate a decision-ready narrative from the active project."; return; } target.className = "story-preview"; target.innerHTML = `<span class="eyebrow">${esc(story.title)}</span>${story.beats.map(beat => `<div class="story-beat"><h4>${esc(beat.title)}</h4><p>${esc(beat.text)}</p></div>`).join("")}`; }
  function coachPresentation() {
    const story = project().stories[0]; if (!story) return studio.toast("Generate the executive story first."); const notes = [
      ["Open with the decision", `Begin with: “Today we need to decide how to respond to ${project().goal || "the evidence in this project"}.”`],
      ["State the strongest evidence", story.beats.find(item => item.title === "Evidence")?.text || "Lead with one number, not the methodology."],
      ["Name the limitation yourself", story.beats.find(item => item.title === "Confidence")?.text || "Explain what the data can and cannot establish."],
      ["Likely question", "What changed compared with the last period, and could data quality explain the movement?"],
      ["Likely challenge", "Why should leadership trust the definition, source, and calculation behind this number? Use the metric lineage and contract."],
      ["Close with ownership", "End with one action, one owner, and one date—not a list of possibilities."]
    ]; $("#coach-result").innerHTML = notes.map(([title, text]) => `<div class="coach-note"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`).join("");
  }
  function buildDesignedReport() {
    const title = $("#designer-title").value.trim() || `${project().name} analysis`, theme = $("#designer-theme").value, selected = new Set($$('.designer-controls input[type=checkbox]:checked').map(input => input.value)), story = project().stories[0], nums = numericSummary(), sections = [];
    if (selected.has("summary")) sections.push(`<h2>Executive summary</h2><p>${esc(project().goal || "This report summarizes the available evidence and recommended action.")}</p>`);
    if (selected.has("metrics")) sections.push(`<h2>Key metrics</h2><ul>${nums.length ? nums.map(item => `<li><b>${esc(item.name)}:</b> total ${format(item.total)} · average ${format(item.average)}</li>`).join("") : "<li>No numeric metrics detected.</li>"}</ul>`);
    if (selected.has("quality")) sections.push(`<h2>Evidence quality</h2><p>${project().rules.length} quality rules · ${project().anomalies.length} anomaly findings · ${project().privacyFindings.length} privacy findings.</p>`);
    if (selected.has("story")) sections.push(`<h2>Analysis story</h2>${story ? story.beats.map(beat => `<h3>${esc(beat.title)}</h3><p>${esc(beat.text)}</p>`).join("") : "<p>Generate an executive story to populate this section.</p>"}`);
    if (selected.has("actions")) sections.push("<h2>Recommended actions</h2><ol><li>Validate the largest movement against a comparison period.</li><li>Resolve open quality and privacy findings.</li><li>Assign an owner and a follow-up date.</li></ol>");
    const content = `<h1>${esc(title)}</h1><p class="fine-print">Prepared ${esc(new Date().toLocaleDateString())} · ${esc(project().projectStatus || "Draft")}</p>${sections.join("")}`; const preview = $("#designed-report-preview"); preview.className = `designed-report ${theme}`; preview.innerHTML = content; return { title, theme, content };
  }
  function exportDesignedReport() {
    const report = buildDesignedReport(); project().reportDesigns.unshift({ id: studio.uid("design"), ...report, createdAt: Date.now() }); studio.markDirty(); const palettes = { executive: ["#00133c", "#0062f1", "#f4f7fb"], editorial: ["#3f3428", "#9a6b35", "#fffaf0"], modern: ["#172033", "#0062f1", "#eff6ff"] }, colors = palettes[report.theme];
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(report.title)}</title><style>body{margin:auto;max-width:900px;padding:56px 24px;background:${colors[2]};color:${colors[0]};font:16px/1.65 Arial,sans-serif}article{padding:48px;background:white;border-radius:20px;box-shadow:0 12px 40px #00133c14}h1{font:700 44px/1.05 Georgia;color:${colors[0]}}h2{margin-top:34px;color:${colors[1]}}h3{margin-bottom:4px}.fine-print{color:#64748b;font-size:12px}@media print{body{background:white}article{box-shadow:none;padding:0}}</style></head><body><article>${report.content}</article></body></html>`; downloadBlob(`${slug(report.title)}.html`, html, "text/html"); studio.addActivity("Designed report exported");
  }

  function parseSql(query) {
    const data = dataset(); if (!data) throw new Error("Add a dataset first."); const normalized = query.trim().replace(/;$/, ""), match = normalized.match(/^select\s+(.+?)\s+from\s+data(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+([\w ._-]+?)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i); if (!match) throw new Error("Use SELECT fields FROM data with optional WHERE, ORDER BY, and LIMIT.");
    const selected = match[1].trim() === "*" ? columns(data) : match[1].split(",").map(value => value.trim().replace(/^\[|\]$/g, "")); selected.forEach(column => { if (!columns(data).includes(column)) throw new Error(`Unknown field: ${column}`); }); let rows = [...data.rows];
    if (match[2]) { const condition = match[2].match(/^\[?([\w ._-]+?)\]?\s*(=|!=|>=|<=|>|<|contains|is null|is not null)\s*(.*)$/i); if (!condition) throw new Error("WHERE supports =, !=, >, <, >=, <=, CONTAINS, IS NULL, and IS NOT NULL."); const [, column, opRaw, raw] = condition, op = opRaw.toLowerCase(), compare = raw.trim().replace(/^['"]|['"]$/g, ""); if (!columns(data).includes(column)) throw new Error(`Unknown WHERE field: ${column}`); rows = rows.filter(row => { const value = row[column], a = numberValue(value), b = numberValue(compare); if (op === "is null") return value === "" || value == null; if (op === "is not null") return value !== "" && value != null; if (op === "contains") return String(value ?? "").toLowerCase().includes(compare.toLowerCase()); if (op === "=") return String(value ?? "").toLowerCase() === compare.toLowerCase(); if (op === "!=") return String(value ?? "").toLowerCase() !== compare.toLowerCase(); const left = a ?? String(value ?? ""), right = b ?? compare; return op === ">" ? left > right : op === "<" ? left < right : op === ">=" ? left >= right : left <= right; }); }
    if (match[3]) { const column = match[3].trim(); if (!columns(data).includes(column)) throw new Error(`Unknown ORDER BY field: ${column}`); const direction = match[4]?.toLowerCase() === "desc" ? -1 : 1; rows.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? ""), undefined, { numeric: true }) * direction); }
    const limit = Math.min(500, Number(match[5]) || 100); return { rows: rows.slice(0, limit).map(row => Object.fromEntries(selected.map(column => [column, row[column]]))), columns: selected, total: rows.length };
  }
  function runSql() {
    const target = $("#sql-result"); try { const result = parseSql($("#sql-query").value); lastQueryRows = result.rows; target.innerHTML = `<table><thead><tr>${result.columns.map(column => `<th>${esc(column)}</th>`).join("")}</tr></thead><tbody>${result.rows.map(row => `<tr>${result.columns.map(column => `<td>${esc(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="fine-print">Showing ${result.rows.length} of ${result.total} matching rows.</p>`; } catch (error) { target.innerHTML = `<div class="lab-result risk-high"><strong>Query could not run</strong><br>${esc(error.message)}</div>`; }
  }
  function writeSql() {
    const request = prompt("What records do you want to see?", "Show the 20 largest records by amount"); if (!request || !dataset()) return; const names = columns(), lower = request.toLowerCase(), numeric = names.find(name => isNumeric(dataset(), name) && lower.includes(name.toLowerCase())) || names.find(name => isNumeric(dataset(), name)); let query = "SELECT * FROM data";
    const mentioned = names.find(name => lower.includes(name.toLowerCase())); if (/missing|blank|null/.test(lower) && mentioned) query += ` WHERE [${mentioned}] IS NULL`; if (/largest|highest|top/.test(lower) && numeric) query += ` ORDER BY ${numeric} DESC`; if (/smallest|lowest|bottom/.test(lower) && numeric) query += ` ORDER BY ${numeric} ASC`; const limit = lower.match(/\b(\d{1,3})\b/)?.[1] || "20"; query += ` LIMIT ${limit}`; $("#sql-query").value = query; runSql();
  }
  function codeFor(language) {
    const data = dataset(), filename = data?.name || "data.csv", steps = project().steps.map(step => step.type);
    if (language === "python") return `import pandas as pd\n\ndf = pd.read_csv("${filename.replace(/"/g, "")}.csv")\n${steps.includes("clean") ? "df = df.dropna(how=\"all\")\ndf = df.apply(lambda col: col.str.strip() if col.dtype == \"object\" else col)\n" : ""}${steps.includes("dedupe") ? "df = df.drop_duplicates()\n" : ""}\n# Reproduce the Studio review\nprint(df.info())\nprint(df.describe(include=\"all\").transpose())\n`;
    if (language === "r") return `df <- read.csv("${filename.replace(/"/g, "")}.csv", stringsAsFactors = FALSE)\n${steps.includes("clean") ? "df <- df[rowSums(is.na(df) | df == \"\") < ncol(df), ]\n" : ""}${steps.includes("dedupe") ? "df <- unique(df)\n" : ""}\nsummary(df)\n`;
    return `-- Load the exported dataset as data\nSELECT *\nFROM data\nLIMIT 100;\n\n-- Profile row count\nSELECT COUNT(*) AS row_count\nFROM data;\n`;
  }
  function renderCode() { $("#code-preview").textContent = codeFor(codeLanguage); $$('[data-code-language]').forEach(button => button.classList.toggle("active", button.dataset.codeLanguage === codeLanguage)); $("#download-code-btn").textContent = `Download ${codeLanguage === "r" ? "R" : codeLanguage[0].toUpperCase() + codeLanguage.slice(1)}`; }
  function generateSynthetic() {
    const data = dataset(), count = Math.max(10, Math.min(5000, Number($("#synthetic-rows").value) || 100)); if (!data) return studio.toast("Add a dataset first."); checkpoint(`Generated synthetic copy of ${data.name}`); const names = columns(data), privacy = new Map(project().privacyFindings.filter(item => item.datasetId === data.id).map(item => [item.column, item.type]));
    const rows = Array.from({ length: count }, (_, index) => Object.fromEntries(names.map(column => { const source = data.rows[index % data.rows.length] || {}, observed = data.rows.map(row => row[column]).filter(value => value !== "" && value != null), missingRate = 1 - observed.length / Math.max(1, data.rows.length); if (Math.random() < missingRate) return [column, ""]; const type = privacy.get(column); if (type === "email") return [column, `person${index + 1}@example.org`]; if (type === "phone") return [column, `555-01${String(index % 100).padStart(2, "0")}`]; if (type === "name") return [column, `Synthetic Person ${index + 1}`]; if (type === "identifier" || /(^|_)id$/i.test(column)) return [column, `SYN-${String(index + 1).padStart(6, "0")}`]; if (type === "address") return [column, `${100 + index} Example Street`]; if (isNumeric(data, column)) { const values = numericValues(data, column), avg = mean(values), sd = Math.sqrt(mean(values.map(value => (value - avg) ** 2))) || Math.abs(avg) * .05 || 1, generated = avg + (Math.random() + Math.random() + Math.random() - 1.5) * sd * 1.7; return [column, Number(generated.toFixed(2))]; } if (isDate(data, column)) { const base = new Date(observed[Math.floor(Math.random() * observed.length)] || Date.now()), shift = Math.floor((Math.random() - .5) * 60); base.setDate(base.getDate() + shift); return [column, base.toISOString().slice(0, 10)]; } return [column, observed[Math.floor(Math.random() * observed.length)] ?? source[column] ?? ""]; })));
    const synthetic = { id: studio.uid("dataset"), name: `${data.name} (synthetic)`, rows, source: `Synthetic structure based on ${data.name}`, importedAt: Date.now(), synthetic: true }; project().datasets.push(synthetic); project().activeDatasetId = synthetic.id; $("#synthetic-result").className = "lab-result risk-low"; $("#synthetic-result").innerHTML = `<strong>Synthetic dataset created</strong><br>${count} fake rows preserve broad types, ranges, categories, and missingness. They are not suitable for inferential conclusions.`; studio.addActivity("Synthetic dataset created"); studio.markDirty(); studio.renderAll();
  }

  function deliverableChecks() {
    const p = project(), data = dataset(), checks = [
      ["Evidence is connected", !!data, "A selected dataset supports the deliverable."],
      ["Decision is stated", !!String(p.goal || "").trim(), "The reader knows what decision this work informs."],
      ["Conclusions have evidence", !!(p.metrics.length || numericSummary().length), "At least one measurable result supports the narrative."],
      ["Definitions are consistent", !!p.glossary.length, "Important business terms are defined once."],
      ["Quality is documented", !!p.rules.length, "Repeatable expectations are recorded."],
      ["Privacy was reviewed", !!p.privacyFindings.length || !!data?.redacted || !!data?.synthetic, "Sensitive fields were scanned or a safe copy is used."],
      ["Story includes limitations", !!p.stories[0]?.beats.some(beat => beat.title === "Confidence"), "The audience can separate evidence from uncertainty."],
      ["Approval is recorded", ["Approved", "Published"].includes(p.projectStatus), "A named review decision exists."],
      ["Accessible presentation", !!p.stories.length || !!p.report, "The output has text explanations beyond color and charts."]
    ]; return checks;
  }
  function runDeliverableCheck() {
    const checks = deliverableChecks(); $("#deliverable-checks").innerHTML = checks.map(([title, done, detail]) => `<div class="completion-item ${done ? "done" : ""}"><i>${done ? "✓" : "!"}</i><div><strong>${esc(title)}</strong><span>${esc(detail)}</span></div></div>`).join(""); const passed = checks.filter(item => item[1]).length; studio.toast(`${passed} of ${checks.length} final checks passed.`);
  }
  function renderLearning(topic = "copilot") {
    const lessons = {
      copilot: ["Start with the decision", "A useful analysis begins with the action someone must take. A vague goal produces impressive charts but weak decisions.", "Common mistake: asking to “find insights” without defining the audience or consequence."],
      prepare: ["Clean transparently", "A fix should be reviewable, reversible, and recorded. Never silently replace values just because they look unusual.", "Common mistake: treating every outlier as an error."],
      explore: ["Aggregate with intent", "Choose a category that represents a meaningful group and a measure whose calculation is understood.", "Common mistake: comparing totals when group sizes differ dramatically."],
      model: ["Models are assumptions", "Forecasts extend patterns; they do not know about future policy, shocks, or structural changes.", "Common mistake: presenting a trend line as certainty."],
      story: ["Lead with meaning", "Decision-makers need the conclusion, evidence, limitation, and action—not a tour of every chart.", "Common mistake: saving the recommendation for the final slide."],
      reproduce: ["Reproducibility builds trust", "Code and queries let another analyst recreate the result and inspect each assumption.", "Common mistake: exporting code without documenting the input version."],
      organization: ["Governance is operational", "Ownership, definitions, privacy, quality, and approval must live in the workflow, not a forgotten policy document.", "Common mistake: treating publication as the first review point."]
    }, lesson = lessons[topic] || lessons.copilot; $("#learning-card").hidden = !project().learningMode; $("#learning-card").innerHTML = `<h4>${esc(lesson[0])}</h4><p>${esc(lesson[1])}</p><p><b>${esc(lesson[2])}</b></p>`;
  }
  function applyBrand() {
    const branding = { name: $("#brand-name").value.trim() || "Signal Noir", primary: $("#brand-primary").value, accent: $("#brand-accent").value, analystName: $("#brand-analyst-name").value.trim() || "Vanessa", dataTerm: $("#brand-language").value }; project().branding = branding; studio.markDirty(); applyBranding(); studio.addActivity("Organization portal brand updated"); studio.toast("Portal branding applied.");
  }
  function applyBranding() {
    const brand = project().branding || { name: "Signal Noir", primary: "#00133c", accent: "#0062f1", analystName: "Vanessa", dataTerm: "Dataset" }; document.documentElement.style.setProperty("--navy", brand.primary); document.documentElement.style.setProperty("--blue", brand.accent); $("#brand-name").value = brand.name; $("#brand-primary").value = brand.primary; $("#brand-accent").value = brand.accent; $("#brand-analyst-name").value = brand.analystName; $("#brand-language").value = brand.dataTerm; $("#brand-preview").style.background = brand.primary; $("#brand-preview-mark").style.background = brand.accent; $("#brand-preview-mark").textContent = brand.name[0]?.toUpperCase() || "D"; $("#brand-preview-name").textContent = brand.name; $("#brand-preview-tagline").textContent = `${brand.analystName} · trusted analytics workspace`; $("#view-analyst .view-heading .eyebrow").textContent = `${brand.analystName} analyst lab`; $(".vanessa-lockup > span").textContent = brand.analystName[0]?.toUpperCase() || "V"; $("#view-data .view-heading h2").textContent = `${brand.dataTerm} catalog`; const sourceLabel = $(".source-guide-copy .eyebrow"); if (sourceLabel) sourceLabel.textContent = `${brand.analystName}’s connection guide`;
  }

  function renderAll() {
    if (!project()) return; renderPackages(); renderCompletion(); renderCleaning(); renderCompareControls(); renderHistory(); renderFieldControls(); renderStory(); buildDesignedReport(); renderCode(); applyBranding(); $("#learning-mode-toggle").checked = !!project().learningMode; const active = $('[data-analyst-tab].active')?.dataset.analystTab || "copilot"; renderLearning(active);
  }
  function bind() {
    bindTabs();
    $("#copilot-form").onsubmit = event => { event.preventDefault(); const goal = $("#copilot-goal").value.trim(); if (!goal) return studio.toast("Describe the decision first."); buildCopilotPlan(goal); };
    $("#refresh-completion-btn").onclick = renderCompletion; $("#scan-cleaning-btn").onclick = scanCleaning; $("#apply-cleaning-btn").onclick = applyCleaning; $("#undo-change-btn").onclick = undoLast; $("#compare-btn").onclick = compareDatasets;
    $("#build-exploration-btn").onclick = buildExploration; $("#run-geography-btn").onclick = runGeography; $("#run-text-analysis-btn").onclick = analyzeText; $("#scenario-adjustment").oninput = event => { $("#scenario-label").textContent = `${event.target.value}%`; }; $("#run-forecast-btn").onclick = runForecast; $("#run-stats-btn").onclick = runStats;
    $("#generate-story-btn").onclick = generateStory; $("#coach-presentation-btn").onclick = coachPresentation; $("#preview-designed-report-btn").onclick = buildDesignedReport; $("#export-designed-report-btn").onclick = exportDesignedReport; $$("#designer-title,#designer-theme,.designer-controls input[type=checkbox]").forEach(input => input.onchange = buildDesignedReport);
    $("#run-sql-btn").onclick = runSql; $("#write-sql-btn").onclick = writeSql; $$('[data-code-language]').forEach(button => button.onclick = () => { codeLanguage = button.dataset.codeLanguage; renderCode(); }); $("#download-code-btn").onclick = () => { const extensions = { python: "py", r: "R", sql: "sql" }; downloadBlob(`${slug(project().name)}-analysis.${extensions[codeLanguage]}`, codeFor(codeLanguage), "text/plain"); }; $("#generate-synthetic-btn").onclick = generateSynthetic;
    $("#run-deliverable-check-btn").onclick = runDeliverableCheck; $("#learning-mode-toggle").onchange = event => { project().learningMode = event.target.checked; studio.markDirty(); renderLearning($('[data-analyst-tab].active')?.dataset.analystTab); }; $("#apply-brand-btn").onclick = applyBrand;
    window.addEventListener("datahub:project-render", renderAll); renderAll();
  }
  bind();
})();
