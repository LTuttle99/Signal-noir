


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  if (!studio || !SN.analysis) return;
  const A = SN.analysis;
  const NS = window.SignalNoirVanessa = window.SignalNoirVanessa || {};
  const SAMPLE_ROWS = 8;

  const isMoney = measure => Boolean(measure && A.MONEY_HINTS.test(measure));
  const fmt = (value, measure) => SN.viz.formatNumber(value, { currency: isMoney(measure) });
  const pct = value => value == null || !Number.isFinite(value) ? "n/a" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value * 100).toFixed(1)}%`;
  const absPct = value => value == null || !Number.isFinite(value) ? "n/a" : `${Math.abs(value * 100).toFixed(1)}%`;
  const delta = (value, measure) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmt(Math.abs(value), measure)}`;
  const human = name => String(name || "").replace(/[_-]+/g, " ");
  const cap = text => String(text || "").charAt(0).toUpperCase() + String(text || "").slice(1);
  const plural = (count, word) => `${Number(count).toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
  const pValue = p => !Number.isFinite(p) ? "n/a" : p < .001 ? "< 0.001" : p.toFixed(3);

  function sample(rows, columns) {
    const cols = columns.slice(0, 8);
    return { columns: cols, rows: rows.slice(0, SAMPLE_ROWS).map(row => Object.fromEntries(cols.map(column => [column, row[column] ?? ""]))) };
  }


  function finding({ title, tone = "neutral", metric = null, evidence = null, chart = null, dataset = null }) {
    return {
      id: studio.uid("finding"), title, statement: title, tone, metric,
      datasetId: dataset?.id || null,
      evidence: evidence ? { generatedAt: new Date().toISOString(), validation: "computed", ...evidence } : null,
      chart, createdAt: Date.now()
    };
  }


  function interpretation(text, { source = "rule", basis = "", confidence = "medium" } = {}) {
    return { type: "interpretation", text, source, basis, confidence };
  }

  function light(findings) {
    return findings.map(item => ({ ...item, evidence: item.evidence ? { ...item.evidence, sample: item.evidence.sample ? { columns: item.evidence.sample.columns, rows: item.evidence.sample.rows.slice(0, SAMPLE_ROWS) } : null } : null }));
  }

  function chartFrom(type, data, { measure, signed = false, projection, label } = {}) {
    return { type, data, projection, signed, label, format: { currency: isMoney(measure) } };
  }

  NS.fx = { isMoney, fmt, pct, absPct, delta, human, cap, plural, pValue, sample, finding, interpretation, light, chartFrom };
})();
