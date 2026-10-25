


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const SN = window.SignalNoir || {};
  if (!studio || !SN.operations) return;
  const O = SN.operations;
  const A = SN.artifacts;
  const access = () => SN.access;
  const esc = studio.escapeHtml;
  const $ = selector => document.querySelector(selector);
  const project = () => studio.state.project;

  let tab = "inbox";
  let openRunId = null;

  const can = id => !access() || access().can(id);
  const may = capability => { const a = access(); return !a || a.projectAccess.allows(capability, project().id); };

  const relative = value => {
    if (!value) return "";
    const diff = Date.now() - value;
    if (diff < 0) return `in ${Math.round(-diff / 60000)}m`;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.round(diff / 86400000)}d ago`;
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const when = value => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const severityBadge = severity => `<span class="sn-badge ${severity === "critical" ? "sn-badge-danger" : severity === "warning" ? "sn-badge-warning" : "sn-badge-muted"}">${esc(severity)}</span>`;
  const runBadge = status => { const spec = O.runStatus(status); return `<span class="sn-badge ${spec.tone === "success" ? "sn-badge-success" : spec.tone === "danger" ? "sn-badge-danger" : spec.tone === "warning" ? "sn-badge-warning" : "sn-badge-muted"}">${esc(spec.label)}</span>`; };
  const empty = (icon, title, text, action = "") => `<div class="sn-empty"><div class="sn-empty-icon">${icon}</div><div class="sn-empty-title">${esc(title)}</div><div class="sn-empty-text">${esc(text)}</div>${action ? `<div class="sn-empty-actions">${action}</div>` : ""}</div>`;


  function renderHeader() {
    const health = O.health(project());
    const state = health.state;
    const tone = state === "failing" ? "sn-badge-danger" : state === "warning" ? "sn-badge-warning" : state === "healthy" ? "sn-badge-success" : "sn-badge-muted";
    const label = { failing: "Something is failing", warning: "Needs a look", healthy: "Healthy", idle: "Nothing scheduled yet" }[state] || state;
    $("#ops-health").innerHTML = `<span class="sn-badge ${tone}">${esc(label)}</span>`;
    const stats = [
      ["Active automations", health.activeAutomations],
      ["Runs recorded", health.runsRecorded],
      ["Succeeded", health.succeeded],
      ["Warnings", health.warnings],
      ["Failed", health.failed],
      ["Open alerts", health.openAlerts],
      ["Needs attention", health.needsAttention]
    ];
    $("#ops-stats").innerHTML = stats.map(([label, value]) => `<div class="ops-stat"><span>${esc(label)}</span><b>${value}</b></div>`).join("");
    const counts = { inbox: health.needsAttention, automations: O.automations.list(project()).length, monitors: O.monitors.list(project()).length, runs: health.runsRecorded, templates: O.TEMPLATES.length };
    $("#ops-tabs").innerHTML = [["inbox", "Inbox"], ["automations", "Automations"], ["monitors", "Monitors"], ["runs", "Run history"], ["templates", "Templates"]]
      .map(([id, label]) => `<button type="button" class="sn-tab" role="tab" aria-selected="${id === tab}" data-opshub-tab="${id}">${esc(label)}<span class="sn-count">${counts[id] || 0}</span></button>`).join("");
    const badge = $("#nav-ops-count");
    if (badge) badge.textContent = health.needsAttention ? String(health.needsAttention) : "";
  }


  const INBOX_ACTIONS = {
    "review-alert": item => `<button type="button" class="sn-btn sn-btn-sm" data-alert-open="${esc(item.id)}">Review</button>`,
    "open-run": item => `<button type="button" class="sn-btn sn-btn-sm" data-run-open="${esc(item.id)}">See what failed</button>`,
    "approve-run": item => `<button type="button" class="sn-btn sn-btn-sm" data-run-open="${esc(item.id)}">Review &amp; approve</button>`,
    "run-now": item => `<button type="button" class="sn-btn sn-btn-sm" data-run-missed="${esc(item.id)}">Run now</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-skip-missed="${esc(item.id)}">Skip</button>`,
    "open-artifact": item => `<button type="button" class="sn-btn sn-btn-sm" data-artifact="${esc(item.id)}">Open</button>`,
    "open-automation": item => `<button type="button" class="sn-btn sn-btn-sm" data-automation-open="${esc(item.id)}">Open</button>`
  };

  function renderInbox() {
    const items = O.attention(project());
    if (!items.length) return empty("✓", "Nothing needs your attention", "Alerts, failed runs, approvals, missed schedules and work assigned to you collect here.");
    return `<div class="ops-list">${items.map(item => `<article class="ops-row ops-row-${esc(item.severity)}">
      <span class="ops-row-icon" aria-hidden="true">${item.type === "alert" ? "!" : item.type === "run-failed" ? "✕" : item.type === "approval" ? "◇" : item.type === "missed" ? "○" : item.type === "task" ? "☐" : "↻"}</span>
      <div class="ops-row-body">
        <div class="ops-row-title"><strong>${esc(item.title)}</strong>${severityBadge(item.severity)}</div>
        <p class="ops-row-desc">${esc(item.description || "")}</p>
        <p class="ops-row-meta">${esc(item.source)}${item.createdAt ? ` · ${esc(relative(item.createdAt))}` : ""}${item.assignedTo ? ` · ${esc(item.assignedTo)}` : ""}</p>
      </div>
      <div class="ops-row-actions sn-cluster">${(INBOX_ACTIONS[item.action] || (() => ""))(item)}</div>
    </article>`).join("")}</div>`;
  }


  function renderAutomations() {
    const p = project();
    const list = O.automations.list(p);
    const create = may("automation.create") ? '<button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-automation-new>New automation</button>' : "";
    if (!list.length) return `${create ? `<div class="sn-cluster" style="margin-bottom:16px">${create}</div>` : ""}${empty("↻", "No automations yet", "Turn a reusable workflow into a recurring process.", create)}`;
    return `<div class="sn-cluster" style="margin-bottom:16px">${create}</div><div class="ops-list">${list.map(automation => {
      const spec = O.trigger(automation.triggerType);
      const workflow = O.workflows.get(p, automation.workflowId);
      const statusDef = O.AUTOMATION_STATUS.find(item => item.id === automation.status);
      const tone = automation.status === "active" ? "sn-badge-success" : automation.status === "needs-attention" ? "sn-badge-danger" : "sn-badge-muted";
      const timing = automation.triggerType === "local-schedule" ? O.describeSchedule(automation.schedule)
        : automation.triggerType === "cloud-schedule" ? `${O.describeSchedule(automation.schedule)} · needs connected automation`
        : spec?.label || automation.triggerType;
      return `<article class="ops-row">
        <span class="ops-row-icon" aria-hidden="true">↻</span>
        <div class="ops-row-body">
          <div class="ops-row-title"><strong>${esc(automation.name)}</strong><span class="sn-badge ${tone}">${esc(statusDef?.label || automation.status)}</span>${automation.triggerType === "cloud-schedule" ? '<span class="sn-badge sn-badge-preview">Planned</span>' : ""}</div>
          <p class="ops-row-desc">${esc(timing)}</p>
          <p class="ops-row-meta">${esc(workflow ? `${workflow.name} · version ${automation.workflowVersion ?? workflow.version}` : "No workflow")}${automation.lastRunAt ? ` · last run ${esc(relative(automation.lastRunAt))} (${esc(O.runStatus(automation.lastRunStatus).label.toLowerCase())})` : " · never run"}${automation.nextRunAt ? ` · next ${esc(when(automation.nextRunAt))}` : ""}</p>
        </div>
        <div class="ops-row-actions sn-cluster">
          ${may("workflows.run") && automation.workflowId ? `<button type="button" class="sn-btn sn-btn-sm" data-automation-run="${esc(automation.id)}">Run now</button>` : ""}
          <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-automation-open="${esc(automation.id)}">Configure</button>
        </div>
      </article>`;
    }).join("")}</div>
    <p class="ops-note">Local schedules are checked while Studio is open. Nothing runs when Signal Noir is closed — a run that comes due meanwhile is recorded as missed and waits for you in the Inbox.</p>`;
  }


  function renderMonitors() {
    const p = project();
    const list = O.monitors.list(p);
    const create = may("monitor.create") ? '<button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-monitor-new>New monitor</button>' : "";
    const checkAll = list.length ? '<button type="button" class="sn-btn sn-btn-sm" data-monitors-check>Check all now</button>' : "";
    if (!list.length) return `${create ? `<div class="sn-cluster" style="margin-bottom:16px">${create}</div>` : ""}${empty("◎", "No monitors yet", "Watch a metric, a data quality check, how fresh a dataset is, or whether an automation is failing.", create)}`;
    return `<div class="sn-cluster" style="margin-bottom:16px">${create}${checkAll}</div><div class="ops-list">${list.map(monitor => {
      const kind = O.MONITOR_KINDS.find(item => item.id === monitor.kind);
      const met = monitor.lastResult?.met;
      return `<article class="ops-row${met ? " ops-row-warning" : ""}">
        <span class="ops-row-icon" aria-hidden="true">◎</span>
        <div class="ops-row-body">
          <div class="ops-row-title"><strong>${esc(monitor.name)}</strong>${severityBadge(monitor.severity)}${monitor.status === "paused" ? '<span class="sn-badge sn-badge-muted">Paused</span>' : ""}</div>
          <p class="ops-row-desc">${esc(O.describeCondition(monitor))} · ${esc(kind?.label || monitor.kind)}</p>
          <p class="ops-row-meta">${monitor.lastCheckedAt ? `Checked ${esc(relative(monitor.lastCheckedAt))} · ${esc(monitor.lastResult?.reason || "")}` : "Not checked yet"}</p>
        </div>
        <div class="ops-row-actions sn-cluster">
          <button type="button" class="sn-btn sn-btn-sm" data-monitor-check="${esc(monitor.id)}">Check</button>
          <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-monitor-open="${esc(monitor.id)}">Edit</button>
        </div>
      </article>`;
    }).join("")}</div>
    <p class="ops-note">Monitors are evaluated by Signal Noir's own code, never by a language model. Each check records the value, the threshold and the data it read.</p>`;
  }


  function renderRuns() {
    const list = O.runs.list(project(), { limit: 60 });
    if (!list.length) return empty("▶", "No runs yet", "Run a workflow and every execution is recorded here with its steps, outputs and evidence.");
    return `<div class="ops-list">${list.map(run => `<article class="ops-row">
      <span class="ops-row-icon" aria-hidden="true">${run.status === "failed" ? "✕" : run.status === "missed" ? "○" : run.status === "succeeded" ? "✓" : "!"}</span>
      <div class="ops-row-body">
        <div class="ops-row-title"><strong>${esc(run.workflowName || "Workflow")}</strong>${runBadge(run.status)}${run.retryOf ? '<span class="sn-badge sn-badge-muted">Retry</span>' : ""}</div>
        <p class="ops-row-desc">${esc(run.summary || "")}</p>
        <p class="ops-row-meta">${esc(O.trigger(run.triggerType)?.label || run.triggerType)} · ${esc(run.startedAt ? when(run.startedAt) : `due ${when(run.dueAt)}`)}${run.durationMs != null ? ` · ${Math.max(1, Math.round(run.durationMs))}ms` : ""}${run.workflowVersion ? ` · v${run.workflowVersion}` : ""}</p>
      </div>
      <div class="ops-row-actions sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-run-open="${esc(run.id)}">Details</button></div>
    </article>`).join("")}</div>
    <p class="ops-note">Step detail is kept for the ${30} most recent runs; older runs keep their status, timing and outputs.</p>`;
  }


  function renderTemplates() {
    return `<div class="ops-templates">${O.TEMPLATES.map(item => `<article class="ops-template">
      <div class="sn-split"><h3 class="sn-h4">${esc(item.name)}</h3>${item.sample ? '<span class="sn-badge sn-badge-preview">Sample</span>' : ""}</div>
      <p class="sn-muted sn-small">${esc(item.description)}</p>
      <p class="sn-faint sn-xs">${esc(item.steps.length)} steps${item.schedule ? ` · suggested ${esc(O.describeSchedule(O.makeSchedule(item.schedule)))}` : " · run on demand"}</p>
      <p class="sn-faint sn-xs">Expects: ${esc(item.expects)}</p>
      <div class="sn-cluster" style="margin-top:auto">${may("automation.create") ? `<button type="button" class="sn-btn sn-btn-sm" data-template-use="${esc(item.id)}">Use this</button>` : ""}</div>
    </article>`).join("")}</div>`;
  }


  function openRun(id) {
    const p = project();
    const run = O.runs.get(p, id);
    if (!run) return;
    openRunId = id;
    const dataset = p.datasets.find(item => item.id === run.datasetId);
    const steps = run.detailPruned
      ? `<p class="project-empty">Step detail for this run has been summarized away. It had ${run.stepCount} steps.</p>`
      : `<ol class="run-steps">${run.steps.map(step => `<li class="run-step run-step-${esc(step.status)}"><span aria-hidden="true">${step.status === "succeeded" ? "✓" : step.status === "warning" ? "⚠" : step.status === "failed" ? "✕" : step.status === "skipped" ? "–" : "◇"}</span><span><strong>${esc(step.label)}</strong>${step.detail ? `<small>${esc(step.detail)}</small>` : ""}</span><em>${esc(step.status)}</em></li>`).join("")}</ol>`;
    const errors = run.errors.length ? `<section class="run-error"><h3 class="sn-h4">What went wrong</h3>${run.errors.map(error => `<div class="run-error-body"><strong>${esc(error.title || "Error")}</strong><p>${esc(error.what || "")}</p>${error.why ? `<p class="sn-muted sn-small">${esc(error.why)}</p>` : ""}${error.affected ? `<p class="sn-faint sn-xs">${esc(error.affected)}</p>` : ""}</div>`).join("")}</section>` : "";
    const warnings = run.warnings.length ? `<section><h3 class="sn-h4">Warnings</h3><ul class="run-warnings">${run.warnings.map(warning => `<li>${esc(warning)}</li>`).join("")}</ul></section>` : "";
    const outputs = run.outputs.length ? `<section><h3 class="sn-h4">Outputs</h3><ul class="lineage-list">${run.outputs.map(output => `<li><span aria-hidden="true">${output.type === "report" ? "▤" : output.type === "alert" ? "!" : output.type === "task" ? "☐" : "✦"}</span>${output.type === "alert" ? `<button type="button" class="sn-link" data-alert-open="${esc(output.id)}">${esc(output.title)}</button>` : `<button type="button" class="sn-link" data-artifact="${esc(output.id)}">${esc(output.title)}</button>`}<span class="sn-faint sn-xs">${esc(output.type)}</span></li>`).join("")}</ul></section>` : "";
    const approval = run.status === "waiting-approval" && may("workflows.approve")
      ? `<div class="sn-cluster" style="margin-top:16px"><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-run-approve="${esc(run.id)}">Approve and finish</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-run-decline="${esc(run.id)}">Decline</button></div>` : "";
    const retry = ["failed", "cancelled", "missed"].includes(run.status) && may("workflows.run")
      ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-run-retry="${esc(run.id)}">${run.status === "missed" ? "Run now" : "Run again"}</button>` : "";

    studio.dialog(`<div class="run-detail">
      <span class="eyebrow">Run ${esc(run.id.slice(-6))}</span>
      <h2 style="margin:8px 0 6px">${esc(run.workflowName || "Workflow")}</h2>
      <div class="sn-cluster" style="margin-bottom:14px">${runBadge(run.status)}<span class="sn-muted sn-small">${esc(O.trigger(run.triggerType)?.label || run.triggerType)}${run.triggeredBy ? ` · ${esc(run.triggeredBy)}` : ""}</span></div>
      <dl class="artifact-evidence">
        <dt>Started</dt><dd>${esc(run.startedAt ? when(run.startedAt) : "Never started")}</dd>
        <dt>Finished</dt><dd>${esc(run.finishedAt ? when(run.finishedAt) : "—")}</dd>
        ${run.dueAt ? `<dt>Was due</dt><dd>${esc(when(run.dueAt))}</dd>` : ""}
        <dt>Workflow version</dt><dd>${esc(String(run.workflowVersion ?? "—"))}</dd>
        <dt>Input</dt><dd>${esc(dataset ? `${dataset.name} · ${(dataset.rows || []).length.toLocaleString()} rows` : "No dataset")}</dd>
        ${run.retryOf ? `<dt>Retry of</dt><dd><button type="button" class="sn-link" data-run-open="${esc(run.retryOf)}">run ${esc(run.retryOf.slice(-6))}</button></dd>` : ""}
      </dl>
      <section><h3 class="sn-h4">Steps</h3>${steps}</section>
      ${errors}${warnings}${outputs}
      ${approval}
      <div class="sn-split" style="margin-top:20px;gap:10px">
        <span class="sn-cluster">${retry}${can("vanessa.use") ? `<button type="button" class="sn-btn sn-btn-sm" data-run-ask="${esc(run.id)}">Ask Vanessa</button>` : ""}</span>
        <button type="button" class="sn-btn sn-btn-sm" data-cancel>Close</button>
      </div>
    </div>`);
  }


  function openAlert(id) {
    const p = project();
    const alert = O.alerts.get(p, id);
    if (!alert) return;
    const members = access() && !access().isPersonal() ? access().members.list() : [];
    const ev = alert.evidence;
    studio.dialog(`<div class="run-detail">
      <span class="eyebrow">Alert</span>
      <h2 style="margin:8px 0 6px">${esc(alert.title)}</h2>
      <div class="sn-cluster" style="margin-bottom:12px">${severityBadge(alert.severity)}<span class="sn-badge ${alert.status === "open" ? "sn-badge-warning" : "sn-badge-muted"}">${esc(alert.status)}</span><span class="sn-muted sn-small">${esc(relative(alert.createdAt))}</span></div>
      <p class="sn-body">${esc(alert.description)}</p>
      <dl class="artifact-evidence">
        <dt>Current value</dt><dd>${esc(alert.value == null ? "—" : String(alert.value))}</dd>
        <dt>Threshold</dt><dd>${esc(alert.threshold == null ? "—" : String(alert.threshold))}</dd>
        ${ev ? `<dt>Dataset</dt><dd>${esc(ev.dataset || "—")}</dd><dt>Rows</dt><dd>${esc(String(ev.rows ?? "—"))}</dd><dt>Calculation</dt><dd><code>${esc(ev.calculation || "—")}</code></dd><dt>Method</dt><dd>${esc(ev.method || "—")}</dd><dt>Calculated</dt><dd>${esc(ev.generatedAt ? new Date(ev.generatedAt).toLocaleString() : "—")}</dd>` : ""}
      </dl>
      ${alert.resolution ? `<p class="sn-muted sn-small" style="margin-top:12px"><strong>Resolution:</strong> ${esc(alert.resolution)}${alert.resolvedBy ? ` — ${esc(alert.resolvedBy)}` : ""}</p>` : ""}
      ${members.length ? `<div style="margin-top:14px"><label class="sn-label" for="alert-assignee">Assign to</label><select class="sn-select sn-select-sm" id="alert-assignee"><option value="">Nobody</option>${members.map(member => `<option value="${esc(member.name)}" ${member.name === alert.assignedTo ? "selected" : ""}>${esc(member.name)}</option>`).join("")}</select></div>` : ""}
      ${alert.status === "open" ? `<div style="margin-top:14px"><label class="sn-label" for="alert-resolution">Resolution note</label><input class="sn-input" id="alert-resolution" placeholder="What did you find, and what did you do?" maxlength="400"></div>` : ""}
      <div class="sn-split" style="margin-top:18px;gap:10px">
        <span class="sn-cluster">
          ${alert.status === "open" && may("alert.manage") ? `<button type="button" class="sn-btn sn-btn-sm" data-alert-ack="${esc(alert.id)}">Acknowledge</button><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-alert-resolve="${esc(alert.id)}">Resolve</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-alert-ignore="${esc(alert.id)}">Ignore</button>` : ""}
          ${may("tasks.manage") ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-alert-task="${esc(alert.id)}">Create task</button>` : ""}
        </span>
        <button type="button" class="sn-btn sn-btn-sm" data-cancel>Close</button>
      </div>
    </div>`);
  }


  function openAutomation(id) {
    const p = project();
    const automation = id ? O.automations.get(p, id) : null;
    const workflowList = O.workflows.list(p);
    if (!workflowList.length) {
      studio.dialog(`<span class="eyebrow">Automation</span><h2 style="margin:8px 0 6px">A workflow comes first</h2><p class="muted">An automation says <em>when</em> something runs. It needs a workflow that says <em>what</em> runs. Start from a template and you get both.</p><div class="sn-cluster" style="margin-top:18px"><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-goto-templates>See templates</button><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button></div>`);
      return;
    }
    const schedule = automation?.schedule || O.makeSchedule({});
    const monitorList = O.monitors.list(p);
    studio.dialog(`<form id="automation-form" class="run-detail">
      <span class="eyebrow">${automation ? "Configure automation" : "New automation"}</span>
      <h2 style="margin:8px 0 14px">${esc(automation?.name || "When should this run?")}</h2>
      <div class="form-grid">
        <label class="sn-label" for="auto-name">Name</label>
        <input class="sn-input" id="auto-name" name="name" value="${esc(automation?.name || "")}" required maxlength="120" placeholder="Weekly tour operations review">

        <label class="sn-label" for="auto-workflow">Run this workflow</label>
        <select class="sn-select" id="auto-workflow" name="workflowId">${workflowList.map(workflow => `<option value="${esc(workflow.id)}" ${workflow.id === automation?.workflowId ? "selected" : ""}>${esc(workflow.name)} (v${workflow.version}${workflow.approved ? ", approved" : ""})</option>`).join("")}</select>

        <label class="sn-label" for="auto-trigger">When</label>
        <select class="sn-select" id="auto-trigger" name="triggerType">${O.TRIGGERS.map(item => `<option value="${esc(item.id)}" ${item.id === (automation?.triggerType || "manual") ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select>
        <p class="sn-field-hint" id="auto-trigger-hint"></p>

        <div id="auto-schedule-block" hidden>
          <label class="sn-label" for="auto-frequency">How often</label>
          <div class="sn-cluster">
            <select class="sn-select sn-select-sm" id="auto-frequency" name="frequency">${O.FREQUENCIES.map(item => `<option value="${esc(item.id)}" ${item.id === schedule.frequency ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select>
            <select class="sn-select sn-select-sm" id="auto-day" name="day" aria-label="Day of the week">${O.scheduler.DAYS.map((day, index) => `<option value="${index}" ${index === schedule.day ? "selected" : ""}>${esc(day)}</option>`).join("")}</select>
            <input class="sn-input sn-select-sm" style="max-width:110px" type="time" id="auto-time" name="time" value="${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}" aria-label="Time of day">
          </div>
          <p class="sn-field-hint">Times are in ${esc(O.timezoneName())}.</p>
        </div>

        <div id="auto-monitor-block" hidden>
          <label class="sn-label" for="auto-monitor">When this monitor's condition is met</label>
          <select class="sn-select" id="auto-monitor" name="monitorId"><option value="">Choose a monitor</option>${monitorList.map(monitor => `<option value="${esc(monitor.id)}" ${monitor.id === automation?.monitorId ? "selected" : ""}>${esc(monitor.name)}</option>`).join("")}</select>
        </div>

        <label class="sn-label" for="auto-dataset">Using</label>
        <select class="sn-select" id="auto-dataset" name="datasetId"><option value="">Whatever the project's active dataset is</option>${p.datasets.map(dataset => `<option value="${esc(dataset.id)}" ${dataset.id === automation?.datasetId ? "selected" : ""}>${esc(dataset.name)}</option>`).join("")}</select>
      </div>
      <div id="auto-consequences"></div>
      <div class="sn-split" style="margin-top:20px;gap:10px">
        <span class="sn-cluster">${automation && may("automation.delete") ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-automation-delete="${esc(automation.id)}">Delete</button>` : ""}${automation?.status === "active" ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-automation-pause="${esc(automation.id)}">Pause</button>` : ""}</span>
        <span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">${automation ? "Save" : "Create as draft"}</button></span>
      </div>
    </form>`);

    const form = $("#automation-form");
    const sync = () => {
      const value = form.triggerType.value;
      const spec = O.trigger(value);
      $("#auto-trigger-hint").textContent = spec?.description || "";
      $("#auto-schedule-block").hidden = !["local-schedule", "cloud-schedule"].includes(value);
      $("#auto-monitor-block").hidden = value !== "condition";
      const workflow = O.workflows.get(p, form.workflowId.value);
      const effects = workflow ? O.consequences(p, { workflowId: workflow.id, workflowVersion: workflow.version }) : [];
      $("#auto-consequences").innerHTML = effects.length
        ? `<div class="sn-callout sn-callout-warning" style="margin-top:14px"><span aria-hidden="true">⚠</span><span>Each time this runs it will <strong>${esc(effects.join(", "))}</strong>. It stays a draft until you activate it.</span></div>`
        : "";
    };
    form.addEventListener("change", sync);
    sync();

    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(form);
      const [hour, minute] = String(data.get("time") || "08:00").split(":").map(Number);
      const triggerType = data.get("triggerType");
      const config = {
        name: data.get("name"), workflowId: data.get("workflowId"), triggerType,
        datasetId: data.get("datasetId") || null, monitorId: data.get("monitorId") || null,
        schedule: ["local-schedule", "cloud-schedule"].includes(triggerType)
          ? O.makeSchedule({ frequency: data.get("frequency"), day: Number(data.get("day")), hour, minute })
          : null
      };
      if (automation) O.automations.update(p, automation.id, config);
      else O.automations.create(p, config);
      studio.markDirty(); studio.saveProject(true); studio.closeDialog(); refresh();
      studio.toast(automation ? "Automation saved." : "Automation created as a draft. Activate it when you're ready for it to repeat.");
    });
  }

  function confirmActivate(id) {
    const p = project();
    const automation = O.automations.get(p, id);
    if (!automation) return;
    const effects = O.consequences(p, automation);
    const spec = O.trigger(automation.triggerType);
    const unattended = automation.triggerType === "cloud-schedule";
    studio.dialog(`<div class="run-detail">
      <span class="eyebrow">Activate</span>
      <h2 style="margin:8px 0 6px">${esc(automation.name)}</h2>
      <p class="sn-body">${esc(spec?.description || "")}</p>
      ${effects.length ? `<div class="sn-callout sn-callout-warning" style="margin-top:14px"><span aria-hidden="true">⚠</span><span>Every time this runs it will <strong>${esc(effects.join(", "))}</strong>.</span></div>` : ""}
      ${unattended ? '<div class="sn-callout sn-callout-preview" style="margin-top:12px"><span aria-hidden="true">◷</span><span>Unattended scheduling needs a server Signal Noir does not have yet. The configuration is saved and nothing will run or claim to have run.</span></div>' : ""}
      <div class="sn-cluster" style="justify-content:flex-end;margin-top:20px"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-automation-confirm="${esc(automation.id)}">Activate</button></div>
    </div>`);
  }


  function openMonitor(id) {
    const p = project();
    const monitor = id ? O.monitors.get(p, id) : null;
    const dataset = p.datasets.find(item => item.id === (monitor?.datasetId || p.activeDatasetId)) || p.datasets[0];
    const columns = dataset?.columns || [];
    studio.dialog(`<form id="monitor-form" class="run-detail">
      <span class="eyebrow">${monitor ? "Edit monitor" : "New monitor"}</span>
      <h2 style="margin:8px 0 14px">${esc(monitor?.name || "What should Signal Noir watch?")}</h2>
      <div class="form-grid">
        <label class="sn-label" for="mon-name">Name</label>
        <input class="sn-input" id="mon-name" name="name" value="${esc(monitor?.name || "")}" required maxlength="120" placeholder="Cancellation rate">
        <label class="sn-label" for="mon-kind">Watch</label>
        <select class="sn-select" id="mon-kind" name="kind">${O.MONITOR_KINDS.map(item => `<option value="${esc(item.id)}" ${item.id === (monitor?.kind || "metric-threshold") ? "selected" : ""}>${esc(item.label)} — ${esc(item.description)}</option>`).join("")}</select>
        <label class="sn-label" for="mon-dataset">In</label>
        <select class="sn-select" id="mon-dataset" name="datasetId">${p.datasets.map(item => `<option value="${esc(item.id)}" ${item.id === monitor?.datasetId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>
        <div id="mon-measure-block">
          <label class="sn-label" for="mon-measure">Measure</label>
          <div class="sn-cluster">
            <select class="sn-select sn-select-sm" id="mon-aggregate" name="aggregate">${["sum", "avg", "count", "min", "max"].map(item => `<option value="${item}" ${item === (monitor?.aggregate || "sum") ? "selected" : ""}>${item}</option>`).join("")}</select>
            <select class="sn-select sn-select-sm" id="mon-measure" name="measure">${columns.map(column => `<option value="${esc(column)}" ${column === monitor?.measure ? "selected" : ""}>${esc(column)}</option>`).join("")}</select>
          </div>
        </div>
        <label class="sn-label" for="mon-op">Alert when it</label>
        <div class="sn-cluster">
          <select class="sn-select sn-select-sm" id="mon-op" name="op">${O.OPERATORS.map(item => `<option value="${esc(item.id)}" ${item.id === (monitor?.op || "gt") ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select>
          <input class="sn-input sn-select-sm" style="max-width:130px" id="mon-threshold" name="threshold" type="number" step="any" value="${esc(monitor?.threshold ?? "")}" aria-label="Threshold">
        </div>
        <label class="sn-label" for="mon-severity">Severity</label>
        <select class="sn-select" id="mon-severity" name="severity">${O.SEVERITIES.map(item => `<option value="${esc(item.id)}" ${item.id === (monitor?.severity || "warning") ? "selected" : ""}>${esc(item.label)} — ${esc(item.description)}</option>`).join("")}</select>
      </div>
      <div id="mon-preview" class="sn-callout sn-callout-info" style="margin-top:14px"><span aria-hidden="true">◎</span><span id="mon-preview-text"></span></div>
      <div class="sn-split" style="margin-top:18px;gap:10px">
        <span>${monitor ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-monitor-delete="${esc(monitor.id)}">Delete</button>` : ""}</span>
        <span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">${monitor ? "Save" : "Create monitor"}</button></span>
      </div>
    </form>`);

    const form = $("#monitor-form");
    const sync = () => {
      const kind = form.kind.value;
      $("#mon-measure-block").hidden = kind !== "metric-threshold";
      const draft = { name: form.name.value || "This monitor", kind, measure: form.measure?.value, aggregate: form.aggregate?.value, op: form.op.value, threshold: form.threshold.value };
      $("#mon-preview-text").textContent = `Signal Noir will check ${O.describeCondition(draft)} and raise a ${form.severity.value} alert when it is met.`;
    };
    form.addEventListener("change", sync);
    form.addEventListener("input", sync);
    sync();

    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (monitor) O.monitors.update(p, monitor.id, data);
      else O.monitors.create(p, data);
      studio.markDirty(); studio.saveProject(true); studio.closeDialog(); refresh();
      studio.toast(monitor ? "Monitor saved." : "Monitor created. Use Check to evaluate it now.");
    });
  }


  function runAutomation(id) {
    const p = project();
    const automation = O.automations.get(p, id);
    if (!automation?.workflowId) return studio.toast("This automation has no workflow to run.");
    const run = O.runs.execute(p, { workflowId: automation.workflowId, workflowVersion: automation.workflowVersion, automationId: automation.id, triggerType: "manual", triggeredBy: A?.actorName() });
    studio.markDirty(); studio.saveProject(true); refresh();
    studio.toast(`${automation.name}: ${O.runStatus(run.status).label.toLowerCase()}.`);
    openRun(run.id);
  }

  function useTemplate(templateId) {
    const p = project();
    const seed = O.template(templateId);
    const result = O.applyTemplate(p, templateId, { createAutomation: true, datasetId: p.activeDatasetId });
    if (!result) return;
    studio.markDirty(); studio.saveProject(true);
    tab = "automations";
    refresh();
    studio.toast(`${seed.name} created as a draft workflow and automation. Check the steps, then activate.`);
    openAutomation(result.automation.id);
  }

  function refresh() {
    if (!$("#ops-tabs")) return;
    renderHeader();
    $("#ops-panel").innerHTML = tab === "inbox" ? renderInbox()
      : tab === "automations" ? renderAutomations()
      : tab === "monitors" ? renderMonitors()
      : tab === "runs" ? renderRuns()
      : renderTemplates();
  }


  document.addEventListener("click", event => {
    const target = event.target;
    const pick = selector => target.closest(selector);
    const p = project();
    const save = () => { studio.markDirty(); studio.saveProject(true); refresh(); };

    const t = pick("[data-opshub-tab]");
    if (t) { tab = t.dataset.opshubTab; refresh(); return; }
    if (pick("[data-goto-templates]")) { studio.closeDialog(); tab = "templates"; studio.showView("operations-hub"); refresh(); return; }

    const useT = pick("[data-template-use]");
    if (useT) return useTemplate(useT.dataset.templateUse);

    if (pick("[data-automation-new]")) return openAutomation(null);
    const openAuto = pick("[data-automation-open]");
    if (openAuto) return openAutomation(openAuto.dataset.automationOpen);
    const runAuto = pick("[data-automation-run]");
    if (runAuto) return runAutomation(runAuto.dataset.automationRun);
    const pauseAuto = pick("[data-automation-pause]");
    if (pauseAuto) { O.automations.pause(p, pauseAuto.dataset.automationPause); studio.closeDialog(); save(); studio.toast("Paused. Its configuration is kept."); return; }
    const delAuto = pick("[data-automation-delete]");
    if (delAuto) { if (!confirm("Delete this automation? Its run history is kept.")) return; O.automations.remove(p, delAuto.dataset.automationDelete); studio.closeDialog(); save(); return; }
    const confirmAuto = pick("[data-automation-confirm]");
    if (confirmAuto) {
      const result = O.automations.activate(p, confirmAuto.dataset.automationConfirm);
      studio.closeDialog();
      if (!result.ok) return studio.toast(result.reason);
      save(); studio.toast("Activated.");
      return;
    }

    if (pick("[data-monitor-new]")) return openMonitor(null);
    const openMon = pick("[data-monitor-open]");
    if (openMon) return openMonitor(openMon.dataset.monitorOpen);
    const delMon = pick("[data-monitor-delete]");
    if (delMon) { if (!confirm("Delete this monitor? Alerts it already raised are kept.")) return; O.monitors.remove(p, delMon.dataset.monitorDelete); studio.closeDialog(); save(); return; }
    const checkMon = pick("[data-monitor-check]");
    if (checkMon) {
      const result = O.monitors.check(p, checkMon.dataset.monitorCheck);
      save();
      studio.toast(result ? (result.result.met ? `Condition met: ${result.result.reason}` : `Within range: ${result.result.reason}`) : "That monitor is paused.");
      return;
    }
    if (pick("[data-monitors-check]")) {
      const results = O.monitors.checkAll(p);
      save();
      const met = results.filter(item => item.result.met).length;
      studio.toast(met ? `${met} of ${results.length} monitors met their condition.` : `All ${results.length} monitors are within range.`);
      return;
    }

    const openR = pick("[data-run-open]");
    if (openR) return openRun(openR.dataset.runOpen);
    const retryR = pick("[data-run-retry]") || pick("[data-run-missed]");
    if (retryR) {
      const id = retryR.dataset.runRetry || retryR.dataset.runMissed;
      const run = O.runs.retry(p, id);
      studio.closeDialog(); save();
      if (run) { studio.toast(`Re-run: ${O.runStatus(run.status).label.toLowerCase()}.`); openRun(run.id); }
      return;
    }
    const skipR = pick("[data-skip-missed]");
    if (skipR) {
      const run = O.runs.get(p, skipR.dataset.skipMissed);
      if (run) { run.status = "cancelled"; run.summary = `${run.summary} Skipped by ${A?.actorName() || "you"}.`; }
      save(); studio.toast("Skipped. The next scheduled run is unaffected.");
      return;
    }
    const approveR = pick("[data-run-approve]"), declineR = pick("[data-run-decline]");
    if (approveR || declineR) {
      O.runs.approve(p, (approveR || declineR).dataset.runApprove || (approveR || declineR).dataset.runDecline, { approved: Boolean(approveR) });
      studio.closeDialog(); save();
      studio.toast(approveR ? "Approved." : "Declined. Nothing after the approval step ran.");
      return;
    }
    const askR = pick("[data-run-ask]");
    if (askR) {
      const run = O.runs.get(p, askR.dataset.runAsk);
      studio.closeDialog(); studio.showView("vanessa");
      window.SignalNoirStudio?.run(run?.status === "failed" ? `Why did the ${run.workflowName} workflow fail?` : `Summarize the last ${run?.workflowName || "workflow"} run`);
      return;
    }

    const openA = pick("[data-alert-open]");
    if (openA) return openAlert(openA.dataset.alertOpen);
    const ack = pick("[data-alert-ack]");
    if (ack) { O.alerts.setStatus(p, ack.dataset.alertAck, "acknowledged"); studio.closeDialog(); save(); return; }
    const resolve = pick("[data-alert-resolve]");
    if (resolve) {
      O.alerts.setStatus(p, resolve.dataset.alertResolve, "resolved", { resolution: $("#alert-resolution")?.value || "" });
      studio.closeDialog(); save(); studio.toast("Resolved.");
      return;
    }
    const ignore = pick("[data-alert-ignore]");
    if (ignore) { O.alerts.setStatus(p, ignore.dataset.alertIgnore, "ignored", { resolution: $("#alert-resolution")?.value || "" }); studio.closeDialog(); save(); return; }
    const alertTask = pick("[data-alert-task]");
    if (alertTask) {
      const alert = O.alerts.get(p, alertTask.dataset.alertTask);
      const task = A.create(p, "task", { title: `Investigate: ${alert.title}`, description: alert.description, sources: alert.datasetId ? [{ type: "dataset", id: alert.datasetId, rel: "based-on" }] : [] });
      studio.closeDialog(); save();
      studio.toast(`Task created: ${task.title}`);
      return;
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "alert-assignee") {
      const id = document.querySelector("[data-alert-ack], [data-alert-resolve]")?.dataset.alertAck || document.querySelector("[data-alert-resolve]")?.dataset.alertResolve;
      if (id) { O.alerts.assign(project(), id, event.target.value); studio.markDirty(); studio.saveProject(true); }
    }
  });

  window.addEventListener("datahub:project-render", refresh);
  window.addEventListener("vanessa:run-complete", refresh);

  window.SignalNoirOps = { refresh, openRun, openAlert, openAutomation, openMonitor, setTab(next) { tab = next; refresh(); } };
})();
