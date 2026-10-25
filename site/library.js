
(function () {
  "use strict";

  const { catalog, projects: store, site, access } = window.SignalNoir;
  const esc = site.esc;
  const platform = () => window.SignalNoir.platform;
  const $ = selector => document.querySelector(selector);
  const TABS = [
    { id: "templates", label: "Templates", capability: "vanessa.use" },
    { id: "analyses", label: "Saved analyses" },
    { id: "reports", label: "Reports", capability: "reports.view" },
    { id: "dashboards", label: "Dashboards", capability: "dashboards.view" },
    { id: "workflows", label: "Workflows", capability: "workflows.view" }
  ];
  const tabs = () => TABS.filter(tab => !tab.capability || access.can(tab.capability));
  let active = tabs().some(tab => tab.id === location.hash.slice(1)) ? location.hash.slice(1) : tabs()[0]?.id || "reports";
  let data = { projects: [], outputs: [], published: [], saved: [] };

  function openProject(id) { platform().handoff.set({ openProject: id }); platform().navigate("tools/studio/index.html"); }
  const projectBadge = item => item.isDemo ? '<span class="sn-badge sn-badge-preview">Demo</span>' : '<span class="sn-badge sn-badge-success"><i></i>Local</span>';
  const when = value => value ? site.relativeTime(value) : "";
  const empty = (icon, title, text, action = "") => `<div class="sn-empty"><div class="sn-empty-icon">${icon}</div><div class="sn-empty-title">${title}</div><div class="sn-empty-text">${text}</div>${action ? `<div class="sn-empty-actions">${action}</div>` : ""}</div>`;
  const row = ({ icon, title, detail, badge = "", attrs = "" }) => `<button type="button" class="list-row" ${attrs}><span class="sn-card-icon" aria-hidden="true">${icon}</span><span style="min-width:0"><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${badge}</button>`;

  const panels = {
    templates() {
      return `<div class="sn-grid" style="--sn-grid-min:300px;--sn-grid-gap:12px">${catalog.templates.map(template => `<article class="sn-card"><div class="sn-split"><span class="sn-badge">${esc(template.audience)}</span><span class="sn-faint sn-xs">${esc(catalog.intent(template.intent).label)}</span></div><h2 class="sn-card-title" style="font-size:16px">${esc(template.title)}</h2><p class="sn-card-text">${esc(template.description)}</p><p class="sn-faint sn-xs" style="margin-top:auto">Needs: ${esc(template.needs)}</p><div class="sn-cluster" style="margin-top:6px"><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-template="${template.id}">Use template</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-template-demo="${template.id}">Try on demo data</button></div></article>`).join("")}</div>`;
    },
    analyses() {
      const runs = data.projects.flatMap(project => (project.vanessaRuns || []).map(run => ({ run, project }))).sort((a, b) => b.run.createdAt - a.run.createdAt);
      const findings = data.projects.flatMap(project => (project.findings || []).map(item => ({ item, project })));
      if (!runs.length && !findings.length) return empty("V", "No saved analyses yet", "Every request you give Vanessa is kept with its plan, findings and evidence. Ask her something in Studio to start.", '<a class="sn-btn sn-btn-sm sn-btn-primary" href="tools/studio/index.html">Open Studio</a>');
      return `${findings.length ? `<h2 class="sn-eyebrow" style="margin:6px 0 12px">Saved findings</h2><div class="list" style="margin-bottom:28px">${findings.slice(0, 30).map(({ item, project }) => row({ icon: "✦", title: item.title, detail: `${project.name} · ${item.evidence?.method || "No evidence"}`, badge: projectBadge(project), attrs: `data-project="${esc(project.id)}"` })).join("")}</div>` : ""}
        <h2 class="sn-eyebrow" style="margin:6px 0 12px">Vanessa analyses</h2><div class="list">${runs.slice(0, 40).map(({ run, project }) => row({ icon: "V", title: run.prompt, detail: `${project.name} · ${run.intentLabel || run.intent} · ${(run.findings || []).length} findings · ${when(run.createdAt)}`, badge: projectBadge(project), attrs: `data-project="${esc(project.id)}"` })).join("")}</div>`;
    },
    reports() {
      const list = data.outputs.filter(item => item.kind === "report");
      return list.length ? `<div class="list">${list.map(item => row({ icon: "▤", title: item.title, detail: `${item.projectName} · ${item.detail ? `${item.detail.slice(0, 90)} · ` : ""}${when(item.at)}`, badge: projectBadge(item), attrs: `data-project="${esc(item.projectId)}"` })).join("")}</div>`
        : empty("▤", "No reports yet", "Your dashboards, reports, and findings will appear here. Ask Vanessa to “create a report” in any project.", '<a class="sn-btn sn-btn-sm sn-btn-primary" href="tools/studio/index.html">Open Studio</a>');
    },
    dashboards() {
      const studioDashboards = data.outputs.filter(item => item.kind === "dashboard");
      const sections = [];
      if (studioDashboards.length) sections.push(`<h2 class="sn-eyebrow" style="margin:6px 0 12px">From Studio projects</h2><div class="list" style="margin-bottom:28px">${studioDashboards.map(item => row({ icon: "▥", title: item.title, detail: `${item.projectName} · ${item.detail || ""}`, badge: projectBadge(item), attrs: `data-project="${esc(item.projectId)}"` })).join("")}</div>`);
      if (data.saved.length) sections.push(`<h2 class="sn-eyebrow" style="margin:6px 0 12px">Saved from Dashboard Builder</h2><div class="list" style="margin-bottom:28px">${data.saved.map(item => `<a class="list-row" href="tools/dashboard-builder/view.html#${esc(item.spec)}"><span class="sn-card-icon" aria-hidden="true">DB</span><span style="min-width:0"><strong>${esc(item.title)}</strong><small>${esc([item.subtitle, `${item.visuals} visuals`, when(Date.parse(item.updated))].filter(Boolean).join(" · "))}</small></span><span class="sn-badge sn-badge-success"><i></i>Local</span></a>`).join("")}</div>`);
      if (data.published.length) sections.push(`<h2 class="sn-eyebrow" style="margin:6px 0 12px">Published with this site</h2><div class="list">${data.published.map(item => `<a class="list-row" href="dashboards/${encodeURIComponent(item.file)}"><span class="sn-card-icon" aria-hidden="true">▥</span><span style="min-width:0"><strong>${esc(item.title)}</strong><small>${esc([item.owner, item.audience, item.refresh && `refreshed ${item.refresh}`].filter(Boolean).join(" · "))}</small></span><span class="sn-badge">Published</span></a>`).join("")}</div>`);
      return sections.join("") || empty("▥", "No dashboards yet", "Build one with Vanessa in Studio, or design one in Dashboard Builder and save it to your workspace.", '<a class="sn-btn sn-btn-sm sn-btn-primary" href="tools/studio/index.html">Ask Vanessa</a><a class="sn-btn sn-btn-sm" href="tools/dashboard-builder/index.html">Dashboard Builder</a>');
    },
    workflows() {
      const list = data.outputs.filter(item => item.kind === "workflow");
      return list.length ? `<div class="list">${list.map(item => row({ icon: "↻", title: item.title, detail: `${item.projectName} · ${item.detail || ""}`, badge: projectBadge(item), attrs: `data-project="${esc(item.projectId)}"` })).join("")}</div>`
        : empty("↻", "No workflows yet", "Ask Vanessa to perform a multi-step task, or to “run this analysis every month”, and the steps are saved as a reusable workflow.", '<a class="sn-btn sn-btn-sm sn-btn-primary" href="tools/studio/index.html">Open Studio</a>');
    }
  };

  function counts() {
    return {
      templates: catalog.templates.length,
      analyses: data.projects.reduce((sum, project) => sum + (project.vanessaRuns || []).length, 0),
      reports: data.outputs.filter(item => item.kind === "report").length,
      dashboards: data.outputs.filter(item => item.kind === "dashboard").length + data.saved.length + data.published.length,
      workflows: data.outputs.filter(item => item.kind === "workflow").length
    };
  }

  function render() {
    const count = counts();
    if (!tabs().some(tab => tab.id === active)) active = tabs()[0]?.id || "reports";
    $("#library-tabs").innerHTML = tabs().map(tab => `<button type="button" class="sn-tab" role="tab" id="tab-${tab.id}" aria-controls="library-panel" aria-selected="${tab.id === active}" tabindex="${tab.id === active ? 0 : -1}" data-tab="${tab.id}">${tab.label}<span class="sn-count">${count[tab.id]}</span></button>`).join("");
    $("#library-panel").setAttribute("aria-labelledby", `tab-${active}`);
    $("#library-panel").innerHTML = panels[active]();
  }

  $("#library-tabs").addEventListener("click", event => {
    const tab = event.target.closest("[data-tab]");
    if (!tab) return;
    active = tab.dataset.tab;
    history.replaceState(null, "", `#${active}`);
    render();
    $(`[data-tab="${active}"]`).focus();
  });
  $("#library-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const list = tabs();
    const index = list.findIndex(tab => tab.id === active);
    active = list[(index + (event.key === "ArrowRight" ? 1 : list.length - 1)) % list.length].id;
    render(); $(`[data-tab="${active}"]`).focus();
  });
  $("#library-panel").addEventListener("click", event => {
    const project = event.target.closest("[data-project]");
    if (project) return openProject(project.dataset.project);
    const template = event.target.closest("[data-template]");
    if (template) { const item = catalog.templates.find(entry => entry.id === template.dataset.template); platform().continueInStudio({ prompt: item.prompt, intent: item.intent, template: item.id, useWorkspace: false }); }
    const demo = event.target.closest("[data-template-demo]");
    if (demo) { const item = catalog.templates.find(entry => entry.id === demo.dataset.templateDemo); platform().handoff.set({ openDemo: true, prompt: item.prompt }); platform().navigate("tools/studio/index.html"); }
  });

  async function load() {

    const projects = access.projectAccess.visible(await store.list());
    let published = [];
    try { const response = await fetch("dashboards/index.json", { cache: "no-store" }); if (response.ok) published = await response.json(); } catch (error) {                                     }
    data = { projects, outputs: projects.flatMap(store.outputsOf).sort((a, b) => (b.at || 0) - (a.at || 0)), published: Array.isArray(published) ? published : [], saved: typeof workspaceList === "function" ? workspaceList() : [] };
    render();
  }
  window.addEventListener("hashchange", () => { const next = location.hash.slice(1); if (tabs().some(tab => tab.id === next)) { active = next; render(); } });
  render();
  load();
})();
