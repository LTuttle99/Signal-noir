
(function () {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  function modal({ title, eyebrow = "", body = "", wide = false }) {
    const previous = document.activeElement;
    const shell = document.createElement("div");
    shell.className = "sn-modal-shell sn-scope";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-labelledby", "sn-modal-title");
    shell.innerHTML = `<div class="sn-modal" style="${wide ? "width:min(760px,100%)" : ""}"><div class="sn-drawer-head"><div>${eyebrow ? `<span class="sn-eyebrow"><i></i>${esc(eyebrow)}</span>` : ""}<h2 id="sn-modal-title" class="sn-h3" style="margin-top:${eyebrow ? 8 : 0}px">${esc(title)}</h2></div><button type="button" class="sn-btn sn-btn-ghost sn-btn-icon" data-close aria-label="Close">✕</button></div><div class="sn-drawer-body">${body}</div></div>`;
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      document.removeEventListener("keydown", onKey, true);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
      if (!reduced && shell.animate) await shell.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-out" }).finished.catch(() => {});
      shell.remove();
      previous?.focus?.();
    };
    function onKey(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const focusable = Array.from(shell.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(node => !node.disabled);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    shell.addEventListener("click", event => { if (event.target === shell || event.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(shell);
    shell.querySelector("[data-close]").focus();
    return { el: shell, close };
  }

  const ONBOARD_KEY = "sn_onboarded_v2";
  function onboarding({ onDemo, anchor } = {}) {
    try { if (localStorage.getItem(ONBOARD_KEY)) return; } catch (error) { return; }
    const card = document.createElement("aside");
    card.className = "onboard sn-scope";
    card.setAttribute("aria-label", "Welcome to Signal Noir");
    card.innerHTML = `<div class="onboard-head"><span class="sn-eyebrow"><i></i>New here? Signal Noir in three ideas</span><div class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-demo>Try the demo</button><button type="button" class="sn-btn sn-btn-ghost sn-btn-sm sn-btn-icon" data-dismiss aria-label="Dismiss introduction">✕</button></div></div>
      <ol><li><span><strong>Add data</strong><span>Drop spreadsheets or exports. They stay in this browser.</span></span></li>
      <li><span><strong>Ask Vanessa</strong><span>Describe the outcome you need. She plans and runs the analysis.</span></span></li>
      <li><span><strong>Inspect the evidence</strong><span>Every finding shows its rows, filters and calculation.</span></span></li></ol>`;
    const dismiss = () => { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (error) {                } card.remove(); };
    card.querySelector("[data-dismiss]").addEventListener("click", dismiss);
    card.querySelector("[data-demo]").addEventListener("click", () => { dismiss(); onDemo?.(); });
    (anchor || document.body).insertAdjacentElement(anchor ? "afterend" : "beforeend", card);
  }

  function relativeTime(value) {
    const time = typeof value === "number" ? value : Date.parse(value);
    if (!Number.isFinite(time)) return "";
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} d ago`;
    return new Date(time).toLocaleDateString();
  }

  window.SignalNoir = window.SignalNoir || {};
  window.SignalNoir.site = { modal, onboarding, relativeTime, esc };
})();
