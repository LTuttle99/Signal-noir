


(function (root) {
  "use strict";

  const DB_NAME = "datahub_studio";
  const STORE = "projects";

  function open() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function list() {
    try {
      const db = await open();
      const projects = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      });
      return projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (error) {
      return [];
    }
  }

  async function remove(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  }

  function arr(value) { return Array.isArray(value) ? value : []; }


  function outputsOf(project) {
    const base = { projectId: project.id, projectName: project.name, isDemo: Boolean(project.isDemo) };
    const artifacts = root.SignalNoir?.artifacts;
    if (artifacts) {
      if (!artifacts.canReach(project)) return [];
      return artifacts.list(project, { types: ["finding", "chart", "dashboard", "report", "workflow", "decision", "task"] })
        .map(item => ({ ...base, kind: item.type === "finding" ? "insight" : item.type, id: item.id, title: item.title, at: item.updatedAt || item.createdAt, detail: item.description || item.evidence?.dataset || "", status: item.status }));
    }
    const out = [];
    arr(project.findings).forEach(item => out.push({ ...base, kind: "insight", id: item.id, title: item.title, at: item.savedAt || item.evidence?.generatedAt, detail: item.evidence?.dataset || "" }));
    arr(project.pinnedInsights).forEach(item => out.push({ ...base, kind: "insight", id: item.id, title: `${item.title} · ${item.subtitle || ""}`, at: item.at, detail: item.dataset || "" }));
    arr(project.outputs).forEach(item => out.push({ ...base, kind: item.kind, id: item.id, title: item.title, at: item.createdAt, detail: item.summary || "" }));
    if (project.report) out.push({ ...base, kind: "report", id: `${project.id}_report`, title: project.report.title || "Project report", at: project.report.generatedAt || project.updatedAt, detail: "Studio report" });
    arr(project.stories).forEach(item => out.push({ ...base, kind: "report", id: item.id, title: item.title || "Executive story", at: item.createdAt || item.at, detail: "Story" }));
    if (arr(project.dashboardWidgets).length) out.push({ ...base, kind: "dashboard", id: `${project.id}_canvas`, title: `${project.name} dashboard canvas`, at: project.updatedAt, detail: `${project.dashboardWidgets.length} widgets` });
    arr(project.decisions).forEach(item => out.push({ ...base, kind: "decision", id: item.id, title: item.title, at: item.createdAt, detail: item.status || "" }));
    arr(project.tasks).forEach(item => out.push({ ...base, kind: "task", id: item.id, title: item.title, at: item.createdAt, detail: [item.owner, item.status].filter(Boolean).join(" · ") }));
    if (arr(project.steps).length) out.push({ ...base, kind: "workflow", id: `${project.id}_workflow`, title: `${project.name} workflow`, at: project.updatedAt, detail: project.steps.map(step => step.name).join(" → ") });
    arr(project.customTools).forEach(item => out.push({ ...base, kind: "workflow", id: item.id, title: item.name, at: project.updatedAt, detail: item.purpose || "" }));
    return out;
  }


  async function recentWork(limit = 12) {
    const projects = await list();
    const artifacts = root.SignalNoir?.artifacts;
    const reachable = artifacts ? projects.filter(artifacts.canReach) : projects;
    return reachable.flatMap(outputsOf).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, limit);
  }

  async function searchAll(query, options = {}) {
    const artifacts = root.SignalNoir?.artifacts;
    if (!artifacts) return [];
    return artifacts.search(await list(), query, options);
  }

  const api = { list, remove, outputsOf, recentWork, searchAll };
  root.SignalNoir = root.SignalNoir || {};
  root.SignalNoir.projects = api;
})(window);
