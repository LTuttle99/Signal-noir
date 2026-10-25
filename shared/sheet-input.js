const SHEET_INPUT_FONT = "ui-sans-serif,system-ui,-apple-system,sans-serif";

function sheetInputEl(tag, style, text) {
  const el = document.createElement(tag);
  if (style) el.setAttribute("style", style);
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function sheetInputAnchor(input) {
  const label = input.closest ? input.closest("label") : null;
  const anchor = label && label.parentElement ? label : input.parentElement;
  return anchor && anchor.parentElement ? anchor : null;
}

function sheetInputDeliver(input, csv, name) {
  const file = new File([csv], name, { type: "text/csv" });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function sheetInputName(url) {
  const ref = typeof googleSheetRefFromUrl === "function" ? googleSheetRefFromUrl(url) : null;
  if (!ref) return "google-sheet.csv";
  return ref.gid ? `google-sheet-${ref.gid}.csv` : "google-sheet.csv";
}

function sheetInputAttach(input) {
  if (input.getAttribute("data-sheet-input") === "1") return;
  if (input.closest && input.closest("[data-vanessa]")) return;

  const anchor = sheetInputAnchor(input);
  if (!anchor) return;

  input.setAttribute("data-sheet-input", "1");

  const wrap = sheetInputEl("div", `margin-top:0.6rem;font-family:${SHEET_INPUT_FONT};`);

  const toggle = sheetInputEl(
    "button",
    "background:transparent;border:none;color:#0062F1;font-size:0.75rem;font-weight:600;cursor:pointer;padding:0;text-decoration:underline;",
    "or paste a Google Sheets link"
  );
  toggle.type = "button";

  const row = sheetInputEl("div", "display:none;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;align-items:center;");

  const field = document.createElement("input");
  field.type = "text";
  field.placeholder = "https://docs.google.com/spreadsheets/d/...";
  field.setAttribute(
    "style",
    `flex:1;min-width:15rem;border:1px solid #cbd5e1;border-radius:0.5rem;padding:0.45rem 0.6rem;font-size:0.8125rem;color:#00133C;outline:none;font-family:${SHEET_INPUT_FONT};`
  );

  const load = sheetInputEl(
    "button",
    `border:1px solid #0062F1;background:#0062F1;color:#ffffff;border-radius:0.5rem;padding:0.45rem 0.9rem;font-size:0.8125rem;font-weight:600;cursor:pointer;font-family:${SHEET_INPUT_FONT};`,
    "Load sheet"
  );
  load.type = "button";

  const status = sheetInputEl("p", "font-size:0.75rem;color:#475569;margin:0.45rem 0 0;line-height:1.5;width:100%;");

  let open = false;
  toggle.addEventListener("click", () => {
    open = !open;
    row.style.display = open ? "flex" : "none";
    toggle.textContent = open ? "hide the Google Sheets link box" : "or paste a Google Sheets link";
    if (open) field.focus();
  });

  const connect = async () => {
    const url = field.value.trim();
    if (url === "") return;

    if (typeof fetchGoogleSheetCsv !== "function") {
      status.style.color = "#b91c1c";
      status.textContent = "The Google Sheets reader is not loaded on this page.";
      return;
    }

    load.disabled = true;
    load.textContent = "Reading...";
    status.style.color = "#475569";
    status.textContent = "Reading the sheet. It never goes through a server, your browser fetches it directly.";

    try {
      const sheet = await fetchGoogleSheetCsv(url);
      sheetInputDeliver(input, sheet.text, sheetInputName(url));
      status.style.color = "#15803d";
      status.textContent = "Sheet loaded. It is now the file this tool is working on.";
    } catch (e) {
      status.style.color = "#b91c1c";
      status.textContent = e && e.message ? e.message : "The sheet could not be read.";
    }

    load.disabled = false;
    load.textContent = "Load sheet";
  };

  load.addEventListener("click", connect);
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      connect();
    }
  });

  row.appendChild(field);
  row.appendChild(load);
  row.appendChild(status);
  wrap.appendChild(toggle);
  wrap.appendChild(row);

  anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
}

function sheetInputScan() {
  if (typeof document === "undefined") return;
  for (const input of document.querySelectorAll("input[type='file']")) sheetInputAttach(input);
}

function sheetInputInit() {
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sheetInputScan);
  else sheetInputScan();
}

sheetInputInit();
