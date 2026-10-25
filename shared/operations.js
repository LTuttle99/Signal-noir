


(function (root) {
  "use strict";

  const SN = root.SignalNoir = root.SignalNoir || {};
  const artifacts = () => SN.artifacts || null;
  const access = () => SN.access || null;
  const analysis = () => SN.analysis || null;

  const arr = value => Array.isArray(value) ? value : [];
  const str = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;


  const num = value => {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

  const SCHEMA_VERSION = 4;


  const TRIGGERS = [
    { id: "manual", label: "When someone runs it", runs: "now",
      description: "A reusable process you start with one click. Nothing happens on its own." },
    { id: "local-schedule", label: "On a schedule, while Signal Noir is open", runs: "local",
      description: "Checked whenever Studio is open. If the time passes while Signal Noir is closed, the run is recorded as missed and you decide whether to run it." },
    { id: "data-arrival", label: "When data is imported", runs: "now",
      description: "Runs when a matching dataset is added to or replaced in this project." },
    { id: "condition", label: "When a monitor's condition is met", runs: "now",
      description: "Runs when a monitor you choose reports that its condition has been met." },
    { id: "cloud-schedule", label: "On a schedule, unattended", runs: "planned",
      description: "True background execution on a timetable, whether or not anyone has Signal Noir open. This needs a trusted server that Signal Noir does not have yet; you can describe the schedule now, and nothing will claim to have run." }
  ];
  const trigger = id => TRIGGERS.find(item => item.id === id) || null;
  const triggerRunsLocally = id => ["manual", "local-schedule", "data-arrival", "condition"].includes(id);

  const AUTOMATION_STATUS = [
    { id: "draft", label: "Draft", description: "Being configured. Nothing runs." },
    { id: "active", label: "Active", description: "Running on its trigger." },
    { id: "paused", label: "Paused", description: "Configuration kept; nothing runs until resumed." },
    { id: "needs-attention", label: "Needs attention", description: "The last run failed, or the configuration is incomplete." },
    { id: "disabled", label: "Disabled", description: "Switched off and not expected to run." }
  ];

  const RUN_STATUS = [
    { id: "running", label: "Running", tone: "info" },
    { id: "waiting-input", label: "Waiting for input", tone: "warning" },
    { id: "waiting-approval", label: "Waiting for approval", tone: "warning" },
    { id: "succeeded", label: "Succeeded", tone: "success" },
    { id: "warnings", label: "Succeeded with warnings", tone: "warning" },
    { id: "failed", label: "Failed", tone: "danger" },
    { id: "cancelled", label: "Cancelled", tone: "muted" },
    { id: "missed", label: "Missed", tone: "muted" }
  ];
  const runStatus = id => RUN_STATUS.find(item => item.id === id) || RUN_STATUS[0];


  const OPERATORS = [
    { id: "gt", label: "is above", needsValue: true, describe: (a, b) => `${a} above ${b}` },
    { id: "gte", label: "is at or above", needsValue: true, describe: (a, b) => `${a} at or above ${b}` },
    { id: "lt", label: "is below", needsValue: true, describe: (a, b) => `${a} below ${b}` },
    { id: "lte", label: "is at or below", needsValue: true, describe: (a, b) => `${a} at or below ${b}` },
    { id: "eq", label: "equals", needsValue: true, describe: (a, b) => `${a} equal to ${b}` },
    { id: "neq", label: "does not equal", needsValue: true, describe: (a, b) => `${a} not equal to ${b}` },
    { id: "pct_change_above", label: "rises by more than (%)", needsValue: true, describe: (a, b) => `${a} up more than ${b}%` },
    { id: "pct_change_below", label: "falls by more than (%)", needsValue: true, describe: (a, b) => `${a} down more than ${b}%` },
    { id: "pct_change_outside", label: "changes by more than (%) either way", needsValue: true, describe: (a, b) => `${a} changed more than ${b}%` },
    { id: "stale_by", label: "has not been updated in (hours)", needsValue: true, describe: (a, b) => `${a} older than ${b}h` },
    { id: "missing_above", label: "has missing values above (%)", needsValue: true, describe: (a, b) => `${a} missing above ${b}%` },
    { id: "quality_below", label: "quality score falls below", needsValue: true, describe: (a, b) => `${a} quality below ${b}` },
    { id: "run_failed", label: "the last run failed", needsValue: false, describe: a => `${a} last run failed` }
  ];
  const operator = id => OPERATORS.find(item => item.id === id) || null;


  function evaluateCondition({ op, value, threshold, previous }) {
    const spec = operator(op);
    if (!spec) return { met: false, value: null, threshold, reason: `Unknown condition “${op}”.`, comparable: false };
    const current = num(value);
    const limit = num(threshold);
    const before = num(previous);
    const fail = reason => ({ met: false, value: current, threshold: limit, reason, comparable: false });

    if (op === "run_failed") return { met: value === "failed" || value === true, value, threshold: null, reason: value === "failed" || value === true ? "The last run failed." : "The last run did not fail.", comparable: true };
    if (spec.needsValue && limit === null) return fail("No threshold is set for this condition.");
    if (current === null) return fail("There is no value to compare yet.");

    const pctChange = before === null || before === 0 ? null : ((current - before) / Math.abs(before)) * 100;

    const show = value => value == null ? "—" : Number.isInteger(value) ? value.toLocaleString() : Number(value.toFixed(2)).toLocaleString();
    const now = show(current), lim = show(limit), was = show(before);
    switch (op) {
      case "gt": return done(current > limit, `${now} is ${current > limit ? "above" : "not above"} ${lim}`);
      case "gte": return done(current >= limit, `${now} is ${current >= limit ? "at or above" : "below"} ${lim}`);
      case "lt": return done(current < limit, `${now} is ${current < limit ? "below" : "not below"} ${lim}`);
      case "lte": return done(current <= limit, `${now} is ${current <= limit ? "at or below" : "above"} ${lim}`);
      case "eq": return done(current === limit, `${now} ${current === limit ? "equals" : "does not equal"} ${lim}`);
      case "neq": return done(current !== limit, `${now} ${current !== limit ? "does not equal" : "equals"} ${lim}`);
      case "stale_by": return done(current > limit, `Last updated ${current.toFixed(1)}h ago; the limit is ${lim}h`);
      case "missing_above": return done(current > limit, `${current.toFixed(1)}% missing; the limit is ${lim}%`);
      case "quality_below": return done(current < limit, `Quality score ${now}; the floor is ${lim}`);
      case "pct_change_above":
      case "pct_change_below":
      case "pct_change_outside": {
        if (pctChange === null) return fail("There is no earlier value to compare against yet.");
        const met = op === "pct_change_above" ? pctChange > limit
          : op === "pct_change_below" ? pctChange < -limit
          : Math.abs(pctChange) > limit;
        return { met, value: current, threshold: limit, previous: before, change: pctChange, comparable: true, reason: `${pctChange >= 0 ? "Up" : "Down"} ${Math.abs(pctChange).toFixed(1)}% from ${was} to ${now}; the limit is ${lim}%` };
      }
      default: return fail(`Condition “${op}” is not implemented.`);
    }
    function done(met, reason) { return { met, value: current, threshold: limit, previous: before, change: pctChange, reason, comparable: true }; }
  }

  function describeCondition(monitor) {
    const spec = operator(monitor.op);
    const subject = monitor.measure ? `${monitor.measure}${monitor.aggregate && monitor.aggregate !== "sum" ? ` (${monitor.aggregate})` : ""}` : monitor.name;
    if (!spec) return monitor.name;
    return spec.needsValue ? `${subject} ${spec.label} ${monitor.threshold}` : `${subject}: ${spec.label}`;
  }


  const DETAILED_RUNS = 30;
  const RUN_LIMIT = 200;

  function shape(project) {
    if (!project || typeof project !== "object") return project;
    artifacts()?.shape(project);
    for (const key of ["workflows", "automations", "workflowRuns", "monitors", "alerts"]) {
      if (!Array.isArray(project[key])) project[key] = [];
    }


    if (arr(project.steps).length && !project.workflows.some(item => item.migratedFromSteps)) {
      project.workflows.push({
        id: uid("workflow"), name: `${project.name} workflow`, description: "Migrated from this project's original step list.",
        version: 1, steps: project.steps.map(step => ({ id: step.id || uid("step"), type: step.type, name: step.name, detail: step.detail })),
        history: [], status: "draft", approved: false, createdAt: project.createdAt || Date.now(), updatedAt: Date.now(),
        createdBy: "", migratedFromSteps: true
      });
    }

    arr(project.alertRules).forEach(rule => {
      if (project.monitors.some(item => item.migratedFromRule === rule.id)) return;
      project.monitors.push({
        id: uid("monitor"), name: rule.name || `${rule.field} threshold`, kind: "metric-threshold",
        datasetId: project.activeDatasetId || null, measure: rule.field, aggregate: "sum",
        op: rule.operator === "lt" ? "lt" : "gt", threshold: num(rule.threshold), severity: "warning",
        status: rule.active === false ? "paused" : "active", owner: "", workflowId: null,
        lastCheckedAt: rule.lastTriggeredAt || null, lastValue: null, previousValue: null,
        createdAt: Date.now(), migratedFromRule: rule.id
      });
    });
    project.workflows.forEach(workflow => {
      if (!Array.isArray(workflow.steps)) workflow.steps = [];
      if (!Array.isArray(workflow.history)) workflow.history = [];
      if (!Number.isFinite(Number(workflow.version))) workflow.version = 1;
    });
    project.automations.forEach(automation => {
      if (!AUTOMATION_STATUS.some(item => item.id === automation.status)) automation.status = "draft";
      if (!Array.isArray(automation.requiredCapabilities)) automation.requiredCapabilities = [];
    });
    return project;
  }


  const STEP_TYPES = [
    { id: "require-data", label: "Require a dataset", gate: true, description: "Stop unless the workflow has data to work on." },
    { id: "validate-schema", label: "Validate columns", gate: true, description: "Stop unless the required columns are present.", inputs: ["columns"] },
    { id: "check-rows", label: "Check row count", gate: true, description: "Stop if the dataset has fewer rows than expected.", inputs: ["minRows"] },
    { id: "check-freshness", label: "Check data freshness", gate: true, description: "Stop if the dataset is older than the limit.", inputs: ["maxAgeHours"] },
    { id: "quality-check", label: "Run quality checks", gate: false, description: "Report blanks, duplicates and type problems as warnings." },
    { id: "compare-periods", label: "Compare with the previous period", gate: false, description: "Period-over-period movement for a measure.", inputs: ["measure"] },
    { id: "aggregate", label: "Calculate a measure", gate: false, description: "A total, average or count, optionally by a dimension.", inputs: ["measure", "aggregate", "dimension"] },
    { id: "save-finding", label: "Save the result as a finding", gate: false, description: "Keep the calculated result in the project with its evidence." },
    { id: "build-report", label: "Prepare a report", gate: false, description: "Assemble this run's findings into a report artifact." },
    { id: "alert-if", label: "Raise an alert if", gate: false, description: "Create an alert when a condition is met.", inputs: ["op", "threshold", "severity"] },
    { id: "create-task-if", label: "Create a task if", gate: false, description: "Create a follow-up task when a condition is met.", inputs: ["op", "threshold", "assignee"] },
    { id: "approval", label: "Wait for approval", gate: true, description: "Pause the run and put it in the inbox until somebody approves." }
  ];
  const stepType = id => STEP_TYPES.find(item => item.id === id) || null;

  const workflows = {
    list(project) { return shape(project).workflows.slice(); },
    get(project, id) { return shape(project).workflows.find(item => item.id === id) || null; },
    create(project, { name, description = "", steps = [], createdBy = "" } = {}) {
      const p = shape(project);
      const workflow = {
        id: uid("workflow"), name: str(name, "Untitled workflow"), description: str(description, ""),
        version: 1, steps: arr(steps).map(step => ({ id: uid("step"), ...step })), history: [],
        status: "draft", approved: false, createdAt: Date.now(), updatedAt: Date.now(),
        createdBy: createdBy || artifacts()?.actorName() || ""
      };
      p.workflows.unshift(workflow);
      artifacts()?.recordActivity(p, { type: "workflow-created", text: `Workflow created: ${workflow.name}`, artifactId: workflow.id, artifactType: "workflow" });
      return workflow;
    },


    update(project, id, patch = {}) {
      const p = shape(project);
      const workflow = p.workflows.find(item => item.id === id);
      if (!workflow) return null;
      const changesLogic = patch.steps && JSON.stringify(patch.steps) !== JSON.stringify(workflow.steps);
      if (changesLogic) {
        workflow.history.unshift({ version: workflow.version, steps: JSON.parse(JSON.stringify(workflow.steps)), archivedAt: Date.now() });
        workflow.history = workflow.history.slice(0, 20);
        workflow.version += 1;
        workflow.approved = false;
      }
      Object.assign(workflow, patch, { updatedAt: Date.now() });
      if (changesLogic) artifacts()?.recordActivity(p, { type: "workflow-edited", text: `${workflow.name} edited — now version ${workflow.version}`, artifactId: workflow.id, artifactType: "workflow" });
      return workflow;
    },

    versionOf(project, id, version) {
      const workflow = workflows.get(project, id);
      if (!workflow) return null;
      if (Number(version) === workflow.version || version == null) return { version: workflow.version, steps: workflow.steps, current: true };
      const archived = workflow.history.find(item => item.version === Number(version));
      return archived ? { version: archived.version, steps: archived.steps, current: false } : null;
    },
    approve(project, id, approver = "") {
      const workflow = workflows.get(project, id);
      if (!workflow) return null;
      workflow.approved = true;
      workflow.approvedVersion = workflow.version;
      workflow.approvedBy = approver || artifacts()?.actorName() || "";
      workflow.approvedAt = Date.now();
      workflow.status = "approved";
      artifacts()?.recordActivity(shape(project), { type: "workflow-approved", text: `${workflow.name} approved at version ${workflow.version}`, artifactId: workflow.id, artifactType: "workflow" });
      return workflow;
    },
    remove(project, id) {
      const p = shape(project);
      const using = p.automations.filter(item => item.workflowId === id);
      if (using.length) return { ok: false, reason: "in-use", automations: using.map(item => item.name) };
      p.workflows = p.workflows.filter(item => item.id !== id);
      return { ok: true };
    }
  };


  const CONSEQUENTIAL_STEPS = new Set(["alert-if", "create-task-if", "build-report"]);

  function consequences(project, automation) {
    const pinned = workflows.versionOf(project, automation.workflowId, automation.workflowVersion);
    const steps = pinned ? pinned.steps : [];
    const list = [];
    if (steps.some(step => step.type === "alert-if")) list.push("raise alerts");
    if (steps.some(step => step.type === "create-task-if")) list.push("create tasks");
    if (steps.some(step => step.type === "build-report")) list.push("produce reports");
    if (steps.some(step => step.type === "save-finding")) list.push("save findings");
    return list;
  }

  const automations = {
    list(project, { status = null } = {}) {
      const p = shape(project);
      return p.automations.filter(item => !status || item.status === status);
    },
    get(project, id) { return shape(project).automations.find(item => item.id === id) || null; },
    create(project, { name, description = "", workflowId, triggerType = "manual", schedule = null, monitorId = null, datasetId = null, requiredCapabilities = [] } = {}) {
      const p = shape(project);
      const workflow = workflows.get(p, workflowId);
      const automation = {
        id: uid("automation"), name: str(name, "Untitled automation"), description: str(description, ""),
        projectId: p.id, organizationId: p.organizationId || null,
        workflowId: workflowId || null,

        workflowVersion: workflow ? workflow.version : null,
        triggerType: trigger(triggerType) ? triggerType : "manual",
        schedule: schedule || null, monitorId, datasetId,
        status: "draft",
        createdBy: artifacts()?.actorName() || "", runAs: artifacts()?.actorName() || "",
        requiredCapabilities: arr(requiredCapabilities),
        lastRunAt: null, lastRunStatus: null, nextRunAt: null, runCount: 0,
        createdAt: Date.now(), updatedAt: Date.now()
      };
      if (automation.triggerType === "local-schedule" && automation.schedule) automation.nextRunAt = scheduler.getNextRun(automation.schedule);
      p.automations.unshift(automation);
      artifacts()?.recordActivity(p, { type: "automation-created", text: `Automation created: ${automation.name}` });
      return automation;
    },
    update(project, id, patch = {}) {
      const p = shape(project);
      const automation = p.automations.find(item => item.id === id);
      if (!automation) return null;
      Object.assign(automation, patch, { updatedAt: Date.now() });
      if (automation.triggerType === "local-schedule" && automation.schedule) automation.nextRunAt = scheduler.getNextRun(automation.schedule, Date.now());
      if (automation.triggerType !== "local-schedule") automation.nextRunAt = null;
      return automation;
    },


    activate(project, id) {
      const p = shape(project);
      const automation = p.automations.find(item => item.id === id);
      if (!automation) return { ok: false, reason: "That automation no longer exists." };
      if (!automation.workflowId || !workflows.get(p, automation.workflowId)) return { ok: false, reason: "This automation has no workflow to run." };
      const a = access();
      if (a && !a.can("automation.activate")) return { ok: false, reason: "Your access profile doesn’t include activating automations. An analyst can design one; activating it is a separate permission." };
      const missing = automation.requiredCapabilities.filter(capability => a && !a.can(capability));
      if (missing.length) return { ok: false, reason: `This automation needs capabilities you don’t have: ${missing.join(", ")}.` };
      automation.status = "active";
      automation.activatedBy = artifacts()?.actorName() || "";
      automation.activatedAt = Date.now();
      if (automation.triggerType === "local-schedule" && automation.schedule) automation.nextRunAt = scheduler.getNextRun(automation.schedule, Date.now());
      artifacts()?.recordActivity(p, { type: "automation-activated", text: `${automation.name} activated` });
      return { ok: true, automation };
    },
    pause(project, id) {
      const automation = automations.get(project, id);
      if (!automation) return null;
      automation.status = "paused";
      automation.nextRunAt = null;
      artifacts()?.recordActivity(shape(project), { type: "automation-paused", text: `${automation.name} paused` });
      return automation;
    },
    resume(project, id) { return automations.activate(project, id); },
    remove(project, id) {
      const p = shape(project);
      p.automations = p.automations.filter(item => item.id !== id);
      return true;
    },
    consequences: (project, automation) => consequences(project, automation),


    due(project, now = Date.now()) {
      return automations.list(project, { status: "active" })
        .filter(item => item.triggerType === "local-schedule" && item.nextRunAt && item.nextRunAt <= now);
    }
  };


  const FREQUENCIES = [
    { id: "daily", label: "Every day" },
    { id: "weekdays", label: "Every weekday" },
    { id: "weekly", label: "Every week" },
    { id: "monthly", label: "Every month" },
    { id: "first-weekday", label: "First weekday of the month" }
  ];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function timezoneName() {
    const a = access();
    const orgZone = a && !a.isPersonal() ? a.organization()?.settings?.timezone : null;
    if (orgZone) return orgZone;
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time"; }
    catch (error) { return "your local time"; }
  }


  function makeSchedule({ frequency = "weekly", day = 1, hour = 8, minute = 0, timezone = null } = {}) {
    return {
      frequency: FREQUENCIES.some(item => item.id === frequency) ? frequency : "weekly",
      day: Math.max(0, Math.min(6, Number(day) || 0)),
      hour: Math.max(0, Math.min(23, Number(hour) || 0)),
      minute: Math.max(0, Math.min(59, Number(minute) || 0)),
      timezone: timezone || timezoneName()
    };
  }

  function describeSchedule(schedule) {
    if (!schedule) return "No schedule";
    const time = `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
    const base = schedule.frequency === "daily" ? "Every day"
      : schedule.frequency === "weekdays" ? "Every weekday"
      : schedule.frequency === "weekly" ? `Every ${DAYS[schedule.day]}`
      : schedule.frequency === "monthly" ? "Monthly"
      : "First weekday of the month";
    return `${base} at ${time} (${schedule.timezone})`;
  }

  const localAdapter = {
    id: "local",
    label: "This browser",
    description: "Due runs are checked whenever Studio is open. Nothing runs while Signal Noir is closed.",
    unattended: false,
    getNextRun(schedule, from = Date.now()) {
      if (!schedule) return null;
      const next = new Date(from);
      next.setSeconds(0, 0);
      next.setHours(schedule.hour, schedule.minute, 0, 0);
      const advanceDay = () => next.setDate(next.getDate() + 1);
      if (next.getTime() <= from) advanceDay();
      for (let guard = 0; guard < 400; guard += 1) {
        const day = next.getDay();
        const date = next.getDate();
        if (schedule.frequency === "daily") return next.getTime();
        if (schedule.frequency === "weekdays" && day >= 1 && day <= 5) return next.getTime();
        if (schedule.frequency === "weekly" && day === schedule.day) return next.getTime();
        if (schedule.frequency === "monthly" && date === 1) return next.getTime();
        if (schedule.frequency === "first-weekday" && date <= 3 && day >= 1 && day <= 5) return next.getTime();
        advanceDay();
      }
      return null;
    }
  };

  const connectedAdapter = {
    id: "connected",
    label: "Connected scheduler",
    description: "Unattended execution on a server, whether or not anyone has Signal Noir open. Not available: Signal Noir has no backend yet.",
    unattended: true,
    available: false,
    getNextRun(schedule, from) { return localAdapter.getNextRun(schedule, from); }
  };

  const adapters = { local: localAdapter, connected: connectedAdapter };
  let activeAdapter = localAdapter;

  const scheduler = {
    adapters,
    use(id) { if (adapters[id]?.available !== false) activeAdapter = adapters[id] || localAdapter; return activeAdapter; },
    current: () => activeAdapter,
    getNextRun(schedule, from = Date.now()) { return activeAdapter.getNextRun(schedule, from); },
    register(project, automationId) {
      const automation = automations.get(project, automationId);
      if (!automation?.schedule) return null;
      automation.nextRunAt = scheduler.getNextRun(automation.schedule, Date.now());
      return automation.nextRunAt;
    },
    cancel(project, automationId) {
      const automation = automations.get(project, automationId);
      if (automation) automation.nextRunAt = null;
      return true;
    },
    listJobs(project) {
      return automations.list(project, { status: "active" })
        .filter(item => item.schedule)
        .map(item => ({ automationId: item.id, name: item.name, schedule: item.schedule, nextRunAt: item.nextRunAt, unattended: item.triggerType === "cloud-schedule", adapter: item.triggerType === "cloud-schedule" ? "connected" : "local" }));
    },
    describeSchedule, makeSchedule, FREQUENCIES, DAYS, timezoneName
  };


  function datasetFor(project, automation, workflowRunInput) {
    const p = shape(project);
    const wanted = workflowRunInput?.datasetId || automation?.datasetId;
    return p.datasets.find(item => item.id === wanted) || p.datasets.find(item => item.id === p.activeDatasetId) || p.datasets[0] || null;
  }

  function numericValues(dataset, column) {
    return arr(dataset?.rows).map(row => num(row[column])).filter(value => value !== null);
  }

  function aggregateValue(dataset, measure, how = "sum") {
    const values = numericValues(dataset, measure);
    if (!values.length) return how === "count" ? arr(dataset?.rows).length : null;
    if (how === "count") return arr(dataset.rows).length;
    if (how === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (how === "min") return Math.min(...values);
    if (how === "max") return Math.max(...values);
    return values.reduce((sum, value) => sum + value, 0);
  }

  const runs = {
    list(project, { limit = 50, automationId = null, workflowId = null, status = null } = {}) {
      const p = shape(project);
      return p.workflowRuns
        .filter(run => (!automationId || run.automationId === automationId) && (!workflowId || run.workflowId === workflowId) && (!status || run.status === status))
        .slice(0, limit);
    },
    get(project, id) { return shape(project).workflowRuns.find(item => item.id === id) || null; },


    recordMissed(project, automation, dueAt) {
      const p = shape(project);
      const run = {
        id: uid("run"), workflowId: automation.workflowId, workflowVersion: automation.workflowVersion,
        workflowName: workflows.get(p, automation.workflowId)?.name || automation.name,
        automationId: automation.id, projectId: p.id, triggerType: automation.triggerType,
        triggeredBy: "schedule", startedAt: null, finishedAt: null, dueAt,
        status: "missed", steps: [], warnings: [], errors: [], outputs: [],
        summary: `Due ${new Date(dueAt).toLocaleString()}. Signal Noir was not open, so it did not run.`
      };
      p.workflowRuns.unshift(run);
      runs.prune(p);
      automation.status = "needs-attention";
      automation.nextRunAt = scheduler.getNextRun(automation.schedule, Date.now());
      artifacts()?.recordActivity(p, { type: "run-missed", text: `${automation.name} missed a scheduled run` });
      return run;
    },


    execute(project, { workflowId, workflowVersion = null, automationId = null, triggerType = "manual", triggeredBy = null, datasetId = null, retryOf = null } = {}) {
      const p = shape(project);
      const A = artifacts();
      const pinned = workflows.versionOf(p, workflowId, workflowVersion);
      const workflow = workflows.get(p, workflowId);
      const automation = automationId ? automations.get(p, automationId) : null;

      const run = {
        id: uid("run"), workflowId, workflowVersion: pinned ? pinned.version : null, workflowName: workflow?.name || "Workflow",
        automationId, projectId: p.id, triggerType,
        triggeredBy: triggeredBy || A?.actorName() || "", startedAt: Date.now(), finishedAt: null,
        status: "running", steps: [], warnings: [], errors: [], outputs: [], findingIds: [], alertIds: [],
        datasetId: null, retryOf, summary: ""
      };
      p.workflowRuns.unshift(run);

      if (!pinned) {
        return finishRun(p, run, "failed", { error: { title: "That workflow no longer exists", what: "The workflow this run points at has been deleted.", next: [{ label: "Open workflows", view: "operations" }] } });
      }

      const dataset = datasetFor(p, automation, { datasetId });
      run.datasetId = dataset?.id || null;
      const context = { dataset, values: {}, findings: [] };
      let stopped = null;

      for (const step of pinned.steps) {
        if (stopped) { run.steps.push({ id: step.id, type: step.type, label: stepType(step.type)?.label || step.type, status: "skipped" }); continue; }
        const started = Date.now();
        let outcome;
        try { outcome = runStep(p, run, step, context); }
        catch (error) { outcome = { status: "failed", error: { title: `${stepType(step.type)?.label || step.type} could not run`, what: error?.message || "An unexpected problem stopped this step.", why: "The data may have a shape this step does not handle.", affected: "Steps after this one were not run." } }; }
        const entry = { id: step.id, type: step.type, label: stepType(step.type)?.label || step.type, status: outcome.status || "succeeded", detail: outcome.detail || "", ms: Date.now() - started };
        run.steps.push(entry);
        if (outcome.warning) run.warnings.push(outcome.warning);
        if (outcome.error) run.errors.push(outcome.error);
        if (outcome.outputs) run.outputs.push(...outcome.outputs);
        if (entry.status === "failed" || entry.status === "waiting-approval") stopped = entry.status;
      }

      if (stopped === "waiting-approval") return finishRun(p, run, "waiting-approval");
      if (stopped === "failed") return finishRun(p, run, "failed");
      return finishRun(p, run, run.warnings.length ? "warnings" : "succeeded");
    },


    retry(project, runId, { datasetId = null } = {}) {
      const original = runs.get(project, runId);
      if (!original) return null;
      return runs.execute(project, {
        workflowId: original.workflowId, workflowVersion: original.workflowVersion,
        automationId: original.automationId, triggerType: "manual",
        datasetId: datasetId || original.datasetId, retryOf: original.id
      });
    },

    approve(project, runId, { approved = true, note = "" } = {}) {
      const p = shape(project);
      const run = runs.get(p, runId);
      if (!run || run.status !== "waiting-approval") return null;
      run.approval = { approved, note, by: artifacts()?.actorName() || "", at: Date.now() };
      run.status = approved ? "succeeded" : "cancelled";
      run.finishedAt = Date.now();
      run.summary = approved ? `${run.summary} Approved by ${run.approval.by}.` : `Stopped: approval was declined by ${run.approval.by}.`;
      artifacts()?.recordActivity(p, { type: "run-approved", text: `${run.workflowName} ${approved ? "approved" : "declined"}` });
      return run;
    },

    cancel(project, runId) {
      const run = runs.get(project, runId);
      if (!run || !["running", "waiting-approval", "waiting-input"].includes(run.status)) return null;
      run.status = "cancelled";
      run.finishedAt = Date.now();
      run.summary = "Cancelled before it finished. Nothing after the last completed step was run.";
      return run;
    },


    prune(project) {
      const p = shape(project);
      p.workflowRuns.slice(DETAILED_RUNS).forEach(run => {
        if (run.steps?.length) { run.stepCount = run.steps.length; run.steps = []; run.detailPruned = true; }
      });
      if (p.workflowRuns.length > RUN_LIMIT) p.workflowRuns = p.workflowRuns.slice(0, RUN_LIMIT);
      return p.workflowRuns.length;
    }
  };

  function finishRun(project, run, status, extra = {}) {
    const p = shape(project);
    run.status = status;
    run.finishedAt = Date.now();
    run.durationMs = run.startedAt ? run.finishedAt - run.startedAt : null;
    if (extra.error) run.errors.push(extra.error);
    const done = run.steps.filter(step => step.status === "succeeded").length;
    run.summary = run.summary || (status === "succeeded" ? `${done} of ${run.steps.length} steps completed.`
      : status === "warnings" ? `${done} of ${run.steps.length} steps completed, with ${run.warnings.length} warning${run.warnings.length === 1 ? "" : "s"}.`
      : status === "failed" ? `Stopped at ${run.steps.find(step => step.status === "failed")?.label || "a failed step"}. Nothing after it ran.`
      : status === "waiting-approval" ? "Waiting for approval before it continues."
      : "");
    const automation = run.automationId ? automations.get(p, run.automationId) : null;
    if (automation) {
      automation.lastRunAt = run.finishedAt;
      automation.lastRunStatus = status;
      automation.runCount = (automation.runCount || 0) + 1;
      if (status === "failed") automation.status = "needs-attention";
      if (automation.triggerType === "local-schedule" && automation.schedule) automation.nextRunAt = scheduler.getNextRun(automation.schedule, Date.now());
    }
    runs.prune(p);
    artifacts()?.recordActivity(p, { type: "workflow-run", text: `${run.workflowName}: ${runStatus(status).label.toLowerCase()}` });
    return run;
  }

  function runStep(project, run, step, context) {
    const p = shape(project);
    const A = artifacts();
    const args = step.args || step;
    const dataset = context.dataset;

    switch (step.type) {
      case "require-data":
        if (!dataset) return { status: "failed", error: { title: "This workflow needs data", what: "The project has no dataset to run against.", affected: "Nothing was changed.", next: [{ label: "Add data", view: "data" }] } };
        return { status: "succeeded", detail: `${dataset.name} · ${arr(dataset.rows).length.toLocaleString()} rows` };

      case "validate-schema": {
        if (!dataset) return { status: "failed", error: { title: "No dataset to validate", what: "This step needs a dataset.", affected: "Nothing was changed." } };
        const required = arr(args.columns).map(name => String(name).trim()).filter(Boolean);
        const missing = required.filter(name => !arr(dataset.columns).includes(name));
        if (missing.length) return { status: "failed", error: { title: "Schema validation failed", what: `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing from ${dataset.name}.`, why: `Expected: ${required.join(", ")}. Found: ${arr(dataset.columns).join(", ")}.`, affected: "This workflow stopped before changing any outputs.", next: [{ label: "Open the dataset", view: "data" }, { label: "Run with a different dataset", action: "retry-with-dataset" }] } };
        return { status: "succeeded", detail: `${required.length} required column${required.length === 1 ? "" : "s"} present` };
      }

      case "check-rows": {
        const minimum = num(args.minRows) ?? 1;
        const count = arr(dataset?.rows).length;
        if (count < minimum) return { status: "failed", error: { title: "Row count below the minimum", what: `${dataset?.name || "The dataset"} has ${count.toLocaleString()} rows; this workflow expects at least ${minimum.toLocaleString()}.`, why: "The export may be incomplete or filtered.", affected: "This workflow stopped before changing any outputs." } };
        return { status: "succeeded", detail: `${count.toLocaleString()} rows` };
      }

      case "check-freshness": {
        const limit = num(args.maxAgeHours) ?? 24;
        const updated = dataset?.updatedAt || dataset?.addedAt;
        if (!updated) return { status: "succeeded", detail: "No import time recorded; freshness not checked", warning: "This dataset has no recorded import time, so freshness could not be checked." };
        const ageHours = (Date.now() - updated) / 3600000;
        const result = evaluateCondition({ op: "stale_by", value: ageHours, threshold: limit });
        if (result.met) return { status: "failed", error: { title: "Data is stale", what: result.reason, why: `${dataset.name} has not been updated recently enough for this process.`, affected: "This workflow stopped before changing any outputs.", next: [{ label: "Import the latest file", view: "data" }] } };
        return { status: "succeeded", detail: `Updated ${ageHours.toFixed(1)}h ago` };
      }

      case "quality-check": {
        if (!dataset) return { status: "failed", error: { title: "No dataset to check", what: "This step needs a dataset." } };
        const engine = analysis();
        const audit = engine?.qualityAudit ? engine.qualityAudit(dataset) : null;
        const issues = arr(audit?.issues);
        context.values.qualityScore = audit?.score ?? null;
        if (!issues.length) return { status: "succeeded", detail: "No quality problems found" };
        return { status: "warning", detail: `${issues.length} quality issue${issues.length === 1 ? "" : "s"}`, warning: issues.slice(0, 3).map(issue => issue.title).join("; ") };
      }

      case "aggregate": {
        if (!dataset) return { status: "failed", error: { title: "No dataset", what: "This step needs a dataset." } };
        const measure = str(args.measure);
        const how = str(args.aggregate, "sum");
        const value = aggregateValue(dataset, measure, how);
        if (value === null) return { status: "warning", detail: `${measure} produced no numbers`, warning: `${measure} had no numeric values in ${dataset.name}.` };
        context.values.current = value;
        context.values.measure = measure;
        context.evidence = { dataset: dataset.name, rows: arr(dataset.rows).length, rowsTotal: arr(dataset.rows).length, filters: [], calculation: `${how.toUpperCase()}(${measure})`, method: `${how} of ${measure}`, generatedAt: new Date().toISOString(), validation: "computed" };
        return { status: "succeeded", detail: `${how} of ${measure}: ${value.toLocaleString()}` };
      }

      case "compare-periods": {
        const engine = analysis();
        if (!dataset || !engine?.comparePeriods) return { status: "warning", detail: "Period comparison unavailable", warning: "Period comparison needs the analysis engine and a dataset." };
        const profile = engine.profile(dataset);
        const time = str(args.time) || profile.times[0];
        const measure = str(args.measure) || context.values.measure || engine.pickMeasure(profile, "");
        if (!time) return { status: "warning", detail: "No date column", warning: `${dataset.name} has no date column, so there was nothing to compare periods with.` };
        if (!measure) return { status: "warning", detail: "No measure", warning: `${dataset.name} has no numeric column to compare.` };
        let result = null;
        try { result = engine.comparePeriods(dataset, { measure, time }); } catch (error) { result = null; }
        if (!result || result.ok === false) return { status: "warning", detail: "Not comparable", warning: result?.reason || `There was no earlier period to compare ${measure} against.` };

        context.values.previous = result.previous?.value ?? null;
        context.values.current = result.current?.value ?? context.values.current;
        context.values.changePct = result.pct == null ? null : result.pct * 100;
        context.values.measure = measure;
        context.evidence = { dataset: dataset.name, rows: arr(dataset.rows).length, rowsTotal: arr(dataset.rows).length, filters: [], calculation: `SUM(${measure}) by ${time}, latest period vs previous`, method: `Period-over-period comparison of ${measure}`, generatedAt: new Date().toISOString(), validation: "computed" };
        const notes = arr(result.notes);
        const direction = context.values.changePct == null ? "changed" : context.values.changePct >= 0 ? "up" : "down";
        const detail = `${measure} ${direction}${context.values.changePct == null ? "" : ` ${Math.abs(context.values.changePct).toFixed(1)}%`} (${result.previous?.label} → ${result.current?.label})`;
        return notes.length ? { status: "warning", detail, warning: notes.join(" ") } : { status: "succeeded", detail };
      }

      case "save-finding": {
        if (!A) return { status: "warning", detail: "Nothing to save", warning: "The artifact service is unavailable." };
        if (context.values.current == null) return { status: "warning", detail: "No calculated value to save", warning: "No step before this one produced a value." };
        const title = `${context.values.measure || "Value"}: ${Number(context.values.current).toLocaleString()}${context.values.changePct != null ? ` (${context.values.changePct >= 0 ? "+" : ""}${context.values.changePct.toFixed(1)}%)` : ""}`;
        const finding = A.create(p, "finding", { title, evidence: context.evidence, sources: dataset ? [{ type: "dataset", id: dataset.id, rel: "derived-from" }] : [], createdBy: `${run.workflowName} (automated)` });
        context.findings.push(finding);
        run.findingIds.push(finding.id);
        return { status: "succeeded", detail: title, outputs: [{ type: "finding", id: finding.id, title }] };
      }

      case "build-report": {
        if (!A) return { status: "warning", detail: "Report service unavailable", warning: "The artifact service is unavailable." };


        const sources = [
          ...context.findings.map(item => ({ type: "finding", id: item.id, rel: "includes" })),
          ...(dataset ? [{ type: "dataset", id: dataset.id, rel: "derived-from" }] : [])
        ];
        const report = A.create(p, "report", {
          title: `${run.workflowName} — ${new Date().toLocaleDateString()}`,
          description: `Prepared automatically by ${run.workflowName}. ${context.findings.length} finding${context.findings.length === 1 ? "" : "s"}.`,
          sources, runId: run.id
        });
        return { status: "succeeded", detail: report.title, outputs: [{ type: "report", id: report.id, title: report.title }] };
      }

      case "alert-if": {
        const result = evaluateCondition({ op: args.op, value: context.values.current, threshold: args.threshold, previous: context.values.previous });
        if (!result.comparable) return { status: "warning", detail: result.reason, warning: result.reason };
        if (!result.met) return { status: "succeeded", detail: `No alert: ${result.reason}` };
        const alert = alerts.create(p, {
          title: str(args.title, `${context.values.measure || "Value"} ${operator(args.op)?.label || args.op} ${args.threshold}`),
          description: result.reason, severity: str(args.severity, "warning"),
          value: result.value, threshold: result.threshold, runId: run.id,
          evidence: context.evidence, datasetId: dataset?.id || null
        });
        run.alertIds.push(alert.id);
        return { status: "warning", detail: `Alert raised: ${result.reason}`, warning: result.reason, outputs: [{ type: "alert", id: alert.id, title: alert.title }] };
      }

      case "create-task-if": {
        const result = evaluateCondition({ op: args.op, value: context.values.current, threshold: args.threshold, previous: context.values.previous });
        if (!result.comparable) return { status: "warning", detail: result.reason, warning: result.reason };
        if (!result.met) return { status: "succeeded", detail: `No task: ${result.reason}` };
        if (!A) return { status: "warning", detail: "Task service unavailable", warning: "The artifact service is unavailable." };
        const task = A.create(p, "task", {
          title: str(args.title, `Follow up: ${result.reason}`),
          description: `Created automatically by ${run.workflowName}. ${result.reason}`,
          assignee: str(args.assignee, ""),
          sources: context.findings.length ? [{ type: "finding", id: context.findings[0].id, rel: "based-on" }] : []
        });
        return { status: "succeeded", detail: `Task created: ${task.title}`, outputs: [{ type: "task", id: task.id, title: task.title }] };
      }

      case "approval":
        return { status: "waiting-approval", detail: "Waiting for a person to approve the rest of this run" };

      default:
        return { status: "warning", detail: `Unknown step “${step.type}”`, warning: `This workflow contains a step type Signal Noir does not know: ${step.type}.` };
    }
  }


  const MONITOR_KINDS = [
    { id: "metric-threshold", label: "Metric threshold", description: "Watch a number and react when it crosses a limit." },
    { id: "data-quality", label: "Data quality", description: "React when a dataset's quality score falls." },
    { id: "data-freshness", label: "Data freshness", description: "React when a dataset has not been updated recently." },
    { id: "volume-change", label: "Row volume", description: "React when the number of rows moves sharply." },
    { id: "workflow-health", label: "Workflow health", description: "React when an automation's last run failed." }
  ];

  const SEVERITIES = [
    { id: "info", label: "Info", description: "Worth knowing. No action needed." },
    { id: "warning", label: "Warning", description: "Someone should look at this." },
    { id: "critical", label: "Critical", description: "Something is wrong and needs attention now." }
  ];

  const monitors = {
    list(project, { status = null } = {}) { return shape(project).monitors.filter(item => !status || item.status === status); },
    get(project, id) { return shape(project).monitors.find(item => item.id === id) || null; },
    create(project, config = {}) {
      const p = shape(project);
      const monitor = {
        id: uid("monitor"), name: str(config.name, "Untitled monitor"),
        kind: MONITOR_KINDS.some(item => item.id === config.kind) ? config.kind : "metric-threshold",
        projectId: p.id, datasetId: config.datasetId || p.activeDatasetId || null,
        measure: str(config.measure, ""), aggregate: str(config.aggregate, "sum"),
        op: operator(config.op) ? config.op : "gt", threshold: num(config.threshold),
        severity: SEVERITIES.some(item => item.id === config.severity) ? config.severity : "warning",
        status: "active", owner: str(config.owner, ""), automationId: config.automationId || null,
        lastCheckedAt: null, lastValue: null, previousValue: null, lastResult: null,
        createdBy: artifacts()?.actorName() || "", createdAt: Date.now()
      };
      p.monitors.unshift(monitor);
      artifacts()?.recordActivity(p, { type: "monitor-created", text: `Monitor created: ${monitor.name}` });
      return monitor;
    },
    update(project, id, patch = {}) {
      const monitor = monitors.get(project, id);
      if (!monitor) return null;
      Object.assign(monitor, patch, { updatedAt: Date.now() });
      return monitor;
    },
    pause(project, id) { return monitors.update(project, id, { status: "paused" }); },
    resume(project, id) { return monitors.update(project, id, { status: "active" }); },
    remove(project, id) { const p = shape(project); p.monitors = p.monitors.filter(item => item.id !== id); return true; },


    measureValue(project, monitor) {
      const p = shape(project);
      const dataset = p.datasets.find(item => item.id === monitor.datasetId) || p.datasets[0] || null;
      if (monitor.kind === "workflow-health") {
        const automation = monitor.automationId ? automations.get(p, monitor.automationId) : null;
        return { value: automation?.lastRunStatus === "failed" ? "failed" : automation?.lastRunStatus || null, dataset: null, evidence: { method: "Last run status", dataset: automation?.name || "", generatedAt: new Date().toISOString(), validation: "computed", calculation: "last run status" } };
      }
      if (!dataset) return { value: null, dataset: null, evidence: null };
      const rows = arr(dataset.rows).length;
      const base = { dataset: dataset.name, rows, rowsTotal: rows, filters: [], generatedAt: new Date().toISOString(), validation: "computed" };
      if (monitor.kind === "data-freshness") {
        const updated = dataset.updatedAt || dataset.addedAt;
        return { value: updated ? (Date.now() - updated) / 3600000 : null, dataset, evidence: { ...base, calculation: "hours since last import", method: "Data freshness" } };
      }
      if (monitor.kind === "volume-change") return { value: rows, dataset, evidence: { ...base, calculation: "COUNT(*)", method: "Row volume" } };
      if (monitor.kind === "data-quality") {
        const engine = analysis();
        const audit = engine?.qualityAudit ? engine.qualityAudit(dataset) : null;
        return { value: audit?.score ?? null, dataset, evidence: { ...base, calculation: "quality audit score", method: "Data quality" } };
      }
      const value = aggregateValue(dataset, monitor.measure, monitor.aggregate);
      return { value, dataset, evidence: { ...base, calculation: `${String(monitor.aggregate).toUpperCase()}(${monitor.measure})`, method: `${monitor.aggregate} of ${monitor.measure}` } };
    },


    check(project, id) {
      const p = shape(project);
      const monitor = monitors.get(p, id);
      if (!monitor || monitor.status !== "active") return null;
      const reading = monitors.measureValue(p, monitor);
      const result = evaluateCondition({ op: monitor.op, value: reading.value, threshold: monitor.threshold, previous: monitor.lastValue });
      monitor.previousValue = monitor.lastValue;
      monitor.lastValue = reading.value;
      monitor.lastCheckedAt = Date.now();
      monitor.lastResult = { met: result.met, reason: result.reason, comparable: result.comparable };

      if (result.met) {
        const existing = p.alerts.find(alert => alert.monitorId === monitor.id && alert.status === "open");
        if (!existing) {
          const alert = alerts.create(p, {
            monitorId: monitor.id, title: monitor.name, description: result.reason,
            severity: monitor.severity, value: result.value, threshold: result.threshold,
            evidence: reading.evidence, datasetId: reading.dataset?.id || null
          });
          monitor.lastAlertId = alert.id;
        }


        automations.list(p, { status: "active" })
          .filter(item => item.triggerType === "condition" && item.monitorId === monitor.id)
          .forEach(item => runs.execute(p, { workflowId: item.workflowId, workflowVersion: item.workflowVersion, automationId: item.id, triggerType: "condition", triggeredBy: `Monitor: ${monitor.name}` }));
      }
      return { monitor, result, reading };
    },

    checkAll(project) {
      const p = shape(project);
      return monitors.list(p, { status: "active" }).map(monitor => monitors.check(p, monitor.id)).filter(Boolean);
    }
  };


  const ALERT_STATUS = ["open", "acknowledged", "resolved", "ignored"];

  const alerts = {
    list(project, { status = null, severity = null, limit = 100 } = {}) {
      return shape(project).alerts
        .filter(item => (!status || item.status === status) && (!severity || item.severity === severity))
        .slice(0, limit);
    },
    get(project, id) { return shape(project).alerts.find(item => item.id === id) || null; },
    create(project, config = {}) {
      const p = shape(project);
      const alert = {
        id: uid("alert"), projectId: p.id, monitorId: config.monitorId || null, runId: config.runId || null,
        title: str(config.title, "Alert"), description: str(config.description, ""),
        severity: SEVERITIES.some(item => item.id === config.severity) ? config.severity : "warning",
        status: "open", value: config.value ?? null, threshold: config.threshold ?? null,
        evidence: config.evidence || null, datasetId: config.datasetId || null,
        assignedTo: str(config.assignedTo, ""), createdAt: Date.now(), resolvedAt: null, resolution: ""
      };
      p.alerts.unshift(alert);
      p.alerts = p.alerts.slice(0, 300);
      artifacts()?.recordActivity(p, { type: "alert-raised", text: `Alert: ${alert.title}` });
      return alert;
    },
    setStatus(project, id, status, { resolution = "" } = {}) {
      const p = shape(project);
      const alert = alerts.get(p, id);
      if (!alert || !ALERT_STATUS.includes(status)) return null;
      alert.status = status;
      alert.updatedAt = Date.now();
      if (status === "resolved" || status === "ignored") {
        alert.resolvedAt = Date.now();
        alert.resolution = str(resolution, alert.resolution);
        alert.resolvedBy = artifacts()?.actorName() || "";
      }
      artifacts()?.recordActivity(p, { type: "alert-updated", text: `Alert ${status}: ${alert.title}${resolution ? ` — ${resolution}` : ""}` });
      return alert;
    },
    assign(project, id, assignee) {
      const alert = alerts.get(project, id);
      if (!alert) return null;
      alert.assignedTo = str(assignee, "");
      artifacts()?.recordActivity(shape(project), { type: "alert-assigned", text: `Alert assigned to ${alert.assignedTo || "nobody"}: ${alert.title}` });
      return alert;
    }
  };


  function attention(project, { limit = 50 } = {}) {
    const A = artifacts();
    if (!project || (A && !A.canReach(project))) return [];
    const p = shape(project);
    const items = [];
    const me = A?.actorName() || "";

    alerts.list(p, { status: "open" }).forEach(alert => items.push({
      id: alert.id, type: "alert", severity: alert.severity, title: alert.title,
      description: alert.description, projectId: p.id, projectName: p.name,
      createdAt: alert.createdAt, assignedTo: alert.assignedTo, source: "monitor", action: "review-alert"
    }));

    runs.list(p, { limit: 40 }).filter(run => run.status === "failed").forEach(run => items.push({
      id: run.id, type: "run-failed", severity: "critical", title: `${run.workflowName} failed`,
      description: run.errors[0]?.what || run.summary, projectId: p.id, projectName: p.name,
      createdAt: run.finishedAt || run.startedAt, source: "workflow", action: "open-run"
    }));

    runs.list(p, { limit: 40 }).filter(run => run.status === "waiting-approval").forEach(run => items.push({
      id: run.id, type: "approval", severity: "warning", title: `${run.workflowName} is waiting for approval`,
      description: "This run paused before publishing anything.", projectId: p.id, projectName: p.name,
      createdAt: run.startedAt, source: "workflow", action: "approve-run"
    }));

    runs.list(p, { limit: 40 }).filter(run => run.status === "missed").forEach(run => items.push({
      id: run.id, type: "missed", severity: "info", title: `${run.workflowName} missed a scheduled run`,
      description: run.summary, projectId: p.id, projectName: p.name,
      createdAt: run.dueAt, source: "schedule", action: "run-now"
    }));

    arr(p.tasks).filter(task => {
      const status = String(task.status || "").toLowerCase();
      const open = !/done|complete/.test(status);
      return open && me && (task.assignee === me || task.owner === me);
    }).forEach(task => items.push({
      id: task.id, type: "task", severity: "info", title: task.title,
      description: task.description || "Assigned to you", projectId: p.id, projectName: p.name,
      createdAt: task.createdAt, assignedTo: task.assignee || task.owner, source: "project", action: "open-artifact"
    }));

    automations.list(p, { status: "needs-attention" }).forEach(automation => items.push({
      id: automation.id, type: "automation", severity: "warning", title: `${automation.name} needs attention`,
      description: automation.lastRunStatus === "failed" ? "Its last run failed." : "It missed a scheduled run.",
      projectId: p.id, projectName: p.name, createdAt: automation.lastRunAt || automation.updatedAt,
      source: "automation", action: "open-automation"
    }));

    const rank = { critical: 0, warning: 1, info: 2 };
    return items.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
  }

  function attentionAcross(projects, options = {}) {
    const A = artifacts();
    const reachable = arr(projects).filter(project => !A || A.canReach(project));
    const rank = { critical: 0, warning: 1, info: 2 };
    return reachable.flatMap(project => attention(project, options))
      .sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, options.limit || 60);
  }


  function health(project) {
    const p = shape(project);
    const recent = runs.list(p, { limit: 20 }).filter(run => run.status !== "missed");
    const failed = recent.filter(run => run.status === "failed").length;
    const warned = recent.filter(run => run.status === "warnings").length;
    const active = automations.list(p, { status: "active" }).length;
    const attentionItems = attention(p);
    const state = failed ? "failing" : attentionItems.some(item => item.severity === "critical") ? "failing"
      : warned || attentionItems.length ? "warning"
      : active ? "healthy" : "idle";
    return {
      state,
      activeAutomations: active,
      pausedAutomations: automations.list(p, { status: "paused" }).length,
      runsRecorded: p.workflowRuns.length,
      recentRuns: recent.length,
      succeeded: recent.filter(run => run.status === "succeeded").length,
      warnings: warned,
      failed,
      missed: runs.list(p, { limit: 50 }).filter(run => run.status === "missed").length,
      openAlerts: alerts.list(p, { status: "open" }).length,
      criticalAlerts: alerts.list(p, { status: "open", severity: "critical" }).length,
      monitors: monitors.list(p, { status: "active" }).length,
      needsAttention: attentionItems.length
    };
  }


  const TEMPLATES = [
    { id: "weekly-performance", name: "Weekly performance review", sample: false,
      description: "Compare this week with last, save what changed, and prepare a summary before the Monday meeting.",
      schedule: { frequency: "weekly", day: 1, hour: 8, minute: 0 },
      expects: "A dated export with at least one measure.",
      steps: [
        { type: "require-data" },
        { type: "check-freshness", args: { maxAgeHours: 168 } },
        { type: "quality-check" },
        { type: "compare-periods", args: { measure: "" } },
        { type: "save-finding" },
        { type: "build-report" }
      ] },
    { id: "daily-quality", name: "Daily data quality check", sample: false,
      description: "Validate the incoming file every morning and raise an alert when it fails.",
      schedule: { frequency: "weekdays", day: 1, hour: 7, minute: 0 },
      expects: "A file that is replaced on a regular cadence.",
      steps: [
        { type: "require-data" },
        { type: "validate-schema", args: { columns: [] } },
        { type: "check-rows", args: { minRows: 1 } },
        { type: "check-freshness", args: { maxAgeHours: 24 } },
        { type: "quality-check" }
      ] },
    { id: "monthly-executive", name: "Monthly executive report", sample: false,
      description: "Month-over-month movement with the drivers, assembled into a report for leadership.",
      schedule: { frequency: "first-weekday", day: 1, hour: 9, minute: 0 },
      expects: "A dated export covering several months.",
      steps: [
        { type: "require-data" },
        { type: "quality-check" },
        { type: "compare-periods", args: { measure: "" } },
        { type: "save-finding" },
        { type: "approval" },
        { type: "build-report" }
      ] },
    { id: "threshold-watch", name: "Metric threshold watch", sample: false,
      description: "Watch one number and raise an alert, plus a follow-up task, when it crosses the line.",
      schedule: null,
      expects: "A dataset containing the measure you want to watch.",
      steps: [
        { type: "require-data" },
        { type: "aggregate", args: { measure: "", aggregate: "sum" } },
        { type: "alert-if", args: { op: "gt", threshold: 0, severity: "warning" } },
        { type: "create-task-if", args: { op: "gt", threshold: 0 } }
      ] },
    { id: "budget-vs-actual", name: "Budget versus actual review", sample: false,
      description: "Compare performance with plan each month and flag the gap.",
      schedule: { frequency: "monthly", day: 1, hour: 9, minute: 0 },
      expects: "An actuals export and a target or plan file.",
      steps: [
        { type: "require-data" },
        { type: "validate-schema", args: { columns: [] } },
        { type: "aggregate", args: { measure: "", aggregate: "sum" } },
        { type: "save-finding" },
        { type: "build-report" }
      ] },
    { id: "tour-attendance", name: "Weekly tour attendance review", sample: true,
      description: "Sample process showing a full recurring operation: validate the booking export, compare with last week, alert on cancellations, and prepare the summary.",
      schedule: { frequency: "weekly", day: 1, hour: 8, minute: 0 },
      expects: "A tour booking export with a date and an attendance status column.",
      steps: [
        { type: "require-data" },
        { type: "validate-schema", args: { columns: [] } },
        { type: "quality-check" },
        { type: "compare-periods", args: { measure: "" } },
        { type: "save-finding" },
        { type: "alert-if", args: { op: "pct_change_above", threshold: 10, severity: "warning" } },
        { type: "build-report" }
      ] }
  ];
  const template = id => TEMPLATES.find(item => item.id === id) || null;


  function applyTemplate(project, templateId, { createAutomation = false, name = null, datasetId = null } = {}) {
    const p = shape(project);
    const seed = template(templateId);
    if (!seed) return null;
    const workflow = workflows.create(p, { name: str(name, seed.name), description: seed.description, steps: seed.steps.map(step => ({ ...step, args: { ...(step.args || {}) } })) });
    workflow.templateId = seed.id;
    let automation = null;
    if (createAutomation) {
      automation = automations.create(p, {
        name: str(name, seed.name), description: seed.description, workflowId: workflow.id,
        triggerType: seed.schedule ? "local-schedule" : "manual",
        schedule: seed.schedule ? makeSchedule(seed.schedule) : null, datasetId
      });
    }
    return { workflow, automation };
  }


  function onDataArrival(project, datasetId) {
    const p = shape(project);
    return automations.list(p, { status: "active" })
      .filter(item => item.triggerType === "data-arrival" && (!item.datasetId || item.datasetId === datasetId))
      .map(item => runs.execute(p, { workflowId: item.workflowId, workflowVersion: item.workflowVersion, automationId: item.id, triggerType: "data-arrival", triggeredBy: "Dataset import", datasetId }));
  }


  function catchUp(project, { openedAt = Date.now(), wasOpen = false } = {}) {
    const p = shape(project);
    const results = { ran: [], missed: [] };
    automations.due(p, openedAt).forEach(automation => {
      if (wasOpen) results.ran.push(runs.execute(p, { workflowId: automation.workflowId, workflowVersion: automation.workflowVersion, automationId: automation.id, triggerType: "local-schedule", triggeredBy: "Local schedule" }));
      else results.missed.push(runs.recordMissed(p, automation, automation.nextRunAt));
    });
    return results;
  }

  const api = {
    SCHEMA_VERSION, TRIGGERS, AUTOMATION_STATUS, RUN_STATUS, OPERATORS, MONITOR_KINDS, SEVERITIES,
    STEP_TYPES, TEMPLATES, ALERT_STATUS, FREQUENCIES,
    trigger, triggerRunsLocally, runStatus, operator, stepType, template,
    evaluateCondition, describeCondition, describeSchedule, makeSchedule, timezoneName,
    shape, uid, workflows, automations, runs, monitors, alerts, scheduler,
    attention, attentionAcross, health, applyTemplate, onDataArrival, catchUp,
    consequences: (project, automation) => consequences(project, automation)
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  SN.operations = api;
})(typeof window !== "undefined" ? window : globalThis);
