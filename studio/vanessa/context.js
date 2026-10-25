


(function () {
  "use strict";

  const studio = window.DataHubStudio;
  const A = window.SignalNoir?.analysis;
  if (!studio || !A) return;
  const NS = window.SignalNoirVanessa = window.SignalNoirVanessa || {};
  const profiles = new Map();
  const project = () => studio.state.project;

  function ensureProjectShape(p = project()) {
    if (!p) return null;
    for (const key of ["vanessaRuns", "vanessaConversations", "vanessaMemory", "findings", "outputs", "metrics", "glossary"]) if (!Array.isArray(p[key])) p[key] = [];
    if (!p.vanessaConversations.length) {
      const legacy = p.vanessaRuns.length ? { id: studio.uid("conv"), title: "Earlier work", createdAt: Math.min(...p.vanessaRuns.map(run => run.createdAt || Date.now())), updatedAt: Date.now(), focus: {} } : null;
      const fresh = { id: studio.uid("conv"), title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), focus: {} };
      p.vanessaConversations.push(legacy || fresh);
      p.activeConversationId = (legacy || fresh).id;
    }
    p.vanessaRuns.forEach(run => { if (!run.conversationId) run.conversationId = p.vanessaConversations[0].id; });
    if (!p.vanessaConversations.some(conv => conv.id === p.activeConversationId)) p.activeConversationId = p.vanessaConversations[0].id;
    return p;
  }


  function profileOf(dataset) {
    if (!dataset) return null;
    const key = `${dataset.id}:${dataset.rows.length}:${dataset.columns.length}`;
    if (!profiles.has(key)) profiles.set(key, A.profile(dataset));
    return profiles.get(key);
  }

  function datasetById(id) { return project()?.datasets.find(item => item.id === id) || null; }

  function datasetByName(text) {
    const lower = String(text || "").toLowerCase();
    return project()?.datasets.filter(dataset => lower.includes(dataset.name.toLowerCase().replace(/\.[a-z0-9]+$/i, ""))).sort((a, b) => b.name.length - a.name.length)[0] || null;
  }

  function schemaOf(dataset) {
    const prof = profileOf(dataset);
    return {
      id: dataset.id, name: dataset.name, rows: dataset.rows.length, rowsTotal: dataset.originalRowCount ?? dataset.rows.length, columnCount: dataset.columns.length,
      source: dataset.source || "upload", derivedFrom: dataset.derivedFrom || null,
      columns: prof.columns.map(col => ({ name: col.name, type: col.type, missing: col.missing, unique: col.unique })),
      measures: prof.measures, dimensions: prof.dimensions, times: prof.times, ids: prof.ids, missing: prof.missing
    };
  }


  function conversation() {
    const p = ensureProjectShape();
    return p?.vanessaConversations.find(conv => conv.id === p.activeConversationId) || null;
  }

  function startConversation(title = "New conversation") {
    const p = ensureProjectShape();
    const conv = { id: studio.uid("conv"), title, createdAt: Date.now(), updatedAt: Date.now(), focus: {} };
    p.vanessaConversations.unshift(conv);
    p.activeConversationId = conv.id;
    studio.markDirty();
    return conv;
  }

  function selectConversation(id) {
    const p = ensureProjectShape();
    if (p.vanessaConversations.some(conv => conv.id === id)) { p.activeConversationId = id; studio.markDirty(); }
    return conversation();
  }

  function focus() { return conversation()?.focus || {}; }

  function setFocus(patch) {
    const conv = conversation();
    if (!conv) return {};
    conv.focus = { ...conv.focus, ...patch, updatedAt: Date.now() };
    conv.updatedAt = Date.now();
    return conv.focus;
  }

  function clearFocus() { const conv = conversation(); if (conv) conv.focus = { datasetId: conv.focus?.datasetId || null }; }


  function resolveDataset(prompt = "") {
    const f = focus();
    const byName = datasetByName(prompt);
    if (byName) return { dataset: byName, reason: "named in the request" };
    if (/\b(cleaned|clean) (version|copy|data)\b/i.test(prompt)) {
      const cleaned = [...(project()?.datasets || [])].reverse().find(dataset => dataset.source === "vanessa-clean");
      if (cleaned) return { dataset: cleaned, reason: "the cleaned copy" };
    }
    if (/\b(other|second) (file|dataset|one)\b/i.test(prompt) && f.datasetId) {
      const other = project().datasets.find(dataset => dataset.id !== f.datasetId);
      if (other) return { dataset: other, reason: "the other dataset" };
    }
    const selected = datasetById(conversation()?.selectedDatasetId);
    if (selected) return { dataset: selected, reason: "selected in the composer" };
    const focused = datasetById(f.datasetId);
    if (focused) return { dataset: focused, reason: "the dataset we were discussing" };
    const preferred = datasetById(memoryValue("preferred-dataset"));
    if (preferred) return { dataset: preferred, reason: "your saved preference" };
    const active = studio.activeDataset();
    return { dataset: active, reason: active ? "the active dataset" : null };
  }


  function memory() { return ensureProjectShape()?.vanessaMemory || []; }

  function remember(entry) {
    const list = memory();
    const existing = entry.key ? list.find(item => item.key === entry.key) : null;
    const record = { id: existing?.id || studio.uid("mem"), kind: "note", source: "user", createdAt: existing?.createdAt || Date.now(), ...entry, updatedAt: Date.now() };
    if (existing) Object.assign(existing, record); else list.unshift(record);
    studio.addActivity(`Vanessa will remember: ${record.label}`);
    return record;
  }

  function forget(id) {
    const p = project();
    const before = p.vanessaMemory.length;
    p.vanessaMemory = p.vanessaMemory.filter(item => item.id !== id);
    if (p.vanessaMemory.length !== before) studio.markDirty();
  }

  function memoryValue(key) { return memory().find(item => item.key === key)?.value ?? null; }
  function fiscalStart() { const value = Number(memoryValue("fiscal-year-start")); return value >= 1 && value <= 12 ? value : 1; }


  function definitions(term) {
    const p = project();
    const lower = String(term || "").toLowerCase().trim();
    const hit = text => lower && String(text || "").toLowerCase().includes(lower);
    return {
      metrics: (p.metrics || []).filter(metric => !term || hit(metric.name)),
      glossary: (p.glossary || []).filter(item => !term || hit(item.term)),
      memory: memory().filter(item => item.kind === "definition" && (!term || hit(item.label) || hit(item.key)))
    };
  }


  function snapshot() {
    const p = ensureProjectShape();
    if (!p) return null;
    const conv = conversation();
    return {
      project: { id: p.id, name: p.name, mode: p.mode, isDemo: p.isDemo },
      view: studio.state.activeView,
      datasets: p.datasets.map(schemaOf),
      activeDatasetId: studio.activeDataset()?.id || null,
      selectedDatasetId: conv?.selectedDatasetId || null,
      focus: { ...(conv?.focus || {}) },
      memory: memory().map(({ id, kind, label, value }) => ({ id, kind, label, value })),
      metrics: (p.metrics || []).map(({ name, formula }) => ({ name, formula })),
      glossary: (p.glossary || []).map(({ term, definition }) => ({ term, definition })),
      findings: p.findings.slice(0, 20).map(({ id, title }) => ({ id, title })),
      outputs: p.outputs.slice(0, 20).map(({ id, kind, title }) => ({ id, kind, title })),
      recentRuns: p.vanessaRuns.filter(run => run.conversationId === conv?.id).slice(0, 6).map(run => ({ prompt: run.prompt, intent: run.intent, summary: (run.summary || "").slice(0, 200) }))
    };
  }


  function modelSummary() {
    const snap = snapshot();
    return JSON.stringify({ datasets: snap.datasets.map(({ name, rows, columns, measures, dimensions, times }) => ({ name, rows, columns: columns.map(col => `${col.name}:${col.type}`), measures, dimensions, times })), focus: { measure: snap.focus.measure, dimension: snap.focus.dimension, time: snap.focus.time, subject: snap.focus.subject }, memory: snap.memory.map(item => `${item.label}: ${item.value}`), metrics: snap.metrics }).slice(0, 6000);
  }

  NS.context = { ensureProjectShape, profileOf, schemaOf, datasetById, datasetByName, resolveDataset, conversation, startConversation, selectConversation, focus, setFocus, clearFocus, memory, remember, forget, memoryValue, fiscalStart, definitions, snapshot, modelSummary, project };
})();
