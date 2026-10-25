
(function () {
  "use strict";

  const { catalog, Workflow, projects } = window.SignalNoir;
  const site = window.SignalNoir.site;
  const platform = () => window.SignalNoir.platform;
  const esc = site.esc;
  const $ = selector => document.querySelector(selector);
  const form = $("#ask");
  const input = $("#ask-input");
  const fileInput = $("#ask-file");
  const plan = $("#plan");
  const MAX_FILE = 50 * 1024 * 1024;
  let files = [];

  const toolHref = id => `tools/${id}/index.html`;
  const humanSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  function openDemo() {
    platform().handoff.set({ openDemo: true });
    platform().navigate("tools/studio/index.html");
  }


  function addFiles(list) {
    const incoming = Array.from(list || []);
    const tooBig = incoming.filter(file => file.size > MAX_FILE);
    files = files.concat(incoming.filter(file => file.size <= MAX_FILE)).slice(0, 8);
    if (tooBig.length) platform()?.toast(`${tooBig.length} file${tooBig.length > 1 ? "s are" : " is"} over 50 MB and was skipped.`);
    renderFiles();
    input.focus();
  }

  function renderFiles() {
    $("#ask-files").innerHTML = files.map((file, index) => `<span class="ask-file"><strong title="${esc(file.name)}">${esc(file.name)}</strong><span class="sn-muted">${humanSize(file.size)}</span><button type="button" data-remove="${index}" aria-label="Remove ${esc(file.name)}">✕</button></span>`).join("");
    if (files.length && !input.value.trim()) input.placeholder = `What should Vanessa do with ${files.length === 1 ? files[0].name : `these ${files.length} files`}?`;
  }

  $("#ask-files").addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    files.splice(Number(button.dataset.remove), 1);
    renderFiles();
  });
  $("#ask-attach").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach(type => form.addEventListener(type, event => { event.preventDefault(); form.classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach(type => form.addEventListener(type, event => { event.preventDefault(); if (type === "dragleave" && form.contains(event.relatedTarget)) return; form.classList.remove("is-dragging"); }));
  form.addEventListener("drop", event => addFiles(event.dataTransfer.files));

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 240)}px`; });


  function stageDetail(stageId, intent) {
    const helper = intent.tools.map(catalog.tool).find(tool => tool?.step === stageId);
    const base = catalog.stage(stageId).description;
    return helper ? `${base} · uses ${helper.title}` : base;
  }

  function describe(intent, prompt) {
    const count = files.length;
    const data = count ? `<strong>${count === 1 ? esc(files[0].name) : `${count} files`}</strong>` : "your data";
    const lines = {
      "compare-periods": `I’ll line up the latest period against the one before it in ${data}, measure the change and break it down to show what drove it.`,
      "compare-files": `I’ll compare ${data} column by column and row by row, and report what was added, removed or changed.`,
      forecast: `I’ll aggregate ${data} by month, fit a trend and give you a projection with a range, not just a single number.`,
      clean: `I’ll audit ${data} for blanks, duplicates, stray whitespace and inconsistent labels, then propose fixes you approve before anything changes.`,
      join: `I’ll look for shared keys in ${data}, check how well they match and build a joined table when you approve it.`,
      anomalies: `I’ll scan ${data} for values and periods that sit far outside the normal range.`,
      dashboard: `I’ll profile ${data}, pick the numbers that matter and lay out a dashboard you can refine.`,
      report: `I’ll validate ${data}, compute the headline numbers and what changed, and assemble a report you can export.`,
      automate: `I’ll build this as a repeatable workflow on ${data} and set a reminder to rerun it.`,
      explain: `I’ll profile ${data} and explain what each important number means, with the calculation behind it.`,
      analyze: `I’ll profile ${data}, find the main measures and breakdowns and surface what stands out.`
    };
    return lines[intent.id] || `I’ll work through ${data} step by step.`;
  }

  function showPlan(prompt) {
    const intent = catalog.matchIntent(prompt) || (files.length ? catalog.intent("analyze") : null);
    const ranked = catalog.rankTools(prompt, 3);
    plan.hidden = false;

    if (!intent && ranked.length && ranked[0].tool.accepts !== "tabular" && ranked[0].score >= 8) {
      const tool = ranked[0].tool;
      plan.innerHTML = `<div class="plan-head"><span class="vanessa-avatar-sm" aria-hidden="true">V</span><p>That’s a quick one. <strong>${esc(tool.title)}</strong> does exactly this, right in your browser.</p></div>
        <a class="plan-tool" href="${toolHref(tool.id)}"><span class="sn-card-icon">${esc(tool.icon)}</span><span><strong style="color:var(--sn-text)">${esc(tool.title)}</strong><br><span class="sn-muted">${esc(tool.description)}</span></span></a>`;
      return;
    }

    if (!intent) {
      plan.innerHTML = `<div class="plan-head"><span class="vanessa-avatar-sm" aria-hidden="true">V</span><p>I want to get this right. <strong>What kind of result do you need?</strong></p></div>
        <div class="sn-cluster">${["analyze", "compare-periods", "compare-files", "clean", "dashboard", "forecast"].map(id => `<button type="button" class="sn-chip" data-followup="${id}">${esc(catalog.intent(id).label)}</button>`).join("")}</div>
        ${ranked.length ? `<p class="sn-muted sn-small" style="margin:20px 0 10px">Or jump straight to a tool:</p><div class="sn-stack" style="--sn-stack-gap:8px">${ranked.map(({ tool }) => `<a class="plan-tool" href="${toolHref(tool.id)}"><span class="sn-card-icon">${esc(tool.icon)}</span><span><strong style="color:var(--sn-text)">${esc(tool.title)}</strong> <span class="sn-muted">· ${esc(tool.description)}</span></span></a>`).join("")}</div>` : ""}`;
      plan.querySelectorAll("[data-followup]").forEach(button => button.addEventListener("click", () => {
        const chosen = catalog.intent(button.dataset.followup);
        input.value = prompt ? `${prompt} (${chosen.label.toLowerCase()})` : chosen.starter;
        form.requestSubmit();
      }));
      return;
    }

    const supporting = intent.tools.map(catalog.tool).filter(Boolean);
    plan.innerHTML = `<div class="plan-head"><span class="vanessa-avatar-sm" aria-hidden="true">V</span><p><span class="sn-badge sn-badge-accent" style="margin-bottom:8px">${esc(intent.label)}</span><br>${describe(intent, prompt)}</p></div>
      <div class="plan-grid">
        <div><p class="sn-eyebrow" style="margin-bottom:14px">Proposed plan</p><div id="plan-workflow"></div></div>
        <div class="plan-side">
          <p class="sn-eyebrow">Tools Vanessa will use</p>
          ${supporting.map(tool => `<a class="plan-tool" href="${toolHref(tool.id)}"><span class="sn-card-icon">${esc(tool.icon)}</span><span>${esc(tool.title)}</span></a>`).join("")}
          <div class="sn-callout" style="margin-top:6px"><span aria-hidden="true">◉</span><span><strong>Runs locally.</strong> ${files.length ? "Your files stay in this browser." : "Add data in Studio, or drop it on the box above."}</span></div>
        </div>
      </div>
      <div class="plan-actions">
        <button type="button" class="sn-btn sn-btn-accent sn-btn-lg" data-start>Start in Studio <span aria-hidden="true">→</span></button>
        ${files.length ? "" : '<button type="button" class="sn-btn sn-btn-lg" data-add-first>Add data first</button>'}
        <button type="button" class="sn-btn sn-btn-ghost sn-btn-lg" data-demo>Try it on demo data</button>
      </div>`;
    Workflow.create(plan.querySelector("#plan-workflow"), {
      steps: intent.stages.map(id => ({ id, label: catalog.stage(id).label, status: "pending", detail: stageDetail(id, intent) }))
    });
    plan.querySelector("[data-start]").addEventListener("click", event => {
      event.currentTarget.disabled = true;
      event.currentTarget.innerHTML = '<span class="sn-spinner" aria-hidden="true"></span> Opening Studio…';
      platform().continueInStudio({ prompt: prompt || intent.starter, intent: intent.id, files, useWorkspace: false });
    });
    plan.querySelector("[data-add-first]")?.addEventListener("click", () => fileInput.click());
    plan.querySelector("[data-demo]").addEventListener("click", () => { platform()?.handoff.set({ openDemo: true, prompt: prompt || intent.starter }); platform()?.navigate("tools/studio/index.html"); });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const prompt = input.value.trim();
    if (!prompt && !files.length) { input.focus(); input.placeholder = "Describe what you need, or add a file to start"; return; }
    showPlan(prompt);
    plan.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  });


  const STARTER_CAPABILITY = { "compare-files": "data.transform", clean: "data.clean", forecast: "analysis.advanced", dashboard: "dashboards.create", report: "reports.create", analyze: "analysis.basic", "compare-periods": "analysis.basic", explain: "analysis.basic" };
  $("#ask-starters").innerHTML = catalog.starters.filter(item => window.SignalNoir.access.can(STARTER_CAPABILITY[item.intent] || "analysis.basic")).map(item => `<button type="button" class="sn-chip" data-starter="${esc(item.intent)}">${esc(item.label)}</button>`).join("");
  $("#ask-starters").addEventListener("click", event => {
    const button = event.target.closest("[data-starter]");
    if (!button) return;
    input.value = catalog.intent(button.dataset.starter).starter;
    form.requestSubmit();
  });


  async function openProjectPicker() {
    const list = await projects.list();
    const body = list.length
      ? `<div class="list">${list.slice(0, 12).map(project => `<button type="button" class="list-row" data-project="${esc(project.id)}"><span class="sn-card-icon">${project.isDemo ? "▶" : "▤"}</span><span style="min-width:0"><strong>${esc(project.name)}</strong><small>${(project.datasets || []).length} datasets · updated ${esc(site.relativeTime(project.updatedAt))}</small></span>${project.isDemo ? '<span class="sn-badge sn-badge-preview">Demo</span>' : '<span class="sn-badge sn-badge-success"><i></i>Local</span>'}</button>`).join("")}</div>`
      : `<div class="sn-empty"><div class="sn-empty-icon">▤</div><div class="sn-empty-title">No local projects yet</div><div class="sn-empty-text">Start with a question or add data. Projects you create in Studio are saved in this browser.</div><div class="sn-empty-actions"><a class="sn-btn sn-btn-primary sn-btn-sm" href="tools/studio/index.html">Open Studio</a><button type="button" class="sn-btn sn-btn-sm" data-demo>Open the demo</button></div></div>`;
    const dialog = site.modal({ title: "Open a project", eyebrow: "Stored in this browser", body });
    dialog.el.querySelectorAll("[data-project]").forEach(button => button.addEventListener("click", () => { platform().handoff.set({ openProject: button.dataset.project }); platform().navigate("tools/studio/index.html"); }));
    dialog.el.querySelector("[data-demo]")?.addEventListener("click", openDemo);
  }

  function openTemplates() {
    const body = `<div class="sn-stack" style="--sn-stack-gap:10px">${catalog.templates.map(template => `<button type="button" class="sn-card" data-template="${esc(template.id)}"><span class="sn-split"><span class="sn-card-title">${esc(template.title)}</span><span class="sn-badge">${esc(template.audience)}</span></span><span class="sn-card-text">${esc(template.description)}</span><span class="sn-faint sn-xs">Needs: ${esc(template.needs)}</span></button>`).join("")}</div>`;
    const dialog = site.modal({ title: "Start from a template", eyebrow: "Library", body, wide: true });
    dialog.el.querySelectorAll("[data-template]").forEach(button => button.addEventListener("click", () => {
      const template = catalog.templates.find(item => item.id === button.dataset.template);
      dialog.close();
      input.value = template.prompt;
      form.requestSubmit();
    }));
  }

  document.querySelector('[data-entry="data"]').addEventListener("click", () => { fileInput.click(); });
  document.querySelector('[data-entry="project"]').addEventListener("click", openProjectPicker);
  document.querySelector('[data-entry="template"]').addEventListener("click", openTemplates);
  document.querySelectorAll("[data-open-demo]").forEach(link => link.addEventListener("click", event => { event.preventDefault(); openDemo(); }));
  projects.list().then(list => {
    const real = list.filter(project => !project.isDemo);
    if (real.length) $("#entry-project-meta").textContent = `${real.length} local project${real.length === 1 ? "" : "s"} · ${real[0].name}`;
  });


  Workflow.create($("#flow-demo-workflow"), { compact: false, steps: [
    { id: "import", label: "Import", status: "complete", items: ["3 files"] },
    { id: "validate", label: "Validate", status: "warning", items: [{ text: "37 missing values", tone: "warning" }] },
    { id: "clean", label: "Clean", status: "complete", items: ["Removed duplicates"] },
    { id: "analyze", label: "Analyze", status: "running" },
    { id: "report", label: "Report", status: "pending" }
  ] });
  $("#flow-demo-workflow").removeAttribute("aria-live");

  const usecases = [
    ["analyze", "Analyze spreadsheets", "Profile any export and surface the numbers and breakdowns that matter."],
    ["clean", "Clean messy data", "Blanks, duplicates, stray spaces and inconsistent labels, fixed with your approval."],
    ["compare-files", "Compare datasets", "See exactly what changed between two versions of a file."],
    ["dashboard", "Build dashboards", "Headline tiles and charts chosen from what your data contains."],
    ["report", "Generate reports", "Findings, evidence and recommendations assembled into an exportable report."],
    ["forecast", "Forecast outcomes", "Monthly projections with an honest range around them."],
    ["automate", "Automate recurring analysis", "Save the steps once and rerun them every month."],
    ["compare-periods", "Explain what changed", "Period-over-period movement broken down by what drove it."]
  ];
  $("#usecases").innerHTML = usecases.map(([intent, title, text], index) => `<button type="button" class="usecase" data-usecase="${intent}"><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${esc(title)}</strong><small>${esc(text)}</small></span><span aria-hidden="true">→</span></button>`).join("");
  $("#usecases").addEventListener("click", event => {
    const button = event.target.closest("[data-usecase]");
    if (!button) return;
    input.value = catalog.intent(button.dataset.usecase).starter;
    form.requestSubmit();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const modeIcons = { local: "◉", "private-cloud": "☁", team: "◎" };
  $("#mode-list").innerHTML = catalog.projectModes.map(mode => `<div class="mode-row"><span class="sn-card-icon" aria-hidden="true">${modeIcons[mode.id]}</span><span><strong>${esc(mode.label)}</strong><small>${esc(mode.tagline)}</small></span>${mode.status === "available" ? '<span class="sn-badge sn-badge-success"><i></i>Available</span>' : '<span class="sn-badge sn-badge-preview">Coming later</span>'}</div>`).join("");

  $("#toolkit").innerHTML = catalog.categories.map(category => {
    const tools = catalog.tools.filter(tool => tool.category === category.id);
    return `<a href="tools/index.html#${category.id}"><strong>${esc(category.label)}</strong><small>${esc(tools.slice(0, 3).map(tool => tool.title).join(", "))}${tools.length > 3 ? "…" : ""}</small><em>${tools.length} tool${tools.length === 1 ? "" : "s"}</em></a>`;
  }).join("");


  const access = window.SignalNoir.access;
  const shown = ["core", "analyst", "operations", "leadership"];
  const profiles = access.DEFAULT_PROFILES.filter(profile => shown.includes(profile.id));
  const info = access.summary();
  $("#access-pitch").innerHTML = `${profiles.map(profile => {
    const groups = access.CATEGORIES.map(category => ({ label: category.label, on: access.capabilitiesIn(category.id).filter(cap => profile.capabilities.includes(cap.id)).length })).filter(entry => entry.on);
    return `<article class="access-card"><h3 class="sn-h4">${esc(profile.name)}</h3><p class="sn-muted sn-small">${esc(profile.description)}</p><div class="sn-cluster" style="gap:5px">${groups.map(group => `<span class="sn-chip sn-chip-sm">${esc(group.label)} ${group.on}</span>`).join("")}</div></article>`;
  }).join("")}
    <article class="access-card is-wide"><h3 class="sn-h4">Your own profiles</h3><p class="sn-muted sn-small">These four are starting points. An organization can rename them, change what they include, or build its own — Tour Guide, Executive Viewer, Data Steward — and assign one to each team.</p><div class="sn-cluster" style="margin-top:4px"><a class="sn-btn sn-btn-sm" href="organization.html">${info.personal ? "Set up an organization" : "Manage access"}</a></div></article>`;

  if (location.hash === "#ask") setTimeout(() => input.focus(), 200);
  site.onboarding({ onDemo: openDemo, anchor: $("#ask-privacy") });
})();

(() => {
  const hero = document.querySelector('.home-hero');
  if (!hero || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let frame = 0;
  hero.addEventListener('pointermove', event => {
    if (frame || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced') return;
    frame = requestAnimationFrame(() => {
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty('--signal-x', `${(event.clientX - bounds.left - bounds.width / 2) * .035}px`);
      hero.style.setProperty('--signal-y', `${(event.clientY - bounds.top - bounds.height / 2) * .035}px`);
      frame = 0;
    });
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    hero.style.setProperty('--signal-x', '0px');
    hero.style.setProperty('--signal-y', '0px');
  });
})();
