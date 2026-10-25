
(function () {
  "use strict";

  const { catalog, access } = window.SignalNoir;
  const esc = window.SignalNoir.site.esc;


  const allowed = catalog.tools.filter(tool => access.canUse("tools", tool.id));
  const hidden = catalog.tools.length - allowed.length;
  const $ = selector => document.querySelector(selector);
  const FAVORITES_KEY = "hub_favorite_tools";
  const RECENT_KEYS = ["hub_platform_recent", "hub_recent_tools"];
  const search = $("#tool-search");
  let active = location.hash.slice(1) || "all";

  const read = key => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
  const favorites = () => new Set(read(FAVORITES_KEY));
  const recentIds = () => {
    const ids = [];
    read("hub_platform_recent").forEach(entry => entry?.id && ids.push(entry.id));
    read("hub_recent_tools").forEach(id => typeof id === "string" && ids.push(id));
    return [...new Set(ids)].filter(id => catalog.tool(id) && access.canUse("tools", id)).slice(0, 6);
  };

  function filters() {
    const favs = favorites();
    return [{ id: "all", label: "All tools", count: allowed.length }, { id: "favorites", label: "★ Favorites", count: allowed.filter(tool => favs.has(tool.id)).length }]
      .concat(catalog.categories.map(category => ({ id: category.id, label: category.label, count: allowed.filter(tool => tool.category === category.id).length })).filter(item => item.count));
  }

  function renderFilters() {
    const list = filters();
    $("#category-nav").innerHTML = list.map((item, index) => `${index === 2 ? "<hr>" : ""}<button type="button" data-filter="${item.id}" aria-pressed="${item.id === active}"><span>${esc(item.label)}</span><span>${item.count}</span></button>`).join("");
    $("#category-chips").innerHTML = list.map(item => `<button type="button" class="sn-chip sn-chip-sm" data-filter="${item.id}" aria-pressed="${item.id === active}">${esc(item.label)}</button>`).join("");
  }

  function card(tool, favs) {
    const favorite = favs.has(tool.id);
    return `<article class="sn-card tool-card is-interactive" data-tool="${tool.id}">
      <span class="sn-card-icon" aria-hidden="true">${esc(tool.icon)}</span>
      <h3 class="sn-card-title"><a href="${tool.id}/index.html" style="color:inherit">${esc(tool.title)}</a></h3>
      <p class="sn-card-text">${esc(tool.description)}</p>
      <div class="tool-card-foot">
        <div class="sn-cluster">${tool.accepts === "tabular" ? '<span class="sn-badge sn-badge-muted">Works with files</span>' : '<span class="sn-badge sn-badge-muted">Paste &amp; go</span>'}${tool.popular ? '<span class="sn-badge sn-badge-accent">Popular</span>' : ""}</div>
        <div class="sn-cluster">
          <button type="button" class="fav-btn" data-favorite="${tool.id}" aria-pressed="${favorite}" aria-label="${favorite ? "Remove" : "Add"} ${esc(tool.title)} ${favorite ? "from" : "to"} favorites">${favorite ? "★" : "☆"}</button>
          ${tool.accepts === "tabular" ? `<button type="button" class="sn-btn sn-btn-sm sn-btn-ghost" data-studio="${tool.id}" title="Open Studio and ask Vanessa to use this">Use in Studio</button>` : ""}
          <a class="sn-btn sn-btn-sm" href="${tool.id}/index.html">Open</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const favs = favorites();
    const matches = tool => !query || `${tool.title} ${tool.description} ${tool.keywords.join(" ")}`.toLowerCase().includes(query);
    let groups;
    if (active === "favorites") groups = [{ label: "Favorites", description: "Tools you starred", tools: allowed.filter(tool => favs.has(tool.id) && matches(tool)) }];
    else groups = catalog.categories.filter(category => active === "all" || category.id === active).map(category => ({ label: category.label, description: category.description, tools: allowed.filter(tool => tool.category === category.id && matches(tool)) }));
    groups = groups.filter(group => group.tools.length);
    const note = hidden && !query ? `<p class="sn-muted sn-small" style="margin-top:8px">${hidden} tool${hidden === 1 ? "" : "s"} ${hidden === 1 ? "isn’t" : "aren’t"} part of your access profile, so ${hidden === 1 ? "it isn’t" : "they aren’t"} shown. Ask an organization administrator if you need ${hidden === 1 ? "it" : "them"}.</p>` : "";
    $("#tool-groups").innerHTML = groups.map(group => `<section class="lib-group"><h2>${esc(group.label)} <small>${esc(group.description)}</small></h2><div class="sn-grid" style="--sn-grid-min:280px;--sn-grid-gap:12px">${group.tools.map(tool => card(tool, favs)).join("")}</div></section>`).join("") + note;
    const none = !groups.length;
    $("#no-results").hidden = !none;
    if (none && !query && !allowed.length) {
      $("#no-results .sn-empty-title").textContent = "No standalone tools in your access profile";
      $("#no-results .sn-empty-text").textContent = "Your work in Signal Noir happens in Studio with Vanessa. Ask an organization administrator if you need the individual tools.";
    } else if (none && active === "favorites" && !query) {
      $("#no-results .sn-empty-title").textContent = "No favorites yet";
      $("#no-results .sn-empty-text").textContent = "Star any tool with ☆ and it will appear here.";
    } else {
      $("#no-results .sn-empty-title").textContent = "No tool matches that";
      $("#no-results .sn-empty-text").textContent = "Try a broader word, or describe the outcome to Vanessa. She can combine several tools into one plan.";
    }
    const ids = recentIds();
    $("#recent").hidden = !ids.length || Boolean(query);
    $("#recent-list").innerHTML = ids.map(id => { const tool = catalog.tool(id); return `<a class="sn-chip" href="${id}/index.html"><span class="sn-card-icon" style="width:22px;height:22px;font-size:9px;border-radius:6px" aria-hidden="true">${esc(tool.icon)}</span>${esc(tool.title)}</a>`; }).join("");
  }

  document.addEventListener("click", event => {
    const filter = event.target.closest("[data-filter]");
    if (filter) { active = filter.dataset.filter; history.replaceState(null, "", active === "all" ? location.pathname : `#${active}`); renderFilters(); render(); return; }
    const fav = event.target.closest("[data-favorite]");
    if (fav) {
      const set = favorites();
      if (set.has(fav.dataset.favorite)) set.delete(fav.dataset.favorite); else set.add(fav.dataset.favorite);
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set])); } catch (error) {                }
      renderFilters(); render();
      document.querySelector(`[data-favorite="${fav.dataset.favorite}"]`)?.focus();
      return;
    }
    const studio = event.target.closest("[data-studio]");
    if (studio) {
      const tool = catalog.tool(studio.dataset.studio);
      const intent = { clean: "clean", join: "join", visualize: "dashboard", report: "dashboard", validate: "analyze" }[tool.step] || "analyze";
      window.SignalNoir.platform.continueInStudio({ prompt: catalog.intent(intent).starter, intent, useWorkspace: true });
    }
  });
  $("#clear-recent").addEventListener("click", () => { RECENT_KEYS.forEach(key => { try { localStorage.removeItem(key); } catch (error) {                } }); render(); });
  search.addEventListener("input", render);
  search.addEventListener("keydown", event => { if (event.key === "Escape") { search.value = ""; render(); } });
  $("#ask-instead").addEventListener("click", event => {
    if (!search.value.trim()) return;
    event.preventDefault();
    window.SignalNoir.platform.continueInStudio({ prompt: search.value.trim(), useWorkspace: false });
  });
  window.addEventListener("hashchange", () => { active = location.hash.slice(1) || "all"; renderFilters(); render(); });
  if (!filters().some(item => item.id === active)) active = "all";
  renderFilters();
  render();
})();
