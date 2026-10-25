


(function (root) {
  "use strict";

  const STATUS_TEXT = { pending: "Waiting", running: "Running…", complete: "Done", warning: "Review", failed: "Failed", skipped: "Skipped" };
  const STATUSES = Object.keys(STATUS_TEXT);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  function normalizeStep(step) {
    return {
      id: String(step.id),
      label: step.label || step.id,
      status: STATUSES.includes(step.status) ? step.status : "pending",
      detail: step.detail || "",
      items: Array.isArray(step.items) ? step.items.map(item => typeof item === "string" ? { text: item } : item) : [],
      actions: Array.isArray(step.actions) ? step.actions : []
    };
  }

  function stepHtml(step, index) {
    const items = step.items.length ? `<ul class="sn-workflow-items">${step.items.map(item => `<li data-tone="${esc(item.tone || "ok")}">${esc(item.text)}</li>`).join("")}</ul>` : "";
    const detail = step.detail && !step.items.length ? `<p class="sn-muted sn-xs" style="margin-top:4px">${esc(step.detail)}</p>` : "";
    const actions = step.actions.length ? `<div class="sn-workflow-actions">${step.actions.map((action, actionIndex) => action.href
      ? `<a class="sn-btn sn-btn-sm ${action.primary ? "sn-btn-primary" : ""}" href="${esc(action.href)}">${esc(action.label)}</a>`
      : `<button type="button" class="sn-btn sn-btn-sm ${action.primary ? "sn-btn-primary" : ""}" data-workflow-action="${index}:${actionIndex}">${esc(action.label)}</button>`).join("")}</div>` : "";
    return `<li class="sn-workflow-step" data-step="${esc(step.id)}" data-status="${step.status}" aria-label="${esc(step.label)}: ${STATUS_TEXT[step.status]}">
      <span class="sn-status" data-status="${step.status}" aria-hidden="true"></span>
      <div><div class="sn-workflow-head"><span class="sn-workflow-label">${esc(step.label)}</span><span class="sn-workflow-state">${STATUS_TEXT[step.status]}</span></div>${detail}${items}${actions}</div>
    </li>`;
  }

  function html(steps, { compact = false } = {}) {
    return `<ol class="sn-workflow ${compact ? "is-compact" : ""}" role="list" style="margin:0;padding:0;list-style:none">${steps.map(normalizeStep).map(stepHtml).join("")}</ol>`;
  }

  function create(container, { steps = [], compact = false, onChange = null } = {}) {
    const state = { steps: steps.map(normalizeStep), compact };
    container.setAttribute("aria-live", "polite");

    function render() {
      container.innerHTML = html(state.steps, { compact: state.compact });
      container.setAttribute("aria-busy", String(state.steps.some(step => step.status === "running")));
      container.querySelectorAll("[data-workflow-action]").forEach(button => button.addEventListener("click", () => {
        const [stepIndex, actionIndex] = button.dataset.workflowAction.split(":").map(Number);
        state.steps[stepIndex]?.actions[actionIndex]?.onClick?.();
      }));
      onChange?.(snapshot());
    }

    function find(id) { return state.steps.find(step => step.id === id); }

    function update(id, patch) {
      const step = find(id);
      if (!step) return;
      if (patch.status && !STATUSES.includes(patch.status)) throw new Error(`Unknown workflow status: ${patch.status}`);
      Object.assign(step, patch, patch.items ? { items: patch.items.map(item => typeof item === "string" ? { text: item } : item) } : {});
      render();
    }

    function addItem(id, item) {
      const step = find(id);
      if (!step) return;
      step.items.push(typeof item === "string" ? { text: item } : item);
      render();
    }

    function snapshot() {
      return state.steps.map(step => ({ id: step.id, label: step.label, status: step.status, detail: step.detail, items: step.items.map(item => ({ text: item.text, tone: item.tone })) }));
    }

    function summary() {
      const counts = {};
      state.steps.forEach(step => { counts[step.status] = (counts[step.status] || 0) + 1; });
      return counts;
    }

    render();
    return { el: container, update, addItem, snapshot, summary, set(steps) { state.steps = steps.map(normalizeStep); render(); }, setCompact(value) { state.compact = value; render(); } };
  }

  const api = { create, html, STATUS_TEXT, STATUSES };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.SignalNoir = root.SignalNoir || {}; root.SignalNoir.Workflow = api; }
})(typeof window !== "undefined" ? window : null);
