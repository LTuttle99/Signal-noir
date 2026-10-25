const WORKSPACE_KEY = "hub_dashboards";
const WORKSPACE_MAX = 60;
const WORKSPACE_BAKE_MAX = 400000;
const WORKSPACE_TEXT_MAX = 200;

function workspaceRead() {
  try {
    const raw = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item === "object" && typeof item.id === "string" && typeof item.spec === "string");
  } catch (e) {
    return [];
  }
}

function workspaceWrite(list) {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(list.slice(0, WORKSPACE_MAX)));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "This browser is out of storage for saved dashboards. Delete one you no longer need and try again." };
  }
}

function workspaceTrim(value) {
  const text = String(value === null || value === undefined ? "" : value).replace(/\s+/g, " ").trim();
  return text.length > WORKSPACE_TEXT_MAX ? text.slice(0, WORKSPACE_TEXT_MAX) : text;
}

function workspaceId() {
  return "db_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function workspaceList() {
  return workspaceRead().sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
}

function workspaceGet(id) {
  return workspaceRead().find((item) => item.id === id) || null;
}

function workspaceSave(entry) {
  if (!entry || typeof entry.spec !== "string" || entry.spec === "") {
    return { ok: false, reason: "There is nothing to save yet." };
  }

  const list = workspaceRead();
  const now = new Date().toISOString();

  const record = {
    id: entry.id && workspaceGet(entry.id) ? entry.id : workspaceId(),
    title: workspaceTrim(entry.title) || "Untitled dashboard",
    subtitle: workspaceTrim(entry.subtitle),
    owner: workspaceTrim(entry.owner),
    audience: workspaceTrim(entry.audience),
    refresh: workspaceTrim(entry.refresh),
    source: workspaceTrim(entry.source),
    visuals: Number.isFinite(entry.visuals) ? entry.visuals : 0,
    spec: entry.spec,
    baked: typeof entry.baked === "string" && entry.baked.length <= WORKSPACE_BAKE_MAX ? entry.baked : "",
    updated: now,
    created: now
  };

  const existing = list.findIndex((item) => item.id === record.id);
  if (existing !== -1) {
    record.created = list[existing].created || now;
    list[existing] = record;
  } else {
    if (list.length >= WORKSPACE_MAX) {
      return { ok: false, reason: `The workspace holds ${WORKSPACE_MAX} dashboards. Delete one before saving another.` };
    }
    list.push(record);
  }

  const written = workspaceWrite(list);
  if (!written.ok) return written;

  return { ok: true, id: record.id, replaced: existing !== -1 };
}

function workspaceDelete(id) {
  const list = workspaceRead();
  const next = list.filter((item) => item.id !== id);
  if (next.length === list.length) return { ok: false, reason: "That dashboard is not in the workspace." };

  const written = workspaceWrite(next);
  if (!written.ok) return written;

  return { ok: true, removed: list.length - next.length };
}

function workspaceRename(id, title) {
  const list = workspaceRead();
  const found = list.find((item) => item.id === id);
  if (!found) return { ok: false, reason: "That dashboard is not in the workspace." };

  const clean = workspaceTrim(title);
  if (clean === "") return { ok: false, reason: "A dashboard needs a name." };

  found.title = clean;
  found.updated = new Date().toISOString();

  const written = workspaceWrite(list);
  if (!written.ok) return written;

  return { ok: true };
}

function workspaceClear() {
  return workspaceWrite([]);
}

function workspaceUsage() {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY) || "";
    return { count: workspaceRead().length, bytes: raw.length };
  } catch (e) {
    return { count: 0, bytes: 0 };
  }
}
