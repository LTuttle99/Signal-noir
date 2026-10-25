const THEME_KEY = "hub_theme";
const THEME_FONT = "ui-sans-serif,system-ui,-apple-system,sans-serif";

let themeCurrent = "light";

function themeStored() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch (e) {
    return null;
  }
}

function themeRemember(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme === "light" ? "light" : "dark");
  } catch (e) {
    return;
  }
}

function themePreferred() {
  return themeStored() || "dark";
}

function themeRule(cls, decl) {
  return `[data-theme="dark"] [class~="${cls}"]{${decl}}`;
}

function themeHoverRule(cls, decl) {
  return `[data-theme="dark"] [class~="${cls}"]:hover{${decl}}`;
}

function themeGroupHoverRule(cls, decl) {
  return `[data-theme="dark"] .group:hover [class~="${cls}"]{${decl}}`;
}

function themeDivideRule(cls, decl) {
  return `[data-theme="dark"] [class~="${cls}"] > :not([hidden]) ~ :not([hidden]){${decl}}`;
}

function themeTintRules(name, bg, border, ink, inkStrong) {
  const out = [];

  for (const shade of ["50", "100"]) {
    out.push(themeRule(`bg-${name}-${shade}`, `background-color:${bg};`));
    out.push(themeHoverRule(`hover:bg-${name}-${shade}`, `background-color:${bg};`));
  }

  for (const shade of ["100", "200", "300", "400"]) {
    out.push(themeRule(`border-${name}-${shade}`, `border-color:${border};`));
    out.push(themeHoverRule(`hover:border-${name}-${shade}`, `border-color:${border};`));
  }

  for (const shade of ["400", "500", "600"]) {
    out.push(themeRule(`text-${name}-${shade}`, `color:${ink};`));
    out.push(themeHoverRule(`hover:text-${name}-${shade}`, `color:${ink};`));
  }

  for (const shade of ["700", "800"]) {
    out.push(themeRule(`text-${name}-${shade}`, `color:${inkStrong};`));
    out.push(themeHoverRule(`hover:text-${name}-${shade}`, `color:${inkStrong};`));
  }

  return out;
}

function themeCss() {
  const surface = "#10141D";
  const sunken = "#080A0F";
  const raised = "#171C28";
  const border = "#283143";
  const borderStrong = "#3B4960";
  const text = "#F5F7FA";
  const text800 = "#eee5f4";
  const text700 = "#d4c8dd";
  const text600 = "#C0C7D5";
  const text500 = "#9299AA";
  const text400 = "#9299AA";
  const text300 = "#594d62";
  const heading = "#ffffff";
  const link = "#83EDFF";
  const warn = "#ff956d";

  const parts = [];

  parts.push(`[data-theme="dark"]{color-scheme:dark;`
    + `--hub-surface:${surface};`
    + `--hub-sunken:${sunken};`
    + `--hub-raised:${raised};`
    + `--hub-border:${border};`
    + `--hub-border-strong:${borderStrong};`
    + `--hub-text:${text};`
    + `--hub-text-muted:${text600};`
    + `--hub-text-faint:${text500};`
    + `--hub-text-dim:${text400};`
    + `--hub-text-soft:${text700};`
    + `--hub-brand:${link};`
    + `--hub-brand-soft:#102F38;`
    + `--hub-brand-edge:#245C68;`
    + `--hub-bubble:${raised};`
    + `--hub-on-brand:#080A0F;`
    + `--hub-header-bg:#0d0913;`
    + `--hub-danger:#f87171;`
    + `--hub-warn:${warn};`
    + `--hub-code-bg:#07050b;`
    + `--hub-code-text:#f2e9f7;`
    + `}`);

  parts.push(`[data-theme="dark"] body,[data-theme="dark"] body[class]{background-color:${sunken};color:${text};}`);

  parts.push(themeRule("bg-white", `background-color:${surface};`));
  parts.push(themeRule("bg-slate-50", `background-color:${sunken};`));
  parts.push(themeRule("bg-slate-100", `background-color:${raised};`));
  parts.push(themeRule("bg-slate-200", `background-color:${border};`));
  parts.push(themeRule("bg-slate-300", `background-color:${borderStrong};`));

  parts.push(themeRule("text-slate-900", `color:${text};`));
  parts.push(themeRule("text-slate-800", `color:${text800};`));
  parts.push(themeRule("text-slate-700", `color:${text700};`));
  parts.push(themeRule("text-slate-600", `color:${text600};`));
  parts.push(themeRule("text-slate-500", `color:${text500};`));
  parts.push(themeRule("text-slate-400", `color:${text400};`));
  parts.push(themeRule("text-slate-300", `color:${text300};`));

  parts.push(themeRule("border-slate-100", `border-color:#202737;`));
  parts.push(themeRule("border-slate-200", `border-color:${border};`));
  parts.push(themeRule("border-slate-300", `border-color:${borderStrong};`));
  parts.push(themeRule("border-white", `border-color:${border};`));

  parts.push(themeDivideRule("divide-slate-100", `border-color:#202737;`));
  parts.push(themeDivideRule("divide-slate-200", `border-color:${border};`));

  parts.push(themeRule("text-[#00133C]", `color:${heading};`));
  parts.push(themeRule("text-[#0062F1]", `color:${link};`));
  parts.push(themeRule("text-[#DC6803]", `color:${warn};`));
  parts.push(themeRule("bg-[#00133C]", `background-color:#202737;`));

  parts.push(themeRule("file:bg-slate-100", `background-color:${raised};`));
  parts.push(`[data-theme="dark"] [class~="file:bg-slate-100"]::file-selector-button{background-color:${raised};}`);
  parts.push(`[data-theme="dark"] [class~="file:text-slate-800"]::file-selector-button{color:${text800};}`);
  parts.push(`[data-theme="dark"] [class~="hover:file:bg-slate-200"]:hover::file-selector-button{background-color:${border};}`);

  parts.push(themeHoverRule("hover:bg-slate-50", `background-color:${sunken};`));
  parts.push(themeHoverRule("hover:bg-slate-100", `background-color:${raised};`));
  parts.push(themeHoverRule("hover:bg-slate-200", `background-color:${border};`));
  parts.push(themeHoverRule("hover:text-slate-700", `color:${text700};`));
  parts.push(themeHoverRule("hover:text-slate-800", `color:${text800};`));
  parts.push(themeHoverRule("hover:text-[#00133C]", `color:${heading};`));
  parts.push(themeHoverRule("hover:text-[#0062F1]", `color:${link};`));
  parts.push(themeHoverRule("hover:bg-[#00133C]", `background-color:#202737;`));

  parts.push(themeGroupHoverRule("group-hover:text-[#00133C]", `color:${heading};`));
  parts.push(themeGroupHoverRule("group-hover:text-[#0062F1]", `color:${link};`));

  for (const rule of themeTintRules("emerald", "#0f2a1f", "#1e4b36", "#34d399", "#6ee7b7")) parts.push(rule);
  for (const rule of themeTintRules("green", "#0f2a1f", "#1e4b36", "#34d399", "#6ee7b7")) parts.push(rule);
  for (const rule of themeTintRules("red", "#2d1518", "#4f2328", "#f87171", "#fca5a5")) parts.push(rule);
  for (const rule of themeTintRules("rose", "#2d1518", "#4f2328", "#f87171", "#fca5a5")) parts.push(rule);
  for (const rule of themeTintRules("amber", "#2c2214", "#4d3b1d", "#fbbf24", "#fcd34d")) parts.push(rule);
  for (const rule of themeTintRules("yellow", "#2c2214", "#4d3b1d", "#fbbf24", "#fcd34d")) parts.push(rule);
  for (const rule of themeTintRules("orange", "#2e1e13", "#50351e", "#fb923c", "#fdba74")) parts.push(rule);
  for (const rule of themeTintRules("blue", "#15223f", "#28395f", "#60a5fa", "#93c5fd")) parts.push(rule);
  for (const rule of themeTintRules("sky", "#15223f", "#28395f", "#60a5fa", "#93c5fd")) parts.push(rule);
  for (const rule of themeTintRules("indigo", "#1b1b3f", "#2f2f63", "#818cf8", "#a5b4fc")) parts.push(rule);
  for (const rule of themeTintRules("purple", "#241a3a", "#3e2f61", "#c084fc", "#d8b4fe")) parts.push(rule);
  for (const rule of themeTintRules("violet", "#241a3a", "#3e2f61", "#c084fc", "#d8b4fe")) parts.push(rule);
  for (const rule of themeTintRules("cyan", "#0d2a30", "#1d4954", "#22d3ee", "#67e8f9")) parts.push(rule);
  for (const rule of themeTintRules("teal", "#0d2a30", "#1d4954", "#2dd4bf", "#5eead4")) parts.push(rule);
  for (const rule of themeTintRules("pink", "#2d1524", "#4f2340", "#f472b6", "#f9a8d4")) parts.push(rule);

  const fieldSelector = `[data-theme="dark"] input:where(:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]))`;
  parts.push(`${fieldSelector},[data-theme="dark"] select,[data-theme="dark"] textarea{background-color:${sunken};color:${text};}`);

  parts.push(`[data-theme="dark"] input::placeholder,[data-theme="dark"] textarea::placeholder{color:${text400};}`);
  parts.push(`[data-theme="dark"] table thead{color:${text600};}`);
  parts.push(`[data-theme="dark"] hr{border-color:${border};}`);

  return parts.join("");
}

function themeStyleEl() {
  let el = document.getElementById("hub-theme-style");
  if (el) return el;
  el = document.createElement("style");
  el.id = "hub-theme-style";
  el.textContent = themeCss();
  (document.head || document.documentElement).appendChild(el);
  return el;
}

function themeChartDefaults(dark) {
  if (typeof Chart === "undefined" || !Chart.defaults) return;
  Chart.defaults.color = dark ? "#a9b7ce" : "#666";
  Chart.defaults.borderColor = dark ? "#26334f" : "rgba(0,0,0,0.1)";
}

function themeChartInk(node, prop, darkValue) {
  if (!node || node[prop] === undefined || node[prop] === null) return;
  const stash = "$hubLight_" + prop;
  if (node[stash] === undefined) node[stash] = node[prop];
  node[prop] = themeCurrent === "dark" ? darkValue : node[stash];
}

const themeChartPlugin = {
  id: "hubTheme",
  beforeUpdate(chart) {
    const options = chart && chart.options;
    if (!options) return;

    const scales = options.scales || {};
    for (const key of Object.keys(scales)) {
      const scale = scales[key];
      if (!scale) continue;
      themeChartInk(scale.ticks, "color", "#a9b7ce");
      themeChartInk(scale.grid, "color", "#26334f");
      themeChartInk(scale.title, "color", "#c6d2e6");
      themeChartInk(scale.border, "color", "#26334f");
    }

    const plugins = options.plugins || {};
    if (plugins.title) themeChartInk(plugins.title, "color", "#e8eefc");
    if (plugins.legend && plugins.legend.labels) themeChartInk(plugins.legend.labels, "color", "#c6d2e6");
  }
};

function themeChartRegister() {
  if (typeof Chart === "undefined" || typeof Chart.register !== "function") return;
  if (Chart.$hubThemeRegistered) return;
  Chart.register(themeChartPlugin);
  Chart.$hubThemeRegistered = true;
}

function themeChartsRefresh() {
  if (typeof Chart === "undefined" || typeof Chart.getChart !== "function") return;
  for (const canvas of document.querySelectorAll("canvas")) {
    const chart = Chart.getChart(canvas);
    if (chart) chart.update("none");
  }
}

function themeApply(theme) {
  themeCurrent = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", themeCurrent);
  themeChartDefaults(themeCurrent === "dark");
}

function themeToggleLabel(button) {
  const dark = themeCurrent === "dark";
  button.textContent = "◐";
  button.setAttribute(
    "style",
    `border:1px solid var(--hub-border-strong, #cbd5e1);background:var(--hub-surface, #ffffff);color:var(--hub-text-muted, #475569);border-radius:9999px;padding:0.25rem 0.7rem;font-size:0.6875rem;font-weight:600;cursor:pointer;font-family:${THEME_FONT};white-space:nowrap;`
  );
  button.setAttribute("aria-pressed", dark ? "true" : "false");
  button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  button.title = dark ? "Switch to the light theme" : "Switch to the dark theme";
}

function themeBuildToggle() {
  if (document.getElementById("hub-theme-toggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "hub-theme-toggle";
  themeToggleLabel(button);

  button.addEventListener("click", () => {
    const next = themeCurrent === "dark" ? "light" : "dark";
    themeApply(next);
    themeRemember(next);
    themeToggleLabel(button);
    themeChartsRefresh();
  });

  const header = document.querySelector("header");
  if (header) {
    const right = header.lastElementChild;
    if (right && right !== header.firstElementChild) {
      right.parentElement.insertBefore(button, right);
      right.parentElement.setAttribute("style", (right.parentElement.getAttribute("style") || "") + ";gap:0.6rem;");
      return;
    }
    header.appendChild(button);
    return;
  }

  button.setAttribute("style", button.getAttribute("style") + "position:fixed;top:0.75rem;right:0.75rem;z-index:9999;");
  document.body.appendChild(button);
}

function themeStart() {
  themeChartDefaults(themeCurrent === "dark");
  themeChartRegister();
  themeBuildToggle();
  themeChartsRefresh();
}

function motionApply() {
  try {
    if (localStorage.getItem("sn_motion") === "reduced") document.documentElement.setAttribute("data-motion", "reduced");
  } catch (e) {
    return;
  }
}

(function themeBoot() {
  if (typeof document === "undefined") return;
  motionApply();
  themeApply(themePreferred());
  themeStyleEl();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", themeStart);
  else themeStart();
})();
