


(function (root) {
  "use strict";

  const SN = root.SignalNoir = root.SignalNoir || {};

  const STATE_KEY = "sn_connected_state";
  const API = "/api";


  const STATUS = {
    LOCAL_ONLY: "local-only",
    CONNECTED: "connected",
    OFFLINE: "offline",
    SYNCING: "syncing",
    SYNC_FAILED: "sync-failed"
  };

  const state = {
    status: STATUS.LOCAL_ONLY,
    available: null,
    user: null,
    organizations: [],
    organizationId: null,
    error: null
  };

  const listeners = new Set();
  const notify = () => listeners.forEach(fn => { try { fn(snapshot()); } catch (e) {} });
  const snapshot = () => ({ ...state, organizations: state.organizations.slice() });

  function setStatus(status, error = null) {
    if (state.status === status && state.error === error) return;
    state.status = status;
    state.error = error;
    try { localStorage.setItem(STATE_KEY, status); } catch (e) {}
    notify();
  }


  class ApiError extends Error {
    constructor(code, message, { status = 0, requestId = "" } = {}) {
      super(message);
      this.code = code;
      this.status = status;
      this.requestId = requestId;
    }
  }


  async function call(path, { method = "GET", body, signal, raw = false } = {}) {
    const options = {
      method,
      credentials: "same-origin",
      headers: {},
      signal
    };
    if (body instanceof FormData) {
      options.body = body;
    } else if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${API}${path}`, options);
    } catch (error) {
      if (state.user) setStatus(STATUS.OFFLINE);
      throw new ApiError("NETWORK_UNAVAILABLE",
        "Signal Noir can't reach the connected workspace right now. Your local projects are still available.");
    }

    if (raw) {
      if (!response.ok) throw await asError(response);
      return response;
    }

    let payload = null;
    try { payload = await response.json(); } catch (error) { payload = null; }

    if (!response.ok) {
      const error = payload?.error || {};
      const apiError = new ApiError(
        error.code || "INTERNAL",
        error.message || "That request could not be completed.",
        { status: response.status, requestId: error.requestId || response.headers.get("X-Request-Id") || "" }
      );


      if (["NOT_AUTHENTICATED", "SESSION_EXPIRED"].includes(apiError.code)) {
        state.user = null;
        state.organizations = [];
        state.organizationId = null;
        setStatus(STATUS.LOCAL_ONLY);
      }
      throw apiError;
    }

    if (state.user) setStatus(STATUS.CONNECTED);
    return payload;
  }

  async function asError(response) {
    let payload = null;
    try { payload = await response.json(); } catch (e) {}
    return new ApiError(payload?.error?.code || "INTERNAL",
      payload?.error?.message || "That request could not be completed.",
      { status: response.status });
  }


  const PROBE_KEY = "sn_connected_available";

  async function probe() {
    if (state.available !== null) return state.available;


    try {
      const remembered = sessionStorage.getItem(PROBE_KEY);
      if (remembered === "yes") { state.available = true; return true; }
      if (remembered === "no") { state.available = false; return false; }
    } catch (error) {                                    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${API}/health`, {
        signal: controller.signal, credentials: "same-origin"
      });
      clearTimeout(timer);
      const type = response.headers.get("content-type") || "";
      state.available = response.ok && type.includes("application/json");
    } catch (error) {
      state.available = false;
    }
    try { sessionStorage.setItem(PROBE_KEY, state.available ? "yes" : "no"); } catch (error) {}
    return state.available;
  }

  async function refresh() {
    if (!(await probe())) { setStatus(STATUS.LOCAL_ONLY); return null; }
    try {
      const me = await call("/me");
      state.user = me.user;
      state.organizations = me.organizations || [];
      if (!state.organizationId && state.organizations.length) {
        state.organizationId = state.organizations[0].id;
      }
      setStatus(STATUS.CONNECTED);
      notify();
      return me;
    } catch (error) {
      if (error.code === "NETWORK_UNAVAILABLE") setStatus(STATUS.OFFLINE);
      else setStatus(STATUS.LOCAL_ONLY);
      return null;
    }
  }

  const auth = {


    request: email => call("/auth/request", { method: "POST", body: { email } }),
    verify: token => call("/auth/verify", { method: "POST", body: { token } }),


    async signOut() {
      try { await call("/auth/signout", { method: "POST" }); } catch (error) {}
      state.user = null;
      state.organizations = [];
      state.organizationId = null;
      clearConnectedCaches();
      setStatus(STATUS.LOCAL_ONLY);
      return true;
    }
  };

  function clearConnectedCaches() {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sn_connected_cache")) localStorage.removeItem(key);
      }
      sessionStorage.removeItem("sn_connected_project");
    } catch (error) {}
  }


  const organizations = {
    list: () => state.organizations.slice(),
    current: () => state.organizations.find(o => o.id === state.organizationId) || null,


    switchTo(id) {
      if (state.organizationId === id) return;
      state.organizationId = id;
      clearConnectedCaches();
      root.dispatchEvent(new CustomEvent("sn:organization-changed", { detail: { organizationId: id } }));
      notify();
    },

    create: name => call("/organizations", { method: "POST", body: { name } }),
    members: id => call(`/organizations/${encodeURIComponent(id)}/members`),
    invite: (id, invitation) =>
      call(`/organizations/${encodeURIComponent(id)}/invitations`, { method: "POST", body: invitation }),
    audit: id => call(`/organizations/${encodeURIComponent(id)}/audit`),
    updateMember: (id, userId, patch) =>
      call(`/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
           { method: "PATCH", body: patch })
  };


  const localRepository = {
    mode: "local",
    async list() { return SN.projects ? SN.projects.list() : []; },
    async get(id) { return SN.projects ? SN.projects.get(id) : null; },
    async save(project) { return SN.projects ? SN.projects.put(project) : null; },
    async artifacts(project, type) {
      return SN.artifacts ? SN.artifacts.list(project, type ? { type } : {}) : [];
    },
    async activity(project) { return SN.artifacts ? SN.artifacts.activity(project) : []; }
  };

  const connectedRepository = {
    mode: "connected",
    async list() {
      if (!state.organizationId) return [];
      const data = await call(`/organizations/${encodeURIComponent(state.organizationId)}/projects`);
      return (data.projects || []).map(shapeProject);
    },
    async get(id) {
      const data = await call(`/projects/${encodeURIComponent(id)}`);
      return { ...shapeProject(data.project), role: data.role };
    },
    async save(project) {
      return call(`/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        body: { name: project.name, description: project.description, revision: project.revision }
      });
    },
    async artifacts(project, type) {
      const query = type ? `?type=${encodeURIComponent(type)}` : "";
      const data = await call(`/projects/${encodeURIComponent(project.id)}/artifacts${query}`);
      return (data.artifacts || []).map(shapeArtifact);
    },
    async activity(project) {
      const data = await call(`/projects/${encodeURIComponent(project.id)}/activity`);
      return data.activity || [];
    },
    async create(name, options = {}) {
      return call("/projects", {
        method: "POST",
        body: { organizationId: state.organizationId, name, ...options }
      });
    },
    async upload(projectId, file, name) {
      const form = new FormData();
      form.append("file", file);
      form.append("filename", file.name);
      if (name) form.append("name", name);
      return call(`/projects/${encodeURIComponent(projectId)}/datasets`, { method: "POST", body: form });
    },
    async download(versionId) {
      const response = await call(`/datasets/${encodeURIComponent(versionId)}/content`, { raw: true });
      return response.blob();
    },
    async search(term) {
      const data = await call(
        `/search?organizationId=${encodeURIComponent(state.organizationId)}&q=${encodeURIComponent(term)}`);
      return data.results || [];
    }
  };

  const shapeProject = row => ({
    id: row.id, name: row.name, description: row.description || "",
    status: row.status, visibility: row.visibility, revision: row.revision,
    updatedAt: row.updated_at ?? row.updatedAt, createdAt: row.created_at ?? row.createdAt,
    organizationId: row.organization_id ?? row.organizationId,
    mode: "connected"
  });

  const shapeArtifact = row => ({
    id: row.id, type: row.type, title: row.title,
    body: safeParse(row.body), status: row.status, revision: row.revision,
    createdAt: row.created_at, updatedAt: row.updated_at,
    projectId: row.project_id, mode: "connected"
  });

  const safeParse = value => {
    if (typeof value !== "string") return value || {};
    try { return JSON.parse(value); } catch (error) { return {}; }
  };


  const repositoryFor = project =>
    project?.mode === "connected" ? connectedRepository : localRepository;


  const migration = {


    plan(project) {
      const datasets = (project.datasets || []).map(d => ({
        name: d.name,
        rows: d.rows?.length ?? d.rowCount ?? 0,
        columns: d.columns?.length ?? d.columnCount ?? 0
      }));
      const counts = SN.projectService
        ? SN.projectService.summarize(project).counts
        : {};
      return {
        name: project.name,
        datasets,
        counts,

        excluded: ["Connection settings", "Chat credentials", "Cached results"],
        totalRows: datasets.reduce((sum, d) => sum + (d.rows || 0), 0)
      };
    },

    async run(project, { organizationId, visibility = "members", onStep } = {}) {
      const step = message => { try { onStep?.(message); } catch (e) {} };
      if (!organizationId) throw new ApiError("INVALID_INPUT", "Choose an organization first.");

      step("Creating the connected project");
      const created = await call("/projects", {
        method: "POST",
        body: {
          organizationId, visibility,
          name: project.name,
          description: project.description || "",
          migratedFrom: project.id
        }
      });
      const projectId = created.project.id;

      step("Uploading data");
      const uploaded = [];
      for (const dataset of project.datasets || []) {
        const csv = SN.platform?.datasetToCsv ? SN.platform.datasetToCsv(dataset) : null;
        if (!csv) continue;
        const file = new File([csv], `${dataset.name || "dataset"}.csv`, { type: "text/csv" });
        const result = await connectedRepository.upload(projectId, file, dataset.name);
        uploaded.push({ name: dataset.name, checksum: result.version.checksum, bytes: result.version.byteSize });
      }

      step("Copying findings and outputs");
      const artifacts = SN.artifacts ? SN.artifacts.list(project, {}) : [];
      let copied = 0;
      for (const artifact of artifacts) {
        if (artifact.type === "dataset") continue;
        try {
          await call(`/projects/${encodeURIComponent(projectId)}/artifacts`, {
            method: "POST",
            body: { type: artifact.type, title: artifact.title, body: artifact.body || {} }
          });
          copied += 1;
        } catch (error) {

          step(`Could not copy "${artifact.title || artifact.type}" — continuing`);
        }
      }

      step("Verifying");
      const remote = await connectedRepository.artifacts({ id: projectId });
      const verified = remote.length >= copied;

      return {
        ok: true,
        projectId,
        uploaded,
        copied,
        verified,

        message: verified
          ? "Copied. Your local project has not been changed and is still on this device."
          : "Copied, but some items could not be verified. Your local project has not been changed."
      };
    }
  };


  SN.connected = {
    STATUS,
    ApiError,
    call,
    probe,
    refresh,
    auth,
    organizations,
    migration,
    local: localRepository,
    remote: connectedRepository,
    repositoryFor,
    status: () => state.status,
    user: () => state.user,
    organizationId: () => state.organizationId,
    isConnected: () => state.status === STATUS.CONNECTED,
    available: () => state.available === true,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };


  const EVER_KEY = "sn_connected_ever";
  const worthProbing = () => {
    try {
      if (localStorage.getItem(EVER_KEY) === "1") return true;
    } catch (error) {}
    return /connect\.html$/.test(location.pathname);
  };


  listeners.add(() => {
    if (!state.user) return;
    try { localStorage.setItem(EVER_KEY, "1"); } catch (error) {}
  });

  if (root.addEventListener) {
    root.addEventListener("load", () => {
      if (!worthProbing()) return;
      setTimeout(() => { probe().then(available => { if (available) refresh(); }); }, 0);
    });
    root.addEventListener("online", () => { if (state.user) refresh(); });
    root.addEventListener("offline", () => { if (state.user) setStatus(STATUS.OFFLINE); });
  }
})(typeof window !== "undefined" ? window : globalThis);
