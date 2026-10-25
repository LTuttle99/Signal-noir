


(function (root) {
  "use strict";

  const categories = [
    { id: "data", label: "Data", description: "Prepare, clean, combine and compare tabular data" },
    { id: "sql", label: "SQL", description: "Query your files with real SQLite" },
    { id: "statistics", label: "Statistics", description: "Profiles, significance tests and plain-English verdicts" },
    { id: "visualization", label: "Visualization", description: "Charts, pivots and dashboards" },
    { id: "files", label: "File utilities", description: "Generate, diff and preview files" },
    { id: "developer", label: "Developer", description: "Inspect and transform structured values" },
    { id: "converters", label: "Converters", description: "Formats, timestamps and units" },
    { id: "other", label: "Other", description: "Text, color and sharing helpers" }
  ];


  const tools = [
    { id: "data-analyzer", title: "Data Analyzer", icon: "DA", category: "data", accepts: "tabular", step: "analyze", popular: true,
      description: "KPIs, seasonality-aware forecasts, goal pacing, anomalies and insights from CSV, JSON or Excel.",
      keywords: ["forecast", "kpi", "insight", "anomaly", "analyze data", "performance", "trend", "goal"] },
    { id: "data-cleaner", title: "Data Cleaner", icon: "CL", category: "data", accepts: "tabular", step: "clean", popular: true,
      description: "Find duplicate rows, blank cells and messy headers, then trim, dedupe and standardize.",
      keywords: ["clean data", "messy data", "missing values", "standardize", "blank", "whitespace"] },
    { id: "fuzzy-dupes", title: "Fuzzy Duplicate Finder", icon: "≈", category: "data", accepts: "tabular", step: "clean",
      description: "Catch near-matches exact deduplication misses, like “Acme Corp” and “ACME CORPORATION”.",
      keywords: ["duplicate", "similar names", "deduplicate", "near match", "fuzzy"] },
    { id: "lookup-merge", title: "Lookup & Merge", icon: "LU", category: "data", accepts: "tabular", step: "join",
      description: "Match two files on a shared key and pull columns across, with unmatched rows reported.",
      keywords: ["merge", "join files", "lookup", "combine spreadsheets", "vlookup"] },
    { id: "file-diff", title: "File Diff", icon: "Δ", category: "data", accepts: "tabular", step: "analyze",
      description: "Compare two files by a key column and see exactly which rows were added, removed or changed.",
      keywords: ["compare files", "compare spreadsheets", "what changed", "difference between files", "versions"] },
    { id: "sql-workbench", title: "SQL Workbench", icon: "SQL", category: "sql", accepts: "tabular", step: "analyze", popular: true,
      description: "Load CSV, Excel or JSON as tables and query them with standard SQLite, including joins.",
      keywords: ["sql", "query", "join tables", "database", "select"] },
    { id: "stat-tests", title: "Statistical Tests", icon: "χ²", category: "statistics", accepts: "tabular", step: "analyze",
      description: "ANOVA, t-tests, chi-square, correlation and regression, each with a plain-English verdict.",
      keywords: ["test significance", "anova", "t test", "correlation", "regression", "p value"] },
    { id: "column-stats", title: "Column Statistics", icon: "Σ", category: "statistics", accepts: "tabular", step: "validate",
      description: "Instant per-column min, max, mean, median and missing values. A fast data profile.",
      keywords: ["statistics", "mean", "median", "column summary", "profile"] },
    { id: "instant-dashboard", title: "Instant Dashboard", icon: "ID", category: "visualization", accepts: "tabular", step: "visualize", popular: true,
      description: "Drop in any file and get a dashboard shaped around what it contains. No mapping or setup.",
      keywords: ["automatic dashboard", "quick dashboard", "visualize file", "show my data"] },
    { id: "dashboard-builder", title: "Dashboard Builder", icon: "DB", category: "visualization", accepts: "tabular", step: "report",
      description: "Design a dashboard with visuals, measures and slicers, then publish it as one HTML file.",
      keywords: ["custom dashboard", "build dashboard", "share dashboard", "layout", "publish"] },
    { id: "chart-builder", title: "Chart Builder", icon: "CB", category: "visualization", accepts: "tabular", step: "visualize",
      description: "Pick two columns and get a clean bar, line, pie or scatter chart, downloadable as PNG.",
      keywords: ["chart", "graph", "visual", "png"] },
    { id: "pivot-explorer", title: "Pivot & Chart Explorer", icon: "PV", category: "visualization", accepts: "tabular", step: "analyze",
      description: "Pick rows, columns and values for an instant pivot table and chart on any file.",
      keywords: ["pivot", "group data", "summarize", "cross tab"] },
    { id: "data-generator", title: "Test Data Generator", icon: "GEN", category: "files", accepts: null,
      description: "Build realistic sample files from a column spec, with a seed for repeatable output.",
      keywords: ["fake data", "sample data", "test data", "synthetic"] },
    { id: "text-diff", title: "Text Diff", icon: "≠", category: "files", accepts: null,
      description: "Line-by-line diff between two blocks of text: configs, emails, document revisions.",
      keywords: ["compare text", "text changes"] },
    { id: "markdown-preview", title: "Markdown Previewer", icon: "M↓", category: "files", accepts: null,
      description: "Live-rendered, sanitized Markdown with copy and download as HTML.",
      keywords: ["markdown", "preview markdown", "readme"] },
    { id: "json-formatter", title: "JSON Formatter", icon: "{}", category: "developer", accepts: null,
      description: "Validate, pretty-print and minify JSON with clear error locations.",
      keywords: ["format json", "validate json", "minify json"] },
    { id: "regex-tester", title: "Regex Tester", icon: ".*", category: "developer", accepts: null,
      description: "Live-highlighted pattern matches and capture groups against sample text.",
      keywords: ["regex", "regular expression", "pattern"] },
    { id: "jwt-decoder", title: "JWT Decoder", icon: "JWT", category: "developer", accepts: null,
      description: "Read a token’s header, payload and expiry. Does not verify signatures.",
      keywords: ["jwt", "token", "bearer"] },
    { id: "encode-decode", title: "Base64 / URL Encoder", icon: "64", category: "developer", accepts: null,
      description: "UTF-8 safe Base64 and URL encoding and decoding, chainable.",
      keywords: ["base64", "url encode", "decode"] },
    { id: "code-helper", title: "Code Helper", icon: "</>", category: "developer", accepts: "tabular",
      description: "Working snippets in Python, R, SQL, JavaScript and Java that use your own column names.",
      keywords: ["code", "developer helper", "snippet", "python", "pandas"] },
    { id: "converter", title: "Format Converter", icon: "⇄", category: "converters", accepts: "tabular",
      description: "Convert between CSV, Excel and JSON in either direction.",
      keywords: ["convert format", "csv to json", "excel to csv", "json to csv"] },
    { id: "timestamp-converter", title: "Timestamp Converter", icon: "TS", category: "converters", accepts: null,
      description: "Unix timestamps and date strings to ISO 8601, relative time and time zones.",
      keywords: ["timestamp", "unix time", "date conversion", "epoch"] },
    { id: "unit-converter", title: "Unit Converter", icon: "U", category: "converters", accepts: null,
      description: "Length, weight, temperature, data size and duration with a reference table.",
      keywords: ["units", "convert measurement"] },
    { id: "text-analyzer", title: "Text Analyzer", icon: "Aa", category: "other", accepts: null,
      description: "Word, character and sentence counts, reading time and most frequent words.",
      keywords: ["word count", "analyze text", "reading time"] },
    { id: "color-tools", title: "Color Tools", icon: "◐", category: "other", accepts: null,
      description: "Shade palettes from a base color plus a WCAG contrast checker.",
      keywords: ["color", "palette", "hex", "rgb", "contrast"] },
    { id: "qr-generator", title: "QR Code Generator", icon: "QR", category: "other", accepts: null,
      description: "Turn a URL or text into a downloadable QR code.",
      keywords: ["qr", "qr code"] }
  ];


  const navigation = [
    { id: "home", label: "Home", path: "index.html", description: "Ask Vanessa or drop in data" },
    { id: "studio", label: "Studio", path: "tools/studio/index.html", description: "Projects, Vanessa, analysis and outputs" },
    { id: "tools", label: "Tools", path: "tools/index.html", description: "26 free utilities that run in your browser" },
    { id: "library", label: "Library", path: "library.html", description: "Templates, saved analyses, dashboards and reports" },
    { id: "organization", label: "Organization", path: "organization.html", description: "Teams, access, decisions and governance" },
    { id: "settings", label: "Settings", path: "settings.html", description: "Privacy, storage, appearance and your access" }
  ];


  const stages = [
    { id: "import", label: "Import", description: "Bring files or sources into the project" },
    { id: "validate", label: "Validate", description: "Inspect schema, types and missing values" },
    { id: "clean", label: "Clean", description: "Fix blanks, duplicates and formatting" },
    { id: "join", label: "Join", description: "Relate datasets on shared keys" },
    { id: "analyze", label: "Analyze", description: "Compute the numbers that answer the question" },
    { id: "visualize", label: "Visualize", description: "Chart what matters" },
    { id: "report", label: "Report", description: "Assemble findings into an output" },
    { id: "act", label: "Act", description: "Turn findings into decisions and tasks" }
  ];


  const intents = [

    { id: "compare-files", label: "Compare two files", starter: "Compare two files",
      patterns: [/\bcompare\b.*\b(files?|spreadsheets?|versions?|exports?|datasets?|sheets?)\b/, /\bdiff(erence)? between\b/, /\b(two|2|both) (files|spreadsheets|versions|datasets)\b/],
      stages: ["import", "validate", "join", "analyze", "report"],
      tools: ["file-diff", "lookup-merge", "text-diff"] },
    { id: "compare-periods", label: "Find what changed", starter: "Find what changed this month",
      patterns: [/\b(why|what)\b.*\b(drop|dropp|declin|decreas|fell|fall|down|increas|grew|grow|rose|spike|jump|chang)/, /\b(changed|drop|dropped|decline|declined)\b/, /\b(this|last|previous) (month|quarter|week|year)\b/, /\b(month|quarter|year|week) over (month|quarter|year|week)\b/, /\b(mom|qoq|yoy|period over period)\b/],
      stages: ["import", "validate", "clean", "analyze", "visualize", "report", "act"],
      tools: ["data-analyzer", "pivot-explorer", "file-diff"] },
    { id: "forecast", label: "Forecast", starter: "Forecast next quarter",
      patterns: [/\bforecast|predict|projection|project(ed)? (sales|revenue|growth)|next (month|quarter|year)|what will\b/],
      stages: ["import", "validate", "clean", "analyze", "visualize", "report"],
      tools: ["data-analyzer", "chart-builder"] },
    { id: "clean", label: "Clean a dataset", starter: "Clean this dataset",
      patterns: [/\bclean|messy|tidy|dedup|duplicate|missing values|blanks?|standardi[sz]e|fix (the )?data\b/],
      stages: ["import", "validate", "clean", "analyze", "report"],
      tools: ["data-cleaner", "fuzzy-dupes", "column-stats"] },
    { id: "join", label: "Join datasets", starter: "Join these files on a shared key",
      patterns: [/\bjoin|merge|combine|lookup|vlookup|match (rows|records)|link (the )?files\b/],
      stages: ["import", "validate", "join", "analyze"],
      tools: ["lookup-merge", "sql-workbench"] },
    { id: "anomalies", label: "Find anomalies", starter: "Find anything unusual",
      patterns: [/\banomal|outlier|unusual|odd|weird|spike|suspicious\b/],
      stages: ["import", "validate", "analyze", "visualize", "report"],
      tools: ["data-analyzer", "column-stats"] },
    { id: "dashboard", label: "Build a dashboard", starter: "Build me a dashboard",
      patterns: [/\bdashboard|visuali[sz]e|charts?|graphs?|plot\b/],
      stages: ["import", "validate", "analyze", "visualize", "report"],
      tools: ["instant-dashboard", "dashboard-builder", "chart-builder"] },
    { id: "report", label: "Create a report", starter: "Create a report",
      patterns: [/\breport|brief(ing)?|executive summary|write.?up|present(ation)?|summary for\b/],
      stages: ["import", "validate", "clean", "analyze", "visualize", "report", "act"],
      tools: ["dashboard-builder", "markdown-preview"] },
    { id: "automate", label: "Automate recurring analysis", starter: "Run this analysis every month",
      patterns: [/\bevery (day|week|month|quarter)|recurring|automat|schedul|each (week|month)\b/],
      stages: ["import", "validate", "clean", "analyze", "report", "act"],
      tools: ["data-cleaner", "data-analyzer"] },
    { id: "explain", label: "Explain these numbers", starter: "Explain these numbers",
      patterns: [/\bexplain|what (does|do) (this|these)|make sense of|interpret|understand\b/],
      stages: ["import", "validate", "analyze", "visualize", "report"],
      tools: ["data-analyzer", "column-stats"] },
    { id: "analyze", label: "Analyze a spreadsheet", starter: "Analyze a spreadsheet",
      patterns: [/\banaly[sz]e|explore|summari[sz]e|insights?|overview|profile|look at|what's in\b/],
      stages: ["import", "validate", "clean", "analyze", "visualize", "report"],
      tools: ["data-analyzer", "column-stats", "pivot-explorer"] }
  ];

  const starters = ["analyze", "compare-files", "compare-periods", "clean", "dashboard", "explain", "report", "forecast"]
    .map(id => intents.find(intent => intent.id === id))
    .map(intent => ({ intent: intent.id, label: intent.starter }));

  const templates = [
    { id: "sales-drop", title: "Why did sales drop?", intent: "compare-periods", audience: "Leadership",
      prompt: "Why did sales drop last month? Compare to the previous period and show which regions and products drove it.",
      description: "Period-over-period comparison with driver breakdown, evidence for each finding and a follow-up task list.",
      needs: "A file with a date column and a sales or revenue column." },
    { id: "monthly-report", title: "Monthly performance report", intent: "report", audience: "Leadership",
      prompt: "Create a monthly performance report with the key numbers, what changed and recommended actions.",
      description: "Validation, cleaning, headline metrics, trends and a report you can export as HTML.",
      needs: "One or more monthly exports." },
    { id: "quality-audit", title: "Data quality audit", intent: "clean", audience: "Data owners",
      prompt: "Audit this dataset for quality problems and propose fixes I can review before applying.",
      description: "Blanks, duplicates, whitespace, inconsistent labels and numbers stored as text, with a reversible cleaned copy.",
      needs: "Any CSV, Excel or JSON file." },
    { id: "compare-versions", title: "Compare two exports", intent: "compare-files", audience: "Analysts",
      prompt: "Compare these two files and tell me what was added, removed or changed.",
      description: "Schema differences, key-based row changes and numeric movement between two versions.",
      needs: "Two versions of the same export." },
    { id: "quarter-forecast", title: "Forecast next quarter", intent: "forecast", audience: "Planning",
      prompt: "Forecast the next quarter from the monthly history and show how confident the projection is.",
      description: "Monthly aggregation, a linear trend with a residual range and a chart of history versus projection.",
      needs: "At least six months of dated history." },
    { id: "exec-dashboard", title: "Executive dashboard", intent: "dashboard", audience: "Leadership",
      prompt: "Build me a dashboard of the most important numbers in this data.",
      description: "Headline tiles, trend and breakdown charts chosen from what the data contains.",
      needs: "Any tabular file with at least one numeric column." },
    { id: "survey", title: "Survey analysis", intent: "analyze", audience: "Research",
      prompt: "Analyze these survey responses: summarize the scores and break them down by group.",
      description: "Response profile, averages by segment and the groups that differ most.",
      needs: "Survey export with a score and a group column." },
    { id: "recurring", title: "Recurring monthly workflow", intent: "automate", audience: "Operations",
      prompt: "Set up a repeatable monthly workflow that cleans the data, analyzes it and prepares a report.",
      description: "Saves the steps as a project workflow with a calendar reminder to rerun it.",
      needs: "A representative export." }
  ];


  const projectModes = [
    { id: "local", label: "Local", tagline: "Nothing leaves this device.", status: "available",
      detail: "Projects, files and results live in this browser’s IndexedDB. Vanessa computes on this device. Export a bundle whenever you want a copy." },
    { id: "private-cloud", label: "Private Cloud", tagline: "Sync this project across your devices.", status: "planned",
      detail: "Encrypted sync between your own devices. It needs a sync service that does not exist yet. Until then, move projects between browsers with an exported bundle." },
    { id: "team", label: "Team", tagline: "Shared with your organization.", status: "planned",
      detail: "Projects held centrally so an organization’s teams genuinely share them, with access enforced on a server rather than in the browser. Not available yet. Teams, access profiles and project access can already be configured locally under Organization, and a live chat room can be configured with your own Supabase project from Studio chat." }
  ];

  function norm(text) {
    return String(text || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  }

  function matchIntent(text) {
    const value = norm(text);
    if (!value) return null;
    for (const intent of intents) {
      if (intent.patterns.some(pattern => pattern.test(value))) return intent;
    }
    return null;
  }

  function rankTools(text, limit = 3) {
    const value = norm(text);
    const words = value.split(/[^a-z0-9]+/).filter(word => word.length > 2);
    return tools.map(tool => {
      const haystack = norm(`${tool.title} ${tool.description} ${tool.keywords.join(" ")}`);
      let score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 2 : 0), 0);
      tool.keywords.forEach(keyword => { if (value.includes(keyword)) score += 8; });
      if (value.includes(tool.title.toLowerCase())) score += 12;
      return { tool, score };
    }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  function tool(id) { return tools.find(item => item.id === id) || null; }
  function intent(id) { return intents.find(item => item.id === id) || null; }
  function stage(id) { return stages.find(item => item.id === id) || null; }

  const catalog = { categories, tools, navigation, stages, intents, starters, templates, projectModes, matchIntent, rankTools, tool, intent, stage, norm };

  if (typeof module === "object" && module.exports) module.exports = catalog;
  if (root) {
    root.SignalNoir = root.SignalNoir || {};
    root.SignalNoir.catalog = catalog;
  }
})(typeof window !== "undefined" ? window : null);
