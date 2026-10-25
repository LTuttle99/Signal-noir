


(function () {
  "use strict";

  const NS = window.SignalNoirVanessa;
  const A = window.SignalNoir?.analysis;
  if (!NS?.context || !A) return;
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, eighteen: 18, "twenty-four": 24 };


  const ROUTES = [


    { intent: "project-status", label: "Review the project", patterns: [[/\b(what('?s| is)? (in|going on in)|summari[sz]e|catch me up on|status of|remind me about) (this|the|our|my) project\b/, 12], [/\bwhere (are we|did we (get|leave off))\b/, 10], [/\bcatch me up\b/, 9], [/\bproject (status|summary|overview)\b/, 10]] },
    { intent: "list-findings", label: "Saved findings", patterns: [[/\b(what|which) (are|were) the (most )?(important|key|main|top) findings?\b/, 12], [/\b(list|show|what are) (the |our |my |all )?(saved |existing )?findings?\b/, 11], [/\bwhat have we (found|learned|discovered)\b/, 10], [/\bfindings? (in|for) (this|the) project\b/, 10]] },
    { intent: "attention", label: "Needs attention", patterns: [[/\bwhat('?s| is)? (needs?|requires?) (my |your |our )?attention\b/, 12], [/\banything (that )?needs? (my |your |our )?attention\b/, 12], [/\b(show|any) (me )?(open )?alerts?\b/, 10], [/\bwhat('?s| is) (broken|wrong|failing)\b/, 9], [/\bmy inbox\b/, 10]] },
    { intent: "run-history", label: "Workflow runs", patterns: [[/\bwhy did .*(workflow|automation|run).*(fail|break)/, 13], [/\b(workflow|automation) (failures?|runs?|history)\b/, 11], [/\bdid (it|the \w+) run\b/, 10], [/\bwhat (ran|has run)\b/, 9], [/\blast (night'?s?|week'?s?) (run|workflow|automation)/, 11], [/\bsummari[sz]e .*(automation|workflow) (failures?|runs?)/, 11]] },
    { intent: "check-monitors", label: "Check monitors", patterns: [[/\bcheck (the )?monitors?\b/, 12], [/\b(are|is) (the )?(any )?(monitors?|thresholds?) (met|breached|exceeded|ok)\b/, 11], [/\bevaluate (the )?monitors?\b/, 11]] },
    { intent: "create-monitor", label: "Propose a monitor", patterns: [[/\b(create|add|set up|make) an? (monitor|alert|watch)\b/, 12], [/\b(warn|alert|notify) (me|us) (when|if)\b/, 11], [/\bwatch (this |the )?\w+ (for|and)\b/, 9], [/\bkeep an eye on\b/, 9]] },
    { intent: "open-work", label: "Outstanding work", patterns: [[/\bwhat('?s| is)? (still )?(unresolved|outstanding|open|left|pending|remaining)\b/, 12], [/\bwhat (do we|should we|is) still (need|needs|have) to\b/, 10], [/\b(open|outstanding|remaining) (tasks?|work|items?)\b/, 10], [/\bwhat('?s| is) next\b/, 7]] },
    { intent: "inspect", label: "Inspect the data", patterns: [[/\bwhat('?s| is)? (is )?in (this|the|my) (file|data|dataset|spreadsheet)/, 10], [/\b(describe|summari[sz]e|profile) (this|the|my) (file|data|dataset)/, 8], [/\bwhat (columns|fields)\b/, 8], [/\btell me about (this|the) (file|data)/, 8]] },
    { intent: "question", label: "Answer a question", patterns: [[/\bwhich (numeric )?(column|field|measure)s? (has|have) the (highest|largest|biggest|lowest|smallest)/, 12], [/\b(which|what) \w+ (performed|did|was|is|had|has) (the )?(best|worst|highest|lowest|most|least)/, 9], [/\b(total|sum|average|avg|mean|median|count|how many|maximum|minimum|highest|lowest)\b/, 4], [/\bby [a-z_ ]+\??$/, 3]] },
    { intent: "compare-files", label: "Compare datasets", patterns: [[/\bcompare\b.*\b(files?|spreadsheets?|versions?|exports?|datasets?|sheets?)\b/, 10], [/\bdiff(erence)? between\b/, 8], [/\bwhat changed between\b/, 10], [/^compare (these|them|both)\b/, 9], [/\b(investigate|look into|explain|understand) (these|those|the) changes\b/, 9], [/\b(these|those) changes\b/, 6]], when: env => env.datasetCount > 1 },
    { intent: "combine", label: "Combine files", patterns: [[/\b(combine|stack|append|union|consolidate)\b/, 9], [/\bmerge (these|the|my|them|all)\b/, 7], [/\bput (them|these) together\b/, 7]] },
    { intent: "join", label: "Join datasets", patterns: [[/\bjoin\b/, 9], [/\b(lookup|vlookup|match (rows|records) (on|by))\b/, 8], [/\busing \S+ and \S+$/, 3]] },
    { intent: "compare-periods", label: "Find what changed", patterns: [[/\bwhy did\b.*\b(drop|fall|fell|declin|decreas|rise|rose|grow|grew|increas|spike|change)/, 12], [/\b(this|last|previous) (month|quarter|week|year)\b/, 6], [/\b(month|quarter|year|week) over (month|quarter|year|week)\b/, 9], [/\b(mom|qoq|yoy)\b/, 8], [/\bwhat changed\b/, 7], [/\bbiggest changes?\b/, 6]] },
    { intent: "clean", label: "Clean the data", patterns: [[/\bclean\b/, 9], [/\b(get rid of|remove|drop|dedup\w*) (the )?duplicates?\b/, 11], [/\bduplicates?\b/, 5], [/\b(messy|tidy|missing values|blanks?|whitespace|standardi[sz]e|typos?)\b/, 6], [/\bwhat('?s| is) wrong with\b/, 8], [/\bquality\b/, 5]] },
    { intent: "statistics", label: "Run a statistical test", patterns: [[/\b(statistical(ly)?|significan\w*|p[- ]?value|t[- ]?test|anova|chi[- ]?square|regression|correlat\w*)\b/, 10], [/\bare (these|the|they)? ?\w* ?(groups )?(actually |really )?different\b/, 11], [/\bis \w+ (related|linked) to\b/, 9], [/\bdifferent across\b/, 9]] },
    { intent: "forecast", label: "Forecast", patterns: [[/\bforecast|predict|projection|project(ed)? (sales|revenue|growth)\b/, 10], [/\bwhat happens next\b/, 10], [/\bnext (\w+ )?(months?|quarters?|years?|weeks?)\b/, 7], [/\bwhat will\b/, 6]] },
    { intent: "anomalies", label: "Find anomalies", patterns: [[/\b(anomal\w*|outliers?|unusual|odd|weird|spikes?|suspicious)\b/, 9], [/\bfind (anything|something) (unusual|strange|interesting)\b/, 11], [/\bpatterns?\b/, 4]] },
    { intent: "dashboard", label: "Build a dashboard", patterns: [[/\bdashboard\b/, 11], [/\bsomething (visual|to show)\b/, 4]] },
    { intent: "report", label: "Create a report", patterns: [[/\breport\b/, 10], [/\b(brief(ing)?|executive summary|write.?up|summary for)\b/, 8], [/\b(show|present|send) (to )?my (boss|manager|team)\b/, 9], [/\bsomething i can show\b/, 9]] },
    { intent: "automate", label: "Automate recurring analysis", patterns: [[/\b(every|each) (day|week|month|quarter)\b/, 9], [/\b(recurring|automat\w*|schedul\w*|repeatable)\b/, 9]] },
    { intent: "chart", label: "Create a chart", patterns: [[/\b(chart|graph|plot|visuali[sz]e)\b/, 7], [/\bover time\b/, 8]] },
    { intent: "search", label: "Search the project", patterns: [[/\b(search|look up|find) (for )?.+ in (the |this |my )?project\b/, 11], [/\bwhere (did|is) (i|we|my)\b/, 6]] },
    { intent: "explain", label: "Explain the data", patterns: [[/\bexplain\b/, 7], [/\bwhat do(es)? (this|these) (number|mean)/, 8], [/\bmake sense of\b/, 8]] },
    { intent: "analyze", label: "Analyze the data", patterns: [[/\banaly[sz]e\b/, 8], [/\b(explore|insights?|overview|look at)\b/, 5], [/\bbiggest\b/, 2]] }
  ];

  const norm = text => String(text || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();


  function entities(prompt, dataset) {
    const text = norm(prompt);
    const out = { grain: null, horizon: null, filters: [], op: null, measure: null, dimension: null, time: null, columns: [] };
    out.grain = /\bquarter/.test(text) ? "quarter" : /\bweek/.test(text) ? "week" : /\b(year|annual)/.test(text) ? "year" : /\bmonth/.test(text) ? "month" : null;
    const horizon = text.match(/\bnext (\w+|\d+) (months?|quarters?|weeks?|years?)\b/);
    if (horizon) { const n = Number(horizon[1]) || WORD_NUMBERS[horizon[1]] || 1; const unit = horizon[2].replace(/s$/, ""); out.horizon = unit === "quarter" ? n * 3 : unit === "year" ? n * 12 : n; out.grain = unit === "week" ? "week" : "month"; }
    else if (/\bnext quarter\b/.test(text)) { out.horizon = 3; out.grain = "month"; }
    else if (/\bnext year\b/.test(text)) { out.horizon = 12; out.grain = "month"; }
    out.op = /\b(average|avg|mean)\b/.test(text) ? "mean" : /\b(count|how many|number of)\b/.test(text) ? "count" : /\b(max|maximum|highest|largest)\b/.test(text) ? "max" : /\b(min|minimum|lowest|smallest)\b/.test(text) ? "min" : /\b(total|sum)\b/.test(text) ? "sum" : null;
    if (!dataset) return out;
    const prof = NS.context.profileOf(dataset);
    out.columns = prof.columns.map(col => col.name).filter(name => A.mentioned(prompt, [name]));
    out.measure = A.mentioned(prompt, prof.measures);
    out.dimension = A.mentioned(prompt, prof.dimensions);
    out.time = A.mentioned(prompt, prof.times);

    prof.columns.filter(col => col.type === "category" && col.top).forEach(col => col.top.forEach(({ value }) => {
      const v = String(value).trim();
      if (v.length > 1 && new RegExp(`\\b(for|in|within|only|where)\\s+(the\\s+)?${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(prompt)) out.filters.push({ column: col.name, op: "=", value: v });
    }));
    const explicit = [...prompt.matchAll(/\bwhere\s+([\w ]+?)\s*(=|!=|>=|<=|>|<)\s*([\w.$-]+)/gi)];
    explicit.forEach(match => { const column = dataset.columns.find(name => name.toLowerCase() === match[1].trim().toLowerCase()); if (column) out.filters.push({ column, op: match[2], value: match[3] }); });
    return out;
  }


  function memoryCommand(prompt, env) {
    const text = norm(prompt);
    const fiscal = text.match(/\bfiscal year (starts|begins|start|begin)( in)? (\w+)/);
    if (fiscal) {
      const month = MONTHS.findIndex(name => name.startsWith(fiscal[3].slice(0, 3))) + 1;
      if (month) return { tool: "remember", args: { key: "fiscal-year-start", label: "Fiscal year starts", value: String(month), kind: "preference" }, label: `Remember fiscal year starts in ${MONTHS[month - 1]}` };
    }
    const define = prompt.match(/^\s*define\s+(.+?)\s+as\s+(.+?)\s*\.?$/i) || prompt.match(/^\s*([A-Za-z][\w ]{1,40}?)\s*=\s*((?:SUM|AVG|MIN|MAX|COUNTD?|MEAN)\s*\(.+)$/i);
    if (define) {
      if (/\b(SUM|AVG|MIN|MAX|COUNTD?|MEAN)\s*\(/i.test(define[2])) return { tool: "define_metric", args: { name: define[1].trim(), formula: define[2].trim() }, label: `Define metric ${define[1].trim()}` };
      return { tool: "remember", args: { key: `definition:${norm(define[1])}`, label: define[1].trim(), value: define[2].trim(), kind: "definition" }, label: `Remember the definition of ${define[1].trim()}` };
    }
    const remember = prompt.match(/^\s*(please\s+)?(remember|note|keep in mind)( that)?\s+(.+?)\.?\s*$/i);
    if (remember) {
      const body = remember[4];
      const pair = body.match(/^(.+?)\s+(?:is|are|=|means)\s+(.+)$/i);
      return { tool: "remember", args: pair ? { key: `note:${norm(pair[1])}`, label: pair[1].trim(), value: pair[2].trim(), kind: /target|goal/i.test(pair[1]) ? "preference" : "definition" } : { label: "Note", value: body.trim(), kind: "note" }, label: "Remember for this project" };
    }
    if (/\buse (the )?cleaned (version|copy|data)( instead)?\b/.test(text)) {
      const cleaned = [...env.project.datasets].reverse().find(dataset => dataset.source === "vanessa-clean");
      if (cleaned) return { tool: "remember", args: { key: "preferred-dataset", label: "Preferred dataset", value: cleaned.id, display: cleaned.name, kind: "preference" }, label: `Use ${cleaned.name} from now on`, rerun: true };
    }
    return null;
  }


  function followUp(prompt, focus, env) {
    const text = norm(prompt);
    const short = text.split(" ").length <= 9;
    const hasFocus = Boolean(focus && (focus.measure || focus.lastChart || focus.lastFindingIds?.length));
    if (!hasFocus) return null;
    const by = text.match(/^(?:now |and )?(?:break (?:that|it|this|them) down|split (?:that|it|this)|group (?:that|it|this))? ?by ([a-z0-9 _-]+?)\??$/) || text.match(/\bbreak (?:that|it|this|them|\w+) down by ([a-z0-9 _-]+?)\??$/);
    if (by && (text.startsWith("by ") || /break|split|group|now/.test(text))) {
      const dimension = env.prof && (A.mentioned(` ${by[1]} `, env.prof.dimensions) || A.mentioned(` ${by[1]} `, env.prof.columns.map(col => col.name)));
      return { intent: "breakdown", label: "Break it down", steps: [{ tool: "breakdown", args: { measure: A.mentioned(prompt, env.prof?.measures || []) || focus.measure, dimension, filters: focus.subjectItem && /that|it|this/.test(text) && focus.subjectItem.dimension !== dimension ? [{ column: focus.subjectItem.dimension, op: "=", value: focus.subjectItem.label }] : focus.filters || [] } }], reason: "a follow-up on the current result" };
    }


    if (/\b(workflow|automation|run|job|schedule)\b/.test(text) && /\b(fail|failed|break|broke|error|stop|stopped)\b/.test(text)) return null;
    if (/^(why|how come|what (caused|drove|explains) (that|this|it))\b/.test(text) && short) return { intent: "explain-why", label: "Explain why", steps: [{ tool: "explain_subject", args: {} }], reason: `explaining ${focus.subjectItem?.label || focus.subject || "the last result"}` };
    if (/\bover time\b/.test(text) && short) return { intent: "trend", label: "Show over time", steps: [{ tool: "trend", args: { measure: focus.measure, filters: focus.filters || [] } }], reason: "a follow-up on the current result" };
    if (/\b(chart|graph|plot|visuali[sz]e)\b/.test(text) && (/\b(that|this|it|those|these|as a)\b/.test(text) || short)) return { intent: "chart", label: "Create a chart", steps: [{ tool: "create_chart", args: {} }], reason: "charting the last result" };
    if (/\b(put|add|turn|make)\b.*\b(into|to|in|a)\b.*\breport\b/.test(text) || /^(make|turn) (that|this|it) (into )?a report/.test(text)) return { intent: "report", label: "Create a report", steps: [{ tool: "create_report", args: {} }], reason: "using this conversation’s findings" };
    if (/\b(make|turn) (that|this|it|those) (into )?a dashboard\b/.test(text)) return { intent: "dashboard", label: "Build a dashboard", steps: [{ tool: "create_dashboard", args: {} }], reason: "from the current result" };
    if (/^(save|keep|pin) (that|this|those|these|it)\b/.test(text)) return { intent: "save", label: "Save findings", steps: [{ tool: "save_findings", args: {} }], reason: "saving the last findings" };
    if (/\bis (this|that|it|the change|this change) (good|bad|normal|ok|okay|unusual|a problem|significant|worrying|big)\b/.test(text) || /^is this change unusual\??$/.test(text)) return { intent: "assess", label: "Judge the result", steps: [{ tool: "assess_change", args: {} }], reason: "judging the last change against history" };
    return null;
  }

  function rerunOnOther(prompt, env) {
    if (!/\b(same|that) (thing|analysis|again)?\s*(on|for|with) (the )?(other|second|next) (file|dataset|one)\b|\brun (it|that|the same thing) on the other\b/.test(norm(prompt))) return null;
    const last = env.lastRun;
    const other = env.project.datasets.find(dataset => dataset.id !== (env.focus.datasetId || env.dataset?.id));
    if (!last || !other) return null;
    return { rerun: last.prompt, datasetId: other.id, label: `Repeat on ${other.name}` };
  }


  function score(prompt, env) {
    const text = norm(prompt);
    return ROUTES.map(route => {
      let total = 0;
      const hits = [];
      route.patterns.forEach(([pattern, weight]) => { if (pattern.test(text)) { total += weight; hits.push(String(pattern)); } });
      if (route.when && !route.when(env)) total *= .4;
      if (route.intent === "compare-periods" && total && !env.hasTime) total *= .7;
      if (route.intent === "compare-files" && env.datasetCount > 1 && /\bcompare\b/.test(text)) total += 3;
      if (route.intent === "combine" && env.datasetCount < 2) total *= .3;
      if (route.intent === "question" && env.entities.columns.length) total += 2;
      if (route.intent === "evaluate-metric") total = 0;
      return { ...route, score: total, hits };
    }).filter(route => route.score > 0).sort((a, b) => b.score - a.score);
  }

  function metricRoute(prompt, env) {
    const text = norm(prompt);
    const metric = (env.project.metrics || []).find(item => text.includes(norm(item.name)));
    if (metric) return { intent: "metric", label: `Calculate ${metric.name}`, steps: [{ tool: "evaluate_metric", args: { name: metric.name } }], reason: "a project metric definition matches" };
    const asked = text.match(/\bwhat('?s| is| are) (our|the|my) ([a-z ]+?(rate|ratio|margin|retention|churn|conversion|aov|ltv))\??$/);
    if (asked) return { intent: "metric", label: `Calculate ${asked[3]}`, steps: [{ tool: "evaluate_metric", args: { name: asked[3] } }], reason: "a business metric was requested" };
    return null;
  }

  function splitClauses(prompt) {
    const parts = prompt.split(/\s*(?:,|;|\bthen\b|\band then\b|\bafter that\b)\s*(?:and\s+)?|\s+and\s+(?=(?:clean|combine|merge|join|compare|make|create|build|forecast|find|show|put|chart|report|remove|get rid)\b)/i).map(part => part.trim()).filter(part => part.split(" ").length >= 2);
    return parts.length > 1 ? parts : [prompt];
  }


  function route(prompt, env) {
    const mem = memoryCommand(prompt, env);
    if (mem) return { kind: "plan", intent: "memory", label: mem.label, steps: [{ tool: mem.tool, args: mem.args }], confidence: 1, reason: "an instruction to remember", rerun: mem.rerun };
    const rerun = rerunOnOther(prompt, env);
    if (rerun) return { kind: "rerun", ...rerun, confidence: .9, reason: "repeat the last request on the other dataset" };
    const follow = followUp(prompt, env.focus, env);
    if (follow) return { kind: "plan", confidence: .9, ...follow };
    const metric = metricRoute(prompt, env);
    if (metric) return { kind: "plan", confidence: .8, ...metric };

    const clauses = splitClauses(prompt);
    if (clauses.length > 1) {
      const routed = clauses.map(clause => ({ clause, best: score(clause, { ...env, entities: entities(clause, env.dataset) })[0] })).filter(item => item.best && item.best.score >= 6);
      if (routed.length > 1) return { kind: "plan", intent: "multi", label: "Multi-step request", clauses: routed.map(item => ({ intent: item.best.intent, text: item.clause, label: item.best.label })), confidence: .8, reason: `${routed.length} tasks in one request` };
    }

    const ranked = score(prompt, env);
    const [top, second] = ranked;
    if (top && (top.score >= 7 || (top.score >= 4 && (!second || top.score - second.score >= 3)))) return { kind: "plan", intent: top.intent, label: top.label, confidence: Math.min(1, top.score / 12), reason: top.hits.length ? "matched request wording" : "context" };
    if (env.dataset && env.entities.columns.length && top?.intent === "question") return { kind: "plan", intent: "question", label: "Answer a question", confidence: .5, reason: "column names in the request" };
    return { kind: "clarify", candidates: ranked.slice(0, 3).map(item => ({ intent: item.intent, label: item.label })), confidence: top ? top.score / 12 : 0 };
  }


  let modelRoutingOff = false;
  async function modelRoute(prompt, env, signal) {
    const providers = window.SignalNoir.providers;
    const provider = providers?.preferred();
    if (!provider || provider.kind !== "llm" || modelRoutingOff) return null;

    const all = NS.registry.describeForModel();
    const words = norm(prompt).split(/[^a-z0-9]+/).filter(word => word.length > 3);
    const scored = all.map(tool => ({ tool, hits: words.filter(word => `${tool.id} ${tool.description}`.toLowerCase().includes(word)).length }));
    const core = ["inspect_dataset", "aggregate", "breakdown", "compare_periods", "compare_datasets", "audit_quality", "forecast", "detect_anomalies", "create_chart", "create_report"];
    const tools = [...new Set([...scored.filter(item => item.hits).sort((a, b) => b.hits - a.hits).map(item => item.tool), ...all.filter(tool => core.includes(tool.id))])].slice(0, 12)
      .map(tool => ({ id: tool.id, description: tool.description.slice(0, 90), inputs: tool.inputs }));
    const schema = { type: "object", properties: { tool: { type: "string", enum: tools.map(tool => tool.id) }, arguments: { type: "object" }, explanation: { type: "string" } }, required: ["tool", "arguments", "explanation"] };
    const system = "You route analytics requests for Signal Noir. Pick exactly one tool id from the list and fill arguments using column names from the context. Never invent columns or numbers. Reply with JSON only.";

    const started = performance.now();
    const { result } = await providers.complete({ timeoutMs: 20000, system, prompt: `Tools: ${JSON.stringify(tools)}\nContext (schema only, no rows): ${NS.context.modelSummary()}\nRequest: ${prompt}`, schema, signal });
    if (performance.now() - started > 15000) { modelRoutingOff = true; console.debug("[vanessa] model routing is too slow on this machine; using rules for the rest of this session"); }
    const tool = NS.registry.get(result?.tool);
    if (!tool || tool.availability !== "available") { console.debug("[vanessa] model suggested an unusable tool", result?.tool); return null; }
    const args = Object.fromEntries(Object.entries(result.arguments || {}).filter(([name]) => name in tool.inputs));
    const check = NS.registry.validate(tool.id, args, { dataset: env.dataset, datasetCount: env.datasetCount });
    if (!check.ok) { console.debug("[vanessa] model arguments rejected", check.errors); return null; }
    return { kind: "plan", intent: `tool:${tool.id}`, label: tool.name, steps: [{ tool: tool.id, args }], confidence: .6, reason: `chosen by ${provider.label}: ${String(result.explanation || "").slice(0, 160)}`, provider: provider.id };
  }

  NS.router = { route, modelRoute, entities, score, splitClauses, ROUTES, disableModelRouting: () => { modelRoutingOff = true; } };
})();
