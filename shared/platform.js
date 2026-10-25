


(function () {
  "use strict";

  const script = document.currentScript;
  const rootUrl = script ? new URL("../../", script.src) : new URL("../../", location.href);
  const catalog = window.SignalNoir?.catalog || null;


  const access = window.SignalNoir?.access || null;
  const accessUi = () => window.SignalNoir?.accessUi || null;
  const canUse = (kind, id) => !access || access.canUse(kind, id);
  const can = id => !access || access.can(id);


  const navVisible = item => canUse("nav", item.id) && (item.id !== "tools" || !catalog || catalog.tools.some(tool => canUse("tools", tool.id)));
  const relPath = decodeURIComponent(location.pathname).replace(decodeURIComponent(rootUrl.pathname), "");
  const toolId = relPath.match(/^tools\/([^/]+)\//)?.[1] || null;
  const isStudio = toolId === "studio";
  const currentTool = toolId && catalog ? catalog.tool(toolId) : null;
  const pageId = resolvePageId();
  const DB_NAME = "datahub_workspace";
  const STORE = "files";
  const CURRENT = "current";
  const HANDOFF_KEY = "sn_handoff";
  const RECENT_KEY = "hub_platform_recent";
  let installPrompt = null;
  let lastChosenFile = null;

  function resolvePageId() {
    if (relPath === "" || relPath === "index.html") return "home";
    if (relPath === "tools/" || relPath === "tools/index.html") return "tools";
    if (isStudio) return "studio";
    if (toolId) return "tools";
    const page = relPath.replace(/\.html$/, "");
    if (["library", "organization", "settings"].includes(page)) return page;
    if (page === "dashboards") return "library";
    return page;
  }

  const url = path => new URL(path, rootUrl).href;
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
  const icons = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    theme: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg>'
  };


  function toast(message, { timeout = 3400 } = {}) {
    let region = document.querySelector(".sn-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "sn-toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const node = document.createElement("div");
    node.className = "sn-toast";
    node.textContent = message;
    region.appendChild(node);
    setTimeout(() => node.remove(), timeout);
  }


  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function workspaceGet() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(CURRENT);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function workspaceSet(file) {
    const db = await openDb();
    const record = { blob: file, name: file.name, type: file.type, size: file.size, modified: file.lastModified || Date.now(), savedAt: Date.now() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record, CURRENT);
      tx.oncomplete = () => { db.close(); resolve(record); };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function workspaceClear() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(CURRENT);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  }


  async function stashFiles(files) {
    const db = await openDb();
    const records = files.map(file => ({ blob: file, name: file.name, type: file.type, size: file.size, modified: file.lastModified || Date.now() }));
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(records, "handoff");
      tx.oncomplete = () => { db.close(); resolve(records.length); };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function takeStash() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const request = store.get("handoff");
      request.onsuccess = () => { store.delete("handoff"); };
      tx.oncomplete = () => { db.close(); resolve((request.result || []).map(makeFile)); };
      tx.onerror = () => reject(tx.error);
    });
  }

  function makeFile(record) {
    return new File([record.blob], record.name, { type: record.type || record.blob.type, lastModified: record.modified || Date.now() });
  }

  function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function loadIntoFirstInput(record) {
    const input = document.querySelector('main input[type="file"], input[type="file"]');
    if (!input) { toast("This tool doesn’t take file uploads."); return false; }
    try {
      const transfer = new DataTransfer();
      transfer.items.add(makeFile(record));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      toast(`${record.name} loaded from your workspace.`);
      return true;
    } catch (error) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Choose the file from this tool’s upload control.");
      return false;
    }
  }

  function sampleFile() {
    const csv = [
      "date,region,product,revenue,orders,satisfaction",
      "2026-01-01,North,Starter,12800,142,4.2",
      "2026-02-01,South,Pro,16750,159,4.5",
      "2026-03-01,West,Starter,14120,151,4.1",
      "2026-04-01,East,Enterprise,21300,177,4.7",
      "2026-05-01,North,Pro,18440,168,4.6",
      "2026-06-01,South,Enterprise,23950,186,4.8"
    ].join("\n");
    return new File([csv], "signal-noir-sample.csv", { type: "text/csv" });
  }

  async function useSample() {
    const record = await workspaceSet(sampleFile());
    if (toolId && !isStudio) loadIntoFirstInput(record);
    await renderWorkspaceBanner();
    toast("Sample data is ready.");
  }


  const handoff = {
    set(payload) {
      try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...payload, at: Date.now() })); } catch (error) {                                      }
    },
    take() {
      try {
        const raw = sessionStorage.getItem(HANDOFF_KEY);
        sessionStorage.removeItem(HANDOFF_KEY);
        const value = raw ? JSON.parse(raw) : null;
        return value && Date.now() - value.at < 10 * 60 * 1000 ? value : null;
      } catch (error) { return null; }
    }
  };

  async function continueInStudio({ prompt = "", intent = "", template = "", file = null, files = null, useWorkspace = true } = {}) {
    let importWorkspace = false;
    let stash = false;
    const candidate = file || lastChosenFile;
    try {
      if (files?.length) { await stashFiles(files); stash = true; }
      else if (candidate) { await workspaceSet(candidate); importWorkspace = true; }
      else if (useWorkspace && await workspaceGet()) importWorkspace = true;
    } catch (error) {                                                         }
    handoff.set({ prompt, intent, template, importWorkspace, stash, source: toolId || pageId });
    navigate(url("tools/studio/index.html"));
  }


  function datasetToCsv(dataset) {
    const cell = value => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const columns = dataset.columns || Object.keys(dataset.rows?.[0] || {});
    return [columns.map(cell).join(","), ...(dataset.rows || []).map(row => columns.map(column => cell(row[column])).join(","))].join("\n");
  }


  function pageFacts(limit = 5) {
    const facts = [];
    document.querySelectorAll("main [class*='text-2xl'], main [class*='text-3xl'], main .sn-stat-value, main strong").forEach(node => {
      if (facts.length >= limit) return;
      const value = node.textContent.trim();
      if (!/^[-+$£€]?[\d.,]+\s*[%KMB]?$/.test(value)) return;
      const label = node.closest("div,section,article")?.querySelector("p,span,h3,h4,label")?.textContent.trim().slice(0, 60);
      if (label && value) facts.push(`${label}: ${value}`);
    });
    return facts;
  }

  async function openVanessa(options = {}) {
    const tool = currentTool;
    const provided = typeof window.signalNoirToolContext === "function" ? (() => { try { return window.signalNoirToolContext() || {}; } catch (error) { return {}; } })() : {};
    const detail = { source: toolId || pageId, sourceLabel: tool?.title || document.title.split("—")[0].trim(), ...provided, ...options };
    let datasets = detail.datasets || [];
    if (!datasets.length && typeof window.vanessaCurrentDataset === "function") {
      const current = window.vanessaCurrentDataset();
      if (current?.columns?.length) datasets = [{ name: `${tool?.id || "data"}.csv`, ...current }];
    }
    const files = datasets.filter(dataset => dataset?.rows?.length).slice(0, 4).map(dataset => new File([datasetToCsv(dataset)], dataset.name || "data.csv", { type: "text/csv" }));
    try { if (files.length) await stashFiles(files); }
    catch (error) { toast("Couldn’t hand the data over; add the file in Studio instead."); }
    handoff.set({
      stash: files.length > 0,
      prompt: detail.suggestedPrompt || "",
      context: { source: detail.source, sourceLabel: detail.sourceLabel, summary: detail.summary || `Continued from ${detail.sourceLabel}.`, facts: (detail.facts?.length ? detail.facts : pageFacts()).slice(0, 8), suggestedPrompt: detail.suggestedPrompt || "" },
      source: detail.source
    });
    navigate(url("tools/studio/index.html"));
  }


  function readList(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
    catch (error) { return []; }
  }

  function recordVisit() {
    if (!currentTool) return;
    try {
      const recent = readList(RECENT_KEY).filter(entry => entry.id !== currentTool.id);
      recent.unshift({ id: currentTool.id, title: currentTool.title, url: url(`tools/${currentTool.id}/index.html`), at: Date.now() });
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 8)));
    } catch (error) {                                }
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    if (typeof themeApply === "function") { themeApply(next); themeRemember(next); themeChartsRefresh(); }
    else document.documentElement.setAttribute("data-theme", next);
    document.dispatchEvent(new CustomEvent("sn:theme", { detail: next }));
  }


  function buildNav() {
    if (isStudio || document.querySelector(".sn-nav") || !catalog) return;
    const skip = document.createElement("a");
    skip.className = "sn-skip-link";
    skip.href = "#main";
    skip.textContent = "Skip to content";
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main";

    const nav = document.createElement("nav");
    nav.className = "sn-nav sn-scope";
    nav.setAttribute("aria-label", "Signal Noir");
    const links = catalog.navigation.filter(item => item.id !== "settings" && navVisible(item));
    nav.innerHTML = `<div class="sn-nav-inner">
      <a class="sn-brand" href="${url("index.html")}" aria-label="Signal Noir home"><span class="sn-brand-mark" aria-hidden="true">SN</span><span class="sn-brand-name">Signal <span>Noir</span></span></a>
      <div class="sn-nav-links">${links.filter(item => item.id !== "home").map(item => `<a class="sn-nav-link" href="${url(item.path)}" ${item.id === pageId ? 'aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`).join("")}</div>
      <div class="sn-nav-actions">
        ${accessUi() ? accessUi().workspaceButtonHtml() : ""}
        <a class="sn-mode-pill" href="${url("settings.html#privacy")}" data-sn-tip="Local mode: nothing leaves this device" data-sn-tip-pos="bottom"><span class="sn-dot" aria-hidden="true"></span><span class="sn-mode-label">Local</span><span class="sn-sr-only">mode, privacy settings</span></a>
        <button type="button" class="sn-nav-search" data-sn-command aria-label="Search tools and actions" aria-keyshortcuts="Control+K Meta+K">${icons.search}<span class="sn-nav-search-label">Search</span><span class="sn-kbd">⌘K</span></button>
        <button type="button" class="sn-btn sn-btn-ghost sn-btn-icon" data-sn-theme aria-label="Toggle light and dark theme">${icons.theme}</button>
        <a class="sn-btn sn-btn-ghost sn-btn-icon sn-nav-settings" href="${url("settings.html")}" aria-label="Settings" ${pageId === "settings" ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></a>
        <a class="sn-btn sn-btn-primary sn-btn-sm sn-nav-cta" href="${url("tools/studio/index.html")}">Open Studio</a>
        <button type="button" class="sn-btn sn-btn-ghost sn-btn-icon sn-nav-menu-btn" aria-expanded="false" aria-controls="sn-mobile-menu" aria-label="Open menu">${icons.menu}</button>
      </div>
    </div>`;
    const menu = document.createElement("div");
    menu.className = "sn-mobile-menu sn-scope";
    menu.id = "sn-mobile-menu";
    menu.innerHTML = catalog.navigation.filter(navVisible).map(item => `<a href="${url(item.path)}" ${item.id === pageId ? 'aria-current="page"' : ""}><span>${escapeHtml(item.label)}<br><small>${escapeHtml(item.description)}</small></span><span aria-hidden="true">→</span></a>`).join("");
    document.body.prepend(menu);
    document.body.prepend(nav);
    document.body.prepend(skip);

    nav.querySelector("[data-access-switcher]")?.addEventListener("click", () => accessUi()?.openSwitcher());
    nav.querySelector("[data-sn-command]").addEventListener("click", () => openCommandCenter());
    nav.querySelector("[data-sn-theme]").addEventListener("click", toggleTheme);
    const menuButton = nav.querySelector(".sn-nav-menu-btn");
    const closeMobileMenu = () => {
      menu.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open menu");
      menuButton.innerHTML = icons.menu;
      document.body.style.overflow = "";
    };
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menu.classList.contains("is-open")) { closeMobileMenu(); menuButton.focus(); }
    });
    matchMedia("(min-width: 901px)").addEventListener("change", event => { if (event.matches) closeMobileMenu(); });

    menuButton.addEventListener("click", () => {
      const open = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menuButton.innerHTML = open ? icons.close : icons.menu;
      document.body.style.overflow = open ? "hidden" : "";
    });
  }


  function gateToolPage() {
    if (!currentTool || !access || !accessUi()) return false;
    if (access.canUse("tools", currentTool.id)) return false;
    const required = access.requiredFor("tools", currentTool.id);
    accessUi().denyPage(required, { title: currentTool.title, backHref: url("tools/index.html"), backLabel: "Back to tools" });
    return true;
  }


  function decorateToolPage() {
    if (isStudio || document.body.classList.contains("sn-app")) return;

    document.body.classList.add("sn-tool-page");
    const header = document.querySelector("body > header");
    header?.classList.add("sn-tool-header");
    header?.querySelectorAll('a[href$="index.html"]').forEach(link => {
      if (/←|&larr;|Hub/.test(link.textContent)) { link.textContent = toolId ? "← All tools" : "← Home"; link.href = url(toolId ? "tools/index.html" : "index.html"); }
    });
    if (!currentTool || !header) return;

    const category = catalog.categories.find(item => item.id === currentTool.category);
    const crumb = document.createElement("div");
    crumb.className = "sn-tool-crumb";
    crumb.innerHTML = `<a href="${url("tools/index.html")}">Tools</a><span aria-hidden="true">/</span><a href="${url(`tools/index.html#${category?.id || ""}`)}">${escapeHtml(category?.label || "Utilities")}</a>`;
    header.firstElementChild?.prepend(crumb);

    const actions = document.createElement("div");
    actions.className = "sn-tool-actions";
    if (currentTool.accepts === "tabular" || typeof window.signalNoirToolContext === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sn-btn sn-btn-sm sn-btn-accent";
      button.innerHTML = 'Continue with Vanessa <span aria-hidden="true">→</span>';
      button.title = "Hand this work to Vanessa in Studio, with what you have here";
      button.addEventListener("click", () => openVanessa({ suggestedPrompt: window.signalNoirToolContext?.()?.suggestedPrompt || "" }));
      actions.appendChild(button);
    }
    header.appendChild(actions);

    document.addEventListener("change", event => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.type === "file" && input.files?.[0]) lastChosenFile = input.files[0];
    }, true);
  }

  async function renderWorkspaceBanner() {
    document.querySelector("[data-workspace-banner]")?.remove();
    if (!currentTool || currentTool.accepts !== "tabular") return;
    let record = null;
    try { record = await workspaceGet(); } catch (error) {                               }
    const banner = document.createElement("div");
    banner.className = "sn-workspace-banner sn-scope";
    banner.dataset.workspaceBanner = "true";
    banner.innerHTML = record
      ? `<div><span class="sn-eyebrow"><i></i>Workspace file</span><strong>${escapeHtml(record.name)}</strong><span class="sn-muted"> · ${humanSize(record.size)} · stored only in this browser</span></div><div class="sn-cluster"><button class="sn-btn sn-btn-sm" data-dh-use>Use in this tool</button><button class="sn-btn sn-btn-sm sn-btn-ghost" data-dh-clear>Clear</button></div>`
      : `<div><span class="sn-eyebrow"><i></i>No file yet</span><strong>Try this tool with safe sample data</strong><span class="sn-muted"> · or choose your own file below</span></div><div class="sn-cluster"><button class="sn-btn sn-btn-sm" data-dh-sample>Load sample data</button></div>`;
    const anchor = document.querySelector("body > header") || document.querySelector(".sn-nav");
    anchor?.insertAdjacentElement("afterend", banner);
    banner.querySelector("[data-dh-use]")?.addEventListener("click", () => loadIntoFirstInput(record));
    banner.querySelector("[data-dh-sample]")?.addEventListener("click", useSample);
    banner.querySelector("[data-dh-clear]")?.addEventListener("click", async () => { await workspaceClear(); await renderWorkspaceBanner(); toast("Workspace file cleared."); });
  }

  function progressiveControls() {
    Array.from(document.querySelectorAll("main section, main > div")).filter(node => {
      const heading = node.querySelector(":scope > h2, :scope > h3, :scope > h4");
      return heading && /advanced|options|settings|configuration/i.test(heading.textContent || "");
    }).forEach(node => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sn-btn sn-btn-sm sn-btn-ghost dh-advanced-toggle";
      button.textContent = "Show advanced controls";
      button.setAttribute("aria-expanded", "false");
      node.parentNode.insertBefore(button, node);
      node.classList.add("dh-advanced-collapsed");
      button.addEventListener("click", () => {
        const hidden = node.classList.toggle("dh-advanced-collapsed");
        button.textContent = hidden ? "Show advanced controls" : "Hide advanced controls";
        button.setAttribute("aria-expanded", String(!hidden));
      });
    });
  }


  function commandItems() {
    const pages = catalog ? catalog.navigation.filter(navVisible).map(item => ({ group: "Go to", title: item.label, description: item.description, icon: "↗", run: () => navigate(url(item.path)) })) : [];
    const tools = catalog ? catalog.tools.filter(tool => canUse("tools", tool.id)).map(tool => ({ group: "Tools", title: tool.title, description: tool.description, icon: tool.icon, keywords: tool.keywords.join(" "), run: () => navigate(url(`tools/${tool.id}/index.html`)) })) : [];
    const templates = catalog && can("vanessa.use") ? catalog.templates.map(template => ({ group: "Templates", title: template.title, description: template.description, icon: "T", run: () => continueInStudio({ prompt: template.prompt, intent: template.intent, template: template.id }) })) : [];
    const actions = [
      can("vanessa.use") && { group: "Actions", title: "Ask Vanessa", description: "Describe what you need and get a plan", icon: "V", keywords: "assistant help question", run: () => navigate(url("index.html#ask")) },
      can("vanessa.use") && { group: "Actions", title: "Continue with Vanessa in Studio", description: "Hand this page’s data and results to Vanessa", icon: "→", keywords: "studio handoff operator", run: () => openVanessa({}) },
      { group: "Actions", title: "Switch workspace", description: "Personal, or one of your organizations", icon: "◎", keywords: "organization team access profile", run: () => accessUi()?.openSwitcher() },
      { group: "Actions", title: "Open the demo project", description: "Sample retail data with a full Vanessa walkthrough", icon: "▶", keywords: "sample example tour", run: () => { handoff.set({ openDemo: true }); navigate(url("tools/studio/index.html")); } },
      { group: "Actions", title: "Toggle light / dark theme", description: "Switch the appearance of every page", icon: "◐", run: toggleTheme },
      { group: "Actions", title: "Print or save as PDF", description: "Export the current view with your browser", icon: "⎙", run: () => window.print() }
    ].filter(Boolean);
    if (currentTool?.accepts === "tabular") {
      actions.unshift({ group: "This tool", title: "Continue in Studio", description: "Move this file into a project and keep working with Vanessa", icon: "→", run: () => continueInStudio({}) });
      actions.unshift({ group: "This tool", title: "Load sample data", description: "Try this tool without finding a file", icon: "+", run: useSample });
    }
    if (installPrompt) actions.push({ group: "Actions", title: "Install Signal Noir", description: "Use it like a desktop app, offline-ready", icon: "＋", run: promptInstall });
    return [...actions, ...pages, ...templates, ...tools];
  }


  let projectWork = null;
  async function loadProjectWork() {
    if (projectWork) return projectWork;
    try {
      const store = window.SignalNoir?.projects;
      projectWork = store?.recentWork ? await store.recentWork(200) : [];
    } catch (error) { projectWork = []; }
    return projectWork;
  }

  function openCommandCenter(initial = "") {
    document.querySelector(".sn-modal-shell[data-command]")?.remove();
    const previous = document.activeElement;
    const shell = document.createElement("div");
    shell.className = "sn-modal-shell sn-scope";
    shell.dataset.command = "";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "Search Signal Noir");
    shell.innerHTML = `<div class="sn-modal sn-command"><div class="sn-command-input-row">${icons.search}<input class="sn-command-input" placeholder="Search tools, pages, templates and actions…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="sn-command-list" autocomplete="off"><span class="sn-kbd">Esc</span></div><div class="sn-command-list" id="sn-command-list" role="listbox"></div><div class="sn-command-foot"><span><span class="sn-kbd">↑</span><span class="sn-kbd">↓</span> move</span><span><span class="sn-kbd">↵</span> open</span><span><span class="sn-kbd">esc</span> close</span></div></div>`;
    document.body.appendChild(shell);
    const input = shell.querySelector("input");
    const list = shell.querySelector(".sn-command-list");
    const all = commandItems();
    let matches = [];
    let index = 0;
    const close = () => { shell.remove(); previous?.focus?.(); };
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const work = q && projectWork ? projectWork
        .filter(item => `${item.title} ${item.detail || ""}`.toLowerCase().includes(q))
        .slice(0, 8)
        .map(item => ({ group: "Project work", title: item.title, description: `${item.kind} · ${item.projectName}`, icon: "◈", run: () => { handoff.set({ openProject: item.projectId }); navigate(url("tools/studio/index.html")); } }))
        : [];
      matches = [...work, ...(q ? all.filter(item => `${item.title} ${item.description} ${item.keywords || ""} ${item.group}`.toLowerCase().includes(q)) : all)].slice(0, 40);
      index = Math.min(index, Math.max(matches.length - 1, 0));
      let group = "";
      list.innerHTML = matches.length ? matches.map((item, i) => {
        const heading = item.group !== group ? `<div class="sn-command-group" role="presentation">${escapeHtml(item.group)}</div>` : "";
        group = item.group;
        return `${heading}<button type="button" class="sn-command-item" role="option" id="sn-cmd-${i}" aria-selected="${i === index}" data-index="${i}"><span class="sn-card-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span></button>`;
      }).join("") : '<div class="sn-empty" style="margin:8px"><div class="sn-empty-title">No matches</div><div class="sn-empty-text">Try a tool name, a task like “merge files”, or ask Vanessa from the home page.</div></div>';
      input.setAttribute("aria-activedescendant", matches.length ? `sn-cmd-${index}` : "");
      list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    };
    const run = i => { const item = matches[i]; if (!item) return; close(); item.run(); };
    list.addEventListener("click", event => { const button = event.target.closest("[data-index]"); if (button) run(Number(button.dataset.index)); });
    input.addEventListener("input", () => { index = 0; draw(); });
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") { event.preventDefault(); index = Math.min(index + 1, matches.length - 1); draw(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); index = Math.max(index - 1, 0); draw(); }
      else if (event.key === "Enter") { event.preventDefault(); run(index); }
      else if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "Tab") event.preventDefault();
    });
    shell.addEventListener("click", event => { if (event.target === shell) close(); });
    input.value = initial;
    draw();
    input.focus();
    loadProjectWork().then(() => { if (document.body.contains(shell)) draw(); });
  }


  function navigate(href) {
    if (reducedMotion()) { location.href = href; return; }
    document.body.classList.add("sn-page-leaving");
    setTimeout(() => { location.href = href; }, 130);
  }

  function navigationExperience() {
    document.addEventListener("click", event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, location.href);
      if (target.origin !== location.origin || target.href === location.href || (target.pathname === location.pathname && target.hash)) return;
      if (!/^https?:$/.test(target.protocol)) return;
      event.preventDefault();
      navigate(target.href);
    });
    addEventListener("pageshow", () => document.body.classList.remove("sn-page-leaving"));
    addEventListener("offline", () => toast("You’re offline. Cached Signal Noir pages still work."));
    addEventListener("online", () => toast("Connection restored."));
  }

  function revealOnScroll() {
    const items = Array.from(document.querySelectorAll(".sn-reveal:not(.is-visible)"));
    if (!items.length) return;
    if (reducedMotion() || !("IntersectionObserver" in window)) { items.forEach(item => item.classList.add("is-visible")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }), { rootMargin: "0px 0px -8% 0px", threshold: .06 });
    items.forEach(item => observer.observe(item));
  }


  async function promptInstall() {
    const prompt = installPrompt;
    installPrompt = null;
    if (!prompt) return toast("Use your browser’s install option to add Signal Noir.");
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") toast("Signal Noir installed.");
  }

  function registerPwa() {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register(url("service-worker.js")).catch(() => {});
    }
    addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; });
    addEventListener("appinstalled", () => { installPrompt = null; toast("Signal Noir is ready from your apps."); });
  }

  function applyBrandIcon() {
    document.querySelectorAll('link[rel~="icon"]').forEach(icon => icon.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = url("signal-noir-icon.svg");
    document.head.appendChild(icon);
  }

  function keyboardShortcuts() {
    document.addEventListener("keydown", event => {
      if (isStudio) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openCommandCenter(); }
    });
  }

  async function init() {
    applyBrandIcon();
    accessUi()?.renderPreviewBanner();
    buildNav();
    if (gateToolPage()) { document.dispatchEvent(new CustomEvent("sn:platform-ready")); return; }
    decorateToolPage();
    recordVisit();
    progressiveControls();
    keyboardShortcuts();
    navigationExperience();
    registerPwa();
    revealOnScroll();
    document.dispatchEvent(new CustomEvent("sn:platform-ready"));
    await renderWorkspaceBanner();
  }

  const api = { toast, url, rootUrl: rootUrl.href, pageId, toolId, escapeHtml, humanSize, handoff, continueInStudio, openVanessa, datasetToCsv, openCommandCenter, toggleTheme, navigate, revealOnScroll, promptInstall, canInstall: () => Boolean(installPrompt), readList, can, canUse, workspace: { get: workspaceGet, set: workspaceSet, clear: workspaceClear, stashFiles, takeStash, makeFile, useSample, sampleFile, loadIntoFirstInput } };
  window.SignalNoir = window.SignalNoir || {};
  window.SignalNoir.platform = api;
  window.SignalNoir.vanessa = { open: openVanessa };
  window.DataHubWorkspace = { get: workspaceGet, set: workspaceSet, clear: workspaceClear, useSample, loadIntoFirstInput };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
