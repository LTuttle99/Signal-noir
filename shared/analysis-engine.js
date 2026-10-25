


(function (root) {
  "use strict";

  const MEASURE_HINTS = /revenue|sales|amount|total|price|profit|income|cost|spend|budget|value|units|qty|quantity|orders|count|score|rating|hours|margin|balance|gmv|arr|mrr/i;
  const MONEY_HINTS = /revenue|sales|amount|price|profit|income|cost|spend|budget|gmv|arr|mrr|salary|fee|balance|margin/i;
  const ID_HINTS = /(^|[_\s-])(id|key|code|uuid|guid|sku|number|no)$|^id[_\s-]|email|phone|zip|postal/i;
  const DATE_HINTS = /date|time|month|period|day|week|year|quarter|created|updated|timestamp/i;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];


  function isBlank(value) {
    return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
  }

  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (isBlank(value) || typeof value === "boolean") return NaN;
    let text = String(value).trim();
    let negative = false;
    if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
    text = text.replace(/^[£$€¥]\s?|\s?(usd|eur|gbp)$/i, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(/\s/g, "").replace(/%$/, "");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) return NaN;
    const number = Number(text);
    return negative ? -number : number;
  }

  function isFormattedNumber(value) {
    return typeof value === "string" && /[$£€,%()]/.test(value) && Number.isFinite(toNumber(value));
  }

  function toDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (isBlank(value)) return null;
    const text = String(value).trim();
    let match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T\s].*)?$/);
    if (match) return validDate(+match[1], +match[2], match[3] ? +match[3] : 1);
    match = text.match(/^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/);
    if (match) return validDate(+match[1], +match[2], match[3] ? +match[3] : 1);
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) { const year = +match[3] < 100 ? 2000 + +match[3] : +match[3]; return validDate(year, +match[1], +match[2]); }
    match = text.match(/^([a-z]{3,9})[\s-]+(\d{4})$/i);
    if (match) { const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()); return month >= 0 ? validDate(+match[2], month + 1, 1) : null; }
    match = text.match(/^(\d{4})[\s-]?q([1-4])$/i) || text.match(/^q([1-4])[\s-]?(\d{4})$/i);
    if (match) { const year = +(match[1].length === 4 ? match[1] : match[2]); const q = +(match[1].length === 4 ? match[2] : match[1]); return validDate(year, (q - 1) * 3 + 1, 1); }
    return null;
  }

  function validDate(year, month, day) {
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 ? date : null;
  }


  function periodKey(date, grain = "month", { fiscalStart = 1 } = {}) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    if ((grain === "quarter" || grain === "year") && fiscalStart > 1) {
      const fiscalYear = month >= fiscalStart ? year + 1 : year;
      const quarter = Math.floor(((month - fiscalStart + 12) % 12) / 3) + 1;
      return grain === "year" ? `FY${fiscalYear}` : `FY${fiscalYear}-Q${quarter}`;
    }
    if (grain === "year") return String(year);
    if (grain === "quarter") return `${year}-Q${Math.ceil(month / 3)}`;
    if (grain === "day") return date.toISOString().slice(0, 10);
    if (grain === "week") {
      const monday = new Date(date.getTime());
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      return `W ${monday.toISOString().slice(0, 10)}`;
    }
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function periodLabel(key) {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return key;
    return `${MONTHS[+match[2] - 1].replace(/^./, c => c.toUpperCase())} ${match[1]}`;
  }


  function profileColumn(rows, column) {
    const values = rows.map(row => row[column]);
    const present = values.filter(value => !isBlank(value));
    const numbers = present.map(toNumber).filter(Number.isFinite);
    const dates = present.map(toDate).filter(Boolean);
    const distinct = new Map();
    present.forEach(value => { const key = String(value).trim(); distinct.set(key, (distinct.get(key) || 0) + 1); });
    const numericShare = present.length ? numbers.length / present.length : 0;
    const dateShare = present.length ? dates.length / present.length : 0;
    const uniqueRatio = present.length ? distinct.size / present.length : 0;
    let type = "text";
    if (!present.length) type = "empty";
    else if (dateShare >= .85 && (DATE_HINTS.test(column) || numericShare < .5)) type = "date";
    else if (numericShare >= .9) type = ID_HINTS.test(column) && uniqueRatio > .9 ? "id" : "number";
    else if (ID_HINTS.test(column) && uniqueRatio > .9) type = "id";
    else if (distinct.size <= Math.max(2, Math.min(60, present.length * .5))) type = "category";
    const summary = { name: column, type, present: present.length, missing: values.length - present.length, unique: distinct.size, numericShare, dateShare, formattedNumbers: present.filter(isFormattedNumber).length };
    if (type === "number") {
      const sorted = numbers.slice().sort((a, b) => a - b);
      const sum = numbers.reduce((total, value) => total + value, 0);
      Object.assign(summary, { min: sorted[0], max: sorted[sorted.length - 1], sum, mean: sum / numbers.length, median: quantile(sorted, .5), money: MONEY_HINTS.test(column) });
    }
    if (type === "date") {
      const times = dates.map(date => date.getTime()).sort((a, b) => a - b);
      Object.assign(summary, { from: new Date(times[0]).toISOString().slice(0, 10), to: new Date(times[times.length - 1]).toISOString().slice(0, 10) });
    }
    if (type === "category" || type === "text") summary.top = Array.from(distinct.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value, count]) => ({ value, count }));
    return summary;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const position = (sorted.length - 1) * q;
    const base = Math.floor(position);
    const rest = position - base;
    return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
  }

  function profile(dataset) {
    const rows = dataset.rows || [];
    const columns = (dataset.columns || []).map(column => profileColumn(rows, column));
    const missing = columns.reduce((total, column) => total + column.missing, 0);
    const measures = columns.filter(column => column.type === "number").map(column => column.name);
    const dimensions = columns.filter(column => column.type === "category").map(column => column.name);
    const times = columns.filter(column => column.type === "date").map(column => column.name);
    const ids = columns.filter(column => column.type === "id").map(column => column.name);
    return { name: dataset.name, rows: rows.length, rowsTotal: dataset.originalRowCount ?? rows.length, columnCount: columns.length, columns, missing, measures, dimensions, times, ids };
  }

  function column(prof, name) { return prof.columns.find(item => item.name === name) || null; }

  function mentioned(prompt, names) {
    const text = ` ${String(prompt || "").toLowerCase().replace(/[_-]+/g, " ")} `;
    return names.filter(name => text.includes(` ${name.toLowerCase().replace(/[_-]+/g, " ")}`)).sort((a, b) => b.length - a.length)[0] || null;
  }

  function pickMeasure(prof, prompt) {
    return mentioned(prompt, prof.measures)
      || (/\bsales\b/i.test(prompt) && prof.measures.find(name => /sales|revenue/i.test(name)))
      || prof.measures.find(name => /revenue|sales/i.test(name))
      || prof.measures.find(name => MEASURE_HINTS.test(name))
      || prof.measures[0] || null;
  }

  function pickDimension(prof, prompt) {
    return mentioned(prompt, prof.dimensions) || prof.dimensions.slice().sort((a, b) => (column(prof, a).unique - column(prof, b).unique))[0] || null;
  }


  function aggregate(rows, measure, op = "sum") {
    if (op === "count") return rows.length;
    const values = rows.map(row => toNumber(row[measure])).filter(Number.isFinite);
    if (!values.length) return NaN;
    if (op === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
    if (op === "min") return Math.min(...values);
    if (op === "max") return Math.max(...values);
    return values.reduce((a, b) => a + b, 0);
  }

  function groupBy(rows, key) {
    const groups = new Map();
    rows.forEach(row => {
      const value = typeof key === "function" ? key(row) : (isBlank(row[key]) ? "(blank)" : String(row[key]).trim());
      if (value === null || value === undefined) return;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(row);
    });
    return groups;
  }

  function breakdown(rows, measure, dimension, op = "sum") {
    return Array.from(groupBy(rows, dimension).entries()).map(([label, list]) => ({ label, value: aggregate(list, measure, op), rows: list.length }))
      .filter(item => Number.isFinite(item.value)).sort((a, b) => b.value - a.value);
  }

  function chooseGrain(dates) {
    const months = new Set(dates.map(date => periodKey(date, "month")));
    if (months.size >= 3) return "month";
    const weeks = new Set(dates.map(date => periodKey(date, "week")));
    return weeks.size >= 3 ? "week" : "day";
  }

  function timeSeries(rows, time, measure, { grain, op = "sum", fiscalStart = 1 } = {}) {
    const dated = rows.map(row => ({ row, date: toDate(row[time]) })).filter(item => item.date);
    const useGrain = grain || chooseGrain(dated.map(item => item.date));
    const groups = groupBy(dated, item => periodKey(item.date, useGrain, { fiscalStart }));
    const series = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({ key, label: useGrain === "month" ? periodLabel(key) : key, value: measure ? aggregate(list.map(item => item.row), measure, op) : list.length, rows: list.map(item => item.row) }));
    return { grain: useGrain, series, datedRows: dated.length, undated: rows.length - dated.length };
  }


  function comparePeriods(dataset, { measure, time, dimensions = [], grain, fiscalStart = 1 } = {}) {
    const ts = timeSeries(dataset.rows, time, measure, { grain, fiscalStart });
    const series = ts.series;
    if (series.length < 2) return { ok: false, reason: `Need at least two ${ts.grain}s of data in ${time}; found ${series.length}.` };
    let current = series[series.length - 1];
    let previous = series[series.length - 2];
    const notes = [];

    const typicalRows = quantile(series.slice(0, -1).map(item => item.rows.length).sort((a, b) => a - b), .5);
    if (series.length >= 3 && current.rows.length < typicalRows * .5) {
      notes.push(`${current.label} has only ${current.rows.length} rows versus a typical ${Math.round(typicalRows)}, so it looks incomplete and was set aside. Compared ${series[series.length - 2].label} with ${series[series.length - 3].label} instead.`);
      current = series[series.length - 2];
      previous = series[series.length - 3];
    }

    if (["quarter", "year"].includes(ts.grain)) {
      const monthsIn = item => new Set(item.rows.map(row => toDate(row[time])).filter(Boolean).map(date => periodKey(date, "month"))).size;
      const currentMonths = monthsIn(current), typicalMonths = Math.max(...series.slice(0, -1).map(monthsIn));
      if (currentMonths < typicalMonths) notes.push(`${current.label} covers ${currentMonths} of ${typicalMonths} months so far, so it is only part of a ${ts.grain} and the comparison with ${previous.label} is not like-for-like.`);
    }
    const delta = current.value - previous.value;
    const pct = previous.value !== 0 ? delta / Math.abs(previous.value) : null;
    const drivers = dimensions.map(dimension => {
      const now = new Map(breakdown(current.rows, measure, dimension).map(item => [item.label, item]));
      const before = new Map(breakdown(previous.rows, measure, dimension).map(item => [item.label, item]));
      const labels = new Set([...now.keys(), ...before.keys()]);
      const items = Array.from(labels).map(label => {
        const cur = now.get(label)?.value || 0;
        const prev = before.get(label)?.value || 0;
        return { label, current: cur, previous: prev, delta: cur - prev, pct: prev !== 0 ? (cur - prev) / Math.abs(prev) : null, rowsCurrent: now.get(label)?.rows || 0, rowsPrevious: before.get(label)?.rows || 0 };
      }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      const gross = items.reduce((total, item) => total + Math.abs(item.delta), 0) || 1;
      items.forEach(item => { item.shareOfMovement = Math.abs(item.delta) / gross; });
      const concentration = items[0] ? items[0].shareOfMovement : 0;

      const lift = items.length > 1 ? concentration - 1 / items.length : 0;
      return { dimension, items, concentration, lift };
    }).sort((a, b) => b.lift - a.lift);
    return { ok: true, grain: ts.grain, measure, time, current, previous, delta, pct, drivers, series: series.map(({ key, label, value, rows }) => ({ key, label, value, rows: rows.length })), undated: ts.undated, notes };
  }


  function linearFit(values) {
    const n = values.length;
    const xs = values.map((_, index) => index);
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    xs.forEach((x, index) => { sxy += (x - meanX) * (values[index] - meanY); sxx += (x - meanX) ** 2; });
    const slope = sxx ? sxy / sxx : 0;
    const intercept = meanY - slope * meanX;
    const fitted = xs.map(x => intercept + slope * x);
    const ssRes = values.reduce((total, value, index) => total + (value - fitted[index]) ** 2, 0);
    const ssTot = values.reduce((total, value) => total + (value - meanY) ** 2, 0);
    const residualSd = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    return { slope, intercept, r2: ssTot ? 1 - ssRes / ssTot : 0, residualSd, n };
  }

  function forecast(series, horizon = 3) {
    const values = series.map(item => item.value);
    if (values.length < 4) return { ok: false, reason: `A forecast needs at least 4 periods of history; found ${values.length}.` };
    const fit = linearFit(values);
    const z = 1.2816;
    const n = values.length;
    const meanX = (n - 1) / 2;
    const sxx = values.reduce((total, _, index) => total + (index - meanX) ** 2, 0);
    const projection = Array.from({ length: horizon }, (_, step) => {
      const x = n + step;
      const value = fit.intercept + fit.slope * x;
      const spread = z * fit.residualSd * Math.sqrt(1 + 1 / n + (x - meanX) ** 2 / (sxx || 1));
      return { index: x, value, low: value - spread, high: value + spread };
    });
    return { ok: true, method: "Ordinary least-squares linear trend", fit, projection, interval: .8 };
  }

  function nextPeriodLabels(lastKey, grain, count) {
    const labels = [];
    const match = /^(\d{4})-(\d{2})$/.exec(lastKey);
    if (grain === "month" && match) {
      let year = +match[1], month = +match[2];
      for (let i = 0; i < count; i++) { month += 1; if (month > 12) { month = 1; year += 1; } labels.push(periodLabel(`${year}-${String(month).padStart(2, "0")}`)); }
      return labels;
    }
    for (let i = 1; i <= count; i++) labels.push(`+${i}`);
    return labels;
  }


  function seriesAnomalies(series, threshold = 3.5) {
    const values = series.map(item => item.value);
    if (values.length < 5) return [];
    const sorted = values.slice().sort((a, b) => a - b);
    const median = quantile(sorted, .5);
    const mad = quantile(values.map(value => Math.abs(value - median)).sort((a, b) => a - b), .5);
    if (!mad) return [];
    return series.map(item => ({ ...item, score: .6745 * (item.value - median) / mad, median })).filter(item => Math.abs(item.score) >= threshold);
  }

  function valueOutliers(rows, measure) {
    const values = rows.map(row => toNumber(row[measure])).filter(Number.isFinite).sort((a, b) => a - b);
    if (values.length < 8) return { low: -Infinity, high: Infinity, rows: [] };
    const q1 = quantile(values, .25), q3 = quantile(values, .75), iqr = q3 - q1;
    const low = q1 - 3 * iqr, high = q3 + 3 * iqr;
    return { q1, q3, low, high, rows: rows.filter(row => { const value = toNumber(row[measure]); return Number.isFinite(value) && (value < low || value > high); }) };
  }


  function rowKey(row, columns) { return JSON.stringify(columns.map(name => isBlank(row[name]) ? "" : String(row[name]).trim())); }

  function qualityAudit(dataset) {
    const rows = dataset.rows || [];
    const columns = dataset.columns || [];
    const issues = [];
    const blankRows = rows.filter(row => columns.every(name => isBlank(row[name]))).length;
    if (blankRows) issues.push({ id: "blank-rows", kind: "blank-rows", count: blankRows, severity: "low", title: `${blankRows} completely blank row${blankRows === 1 ? "" : "s"}`, fix: "Remove blank rows", safe: true });
    const seen = new Set();
    let duplicates = 0;
    rows.forEach(row => { if (columns.every(name => isBlank(row[name]))) return; const key = rowKey(row, columns); if (seen.has(key)) duplicates += 1; else seen.add(key); });
    if (duplicates) issues.push({ id: "duplicate-rows", kind: "duplicate-rows", count: duplicates, severity: "high", title: `${duplicates} exact duplicate row${duplicates === 1 ? "" : "s"}`, fix: "Keep the first copy of each duplicate", safe: false });
    columns.forEach(name => {
      const values = rows.map(row => row[name]);
      const padded = values.filter(value => typeof value === "string" && value !== value.trim() && value.trim() !== "").length;
      if (padded) issues.push({ id: `trim:${name}`, kind: "whitespace", column: name, count: padded, severity: "low", title: `${padded} value${padded === 1 ? "" : "s"} in ${name} with stray spaces`, fix: `Trim spaces in ${name}`, safe: true });
      const present = values.filter(value => !isBlank(value));
      const missing = values.length - present.length - blankRows;
      if (missing > 0) issues.push({ id: `missing:${name}`, kind: "missing", column: name, count: missing, severity: missing / Math.max(1, rows.length) > .2 ? "high" : "medium", title: `${missing} missing value${missing === 1 ? "" : "s"} in ${name}`, fix: null, safe: false });
      const formatted = present.filter(isFormattedNumber).length;
      if (formatted && formatted / Math.max(1, present.length) > .5) issues.push({ id: `numeric:${name}`, kind: "numeric-text", column: name, count: formatted, severity: "medium", title: `${formatted} number${formatted === 1 ? "" : "s"} in ${name} stored as text ($, commas or %)`, fix: `Convert ${name} to plain numbers`, safe: true });
      const variants = new Map();
      present.forEach(value => { if (typeof value !== "string" || Number.isFinite(toNumber(value))) return; const canon = value.trim().toLowerCase().replace(/\s+/g, " "); if (!variants.has(canon)) variants.set(canon, new Map()); const forms = variants.get(canon); forms.set(value.trim(), (forms.get(value.trim()) || 0) + 1); });
      const inconsistent = Array.from(variants.values()).filter(forms => forms.size > 1);
      if (inconsistent.length && variants.size <= 200) {
        const count = inconsistent.reduce((total, forms) => total + Array.from(forms.values()).sort((a, b) => b - a).slice(1).reduce((a, b) => a + b, 0), 0);
        issues.push({ id: `case:${name}`, kind: "inconsistent-labels", column: name, count, severity: "medium", title: `${inconsistent.length} label${inconsistent.length === 1 ? "" : "s"} in ${name} spelled more than one way (e.g. ${Array.from(inconsistent[0].keys()).slice(0, 2).map(v => `“${v}”`).join(" / ")})`, fix: `Use the most common spelling in ${name}`, safe: true, examples: inconsistent.slice(0, 3).map(forms => Array.from(forms.keys())) });
      }
    });
    const penalty = issues.reduce((total, issue) => total + (issue.severity === "high" ? 12 : issue.severity === "medium" ? 6 : 2), 0);
    return { issues, score: Math.max(0, 100 - penalty), rows: rows.length };
  }

  function applyCleaning(dataset, issueIds) {
    const selected = new Set(issueIds);
    const columns = dataset.columns.slice();
    let rows = dataset.rows.map(row => ({ ...row }));
    const log = [];
    if (selected.has("blank-rows")) { const before = rows.length; rows = rows.filter(row => !columns.every(name => isBlank(row[name]))); log.push(`Removed ${before - rows.length} blank rows`); }
    columns.forEach(name => {
      if (selected.has(`trim:${name}`)) { let changed = 0; rows.forEach(row => { if (typeof row[name] === "string" && row[name] !== row[name].trim()) { row[name] = row[name].trim(); changed += 1; } }); log.push(`Trimmed ${changed} values in ${name}`); }
      if (selected.has(`numeric:${name}`)) { let changed = 0; rows.forEach(row => { if (isFormattedNumber(row[name])) { row[name] = toNumber(row[name]); changed += 1; } }); log.push(`Converted ${changed} values in ${name} to numbers`); }
      if (selected.has(`case:${name}`)) {
        const counts = new Map();
        rows.forEach(row => { const value = row[name]; if (typeof value !== "string" || isBlank(value)) return; const canon = value.trim().toLowerCase().replace(/\s+/g, " "); if (!counts.has(canon)) counts.set(canon, new Map()); const forms = counts.get(canon); forms.set(value.trim(), (forms.get(value.trim()) || 0) + 1); });
        let changed = 0;
        rows.forEach(row => { const value = row[name]; if (typeof value !== "string" || isBlank(value)) return; const forms = counts.get(value.trim().toLowerCase().replace(/\s+/g, " ")); const best = Array.from(forms.entries()).sort((a, b) => b[1] - a[1])[0][0]; if (value !== best) { row[name] = best; changed += 1; } });
        log.push(`Standardized ${changed} labels in ${name}`);
      }
    });
    if (selected.has("duplicate-rows")) { const before = rows.length; const seen = new Set(); rows = rows.filter(row => { const key = rowKey(row, columns); if (seen.has(key)) return false; seen.add(key); return true; }); log.push(`Removed ${before - rows.length} duplicate rows`); }
    return { columns, rows, log };
  }


  function candidateKeys(a, b) {
    const shared = a.columns.filter(name => b.columns.includes(name));
    return shared.map(name => {
      const va = a.rows.map(row => row[name]).filter(value => !isBlank(value)).map(value => String(value).trim());
      const vb = b.rows.map(row => row[name]).filter(value => !isBlank(value)).map(value => String(value).trim());
      const ua = new Set(va), ub = new Set(vb);
      const overlap = Array.from(ua).filter(value => ub.has(value)).length;
      return { column: name, uniqueA: va.length ? ua.size / va.length : 0, uniqueB: vb.length ? ub.size / vb.length : 0, overlap, matchRate: ua.size ? overlap / ua.size : 0 };
    }).sort((x, y) => (y.uniqueA + y.uniqueB + y.matchRate) - (x.uniqueA + x.uniqueB + x.matchRate));
  }

  function compareDatasets(a, b) {
    const added = b.columns.filter(name => !a.columns.includes(name));
    const removed = a.columns.filter(name => !b.columns.includes(name));
    const shared = a.columns.filter(name => b.columns.includes(name));
    const keys = candidateKeys(a, b);
    const key = keys.find(item => item.uniqueA > .98 && item.uniqueB > .98) || null;
    const result = { columnsAdded: added, columnsRemoved: removed, sharedColumns: shared, rowsA: a.rows.length, rowsB: b.rows.length, key: key?.column || null };
    if (key) {
      const mapA = new Map(a.rows.map(row => [String(row[key.column]).trim(), row]));
      const mapB = new Map(b.rows.map(row => [String(row[key.column]).trim(), row]));
      const addedRows = Array.from(mapB.keys()).filter(id => !mapA.has(id));
      const removedRows = Array.from(mapA.keys()).filter(id => !mapB.has(id));
      const changed = [];
      const fieldChanges = new Map();
      mapA.forEach((rowA, id) => {
        const rowB = mapB.get(id);
        if (!rowB) return;
        const fields = shared.filter(name => name !== key.column && String(rowA[name] ?? "").trim() !== String(rowB[name] ?? "").trim());
        if (fields.length) { changed.push({ id, fields }); fields.forEach(field => fieldChanges.set(field, (fieldChanges.get(field) || 0) + 1)); }
      });
      Object.assign(result, { addedRows, removedRows, changedRows: changed, fieldChanges: Array.from(fieldChanges.entries()).sort((x, y) => y[1] - x[1]).map(([field, count]) => ({ field, count })) });
    } else {
      const setA = new Set(a.rows.map(row => rowKey(row, shared)));
      const setB = new Set(b.rows.map(row => rowKey(row, shared)));
      Object.assign(result, { onlyInA: Array.from(setA).filter(item => !setB.has(item)).length, onlyInB: Array.from(setB).filter(item => !setA.has(item)).length });
    }
    const pa = profile(a), pb = profile(b);
    result.measureChanges = pa.measures.filter(name => pb.measures.includes(name)).map(name => {
      const before = column(pa, name).sum, after = column(pb, name).sum;
      return { measure: name, before, after, delta: after - before, pct: before ? (after - before) / Math.abs(before) : null };
    });
    return result;
  }

  function joinSuggestions(datasets) {
    const suggestions = [];
    for (let i = 0; i < datasets.length; i++) for (let j = i + 1; j < datasets.length; j++) {
      const a = datasets[i], b = datasets[j];
      candidateKeys(a, b).filter(key => key.overlap > 0).slice(0, 1).forEach(key => {
        const [left, right, leftKey] = key.uniqueA >= key.uniqueB ? [b, a, key] : [a, b, key];
        suggestions.push({ left: left.id, right: right.id, leftName: left.name, rightName: right.name, column: leftKey.column, matchRate: key.matchRate, overlap: key.overlap });
      });
    }
    return suggestions.sort((x, y) => y.matchRate - x.matchRate);
  }

  function leftJoin(left, right, column) {
    const lookup = new Map();
    right.rows.forEach(row => { const key = String(row[column] ?? "").trim(); if (!lookup.has(key)) lookup.set(key, row); });
    const extra = right.columns.filter(name => name !== column).map(name => ({ source: name, target: left.columns.includes(name) ? `${name}_${right.name.replace(/\.[a-z0-9]+$/i, "").replace(/\W+/g, "_")}` : name }));
    let matched = 0;
    const rows = left.rows.map(row => {
      const match = lookup.get(String(row[column] ?? "").trim());
      if (match) matched += 1;
      const out = { ...row };
      extra.forEach(({ source, target }) => { out[target] = match ? match[source] : ""; });
      return out;
    });
    return { columns: left.columns.concat(extra.map(item => item.target)), rows, matched, unmatched: left.rows.length - matched };
  }


  function answer(dataset, prompt) {
    const prof = profile(dataset);
    const text = String(prompt || "").toLowerCase();
    const op = /\b(average|avg|mean)\b/.test(text) ? "mean" : /\b(min|minimum|lowest|smallest)\b/.test(text) ? "min" : /\b(max|maximum|highest|largest|biggest|top)\b/.test(text) ? "max" : /\b(count|how many|number of)\b/.test(text) ? "count" : "sum";
    const measure = mentioned(prompt, prof.measures) || (op === "count" ? null : pickMeasure(prof, prompt));
    const byMatch = text.match(/\b(?:by|per|for each|across)\s+([a-z0-9 _-]+)/);
    const group = byMatch ? mentioned(` ${byMatch[1]}`, prof.dimensions.concat(prof.times)) : mentioned(prompt, prof.dimensions);
    const effectiveOp = measure ? (op === "max" && group ? "sum" : op) : "count";
    const value = aggregate(dataset.rows, measure, effectiveOp);
    const groups = group ? (prof.times.includes(group) ? timeSeries(dataset.rows, group, measure, { op: effectiveOp }).series.map(item => ({ label: item.label, value: item.value, rows: item.rows.length })) : breakdown(dataset.rows, measure, group, effectiveOp)) : [];
    return { op: effectiveOp, measure, group, value, groups, rows: dataset.rows.length, profile: prof };
  }


  function appendDatasets(datasets, sourceColumn = "source_file") {
    const columns = [];
    datasets.forEach(dataset => dataset.columns.forEach(name => { if (!columns.includes(name)) columns.push(name); }));
    const shared = columns.filter(name => datasets.every(dataset => dataset.columns.includes(name)));
    const rows = datasets.flatMap(dataset => dataset.rows.map(row => ({ ...Object.fromEntries(columns.map(name => [name, row[name] ?? ""])), [sourceColumn]: dataset.name })));
    return { columns: columns.concat(columns.includes(sourceColumn) ? [] : [sourceColumn]), rows, shared, partial: columns.filter(name => !shared.includes(name)) };
  }


  function applyFilters(rows, filters = []) {
    if (!filters.length) return rows;
    return rows.filter(row => filters.every(filter => {
      const raw = row[filter.column];
      const text = String(raw ?? "").trim().toLowerCase();
      const target = String(filter.value ?? "").trim().toLowerCase();
      const a = toNumber(raw), b = toNumber(filter.value);
      switch (filter.op) {
        case "!=": return text !== target;
        case ">": return a > b;
        case ">=": return a >= b;
        case "<": return a < b;
        case "<=": return a <= b;
        case "contains": return text.includes(target);
        default: return text === target;
      }
    }));
  }
  const describeFilter = filter => `${filter.column} ${filter.op || "="} ${filter.value}`;

  function rankColumns(dataset, op = "mean") {
    const prof = profile(dataset);
    return prof.measures.map(name => ({ column: name, value: aggregate(dataset.rows, name, op), present: column(prof, name).present }))
      .filter(item => Number.isFinite(item.value)).sort((a, b) => b.value - a.value);
  }


  function dateCandidates(dataset) {
    const prof = profile(dataset);
    return prof.columns.filter(col => col.type !== "date" && (DATE_HINTS.test(col.name) || col.dateShare >= .5))
      .map(col => ({ column: col.name, dateShare: col.dateShare, hint: DATE_HINTS.test(col.name) })).sort((a, b) => b.dateShare - a.dateShare);
  }

  function normalizeName(name) { return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }


  function keyCandidates(a, b, limit = 4) {
    const pairs = [];
    a.columns.forEach(left => b.columns.forEach(right => {
      const nameMatch = normalizeName(left) === normalizeName(right) ? 1 : normalizeName(left).includes(normalizeName(right)) || normalizeName(right).includes(normalizeName(left)) ? .6 : 0;
      const va = new Set(a.rows.slice(0, 2000).map(row => String(row[left] ?? "").trim().toLowerCase()).filter(Boolean));
      const vb = new Set(b.rows.slice(0, 2000).map(row => String(row[right] ?? "").trim().toLowerCase()).filter(Boolean));
      const overlap = [...va].filter(value => vb.has(value)).length;
      const valueMatch = va.size ? overlap / va.size : 0;
      const score = nameMatch * .5 + valueMatch;
      if (score > .2) pairs.push({ left, right, nameMatch, valueMatch, overlap, score });
    }));
    return pairs.sort((x, y) => y.score - x.score).slice(0, limit);
  }


  function evaluateMetric(formula, dataset) {
    const fns = { SUM: "sum", AVG: "mean", MEAN: "mean", MIN: "min", MAX: "max", COUNT: "count", COUNTD: "countd" };
    const parts = [];
    const tokens = String(formula || "").match(/[A-Za-z_]+\s*\([^)]*\)|\d+(?:\.\d+)?|[()+\-*/]/g) || [];
    if (tokens.join("").replace(/\s/g, "") !== String(formula || "").replace(/\s/g, "")) return { ok: false, reason: "The formula uses something other than SUM, AVG, MIN, MAX, COUNT, COUNTD, numbers and + - * / ( )." };
    let values;
    try { values = tokens.map(token => {
      const call = token.match(/^([A-Za-z_]+)\s*\(([^)]*)\)$/);
      if (!call) return token;
      const fn = fns[call[1].toUpperCase()];
      const col = dataset.columns.find(name => name.toLowerCase() === call[2].trim().toLowerCase());
      if (!fn) throw new Error(`Unknown function ${call[1]}`);
      if (call[2].trim() && !col) throw new Error(`Column “${call[2].trim()}” isn’t in ${dataset.name}`);
      const value = fn === "countd" ? new Set(dataset.rows.map(row => String(row[col] ?? "").trim()).filter(Boolean)).size
        : fn === "count" ? (col ? dataset.rows.filter(row => !isBlank(row[col])).length : dataset.rows.length)
        : aggregate(dataset.rows, col, fn);
      parts.push(`${call[1].toUpperCase()}(${col || ""}) = ${value}`);
      return value;
    }); } catch (error) { return { ok: false, reason: error.message, parts }; }
    let index = 0;
    const peek = () => values[index];
    const primary = () => {
      const token = values[index++];
      if (token === "(") { const value = expr(); if (values[index++] !== ")") throw new Error("Unbalanced parentheses"); return value; }
      if (token === "-") return -primary();
      const number = typeof token === "number" ? token : Number(token);
      if (!Number.isFinite(number)) throw new Error("Unexpected symbol in formula");
      return number;
    };
    const term = () => { let value = primary(); while (peek() === "*" || peek() === "/") { const op = values[index++]; const right = primary(); value = op === "*" ? value * right : value / right; } return value; };
    const expr = () => { let value = term(); while (peek() === "+" || peek() === "-") { const op = values[index++]; const right = term(); value = op === "+" ? value + right : value - right; } return value; };
    try {
      const value = expr();
      if (index !== values.length) throw new Error("Unexpected symbol in formula");
      return Number.isFinite(value) ? { ok: true, value, parts } : { ok: false, reason: "The formula doesn’t produce a finite number (for example a division by zero).", parts };
    } catch (error) { return { ok: false, reason: error.message, parts }; }
  }

  const opLabel = { sum: "Total", mean: "Average", min: "Minimum", max: "Maximum", count: "Count" };
  const formula = (op, measure, group) => `${op === "count" ? "COUNT(*)" : `${op.toUpperCase()}(${measure})`}${group ? ` GROUP BY ${group}` : ""}`;

  const api = { toNumber, toDate, isBlank, isFormattedNumber, periodKey, periodLabel, profile, profileColumn, column, pickMeasure, pickDimension, mentioned, aggregate, groupBy, breakdown, timeSeries, comparePeriods, linearFit, forecast, nextPeriodLabels, seriesAnomalies, valueOutliers, qualityAudit, applyCleaning, candidateKeys, compareDatasets, joinSuggestions, leftJoin, answer, quantile, opLabel, formula, MONEY_HINTS, appendDatasets, applyFilters, describeFilter, rankColumns, dateCandidates, keyCandidates, evaluateMetric, normalizeName };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.SignalNoir = root.SignalNoir || {}; root.SignalNoir.analysis = api; }
})(typeof window !== "undefined" ? window : null);
