


(function (root) {
  "use strict";

  const SN = root.SignalNoir = root.SignalNoir || {};
  const access = () => SN.access;
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

  const RISK = { low: "", medium: '<span class="sn-badge sn-badge-muted">Changes data</span>', high: '<span class="sn-badge sn-badge-warning">Sensitive</span>' };


  function restrictedHtml(capabilityId, { title = "", backHref = "", backLabel = "Back to Studio", compact = false } = {}) {
    const a = access();
    const cap = a.capability(capabilityId);
    const info = a.summary();
    const where = info.personal ? "" : `<dl class="access-denied-facts">
        <dt>Workspace</dt><dd>${esc(info.workspaceName)}</dd>
        ${info.profileName ? `<dt>Access profile</dt><dd>${esc(info.profileName)}</dd>` : ""}
        ${info.teams.length ? `<dt>Team</dt><dd>${esc(info.teams.map(team => team.name).join(", "))}</dd>` : ""}
        <dt>Required capability</dt><dd>${esc(cap?.name || capabilityId)}</dd>
      </dl>`;
    const actions = `<div class="sn-cluster" style="margin-top:20px">
      ${backHref ? `<a class="sn-btn sn-btn-sm sn-btn-primary" href="${esc(backHref)}">${esc(backLabel)}</a>` : ""}
      ${info.preview ? '<button type="button" class="sn-btn sn-btn-sm" data-access-exit-preview>Exit preview</button>' : ""}
    </div>`;
    return `<div class="access-denied${compact ? " is-compact" : ""}" role="status">
      <span class="sn-eyebrow"><i></i>Not part of your access</span>
      <h2 class="sn-h3">${esc(title || cap?.name || "This capability")}</h2>
      <p class="sn-body">${info.personal
        ? "This capability is switched off in this workspace."
        : info.preview
          ? `You’re previewing Signal Noir as <strong>${esc(info.preview.name)}</strong>, and that profile doesn’t include this.`
          : "Your current access profile does not include this capability. Ask an organization administrator if you need it."}</p>
      ${cap ? `<p class="sn-muted sn-small">${esc(cap.description)}</p>` : ""}
      ${where}${actions}
    </div>`;
  }


  function denyPage(capabilityId, { title = "", backHref = "", backLabel = "Back to Signal Noir" } = {}) {
    const main = document.querySelector("main") || document.body;
    main.innerHTML = `<div class="sn-container" style="padding-block:56px">${restrictedHtml(capabilityId, { title, backHref, backLabel })}</div>`;
    document.querySelectorAll("[data-workspace-banner], .sn-tool-actions, .sn-tool-crumb").forEach(node => node.remove());
    bindExit(main);
  }

  function bindExit(scope = document) {
    scope.querySelectorAll("[data-access-exit-preview]").forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = "1";
      button.addEventListener("click", () => { access().exitPreview(); location.reload(); });
    });
  }


  function renderPreviewBanner() {
    document.querySelector(".access-preview-bar")?.remove();
    const active = access().previewState();
    if (!active) { document.body.classList.remove("access-previewing"); return; }
    document.body.classList.add("access-previewing");
    const bar = document.createElement("div");
    bar.className = "access-preview-bar sn-scope";
    bar.setAttribute("role", "status");
    bar.innerHTML = `<span><strong>Preview mode.</strong> You’re seeing Signal Noir as the <strong>${esc(active.name)}</strong> access profile. Your own access hasn’t changed.</span><button type="button" class="sn-btn sn-btn-sm" data-access-exit-preview>Exit preview</button>`;
    document.body.prepend(bar);
    bindExit(bar);


    const measure = () => document.documentElement.style.setProperty("--sn-preview-height", `${bar.offsetHeight}px`);
    measure();
    addEventListener("resize", measure);
  }


  function workspaceButtonHtml() {
    const info = access().summary();
    return `<button type="button" class="sn-workspace-pill" data-access-switcher aria-haspopup="dialog">
      <span class="sn-dot${info.personal ? " sn-dot-muted" : " sn-dot-accent"}" aria-hidden="true"></span>
      <span class="sn-workspace-name">${esc(info.personal ? "Personal" : info.workspaceName)}</span>
      <span class="sn-sr-only">workspace. Switch workspace</span>
    </button>`;
  }

  function openSwitcher() {
    const a = access();
    const info = a.summary();
    const orgs = a.organizations();
    const rows = [
      { id: a.PERSONAL, name: "Personal workspace", detail: "Everything local, every capability, no organization.", demo: false },
      ...orgs.map(org => ({ id: org.id, name: org.name, detail: `${org.members.length} member${org.members.length === 1 ? "" : "s"} · ${org.teams.length} team${org.teams.length === 1 ? "" : "s"}`, demo: org.isDemo }))
    ];
    const org = a.organization();
    const shell = document.createElement("div");
    shell.className = "sn-modal-shell sn-scope";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "Switch workspace");
    shell.innerHTML = `<div class="sn-modal" style="max-width:520px;padding:24px">
      <span class="sn-eyebrow"><i></i>Workspace</span>
      <h2 class="sn-h3" style="margin:10px 0 4px">Where are you working?</h2>
      <p class="sn-muted sn-small">Signal Noir always runs in this browser. An organization workspace shapes the interface around a role; it does not move any data.</p>
      <div class="sn-stack" style="--sn-stack-gap:8px;margin-top:18px">${rows.map(row => `<button type="button" class="list-row" data-workspace="${esc(row.id)}"><span class="sn-card-icon" aria-hidden="true">${row.id === a.PERSONAL ? "◉" : "◎"}</span><span style="min-width:0"><strong>${esc(row.name)}</strong><small>${esc(row.detail)}</small></span><span class="sn-cluster">${row.demo ? '<span class="sn-badge sn-badge-preview">Sample</span>' : ""}${row.id === info.workspaceId ? '<span class="sn-badge sn-badge-success"><i></i>Current</span>' : ""}</span></button>`).join("")}</div>
      ${org ? `<div style="margin-top:18px"><label class="sn-label" for="sn-access-member">Signed in as</label><select class="sn-select" id="sn-access-member">${org.members.map(person => `<option value="${esc(person.id)}" ${person.id === info.member?.id ? "selected" : ""}>${esc(person.name)}${person.title ? ` — ${esc(person.title)}` : ""}</option>`).join("")}</select><p class="sn-field-hint">There is no sign-in. Choosing a person shows Signal Noir the way their access profile shapes it.</p></div>` : ""}
      <div class="sn-cluster" style="justify-content:space-between;margin-top:22px">
        <a class="sn-btn sn-btn-sm sn-btn-ghost" href="${esc(SN.platform ? SN.platform.url("organization.html") : "organization.html")}">Manage organizations</a>
        <button type="button" class="sn-btn sn-btn-sm" data-close>Close</button>
      </div>
    </div>`;
    document.body.appendChild(shell);
    const close = () => shell.remove();
    shell.addEventListener("click", event => { if (event.target === shell || event.target.closest("[data-close]")) close(); });
    shell.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    shell.querySelectorAll("[data-workspace]").forEach(button => button.addEventListener("click", () => {
      a.setWorkspace(button.dataset.workspace);
      location.reload();
    }));
    shell.querySelector("#sn-access-member")?.addEventListener("change", event => { a.setMember(event.target.value); location.reload(); });
    shell.querySelector("button, select")?.focus();
  }


  function capabilityEditorHtml(selected, { name = "capabilities", disabled = false } = {}) {
    const a = access();
    const chosen = new Set(selected || []);
    return a.CATEGORIES.map(category => {
      const caps = a.capabilitiesIn(category.id);
      if (!caps.length) return "";
      const on = caps.filter(cap => chosen.has(cap.id)).length;
      return `<details class="cap-group"${on ? " open" : ""}>
        <summary><span><strong>${esc(category.label)}</strong><small>${esc(category.description)}</small></span><span class="sn-badge${on ? " sn-badge-accent" : " sn-badge-muted"}">${on} of ${caps.length}</span></summary>
        <div class="cap-list">${caps.map(cap => `<label class="cap-row">
          <input type="checkbox" name="${esc(name)}" value="${esc(cap.id)}" ${chosen.has(cap.id) ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <span><strong>${esc(cap.name)}</strong><small>${esc(cap.description)}</small></span>
          <span class="cap-meta">${RISK[cap.risk] || ""}${cap.implemented ? "" : '<span class="sn-badge sn-badge-preview">Not built yet</span>'}</span>
        </label>`).join("")}</div>
      </details>`;
    }).join("");
  }

  function readCapabilityEditor(scope, name = "capabilities") {
    return Array.from(scope.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value);
  }

  const api = { restrictedHtml, denyPage, renderPreviewBanner, workspaceButtonHtml, openSwitcher, capabilityEditorHtml, readCapabilityEditor, bindExit, esc };
  SN.accessUi = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
