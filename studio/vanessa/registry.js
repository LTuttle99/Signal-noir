


(function () {
  "use strict";

  const NS = window.SignalNoirVanessa = window.SignalNoirVanessa || {};
  const tools = new Map();
  const CATEGORIES = { inspect: "Inspect", prepare: "Prepare", analyze: "Analyze", statistics: "Statistics", visualize: "Visualize", build: "Build", act: "Act", project: "Project" };


  const access = () => window.SignalNoir?.access || null;
  function permitted(tool) {
    const a = access();
    return !a || !tool.capability || a.can(tool.capability);
  }

  function register(def) {
    if (!def?.id || tools.has(def.id)) throw new Error(`Tool ${def?.id} is missing or already registered`);
    const tool = { category: "analyze", inputs: {}, requires: [], output: "result", modifiesData: false, confirm: false, availability: "available", locality: "local", relatedTool: null, ...def };
    if (tool.capability === undefined) tool.capability = access()?.requiredFor("vanessa", tool.id) || null;
    if (tool.availability === "available" && typeof tool.run !== "function") throw new Error(`Tool ${tool.id} is available but has no run()`);
    tools.set(tool.id, tool);
    return tool;
  }

  function get(id) { return tools.get(id) || null; }


  function list(filter = {}) {
    return [...tools.values()].filter(tool => (!filter.availability || tool.availability === filter.availability) && (!filter.category || tool.category === filter.category) && (filter.all === true || permitted(tool)));
  }
  function allows(id) { const tool = get(id); return Boolean(tool) && permitted(tool); }

  function refusal(id) {
    const tool = get(id);
    const a = access();
    const cap = tool?.capability ? a?.capability(tool.capability) : null;
    const info = a?.summary();
    return {
      capability: tool?.capability || null,
      title: `${cap?.name || tool?.name || "That"} isn’t part of your access`,
      text: info?.preview
        ? `You’re previewing as ${info.preview.name}, and that profile doesn’t include ${cap ? cap.name.toLowerCase() : "this"}. I can still work with the capabilities it does include.`
        : `Your current access profile doesn’t include ${cap ? cap.name.toLowerCase() : "this"}. I can still analyze the data using the capabilities available to you. Ask an organization administrator if you need it.`
    };
  }


  function validate(id, args = {}, env = {}) {
    const tool = get(id);
    if (!tool) return { ok: false, errors: [`Unknown tool “${id}”.`] };
    if (!permitted(tool)) return { ok: false, restricted: refusal(id), errors: [refusal(id).text] };
    if (tool.availability !== "available") return { ok: false, errors: [`${tool.name} isn’t something Vanessa can run by herself (${tool.availability}).`] };
    const errors = [];
    for (const [name, spec] of Object.entries(tool.inputs)) {
      const value = args[name];
      if (value == null || value === "") { if (spec.required) errors.push(`${tool.name} needs ${spec.label || name}.`); continue; }
      if (spec.type === "column" && env.dataset && !env.dataset.columns.includes(value)) errors.push(`“${value}” isn’t a column in ${env.dataset.name}.`);
      if (spec.type === "enum" && spec.values && !spec.values.includes(value)) errors.push(`${spec.label || name} must be one of ${spec.values.join(", ")}.`);
      if (spec.type === "number" && !Number.isFinite(Number(value))) errors.push(`${spec.label || name} must be a number.`);
    }
    if (tool.requires.includes("dataset") && !env.dataset) errors.push("There is no dataset to work on yet.");
    if (tool.requires.includes("two-datasets") && (env.datasetCount || 0) < 2) errors.push("This needs at least two datasets in the project.");
    return { ok: !errors.length, errors };
  }


  function describeForModel() {
    return list({ availability: "available" }).filter(tool => tool.routable !== false).map(tool => ({ id: tool.id, description: tool.description, inputs: Object.fromEntries(Object.entries(tool.inputs).map(([name, spec]) => [name, `${spec.type}${spec.required ? " (required)" : ""}`])) }));
  }

  NS.registry = { register, get, list, validate, describeForModel, allows, refusal, CATEGORIES };
})();
