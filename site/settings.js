
(function () {
  "use strict";

  const { projects: store, site } = window.SignalNoir;
  const esc = site.esc;
  const platform = () => window.SignalNoir.platform;
  const $ = selector => document.querySelector(selector);
  const get = (key, fallback = null) => { try { return localStorage.getItem(key) ?? fallback; } catch (error) { return fallback; } };
  const set = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (error) { platform().toast("This browser is blocking local storage."); } };
  const human = bytes => platform()?.humanSize(bytes) || `${bytes} B`;

  function segmented(container, attr, current, onChange) {
    const buttons = Array.from(container.querySelectorAll(`[data-${attr}-value]`));
    const sync = value => buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset[`${attr}Value`] === value)));
    sync(current);
    container.addEventListener("click", event => { const button = event.target.closest("button"); if (!button) return; const value = button.dataset[`${attr}Value`]; onChange(value); sync(value); });
  }

  segmented($("#theme-choice"), "theme", document.documentElement.dataset.theme || "dark", value => { if (document.documentElement.dataset.theme !== value) platform().toggleTheme(); });
  document.addEventListener("sn:theme", event => $("#theme-choice").querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeValue === event.detail))));
  segmented($("#motion-choice"), "motion", get("sn_motion") === "reduced" ? "reduced" : "full", value => { set("sn_motion", value === "reduced" ? "reduced" : null); if (value === "reduced") document.documentElement.dataset.motion = "reduced"; else delete document.documentElement.dataset.motion; });
  segmented($("#definitions-choice"), "definitions", get("hub_show_definitions") === "off" ? "off" : "on", value => set("hub_show_definitions", value === "off" ? "off" : null));
  segmented($("#mode-choice"), "mode", get("datahub_workspace_mode", "guided"), value => { set("datahub_workspace_mode", value); platform().toast("Studio will use this the next time it opens."); });
  segmented($("#debug-choice"), "debug", get("sn_debug") === "1" ? "on" : "off", value => set("sn_debug", value === "on" ? "1" : null));


  async function renderProviders() {
    const allowed = window.SignalNoir.access.can("vanessa.model");
    document.getElementById("provider-restricted").hidden = allowed;
    if (!allowed) { $("#provider-list").innerHTML = ""; return; }
    const providers = await window.SignalNoir.providers.detectAll();
    const current = window.SignalNoir.providers.preferred();
    const badge = provider => provider.status === "available" ? '<span class="sn-badge sn-badge-success">Available</span>'
      : provider.status === "planned" ? '<span class="sn-badge sn-badge-preview">Planned</span>'
      : provider.status === "requires-user" ? '<span class="sn-badge sn-badge-warning">Needs setup</span>'
      : '<span class="sn-badge sn-badge-muted">Not detected</span>';
    $("#provider-list").innerHTML = providers.map(provider => `<label class="sn-panel" style="display:flex;gap:12px;align-items:flex-start;padding:14px;cursor:${provider.status === "available" ? "pointer" : "not-allowed"}">
      <input type="radio" name="sn-provider" value="${esc(provider.id)}" ${provider.id === current.id ? "checked" : ""} ${provider.status === "available" ? "" : "disabled"} style="margin-top:3px;accent-color:var(--sn-accent)">
      <span><strong>${esc(provider.label)}</strong> ${badge(provider)} <span class="sn-badge">${provider.locality === "remote" ? "Would leave this device" : "Runs on this device"}</span><br><small class="sn-muted">${esc(provider.description)}${provider.model ? ` Model: ${esc(provider.model)}.` : ""}</small></span></label>`).join("");
    $("#provider-list").querySelectorAll("input").forEach(radio => radio.addEventListener("change", () => {
      window.SignalNoir.providers.choose(radio.value);
      platform().toast(`Vanessa will use ${window.SignalNoir.providers.preferred().label}.`);
    }));
  }
  renderProviders();

  function memorySummary() {
    let count = 0;
    try { const memory = JSON.parse(get("vanessa_memory", "{}")); count = Object.values(memory || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0); } catch (error) { count = 0; }
    $("#memory-summary").textContent = count ? `Vanessa remembers ${count} note${count === 1 ? "" : "s"} from tool pages. They stay in this browser.` : "Vanessa isn’t remembering anything right now.";
  }
  $("#clear-memory").addEventListener("click", () => { if (!confirm("Forget everything Vanessa remembers on tool pages?")) return; set("vanessa_memory", null); memorySummary(); platform().toast("Vanessa’s memory cleared."); });
  memorySummary();

  $("#reset-onboarding").addEventListener("click", () => { set("sn_onboarded_v2", null); set("datahub_onboarding_seen", null); platform().toast("The welcome guide will show on the home page."); });

  async function storage() {
    const list = await store.list();
    const real = list.filter(project => !project.isDemo);
    const rows = real.reduce((sum, project) => sum + (project.datasets || []).reduce((total, dataset) => total + (dataset.rows || []).length, 0), 0);
    let used = null, quota = null;
    try { const estimate = await navigator.storage?.estimate?.(); used = estimate?.usage ?? null; quota = estimate?.quota ?? null; } catch (error) {                     }
    $("#storage-kpis").innerHTML = [["Projects", real.length], ["Rows stored", rows.toLocaleString()], ["Browser storage used", used != null ? human(used) : "Unknown"], ["Available", quota != null ? human(quota) : "Unknown"]].map(([label, value]) => `<div class="sn-panel sn-stat"><span class="sn-stat-label">${label}</span><span class="sn-stat-value" style="font-size:20px">${esc(value)}</span></div>`).join("");
    const demo = list.find(project => project.isDemo);
    $("#demo-status").textContent = demo ? `Demo project present with ${(demo.vanessaRuns || []).length} Vanessa runs. Resetting deletes it; it’s recreated fresh next time you open the demo.` : "Not created yet. It’s generated from fixed sample data the first time you open the demo.";
    $("#reset-demo").disabled = !demo;
    $("#reset-demo").onclick = async () => { if (!demo || !confirm("Delete the demo project? Your own projects are not affected.")) return; await store.remove(demo.id); platform().toast("Demo project reset."); storage(); };
    $("#export-all").onclick = () => {
      if (!list.length) return platform().toast("There are no projects to export yet.");
      const bundle = { format: "signal-noir-projects", version: 2, exportedAt: new Date().toISOString(), projects: list };
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
      link.download = `signal-noir-projects-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 800);
    };
  }

  async function workspaceFile() {
    let record = null;
    try { record = await platform().workspace.get(); } catch (error) { record = null; }
    $("#workspace-file").textContent = record ? `${record.name} · ${human(record.size)}: shared with the file-based tools in this browser.` : "No file is shared between tools right now.";
    $("#clear-workspace").disabled = !record;
  }
  $("#clear-workspace").addEventListener("click", async () => { await platform().workspace.clear(); workspaceFile(); platform().toast("Workspace file cleared."); });
  $("#clear-prefs").addEventListener("click", () => { ["hub_platform_recent", "hub_recent_tools", "hub_favorite_tools", "hub_tool_view"].forEach(key => set(key, null)); platform().toast("Recent and favorite tools cleared."); });


  const access = window.SignalNoir.access;
  const accessUi = window.SignalNoir.accessUi;

  function renderAccess() {
    const info = access.summary();
    $("#workspace-detail").textContent = info.personal
      ? "Personal workspace. Every capability is available and no access rules apply."
      : `${info.workspaceName}${info.member ? ` · signed in as ${info.member.name}` : ""}${info.profileName ? ` · ${info.profileName}` : ""}.`;
    $("#access-status").innerHTML = info.personal ? "" : `<div class="sn-panel sn-panel-pad" style="margin-bottom:4px">
      <div class="sn-split"><strong style="color:var(--sn-text)">${esc(info.preview ? `Previewing as ${info.preview.name}` : info.profileName || "No access profile assigned")}</strong><span class="sn-badge sn-badge-accent">${info.capabilityCount} of ${info.totalCapabilities} capabilities</span></div>
      ${info.teams.length ? `<p class="sn-muted sn-small" style="margin-top:8px">Teams: ${esc(info.teams.map(team => team.name).join(", "))}</p>` : ""}
      ${info.sources.length ? `<p class="sn-muted sn-small" style="margin-top:6px">From ${esc(info.sources.map(entry => entry.source === "team" ? `${entry.profileName} (via ${entry.teamName})` : entry.profileName).join(" and "))}.</p>` : ""}
      ${info.restrictions.length ? `<p class="sn-muted sn-small" style="margin-top:6px">${info.restrictions.length} capabilit${info.restrictions.length === 1 ? "y is" : "ies are"} restricted for you specifically.</p>` : ""}
      ${info.preview ? '<div class="sn-cluster" style="margin-top:12px"><button type="button" class="sn-btn sn-btn-sm" data-access-exit-preview>Exit preview</button></div>' : ""}
    </div>`;
    const demo = access.demoOrganization();
    $("#demo-org-status").textContent = demo
      ? `“${demo.name}” is set up with ${demo.teams.length} teams and ${demo.members.length} people. It is sample data and can be removed.`
      : "A clearly labelled example with five teams, so you can see how the interface adapts.";
    $("#demo-org-btn").textContent = demo ? "Remove sample" : "Add sample";
    $("#demo-org-btn").classList.toggle("sn-btn-danger", Boolean(demo));
    accessUi.bindExit($("#access-status"));
  }

  $("#switch-workspace").addEventListener("click", () => accessUi.openSwitcher());
  $("#demo-org-btn").addEventListener("click", () => {
    const demo = access.demoOrganization();
    if (demo) {
      if (!confirm(`Remove “${demo.name}”? Its teams, people and access profiles are deleted. No project data is affected.`)) return;
      access.removeOrganization(demo.id);
      platform().toast("Sample organization removed.");
    } else {
      const created = access.createDemoOrganization();
      platform().toast(`${created.name} added. Switch to it to see how the interface adapts.`);
    }
    renderAccess();
  });
  $("#reset-access").addEventListener("click", () => {
    if (!confirm("Remove every organization, team, member and access profile from this browser? Projects and data are not affected.")) return;
    access.reset();
    platform().toast("Access settings reset. You’re back in the personal workspace.");
    location.reload();
  });
  renderAccess();

  $("#install-app").addEventListener("click", () => platform().promptInstall());
  document.addEventListener("sn:platform-ready", () => {
    if (matchMedia("(display-mode: standalone)").matches) { $("#install-status").textContent = "Signal Noir is already installed and running as an app."; $("#install-app").disabled = true; }
    workspaceFile();
  });
  storage();
  if (window.SignalNoir.platform) workspaceFile();
})();
