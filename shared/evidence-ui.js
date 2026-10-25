


(function (root) {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const VALIDATION = {
    computed: { label: "Computed from source", tone: "success", text: "Recalculated directly from the source rows listed below. No model or estimate was involved." },
    partial: { label: "Computed with caveats", tone: "warning", text: "Calculated from the source rows, but some rows or values were excluded. See the notes." },
    estimated: { label: "Model estimate", tone: "preview", text: "A statistical projection, not an observed value. Treat the range as the answer, not the single number." },
    unverified: { label: "No evidence", tone: "muted", text: "This statement has no supporting calculation attached." }
  };
  let drawer = null;
  let scrim = null;
  let lastFocus = null;

  function validationOf(finding) {
    const key = finding?.evidence?.validation;
    return VALIDATION[key] ? key : "unverified";
  }

  function badge(finding) {
    const key = validationOf(finding);
    const info = VALIDATION[key];
    return `<span class="sn-badge sn-badge-${info.tone}"><i></i>${esc(info.label)}</span>`;
  }

  function button(finding, label = "Evidence") {
    const key = validationOf(finding);
    return `<button type="button" class="sn-evidence-btn" data-evidence="${esc(finding.id)}" data-validation="${key}" aria-label="Inspect evidence for: ${esc(finding.title)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>${esc(label)}</button>`;
  }

  function formatTime(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function chartHtml(chart) {
    const viz = root?.SignalNoir?.viz;
    if (!chart || !viz) return "";
    if (chart.type === "line") return viz.line(chart.data || [], { projection: chart.projection || [], format: chart.format || {}, label: chart.label || "Trend" });
    return viz.bars(chart.data || [], { signed: chart.signed, format: chart.format || {} });
  }

  function bodyHtml(finding) {
    const ev = finding.evidence;
    const key = validationOf(finding);
    const info = VALIDATION[key];
    if (!ev) {
      return `<p class="sn-finding-title" style="margin-bottom:18px">${esc(finding.title)}</p><div class="sn-empty"><div class="sn-empty-icon">∅</div><div class="sn-empty-title">No supporting evidence has been generated yet</div><div class="sn-empty-text">Signal Noir only attaches evidence to findings it calculated itself. Treat this statement as unverified until it is recomputed from source data.</div></div>`;
    }
    const rows = [
      ["Finding", esc(finding.title)],
      ["Source", esc(ev.dataset || "Not recorded")],
      ["Rows used", ev.rows != null ? `${Number(ev.rows).toLocaleString()}${ev.rowsTotal != null && ev.rowsTotal !== ev.rows ? ` <span class="sn-muted">of ${Number(ev.rowsTotal).toLocaleString()}</span>` : ""}` : "Not recorded"],
      ["Filters", ev.filters?.length ? ev.filters.map(filter => `<code class="sn-mono">${esc(filter)}</code>`).join("<br>") : '<span class="sn-muted">None: all rows in scope</span>'],
      ["Calculation", ev.calculation ? `<code class="sn-evidence-formula">${esc(ev.calculation)}</code>` : '<span class="sn-muted">Not recorded</span>'],
      ["Method", esc(ev.method || "Not recorded")],
      ["Generated", esc(formatTime(ev.generatedAt))],
      ["Validation", `${badge(finding)}<div class="sn-muted sn-xs" style="margin-top:6px">${esc(info.text)}</div>`]
    ];
    const inputs = ev.inputs && Object.keys(ev.inputs).length
      ? `<h3 class="sn-h4" style="margin:24px 0 10px">Inputs</h3><div class="sn-table-wrap"><table class="sn-table"><tbody>${Object.entries(ev.inputs).map(([label, value]) => `<tr><td>${esc(label)}</td><td class="is-num">${esc(value)}</td></tr>`).join("")}</tbody></table></div>`
      : "";
    const notes = ev.notes?.length ? `<h3 class="sn-h4" style="margin:24px 0 10px">Notes</h3><ul class="sn-body" style="margin:0;padding-left:18px">${ev.notes.map(note => `<li>${esc(note)}</li>`).join("")}</ul>` : "";
    const chart = chartHtml(finding.chart);
    const sample = ev.sample?.rows?.length
      ? `<h3 class="sn-h4" style="margin:24px 0 10px">Source rows <span class="sn-muted sn-xs">(first ${ev.sample.rows.length})</span></h3><div class="sn-table-wrap"><table class="sn-table"><thead><tr>${ev.sample.columns.map(column => `<th>${esc(column)}</th>`).join("")}</tr></thead><tbody>${ev.sample.rows.map(row => `<tr>${ev.sample.columns.map(column => `<td>${esc(row[column] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : "";
    return `<dl class="sn-evidence-grid">${rows.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join("")}</dl>${chart ? `<h3 class="sn-h4" style="margin:24px 0 12px">Visualization</h3>${chart}` : ""}${inputs}${notes}${sample}`;
  }

  function plainText(finding) {
    const ev = finding.evidence;
    if (!ev) return `${finding.title}\nEvidence: none generated.`;
    return [
      `Finding: ${finding.title}`,
      `Source: ${ev.dataset || "not recorded"}`,
      `Rows used: ${ev.rows ?? "not recorded"}${ev.rowsTotal != null ? ` of ${ev.rowsTotal}` : ""}`,
      `Filters: ${ev.filters?.length ? ev.filters.join("; ") : "none"}`,
      `Calculation: ${ev.calculation || "not recorded"}`,
      `Method: ${ev.method || "not recorded"}`,
      `Generated: ${formatTime(ev.generatedAt)}`,
      `Validation: ${VALIDATION[validationOf(finding)].label}`,
      ...(ev.inputs ? Object.entries(ev.inputs).map(([label, value]) => `  ${label}: ${value}`) : []),
      ...(ev.notes || []).map(note => `Note: ${note}`)
    ].join("\n");
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    scrim?.classList.remove("is-open");
    const oldDrawer = drawer;
    const oldScrim = scrim;
    drawer = null; scrim = null;
    setTimeout(() => { oldDrawer.remove(); oldScrim?.remove(); }, 320);
    document.removeEventListener("keydown", onKey, true);
    lastFocus?.focus?.();
  }

  function onKey(event) {
    if (!drawer) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "Tab") {
      const focusable = Array.from(drawer.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')).filter(node => !node.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function open(finding, { actions = [] } = {}) {
    if (!finding) return;
    if (drawer) { drawer.remove(); scrim?.remove(); }
    lastFocus = document.activeElement;
    scrim = document.createElement("div");
    scrim.className = "sn-scrim sn-scope";
    scrim.addEventListener("click", close);
    drawer = document.createElement("aside");
    drawer.className = "sn-drawer sn-scope";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "sn-evidence-title");
    drawer.innerHTML = `<div class="sn-drawer-head"><div><span class="sn-eyebrow"><i></i>Evidence</span><h2 id="sn-evidence-title" class="sn-h3" style="margin-top:8px">How this was calculated</h2></div><button type="button" class="sn-btn sn-btn-ghost sn-btn-icon" data-close aria-label="Close evidence">✕</button></div>
      <div class="sn-drawer-body">${bodyHtml(finding)}</div>
      <div class="sn-drawer-foot">${actions.map((action, index) => `<button type="button" class="sn-btn sn-btn-sm" data-action="${index}">${esc(action.label)}</button>`).join("")}<button type="button" class="sn-btn sn-btn-sm" data-copy>Copy evidence</button><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-close>Done</button></div>`;
    document.body.append(scrim, drawer);
    drawer.querySelectorAll("[data-close]").forEach(node => node.addEventListener("click", close));
    drawer.querySelector("[data-copy]")?.addEventListener("click", async event => {
      try { await navigator.clipboard.writeText(plainText(finding)); event.target.textContent = "Copied"; }
      catch (error) { event.target.textContent = "Copy unavailable"; }
    });
    drawer.querySelectorAll("[data-action]").forEach(node => node.addEventListener("click", () => actions[Number(node.dataset.action)]?.run?.(finding)));
    document.addEventListener("keydown", onKey, true);


    requestAnimationFrame(() => {
      if (!drawer.isConnected) return;
      scrim?.classList.add("is-open");
      drawer.classList.add("is-open");
      drawer.querySelector("[data-close]")?.focus();
    });
  }


  function bind(container, lookup, options = {}) {
    container.addEventListener("click", event => {
      const trigger = event.target.closest("[data-evidence]");
      if (!trigger || !container.contains(trigger)) return;
      event.preventDefault();
      open(lookup(trigger.dataset.evidence) || { id: trigger.dataset.evidence, title: trigger.getAttribute("aria-label")?.replace(/^Inspect evidence for: /, "") || "Finding" }, typeof options === "function" ? options(trigger.dataset.evidence) : options);
    });
  }

  const api = { open, close, bind, badge, button, plainText, validationOf, VALIDATION };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.SignalNoir = root.SignalNoir || {}; root.SignalNoir.Evidence = api; }
})(typeof window !== "undefined" ? window : null);
