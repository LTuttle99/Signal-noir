


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  const NS = window.SignalNoirVanessa;
  if (!studio || !NS) return;
  const esc = studio.escapeHtml;
  const project = () => studio.state.project;

  function chartHtml(chart) {
    if (!chart) return "";
    return chart.type === "line" ? SN.viz.line(chart.data || [], { projection: chart.projection || [], format: chart.format || {}, label: chart.label || "Trend" }) : SN.viz.bars(chart.data || [], { signed: chart.signed, format: chart.format || {} });
  }

  const optionButton = (option, run) => option.tool ? `<a class="sn-chip sn-chip-sm" href="../${esc(option.tool)}/index.html" data-open-tool="${esc(option.tool)}">${esc(option.label)} ↗</a>`
    : option.view ? `<button type="button" class="sn-chip sn-chip-sm" data-goto="${esc(option.view)}">${esc(option.label)}</button>`
    : option.action ? `<button type="button" class="sn-chip sn-chip-sm" data-vn-action="${esc(option.action)}">${esc(option.label)}</button>`
    : `<button type="button" class="sn-chip sn-chip-sm" data-vn-prompt="${esc(option.prompt || "")}" ${option.remember ? `data-vn-remember="${esc(JSON.stringify(option.remember))}"` : ""} data-run="${esc(run.id)}">${esc(option.label)}</button>`;

  const RENDER = {
    metrics: block => `<div class="vn-kpis">${block.items.map(item => `<div class="sn-panel sn-stat vn-metric ${item.tone ? `is-${esc(item.tone)}` : ""}"><span class="sn-stat-label">${esc(item.label)}</span><span class="sn-stat-value">${esc(item.value)}</span></div>`).join("")}</div>`,
    chart: block => `<figure class="vn-card vn-chart-card"><figcaption class="vn-card-title">${esc(block.title)}${block.findingId ? `<span class="vn-card-actions"><button type="button" class="sn-evidence-btn" data-evidence="${esc(block.findingId)}">Evidence</button></span>` : ""}</figcaption>${chartHtml(block.chart)}</figure>`,
    table: block => `<div class="vn-card"><p class="vn-card-title">${esc(block.title || "Table")}</p><div class="sn-table-wrap vn-table"><table class="sn-table"><thead><tr>${block.columns.map(col => `<th scope="col">${esc(col)}</th>`).join("")}</tr></thead><tbody>${block.rows.slice(0, 40).map(row => `<tr>${row.map(cell => `<td class="${typeof cell === "number" ? "is-num" : ""}">${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${block.rows.length > 40 ? `<p class="sn-muted sn-xs">Showing 40 of ${block.rows.length} rows.</p>` : ""}${block.note ? `<p class="sn-muted sn-xs" style="margin-top:6px">${esc(block.note)}</p>` : ""}</div>`,
    warning: block => `<div class="sn-callout sn-callout-warning" role="note"><span aria-hidden="true">⚠</span><span><strong>${esc(block.title)}.</strong> ${esc(block.text)}</span></div>`,

    restricted: block => `<div class="vn-card vn-restricted" role="note"><p class="vn-card-title">${esc(block.title)}</p><p class="vn-restricted-text">${esc(block.text)}</p>${block.capability ? `<p class="vn-restricted-meta">Required capability: ${esc(SN.access?.capability(block.capability)?.name || block.capability)}</p>` : ""}</div>`,
    error: (block, run) => `<div class="vn-card vn-error" role="alert"><p class="vn-card-title">✕ ${esc(block.title)}</p><dl class="vn-error-grid">${block.what ? `<dt>What happened</dt><dd>${esc(block.what)}</dd>` : ""}${block.why ? `<dt>Why</dt><dd>${esc(block.why)}</dd>` : ""}${block.affected ? `<dt>Affected</dt><dd>${esc(block.affected)}</dd>` : ""}</dl>${block.next?.length ? `<div class="sn-cluster" style="margin-top:10px">${block.next.map(option => optionButton(option, run)).join("")}</div>` : ""}</div>`,
    clarify: (block, run) => `<div class="vn-card vn-clarify"><p class="vn-card-title"><span class="sn-status" data-status="pending" aria-hidden="true"></span> Waiting for you</p><p>${esc(block.question)}</p><div class="sn-cluster" style="margin-top:10px">${block.options.map(option => optionButton(option, run)).join("")}</div></div>`,
    interpretation: block => `<div class="vn-interpretation" data-source="${esc(block.source)}"><span class="vn-interp-label">${block.source === "ai" ? `AI interpretation · ${esc(block.provider || "local model")} · not calculated` : "Interpretation · rule-based from the numbers above"}</span><p>${esc(block.text)}</p>${block.basis ? `<small>Basis: ${esc(block.basis)}${block.confidence ? ` · confidence ${esc(block.confidence)}` : ""}</small>` : ""}</div>`,
    quality: (block, run) => { const dataset = project().datasets.find(item => item.id === block.datasetId); return dataset ? `<div class="vn-card"><p class="vn-card-title">Review fixes for ${esc(block.datasetName)} <span class="sn-badge ${block.score < 80 ? "sn-badge-warning" : "sn-badge-success"}">${esc(block.score)}/100</span></p><div class="vn-review" data-cleaning="${esc(run.id)}">${block.issues.filter(issue => issue.fix).map(issue => `<label><input type="checkbox" value="${esc(issue.id)}" ${issue.safe ? "checked" : ""}><span>${esc(issue.fix)}<br><small class="sn-muted">${esc(issue.title)}</small></span>${issue.safe ? '<span class="sn-badge sn-badge-success">Safe</span>' : '<span class="sn-badge sn-badge-warning">Review</span>'}</label>`).join("")}</div>${block.issues.some(issue => !issue.fix) ? `<p class="sn-muted sn-xs" style="margin-top:8px">Missing values aren’t filled automatically; filling them would invent data.</p>` : ""}<div class="sn-cluster" style="margin-top:10px"><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-apply-cleaning="${esc(run.id)}" data-dataset="${esc(dataset.id)}">Create cleaned copy with selected fixes</button><span class="sn-muted sn-xs">Requires your confirmation · the original stays untouched</span></div></div>` : ""; },
    join: (block, run) => `<div class="vn-card"><p class="vn-card-title">Joins you can create</p><div class="vn-next">${block.suggestions.map(item => `<div class="vn-next-item"><span>${esc(item.leftName)} + ${esc(item.rightName)} on <code class="sn-mono">${esc(item.column)}</code> · ${Math.round(item.matchRate * 100)}% match</span><button type="button" class="sn-btn sn-btn-sm" data-vn-prompt="${esc(`Join ${item.leftName} and ${item.rightName} using ${item.column} and ${item.column}`)}" data-run="${esc(run.id)}">Create joined dataset</button></div>`).join("")}</div></div>`,
    next: (block, run) => `<div class="vn-card"><p class="vn-card-title">Suggested follow-through <span class="sn-muted sn-xs">nothing is assigned until you choose</span></p><div class="vn-next">${block.items.map((item, index) => { const exists = (item.kind === "task" ? project().tasks : project().decisions).some(entry => entry.title === item.title); return `<div class="vn-next-item"><span>${item.kind === "task" ? "☐" : "◇"} ${esc(item.title)}</span><button type="button" class="sn-btn sn-btn-sm" data-create-next="${esc(run.id)}:${index}" ${exists ? "disabled" : ""}>${exists ? "Added" : item.kind === "task" ? "Add task" : "Record decision"}</button></div>`; }).join("")}</div></div>`,
    output: block => { const output = project().outputs.find(item => item.id === block.outputId); return output ? `<div class="vn-card vn-output"><span class="sn-card-icon" aria-hidden="true">${block.kind === "report" ? "▤" : block.kind === "workflow" ? "↻" : "▥"}</span><span><strong>${esc(output.title)}</strong><small>${esc(block.kind)} · saved in Outputs</small></span><button type="button" class="sn-btn sn-btn-sm" data-open-output="${esc(output.id)}">Open</button></div>` : `<p class="sn-muted sn-xs">This output was deleted.</p>`; },
    capability: block => `<div class="sn-callout ${block.status === "planned" ? "sn-callout-preview" : ""}"><span aria-hidden="true">${block.status === "planned" ? "◌" : "→"}</span><span><strong>${esc(block.title)}</strong> <span class="sn-badge ${block.status === "planned" ? "sn-badge-preview" : block.status === "requires-user" ? "sn-badge-warning" : "sn-badge-success"}">${block.status === "planned" ? "Planned" : block.status === "requires-user" ? "Needs your action" : "Available now"}</span><br>${esc(block.text)}${block.tool ? ` <a class="sn-link" href="../${esc(block.tool)}/index.html">Open it ↗</a>` : ""}</span></div>`,
    "needs-data": () => `<div class="vn-needs-data"><div class="vn-dropzone" data-vn-drop tabindex="0" role="button" aria-label="Add data files"><strong>Drop CSV, Excel, JSON or ZIP files here</strong><span>or choose files · they stay in this browser</span></div>${project().isDemo ? "" : '<div class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-open-demo>Try it on the demo project instead</button></div>'}</div>`,
    context: block => `<div class="vn-card vn-context-card"><p class="vn-card-title">From ${esc(block.sourceLabel || block.source)}</p>${block.summary ? `<p class="sn-body">${esc(block.summary)}</p>` : ""}${block.facts?.length ? `<ul class="vn-facts">${block.facts.slice(0, 8).map(fact => `<li>${esc(fact)}</li>`).join("")}</ul>` : ""}<p class="sn-muted sn-xs">Handed over locally from the tool; nothing was uploaded.</p></div>`
  };

  function findingHtml(item, run) {
    const saved = project().findings.some(entry => entry.id === item.id);
    const ev = item.evidence;
    const meta = ev ? [ev.dataset, ev.rows != null ? `${Number(ev.rows).toLocaleString()} rows` : null, ev.method].filter(Boolean).join(" · ") : "No evidence attached";
    const kind = ev?.validation === "estimated" ? "Estimate" : ev ? "Calculated" : "Unverified";
    return `<div class="vn-finding" data-tone="${esc(item.tone)}"><span class="vn-finding-mark" aria-hidden="true"></span><div><span class="vn-finding-kind" data-kind="${kind.toLowerCase()}">${kind}</span><p>${esc(item.title)}</p><small>${esc(meta)}</small></div><div class="vn-finding-actions">${SN.Evidence.button(item)}<button type="button" class="sn-evidence-btn vn-save" data-save-finding="${esc(item.id)}" data-run="${esc(run.id)}" aria-pressed="${saved}" aria-label="${saved ? "Saved to outputs" : "Save finding to outputs"}">${saved ? "Saved" : "Save"}</button><button type="button" class="sn-evidence-btn" data-finding-task="${esc(item.id)}" aria-label="Turn this finding into a task">Task</button></div></div>`;
  }


  function legacyBlocks(record) {
    const blocks = [];
    if (record.kpis?.length) blocks.push({ type: "metrics", items: record.kpis });
    if (record.visual) blocks.push({ type: "chart", title: record.visual.title, chart: record.visual.chart });
    (record.extras || []).forEach(extra => {
      if (extra.type === "cleaning") blocks.push({ type: "quality", datasetId: extra.datasetId, datasetName: extra.datasetName, score: "?", issues: extra.issues });
      else if (extra.type === "next") blocks.push({ type: "next", items: extra.items });
      else if (["join", "output", "needs-data"].includes(extra.type)) blocks.push({ ...extra });
    });
    return blocks;
  }

  function resultsHtml(record) {
    const blocks = record.blocks || legacyBlocks(record);
    const first = blocks.filter(block => block.type === "metrics");
    const visuals = blocks.filter(block => ["chart", "table"].includes(block.type));
    const rest = blocks.filter(block => !["metrics", "chart", "table"].includes(block.type));
    const tools = (record.tools || [...new Set((record.toolLog || []).map(entry => NS.registry.get(entry.tool)?.relatedTool).filter(Boolean))]).map(SN.catalog.tool).filter(Boolean).slice(0, 2);
    const canInterpret = record.findings?.length && SN.providers?.preferred().kind === "llm" && !blocks.some(block => block.type === "interpretation" && block.source === "ai");
    return `${record.summary ? `<div class="vn-summary"><span class="vn-summary-label">${record.findings?.length ? "Calculated result" : "Summary"}</span><p>${esc(record.summary)}</p></div>` : ""}
      ${first.map(block => RENDER.metrics(block, record)).join("")}
      ${record.findings?.length ? `<div class="vn-findings" role="list" aria-label="Findings">${record.findings.map(item => `<div role="listitem">${findingHtml(item, record)}</div>`).join("")}</div>` : ""}
      ${visuals.map(block => RENDER[block.type](block, record)).join("")}
      ${rest.map(block => RENDER[block.type]?.(block, record) || "").join("")}
      ${record.followups?.length && record.status === "complete" ? `<div class="vn-followups"><span class="sn-muted sn-xs">Next</span>${record.followups.slice(0, 4).map(option => optionButton(option, record)).join("")}</div>` : ""}
      ${record.findings?.length || tools.length ? `<div class="vn-actions">${record.findings?.length ? `<button type="button" class="sn-btn sn-btn-sm" data-vn-prompt="Put these findings into a report" data-run="${esc(record.id)}">Add to report</button><button type="button" class="sn-btn sn-btn-sm" data-vn-prompt="Make that a dashboard" data-run="${esc(record.id)}">Make a dashboard</button>` : ""}${canInterpret ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-interpret="${esc(record.id)}" title="Sends only the calculated finding sentences to ${esc(SN.providers.preferred().label)} on this device">Interpret with local model</button>` : ""}${project().datasets.length ? tools.filter(tool => tool.accepts === "tabular").map(tool => `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-open-tool="${esc(tool.id)}" title="Hands the dataset to this tool">Open in ${esc(tool.title)} ↗</button>`).join("") : ""}</div>` : ""}`;
  }

  function toolLogHtml(record) {
    if (!record.toolLog?.length) return "";
    const total = record.toolLog.reduce((sum, entry) => sum + entry.ms, 0);
    return `<details class="vn-toollog"><summary>Tools used · ${record.toolLog.length} · ${total} ms</summary><ol>${record.toolLog.map(entry => { const tool = NS.registry.get(entry.tool); return `<li><code class="sn-mono">${esc(entry.tool)}</code> <span class="sn-muted">${esc(tool?.name || entry.label || "")}</span> <span class="vn-toollog-status" data-status="${esc(entry.status)}">${esc(entry.status)}</span> <span class="sn-faint">${entry.ms} ms</span></li>`; }).join("")}</ol><p class="sn-faint sn-xs">Routed by ${esc(record.route?.provider === "rules" || !record.route ? "the rules engine" : record.route.provider)}${record.route?.reason ? ` · ${esc(record.route.reason)}` : ""}. Everything ran on this device.</p></details>`;
  }

  const STATUS = { complete: ["Done", "sn-badge-success"], waiting: ["Needs input", "sn-badge-warning"], failed: ["Stopped", "sn-badge-danger"], cancelled: ["Cancelled", "sn-badge-muted"], running: ["Working", "sn-badge-accent"], stopped: ["Stopped", "sn-badge-danger"] };
  function headerHtml(record) {
    const [label, cls] = STATUS[record.status] || STATUS.complete;
    return `<header class="vn-reply-head"><span class="vanessa-avatar-sm" aria-hidden="true">V</span><strong>Vanessa</strong>${record.intentLabel ? `<span class="sn-badge sn-badge-accent">${esc(record.intentLabel)}</span>` : ""}<span class="sn-badge ${cls}" data-run-status>${label}</span><span class="vn-meta">${record.durationMs != null ? `${record.durationMs} ms · ` : ""}on-device</span></header>`;
  }

  NS.cards = { chartHtml, resultsHtml, toolLogHtml, headerHtml, findingHtml, legacyBlocks, RENDER };
})();
