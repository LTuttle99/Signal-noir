(function () {
  "use strict";

  const DB_NAME = "datahub_studio";
  const STORE = "projects";
  const ACTIVE_KEY = "datahub_studio_active";
  const MAX_ROWS = 10000;
  const SCHEMA_VERSION = 3;
  const state = { projects: [], project: null, saveError: null, activeView: "vanessa", dirty: false };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const stepDefinitions = [
    { id: "clean", name: "Clean values", detail: "Trim text and remove fully blank rows" },
    { id: "dedupe", name: "Remove duplicates", detail: "Keep one copy of identical rows" },
    { id: "filter", name: "Require complete rows", detail: "Remove rows missing important values" },
    { id: "derive", name: "Create calculated field", detail: "Add a useful calculated column" },
    { id: "sort", name: "Sort records", detail: "Order by the first measurable field" },
    { id: "quality", name: "Run quality checks", detail: "Evaluate the project rules" },
    { id: "analyze", name: "Analyze patterns", detail: "Profile measures and categories" },
    { id: "dashboard", name: "Build dashboard", detail: "Open the automatic dashboard tool" },
    { id: "report", name: "Generate report", detail: "Create an executive narrative" }
  ];

  const recipes = [
    { name: "Monthly reporting", description: "Clean, analyze, and produce an executive report", steps: ["clean", "dedupe", "quality", "analyze", "report"] },
    { name: "Data quality audit", description: "Profile, standardize, deduplicate, and grade", steps: ["clean", "dedupe", "quality"] },
    { name: "Dashboard preparation", description: "Prepare data and open dashboard creation", steps: ["clean", "derive", "analyze", "dashboard"] },
    { name: "Survey analysis", description: "Clean responses, analyze patterns, and report", steps: ["clean", "analyze", "report"] }
  ];

  const sourceGuides = {
    files: { title: "Excel, CSV, or JSON file", short: "Files on your computer", privacy: "Private: the browser reads the file locally. It is not uploaded to Signal Noir.", action: "Choose files", actionType: "files", steps: [
      ["Prepare the file", "Put field names in one header row. Avoid merged cells, password protection, and decorative titles above the table when possible."],
      ["Choose the file", "Use the file picker or drag several files into the Data catalog. CSV, Excel, JSON, TSV, and text files are supported."],
      ["Confirm the sheet", "If an Excel workbook contains multiple sheets, Signal Noir asks you to choose one or combine them. Review the detected columns before analysis."],
      ["Save the project", "The parsed rows remain in this browser’s project storage so the workflow can be reopened and rerun later."]
    ]},
    folder: { title: "Folder or ZIP archive", short: "Many files at once", privacy: "Private: compatible files are unpacked and parsed inside the browser.", action: "Choose a folder", actionType: "folder", steps: [
      ["Organize the export", "Keep related CSV, JSON, or text files together. A ZIP may contain nested folders; incompatible files are skipped."],
      ["Choose the folder or ZIP", "Use Choose folder for an unpacked directory, or drag a .zip file into the catalog."],
      ["Review relationships", "Studio compares column names across files and points out fields that may join them, such as customer_id or month."],
      ["Select the active dataset", "Choose which file begins the workflow. Other files remain available for comparison and documentation."]
    ]},
    google: { title: "Google Sheets", short: "A public or link-readable sheet", privacy: "Important: the sheet must be readable without signing in. Anyone with its link may be able to view it.", action: "Open connection box", actionType: "google", steps: [
      ["Open sharing settings", "In Google Sheets, choose Share. Under General access, select Anyone with the link and set the role to Viewer."],
      ["Copy the normal sheet link", "Copy the URL from the browser or the Share dialog. Keep the gid in the URL if you need a specific tab."],
      ["Paste it into Studio", "Choose Public Google Sheet in the connection box, paste the link, and select Connect."],
      ["Refresh behavior", "Studio saves the public export URL and refreshes its local snapshot whenever the project opens."]
    ]},
    url: { title: "CSV or JSON web address", short: "A public API or download URL", privacy: "Studio makes a direct browser request to the address. The source server will see the browser request, but Signal Noir does not relay it.", action: "Open connection box", actionType: "url", steps: [
      ["Find a direct data URL", "Use an address that returns CSV text, a JSON array, or an object containing records—not a webpage that happens to show data."],
      ["Check browser access", "The server must allow cross-origin browser requests (CORS). Opening the URL in a new tab should show or download the raw data."],
      ["Connect it", "Choose CSV or JSON URL, paste the complete https:// address, and select Connect."],
      ["Keep a last-good copy", "Studio refreshes on open. If a later refresh fails, it retains the most recent successful local snapshot."]
    ]},
    database: { title: "PostgreSQL, SQL Server, or MySQL", short: "Private database", privacy: "Never put database passwords in this static site. Credentials belong on a protected server-side gateway.", action: "Copy gateway checklist", actionType: "database", steps: [
      ["Create a read-only database account", "Grant access only to the approved views or tables. Do not use an administrator or write-capable credential."],
      ["Build an HTTPS gateway", "Create a small authenticated API that runs approved queries and returns CSV or JSON. Store the database credential as a server environment secret."],
      ["Add authentication and CORS", "Require your organization’s login or a short-lived token, restrict allowed origins, rate-limit requests, and log access without logging returned data."],
      ["Connect the gateway URL", "Once the endpoint exists, use CSV or JSON URL in Studio. A GitHub Pages site cannot safely connect directly to database ports."]
    ]},
    airtable: { title: "Airtable", short: "Base, table, or view", privacy: "Do not paste an Airtable personal access token into Signal Noir. Use a published view or a protected gateway.", action: "Copy Airtable checklist", actionType: "airtable", steps: [
      ["Choose the access method", "For non-sensitive data, create a read-only shared view. For private data, use an authenticated server-side gateway."],
      ["Limit the fields", "Expose only the table, view, and fields needed for analysis. Remove attachments or personal fields that are unnecessary."],
      ["Return CSV or JSON", "Have the shared-view download or gateway return a consistent table. Stable field names make repeatable workflows reliable."],
      ["Use the web connection", "Paste the final public CSV or gateway URL into the CSV or JSON URL connection option."]
    ]},
    microsoft: { title: "SharePoint or OneDrive", short: "Microsoft-hosted files", privacy: "Public download links are accessible to anyone who has them. Private Microsoft 365 data requires an OAuth-enabled gateway.", action: "Copy Microsoft checklist", actionType: "microsoft", steps: [
      ["Decide public versus private", "A public file can use a direct download URL. Organization-only files need a server app registered with Microsoft Entra ID."],
      ["For a private connection", "Use delegated or application permissions limited to the required site and files. Keep client secrets on the server."],
      ["Expose a safe data endpoint", "The gateway should download the workbook through Microsoft Graph and return only the selected table as CSV or JSON."],
      ["Connect or upload", "Connect the gateway URL for live refreshes, or download the Excel file and add it locally for the simplest private workflow."]
    ]},
    sqlite: { title: "SQLite or Access database", short: "Desktop database file", privacy: "The safest route is a local export. The original database file never needs to leave your computer.", action: "Choose exported files", actionType: "files", steps: [
      ["Choose the tables", "Identify the tables or saved queries needed for the project. Include a stable key when files must be joined."],
      ["Export each table", "Export to CSV or Excel with column names included. For Access, use External Data → Excel or Text File."],
      ["Load the exports together", "Add every exported table to the Data catalog in one selection or folder."],
      ["Review suggested joins", "Studio highlights shared column names. Confirm that the suggested field is truly the same identifier in both tables."]
    ]}
  };

  function uid(prefix = "id") { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
  function nowLabel() { return new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function download(name, content, type = "application/json") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
  function slug(value) { return String(value || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function toast(message) { const node = $("#studio-toast"); node.textContent = message; node.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 3000); }
  function markDirty() { state.dirty = true; $("#save-project-btn").textContent = "Save •"; }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function dbPut(project) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(project);
      tx.oncomplete = () => { db.close(); resolve(project); };
      tx.onerror = () => reject(tx.error);
    });
  }

  function blankProject(name = "Untitled project") {
    return { id: uid("project"), name, goal: "", createdAt: Date.now(), updatedAt: Date.now(), datasets: [], activeDatasetId: null, steps: [], rules: [], report: null, schedules: [], customTools: [], connections: [], members: [], comments: [], versions: [], activities: [{ text: "Project created", at: nowLabel() }], runs: [], mappings: [], joins: [], glossary: [], metrics: [], contracts: [], anomalies: [], privacyFindings: [], approvals: [], dashboardPlans: [], analystPlans: [], cleaningSuggestions: [], changeHistory: [], stories: [], reportDesigns: [], chatMessages: [], chatChannels: [{ id: "general", name: "General" }, { id: "analysis", name: "Analysis" }, { id: "quality", name: "Data quality" }, { id: "decisions", name: "Decisions" }], tasks: [], decisions: [], issues: [], annotations: [], canvasItems: [], notifications: [], alertRules: [], deliveries: [], dataRequests: [], forms: [], formSubmissions: [], branches: [], auditEvents: [], agentReviews: [], meetings: [], knowledgeBase: [], metricRegistry: [], portalAssets: [], installedConnectors: [], savedViews: [], evidenceThreads: [], datasetBriefings: [], dataQuestions: [], pinnedInsights: [], dashboardWidgets: [], calculatedFields: [], findings: [], vanessaRuns: [], outputs: [], mode: "local", isDemo: false, schemaVersion: SCHEMA_VERSION, collaborationConfig: null, projectStatus: "Draft", readiness: null, learningMode: false, branding: null };
  }

  function normalizeProject(project) {
    for (const key of ["datasets", "steps", "rules", "schedules", "customTools", "connections", "members", "comments", "versions", "activities", "runs", "mappings", "joins", "glossary", "metrics", "contracts", "anomalies", "privacyFindings", "approvals", "dashboardPlans", "analystPlans", "cleaningSuggestions", "changeHistory", "stories", "reportDesigns", "chatMessages", "chatChannels", "tasks", "decisions", "issues", "annotations", "canvasItems", "notifications", "alertRules", "deliveries", "dataRequests", "forms", "formSubmissions", "branches", "auditEvents", "agentReviews", "meetings", "knowledgeBase", "metricRegistry", "portalAssets", "installedConnectors", "savedViews", "evidenceThreads", "datasetBriefings", "dataQuestions", "pinnedInsights", "dashboardWidgets", "calculatedFields", "findings", "vanessaRuns", "outputs"]) if (!Array.isArray(project[key])) project[key] = [];

    if (!["local", "private-cloud", "team"].includes(project.mode)) project.mode = "local";
    project.isDemo = Boolean(project.isDemo);


    window.SignalNoir?.artifacts?.shape(project);
    project.schemaVersion = SCHEMA_VERSION;
    if (!project.name) project.name = "Untitled project";
    if (!project.projectStatus) project.projectStatus = "Draft";
    if (!project.chatChannels.length) project.chatChannels = [{ id: "general", name: "General" }, { id: "analysis", name: "Analysis" }, { id: "quality", name: "Data quality" }, { id: "decisions", name: "Decisions" }];
    return project;
  }


  function addActivity(text, detail = {}) {
    const artifacts = window.SignalNoir?.artifacts;
    if (artifacts) artifacts.recordActivity(state.project, { text, ...detail });
    else { state.project.activities.unshift({ text, at: nowLabel() }); state.project.activities = state.project.activities.slice(0, 30); }
    markDirty();
  }

  function activeDataset() { return state.project?.datasets.find(item => item.id === state.project.activeDatasetId) || state.project?.datasets[0] || null; }


  async function saveProject(silent = false) {
    if (!state.project) return { ok: false, reason: "no-project" };
    const goal = $("#project-goal");
    if (goal) state.project.goal = goal.value;
    state.project.updatedAt = Date.now();
    try {
      await dbPut(state.project);
    } catch (error) {
      state.saveError = describeSaveFailure(error);
      window.dispatchEvent(new CustomEvent("datahub:save-failed", { detail: state.saveError }));
      console.error("[storage] save failed", { projectId: state.project.id, code: state.saveError.code });
      if (!silent) toast(state.saveError.message, { timeout: 8000 });
      return { ok: false, ...state.saveError };
    }
    state.saveError = null;
    const index = state.projects.findIndex(item => item.id === state.project.id);
    if (index >= 0) state.projects[index] = state.project; else state.projects.push(state.project);
    try { localStorage.setItem(ACTIVE_KEY, state.project.id); } catch (error) {                                                                      }
    state.dirty = false;
    $("#save-project-btn").textContent = "Save";
    renderProjectSelect();
    window.dispatchEvent(new CustomEvent("datahub:saved"));
    if (!silent) toast("Project saved locally.");
    return { ok: true };
  }

  function describeSaveFailure(error) {
    const name = error?.name || "";
    if (name === "QuotaExceededError" || /quota/i.test(error?.message || "")) {
      return { code: "quota", title: "This browser is out of storage",
        message: "Out of browser storage — your changes are not saved. Export this project, then delete data you no longer need." };
    }
    if (name === "InvalidStateError" || /IndexedDB unavailable|not allowed/i.test(error?.message || "")) {
      return { code: "unavailable", title: "Local storage is blocked",
        message: "This browser is blocking local storage, so nothing can be saved. Private windows often do this. Export your work to keep it." };
    }
    return { code: "unknown", title: "Your changes could not be saved",
      message: "Your changes could not be saved to this browser. Export the project to avoid losing work." };
  }


  function visibleProjects() {
    const access = window.SignalNoir?.access;
    return access ? access.projectAccess.visible(state.projects) : state.projects;
  }

  function renderProjectSelect() {
    const select = $("#project-select");
    const list = visibleProjects().slice().sort((a, b) => b.updatedAt - a.updatedAt);
    select.innerHTML = list.map(item => `<option value="${item.id}" ${item.id === state.project?.id ? "selected" : ""}>${escapeHtml(item.name)}${item.isDemo ? " (sample data)" : ""}</option>`).join("");
    const access = window.SignalNoir?.access;
    $("#new-project-btn").hidden = Boolean(access) && !access.can("projects.create");
  }

  function renderAll() {
    if (!state.project) return;
    $("#overview-title").textContent = state.project.name;
    $("#project-goal").value = state.project.goal || "";
    renderProjectSelect(); renderMetrics(); renderActivities(); renderRecipes(); renderSourceGuideOptions(); renderDatasets(); renderWorkflow(); renderDictionary(); renderRules(); renderReport(); renderSchedules(); renderCollaboration(); renderCustomTools(); renderAi();
    window.dispatchEvent(new CustomEvent("datahub:project-render"));
  }

  function renderSourceGuideOptions() {
    const target = $("#source-guide-options"); if (!target) return;
    target.innerHTML = Object.entries(sourceGuides).map(([id, guide]) => `<button class="source-option" data-source-guide="${id}">${escapeHtml(guide.title)}</button>`).join("");
    $$('[data-source-guide]').forEach(button => button.onclick = () => openSourceGuide(button.dataset.sourceGuide, 0));
  }

  function guideFromQuestion(question) {
    const value = question.toLowerCase();
    if (/google|sheet/.test(value)) return "google";
    if (/postgres|sql server|mysql|oracle|database|warehouse|snowflake/.test(value)) return "database";
    if (/airtable/.test(value)) return "airtable";
    if (/sharepoint|one.?drive|microsoft 365/.test(value)) return "microsoft";
    if (/sqlite|access|\.db|desktop database/.test(value)) return "sqlite";
    if (/api|url|website|json endpoint|csv link/.test(value)) return "url";
    if (/folder|zip|many files|multiple files/.test(value)) return "folder";
    return "files";
  }

  function openSourceGuide(id, stepIndex) {
    const guide = sourceGuides[id]; if (!guide) return;
    const index = Math.max(0, Math.min(stepIndex, guide.steps.length - 1)); const step = guide.steps[index];
    dialog(`<span class="eyebrow">Data source setup</span><h2>${escapeHtml(guide.title)}</h2><p class="muted">${escapeHtml(guide.short)}</p><div class="guide-progress">${guide.steps.map((_, position) => `<span class="${position <= index ? "active" : ""}"></span>`).join("")}</div><div class="guide-step"><strong>Step ${index + 1}: ${escapeHtml(step[0])}</strong><p>${escapeHtml(step[1])}</p></div><div class="guide-privacy"><strong>Privacy and permissions:</strong> ${escapeHtml(guide.privacy)}</div><div class="guide-actions"><button class="button ghost" data-guide-back ${index === 0 ? "disabled" : ""}>Back</button>${index < guide.steps.length - 1 ? '<button class="button primary" data-guide-next>Next step</button>' : `<button class="button primary" data-guide-action>${escapeHtml(guide.action)}</button>`}</div>`);
    $("[data-guide-back]").onclick = () => openSourceGuide(id, index - 1);
    $("[data-guide-next]")?.addEventListener("click", () => openSourceGuide(id, index + 1));
    $("[data-guide-action]")?.addEventListener("click", () => finishSourceGuide(guide));
  }

  async function finishSourceGuide(guide) {
    if (guide.actionType === "files") { closeDialog(); $("#studio-file-input").click(); return; }
    if (guide.actionType === "folder") { closeDialog(); $("#studio-folder-input").click(); return; }
    if (guide.actionType === "google" || guide.actionType === "url") {
      closeDialog(); showView("data"); $("#connector-type").value = guide.actionType === "google" ? "google" : "http"; $("#connector-url").focus(); $("#connector-url").scrollIntoView({ behavior: "smooth", block: "center" }); return;
    }
    const checklist = guide.steps.map((step, index) => `${index + 1}. ${step[0]} — ${step[1]}`).join("\n");
    try { await navigator.clipboard.writeText(`${guide.title}\n\n${checklist}\n\nPrivacy: ${guide.privacy}`); toast("Setup checklist copied."); }
    catch (error) { toast("Checklist ready—select and copy it from the guide."); }
    closeDialog();
  }

  function renderMetrics() {
    const dataset = activeDataset();
    const metrics = [
      [state.project.datasets.length, "Datasets"],
      [state.project.datasets.reduce((sum, item) => sum + item.rows.length, 0).toLocaleString(), "Total rows"],
      [state.project.steps.length, "Workflow steps"],
      [state.project.rules.length, "Quality rules"]
    ];
    $("#overview-metrics").innerHTML = metrics.map(([value, label]) => `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
    $("#workflow-source-name").textContent = dataset ? dataset.name : "Choose a dataset";
  }

  function renderActivities() {
    $("#activity-list").innerHTML = state.project.activities.length ? state.project.activities.slice(0, 8).map(item => `<div class="activity-item"><i></i><div><strong>${escapeHtml(item.text)}</strong><span>${escapeHtml(item.at)}</span></div></div>`).join("") : '<p class="muted">No activity yet.</p>';
  }

  function renderRecipes() {
    $("#recipe-gallery").innerHTML = recipes.map((recipe, index) => `<button type="button" class="recipe-card" data-recipe="${index}" aria-label="${escapeHtml(`Use the ${recipe.name} recipe`)}"><strong>${escapeHtml(recipe.name)}</strong><span>${escapeHtml(recipe.description)}</span></button>`).join("");
    $$('[data-recipe]').forEach(button => button.onclick = () => applyRecipe(recipes[Number(button.dataset.recipe)]));
  }

  function applyRecipe(recipe) {
    state.project.steps = recipe.steps.map(type => ({ id: uid("step"), type, ...stepDefinitions.find(item => item.id === type) }));
    addActivity(`${recipe.name} recipe added`); renderAll(); showView("workflow");
  }

  function inferType(values) {
    const present = values.filter(value => value !== null && value !== undefined && String(value).trim() !== "");
    if (!present.length) return "empty";
    const numeric = present.filter(value => Number.isFinite(Number(String(value).replace(/[$,%]/g, "")))).length / present.length;
    const dates = present.filter(value => !Number.isNaN(Date.parse(value)) && /[-/:]|\d{4}/.test(String(value))).length / present.length;
    if (numeric > .85) return "number";
    if (dates > .8) return "date";
    if (new Set(present.map(String)).size / present.length < .25) return "category";
    return "text";
  }

  function profileDataset(dataset) {
    return dataset.columns.map(column => {
      const values = dataset.rows.map(row => row[column]);
      const present = values.filter(value => value !== null && value !== undefined && String(value).trim() !== "");
      const type = inferType(values);
      const unique = new Set(present.map(value => String(value))).size;
      const name = column.toLowerCase();
      const role = /(^|_)id$|key|code/.test(name) ? "Identifier" : type === "date" ? "Timeline" : type === "number" ? "Measure" : type === "category" ? "Dimension" : "Description";
      return { column, type, complete: dataset.rows.length ? present.length / dataset.rows.length : 0, unique, example: present[0] ?? "—", role };
    });
  }

  async function parseOneFile(file) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      if (typeof JSZip === "undefined") throw new Error("ZIP support did not load.");
      const zip = await JSZip.loadAsync(file); const nested = [];
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/\.(csv|tsv|txt|json)$/i.test(entry.name)) continue;
        const blob = await entry.async("blob"); nested.push(new File([blob], entry.name.split("/").pop(), { type: blob.type }));
      }
      const output = []; for (const child of nested) output.push(...await parseOneFile(child)); return output;
    }
    const parsed = await parseFileToRows(file);
    return [{ id: uid("data"), name: file.name, columns: parsed.columns || [], rows: (parsed.rows || []).slice(0, MAX_ROWS), originalRowCount: (parsed.rows || []).length, addedAt: Date.now(), source: "upload" }];
  }


  function importWarnings(dataset) {
    const warnings = [];
    const rows = dataset.rows || [];
    const columns = dataset.columns || [];
    if (!rows.length) { warnings.push("It has no rows, only headers."); return warnings; }
    columns.forEach(column => {
      const values = rows.map(row => row[column]).filter(value => value !== "" && value != null);
      if (!values.length) { warnings.push(`${column} is empty in every row.`); return; }
      const numeric = values.filter(value => Number.isFinite(Number(String(value).replace(/[$,%\s]/g, ""))));


      if (numeric.length >= values.length * .8 && numeric.length < values.length) {
        warnings.push(`${column} contains ${values.length - numeric.length} non-numeric value${values.length - numeric.length === 1 ? "" : "s"}.`);
      }
      const blank = rows.length - values.length;
      if (blank > rows.length * .3) warnings.push(`${column} is blank in ${Math.round(blank / rows.length * 100)}% of rows.`);
    });
    return warnings.slice(0, 6);
  }

  function reportImport(added, failures) {
    if (!added.length && failures.length) {
      dialog(`<span class="eyebrow">Import failed</span><h2>Nothing could be read</h2>
        <div class="sn-stack" style="--sn-stack-gap:8px;margin-top:16px">${failures.map(item => `<div class="sn-callout sn-callout-warning"><span aria-hidden="true">⚠</span><span><strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.reason)}</span></div>`).join("")}</div>
        <div class="action-row" style="justify-content:flex-end;margin-top:18px"><button type="button" class="button primary" data-cancel>Close</button></div>`);
      $("#dialog-content [data-cancel]").onclick = closeDialog;
      return;
    }
    const rows = added.reduce((sum, dataset) => sum + (dataset.rows || []).length, 0);
    const warnings = added.flatMap(dataset => importWarnings(dataset).map(text => `${dataset.name}: ${text}`));
    const empty = added.filter(dataset => !(dataset.rows || []).length);
    if (!warnings.length && !failures.length && !empty.length) {
      toast(`Imported ${added.length === 1 ? added[0].name : `${added.length} files`} · ${rows.toLocaleString()} rows.`);
      return;
    }
    dialog(`<span class="eyebrow">Import complete</span><h2>${added.length} file${added.length === 1 ? "" : "s"} imported</h2>
      <p class="muted">${rows.toLocaleString()} rows · ${added.reduce((sum, dataset) => sum + (dataset.columns || []).length, 0)} columns${warnings.length ? ` · ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}</p>
      ${failures.length ? `<div class="sn-stack" style="--sn-stack-gap:8px;margin-top:16px">${failures.map(item => `<div class="sn-callout sn-callout-warning"><span aria-hidden="true">⚠</span><span><strong>${escapeHtml(item.name)} could not be read.</strong><br>${escapeHtml(item.reason)}</span></div>`).join("")}</div>` : ""}
      ${warnings.length ? `<h3 class="sn-h4" style="margin-top:18px">Worth checking</h3><ul class="run-warnings">${warnings.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>` : ""}
      <div class="action-row" style="justify-content:flex-end;margin-top:18px"><button type="button" class="button primary" data-cancel>Got it</button></div>`);
    $("#dialog-content [data-cancel]").onclick = closeDialog;
  }

  async function addFiles(files) {
    if (!files.length) return [];
    toast(`Reading ${files.length} file${files.length === 1 ? "" : "s"}…`);
    const added = [];
    const failures = [];


    for (const file of files) {
      try {
        const parsed = await parseOneFile(file);
        state.project.datasets.push(...parsed);
        added.push(...parsed);
      } catch (error) {
        failures.push({ name: file.name, reason: error?.message || "The file could not be read." });
        window.SignalNoir?.errors?.log("import-failed", { file: file.name, message: error?.message });
      }
    }
    if ((!state.project.activeDatasetId || !activeDataset()) && added[0]) state.project.activeDatasetId = added[0].id;
    if (added.length) addActivity(`${added.length} source file${added.length === 1 ? "" : "s"} added`, { type: "data-imported" });


    const ops = window.SignalNoir?.operations;
    let triggered = [];
    if (ops && added.length) {
      try { triggered = added.flatMap(dataset => ops.onDataArrival(state.project, dataset.id)); }
      catch (error) { console.error("[operations] data-arrival trigger failed", error); }
    }
    renderAll();
    if (added.length) await saveProject(true);
    reportImport(added, failures);
    if (triggered.length) toast(`${triggered.length} automation${triggered.length === 1 ? "" : "s"} ran on the new data.`);
    return added;
  }

  function relationshipSuggestions() {
    const suggestions = [];
    const sets = state.project.datasets.map(item => new Set(item.columns.map(column => column.toLowerCase())));
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
      const shared = [...sets[i]].filter(column => sets[j].has(column));
      if (shared.length) suggestions.push(`${state.project.datasets[i].name} and ${state.project.datasets[j].name} share ${shared.slice(0, 3).join(", ")}`);
    }
    return suggestions;
  }

  function renderDatasets() {
    const container = $("#dataset-list");
    const suggestions = relationshipSuggestions();
    $("#relationship-suggestions").hidden = !suggestions.length;
    $("#relationship-suggestions").innerHTML = suggestions.length ? `<strong>Possible relationships:</strong> ${escapeHtml(suggestions.join(" · "))}` : "";
    container.innerHTML = state.project.datasets.length ? state.project.datasets.map(dataset => `<article class="dataset-card"><span class="badge ${dataset.id === state.project.activeDatasetId ? "good" : ""}">${dataset.id === state.project.activeDatasetId ? "Active" : escapeHtml(dataset.source || "file")}</span><h3 title="${escapeHtml(dataset.name)}">${escapeHtml(dataset.name)}</h3><p>${dataset.columns.slice(0, 4).map(escapeHtml).join(" · ")}${dataset.columns.length > 4 ? "…" : ""}</p><div class="mini-stats"><div><strong>${dataset.rows.length.toLocaleString()}</strong><span>Rows</span></div><div><strong>${dataset.columns.length}</strong><span>Columns</span></div></div><div class="dataset-actions"><button class="icon-button" data-activate="${dataset.id}">Use</button><button class="icon-button" data-preview="${dataset.id}">Preview</button><button class="icon-button" data-remove="${dataset.id}">Remove</button></div></article>`).join("") : '<div class="report-empty"><div><strong>No datasets yet</strong><p>Drop files above or load the sample project.</p></div></div>';
    $$('[data-activate]').forEach(button => button.onclick = () => { state.project.activeDatasetId = button.dataset.activate; addActivity("Active dataset changed"); renderAll(); });
    $$('[data-remove]').forEach(button => button.onclick = () => { state.project.datasets = state.project.datasets.filter(item => item.id !== button.dataset.remove); if (!activeDataset()) state.project.activeDatasetId = state.project.datasets[0]?.id || null; addActivity("Dataset removed"); renderAll(); });
    $$('[data-preview]').forEach(button => button.onclick = () => previewDataset(state.project.datasets.find(item => item.id === button.dataset.preview)));
  }

  function previewDataset(dataset) {
    const rows = dataset.rows.slice(0, 8);
    dialog(`<span class="eyebrow">Data preview</span><h2>${escapeHtml(dataset.name)}</h2><div class="table-shell"><table><thead><tr>${dataset.columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${dataset.columns.map(column => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
  }

  function renderWorkflow() {
    $("#step-library").innerHTML = stepDefinitions.map(step => `<button type="button" class="step-button" data-add-step="${step.id}" aria-label="${escapeHtml(`Add step: ${step.name}`)}"><strong>${escapeHtml(step.name)}</strong><br><span>${escapeHtml(step.detail)}</span></button>`).join("");
    $$('[data-add-step]').forEach(button => button.onclick = () => addStep(button.dataset.addStep));
    $("#workflow-nodes").innerHTML = state.project.steps.length ? state.project.steps.map((step, index) => `<article class="workflow-node"><strong>${index + 1}. ${escapeHtml(step.name)}</strong><p>${escapeHtml(step.detail)}</p><div class="node-actions"><button data-up="${index}" title="Move up">↑</button><button data-down="${index}" title="Move down">↓</button><button data-delete-step="${index}" title="Remove">×</button></div></article>`).join("") : '<div class="report-empty" style="min-height:290px"><div><strong>No steps yet</strong><p>Choose a recipe or add steps from the left.</p></div></div>';
    $$('[data-up]').forEach(button => button.onclick = () => moveStep(Number(button.dataset.up), -1));
    $$('[data-down]').forEach(button => button.onclick = () => moveStep(Number(button.dataset.down), 1));
    $$('[data-delete-step]').forEach(button => button.onclick = () => { state.project.steps.splice(Number(button.dataset.deleteStep), 1); markDirty(); renderWorkflow(); renderMetrics(); });
    $("#run-history").innerHTML = state.project.runs.length ? state.project.runs.slice(0, 8).map(run => `<div class="activity-item"><i></i><div><strong>${escapeHtml(run.summary)}</strong><span>${escapeHtml(run.at)}</span></div></div>`).join("") : '<p class="muted">No runs yet.</p>';
  }

  function addStep(type) {
    const definition = stepDefinitions.find(item => item.id === type); if (!definition) return;
    state.project.steps.push({ id: uid("step"), ...definition }); addActivity(`${definition.name} added to workflow`); renderWorkflow(); renderMetrics();
  }

  function moveStep(index, direction) {
    const target = index + direction; if (target < 0 || target >= state.project.steps.length) return;
    [state.project.steps[index], state.project.steps[target]] = [state.project.steps[target], state.project.steps[index]]; markDirty(); renderWorkflow();
  }

  function cleanRows(rows, columns) {
    return rows.map(row => Object.fromEntries(columns.map(column => [column, typeof row[column] === "string" ? row[column].trim() : row[column]]))).filter(row => columns.some(column => row[column] !== "" && row[column] !== null && row[column] !== undefined));
  }

  function numericColumns(rows, columns) { return columns.filter(column => rows.filter(row => row[column] !== "" && row[column] != null && Number.isFinite(Number(row[column]))).length > Math.max(1, rows.length * .7)); }

  async function runWorkflow() {
    const source = activeDataset(); if (!source) return toast("Add and select a dataset first.");
    if (!state.project.steps.length) return toast("Add at least one workflow step.");
    let rows = source.rows.map(row => ({ ...row })); let columns = [...source.columns]; const notes = [];
    for (const step of state.project.steps) {
      if (step.type === "clean") { const before = rows.length; rows = cleanRows(rows, columns); notes.push(`Cleaned ${before - rows.length} blank rows`); }
      if (step.type === "dedupe") { const before = rows.length; const seen = new Set(); rows = rows.filter(row => { const key = JSON.stringify(columns.map(column => row[column])); if (seen.has(key)) return false; seen.add(key); return true; }); notes.push(`Removed ${before - rows.length} duplicate rows`); }
      if (step.type === "filter") { const before = rows.length; rows = rows.filter(row => columns.every(column => row[column] !== "" && row[column] != null)); notes.push(`Removed ${before - rows.length} incomplete rows`); }
      if (step.type === "derive") { const nums = numericColumns(rows, columns); let name = "row_number"; if (nums.length >= 2) { name = `${nums[0]}_per_${nums[1]}`.replace(/\W+/g, "_"); rows.forEach(row => row[name] = Number(row[nums[1]]) ? Number(row[nums[0]]) / Number(row[nums[1]]) : null); } else rows.forEach((row, index) => row[name] = index + 1); if (!columns.includes(name)) columns.push(name); notes.push(`Created ${name}`); }
      if (step.type === "sort") { const column = numericColumns(rows, columns)[0] || columns[0]; rows.sort((a, b) => String(a[column]).localeCompare(String(b[column]), undefined, { numeric: true })); notes.push(`Sorted by ${column}`); }
      if (step.type === "quality") runQuality(rows, false);
      if (step.type === "report") generateReport(rows, columns, false);
      if (step.type === "dashboard") window.open("../instant-dashboard/index.html", "_blank");
    }
    const output = { id: uid("data"), name: `${source.name.replace(/\.[^.]+$/, "")} • workflow output`, columns, rows: rows.slice(0, MAX_ROWS), originalRowCount: rows.length, source: "workflow", addedAt: Date.now() };
    state.project.datasets = state.project.datasets.filter(item => !(item.source === "workflow" && item.name.startsWith(source.name.replace(/\.[^.]+$/, ""))));
    state.project.datasets.push(output); state.project.activeDatasetId = output.id;
    const summary = `${state.project.steps.length} steps · ${rows.length.toLocaleString()} output rows`;
    state.project.runs.unshift({ summary, notes, at: nowLabel() }); addActivity(`Workflow completed: ${summary}`); $("#workflow-output-summary").textContent = summary; renderAll(); await saveProject(true); toast("Workflow complete. Output saved as a new dataset.");
  }

  function renderDictionary() {
    const dataset = activeDataset(); const body = $("#dictionary-body");
    if (!dataset) { body.innerHTML = '<tr><td colspan="6">Select a dataset to build its dictionary.</td></tr>'; return; }
    body.innerHTML = profileDataset(dataset).map(item => `<tr><td><strong>${escapeHtml(item.column)}</strong></td><td><span class="badge">${item.type}</span></td><td>${Math.round(item.complete * 100)}%</td><td>${item.unique.toLocaleString()}</td><td>${escapeHtml(String(item.example).slice(0, 45))}</td><td>${item.role}</td></tr>`).join("");
  }

  function renderRules() {
    const dataset = activeDataset(); $("#rule-column").innerHTML = dataset ? dataset.columns.map(column => `<option>${escapeHtml(column)}</option>`).join("") : '<option>No dataset selected</option>';
    $("#quality-rules").innerHTML = state.project.rules.length ? state.project.rules.map(rule => `<div class="rule-item"><span><strong>${escapeHtml(rule.column)}</strong> · ${escapeHtml(rule.type)}${rule.value ? ` · ${escapeHtml(rule.value)}` : ""}</span><button class="icon-button" data-remove-rule="${rule.id}">Remove</button></div>`).join("") : '<p class="muted">No rules yet. Add one above.</p>';
    $$('[data-remove-rule]').forEach(button => button.onclick = () => { state.project.rules = state.project.rules.filter(rule => rule.id !== button.dataset.removeRule); markDirty(); renderRules(); renderMetrics(); });
  }

  function runQuality(inputRows, update = true) {
    const dataset = activeDataset(); const rows = inputRows || dataset?.rows || []; const results = [];
    for (const rule of state.project.rules) {
      const values = rows.map(row => row[rule.column]); let failures = 0;
      if (rule.type === "required") failures = values.filter(value => value === "" || value == null).length;
      if (rule.type === "unique") failures = values.length - new Set(values.map(String)).size;
      if (rule.type === "nonnegative") failures = values.filter(value => Number(value) < 0).length;
      if (rule.type === "allowed") { const allowed = new Set(rule.value.split(",").map(value => value.trim().toLowerCase())); failures = values.filter(value => !allowed.has(String(value).trim().toLowerCase())).length; }
      if (rule.type === "future") failures = values.filter(value => Date.parse(value) > Date.now()).length;
      results.push({ rule, failures, passed: failures === 0 });
    }
    const passed = results.filter(result => result.passed).length; const score = results.length ? Math.round(passed / results.length * 100) : 100;
    if (update) {
      $("#quality-score").textContent = `${score}`;
      $("#quality-summary").textContent = results.length ? `${passed} of ${results.length} rules passed.` : "No rules configured; the dataset receives a provisional 100.";
      $("#quality-results").innerHTML = results.map(result => `<div class="quality-result ${result.passed ? "" : "fail"}"><span>${escapeHtml(result.rule.column)} · ${escapeHtml(result.rule.type)}</span><strong>${result.passed ? "Passed" : `${result.failures} failed`}</strong></div>`).join("");
      addActivity(`Quality checks completed with a score of ${score}`);
    }
    return { score, results };
  }

  function summarizeData(rows, columns) {
    const nums = numericColumns(rows, columns); const category = columns.find(column => inferType(rows.map(row => row[column])) === "category");
    const numeric = nums.slice(0, 3).map(column => { const values = rows.map(row => Number(row[column])).filter(Number.isFinite); const total = values.reduce((a, b) => a + b, 0); return { column, total, average: values.length ? total / values.length : 0, min: Math.min(...values), max: Math.max(...values) }; });
    let breakdown = [];
    if (category) { const counts = {}; rows.forEach(row => { const key = String(row[category] ?? "Blank"); counts[key] = (counts[key] || 0) + 1; }); breakdown = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8); }
    return { numeric, category, breakdown };
  }

  function generateReport(inputRows, inputColumns, update = true) {
    const dataset = activeDataset(); if (!dataset && !inputRows) return toast("Select a dataset first.");
    const rows = inputRows || dataset.rows; const columns = inputColumns || dataset.columns; const summary = summarizeData(rows, columns); const quality = runQuality(rows, false);
    const report = { generatedAt: new Date().toISOString(), dataset: dataset?.name || "Workflow output", rows: rows.length, columns: columns.length, summary, quality, title: `${state.project.name} — Executive Report` };
    state.project.report = report; if (update) { addActivity("Executive report generated"); renderReport(); markDirty(); toast("Report generated."); }
    return report;
  }

  function reportHtml(report = state.project.report) {
    if (!report) return '<div class="report-empty"><div><strong>No report generated yet</strong><p>Select a dataset and choose Generate report.</p></div></div>';
    const max = Math.max(1, ...report.summary.breakdown.map(item => item[1]));
    return `<span class="eyebrow">Generated ${new Date(report.generatedAt).toLocaleString()}</span><h1 class="report-title">${escapeHtml(report.title)}</h1><p class="report-subtitle">Source: ${escapeHtml(report.dataset)}</p><div class="report-grid"><div class="report-kpi"><strong>${report.rows.toLocaleString()}</strong><span>Rows analyzed</span></div><div class="report-kpi"><strong>${report.columns}</strong><span>Columns profiled</span></div><div class="report-kpi"><strong>${report.quality.score}</strong><span>Quality score</span></div></div><section class="report-section"><h3>Executive summary</h3><p>This report reviewed ${report.rows.toLocaleString()} records across ${report.columns} fields. ${report.summary.numeric.length ? `The leading measurable field is ${escapeHtml(report.summary.numeric[0].column)}, totaling ${formatNumber(report.summary.numeric[0].total)} with an average of ${formatNumber(report.summary.numeric[0].average)}.` : "The dataset is primarily categorical or descriptive."} ${report.quality.results.length ? `${report.quality.results.filter(item => item.passed).length} of ${report.quality.results.length} configured quality expectations passed.` : "No formal quality rules were configured."}</p></section>${report.summary.breakdown.length ? `<section class="report-section"><h3>${escapeHtml(report.summary.category)} distribution</h3><div class="bar-chart">${report.summary.breakdown.map(([label, value]) => `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${value / max * 100}%"></div></div><strong>${value}</strong></div>`).join("")}</div></section>` : ""}<section class="report-section"><h3>Recommended next actions</h3><ul><li>Review failed quality checks before distributing results.</li><li>Save the workflow so the same preparation can be applied to the next file.</li><li>Use Dashboard Builder when stakeholders need interactive exploration.</li></ul></section>`;
  }

  function formatNumber(value) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  function renderReport() { $("#report-canvas").innerHTML = reportHtml(); }

  async function downloadPowerPoint() {
    if (!state.project.report) generateReport();
    if (typeof PptxGenJS === "undefined") return toast("PowerPoint export did not load. Check your connection and try again.");
    const report = state.project.report; const pptx = new PptxGenJS(); pptx.layout = "LAYOUT_WIDE"; pptx.author = "Signal Noir Studio"; pptx.subject = state.project.name; pptx.title = report.title;
    let slide = pptx.addSlide(); slide.background = { color: "00133C" }; slide.addText(report.title, { x: .7, y: 1.5, w: 11.7, h: 1.2, fontFace: "Georgia", fontSize: 30, bold: true, color: "FFFFFF", breakLine: false }); slide.addText(`Source: ${report.dataset}\nGenerated ${new Date(report.generatedAt).toLocaleString()}`, { x: .72, y: 2.9, w: 8, h: .7, fontFace: "Arial", fontSize: 12, color: "AFC8EE" });
    slide = pptx.addSlide(); slide.addText("Executive summary", { x: .6, y: .45, w: 12, h: .5, fontFace: "Georgia", fontSize: 24, bold: true, color: "00133C" }); const kpis = [[report.rows.toLocaleString(), "Rows analyzed"], [String(report.columns), "Columns profiled"], [String(report.quality.score), "Quality score"]]; kpis.forEach((item, index) => { const x = .7 + index * 4.15; slide.addText(item[0], { x, y: 1.35, w: 3.7, h: 1.05, fontFace: "Georgia", fontSize: 25, bold: true, color: "00133C", align: "center", valign: "mid", fill: { color: "F1F5F9" }, line: { color: "E2E8F0" }, radius: .08 }); slide.addText(item[1], { x: x + .25, y: 2.5, w: 3.2, h: .25, fontFace: "Arial", fontSize: 10, color: "64748B", align: "center" }); });
    const lead = report.summary.numeric[0]; const narrative = lead ? `The leading measurable field is ${lead.column}, totaling ${formatNumber(lead.total)} with an average of ${formatNumber(lead.average)}. The configured quality score is ${report.quality.score}.` : `The dataset contains ${report.rows.toLocaleString()} records and is primarily categorical or descriptive. The configured quality score is ${report.quality.score}.`; slide.addText(narrative, { x: .8, y: 3.35, w: 11.6, h: 1.2, fontFace: "Arial", fontSize: 17, color: "334155", breakLine: false, margin: .08 });
    slide = pptx.addSlide(); slide.addText("Recommendations", { x: .6, y: .45, w: 12, h: .5, fontFace: "Georgia", fontSize: 24, bold: true, color: "00133C" }); slide.addText([{ text: "Review failed quality checks before distributing results.", options: { bullet: { indent: 18 } } }, { text: "Rerun the saved workflow when the next file arrives.", options: { bullet: { indent: 18 } } }, { text: "Use Dashboard Builder for interactive stakeholder exploration.", options: { bullet: { indent: 18 } } }], { x: .9, y: 1.4, w: 10.8, h: 3, fontFace: "Arial", fontSize: 20, color: "334155", breakLine: true, paraSpaceAfterPt: 18 });
    await pptx.writeFile({ fileName: `${slug(state.project.name)}-report.pptx` }); toast("PowerPoint downloaded.");
  }

  function renderSchedules() {
    $("#schedule-list").innerHTML = state.project.schedules.length ? state.project.schedules.map(item => `<div class="rule-item"><span><strong>${escapeHtml(item.name)}</strong> · ${escapeHtml(item.frequency)} · ${escapeHtml(item.date)}</span><button class="icon-button" data-remove-schedule="${item.id}">Remove</button></div>`).join("") : '<p class="muted">No schedules yet.</p>';
    $$('[data-remove-schedule]').forEach(button => button.onclick = () => { state.project.schedules = state.project.schedules.filter(item => item.id !== button.dataset.removeSchedule); markDirty(); renderSchedules(); });
  }

  function renderCollaboration() {
    const members = state.project.members.map(item => `<div class="rule-item"><span><strong>${escapeHtml(item.name)}</strong> · ${escapeHtml(item.role)}</span><span class="badge">Member</span></div>`);
    const comments = state.project.comments.slice(0, 5).map(item => `<div class="rule-item"><span><strong>${escapeHtml(item.author)}</strong> · ${escapeHtml(item.text)}</span><small>${escapeHtml(item.at)}</small></div>`);
    const versions = state.project.versions.slice(0, 3).map(item => `<div class="rule-item"><span><strong>Version ${item.number}</strong> · ${escapeHtml(item.summary)}</span><small>${escapeHtml(item.at)}</small></div>`);
    $("#collaboration-list").innerHTML = [...members, ...comments, ...versions].join("") || '<p class="muted">No members, comments, or snapshots yet.</p>';
  }

  function renderCustomTools() {
    $("#custom-tool-list").innerHTML = state.project.customTools.length ? state.project.customTools.map(tool => `<article class="dataset-card"><span class="badge good">Personal tool</span><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.purpose)}</p><div class="mini-stats"><div><strong>${tool.steps.length}</strong><span>Steps</span></div></div><div class="dataset-actions"><button class="icon-button" data-run-tool="${tool.id}">Use tool</button><button class="icon-button" data-remove-tool="${tool.id}">Remove</button></div></article>`).join("") : '<div class="report-empty"><div><strong>No personal tools yet</strong><p>Describe one using the builder.</p></div></div>';
    $$('[data-run-tool]').forEach(button => button.onclick = () => { const tool = state.project.customTools.find(item => item.id === button.dataset.runTool); state.project.steps = tool.steps.map(type => ({ id: uid("step"), ...stepDefinitions.find(item => item.id === type) })); addActivity(`${tool.name} loaded`); renderAll(); showView("workflow"); });
    $$('[data-remove-tool]').forEach(button => button.onclick = () => { state.project.customTools = state.project.customTools.filter(item => item.id !== button.dataset.removeTool); markDirty(); renderCustomTools(); });
  }

  function planFromText(text) {
    const q = text.toLowerCase(); const steps = [];
    if (/clean|messy|prepare|standard/.test(q)) steps.push("clean");
    if (/duplicate|dedup/.test(q)) steps.push("dedupe");
    if (/missing|blank|complete/.test(q)) steps.push("filter");
    if (/calculate|new column|per |ratio/.test(q)) steps.push("derive");
    if (/quality|validate|check/.test(q)) steps.push("quality");
    if (/analy|trend|insight|forecast/.test(q)) steps.push("analyze");
    if (/dashboard|visual/.test(q)) steps.push("dashboard");
    if (/report|summary|executive|present/.test(q)) steps.push("report");
    return [...new Set(steps.length ? steps : ["clean", "analyze", "report"])];
  }

  async function askLocalAi(goal) {
    const enabled = $("#local-ai-toggle").checked;
    if (!enabled) return null;
    try {
      if (window.LanguageModel?.create) { const session = await window.LanguageModel.create(); return await session.prompt(`Return a short data workflow for this goal: ${goal}`); }
      if (window.ai?.languageModel?.create) { const session = await window.ai.languageModel.create(); return await session.prompt(`Return a short data workflow for this goal: ${goal}`); }
    } catch (error) { return null; }
    return null;
  }

  function renderAi() {
    const supported = Boolean(window.LanguageModel?.create || window.ai?.languageModel?.create);
    $("#ai-status").textContent = supported ? "Browser AI available" : "Deterministic engine";
    $("#ai-detail").textContent = supported ? "A compatible local browser model is available. Project data remains on this device." : "This browser does not expose a local language model, so Vanessa uses the private deterministic planner. Nothing is sent to a remote AI service.";
    $("#local-ai-toggle").checked = localStorage.getItem("datahub_studio_local_ai") === "true";
  }


  function viewCapability(view) { return document.querySelector(`.nav-item[data-view="${view}"]`)?.dataset.capability || null; }
  function gateView(view) {
    const access = window.SignalNoir?.access;
    const accessUi = window.SignalNoir?.accessUi;
    const required = viewCapability(view);
    const node = document.getElementById(`view-${view}`);
    node?.querySelector(".studio-denied")?.remove();
    if (!access || !accessUi || !required || access.can(required) || !node) { if (node) node.dataset.denied = ""; return false; }
    node.dataset.denied = "1";
    const panel = document.createElement("div");
    panel.className = "studio-denied";
    panel.innerHTML = accessUi.restrictedHtml(required, { title: document.querySelector(`.nav-item[data-view="${view}"]`)?.textContent.trim() || "This section" });
    node.prepend(panel);
    accessUi.bindExit(panel);
    return true;
  }


  const VIEW_ALIASES = { outputs: "artifacts" };

  function showView(view) {
    if (VIEW_ALIASES[view]) view = VIEW_ALIASES[view];
    if (!document.getElementById(`view-${view}`)) view = "vanessa";
    gateView(view);
    state.activeView = view;
    $$(".studio-view").forEach(node => node.classList.toggle("active", node.id === `view-${view}`));
    $$(".nav-item").forEach(node => { const active = node.dataset.view === view; node.classList.toggle("active", active); if (active) node.setAttribute("aria-current", "page"); else node.removeAttribute("aria-current"); });
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    window.dispatchEvent(new CustomEvent("datahub:view", { detail: view }));
  }

  async function createProject(name, extra = {}) {
    const project = normalizeProject({ ...blankProject(name), ...extra });
    state.project = project; state.projects.push(project);
    await saveProject(true); renderAll();
    return project;
  }


  async function adoptProject(record) {
    const project = normalizeProject(record);
    state.projects.push(project);
    state.project = project;
    await saveProject(true);
    localStorage.setItem(ACTIVE_KEY, project.id);
    renderAll();
    showView("overview");
    return project;
  }

  function selectProject(id) {
    const project = visibleProjects().find(item => item.id === id);
    if (!project) return null;
    state.project = normalizeProject(project);
    localStorage.setItem(ACTIVE_KEY, project.id);
    renderAll();
    return state.project;
  }


  function newProjectDialog() {
    const PS = window.SignalNoir?.projectService;
    const access = window.SignalNoir?.access;
    const teams = access && !access.isPersonal() ? access.teams.list() : [];
    const templates = PS ? PS.TEMPLATES : [];
    dialog(`<span class="eyebrow">New project</span><h2>Start a project</h2><p class="muted">A project is where the data, the analysis, the findings and what you decide all stay together. Everything is local to this browser.</p>
      <form id="new-project-form" class="form-grid" style="margin-top:18px">
        <label class="sn-label" for="new-project-name">Project name</label>
        <input id="new-project-name" class="sn-input" value="New analytics project" required maxlength="120">
        <label class="sn-label" for="new-project-description">What is it for? <span class="sn-muted sn-xs">(optional)</span></label>
        <input id="new-project-description" class="sn-input" name="description" maxlength="400" placeholder="One line, so it still makes sense in a month">
        ${templates.length ? `<label class="sn-label" for="new-project-template">Start from</label>
        <select id="new-project-template" class="sn-select" name="templateId">${templates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.sample ? " (sample)" : ""}</option>`).join("")}</select>
        <p class="sn-field-hint" id="template-hint">${escapeHtml(templates[0].description)}</p>` : ""}
        ${teams.length ? `<label class="sn-label" for="new-project-team">Owning team <span class="sn-muted sn-xs">(optional)</span></label>
        <select id="new-project-team" class="sn-select" name="teamId"><option value="">No team</option>${teams.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("")}</select>` : ""}
        <div class="action-row" style="justify-content:flex-end;margin-top:8px"><button type="button" class="button ghost" data-cancel>Cancel</button><button class="button primary">Create project</button></div>
      </form>`);
    const input = $("#new-project-name"); input.focus(); input.select();
    const template = $("#new-project-template");
    template?.addEventListener("change", () => {
      const chosen = window.SignalNoir.projectService.template(template.value);
      const hint = $("#template-hint");
      if (chosen && hint) hint.textContent = chosen.expects?.length ? `${chosen.description} Expects: ${chosen.expects.join("; ")}.` : chosen.description;
    });
    $("#new-project-form [data-cancel]").onclick = closeDialog;
    $("#new-project-form").onsubmit = async event => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      closeDialog();
      const project = await createProject(name);
      if (PS) {
        PS.initialize(project, { description: $("#new-project-description")?.value || "", templateId: template?.value || null, teamId: $("#new-project-team")?.value || null });
        await saveProject(true);
        renderAll();
      }
      showView(project.templateId || project.description ? "overview" : "vanessa");
      toast(`${name} created.`);
    };
  }


  let dialogReturnFocus = null;

  function focusableIn(node) {
    return Array.from(node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function onDialogKey(event) {
    const shell = $("#studio-dialog");
    if (shell.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
    if (event.key !== "Tab") return;
    const items = focusableIn(shell);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function dialog(html) {
    const shell = $("#studio-dialog");
    dialogReturnFocus = document.activeElement;
    $("#dialog-content").innerHTML = html;
    shell.hidden = false;
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");

    const items = focusableIn($("#dialog-content"));
    (items[0] || shell.querySelector(".dialog-close"))?.focus();
  }

  function closeDialog() {
    const shell = $("#studio-dialog");
    if (shell.hidden) return;
    shell.hidden = true;
    shell.removeAttribute("aria-modal");
    const target = dialogReturnFocus;
    dialogReturnFocus = null;
    if (target && document.contains(target)) target.focus();
  }

  document.addEventListener("keydown", onDialogKey, true);

  async function connectSource() {
    const type = $("#connector-type").value; let url = $("#connector-url").value.trim(); if (!url) return toast("Paste a source URL first.");
    if (type === "database") return dialog('<span class="eyebrow">Database gateway</span><h2>Secure HTTPS bridge required</h2><p class="muted">A static GitHub Pages app cannot open PostgreSQL or SQL Server sockets safely. Connect an authenticated HTTPS endpoint that returns CSV or JSON, then choose CSV or JSON URL here.</p>');
    if (type === "google") {
      const match = url.match(/\/spreadsheets\/d\/([^/]+)/); if (!match) return toast("That does not look like a Google Sheets link.");
      const gid = url.match(/[?&#]gid=(\d+)/)?.[1] || "0"; url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
    }
    try {
      toast("Connecting…"); const response = await fetch(url); if (!response.ok) throw new Error(`Connection returned ${response.status}`); const text = await response.text();
      const parsed = /json/i.test(response.headers.get("content-type") || "") || text.trim().startsWith("[") ? parseJSONText(text) : parseCSVText(text);
      const name = new URL(url).hostname; const dataset = { id: uid("data"), name: `Live source · ${name}`, columns: parsed.columns, rows: parsed.rows.slice(0, MAX_ROWS), originalRowCount: parsed.rows.length, source: "live", connectionUrl: url, addedAt: Date.now() };
      state.project.datasets.push(dataset); state.project.activeDatasetId = dataset.id; state.project.connections.push({ type, url, datasetId: dataset.id }); addActivity(`Connected ${name}`); renderAll(); toast("Live source connected.");
    } catch (error) { toast(`Connection failed: ${error.message}`); }
  }

  async function refreshConnections() {
    for (const connection of state.project.connections) {
      try {
        const response = await fetch(connection.url, { cache: "no-store" }); if (!response.ok) continue;
        const text = await response.text(); const parsed = /json/i.test(response.headers.get("content-type") || "") || text.trim().startsWith("[") ? parseJSONText(text) : parseCSVText(text);
        const dataset = state.project.datasets.find(item => item.id === connection.datasetId); if (!dataset) continue;
        dataset.columns = parsed.columns; dataset.rows = parsed.rows.slice(0, MAX_ROWS); dataset.originalRowCount = parsed.rows.length; dataset.refreshedAt = Date.now();
      } catch (error) {                                   }
    }
  }

  function projectBundle(includeData) {
    const copy = JSON.parse(JSON.stringify(state.project));
    if (!includeData) copy.datasets = copy.datasets.map(item => ({ ...item, rows: [], omittedRows: item.rows.length }));
    copy.bundleVersion = 1; copy.exportedAt = new Date().toISOString(); return copy;
  }

  function shareDialog() {
    dialog(`<span class="eyebrow">Collaboration bundle</span><h2>What should be included?</h2><p class="muted">A portable JSON bundle can move this project to another browser. Data is optional.</p><div class="stack" style="margin-top:18px"><button class="button primary" data-bundle-data>Include project data</button><button class="button ghost" data-bundle-structure>Structure only</button></div>`);
    $("[data-bundle-data]").onclick = () => { download(`${slug(state.project.name)}.signalnoir.json`, JSON.stringify(projectBundle(true), null, 2)); closeDialog(); };
    $("[data-bundle-structure]").onclick = () => { download(`${slug(state.project.name)}-structure.signalnoir.json`, JSON.stringify(projectBundle(false), null, 2)); closeDialog(); };
  }

  function exportIcs() {
    if (!state.project.schedules.length) return toast("Add a schedule first.");
    const events = state.project.schedules.map(item => { const date = item.date.replaceAll("-", ""); return `BEGIN:VEVENT\nUID:${item.id}@signal-noir\nDTSTART;VALUE=DATE:${date}\nSUMMARY:${item.name}\nDESCRIPTION:Open Signal Noir Studio and run ${state.project.name}.\nEND:VEVENT`; }).join("\n");
    download(`${slug(state.project.name)}-schedule.ics`, `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Signal Noir//Studio//EN\n${events}\nEND:VCALENDAR`, "text/calendar");
  }

  function advanceSchedule(item) {
    const date = new Date(`${item.date}T12:00:00`);
    if (item.frequency === "weekly") date.setDate(date.getDate() + 7);
    if (item.frequency === "monthly") date.setMonth(date.getMonth() + 1);
    if (item.frequency === "quarterly") date.setMonth(date.getMonth() + 3);
    item.date = date.toISOString().slice(0, 10);
  }


  function processDueSchedules() {
    const today = new Date().toISOString().slice(0, 10);
    const due = state.project.schedules.filter(item => item.date <= today && item.lastRun !== today);
    if (!due.length) return 0;
    due.forEach(item => { item.missedAt = item.date; advanceSchedule(item); });
    addActivity(`${due.length} reporting reminder${due.length === 1 ? "" : "s"} came due while Signal Noir was closed`, { type: "run-missed" });
    return due.length;
  }

  function sampleProject() {
    const rows = [
      { month: "2026-01", region: "North", revenue: 12800, orders: 142, satisfaction: 4.2 }, { month: "2026-02", region: "South", revenue: 16750, orders: 159, satisfaction: 4.5 }, { month: "2026-03", region: "West", revenue: 14120, orders: 151, satisfaction: 4.1 }, { month: "2026-04", region: "East", revenue: 21300, orders: 177, satisfaction: 4.7 }, { month: "2026-05", region: "North", revenue: 18440, orders: 168, satisfaction: 4.6 }, { month: "2026-06", region: "South", revenue: 23950, orders: 186, satisfaction: 4.8 }
    ];
    const dataset = { id: uid("data"), name: "sample-performance.csv", columns: Object.keys(rows[0]), rows, originalRowCount: rows.length, source: "sample", addedAt: Date.now() };
    state.project.datasets.push(dataset); state.project.activeDatasetId = dataset.id; state.project.rules.push({ id: uid("rule"), column: "revenue", type: "nonnegative", value: "" }); state.project.steps = recipes[0].steps.map(type => ({ id: uid("step"), type, ...stepDefinitions.find(item => item.id === type) })); addActivity("Sample analytics project loaded"); renderAll(); toast("Sample project ready.");
  }

  function bindEvents() {
    $$(".nav-item").forEach(button => button.onclick = () => showView(button.dataset.view));
    $("#save-project-btn").onclick = () => saveProject();
    $("#new-project-btn").onclick = newProjectDialog;
    $("#project-select").onchange = () => selectProject($("#project-select").value);
    $("#project-goal").oninput = markDirty;
    $("#source-question-form").onsubmit = event => { event.preventDefault(); const question = $("#source-question").value.trim(); if (!question) return $("#source-question").focus(); openSourceGuide(guideFromQuestion(question), 0); };
    $("#goal-plan-btn").onclick = () => { const goal = $("#project-goal").value.trim(); if (!goal) return toast("Describe the project goal first."); const steps = planFromText(goal); state.project.goal = goal; state.project.steps = steps.map(type => ({ id: uid("step"), type, ...stepDefinitions.find(item => item.id === type) })); $("#goal-response").hidden = false; $("#goal-response").innerHTML = `<strong>Recommended workflow:</strong> ${state.project.steps.map(step => escapeHtml(step.name)).join(" → ")}`; addActivity("Vanessa built a workflow from the project goal"); renderMetrics(); renderWorkflow(); };
    $("#goal-ai-btn").onclick = async () => { const goal = $("#project-goal").value.trim(); if (!goal) return toast("Describe the project goal first."); const answer = await askLocalAi(goal); $("#goal-response").hidden = false; $("#goal-response").textContent = answer || "A local language model is not available in this browser. Vanessa’s deterministic planner is ready and keeps the same privacy guarantee."; };
    $("#studio-file-input").onchange = event => addFiles([...event.target.files]);
    $("#studio-folder-input").onchange = event => addFiles([...event.target.files]);
    const drop = $("#studio-drop-zone"); ["dragenter", "dragover"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add("drag"); })); ["dragleave", "drop"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove("drag"); })); drop.addEventListener("drop", event => addFiles([...event.dataTransfer.files]));
    $("#sample-project-btn").onclick = sampleProject;
    $("#connect-btn").onclick = connectSource;
    $("#run-workflow-btn").onclick = runWorkflow;
    $("#undo-step-btn").onclick = () => { if (state.project.steps.pop()) { markDirty(); renderWorkflow(); renderMetrics(); } };
    $("#natural-step-btn").onclick = () => { const text = prompt("Describe the transformation"); if (!text) return; planFromText(text).forEach(addStep); };
    $("#download-dictionary-btn").onclick = () => { const dataset = activeDataset(); if (!dataset) return toast("Select a dataset first."); download(`${slug(dataset.name)}-dictionary.json`, JSON.stringify(profileDataset(dataset), null, 2)); };
    $("#add-rule-btn").onclick = () => { const dataset = activeDataset(); if (!dataset) return toast("Select a dataset first."); state.project.rules.push({ id: uid("rule"), column: $("#rule-column").value, type: $("#rule-type").value, value: $("#rule-value").value.trim() }); $("#rule-value").value = ""; addActivity("Quality rule added"); renderRules(); renderMetrics(); };
    $("#run-quality-btn").onclick = () => runQuality();
    $("#generate-report-btn").onclick = () => generateReport();
    $("#present-report-btn").onclick = () => { if (!state.project.report) generateReport(); $("#report-canvas").requestFullscreen?.(); };
    $("#download-report-btn").onclick = () => { if (!state.project.report) generateReport(); const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(state.project.report.title)}</title><style>${document.querySelector("style")?.textContent || ""}body{font-family:Arial;padding:40px;max-width:1000px;margin:auto}</style></head><body>${reportHtml()}</body></html>`; download(`${slug(state.project.name)}-report.html`, html, "text/html"); };
    $("#download-pptx-btn").onclick = downloadPowerPoint;
    $("#add-schedule-btn").onclick = () => { const name = $("#schedule-name").value.trim(); const date = $("#schedule-date").value; if (!name || !date) return toast("Add a name and first date."); state.project.schedules.push({ id: uid("schedule"), name, date, frequency: $("#schedule-frequency").value }); addActivity("Reporting schedule added"); renderSchedules(); };
    $("#calendar-btn").onclick = exportIcs;
    $("#share-project-btn").onclick = shareDialog;
    $("#export-project-btn").onclick = shareDialog;
    $("#add-member-btn").onclick = () => { const name = $("#member-name").value.trim(); if (!name) return toast("Enter a teammate name."); state.project.members.push({ id: uid("member"), name, role: $("#member-role").value }); $("#member-name").value = ""; addActivity(`${name} added as ${$("#member-role").value}`); renderCollaboration(); };
    $("#add-comment-btn").onclick = () => { const text = $("#comment-text").value.trim(); if (!text) return toast("Write a comment first."); state.project.comments.unshift({ id: uid("comment"), author: "Project team", text, at: nowLabel() }); $("#comment-text").value = ""; addActivity("Project comment added"); renderCollaboration(); };
    $("#snapshot-btn").onclick = () => { state.project.versions.unshift({ id: uid("version"), number: state.project.versions.length + 1, at: nowLabel(), summary: `${state.project.datasets.length} datasets · ${state.project.steps.length} steps · ${state.project.rules.length} rules`, snapshot: { goal: state.project.goal, steps: JSON.parse(JSON.stringify(state.project.steps)), rules: JSON.parse(JSON.stringify(state.project.rules)), report: state.project.report } }); addActivity("Version snapshot saved"); renderCollaboration(); };
    $("#import-project-input").onchange = async event => { try { const project = normalizeProject(JSON.parse(await event.target.files[0].text())); project.id = uid("project"); project.name = `${project.name || "Imported project"} (imported)`; state.project = project; state.projects.push(project); await saveProject(true); renderAll(); toast("Project imported."); } catch (error) { toast("That bundle could not be imported."); } };
    $("#local-ai-toggle").onchange = event => { localStorage.setItem("datahub_studio_local_ai", String(event.target.checked)); renderAi(); };
    $("#build-tool-btn").onclick = () => { const name = $("#custom-tool-name").value.trim(); const purpose = $("#custom-tool-purpose").value.trim(); if (!name || !purpose) return toast("Name the tool and describe its purpose."); const steps = planFromText(purpose); state.project.customTools.push({ id: uid("tool"), name, purpose, steps }); $("#custom-tool-name").value = ""; $("#custom-tool-purpose").value = ""; addActivity(`${name} personal tool created`); renderCustomTools(); };
    $("#studio-dialog").onclick = event => { if (event.target.id === "studio-dialog") closeDialog(); }; $(".dialog-close").onclick = closeDialog;
    window.addEventListener("beforeunload", event => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
  }

  async function init() {
    bindEvents();
    try { state.projects = (await dbAll()).map(normalizeProject); } catch (error) { toast("Local project storage is unavailable."); }
    const reachable = visibleProjects();
    if (!reachable.length) { state.project = blankProject("My first analytics project"); state.projects.push(state.project); await saveProject(true); }
    else state.project = normalizeProject(reachable.find(item => item.id === localStorage.getItem(ACTIVE_KEY)) || reachable.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]);
    await refreshConnections();
    const ops = window.SignalNoir?.operations;


    let caughtUp = { ran: [], missed: [] };
    if (ops) { try { caughtUp = ops.catchUp(state.project, { wasOpen: false }); } catch (error) { console.error("[operations] catch-up failed", error); } }
    const due = processDueSchedules();
    renderAll();
    showView("vanessa");
    if (caughtUp.missed.length) { await saveProject(true); toast(`${caughtUp.missed.length} scheduled run${caughtUp.missed.length === 1 ? "" : "s"} came due while Signal Noir was closed. Nothing ran — see Operations.`, { timeout: 6000 }); }
    if (due) { await saveProject(true); toast(`${due} reporting reminder${due === 1 ? "" : "s"} came due while Signal Noir was closed. Nothing ran — open Operations to run or skip.`, { timeout: 6000 }); }
  }

  window.DataHubStudio = { state, uid, activeDataset, addActivity, markDirty, renderAll, saveProject, toast, dialog, closeDialog, escapeHtml, download, showView, addFiles, generateReport, reportHtml, createProject, selectProject, adoptProject, visibleProjects, normalizeProject, stepDefinitions, recipes, slug, nowLabel, MAX_ROWS };

  window.DataHubStudio.ready = init().then(() => window.dispatchEvent(new CustomEvent("datahub:studio-ready")));
})();
