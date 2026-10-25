(function () {
  "use strict";
  const studio = window.DataHubStudio;
  if (!studio) return;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const esc = studio.escapeHtml;
  const roles = ["Identifier", "Timeline", "Measure", "Dimension", "Description", "Sensitive", "Ignore"];
  const statuses = ["Draft", "Reviewed", "Approved", "Published"];

  const templates = [
    { name: "Recruitment tracking", detail: "Pipeline, time-to-fill, source quality, and candidate privacy.", goal: "Track recruiting pipeline health and time-to-fill", steps: ["clean", "quality", "analyze", "report"], terms: [["Time to fill", "Days from requisition opened to accepted offer"]] },
    { name: "Admissions evaluation", detail: "Application stages, review consistency, outcomes, and sensitive fields.", goal: "Monitor admissions volume, review progress, and outcomes", steps: ["clean", "dedupe", "quality", "analyze"], terms: [["Completed application", "An application with all required materials received"]] },
    { name: "Internship reporting", detail: "Placement, participation, completion, and supervisor outcomes.", goal: "Report internship participation and successful completion", steps: ["clean", "quality", "analyze", "report"], terms: [["Completion rate", "Completed internships divided by started internships"]] },
    { name: "Monthly business review", detail: "Core KPIs, changes, risks, and executive narrative.", goal: "Prepare a repeatable monthly business review", steps: ["clean", "quality", "analyze", "dashboard", "report"], terms: [["Reporting month", "Calendar month represented by the current data refresh"]] },
    { name: "Survey analysis", detail: "Response cleaning, segments, score trends, and verbatim review.", goal: "Analyze survey scores and response themes", steps: ["clean", "analyze", "report"], terms: [["Response rate", "Submitted responses divided by invited participants"]] },
    { name: "Quality audit", detail: "Required values, duplicate checks, schema contract, and exceptions.", goal: "Audit a dataset for completeness, validity, and duplicates", steps: ["clean", "dedupe", "quality", "report"], terms: [["Valid record", "A row that passes every active quality rule"]] },
    { name: "Budget vs actuals", detail: "Variance, burn rate, cost centers, and forecast readiness.", goal: "Compare budget to actual spending and explain material variance", steps: ["clean", "derive", "quality", "analyze", "report"], terms: [["Variance", "Actual amount minus budget amount"]] }
  ];
  const readinessTopics = ["Named data owner", "Shared metric definitions", "Repeatable quality checks", "Automated refresh path", "Role-based access", "Review and approval process"];

  function project() { return studio.state.project; }
  function dataset() { return studio.activeDataset(); }
  function columns(data = dataset()) { return data?.rows?.length ? Object.keys(data.rows[0]) : (data?.columns || []); }
  function numericValues(data, column) { return (data?.rows || []).map(row => Number(String(row[column] ?? "").replace(/[$,%\s,]/g, ""))).filter(Number.isFinite); }
  function roleFor(column, data) {
    const name = column.toLowerCase();
    if (/email|phone|mobile|ssn|social.?security|address|birth|dob|name|account/.test(name)) return "Sensitive";
    if (/(^|_)(id|key|uuid|code|number|no)$/.test(name) || /_id$/.test(name)) return "Identifier";
    if (/date|time|month|year|quarter|week/.test(name)) return "Timeline";
    const values = numericValues(data, column);
    if (values.length >= Math.max(2, (data?.rows?.length || 0) * .7)) return "Measure";
    const unique = new Set((data?.rows || []).map(row => String(row[column] ?? ""))).size;
    if (unique <= Math.max(20, (data?.rows?.length || 0) * .2)) return "Dimension";
    return "Description";
  }
  function mappingFor(data = dataset()) {
    if (!data) return null;
    let mapping = project().mappings.find(item => item.datasetId === data.id);
    if (!mapping) { mapping = { id: studio.uid("mapping"), datasetId: data.id, fields: {} }; project().mappings.push(mapping); }
    return mapping;
  }
  function touch(message) { studio.addActivity(message); studio.markDirty(); render(); }
  function now() { return new Date().toLocaleString(); }
  function nameMatch(query, names) {
    const lower = query.toLowerCase();
    return names.find(name => lower.includes(name.toLowerCase())) || names.find(name => name.toLowerCase().split(/[_\s-]+/).some(part => part.length > 3 && lower.includes(part)));
  }
  function format(value) { return Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : "—"; }
  function itemHtml(title, detail, action = "") { return `<div class="intel-item"><div class="intel-item-head"><strong>${esc(title)}</strong>${action}</div><p>${esc(detail)}</p></div>`; }

  function renderTabs() {
    $$('[data-intel-tab]').forEach(button => button.onclick = () => {
      $$('[data-intel-tab]').forEach(node => node.classList.toggle("active", node === button));
      $$(".intel-panel").forEach(panel => panel.classList.toggle("active", panel.id === `intel-${button.dataset.intelTab}`));
    });
  }
  function renderMapping() {
    const data = dataset(), body = $("#mapping-body");
    if (!data) { body.innerHTML = '<tr><td colspan="3">Add or select a dataset first.</td></tr>'; return; }
    const mapping = mappingFor(data);
    body.innerHTML = columns(data).map(column => {
      const role = mapping.fields[column] || roleFor(column, data);
      return `<tr><td><strong>${esc(column)}</strong></td><td>${esc(roleFor(column, data))}</td><td><select data-map-column="${esc(column)}" aria-label="${esc(`Role for ${column}`)}">${roles.map(value => `<option ${value === role ? "selected" : ""}>${value}</option>`).join("")}</select></td></tr>`;
    }).join("");
    $$('[data-map-column]').forEach(select => select.onchange = () => { mapping.fields[select.dataset.mapColumn] = select.value; studio.markDirty(); renderImpact(); });
  }
  function inferMappings() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first.");
    const mapping = mappingFor(data); columns(data).forEach(column => { mapping.fields[column] = roleFor(column, data); });
    touch("Column roles suggested"); studio.toast("Column roles updated.");
  }

  function populateJoinKeys(side) {
    const data = project().datasets.find(item => item.id === $(`#join-${side}`).value);
    $(`#join-${side}-key`).innerHTML = columns(data).map(column => `<option>${esc(column)}</option>`).join("");
  }
  function renderJoinControls() {
    const options = project().datasets.map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join("");
    const left = $("#join-left"), right = $("#join-right"), oldLeft = left.value, oldRight = right.value;
    left.innerHTML = options; right.innerHTML = options;
    if (project().datasets.some(item => item.id === oldLeft)) left.value = oldLeft;
    if (project().datasets.some(item => item.id === oldRight)) right.value = oldRight; else if (project().datasets[1]) right.value = project().datasets[1].id;
    populateJoinKeys("left"); populateJoinKeys("right");
  }
  function joinStats() {
    const left = project().datasets.find(item => item.id === $("#join-left").value), right = project().datasets.find(item => item.id === $("#join-right").value);
    const leftKey = $("#join-left-key").value, rightKey = $("#join-right-key").value;
    if (!left || !right || left.id === right.id || !leftKey || !rightKey) return null;
    const rightCounts = new Map(); right.rows.forEach(row => { const key = String(row[rightKey] ?? ""); rightCounts.set(key, (rightCounts.get(key) || 0) + 1); });
    const leftCounts = new Map(); left.rows.forEach(row => { const key = String(row[leftKey] ?? ""); leftCounts.set(key, (leftCounts.get(key) || 0) + 1); });
    const matched = left.rows.filter(row => rightCounts.has(String(row[leftKey] ?? ""))).length;
    const duplicateLeft = [...leftCounts.values()].filter(count => count > 1).length, duplicateRight = [...rightCounts.values()].filter(count => count > 1).length;
    const cardinality = duplicateLeft && duplicateRight ? "many-to-many" : duplicateLeft ? "many-to-one" : duplicateRight ? "one-to-many" : "one-to-one";
    return { left, right, leftKey, rightKey, matched, rate: left.rows.length ? matched / left.rows.length : 0, duplicateLeft, duplicateRight, cardinality, rightCounts };
  }
  function analyzeJoin() {
    const stats = joinStats(), target = $("#join-analysis");
    if (!stats) { target.className = "intel-result risk-medium"; target.innerHTML = "Choose two different datasets and valid key fields."; return; }
    const risk = stats.cardinality === "many-to-many" ? "risk-high" : stats.rate < .8 ? "risk-medium" : "risk-low";
    target.className = `intel-result ${risk}`;
    target.innerHTML = `<strong>${Math.round(stats.rate * 100)}% match · ${esc(stats.cardinality)}</strong><br>${stats.matched} of ${stats.left.rows.length} left-side rows match. Duplicate keys: ${stats.duplicateLeft} left, ${stats.duplicateRight} right.${stats.cardinality === "many-to-many" ? " Review this key: it may multiply rows." : ""}`;
  }
  function createJoin() {
    const stats = joinStats(); if (!stats) return studio.toast("Choose two different datasets and keys.");
    if (stats.cardinality === "many-to-many" && !confirm("This is a many-to-many join and can multiply rows. Create it anyway?")) return;
    window.DataHubAnalyst?.checkpoint("Created joined dataset");
    const rightIndex = new Map(); stats.right.rows.forEach(row => { const key = String(row[stats.rightKey] ?? ""); if (!rightIndex.has(key)) rightIndex.set(key, []); rightIndex.get(key).push(row); });
    const rows = [];
    stats.left.rows.forEach(leftRow => {
      const matches = rightIndex.get(String(leftRow[stats.leftKey] ?? "")) || [null];
      matches.forEach(rightRow => { const merged = { ...leftRow }; if (rightRow) Object.entries(rightRow).forEach(([key, value]) => { if (key !== stats.rightKey) merged[key in merged ? `${stats.right.name}_${key}` : key] = value; }); rows.push(merged); });
    });
    const joined = { id: studio.uid("dataset"), name: `${stats.left.name} + ${stats.right.name}`, rows, source: "Join assistant", importedAt: Date.now() };
    project().datasets.push(joined); project().activeDatasetId = joined.id;
    project().joins.push({ id: studio.uid("join"), leftDatasetId: stats.left.id, rightDatasetId: stats.right.id, leftKey: stats.leftKey, rightKey: stats.rightKey, rows: rows.length, createdAt: Date.now() });
    touch(`Joined ${stats.left.name} and ${stats.right.name}`); studio.renderAll(); studio.toast("Joined dataset created.");
  }

  function renderGlossary() {
    $("#glossary-list").innerHTML = project().glossary.length ? project().glossary.map(item => itemHtml(item.term, item.definition, `<button data-delete-glossary="${item.id}">Remove</button>`)).join("") : itemHtml("No definitions yet", "Add the language your team uses so reports stay consistent.");
    $$('[data-delete-glossary]').forEach(button => button.onclick = () => { project().glossary = project().glossary.filter(item => item.id !== button.dataset.deleteGlossary); touch("Glossary definition removed"); });
  }
  function metricFunction(data, name, column) {
    const values = numericValues(data, column);
    if (name === "COUNT") return column ? (data.rows || []).filter(row => String(row[column] ?? "").trim()).length : (data.rows || []).length;
    if (name === "COUNTD") return new Set((data.rows || []).map(row => String(row[column] ?? "")).filter(Boolean)).size;
    if (!values.length) return NaN;
    if (name === "SUM") return values.reduce((sum, value) => sum + value, 0);
    if (name === "AVG") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (name === "MIN") return Math.min(...values);
    if (name === "MAX") return Math.max(...values);
    return NaN;
  }
  function evaluateFormula(formula, data = dataset()) {
    if (!data) return { value: NaN, expanded: "No dataset" };
    let invalid = false;
    const expanded = formula.toUpperCase().replace(/(SUM|AVG|MIN|MAX|COUNTD|COUNT)\s*\(\s*([^)]*)\s*\)/g, (_, fn, rawColumn) => {
      const column = columns(data).find(name => name.toLowerCase() === rawColumn.trim().toLowerCase()) || rawColumn.trim();
      const value = metricFunction(data, fn, column); if (!Number.isFinite(value)) invalid = true; return String(value);
    });
    if (invalid || !/^[\d+\-*/().\s]+$/.test(expanded)) return { value: NaN, expanded };
    try { return { value: Function(`"use strict";return (${expanded})`)(), expanded }; } catch (_) { return { value: NaN, expanded }; }
  }
  function renderMetrics() {
    $("#metric-list").innerHTML = project().metrics.length ? project().metrics.map(metric => {
      const data = project().datasets.find(item => item.id === metric.datasetId) || dataset(), result = evaluateFormula(metric.formula, data);
      return `<div class="intel-item"><div class="intel-item-head"><strong>${esc(metric.name)}</strong><button data-explain-metric="${metric.id}">Explain</button></div><p>${esc(metric.formula)} · ${esc(data?.name || "No dataset")}</p><div class="formula-value">${format(result.value)}</div></div>`;
    }).join("") : itemHtml("No reusable metrics", "Create one formula and use its definition everywhere.");
    $$('[data-explain-metric]').forEach(button => button.onclick = () => explainMetric(button.dataset.explainMetric));
  }
  function explainMetric(id) {
    const metric = project().metrics.find(item => item.id === id), data = project().datasets.find(item => item.id === metric.datasetId) || dataset(), result = evaluateFormula(metric.formula, data);
    studio.dialog(`<span class="eyebrow">Explain this number</span><h2>${esc(metric.name)}</h2><div class="formula-value">${format(result.value)}</div><div class="intel-list">${itemHtml("Definition", metric.formula)}${itemHtml("Source", `${data?.name || "No dataset"} · ${data?.rows?.length || 0} rows`)}${itemHtml("Calculation", `${metric.formula} → ${result.expanded}`)}${itemHtml("Lineage", `${project().steps.length} workflow steps · refreshed ${new Date(data?.importedAt || Date.now()).toLocaleString()}`)}</div>`);
  }
  function renderContract() {
    const contract = project().contracts.find(item => item.datasetId === dataset()?.id), target = $("#contract-result");
    if (!contract) { target.className = "intel-result empty"; target.textContent = "No contract yet."; return; }
    target.className = "intel-result"; target.innerHTML = `<strong>${contract.fields.length} fields under contract</strong><br>${contract.fields.filter(field => field.required).length} required · ${contract.fields.filter(field => field.unique).length} unique · created ${new Date(contract.createdAt).toLocaleDateString()}`;
  }
  function generateContract() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first.");
    const fields = columns(data).map(column => {
      const values = data.rows.map(row => row[column]).filter(value => value !== "" && value != null), numeric = numericValues(data, column);
      return { name: column, type: numeric.length >= values.length * .8 ? "number" : values.some(value => !Number.isNaN(Date.parse(value))) ? "date" : "text", required: values.length === data.rows.length, unique: new Set(values.map(String)).size === values.length };
    });
    project().contracts = project().contracts.filter(item => item.datasetId !== data.id); project().contracts.push({ id: studio.uid("contract"), datasetId: data.id, datasetName: data.name, version: 1, createdAt: Date.now(), fields });
    touch("Data contract generated"); studio.toast("Contract generated from the current schema.");
  }
  function validateContract(show = true) {
    const data = dataset(), contract = project().contracts.find(item => item.datasetId === data?.id); if (!data || !contract) { if (show) studio.toast("Generate a contract first."); return []; }
    const failures = [];
    contract.fields.forEach(field => {
      if (!columns(data).includes(field.name)) failures.push(`Missing field: ${field.name}`);
      else {
        const values = data.rows.map(row => row[field.name]);
        if (field.required && values.some(value => value === "" || value == null)) failures.push(`${field.name} now contains blanks`);
        if (field.unique && new Set(values.map(String)).size !== values.length) failures.push(`${field.name} is no longer unique`);
        if (field.type === "number" && numericValues(data, field.name).length < values.filter(value => value !== "" && value != null).length) failures.push(`${field.name} contains non-numeric values`);
      }
    });
    const target = $("#contract-result"); target.className = `intel-result ${failures.length ? "risk-high" : "risk-low"}`; target.innerHTML = failures.length ? `<strong>${failures.length} contract violation${failures.length === 1 ? "" : "s"}</strong><br>${failures.map(esc).join("<br>")}` : "<strong>Contract passed</strong><br>The current data matches its expected schema and constraints.";
    return failures;
  }

  function answerQuestion(question) {
    const data = dataset(); if (!data) return { title: "No dataset selected", detail: "Add data before asking a question." };
    const names = columns(data), column = nameMatch(question, names), lower = question.toLowerCase();
    if (/how many|count|number of rows|records/.test(lower) && !column) return { title: format(data.rows.length), detail: `COUNT() across ${data.rows.length} rows in ${data.name}.` };
    if (/missing|blank|null/.test(lower)) { const field = column || names[0], count = data.rows.filter(row => row[field] === "" || row[field] == null).length; return { title: `${format(count)} missing`, detail: `${field}: ${count} blank values across ${data.rows.length} rows.` }; }
    if (/unique|distinct/.test(lower) && column) { const count = new Set(data.rows.map(row => String(row[column] ?? "")).filter(Boolean)).size; return { title: format(count), detail: `COUNTD(${column}) across ${data.rows.length} rows.` }; }
    const numericNames = names.filter(name => numericValues(data, name).length >= data.rows.length * .6);
    const numeric = numericNames.find(name => lower.includes(name.toLowerCase())) || (column && numericValues(data, column).length ? column : numericNames[0]);
    if (/which|what|top/.test(lower) && /highest|most|top|largest/.test(lower)) {
      const dimension = names.find(name => !numericNames.includes(name) && lower.includes(name.toLowerCase())) || names.find(name => roleFor(name, data) === "Dimension");
      if (dimension) {
        const groups = new Map(); data.rows.forEach(row => { const key = String(row[dimension] ?? "(blank)"), value = numeric ? Number(String(row[numeric] ?? "").replace(/[$,%\s,]/g, "")) : 1; groups.set(key, (groups.get(key) || 0) + (Number.isFinite(value) ? value : 0)); });
        const top = [...groups].sort((a, b) => b[1] - a[1])[0]; if (top) return { title: top[0], detail: `${numeric ? `SUM(${numeric})` : "COUNT()"} = ${format(top[1])}, grouped by ${dimension} across ${data.rows.length} rows.` };
      }
    }
    if ((/average|mean/.test(lower)) && numeric) { const value = metricFunction(data, "AVG", numeric); return { title: format(value), detail: `AVG(${numeric}) using ${numericValues(data, numeric).length} numeric values from ${data.name}.` }; }
    if ((/total|sum/.test(lower)) && numeric) { const value = metricFunction(data, "SUM", numeric); return { title: format(value), detail: `SUM(${numeric}) using ${numericValues(data, numeric).length} numeric values from ${data.name}.` }; }
    if ((/highest|maximum|max|largest/.test(lower)) && numeric) { const value = metricFunction(data, "MAX", numeric); return { title: format(value), detail: `MAX(${numeric}) across ${data.rows.length} rows in ${data.name}.` }; }
    if ((/lowest|minimum|min|smallest/.test(lower)) && numeric) { const value = metricFunction(data, "MIN", numeric); return { title: format(value), detail: `MIN(${numeric}) across ${data.rows.length} rows in ${data.name}.` }; }
    if (/top|most|highest/.test(lower)) {
      const dimension = column || names.find(name => roleFor(name, data) === "Dimension");
      if (dimension) { const counts = new Map(); data.rows.forEach(row => { const key = String(row[dimension] ?? "(blank)"); counts.set(key, (counts.get(key) || 0) + 1); }); const top = [...counts].sort((a, b) => b[1] - a[1])[0]; if (top) return { title: top[0], detail: `${top[1]} rows—the most common value in ${dimension}.` }; }
    }
    return { title: "I need a more specific question", detail: `Try “average ${numeric || "amount"},” “how many rows,” “missing ${names[0] || "values"},” or “top ${names.find(name => roleFor(name, data) === "Dimension") || "category"}.”` };
  }
  function scanAnomalies() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first.");
    const found = [];
    columns(data).forEach(column => {
      const values = numericValues(data, column); if (values.length < 5) return;
      const mean = values.reduce((a, b) => a + b, 0) / values.length, variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length, sd = Math.sqrt(variance);
      const outliers = sd ? values.filter(value => Math.abs((value - mean) / sd) > 3).length : 0;
      if (outliers) found.push({ id: studio.uid("anomaly"), datasetId: data.id, severity: outliers > values.length * .05 ? "high" : "medium", title: `${column}: ${outliers} unusual value${outliers === 1 ? "" : "s"}`, detail: "Values are more than three standard deviations from the mean.", at: Date.now() });
    });
    validateContract(false).forEach(text => found.push({ id: studio.uid("anomaly"), datasetId: data.id, severity: "high", title: "Contract change", detail: text, at: Date.now() }));
    if (data.baselineRowCount != null && Math.abs(data.rows.length - data.baselineRowCount) / Math.max(1, data.baselineRowCount) > .25) found.push({ id: studio.uid("anomaly"), datasetId: data.id, severity: "medium", title: "Large row-count change", detail: `${data.baselineRowCount} baseline rows → ${data.rows.length} current rows.`, at: Date.now() });
    data.baselineRowCount ??= data.rows.length; project().anomalies = project().anomalies.filter(item => item.datasetId !== data.id).concat(found);
    touch("Anomaly scan completed"); studio.toast(found.length ? `${found.length} item${found.length === 1 ? "" : "s"} need review.` : "No unusual patterns found.");
  }
  function renderAnomalies() {
    const items = project().anomalies.filter(item => !dataset() || item.datasetId === dataset().id);
    $("#anomaly-list").innerHTML = items.length ? items.map(item => `<div class="intel-item risk-${item.severity}"><div class="intel-item-head"><strong>${esc(item.title)}</strong><span class="badge ${item.severity === "high" ? "warn" : ""}">${item.severity}</span></div><p>${esc(item.detail)}</p></div>`).join("") : itemHtml("Inbox clear", "Run a scan to check outliers, row-count shifts, and contract violations.");
  }
  function dashboardPlan(question) {
    const data = dataset(), lower = question.toLowerCase(); if (!data) return studio.toast("Add a dataset first.");
    const date = columns(data).find(column => roleFor(column, data) === "Timeline"), measure = columns(data).find(column => roleFor(column, data) === "Measure"), dimension = columns(data).find(column => roleFor(column, data) === "Dimension");
    const tiles = [{ type: "KPI", title: measure ? `Total ${measure}` : "Record count", reason: "Establish the headline result" }];
    if (date || /month|trend|over time/.test(lower)) tiles.push({ type: "Line chart", title: `${measure || "Records"} over ${date || "time"}`, reason: "Show direction and turning points" });
    if (dimension) tiles.push({ type: "Bar chart", title: `${measure || "Records"} by ${dimension}`, reason: "Compare meaningful groups" });
    tiles.push({ type: "Exception table", title: "Items needing attention", reason: "Turn the dashboard into action" });
    const plan = { id: studio.uid("dashboard"), question, datasetId: data.id, tiles, createdAt: Date.now() }; project().dashboardPlans.unshift(plan); touch("Dashboard plan created"); renderDashboardPlan();
  }
  function renderDashboardPlan() {
    const plan = project().dashboardPlans[0]; $("#dashboard-plan").innerHTML = plan ? plan.tiles.map(tile => `<div class="plan-tile"><span class="eyebrow">${esc(tile.type)}</span><b>${esc(tile.title)}</b><span>${esc(tile.reason)}</span></div>`).join("") : "";
  }

  function privacyType(column, values) {
    const name = column.toLowerCase(), sample = values.map(String).join(" ");
    if (/email/.test(name) || /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(sample)) return ["email", "high"];
    if (/ssn|social.?security/.test(name) || /\b\d{3}-\d{2}-\d{4}\b/.test(sample)) return ["identifier", "high"];
    if (/phone|mobile|telephone/.test(name) || /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(sample)) return ["phone", "high"];
    if (/first.?name|last.?name|full.?name|student.?name|employee.?name/.test(name)) return ["name", "high"];
    if (/address|street|zip|postal/.test(name)) return ["address", "high"];
    if (/account|patient|student.?id|employee.?id|customer.?id|passport|license/.test(name)) return ["identifier", "high"];
    if (/birth|dob|diagnosis|medical|health|race|ethnicity|gender|salary|income|credit/.test(name)) return ["sensitive", "medium"];
    return null;
  }
  function scanPrivacy() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first.");
    const found = columns(data).map(column => { const detected = privacyType(column, data.rows.slice(0, 250).map(row => row[column]).filter(Boolean)); return detected && { id: studio.uid("privacy"), datasetId: data.id, column, type: detected[0], severity: detected[1], detail: `${detected[0]} pattern detected from the field name or sample values.` }; }).filter(Boolean);
    project().privacyFindings = project().privacyFindings.filter(item => item.datasetId !== data.id).concat(found); touch("Sensitive data scan completed"); studio.toast(found.length ? `${found.length} sensitive field${found.length === 1 ? "" : "s"} found.` : "No obvious sensitive fields found.");
  }
  function renderPrivacy() {
    const found = project().privacyFindings.filter(item => !dataset() || item.datasetId === dataset().id);
    $("#privacy-findings").innerHTML = found.length ? found.map(item => `<div class="intel-item risk-${item.severity}"><div class="intel-item-head"><strong>${esc(item.column)}</strong><span class="badge ${item.severity === "high" ? "warn" : ""}">${esc(item.type)}</span></div><p>${esc(item.detail)}</p></div>`).join("") : itemHtml("No findings yet", "Run the scanner before sharing or publishing data.");
  }
  function hash(value) { let code = 2166136261; for (const char of String(value)) { code ^= char.charCodeAt(0); code = Math.imul(code, 16777619); } return (code >>> 0).toString(36).toUpperCase(); }
  function redactValue(value, type) {
    if (value == null || value === "") return value; const text = String(value);
    if (type === "email") { const [user, domain = "redacted.local"] = text.split("@"); return `${user.slice(0, 1) || "u"}***@${domain}`; }
    if (type === "phone") return `***-***-${text.replace(/\D/g, "").slice(-4) || "0000"}`;
    if (type === "name") return `Person-${hash(text).slice(0, 6)}`;
    if (type === "identifier") return `ID-${hash(text).slice(0, 9)}`;
    if (type === "address") return "[REDACTED]";
    return `[PROTECTED-${hash(text).slice(0, 6)}]`;
  }
  function redactDataset() {
    const data = dataset(); if (!data) return studio.toast("Add a dataset first.");
    let findings = project().privacyFindings.filter(item => item.datasetId === data.id); if (!findings.length) { scanPrivacy(); findings = project().privacyFindings.filter(item => item.datasetId === data.id); }
    const allowed = new Set($$('.redaction-options input:checked').map(input => input.value));
    const byColumn = new Map(findings.filter(item => allowed.has(item.type)).map(item => [item.column, item.type]));
    if (!byColumn.size) return studio.toast("No selected sensitive fields were found.");
    window.DataHubAnalyst?.checkpoint(`Redacted ${data.name}`);
    const copy = { id: studio.uid("dataset"), name: `${data.name} (redacted)`, rows: data.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, byColumn.has(key) ? redactValue(value, byColumn.get(key)) : value]))), source: `Redacted copy of ${data.name}`, importedAt: Date.now(), redacted: true };
    project().datasets.push(copy); project().activeDatasetId = copy.id; $("#redaction-result").className = "intel-result risk-low"; $("#redaction-result").innerHTML = `<strong>Safe copy created</strong><br>${byColumn.size} fields redacted across ${copy.rows.length} rows.`; touch("Redacted dataset copy created"); studio.renderAll();
  }

  function renderApprovals() {
    const status = project().projectStatus || "Draft", current = statuses.indexOf(status); $("#intel-project-status").textContent = status;
    $("#approval-track").innerHTML = statuses.map((value, index) => `<div class="approval-step ${index < current ? "done" : index === current ? "current" : ""}">${value}</div>`).join("");
    $("#advance-approval-btn").textContent = current >= statuses.length - 1 ? "Published" : `Advance to ${statuses[current + 1]}`; $("#advance-approval-btn").disabled = current >= statuses.length - 1;
    $("#approval-log").innerHTML = project().approvals.length ? project().approvals.map(item => itemHtml(`${item.status} · ${item.reviewer}`, `${item.comment} · ${new Date(item.at).toLocaleString()}`)).join("") : itemHtml("No review decisions yet", "Name a reviewer and record each approval step.");
  }
  function advanceApproval() {
    const reviewer = $("#approval-reviewer").value.trim(), comment = $("#approval-comment").value.trim(); if (!reviewer || !comment) return studio.toast("Add a reviewer and a review note.");
    const current = statuses.indexOf(project().projectStatus || "Draft"), next = statuses[current + 1]; if (!next) return;
    if (next === "Published") { const high = project().privacyFindings.filter(item => item.severity === "high").length; if (high && !confirm(`${high} high-risk privacy finding(s) remain. Publish anyway?`)) return; }
    project().projectStatus = next; project().approvals.unshift({ id: studio.uid("approval"), status: next, reviewer, comment, at: Date.now() }); $("#approval-comment").value = ""; touch(`Project advanced to ${next}`); studio.toast(`Status is now ${next}.`);
  }
  function renderImpact() {
    const select = $("#impact-target"), previous = select.value, data = dataset();
    const targets = [...columns(data).map(value => ({ type: "column", value })), ...project().metrics.map(item => ({ type: "metric", value: item.name })), ...project().glossary.map(item => ({ type: "term", value: item.term }))];
    select.innerHTML = '<option value="">Choose something to trace</option>' + targets.map(item => `<option value="${esc(item.type)}|${esc(item.value)}">${esc(item.type)} · ${esc(item.value)}</option>`).join(""); if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  function showImpact() {
    const value = $("#impact-target").value; if (!value) return; const [, name] = value.split("|"), needle = name.toLowerCase();
    const uses = [];
    project().steps.forEach(step => { if (JSON.stringify(step).toLowerCase().includes(needle)) uses.push(`Workflow step: ${step.name || step.id}`); });
    project().metrics.forEach(metric => { if (metric.formula.toLowerCase().includes(needle) || metric.name.toLowerCase() === needle) uses.push(`Metric: ${metric.name}`); });
    project().contracts.forEach(contract => { if (contract.fields.some(field => field.name.toLowerCase() === needle)) uses.push(`Data contract: ${contract.datasetName}`); });
    project().dashboardPlans.forEach(plan => { if (JSON.stringify(plan).toLowerCase().includes(needle)) uses.push(`Dashboard plan: ${plan.question}`); });
    if (project().report && JSON.stringify(project().report).toLowerCase().includes(needle)) uses.push("Current executive report");
    const target = $("#impact-result"); target.className = `intel-result ${uses.length ? "risk-medium" : "risk-low"}`; target.innerHTML = uses.length ? `<strong>${uses.length} downstream use${uses.length === 1 ? "" : "s"}</strong><br>${uses.map(esc).join("<br>")}` : "<strong>No direct dependencies found</strong><br>This change appears isolated, but rerun quality checks after editing.";
  }
  function renderTemplates() { $("#template-grid").innerHTML = templates.map((item, index) => `<div class="template-card"><h4>${esc(item.name)}</h4><p>${esc(item.detail)}</p><button class="button ghost" data-template="${index}">Use template</button></div>`).join(""); $$('[data-template]').forEach(button => button.onclick = () => applyTemplate(Number(button.dataset.template))); }
  function applyTemplate(index) {
    const item = templates[index]; if (!item) return; window.DataHubAnalyst?.checkpoint(`Applied ${item.name} template`); project().goal = item.goal; $("#project-goal").value = item.goal;
    const stepDetails = { clean: "Trim text and remove fully blank rows", dedupe: "Keep one copy of identical rows", derive: "Add a useful calculated column", quality: "Evaluate the project rules", analyze: "Profile measures and categories", dashboard: "Open automatic dashboard creation", report: "Create an executive narrative" };
    project().steps = item.steps.map(id => ({ id: studio.uid("step"), type: id, name: id[0].toUpperCase() + id.slice(1), detail: stepDetails[id] || "Project workflow step" }));
    item.terms.forEach(([term, definition]) => { if (!project().glossary.some(entry => entry.term === term)) project().glossary.push({ id: studio.uid("term"), term, definition }); });
    touch(`${item.name} template applied`); studio.renderAll(); studio.toast("Template applied to this project.");
  }

  async function generateGateway() {
    if (!window.JSZip) return studio.toast("The ZIP library is unavailable."); const database = $("#gateway-database").value, language = $("#gateway-language").value, rawTable = $("#gateway-table").value.trim() || "approved_reporting_view";
    const table = rawTable.replace(/[^a-zA-Z0-9_.]/g, ""); if (table !== rawTable) return studio.toast("Use only letters, numbers, underscores, and dots in the table name.");
    const zip = new JSZip();
    const readme = `# Signal Noir secure gateway\n\nStarter for ${database}. This API returns an approved read-only dataset for Signal Noir Studio.\n\n1. Copy .env.example to .env.\n2. Add a read-only database connection string.\n3. Restrict ALLOWED_ORIGIN to your Signal Noir site.\n4. Review query.sql and expose only approved fields.\n5. Deploy behind HTTPS and your organization\'s authentication.\n\nNever commit .env or use a write-capable database account.`;
    zip.file("README.md", readme).file(".env.example", "DATABASE_URL=replace_with_read_only_connection\nALLOWED_ORIGIN=https://your-signal-noir.example\nPORT=8080\n").file("query.sql", `SELECT * FROM ${table} LIMIT 10000;\n`);
    if (language === "node") {
      zip.file("package.json", JSON.stringify({ name: "signal-noir-gateway", private: true, scripts: { start: "node server.js" }, dependencies: { cors: "latest", dotenv: "latest", express: "latest", pg: "latest" } }, null, 2));
      zip.file("server.js", `require("dotenv").config();\nconst express=require("express"),cors=require("cors"),{Pool}=require("pg");\nconst app=express(),pool=new Pool({connectionString:process.env.DATABASE_URL});\napp.use(cors({origin:process.env.ALLOWED_ORIGIN,methods:["GET"]}));\napp.get("/data",async(req,res)=>{try{const result=await pool.query("SELECT * FROM ${table} LIMIT 10000");res.json(result.rows)}catch(error){res.status(500).json({error:"Data request failed"})}});\napp.listen(process.env.PORT||8080);\n`);
    } else {
      zip.file("requirements.txt", "fastapi\nuvicorn\nsqlalchemy\npsycopg[binary]\npython-dotenv\n");
      zip.file("app.py", `import os\nfrom fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom sqlalchemy import create_engine,text\napp=FastAPI()\napp.add_middleware(CORSMiddleware,allow_origins=[os.environ["ALLOWED_ORIGIN"]],allow_methods=["GET"],allow_headers=["*"])\nengine=create_engine(os.environ["DATABASE_URL"])\n@app.get("/data")\ndef data():\n    with engine.connect() as connection:\n        return [dict(row._mapping) for row in connection.execute(text("SELECT * FROM ${table} LIMIT 10000"))]\n`);
    }
    const blob = await zip.generateAsync({ type: "blob" }), anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = "signal-noir-secure-gateway.zip"; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 500); touch("Secure gateway starter generated");
  }
  function renderReadiness() {
    const saved = project().readiness?.ratings || {};
    $("#readiness-questions").innerHTML = readinessTopics.map((topic, index) => `<label class="readiness-row"><span>${esc(topic)}</span><select data-readiness="${index}" aria-label="${esc(topic)}"><option value="0" ${saved[index] == 0 ? "selected" : ""}>Not started</option><option value="1" ${saved[index] == 1 ? "selected" : ""}>In progress</option><option value="2" ${saved[index] == 2 ? "selected" : ""}>Established</option></select></label>`).join("");
    if (project().readiness) showReadiness(project().readiness);
  }
  function scoreReadiness() {
    const ratings = {}; $$('[data-readiness]').forEach(select => { ratings[select.dataset.readiness] = Number(select.value); }); const score = Math.round(Object.values(ratings).reduce((sum, value) => sum + value, 0) / (readinessTopics.length * 2) * 100);
    const gaps = readinessTopics.filter((_, index) => ratings[index] < 2); project().readiness = { ratings, score, gaps, at: Date.now() }; touch("Organization readiness assessed"); showReadiness(project().readiness);
  }
  function showReadiness(result) { const level = result.score >= 80 ? "Scale ready" : result.score >= 50 ? "Building foundations" : "Foundation needed"; const target = $("#readiness-result"); target.className = `intel-result ${result.score >= 80 ? "risk-low" : result.score >= 50 ? "risk-medium" : "risk-high"}`; target.innerHTML = `<strong>${result.score}% · ${level}</strong><br>${result.gaps.length ? `Next priorities: ${result.gaps.slice(0, 3).map(esc).join("; ")}.` : "All six foundations are established. Keep evidence and owners current."}`; }

  function render() {
    if (!project()) return;
    renderMapping(); renderJoinControls(); renderGlossary(); renderMetrics(); renderContract(); renderAnomalies(); renderDashboardPlan(); renderPrivacy(); renderApprovals(); renderImpact(); renderTemplates(); renderReadiness();
  }
  function bind() {
    renderTabs();
    $("#infer-mappings-btn").onclick = inferMappings; $("#join-left").onchange = () => { populateJoinKeys("left"); analyzeJoin(); }; $("#join-right").onchange = () => { populateJoinKeys("right"); analyzeJoin(); }; $("#join-left-key").onchange = analyzeJoin; $("#join-right-key").onchange = analyzeJoin; $("#analyze-join-btn").onclick = analyzeJoin; $("#create-join-btn").onclick = createJoin;
    $("#glossary-form").onsubmit = event => { event.preventDefault(); const term = $("#glossary-term").value.trim(), definition = $("#glossary-definition").value.trim(); if (!term || !definition) return studio.toast("Add a term and definition."); project().glossary.push({ id: studio.uid("term"), term, definition }); event.target.reset(); touch("Glossary definition added"); };
    $("#metric-form").onsubmit = event => { event.preventDefault(); const name = $("#metric-name").value.trim(), formula = $("#metric-formula").value.trim(); if (!name || !formula || !dataset()) return studio.toast("Add a metric name, formula, and dataset."); const result = evaluateFormula(formula); if (!Number.isFinite(result.value)) return studio.toast("Check the formula and column names."); project().metrics.push({ id: studio.uid("metric"), name, formula, datasetId: dataset().id, createdAt: Date.now() }); event.target.reset(); touch("Reusable metric created"); };
    $("#generate-contract-btn").onclick = generateContract; $("#validate-contract-btn").onclick = () => validateContract(true); $("#download-contract-btn").onclick = () => { const contract = project().contracts.find(item => item.datasetId === dataset()?.id); if (!contract) return studio.toast("Generate a contract first."); studio.download(`${contract.datasetName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-contract.json`, JSON.stringify(contract, null, 2)); };
    $("#data-question-form").onsubmit = event => { event.preventDefault(); const question = $("#data-question").value.trim(); if (!question) return; const answer = answerQuestion(question), target = $("#data-answer"); target.className = "intel-result"; target.innerHTML = `<strong>${esc(answer.title)}</strong><br>${esc(answer.detail)}<br><small>Question: ${esc(question)}</small>`; };
    $("#scan-anomalies-btn").onclick = scanAnomalies; $("#dashboard-question-form").onsubmit = event => { event.preventDefault(); const question = $("#dashboard-question").value.trim(); if (question) dashboardPlan(question); };
    $("#scan-privacy-btn").onclick = scanPrivacy; $("#redact-dataset-btn").onclick = redactDataset; $("#advance-approval-btn").onclick = advanceApproval; $("#impact-target").onchange = showImpact;
    $("#generate-gateway-btn").onclick = generateGateway; $("#score-readiness-btn").onclick = scoreReadiness;
    window.addEventListener("datahub:project-render", render);
    render();
  }
  bind();
})();
