function googleSheetRefFromUrl(url) {
  const text = String(url || "").trim();
  if (text === "") return null;

  const published = text.match(/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)/);
  if (published) {
    return { published: true, id: published[1], gid: googleSheetGidFromUrl(text), sheet: googleSheetTabFromUrl(text) };
  }

  const standard = text.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (standard) {
    return { published: false, id: standard[1], gid: googleSheetGidFromUrl(text), sheet: googleSheetTabFromUrl(text) };
  }

  if (/^[\w-]{20,}$/.test(text)) return { published: false, id: text, gid: null, sheet: null };

  return null;
}

function googleSheetGidFromUrl(url) {
  const match = String(url).match(/[#&?]gid=(\d+)/);
  return match ? match[1] : null;
}

function googleSheetTabFromUrl(url) {
  const match = String(url).match(/[#&?]sheet=([^&#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return match[1];
  }
}

function googleSheetUrlWithTab(url, tabName) {
  const base = String(url || "").split("#")[0];
  if (!tabName) return base;
  return `${base}#sheet=${encodeURIComponent(tabName)}`;
}

function googleSheetCsvUrls(url) {
  const ref = googleSheetRefFromUrl(url);
  if (!ref) return [];

  const gid = ref.gid;
  const urls = [];

  if (ref.published) {
    urls.push(`https://docs.google.com/spreadsheets/d/e/${ref.id}/pub?${gid ? `gid=${gid}&` : ""}single=true&output=csv`);
    return urls;
  }

  if (ref.sheet) {
    urls.push(`https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(ref.sheet)}`);
  }

  urls.push(`https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`);
  urls.push(`https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv${gid ? `&gid=${gid}` : ""}`);
  return urls;
}

function googleSheetWorkbookUrl(url) {
  const ref = googleSheetRefFromUrl(url);
  if (!ref || ref.published) return null;
  return `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=xlsx`;
}

async function fetchGoogleSheetTabs(url) {
  if (typeof XLSX === "undefined") return null;

  const candidate = googleSheetWorkbookUrl(url);
  if (!candidate) return null;

  let response;
  try {
    response = await fetch(candidate, { credentials: "omit", redirect: "follow" });
  } catch (e) {
    return null;
  }

  if (!response.ok) return null;

  let workbook;
  try {
    const buffer = await response.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch (e) {
    return null;
  }

  const names = (workbook.SheetNames || []).slice();
  if (names.length === 0) return null;

  return names.map((name) => ({
    name: name,
    detail: typeof describeExcelSheet === "function" ? describeExcelSheet(workbook, name) : ""
  }));
}

function chooseGoogleSheetTab(tabs, currentName) {
  if (typeof document === "undefined") return Promise.resolve(tabs[0].name);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("style", "position:fixed;inset:0;z-index:9999;background:rgba(0,19,60,0.55);display:flex;align-items:center;justify-content:center;padding:1.5rem;font-family:ui-sans-serif,system-ui,sans-serif;");

    const card = document.createElement("div");
    card.setAttribute("style", "background:var(--hub-surface, #ffffff);border:1px solid var(--hub-border, #e2e8f0);border-radius:0.75rem;max-width:30rem;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);");

    const head = document.createElement("div");
    head.setAttribute("style", "padding:1.25rem 1.25rem 0.75rem;");

    const title = document.createElement("h2");
    title.setAttribute("style", "font-family:Lora,Georgia,serif;font-size:1.125rem;font-weight:600;color:var(--hub-text, #00133C);margin:0 0 0.35rem;");
    title.textContent = "Choose a tab";
    head.appendChild(title);

    const blurb = document.createElement("p");
    blurb.setAttribute("style", "font-size:0.8125rem;color:var(--hub-text-muted, #475569);margin:0;line-height:1.5;");
    blurb.textContent = `This sheet has ${tabs.length} tabs. Only the tab you pick is loaded, and the dashboard re-reads that tab every time it opens.`;
    head.appendChild(blurb);

    card.appendChild(head);

    const list = document.createElement("div");
    list.setAttribute("style", "padding:0 1.25rem 1rem;display:flex;flex-direction:column;gap:0.5rem;");

    for (const tab of tabs) {
      const button = document.createElement("button");
      button.type = "button";
      const active = tab.name === currentName;
      button.setAttribute("style", `text-align:left;border:1px solid ${active ? "var(--hub-brand, #0062F1)" : "var(--hub-border-strong, #cbd5e1)"};border-radius:0.5rem;padding:0.65rem 0.85rem;background:${active ? "var(--hub-brand-soft, #eff6ff)" : "var(--hub-sunken, #f8fafc)"};cursor:pointer;display:block;width:100%;`);

      const heading = document.createElement("span");
      heading.setAttribute("style", `display:block;font-size:0.875rem;font-weight:600;color:${active ? "var(--hub-brand, #0062F1)" : "var(--hub-text, #00133C)"};`);
      heading.textContent = tab.name;
      button.appendChild(heading);

      const detail = document.createElement("span");
      detail.setAttribute("style", "display:block;font-size:0.75rem;color:var(--hub-text-faint, #64748b);margin-top:0.15rem;");
      detail.textContent = tab.detail || "";
      button.appendChild(detail);

      button.addEventListener("click", () => {
        overlay.remove();
        resolve(tab.name);
      });

      list.appendChild(button);
    }

    card.appendChild(list);

    const foot = document.createElement("div");
    foot.setAttribute("style", "padding:0 1.25rem 1.25rem;");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.setAttribute("style", "border:none;background:transparent;color:var(--hub-text-muted, #475569);font-size:0.75rem;font-weight:600;cursor:pointer;padding:0;text-decoration:underline;");
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      overlay.remove();
      resolve(null);
    });
    foot.appendChild(cancel);
    card.appendChild(foot);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

function googleSheetLooksLikeHtml(text) {
  const head = String(text).slice(0, 400).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
}

async function fetchGoogleSheetCsv(url) {
  const candidates = googleSheetCsvUrls(url);

  if (candidates.length === 0) {
    throw new Error("That does not look like a Google Sheets link. Copy the URL from your browser address bar while the sheet is open.");
  }

  let lastProblem = "";

  for (const candidate of candidates) {
    let response;
    try {
      response = await fetch(candidate, { credentials: "omit", redirect: "follow" });
    } catch (e) {
      lastProblem = "blocked";
      continue;
    }

    if (!response.ok) {
      lastProblem = response.status === 401 || response.status === 403 ? "private" : "http";
      continue;
    }

    const text = await response.text();
    if (googleSheetLooksLikeHtml(text)) {
      lastProblem = "private";
      continue;
    }

    if (text.trim() === "") {
      lastProblem = "empty";
      continue;
    }

    return { text: text, csvUrl: candidate };
  }

  throw new Error(googleSheetProblemMessage(lastProblem));
}

async function fetchGoogleSheet(url) {
  const raw = await fetchGoogleSheetCsv(url);
  const parsed = parseCSVText(raw.text);

  if (parsed.columns.length === 0) throw new Error(googleSheetProblemMessage("empty"));

  return { ...parsed, csvUrl: raw.csvUrl };
}

function googleSheetProblemMessage(problem) {
  if (problem === "private" || problem === "blocked") {
    return "The sheet could not be read. In Google Sheets open Share and set General access to \"Anyone with the link\", or use File then Share then Publish to web.";
  }
  if (problem === "empty") return "The sheet was read but the tab appears to be empty.";
  return "The sheet could not be read. Check the link and that the sheet still exists.";
}

function googleSheetTabLabel(url) {
  const ref = googleSheetRefFromUrl(url);
  if (!ref) return "";
  if (ref.sheet) return `tab "${ref.sheet}"`;
  return ref.gid ? `tab ${ref.gid}` : "first tab";
}
