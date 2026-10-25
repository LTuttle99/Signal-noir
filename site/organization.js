


(function () {
  "use strict";

  const { projects: store, site, access, accessUi } = window.SignalNoir;
  const esc = site.esc;
  const platform = () => window.SignalNoir.platform;
  const $ = selector => document.querySelector(selector);
  const arr = value => Array.isArray(value) ? value : [];
  const isOpen = task => !/done|complete/i.test(task.status || "");

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "teams", label: "Teams", capability: "teams.manage", needsOrg: true },
    { id: "members", label: "Members", capability: "members.manage", needsOrg: true },
    { id: "profiles", label: "Access profiles", capability: "access.manage", needsOrg: true },
    { id: "projects", label: "Project access", capability: "access.manage", needsOrg: true },
    { id: "operations", label: "Operations", capability: "operations.view" },
    { id: "decisions", label: "Decisions", capability: "decisions.manage" },
    { id: "tasks", label: "Tasks", capability: "tasks.manage" },
    { id: "governance", label: "Governance", capability: "governance.manage" },
    { id: "audit", label: "History", capability: "audit.view" }
  ];

  let projects = [];
  let visible = [];
  let active = "overview";

  const available = () => TABS.filter(tab => !tab.capability || access.can(tab.capability));
  const tagFor = project => project.isDemo ? '<span class="sn-badge sn-badge-preview">Demo</span>' : "";
  const statusBadge = status => /done|complete|approved|published/i.test(status || "") ? `<span class="sn-badge sn-badge-success">${esc(status)}</span>` : /block|reject/i.test(status || "") ? `<span class="sn-badge sn-badge-danger">${esc(status)}</span>` : `<span class="sn-badge">${esc(status || "Open")}</span>`;
  const empty = (icon, title, text, action = '<a class="sn-btn sn-btn-sm sn-btn-primary" href="tools/studio/index.html">Open Studio</a>') =>
    `<div class="sn-empty"><div class="sn-empty-icon">${icon}</div><div class="sn-empty-title">${esc(title)}</div><div class="sn-empty-text">${esc(text)}</div><div class="sn-empty-actions">${action}</div></div>`;
  const when = value => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  const initials = name => String(name || "?").split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";

  function profileName(id) { return access.profiles.get(id)?.name || "No profile"; }
  function capCount(id) { return access.profiles.get(id)?.capabilities.length || 0; }


  function renderHeader() {
    const info = access.summary();
    const org = access.organization();
    $("#org-title").textContent = info.personal ? "Your local records" : org.name;
    $("#org-lead").textContent = info.personal
      ? "You’re in the personal workspace, so every capability is available and no access rules apply. Create an organization to give different teams different capabilities."
      : org.description || "One Signal Noir, different capabilities for different teams.";
    $("#org-boundary").hidden = info.personal;

    const setup = $("#org-setup");
    if (info.personal) {
      const demo = access.demoOrganization();
      setup.hidden = false;
      setup.innerHTML = `<div class="sn-panel sn-panel-pad" style="margin-bottom:24px">
        <div class="sn-split"><h2 class="sn-h3">Personal workspace</h2><span class="sn-badge sn-badge-success"><i></i>Everything available</span></div>
        <p class="sn-body" style="margin-top:10px">Signal Noir works on its own without any of this. An organization workspace is for when several people with different jobs use the same install and each should see the part that belongs to them.</p>
        <div class="sn-cluster" style="margin-top:16px">
          <button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-new-org>Create an organization</button>
          ${demo ? `<button type="button" class="sn-btn sn-btn-sm" data-open-demo>Open the sample organization</button>` : '<button type="button" class="sn-btn sn-btn-sm" data-create-demo>Add a sample organization</button>'}
        </div>
      </div>`;
    } else {
      const counts = `${org.members.length} member${org.members.length === 1 ? "" : "s"} · ${org.teams.length} team${org.teams.length === 1 ? "" : "s"} · ${org.profiles.length} access profile${org.profiles.length === 1 ? "" : "s"}`;
      setup.hidden = false;
      setup.innerHTML = `<div class="sn-panel sn-panel-pad" style="margin-bottom:24px">
        <div class="sn-split" style="flex-wrap:wrap;gap:12px">
          <div><span class="sn-eyebrow"><i></i>Workspace</span><h2 class="sn-h3" style="margin-top:8px">${esc(org.name)}</h2><p class="sn-muted sn-small" style="margin-top:4px">${esc(counts)}${org.isDemo ? " · sample data" : ""}</p></div>
          <div class="sn-cluster">
            ${info.preview ? '<button type="button" class="sn-btn sn-btn-sm" data-access-exit-preview>Exit preview</button>' : access.can("access.manage") ? '<button type="button" class="sn-btn sn-btn-sm" data-preview>Preview as…</button>' : ""}
            <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-switch>Switch workspace</button>
          </div>
        </div>
        <div class="access-summary">
          <div><span>Signed in as</span><strong>${esc(info.member?.name || "Nobody selected")}</strong></div>
          <div><span>Access profile</span><strong>${esc(info.preview ? `${info.preview.name} (preview)` : info.profileName || "None assigned")}</strong></div>
          <div><span>Teams</span><strong>${esc(info.teams.map(team => team.name).join(", ") || "None")}</strong></div>
          <div><span>Capabilities</span><strong>${info.capabilityCount} of ${info.totalCapabilities}</strong></div>
        </div>
      </div>`;
    }
    accessUi.bindExit(setup);
  }


  const panels = {
    overview() {
      const info = access.summary();
      const open = visible.reduce((sum, project) => sum + arr(project.tasks).filter(isOpen).length, 0);
      const decisions = visible.reduce((sum, project) => sum + arr(project.decisions).length, 0);
      const org = access.organization();
      const activity = visible.flatMap(project => arr(project.activities).slice(0, 6).map(item => ({ item, project }))).slice(0, 8);
      const yours = `<article class="sn-panel sn-panel-pad">
        <h2 class="sn-h3">Your access</h2>
        <p class="sn-body" style="margin-top:8px">${info.personal
          ? "Every capability is available in the personal workspace."
          : info.preview
            ? `You are previewing Signal Noir as <strong>${esc(info.preview.name)}</strong>. Your own access is unchanged.`
            : info.sources.length
              ? `Your capabilities come from ${esc(info.sources.map(entry => entry.source === "team" ? `${entry.profileName} (via ${entry.teamName})` : entry.profileName).join(" and "))}.`
              : "No access profile is assigned to you in this organization, so nothing is available."}</p>
        ${info.restrictions.length ? `<p class="sn-muted sn-small" style="margin-top:8px">${info.restrictions.length} capabilit${info.restrictions.length === 1 ? "y is" : "ies are"} restricted for you specifically.</p>` : ""}
        <div class="cap-summary" style="margin-top:16px">${access.CATEGORIES.map(category => {
          const caps = access.capabilitiesIn(category.id);
          const on = caps.filter(cap => info.capabilities.includes(cap.id)).length;
          return `<div class="cap-summary-row"><span>${esc(category.label)}</span><span class="sn-progress" role="img" aria-label="${esc(category.label)}: ${on} of ${caps.length} capabilities"><span style="--value:${Math.round(on / caps.length * 100)}%"></span></span><b>${on}/${caps.length}</b></div>`;
        }).join("")}</div>
      </article>`;
      const work = `<article class="sn-panel sn-panel-pad">
        <h2 class="sn-h3">Follow-through</h2>
        <p class="sn-muted sn-small" style="margin-top:6px">Across the ${visible.length} project${visible.length === 1 ? "" : "s"} you can see in this browser.</p>
        <div class="kpis" style="margin-top:16px">${[["Projects", visible.length], ["Open tasks", open], ["Decisions", decisions]].map(([label, value]) => `<div class="sn-panel sn-stat"><span class="sn-stat-label">${label}</span><span class="sn-stat-value" style="font-size:22px">${value}</span></div>`).join("")}</div>
        ${activity.length ? `<ul class="org-activity">${activity.map(({ item, project }) => `<li><strong>${esc(item.text)}</strong><small>${esc(project.name)} · ${esc(item.at || "")}</small></li>`).join("")}</ul>` : '<p class="sn-muted sn-small" style="margin-top:16px">No project activity yet.</p>'}
      </article>`;
      const teams = org && access.can("teams.manage") ? `<article class="sn-panel sn-panel-pad"><div class="sn-split"><h2 class="sn-h3">Teams</h2><button type="button" class="sn-btn sn-btn-sm" data-tab-link="teams">Manage</button></div>
        ${org.teams.length ? `<div class="list" style="margin-top:14px">${org.teams.map(team => `<div class="list-row"><span class="sn-card-icon" aria-hidden="true">${esc(initials(team.name))}</span><span style="min-width:0"><strong>${esc(team.name)}</strong><small>${access.teams.members(team.id).length} member(s) · ${esc(profileName(team.profileId))}</small></span><span class="sn-badge sn-badge-muted">${capCount(team.profileId)} capabilities</span></div>`).join("")}</div>`
          : '<p class="sn-muted sn-small" style="margin-top:12px">No teams yet.</p>'}</article>` : "";
      return `<div class="org-grid">${yours}${work}${teams}</div>`;
    },

    teams() {
      const org = access.organization();
      if (!org) return needsOrganization("teams");
      if (!org.teams.length) return `${teamForm()}${empty("◎", "No teams yet", "A team groups people who do the same job, and gives them one access profile.", "")}`;
      return `${teamForm()}<div class="list">${org.teams.map(team => {
        const people = access.teams.members(team.id);
        return `<div class="list-row org-row"><span class="sn-card-icon" aria-hidden="true">${esc(initials(team.name))}</span>
          <span style="min-width:0"><strong>${esc(team.name)}</strong><small>${esc(team.description || "No description")}</small>
            <span class="org-chips">${people.length ? people.slice(0, 6).map(person => `<span class="sn-chip sn-chip-sm">${esc(person.name)}</span>`).join("") : '<span class="sn-muted sn-xs">No members yet</span>'}${people.length > 6 ? `<span class="sn-chip sn-chip-sm">+${people.length - 6}</span>` : ""}</span>
          </span>
          <span class="sn-cluster"><span class="sn-badge${team.profileId ? " sn-badge-accent" : " sn-badge-warning"}">${esc(profileName(team.profileId))}</span><button type="button" class="sn-btn sn-btn-sm" data-edit-team="${esc(team.id)}">Edit</button></span></div>`;
      }).join("")}</div>
      <p class="sn-muted sn-small" style="margin-top:14px">Projects a team can reach are set under <button type="button" class="sn-link" data-tab-link="projects">Project access</button>.</p>`;
    },

    members() {
      const org = access.organization();
      if (!org) return needsOrganization("members");
      const admins = access.administrators(org);
      return `${memberForm()}${org.members.length ? `<div class="list">${org.members.map(person => {
        const teams = person.teamIds.map(id => access.teams.get(id)?.name).filter(Boolean);
        const extras = [person.grants.length ? `+${person.grants.length} granted` : "", person.restrictions.length ? `−${person.restrictions.length} restricted` : ""].filter(Boolean).join(" · ");
        return `<div class="list-row org-row"><span class="sn-card-icon" aria-hidden="true">${esc(initials(person.name))}</span>
          <span style="min-width:0"><strong>${esc(person.name)}${admins.some(item => item.id === person.id) ? ' <span class="sn-badge sn-badge-muted">Administrator</span>' : ""}</strong>
            <small>${esc([person.title, teams.join(", "), extras].filter(Boolean).join(" · ") || "No team")}</small></span>
          <span class="sn-cluster"><span class="sn-badge${person.profileId ? "" : " sn-badge-warning"}">${esc(profileName(person.profileId))}</span><button type="button" class="sn-btn sn-btn-sm" data-edit-member="${esc(person.id)}">Edit</button></span></div>`;
      }).join("")}</div>` : empty("◔", "No members yet", "Add the people who use this install so each one sees the part of Signal Noir that belongs to their job.", "")}
      <p class="sn-muted sn-small" style="margin-top:14px">There is no sign-in and no password. A member record decides which capabilities the interface shows; it does not authenticate anyone.</p>`;
    },

    profiles() {
      const org = access.organization();
      if (!org) return needsOrganization("profiles");
      const usage = profile => {
        const teams = org.teams.filter(team => team.profileId === profile.id).length;
        const people = org.members.filter(person => person.profileId === profile.id).length;
        return [teams ? `${teams} team${teams === 1 ? "" : "s"}` : "", people ? `${people} member${people === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Not assigned";
      };
      return `<div class="sn-cluster" style="margin-bottom:18px"><button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-new-profile>New access profile</button><button type="button" class="sn-btn sn-btn-sm" data-preview>Preview as a profile</button></div>
        <div class="list">${org.profiles.map(profile => `<div class="list-row org-row"><span class="sn-card-icon" aria-hidden="true">${esc(initials(profile.name))}</span>
          <span style="min-width:0"><strong>${esc(profile.name)}${profile.builtin ? ' <span class="sn-badge sn-badge-muted">Provided</span>' : ""}</strong><small>${esc(profile.description || "No description")}</small>
          <small class="sn-faint">${esc(usage(profile))}</small></span>
          <span class="sn-cluster"><span class="sn-badge sn-badge-accent">${profile.capabilities.length} of ${access.CAPABILITIES.length}</span><button type="button" class="sn-btn sn-btn-sm" data-edit-profile="${esc(profile.id)}">Edit</button></span></div>`).join("")}</div>
        <p class="sn-muted sn-small" style="margin-top:14px">Provided profiles are starting points, not fixed product tiers. Rename them, change what they include, or build your own.</p>`;
    },

    projects() {
      const org = access.organization();
      if (!org) return needsOrganization("projects");
      if (!projects.length) return empty("▦", "No projects in this browser", "Project access decides which teams and people can reach a project. Create one in Studio first.");
      return `<p class="sn-body" style="margin-bottom:18px">A capability says what someone may do. Project access says where they may do it. Someone who can create reports still needs access to a project before they can create one there.</p>
        <div class="list">${projects.map(project => {
          const record = access.projectAccess.get(project.id);
          const restricted = record?.visibility === "restricted";
          const reach = restricted ? `${record.teams.length} team${record.teams.length === 1 ? "" : "s"} · ${record.members.length} person${record.members.length === 1 ? "" : "s"}` : "Everyone in the organization";
          return `<div class="list-row org-row"><span class="sn-card-icon" aria-hidden="true">▦</span>
            <span style="min-width:0"><strong>${esc(project.name)}</strong><small>${esc(reach)}</small></span>
            <span class="sn-cluster">${tagFor(project)}<span class="sn-badge${restricted ? " sn-badge-warning" : " sn-badge-muted"}">${restricted ? "Restricted" : "Open"}</span><button type="button" class="sn-btn sn-btn-sm" data-edit-access="${esc(project.id)}">Change</button></span></div>`;
        }).join("")}</div>`;
    },

    operations() {
      const O = window.SignalNoir.operations;
      if (!O) return empty("↻", "Operations unavailable", "The operations layer did not load.", "");

      const items = O.attentionAcross(visible, { limit: 40 });
      const totals = visible.reduce((sum, project) => {
        const health = O.health(project);
        return { active: sum.active + health.activeAutomations, runs: sum.runs + health.recentRuns, failed: sum.failed + health.failed, missed: sum.missed + health.missed, alerts: sum.alerts + health.openAlerts, monitors: sum.monitors + health.monitors };
      }, { active: 0, runs: 0, failed: 0, missed: 0, alerts: 0, monitors: 0 });
      const stale = visible.flatMap(project => arr(project.datasets)
        .filter(dataset => { const at = dataset.updatedAt || dataset.addedAt; return at && Date.now() - at > 7 * 86400000; })
        .map(dataset => ({ project: project.name, name: dataset.name, at: dataset.updatedAt || dataset.addedAt })));

      const stats = `<div class="kpis" style="margin-bottom:22px">${[["Active automations", totals.active], ["Recent runs", totals.runs], ["Failed", totals.failed], ["Missed", totals.missed], ["Open alerts", totals.alerts], ["Monitors", totals.monitors]]
        .map(([label, value]) => `<div class="sn-panel sn-stat"><span class="sn-stat-label">${esc(label)}</span><span class="sn-stat-value">${value}</span></div>`).join("")}</div>`;

      const attention = items.length
        ? `<div class="list">${items.map(item => `<button type="button" class="list-row" data-project="${esc(item.projectId)}"><span class="sn-card-icon" aria-hidden="true">${item.severity === "critical" ? "✕" : item.severity === "warning" ? "!" : "○"}</span><span style="min-width:0"><strong>${esc(item.title)}</strong><small>${esc([item.projectName, item.description].filter(Boolean).join(" · "))}</small></span><span class="sn-cluster"><span class="sn-badge ${item.severity === "critical" ? "sn-badge-danger" : item.severity === "warning" ? "sn-badge-warning" : "sn-badge-muted"}">${esc(item.severity)}</span></span></button>`).join("")}</div>`
        : empty("✓", "Nothing needs attention", "Failed runs, open alerts, approvals and missed schedules across the projects you can reach would appear here.", "");

      const staleHtml = stale.length
        ? `<h2 class="sn-eyebrow" style="margin:26px 0 12px">Stale data</h2><div class="list">${stale.slice(0, 10).map(item => `<div class="list-row"><span class="sn-card-icon" aria-hidden="true">▦</span><span style="min-width:0"><strong>${esc(item.name)}</strong><small>${esc(item.project)} · last updated ${esc(new Date(item.at).toLocaleDateString())}</small></span><span class="sn-badge sn-badge-warning">Over a week old</span></div>`).join("")}</div>`
        : "";

      return `${stats}<h2 class="sn-eyebrow" style="margin-bottom:12px">Needs attention</h2>${attention}${staleHtml}
        <p class="sn-muted sn-small" style="margin-top:18px">Rolled up from the ${visible.length} project${visible.length === 1 ? "" : "s"} you can reach in this browser. Signal Noir has no server, so nothing here ran unattended: local schedules are checked only while Studio is open.</p>`;
    },

    decisions() {
      const list = visible.flatMap(project => arr(project.decisions).map(item => ({ item, project }))).sort((a, b) => (b.item.createdAt || 0) - (a.item.createdAt || 0));
      return list.length ? `<div class="list">${list.map(({ item, project }) => `<button type="button" class="list-row" data-project="${esc(project.id)}"><span class="sn-card-icon" aria-hidden="true">◇</span><span style="min-width:0"><strong>${esc(item.title)}</strong><small>${esc([project.name, item.owner, item.evidence && `evidence: ${item.evidence}`].filter(Boolean).join(" · "))}</small></span><span class="sn-cluster">${tagFor(project)}${statusBadge(item.status)}</span></button>`).join("")}</div>`
        : empty("◇", "No decisions recorded", "When Vanessa suggests a decision, or you log one under Decisions & tasks in Studio, it’s kept here with the evidence behind it.");
    },

    tasks() {
      const list = visible.flatMap(project => arr(project.tasks).map(item => ({ item, project }))).sort((a, b) => Number(isOpen(b.item)) - Number(isOpen(a.item)) || (b.item.createdAt || 0) - (a.item.createdAt || 0));
      return list.length ? `<div class="list">${list.map(({ item, project }) => `<button type="button" class="list-row" data-project="${esc(project.id)}"><span class="sn-card-icon" aria-hidden="true">${isOpen(item) ? "☐" : "☑"}</span><span style="min-width:0"><strong>${esc(item.title)}</strong><small>${esc([project.name, item.owner, item.due && `due ${item.due}`, item.priority].filter(Boolean).join(" · "))}</small></span><span class="sn-cluster">${tagFor(project)}${statusBadge(item.status)}</span></button>`).join("")}</div>`
        : empty("☐", "No tasks yet", "Add follow-ups from Vanessa’s results, or create tasks under Decisions & tasks in Studio.");
    },

    governance() {
      if (!visible.length) return empty("✓", "No projects yet", "Quality rules, data contracts, approvals and privacy scans appear here once a project uses them.");
      return `<div class="list">${visible.map(project => {
        const approvals = arr(project.approvals);
        const lastApproval = approvals[0]?.status || project.projectStatus || "Draft";
        const facts = [`${arr(project.rules).length} quality rules`, `${arr(project.contracts).length} contracts`, `${arr(project.privacyFindings).length} privacy findings`, `${arr(project.metricRegistry).length || arr(project.metrics).length} defined metrics`];
        return `<button type="button" class="list-row" data-project="${esc(project.id)}"><span class="sn-card-icon" aria-hidden="true">✓</span><span style="min-width:0"><strong>${esc(project.name)}</strong><small>${esc(facts.join(" · "))}</small></span><span class="sn-cluster">${tagFor(project)}${statusBadge(lastApproval)}</span></button>`;
      }).join("")}</div>`;
    },

    audit() {
      const orgEvents = access.auditEvents().map(item => ({ at: item.at, actor: item.actor, action: item.action, detail: item.detail, source: "Organization" }));
      const projectEvents = visible.flatMap(project => arr(project.auditEvents).slice(0, 40).map(item => ({ at: item.at, actor: item.actor, action: item.action, detail: item.detail, source: project.name })));
      const activity = visible.flatMap(project => arr(project.activities).slice(0, 12).map(item => ({ at: Date.parse(item.at) || 0, actor: "Project", action: item.text, detail: "", source: project.name })));
      const list = [...orgEvents, ...projectEvents, ...activity].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 150);
      const note = '<p class="sn-muted sn-small" style="margin-top:14px">This is a local record of changes made in this browser, kept so an administrator can see what happened. It is not a tamper-evident audit log: anything stored in a browser can be edited or cleared by whoever is using it.</p>';
      return list.length ? `<div class="list">${list.map(item => `<div class="list-row"><span class="sn-card-icon" aria-hidden="true">•</span><span style="min-width:0"><strong>${esc(item.action)}${item.detail ? ` · ${esc(item.detail)}` : ""}</strong><small>${esc(item.actor)} · ${esc(item.source)}${item.at ? ` · ${esc(new Date(item.at).toLocaleString())}` : ""}</small></span></div>`).join("")}</div>${note}`
        : `${empty("•", "Nothing recorded yet", "Changes to teams, members, access profiles and project access are recorded here, along with project activity.", "")}${note}`;
    }
  };

  function needsOrganization(what) {
    return empty("◎", "No organization yet", `You’re in the personal workspace, where every capability is available and there are no ${what} to manage. Create an organization to configure them.`,
      '<button type="button" class="sn-btn sn-btn-sm sn-btn-primary" data-new-org>Create an organization</button>');
  }


  function teamForm() {
    const org = access.organization();
    return `<form class="org-form" id="team-form">
      <input class="sn-input" name="name" placeholder="Team name" required maxlength="60" aria-label="Team name">
      <input class="sn-input" name="description" placeholder="What this team does" maxlength="120" aria-label="Team description">
      <select class="sn-select" name="profileId" aria-label="Access profile"><option value="">Choose an access profile</option>${org.profiles.map(profile => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join("")}</select>
      <button class="sn-btn sn-btn-sm sn-btn-primary">Add team</button>
    </form>`;
  }

  function memberForm() {
    const org = access.organization();
    return `<form class="org-form" id="member-form">
      <input class="sn-input" name="name" placeholder="Name" required maxlength="60" aria-label="Member name">
      <input class="sn-input" name="title" placeholder="Job title" maxlength="60" aria-label="Job title">
      <select class="sn-select" name="profileId" aria-label="Access profile"><option value="">Access profile</option>${org.profiles.map(profile => `<option value="${esc(profile.id)}" ${profile.id === org.settings.defaultProfileId ? "selected" : ""}>${esc(profile.name)}</option>`).join("")}</select>
      <button class="sn-btn sn-btn-sm sn-btn-primary">Add member</button>
    </form>`;
  }


  function dialog(html, { label = "Dialog" } = {}) {
    document.querySelector(".org-dialog")?.remove();
    const shell = document.createElement("div");
    shell.className = "sn-modal-shell sn-scope org-dialog";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", label);
    shell.innerHTML = `<div class="sn-modal org-modal">${html}</div>`;
    document.body.appendChild(shell);
    const close = () => shell.remove();
    shell.addEventListener("click", event => { if (event.target === shell || event.target.closest("[data-cancel]")) close(); });
    shell.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    setTimeout(() => shell.querySelector("input, select, button")?.focus(), 30);
    return { shell, close };
  }

  function editProfile(id) {
    const profile = id ? access.profiles.get(id) : null;
    const org = access.organization();
    const inUse = profile ? [...org.teams.filter(team => team.profileId === profile.id).map(team => team.name), ...org.members.filter(person => person.profileId === profile.id).map(person => person.name)] : [];
    const { shell, close } = dialog(`<form id="profile-form">
      <span class="sn-eyebrow"><i></i>${profile ? "Edit access profile" : "New access profile"}</span>
      <h2 class="sn-h3" style="margin:10px 0 4px">${profile ? esc(profile.name) : "What should this group be able to do?"}</h2>
      <p class="sn-muted sn-small">Choose capabilities by what they let someone do. The interface adapts to match: anything not included simply isn’t shown.</p>
      <div class="form-grid" style="margin-top:18px">
        <label class="sn-label" for="profile-name">Name</label>
        <input class="sn-input" id="profile-name" name="name" value="${esc(profile?.name || "")}" required maxlength="60" placeholder="Tour Guide, Executive Viewer, Data Steward…">
        <label class="sn-label" for="profile-description">Description</label>
        <input class="sn-input" id="profile-description" name="description" value="${esc(profile?.description || "")}" maxlength="160" placeholder="Who this is for, in one line">
      </div>
      <div class="sn-cluster" style="margin:18px 0 10px"><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-cap-all>Select all</button><button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-cap-none>Clear all</button><span class="sn-muted sn-xs" id="cap-count"></span></div>
      <div id="cap-editor">${accessUi.capabilityEditorHtml(profile?.capabilities || [])}</div>
      <div class="sn-split" style="margin-top:22px;gap:10px">
        <span>${profile && !profile.builtin ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-delete-profile>Delete</button>` : ""}</span>
        <span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">${profile ? "Save changes" : "Create profile"}</button></span>
      </div>
      ${inUse.length ? `<p class="sn-muted sn-xs" style="margin-top:12px">Assigned to ${esc(inUse.join(", "))}. Changes apply to them immediately.</p>` : ""}
    </form>`, { label: profile ? "Edit access profile" : "New access profile" });

    const countNode = shell.querySelector("#cap-count");
    const sync = () => {
      const chosen = accessUi.readCapabilityEditor(shell).length;
      countNode.textContent = `${chosen} of ${access.CAPABILITIES.length} capabilities selected`;
      shell.querySelectorAll(".cap-group").forEach(group => {
        const total = group.querySelectorAll("input").length;
        const on = group.querySelectorAll("input:checked").length;
        const badge = group.querySelector("summary .sn-badge");
        badge.textContent = `${on} of ${total}`;
        badge.className = `sn-badge${on ? " sn-badge-accent" : " sn-badge-muted"}`;
      });
    };
    sync();
    shell.addEventListener("change", sync);
    shell.querySelector("[data-cap-all]").addEventListener("click", () => { shell.querySelectorAll("#cap-editor input").forEach(input => { input.checked = true; }); sync(); });
    shell.querySelector("[data-cap-none]").addEventListener("click", () => { shell.querySelectorAll("#cap-editor input").forEach(input => { input.checked = false; }); sync(); });
    shell.querySelector("[data-delete-profile]")?.addEventListener("click", () => deleteProfile(profile, close));
    shell.querySelector("#profile-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      const capabilities = accessUi.readCapabilityEditor(shell);
      if (profile) {
        const wasAdmin = profile.capabilities.includes("access.manage");
        access.profiles.update(profile.id, { name: data.get("name"), description: data.get("description"), capabilities });
        if (wasAdmin && !capabilities.includes("access.manage") && !access.administrators().length) {
          access.profiles.update(profile.id, { capabilities: [...capabilities, "access.manage"] });
          platform().toast("Kept “Manage access profiles” on: it was the last way into these settings.");
        } else platform().toast(`${data.get("name")} saved.`);
      } else {
        access.profiles.create({ name: data.get("name"), description: data.get("description"), capabilities });
        platform().toast(`${data.get("name")} created.`);
      }
      close(); render();
    });
  }

  function deleteProfile(profile, closeParent) {
    const result = access.profiles.remove(profile.id);
    if (result.ok) { closeParent(); platform().toast(`${profile.name} deleted.`); render(); return; }
    if (result.reason !== "in-use") { platform().toast(result.reason === "last-admin" ? "That would leave nobody able to manage access." : result.reason); return; }
    const others = access.profiles.list().filter(item => item.id !== profile.id);
    const { shell, close } = dialog(`<form id="reassign-form">
      <span class="sn-eyebrow"><i></i>Reassign first</span>
      <h2 class="sn-h3" style="margin:10px 0 4px">${esc(profile.name)} is in use</h2>
      <p class="sn-body">${esc([...result.teams, ...result.members].join(", "))} ${result.teams.length + result.members.length === 1 ? "uses" : "use"} this access profile. Choose what they should get instead.</p>
      <label class="sn-label" for="reassign-to" style="margin-top:16px">Move them to</label>
      <select class="sn-select" id="reassign-to" name="to" required>${others.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}</select>
      <div class="sn-cluster" style="justify-content:flex-end;margin-top:20px"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-danger">Reassign and delete</button></div>
    </form>`, { label: "Reassign access profile" });
    shell.querySelector("#reassign-form").addEventListener("submit", event => {
      event.preventDefault();
      const outcome = access.profiles.remove(profile.id, { reassignTo: new FormData(event.target).get("to") });
      close();
      if (!outcome.ok) { platform().toast(outcome.reason === "last-admin" ? "That would leave nobody able to manage access." : outcome.reason); return; }
      closeParent(); platform().toast(`${profile.name} deleted.`); render();
    });
  }

  function editTeam(id) {
    const team = access.teams.get(id);
    const org = access.organization();
    if (!team) return;
    const { shell, close } = dialog(`<form id="team-edit-form">
      <span class="sn-eyebrow"><i></i>Team</span>
      <h2 class="sn-h3" style="margin:10px 0 14px">${esc(team.name)}</h2>
      <div class="form-grid">
        <label class="sn-label" for="team-name">Name</label>
        <input class="sn-input" id="team-name" name="name" value="${esc(team.name)}" required maxlength="60">
        <label class="sn-label" for="team-description">Description</label>
        <input class="sn-input" id="team-description" name="description" value="${esc(team.description)}" maxlength="120">
        <label class="sn-label" for="team-profile">Access profile</label>
        <select class="sn-select" id="team-profile" name="profileId"><option value="">No profile — no capabilities</option>${org.profiles.map(profile => `<option value="${esc(profile.id)}" ${profile.id === team.profileId ? "selected" : ""}>${esc(profile.name)} (${profile.capabilities.length} capabilities)</option>`).join("")}</select>
        <label class="sn-label" for="team-owner">Team owner</label>
        <select class="sn-select" id="team-owner" name="ownerId"><option value="">None</option>${org.members.map(person => `<option value="${esc(person.id)}" ${person.id === team.ownerId ? "selected" : ""}>${esc(person.name)}</option>`).join("")}</select>
      </div>
      <fieldset class="org-fieldset"><legend>Members</legend>
        ${org.members.length ? org.members.map(person => `<label class="org-check"><input type="checkbox" name="members" value="${esc(person.id)}" ${person.teamIds.includes(team.id) ? "checked" : ""}><span>${esc(person.name)}${person.title ? ` <small>${esc(person.title)}</small>` : ""}</span></label>`).join("") : '<p class="sn-muted sn-small">No members in this organization yet.</p>'}
      </fieldset>
      <p class="sn-muted sn-xs" style="margin-top:10px">Created ${esc(when(team.createdAt))}. Recent activity for a team needs shared, server-held projects, which Signal Noir does not have yet, so none is shown.</p>
      <div class="sn-split" style="margin-top:20px;gap:10px">
        <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-delete-team>Delete team</button>
        <span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">Save changes</button></span>
      </div>
    </form>`, { label: "Edit team" });
    shell.querySelector("[data-delete-team]").addEventListener("click", () => {
      if (!confirm(`Delete ${team.name}? Members stay in the organization and keep their own access profile.`)) return;
      access.teams.remove(team.id); close(); platform().toast(`${team.name} deleted.`); render();
    });
    shell.querySelector("#team-edit-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      access.teams.update(team.id, { name: data.get("name"), description: data.get("description"), profileId: data.get("profileId") || null, ownerId: data.get("ownerId") || null });
      access.teams.setMembers(team.id, data.getAll("members"));
      close(); platform().toast(`${data.get("name")} saved.`); render();
    });
  }

  function editMember(id) {
    const person = access.members.get(id);
    const org = access.organization();
    if (!person) return;
    const { shell, close } = dialog(`<form id="member-edit-form">
      <span class="sn-eyebrow"><i></i>Member</span>
      <h2 class="sn-h3" style="margin:10px 0 14px">${esc(person.name)}</h2>
      <div class="form-grid">
        <label class="sn-label" for="member-name">Name</label>
        <input class="sn-input" id="member-name" name="name" value="${esc(person.name)}" required maxlength="60">
        <label class="sn-label" for="member-title">Job title</label>
        <input class="sn-input" id="member-title" name="title" value="${esc(person.title)}" maxlength="60">
        <label class="sn-label" for="member-email">Email <span class="sn-muted sn-xs">(optional, for your own reference)</span></label>
        <input class="sn-input" id="member-email" name="email" type="email" value="${esc(person.email)}" maxlength="120">
        <label class="sn-label" for="member-profile">Access profile</label>
        <select class="sn-select" id="member-profile" name="profileId"><option value="">No personal profile — team profiles only</option>${org.profiles.map(profile => `<option value="${esc(profile.id)}" ${profile.id === person.profileId ? "selected" : ""}>${esc(profile.name)}</option>`).join("")}</select>
      </div>
      <fieldset class="org-fieldset"><legend>Teams</legend>
        ${org.teams.length ? org.teams.map(team => `<label class="org-check"><input type="checkbox" name="teams" value="${esc(team.id)}" ${person.teamIds.includes(team.id) ? "checked" : ""}><span>${esc(team.name)} <small>${esc(profileName(team.profileId))}</small></span></label>`).join("") : '<p class="sn-muted sn-small">No teams yet.</p>'}
      </fieldset>
      <p class="sn-muted sn-xs" style="margin-top:12px">Capabilities add up across a personal profile and every team profile. A restriction below is applied last and always wins.</p>
      <details class="cap-group" style="margin-top:14px"><summary><span><strong>Restrict specific capabilities</strong><small>Remove something this person would otherwise get</small></span><span class="sn-badge${person.restrictions.length ? " sn-badge-warning" : " sn-badge-muted"}">${person.restrictions.length}</span></summary>
        <div class="cap-list">${access.CAPABILITIES.map(cap => `<label class="cap-row"><input type="checkbox" name="restrictions" value="${esc(cap.id)}" ${person.restrictions.includes(cap.id) ? "checked" : ""}><span><strong>${esc(cap.name)}</strong><small>${esc(cap.description)}</small></span><span></span></label>`).join("")}</div>
      </details>
      <div class="sn-split" style="margin-top:20px;gap:10px">
        <button type="button" class="sn-btn sn-btn-sm sn-btn-ghost sn-btn-danger" data-delete-member>Remove from organization</button>
        <span class="sn-cluster"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">Save changes</button></span>
      </div>
    </form>`, { label: "Edit member" });
    shell.querySelector("[data-delete-member]").addEventListener("click", () => {
      if (!confirm(`Remove ${person.name} from ${org.name}?`)) return;
      const result = access.members.remove(person.id);
      if (!result.ok) { platform().toast("That’s the last person who can manage access. Give someone else an administrator profile first."); return; }
      close(); platform().toast(`${person.name} removed.`); render();
    });
    shell.querySelector("#member-edit-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      const result = access.members.update(person.id, { name: data.get("name"), title: data.get("title"), email: data.get("email"), profileId: data.get("profileId") || null, teamIds: data.getAll("teams"), restrictions: data.getAll("restrictions") });
      if (result?.error === "last-admin") { platform().toast("That change would leave nobody able to manage access. Give someone else an administrator profile first."); return; }
      close(); platform().toast(`${data.get("name")} saved.`); render();
    });
  }

  function editProjectAccess(projectId) {
    const project = projects.find(item => item.id === projectId);
    const org = access.organization();
    if (!project) return;
    const record = access.projectAccess.get(projectId) || { visibility: "organization", defaultRole: "viewer", teams: [], members: [] };
    const roleOptions = (selected) => access.PROJECT_ROLES.map(role => `<option value="${role.id}" ${role.id === selected ? "selected" : ""}>${esc(role.label)}</option>`).join("");
    const { shell, close } = dialog(`<form id="access-form">
      <span class="sn-eyebrow"><i></i>Project access</span>
      <h2 class="sn-h3" style="margin:10px 0 4px">${esc(project.name)}</h2>
      <p class="sn-muted sn-small">Who in ${esc(org.name)} can reach this project, and what they may do inside it.</p>
      <fieldset class="org-fieldset" style="margin-top:18px"><legend>Who can see it</legend>
        <label class="org-check"><input type="radio" name="visibility" value="organization" ${record.visibility === "organization" ? "checked" : ""}><span>Everyone in the organization <small>Anyone whose capabilities allow it</small></span></label>
        <label class="org-check"><input type="radio" name="visibility" value="restricted" ${record.visibility === "restricted" ? "checked" : ""}><span>Only the teams and people chosen below <small>It disappears from everyone else’s Studio and library</small></span></label>
      </fieldset>
      <div class="form-grid" style="margin-top:14px">
        <label class="sn-label" for="default-role">Default role when everyone can see it</label>
        <select class="sn-select" id="default-role" name="defaultRole">${roleOptions(record.defaultRole)}</select>
      </div>
      <fieldset class="org-fieldset"><legend>Teams</legend>
        ${org.teams.length ? org.teams.map(team => { const entry = record.teams.find(item => item.id === team.id); return `<label class="org-check org-check-role"><input type="checkbox" name="team" value="${esc(team.id)}" ${entry ? "checked" : ""}><span>${esc(team.name)}</span><select class="sn-select sn-select-sm" name="team-role-${esc(team.id)}" aria-label="${esc(team.name)} role">${roleOptions(entry?.role || "viewer")}</select></label>`; }).join("") : '<p class="sn-muted sn-small">No teams yet.</p>'}
      </fieldset>
      <fieldset class="org-fieldset"><legend>Individual people</legend>
        ${org.members.length ? org.members.map(person => { const entry = record.members.find(item => item.id === person.id); return `<label class="org-check org-check-role"><input type="checkbox" name="member" value="${esc(person.id)}" ${entry ? "checked" : ""}><span>${esc(person.name)}</span><select class="sn-select sn-select-sm" name="member-role-${esc(person.id)}" aria-label="${esc(person.name)} role">${roleOptions(entry?.role || "viewer")}</select></label>`; }).join("") : '<p class="sn-muted sn-small">No members yet.</p>'}
      </fieldset>
      <p class="sn-muted sn-xs" style="margin-top:12px">${access.PROJECT_ROLES.map(role => `<strong>${esc(role.label)}</strong> ${esc(role.description)}`).join(" ")}</p>
      <div class="sn-cluster" style="justify-content:flex-end;margin-top:20px"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">Save access</button></div>
    </form>`, { label: "Project access" });
    shell.querySelector("#access-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      access.projectAccess.set(projectId, {
        visibility: data.get("visibility"),
        defaultRole: data.get("defaultRole"),
        teams: data.getAll("team").map(id => ({ id, role: data.get(`team-role-${id}`) })),
        members: data.getAll("member").map(id => ({ id, role: data.get(`member-role-${id}`) }))
      });
      close(); platform().toast("Project access updated."); render();
    });
  }

  function openPreview() {
    const org = access.organization();
    const { shell, close } = dialog(`<div>
      <span class="sn-eyebrow"><i></i>Preview</span>
      <h2 class="sn-h3" style="margin:10px 0 4px">See Signal Noir as a profile</h2>
      <p class="sn-muted sn-small">Your own access is never changed. Preview lasts until you exit it or close the browser.</p>
      <div class="sn-stack" style="--sn-stack-gap:8px;margin-top:18px">${org.profiles.map(profile => `<button type="button" class="list-row" data-preview-profile="${esc(profile.id)}"><span class="sn-card-icon" aria-hidden="true">${esc(initials(profile.name))}</span><span style="min-width:0"><strong>${esc(profile.name)}</strong><small>${esc(profile.description || "")}</small></span><span class="sn-badge sn-badge-muted">${profile.capabilities.length} capabilities</span></button>`).join("")}</div>
      <div class="sn-cluster" style="justify-content:flex-end;margin-top:18px"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button></div>
    </div>`, { label: "Preview as a profile" });
    shell.querySelectorAll("[data-preview-profile]").forEach(button => button.addEventListener("click", () => {
      access.preview(button.dataset.previewProfile);
      close(); location.reload();
    }));
  }

  function newOrganization() {
    const { shell, close } = dialog(`<form id="new-org-form">
      <span class="sn-eyebrow"><i></i>New organization</span>
      <h2 class="sn-h3" style="margin:10px 0 4px">Set up an organization workspace</h2>
      <p class="sn-muted sn-small">It lives in this browser like everything else. You get the six provided access profiles as a starting point, and you become its administrator.</p>
      <div class="form-grid" style="margin-top:18px">
        <label class="sn-label" for="org-name">Organization name</label>
        <input class="sn-input" id="org-name" name="name" required maxlength="80" placeholder="Undergraduate Admissions">
        <label class="sn-label" for="admin-name">Your name</label>
        <input class="sn-input" id="admin-name" name="admin" required maxlength="60" placeholder="Who is setting this up">
      </div>
      <div class="sn-cluster" style="justify-content:flex-end;margin-top:20px"><button type="button" class="sn-btn sn-btn-sm" data-cancel>Cancel</button><button class="sn-btn sn-btn-sm sn-btn-primary">Create</button></div>
    </form>`, { label: "New organization" });
    shell.querySelector("#new-org-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      const org = access.createOrganization(data.get("name"), { adminName: data.get("admin") });
      access.setWorkspace(org.id);
      close(); location.reload();
    });
  }


  function render() {
    renderHeader();
    const tabs = available();
    if (!tabs.some(tab => tab.id === active)) active = tabs[0]?.id || "overview";
    const org = access.organization();
    const kpis = org
      ? [["Members", org.members.length], ["Teams", org.teams.length], ["Access profiles", org.profiles.length], ["Projects you can see", visible.length]]
      : [["Local projects", visible.length], ["Open tasks", visible.reduce((sum, project) => sum + arr(project.tasks).filter(isOpen).length, 0)], ["Decisions logged", visible.reduce((sum, project) => sum + arr(project.decisions).length, 0)], ["Quality rules", visible.reduce((sum, project) => sum + arr(project.rules).length, 0)]];
    $("#org-kpis").innerHTML = kpis.map(([label, value]) => `<div class="sn-panel sn-stat"><span class="sn-stat-label">${esc(label)}</span><span class="sn-stat-value">${value}</span></div>`).join("");
    $("#org-tabs").innerHTML = tabs.map(tab => `<button type="button" class="sn-tab" role="tab" id="org-tab-${tab.id}" aria-controls="org-panel" aria-selected="${tab.id === active}" tabindex="${tab.id === active ? 0 : -1}" data-tab="${tab.id}">${esc(tab.label)}</button>`).join("");
    $("#org-panel").setAttribute("aria-labelledby", `org-tab-${active}`);
    $("#org-panel").innerHTML = panels[active]();
  }

  function go(id) {
    if (!available().some(tab => tab.id === id)) return;
    active = id;
    history.replaceState(null, "", `#${active}`);
    render();
    $(`[data-tab="${active}"]`)?.focus();
  }


  $("#org-tabs").addEventListener("click", event => { const tab = event.target.closest("[data-tab]"); if (tab) go(tab.dataset.tab); });
  $("#org-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const tabs = available();
    const index = tabs.findIndex(tab => tab.id === active);
    go(tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id);
  });

  document.addEventListener("click", event => {
    const target = event.target;
    if (target.closest("[data-new-org]")) return newOrganization();
    if (target.closest("[data-create-demo]")) { access.createDemoOrganization(); access.setWorkspace(access.demoOrganization().id); return location.reload(); }
    if (target.closest("[data-open-demo]")) { access.setWorkspace(access.demoOrganization().id); return location.reload(); }
    if (target.closest("[data-switch]")) return accessUi.openSwitcher();
    if (target.closest("[data-preview]")) return openPreview();
    if (target.closest("[data-new-profile]")) return editProfile(null);
    const tabLink = target.closest("[data-tab-link]");
    if (tabLink) return go(tabLink.dataset.tabLink);
    const profile = target.closest("[data-edit-profile]");
    if (profile) return editProfile(profile.dataset.editProfile);
    const team = target.closest("[data-edit-team]");
    if (team) return editTeam(team.dataset.editTeam);
    const person = target.closest("[data-edit-member]");
    if (person) return editMember(person.dataset.editMember);
    const projectAccess = target.closest("[data-edit-access]");
    if (projectAccess) return editProjectAccess(projectAccess.dataset.editAccess);
    const row = target.closest("#org-panel [data-project]");
    if (row) { platform().handoff.set({ openProject: row.dataset.project }); platform().navigate("tools/studio/index.html"); }
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "team-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const created = access.teams.create({ name: data.get("name"), description: data.get("description"), profileId: data.get("profileId") || null });
      platform().toast(`${created.name} created.`);
      render();
    }
    if (event.target.id === "member-form") {
      event.preventDefault();
      const data = new FormData(event.target);
      const created = access.members.create({ name: data.get("name"), title: data.get("title"), profileId: data.get("profileId") || null });
      platform().toast(`${created.name} added.`);
      render();
    }
  });

  window.addEventListener("hashchange", () => { const next = location.hash.slice(1); if (available().some(tab => tab.id === next)) { active = next; render(); } });

  if (available().some(tab => tab.id === location.hash.slice(1))) active = location.hash.slice(1);
  render();
  store.list().then(list => {
    projects = list;
    visible = access.projectAccess.visible(list);
    render();
  });
})();
