const DEFINITIONS_KEY = "hub_show_definitions";
const DEFINITIONS_FONT = "ui-sans-serif,system-ui,-apple-system,sans-serif";

let definitionsTool = null;
let definitionsOn = true;
let definitionsObserver = null;

function definitionsWanted() {
  try {
    return localStorage.getItem(DEFINITIONS_KEY) !== "off";
  } catch (e) {
    return true;
  }
}

function definitionsRemember(on) {
  try {
    if (on) localStorage.removeItem(DEFINITIONS_KEY);
    else localStorage.setItem(DEFINITIONS_KEY, "off");
  } catch (e) {
    return;
  }
}

function definitionsFor(toolId) {
  if (typeof HUB_DEFINITIONS === "undefined") return [];
  return HUB_DEFINITIONS[toolId] || [];
}

function definitionsEl(tag, style, text) {
  const el = document.createElement(tag);
  if (style) el.setAttribute("style", style);
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function definitionsNote(text, compact) {
  const note = definitionsEl(
    "p",
    compact
      ? `margin:0.6rem 0 0;padding-top:0.45rem;border-top:1px dashed var(--hub-border, #e2e8f0);color:var(--hub-text-faint, #64748b);font-size:0.6875rem;line-height:1.5;font-weight:400;text-transform:none;letter-spacing:normal;font-family:${DEFINITIONS_FONT};`
      : `margin:0.3rem 0 0.75rem;color:var(--hub-text-faint, #64748b);font-size:0.75rem;line-height:1.55;font-weight:400;text-transform:none;letter-spacing:normal;max-width:60rem;font-family:${DEFINITIONS_FONT};`,
    text
  );
  note.setAttribute("data-definition", "1");
  return note;
}

function definitionsAnchorFor(target) {
  const heading = target.querySelector("h1, h2, h3, h4, h5");
  if (!heading) return { parent: target, after: null };

  let node = heading;
  while (node.parentElement && node.parentElement !== target) node = node.parentElement;
  if (node.parentElement !== target) return { parent: target, after: null };

  return { parent: target, after: node };
}

function definitionsApplyOne(entry) {
  let targets;
  try {
    targets = document.querySelectorAll(entry.selector);
  } catch (e) {
    return 0;
  }

  let placed = 0;

  for (const found of targets) {
    const target = entry.closest && found.closest ? found.closest(entry.closest) || found : found;

    if (!target) continue;
    if (target.closest && target.closest("[data-vanessa]")) continue;

    const stamped = target.getAttribute("data-defined") || "";
    if (stamped.split("||").indexOf(entry.selector) !== -1) continue;
    target.setAttribute("data-defined", stamped === "" ? entry.selector : stamped + "||" + entry.selector);

    const spot = definitionsAnchorFor(target);
    const compact = spot.after === null;
    const note = definitionsNote(entry.text, compact);

    let anchor = spot.after;
    while (anchor && anchor.nextSibling && anchor.nextSibling.nodeType === 1 && anchor.nextSibling.getAttribute("data-definition") === "1") {
      anchor = anchor.nextSibling;
    }

    if (anchor && anchor.nextSibling) spot.parent.insertBefore(note, anchor.nextSibling);
    else spot.parent.appendChild(note);

    placed++;
  }

  return placed;
}

function definitionsApply() {
  let placed = 0;
  for (const entry of definitionsFor(definitionsTool)) placed += definitionsApplyOne(entry);
  definitionsSetVisibility(definitionsOn);
  return placed;
}

function definitionsSetVisibility(on) {
  for (const note of document.querySelectorAll("[data-definition]")) {
    note.style.display = on ? "block" : "none";
  }
}

function definitionsToggleLabel(button) {
  button.textContent = definitionsOn ? "Explanations on" : "Explanations off";
  button.setAttribute(
    "style",
    `border:1px solid ${definitionsOn ? "#0062F1" : "var(--hub-border-strong, #cbd5e1)"};background:${definitionsOn ? "var(--hub-brand-soft, #eff6ff)" : "var(--hub-surface, #ffffff)"};color:${definitionsOn ? "var(--hub-brand, #0062F1)" : "var(--hub-text-muted, #475569)"};border-radius:9999px;padding:0.25rem 0.7rem;font-size:0.6875rem;font-weight:600;cursor:pointer;font-family:${DEFINITIONS_FONT};white-space:nowrap;`
  );
  button.setAttribute("aria-pressed", definitionsOn ? "true" : "false");
}

function definitionsBuildToggle() {
  if (document.getElementById("definitions-toggle")) return;
  if (definitionsFor(definitionsTool).length === 0) return;

  const button = definitionsEl("button", "");
  button.type = "button";
  button.id = "definitions-toggle";
  button.title = "Show or hide the short explanation under each part of this page";
  definitionsToggleLabel(button);

  button.addEventListener("click", () => {
    definitionsOn = !definitionsOn;
    definitionsRemember(definitionsOn);
    definitionsSetVisibility(definitionsOn);
    definitionsToggleLabel(button);
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

function definitionsWatch() {
  if (definitionsObserver || typeof MutationObserver === "undefined") return;

  let pending = null;
  definitionsObserver = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      definitionsApply();
    }, 200);
  });

  definitionsObserver.observe(document.body, { childList: true, subtree: true });
}

function definitionsStart() {
  definitionsOn = definitionsWanted();
  definitionsBuildToggle();
  definitionsApply();
  definitionsWatch();
}

function definitionsInit(options) {
  if (typeof document === "undefined" || !options || !options.tool) return;
  definitionsTool = options.tool;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", definitionsStart);
  else definitionsStart();
}
