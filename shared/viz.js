


(function (root) {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  function formatNumber(value, { currency = false, percent = false, digits } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    if (percent) return `${(number * 100).toFixed(digits ?? 1)}%`;
    const abs = Math.abs(number);
    const sign = number < 0 ? "−" : "";
    const unit = currency ? "$" : "";
    const max = digits ?? (abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
    if (abs >= 1e6) return `${sign}${unit}${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
    if (abs >= 1e4) return `${sign}${unit}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${unit}${abs.toLocaleString(undefined, { maximumFractionDigits: max })}`;
  }


  function bars(data, { signed = false, format = {}, limit = 10 } = {}) {
    const rows = data.slice(0, limit);
    if (!rows.length) return "";
    const max = Math.max(...rows.map(row => Math.abs(Number(row.value) || 0)), 1e-9);
    return `<div class="sn-bars" role="img" aria-label="${esc(rows.map(row => `${row.label}: ${formatNumber(row.value, format)}`).join(", "))}">${rows.map(row => {
      const value = Number(row.value) || 0;
      const width = Math.max(1.5, Math.abs(value) / max * 100);
      const tone = signed ? (value < 0 ? "is-negative" : "is-positive") : "";
      return `<div class="sn-bar-row"><span title="${esc(row.label)}">${esc(row.label)}</span><div class="sn-bar-track"><div class="sn-bar-fill ${tone}" style="width:${width.toFixed(2)}%"></div></div><strong>${signed && value > 0 ? "+" : ""}${esc(formatNumber(value, format))}</strong></div>`;
    }).join("")}</div>`;
  }


  function line(series, { projection = [], format = {}, height = 180, label = "Trend" } = {}) {
    const all = series.concat(projection);
    if (all.length < 2) return "";
    const width = 560;
    const pad = { top: 12, right: 12, bottom: 24, left: 52 };
    const values = all.flatMap(point => [point.value, point.low, point.high]).filter(Number.isFinite);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * .08; max += span * .08;
    const x = index => pad.left + index / (all.length - 1) * (width - pad.left - pad.right);
    const y = value => pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);
    const path = points => points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
    const history = series.map((point, index) => [x(index), y(point.value)]);
    const area = `${path(history)} L${history[history.length - 1][0].toFixed(1)},${(height - pad.bottom).toFixed(1)} L${history[0][0].toFixed(1)},${(height - pad.bottom).toFixed(1)} Z`;
    const offset = series.length - 1;
    const forecast = projection.length ? [[x(offset), y(series[offset].value)], ...projection.map((point, index) => [x(offset + index + 1), y(point.value)])] : [];
    const band = projection.length && projection.every(point => Number.isFinite(point.low) && Number.isFinite(point.high))
      ? `M${x(offset).toFixed(1)},${y(series[offset].value).toFixed(1)} ${projection.map((point, index) => `L${x(offset + index + 1).toFixed(1)},${y(point.high).toFixed(1)}`).join(" ")} ${projection.slice().reverse().map((point, index) => `L${x(offset + projection.length - index).toFixed(1)},${y(point.low).toFixed(1)}`).join(" ")} Z`
      : "";
    const ticks = [0, .5, 1].map(ratio => min + (max - min) * ratio);
    const step = Math.max(1, Math.ceil(all.length / 6));
    const gradientId = `snArea${Math.random().toString(36).slice(2, 7)}`;
    return `<figure class="sn-chart" style="margin:0"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}: ${esc(series.length)} points${projection.length ? `, ${projection.length} projected` : ""}">
      <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sn-accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--sn-accent)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(tick => `<line class="sn-grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"/><text x="${pad.left - 8}" y="${(y(tick) + 3).toFixed(1)}" text-anchor="end">${esc(formatNumber(tick, format))}</text>`).join("")}
      <path d="${area}" fill="url(#${gradientId})"/>
      ${band ? `<path class="sn-band" d="${band}"/>` : ""}
      <path class="sn-series" d="${path(history)}"/>
      ${forecast.length ? `<path class="sn-series-2" d="${path(forecast)}"/>` : ""}
      ${all.map((point, index) => index % step === 0 || index === all.length - 1 ? `<text x="${x(index).toFixed(1)}" y="${height - 6}" text-anchor="middle">${esc(point.label)}</text>` : "").join("")}
    </svg></figure>`;
  }

  const api = { bars, line, formatNumber };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.SignalNoir = root.SignalNoir || {}; root.SignalNoir.viz = api; }
})(typeof window !== "undefined" ? window : null);
