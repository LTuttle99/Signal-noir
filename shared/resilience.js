


(function (root) {
  "use strict";

  const SN = root.SignalNoir = root.SignalNoir || {};
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  let shown = false;
  let lastToast = 0;


  const PATTERNS = [
    { test: error => error?.name === "QuotaExceededError" || /quota|exceeded the storage/i.test(message(error)),
      code: "storage-quota", title: "This browser is out of storage",
      message: "There is no room left to save. Export the project you are working on, then remove data you no longer need.",
      recovery: [{ label: "Open storage settings", href: "settings.html#privacy" }] },
    { test: error => /IndexedDB unavailable|database connection is closing|InvalidStateError/i.test(message(error)) || error?.name === "InvalidStateError",
      code: "storage-unavailable", title: "Local storage is blocked",
      message: "This browser is not allowing Signal Noir to store anything. Private windows usually block it. Your work stays in this tab only, so export anything you need.",
      recovery: [] },
    { test: error => /NetworkError|Failed to fetch|NetworkError when attempting/i.test(message(error)),
      code: "network", title: "Something could not be reached",
      message: "A network request failed. Signal Noir analyses data on this device, so your local work is unaffected.",
      recovery: [] },
    { test: error => /aborted|AbortError/i.test(message(error)) || error?.name === "AbortError",
      code: "cancelled", title: "That was cancelled",
      message: "The operation stopped before it finished. Nothing was changed.",
      recovery: [] }
  ];

  function message(error) { return error?.message || String(error || ""); }

  function describe(error) {
    const match = PATTERNS.find(pattern => { try { return pattern.test(error); } catch (failure) { return false; } });
    if (match) return { code: match.code, title: match.title, message: match.message, recovery: match.recovery, detail: message(error) };
    return {
      code: "unexpected",
      title: "Something went wrong",
      message: "Signal Noir hit a problem it did not expect. Your saved projects have not been changed.",
      recovery: [],
      detail: message(error)
    };
  }


  const debug = () => { try { return SN.debug || localStorage.getItem("sn_debug") === "1"; } catch (error) { return false; } };


  function log(operation, meta = {}) {
    if (!debug()) return;
    const safe = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value == null) continue;
      if (typeof value === "object") { safe[key] = Array.isArray(value) ? `${value.length} items` : "[object]"; continue; }
      safe[key] = typeof value === "string" && value.length > 120 ? `${value.slice(0, 117)}…` : value;
    }
    console.debug("[signal-noir]", operation, safe);
  }


  function details(error) {
    return [
      `Signal Noir error report`,
      `When: ${new Date().toISOString()}`,
      `Page: ${location.pathname}`,
      `Agent: ${navigator.userAgent}`,
      `Message: ${message(error)}`,
      error?.stack ? `Stack:\n${error.stack}` : ""
    ].filter(Boolean).join("\n");
  }

  function showRecovery(error) {
    if (shown) return;
    shown = true;
    const info = describe(error);


    const home = SN.platform?.url
      ? SN.platform.url("index.html")
      : (location.pathname.includes("/tools/") ? "../../index.html" : "index.html");
    const panel = document.createElement("div");
    panel.className = "sn-recovery sn-scope";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "sn-recovery-title");
    panel.innerHTML = `<div class="sn-recovery-card">
      <span class="sn-eyebrow"><i></i>Recovery</span>
      <h1 id="sn-recovery-title">${esc(info.title)}</h1>
      <p>${esc(info.message)}</p>
      <p class="sn-recovery-safe"><strong>Your locally saved projects have not been deleted.</strong> They are stored in this browser and are still there when you reload.</p>
      <div class="sn-recovery-actions">
        <button type="button" class="sn-btn sn-btn-primary" data-recovery-reload>Reload Signal Noir</button>
        <a class="sn-btn" href="${esc(home)}">Go to the home page</a>
        <button type="button" class="sn-btn sn-btn-ghost" data-recovery-copy>Copy error details</button>
      </div>
      <details class="sn-recovery-details"><summary>Technical details</summary><pre>${esc(details(error))}</pre></details>
    </div>`;
    document.body.appendChild(panel);
    panel.querySelector("[data-recovery-reload]").addEventListener("click", () => location.reload());
    panel.querySelector("[data-recovery-copy]").addEventListener("click", async event => {
      try { await navigator.clipboard.writeText(details(error)); event.target.textContent = "Copied"; }
      catch (failure) { panel.querySelector(".sn-recovery-details").open = true; event.target.textContent = "Select the text below"; }
    });
    panel.querySelector("button")?.focus();
  }


  function quietly(info) {
    const now = Date.now();
    if (now - lastToast < 4000) return;
    lastToast = now;
    if (SN.platform?.toast) SN.platform.toast(info.message, { timeout: 7000 });
  }

  function looksFatal() {
    const main = document.querySelector("main, .studio-main, #main");
    return !main || main.childElementCount === 0;
  }

  addEventListener("error", event => {
    if (event.target !== window && event.target?.tagName) return;
    log("uncaught-error", { message: message(event.error) });
    if (looksFatal()) showRecovery(event.error || new Error(event.message));
    else quietly(describe(event.error || new Error(event.message)));
  });

  addEventListener("unhandledrejection", event => {
    const info = describe(event.reason);
    log("unhandled-rejection", { code: info.code, message: info.detail });


    if (info.code === "storage-quota" || info.code === "storage-unavailable") quietly(info);
    else if (looksFatal()) showRecovery(event.reason);
    event.preventDefault();
  });

  SN.errors = { describe, log, showRecovery, details };
})(typeof window !== "undefined" ? window : globalThis);
