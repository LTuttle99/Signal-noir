


(function (root) {
  "use strict";

  const OLLAMA_URL = "http://127.0.0.1:11434";
  const PREF_KEY = "sn_vanessa_provider";
  const log = (...args) => { if (root.SignalNoir?.debug) console.debug("[vanessa:provider]", ...args); };

  function withTimeout(ms, signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    signal?.addEventListener("abort", () => controller.abort());
    return { signal: controller.signal, done: () => clearTimeout(timer) };
  }

  function parseJson(text) {
    const trimmed = String(text || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The model did not return JSON.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  const rules = {
    id: "rules", label: "Rules engine", kind: "rules", locality: "local", model: null,
    description: "Deterministic routing and templated wording. Every number comes from the analysis engine.",
    capabilities: { structured: true, streaming: false, tools: true }, contextWindow: null, status: "available",
    async detect() { return this; },
    async complete() { throw new Error("The rules engine does not generate text."); }
  };

  const chrome = {
    id: "chrome-ai", label: "Chrome built-in model", kind: "llm", locality: "device", model: "Gemini Nano",
    description: "Chrome’s on-device model (Prompt API). Runs locally when the browser provides it.",
    capabilities: { structured: true, streaming: true, tools: false }, contextWindow: 4096, status: "unavailable",
    async detect() {
      const api = root.LanguageModel || root.ai?.languageModel;
      if (!api) { this.status = "unavailable"; return this; }
      try {
        const availability = typeof api.availability === "function" ? await api.availability() : (await api.capabilities?.())?.available;
        this.status = availability === "available" || availability === "readily" ? "available" : availability === "unavailable" || availability === "no" ? "unavailable" : "requires-user";
      } catch (error) { this.status = "unavailable"; }
      return this;
    },
    async complete({ system, prompt, schema, signal, timeoutMs = 60000 }) {
      const api = root.LanguageModel || root.ai?.languageModel;
      const timer = withTimeout(timeoutMs, signal);
      signal = timer.signal;
      const session = await api.create({ initialPrompts: system ? [{ role: "system", content: system }] : undefined, systemPrompt: system, signal });
      try {
        const text = await session.prompt(prompt, schema ? { responseConstraint: schema, signal } : { signal });
        return schema ? parseJson(text) : text;
      } finally { session.destroy?.(); timer.done(); }
    }
  };

  const ollama = {
    id: "ollama", label: "Ollama on this computer", kind: "llm", locality: "device", model: null,
    description: `A model served by Ollama at ${OLLAMA_URL}. Requests never leave this machine.`,
    capabilities: { structured: true, streaming: true, tools: false }, contextWindow: 8192, status: "unavailable",
    models: [],
    async detect() {
      const timer = withTimeout(1200);
      try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: timer.signal });
        const data = response.ok ? await response.json() : null;
        this.models = (data?.models || []).map(model => model.name);
        this.model = this.models[0] || null;
        this.status = this.model ? "available" : "requires-user";
      } catch (error) { this.status = "unavailable"; }
      finally { timer.done(); }
      return this;
    },
    async complete({ system, prompt, schema, signal, onDelta, timeoutMs = 60000 }) {
      const timer = withTimeout(timeoutMs, signal);
      try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST", signal: timer.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.model, stream: false, format: schema || undefined, options: { temperature: schema ? 0 : .3, num_predict: schema ? 400 : 700 }, messages: [system && { role: "system", content: system }, { role: "user", content: prompt }].filter(Boolean) })
        });
        if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
        const data = await response.json();
        const text = data?.message?.content || "";
        onDelta?.(text);
        return schema ? parseJson(text) : text;
      } finally { timer.done(); }
    }
  };

  const webllm = {
    id: "webllm", label: "In-browser model (WebLLM)", kind: "llm", locality: "device", model: "Llama-3.2-1B-Instruct",
    description: "Runs inside the browser tab with WebGPU. The model download is started from a tool page’s help panel; it isn’t loaded inside Studio yet.",
    capabilities: { structured: false, streaming: true, tools: false }, contextWindow: 4096, status: "requires-user",
    async detect() { this.status = typeof navigator !== "undefined" && navigator.gpu ? "requires-user" : "unavailable"; return this; },
    async complete() { throw new Error("The in-browser model isn’t loaded in Studio."); }
  };

  const remote = {
    id: "remote-api", label: "Cloud AI provider", kind: "llm", locality: "remote", model: null,
    description: "Planned. Needs a server-side proxy so no API key ever ships to the browser, and an explicit per-project opt-in because data would leave the device.",
    capabilities: { structured: true, streaming: true, tools: true }, contextWindow: null, status: "planned",
    async detect() { return this; },
    async complete() { throw new Error("Cloud providers are not connected."); }
  };

  const providers = [rules, chrome, ollama, webllm, remote];
  let detected = null;

  async function detectAll() {
    if (!detected) detected = Promise.all(providers.map(provider => provider.detect().catch(() => provider))).then(() => providers);
    return detected;
  }

  function preferred() {
    let id = "rules";
    try { id = localStorage.getItem(PREF_KEY) || "rules"; } catch (error) {               }


    const access = root?.SignalNoir?.access;
    if (access && !access.can("vanessa.model")) return rules;
    const provider = providers.find(item => item.id === id);
    return provider && provider.status === "available" ? provider : rules;
  }

  function choose(id) {
    try { localStorage.setItem(PREF_KEY, id); } catch (error) {                }
    return preferred();
  }

  async function complete(options) {
    const provider = preferred();
    if (provider.kind !== "llm") throw new Error("No language model is selected.");
    const started = performance.now();
    try {
      const result = await provider.complete(options);
      log("complete", provider.id, `${Math.round(performance.now() - started)}ms`);
      return { provider, result };
    } catch (error) {
      log("failed", provider.id, error.message);
      throw error;
    }
  }

  const api = { list: () => providers, get: id => providers.find(item => item.id === id), detectAll, preferred, choose, complete, parseJson, PREF_KEY };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.SignalNoir = root.SignalNoir || {}; root.SignalNoir.providers = api; }
})(typeof window !== "undefined" ? window : globalThis);
