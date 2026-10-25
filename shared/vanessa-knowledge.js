const VANESSA_SHARED_TOPICS = [
  {
    keywords: ["privacy", "private", "safe", "secure", "upload", "sent", "server", "leave", "leaves", "data", "confidential", "share"],
    text: "Every tool on this hub parses and analyses your files entirely inside your own browser tab. Nothing you load is sent over the internet. Vanessa is the only part that can be given access to your data, she asks first, and she only ever talks to a program running on this same computer."
  },
  {
    keywords: ["excel", "xlsx", "sheet", "sheets", "workbook", "tab", "picker", "combine"],
    text: "When an Excel workbook has more than one sheet, a picker lists every sheet with its row and column count, plus a Combine all sheets option that stacks them into one table and adds a source_sheet column. Single sheet workbooks load straight through with no prompt."
  },
  {
    keywords: ["header", "headers", "title", "banner", "blank", "row", "skipped", "wrong", "column names", "garbage"],
    text: "Exports that begin with a title banner, a blank row or a generated on stamp used to parse those cells as the column names. The header row is now detected by scanning the first 15 rows and picking the one that actually looks like a header. Everything above it is dropped, along with fully empty rows and columns."
  },
  {
    keywords: ["duplicate column", "duplicate header", "same column name", "column_3", "name_2", "overwrote", "header twice"],
    text: "Every column name is made distinct and non empty before the data is handed to a tool. Two columns called name become name and name_2, and a blank header becomes column_3. Previously the second column silently overwrote the first and its data disappeared."
  },
  {
    keywords: ["date", "dates", "parse", "parsing", "not a date", "format", "timestamp", "serial"],
    text: "Dates are matched against a strict list of formats: ISO with or without a time, YYYY/MM/DD, MM/DD/YYYY, MM-DD-YYYY, two digit year variants of both, 15-Mar-2024, Mar 15 2024, Excel serial numbers and YYYYMMDD integers. Anything else is deliberately treated as not a date, because guessing turned values like CUST-0042 into the year 2042 and quietly broke every downstream metric."
  },
  {
    keywords: ["csv", "file", "load", "open", "import", "format", "json", "supported"],
    text: "The file based tools accept CSV, Excel and in some cases JSON. Files are read with the browser file picker and parsed locally. Nothing is uploaded."
  },
  {
    keywords: ["google", "sheet", "sheets", "link", "paste a link", "connect", "live data", "spreadsheet link", "url"],
    text: "Every tool that takes a file also takes a Google Sheets link. Under the file picker there is an or paste a Google Sheets link option: paste the URL from your address bar and the sheet is read straight into the tool as if you had picked a CSV. Your browser fetches it directly with no API key, no sign in and no server in between, which is why the sheet has to be readable without signing in. In Google Sheets open Share and set General access to Anyone with the link, or use File then Share then Publish to web. A sheet that stays private returns a sign in page rather than data, and the tool says so."
  },
  {
    keywords: ["significant", "significance", "p value", "statistically", "anova", "t test", "chi square", "correlation", "regression", "hypothesis", "is it real", "just noise", "by chance"],
    text: "Statistical Tests is the tool for that. It runs one way ANOVA, two sample and paired t-tests, chi-square for two categorical columns, correlation and simple linear regression, and each result comes with the statistic, a p value, an effect size and a sentence saying what it means. A p below 0.05 is the usual line for calling a difference real, and every result also reports an effect size, because with enough rows a trivial difference becomes significant."
  },
  {
    keywords: ["refresh", "reload", "lost", "gone", "cleared", "state", "saved"],
    text: "State lives only in the current tab by design, because there is no server. Refreshing the page clears loaded files, the same as closing any browser tab with unsaved work in memory."
  },
  {
    keywords: ["slow", "large", "big", "huge", "performance", "rows", "hang", "freeze"],
    text: "Everything runs in browser JavaScript rather than a compiled backend, so files with hundreds of thousands of rows will be noticeably slower than a typical export. For normal sized files this is not something you will notice."
  },
  {
    keywords: ["code", "access code", "keypad", "pin", "login", "password", "locked"],
    text: "The hub opens on a numeric access code keypad, and each code unlocks a different set of tools. It is a convenience filter rather than access control: it only covers the landing page, and anyone with a tool's direct URL can open it. There is no backend to check credentials against."
  },
  {
    keywords: ["download", "export", "save", "csv out", "output", "get it out", "send it", "share result"],
    text: "Results can be downloaded straight back out as CSV, Excel or JSON depending on the tool. The download is generated in the browser from the data already in memory, so it never goes near a server."
  },
  {
    keywords: ["not working", "broken", "error", "failed", "fails", "nothing happens", "does nothing", "crash", "crashed", "bug", "wrong", "stuck"],
    text: "When a tool misbehaves, three things cause most of it: the file did not parse the way you expected, the column you picked is not the type the tool wants, or the browser tab has run out of memory on a very large file. Reloading the page clears all state and starts you clean, and picking a smaller file is the fastest way to tell whether size is the problem."
  },
  {
    keywords: ["blank", "empty result", "no results", "nothing shown", "nothing showed", "no output", "no rows", "came back empty"],
    text: "An empty result usually means the filters or the key column knocked everything out rather than the tool failing. Check that the column you chose actually holds the values you think it does, and that any threshold or filter is not set so tight that nothing survives it."
  },
  {
    keywords: ["upload", "how do i load", "add file", "choose file", "open file", "import", "drag", "drop"],
    text: "Use the file picker on the page, or drag the file onto it where the tool supports that. The file is read straight from your disk by the browser and is never uploaded, which is why it works with no login and no waiting."
  },
  {
    keywords: ["file size", "too big", "large file", "limit", "how many rows", "maximum", "max rows"],
    text: "There is no hard row limit, because there is no server imposing one. The practical ceiling is your browser tab's memory. Tens of thousands of rows are comfortable, hundreds of thousands will feel slow, and a file big enough to exhaust the tab will simply stop responding. If that happens, split the file or work on a sample."
  },
  {
    keywords: ["free", "cost", "price", "pay", "subscription", "licence", "license", "account", "sign up", "log in", "login", "password"],
    text: "It is free and there is nothing to sign up for. There are no accounts and no passwords because there is no server holding anything. The access code on the landing page just decides which tools you see; it is not a login."
  },
  {
    keywords: ["slow", "taking forever", "frozen", "freeze", "hanging", "spinning", "unresponsive", "lag"],
    text: "Everything is computed in your browser tab, so speed is bound by your machine rather than a server. Big files, pairwise comparisons and SQL over many rows are the usual causes. Closing other heavy tabs helps more than you would think, and cutting the file down is the reliable fix."
  },
  {
    keywords: ["start over", "reset", "clear", "undo", "go back", "remove file", "wrong file", "start again"],
    text: "Reloading the page clears everything and starts you fresh, since all state lives in the tab. There is no undo history: nothing is written to your file, so the safe move is always to reload and load the file again."
  },
  {
    keywords: ["offline", "no internet", "wifi", "connection", "disconnected", "on a plane"],
    text: "The analysis itself needs no connection, but the page loads a few libraries from a CDN when it opens, so a completely offline machine may not render everything. Once a tool has loaded, the actual work carries on without a connection."
  },
  {
    keywords: ["browser", "chrome", "safari", "firefox", "edge", "which browser", "supported"],
    text: "Any current browser works for the tools themselves. My own language model connection is the fussy part: it relies on the browser allowing a page to talk to a program on your own machine, which Chrome and Firefox permit and Safari is stricter about. If I am quiet in Safari, that is why, and everything else still works."
  },
  {
    keywords: ["remember", "memory", "forget", "next time", "save my settings", "preferences", "do you remember"],
    text: "By default I forget everything the moment you close the tab, including whatever access you granted me. There is an opt-in setting under Change that lets me keep short notes between visits, but only ones you explicitly ask me to remember, and you can see and delete every one of them."
  },
  {
    keywords: ["why are you slow", "you are slow", "taking long", "how long", "waiting for you", "your speed"],
    text: "When I use a language model it is running on your own computer rather than in a data centre, so it goes at the speed of your machine. A small model on a laptop writes at roughly reading pace. The upside of that trade is that nothing you show me ever leaves the room."
  },
  {
    keywords: ["are you wrong", "you are wrong", "that is wrong", "incorrect", "you made that up", "hallucinate", "trust you", "can i trust"],
    text: "Treat what I say about your specific numbers as a starting point rather than a result, especially anything involving arithmetic. I am grounded in written notes about these tools, so I am reliable on how things work; I am much weaker at reasoning over your actual data. If something I say looks off, it may well be, and the tool's own output is the authority."
  }
];

const VANESSA_KNOWLEDGE = {
  "hub": {
    title: "Signal Noir",
    summary: "The landing page for the team's browser-based data tools. Every tool runs locally, needs no login, and is reached from a card on this page.",
    topics: [
      { keywords: ["which tool", "what tool", "recommend", "suggest", "should i use", "where do i", "how do i start", "best tool"], text: "Tell me what you are trying to do and I will point you at a tool. The short version: exploring or summarising a file starts with Column Statistics or Instant Dashboard, cleaning starts with Data Cleaner or Fuzzy Duplicate Finder, combining files starts with Lookup and Merge or SQL Workbench, and presenting results starts with Chart Builder or Dashboard Builder." },
      { keywords: ["clean", "cleaning", "messy", "tidy", "fix", "blank", "duplicate rows"], text: "For messy data, Data Cleaner handles exact duplicate rows, blank values and untidy headers. For near duplicates that exact matching misses, such as Acme Corp against ACME CORPORATION, use the Fuzzy Duplicate Finder instead." },
      { keywords: ["compare", "difference", "two files", "changed", "diff", "versions"], text: "To compare two versions of the same export, File Diff matches rows on a key column and reports what was added, removed and changed. For two blocks of text rather than files, use Text Diff." },
      { keywords: ["combine", "join", "merge", "lookup", "bring together", "enrich"], text: "Lookup and Merge matches two files on a shared key and pulls columns across, reporting anything that did not match. For anything more complicated than a single join, SQL Workbench loads several files as tables and lets you query across them with real SQLite." },
      { keywords: ["chart", "graph", "visualise", "visualize", "plot", "picture"], text: "Chart Builder turns two columns into a bar, line, pie or scatter chart you can download as a PNG. For something interactive with several visuals and filters, use Dashboard Builder, and for a dashboard built automatically from whatever the file contains, use Instant Dashboard." },
      { keywords: ["dashboard", "report", "share", "stakeholder", "present"], text: "Instant Dashboard profiles a file and builds a dashboard around what it finds with no setup. Dashboard Builder is the one to use when you want to choose the visuals yourself and hand the result over as a link or a single self contained HTML file." },
      { keywords: ["summarise", "summarize", "profile", "what is in", "understand", "explore", "overview"], text: "Column Statistics is the fastest way to see what is in a file: per column types, nulls, uniques, min, max, mean, median and a small distribution chart. Instant Dashboard is the visual version of the same idea." },
      { keywords: ["convert", "format", "csv", "excel", "json", "change format"], text: "Format Converter moves a file between CSV, Excel and JSON. For JSON specifically, JSON Formatter validates and pretty prints it, and can flatten nested JSON into rows." },
      { keywords: ["test data", "sample", "fake", "dummy", "generate", "mock"], text: "Test Data Generator builds realistic sample files from a column spec, with a seed so the same spec produces the same file every time." },
      { keywords: ["search", "find", "filter", "box"], text: "The search box filters the cards by name and description as you type, and any category with nothing left in it hides itself." },
      { keywords: ["keyboard", "shortcut", "palette", "ctrl", "cmd", "quick", "jump"], text: "Ctrl+K, or Cmd+K on a Mac, opens a jump to tool box with arrow key navigation. It only ever lists tools your current access code unlocks." },
      { keywords: ["recent", "recently", "last used", "history", "chips"], text: "The last five tools you opened appear as chips near the top. This is the only thing the hub remembers between visits, and it is filtered to the tools your current code unlocks. The access code itself is never stored." },
      { keywords: ["category", "categories", "section", "grouped", "organised"], text: "Tools are grouped into four sections by what you are trying to do: Explore and Analyze, Clean and Combine, Generate and Encode, and Text and Dev Utilities. Sections with nothing visible hide themselves." },
      { keywords: ["code", "access code", "missing tool", "cannot see", "hidden", "unlock", "keypad", "why"], text: "Each access code unlocks a different set of tools, so a tool you cannot see is simply not part of your code's set. The code is not remembered anywhere, which is why it has to be entered on every fresh load. It is a convenience filter rather than security: it only covers this landing page, and anyone with a tool's direct link can open it." },
      { keywords: ["add", "new tool", "another", "contribute", "extend"], text: "Adding a tool means creating a folder under tools/, copying one of the card blocks on this page and pointing it at the new folder, then adding its id to the relevant access codes. The README has the full steps." },
      { keywords: ["offline", "internet", "connection", "work", "down"], text: "The tools run in your browser, but the page still loads a few libraries from a CDN, so a completely offline machine may not render everything correctly." }
    ]
  },
  "data-analyzer": {
    title: "Data Analyzer",
    summary: "Runs KPIs, forecasting, goal pacing and anomaly detection over a CSV, TSV, delimited text, JSON or Excel file, entirely in the browser.",
    topics: [
      { keywords: ["file type", "file types", "format", "formats", "accepts", "supported", "tsv", "tab", "semicolon", "pipe", "delimiter", "json", "nested"], text: "It takes CSV, TSV, plain delimited text, JSON and Excel. The delimiter is worked out from the file rather than assumed, so comma, semicolon, tab and pipe files all load, and a comma file with semicolons inside a quoted value still reads correctly. JSON is flattened, so a nested object becomes dotted columns like customer.name, and records with different keys are squared off so a missing key shows as a blank." },
      { keywords: ["european", "decimal", "comma decimal", "1.234,56", "german", "french", "locale"], text: "European decimals are supported. A column is read that way only when something in it proves it, such as 1.234,56 or 1234,5, and nothing in it contradicts that. A value like 1,234 proves nothing either way, since it is a thousands separator in one convention and a decimal in the other, so a column of only those is left alone. The decision is made per column and the mapping screen names every column it reinterpreted." },
      { keywords: ["wide", "pivoted", "months as columns", "reshape", "unpivot", "no timeline", "no date column", "columns across the top"], text: "If your file has the periods across the top, like Region then Jan then Feb then Mar, there is no date column, so the trend, seasonality, forecast and anomaly panels cannot run. The mapping screen spots that shape and offers to reshape it into rows, which switches those panels back on. It keeps your other columns, names the two new ones so you can see where they came from, and there is an Undo that restores the original table exactly. It only offers when it is confident: at least three period columns, numbers underneath them, and something left over to keep." },
      { keywords: ["metric", "column", "picked", "wrong column", "mapping", "schema", "infer"], text: "The metric, timeline, entity and dimension columns are inferred by score rather than by taking the leftmost match. Name hints, fractional values, spread, and identifier or timeline penalties all feed the score. A column whose name looks like a date is checked for date-ness before it is checked for numeric-ness, so Excel serials and YYYYMMDD integers become the timeline rather than the metric." },
      { keywords: ["forecast", "forecasting", "projection", "predict", "future", "seasonal"], text: "Forecasting fits a seasonal trend model over the monthly series and projects forward, returning a conservative, expected and aggressive value for each future month along with an r squared diagnostic for the fit quality." },
      { keywords: ["goal", "goals", "pace", "pacing", "target", "behind", "ahead"], text: "Goal pacing compares progress so far against the elapsed share of the period and classifies each goal as ahead, on pace, behind, or no goal set when the target is zero." },
      { keywords: ["new", "repeat", "entity", "customer", "classification", "30 day"], text: "Entities are classified New or Repeat using a 30 day first seen rule: a row within 30 days of that entity's first appearance counts as New, everything later counts as Repeat." },
      { keywords: ["anomaly", "anomalies", "spike", "drop", "flag", "outlier"], text: "Anomaly detection compares each dimension value's month over month movement against its own history and flags spikes and drops that stand out relative to the average monthly scope total, so a flat series is not flagged." },
      { keywords: ["ai", "insight", "insights", "executive", "readout"], text: "The AI Portfolio Insight Engine is computed locally from the analysis results using rules in the tool's own JavaScript. It does not call any external service." },
      { keywords: ["hhi", "concentration", "index"], text: "The HHI concentration index is computed from each entity's share of the total metric, squared and summed, so a small number of dominant entities produces a high value." },
      { keywords: ["sql", "query", "sqlite"], text: "The analyzer carries its own copy of the SQLite engine wrapper so it stays fully self contained, and can query the loaded file as an in memory table." },
      { keywords: ["panel", "panels", "section", "sections", "visual", "visuals", "chart", "charts", "what is on", "layout", "everything", "all of it"], text: "The dashboard is built from these panels: the KPI tile row, Historical Core Metric Timeline, Dimension Drivers of Change, Trend Projection Matrix, Seasonality Profile Variance, Long-Range Forecast, Segment Performance Share, New vs Repeat Entity Split, Goal vs Actual Pacing, AI Portfolio Insight Engine, Key Risk Exposures and Concentration Outliers, Month-over-Month Spikes and Drops, and Ask a Question. Name any one of them and I will tell you what it is showing." },
      { keywords: ["kpi", "kpis", "tile", "tiles", "top row", "headline", "cards", "numbers at the top"], text: "The KPI row across the top holds Total Metric Value, Unique Entity Count, Avg Entity Value, Repeat Rate, Growth vs Prior Year, Trend Direction, Concentration HHI Index, Portfolio Health Score, Projected Year-End, Forecast Range and Current Actual. Each is computed from the file you loaded rather than being typed in anywhere." },
      { keywords: ["timeline", "historical", "trend chart", "core metric", "over time", "line chart"], text: "Historical Core Metric Timeline plots the metric column totalled by month across the whole file, which is the series everything else is built on. If it looks wrong, the timeline column was probably inferred from the wrong column, and the Check the columns we picked panel is where you confirm that." },
      { keywords: ["driver", "drivers", "dimension drivers", "change", "what changed", "moved", "contribution"], text: "Dimension Drivers of Change compares the two most recent complete months and lists which dimension values moved the total, so you can see what actually caused the change rather than only that it changed. The period it used is printed underneath the title. Each percentage is that value's share of the total movement, so the shares always add up to 100, and the sign and the colour of the bar tell you which way it went. When the movers largely cancel each other out, the line under the title says so and reports how little the net actually changed." },
      { keywords: ["projection", "projection matrix", "next 12", "twelve months", "scenarios"], text: "Trend Projection Matrix, Next 12 Months projects the fitted trend forward a year and shows a conservative, expected and aggressive figure for each month, so you can read the spread rather than a single number pretending to be certain." },
      { keywords: ["seasonality", "seasonal", "profile", "variance", "month pattern", "strongest month", "weakest month"], text: "Seasonality Profile Variance shows how each calendar month behaves relative to the average, which is what the Strongest Seasonal Month and Weakest Seasonal Month figures come from. It needs enough history to have seen each month at least once before it means anything." },
      { keywords: ["long range", "long-range", "reset to model", "adjust forecast", "drag"], text: "Long-Range Forecast extends the projection further out and can be adjusted by hand. Reset to model trend puts it back to what the fitted model actually predicts, so an adjusted forecast is never mistaken for the computed one." },
      { keywords: ["segment", "segment performance", "share", "drill", "drilldown", "drill-down", "click a bar", "filter to"], text: "Segment Performance Share breaks the metric down by the dimension column. Clicking a bar drills the whole dashboard down to that value, and a Clear drill-down link appears next to the title to take you back out. If the numbers everywhere suddenly look small, check whether a drill-down is still applied." },
      { keywords: ["new vs repeat", "entity split", "split", "new", "repeat", "returning"], text: "New vs Repeat Entity Split shows how much of the metric comes from entities appearing for the first time against ones you have seen before, using the 30 day first seen rule. It is the visual form of the Repeat Rate tile." },
      { keywords: ["goal", "goals", "pacing", "goal vs actual", "target", "on track", "behind", "ahead"], text: "Goal vs Actual Pacing compares progress so far against the elapsed share of the period, so being at half your number halfway through the year reads as on pace rather than as half done. Each goal is classified ahead, on pace, behind, or no goal set when the target is zero." },
      { keywords: ["insight", "insights", "ai", "readout", "executive", "recommended", "actions", "engine"], text: "The AI Portfolio Insight Engine writes the AI Executive Readout and Recommended Review Actions. Despite the name there is no model involved: it is rules in the tool's own JavaScript reading the analysis results, so it calls no external service and produces the same text for the same numbers every time." },
      { keywords: ["risk", "exposure", "concentration", "outlier", "outliers", "key risk", "hhi table"], text: "Key Risk Exposures and Concentration Outliers lists the entities carrying the most concentrated share of the total, with an Account Reference Identifier, an Aggregate Financial Concentration Size and a Risk Variance Reason for each. It is the row level detail behind the Concentration HHI Index tile." },
      { keywords: ["anomaly", "anomalies", "spike", "spikes", "drop", "drops", "deviation", "month over month"], text: "Month-over-Month Spikes and Drops flags profit centres and agencies whose latest month deviates sharply from their own trailing three month average. Comparing each one against its own history rather than against the whole file is what stops a large but steady entity being flagged every month." },
      { keywords: ["ask", "ask a question", "question box", "type a question", "answer"], text: "Ask a Question answers from this dashboard's own numbers with no external service, which means it recognises specific question patterns rather than free form language. It handles things like which dimension had the highest value, what is driving the change, is a goal on track, any anomalies, repeat rate, or naming a value directly. If it does not understand a phrasing, that is the limit of the pattern list rather than a failure of the data." },
      { keywords: ["columns we picked", "check the columns", "mapping", "confirm", "wrong column", "change column"], text: "Check the columns we picked is where the inferred metric, timeline, entity and dimension columns are shown so you can confirm or correct them before trusting anything downstream. Almost every complaint that a chart looks wrong traces back to this panel." },
      { keywords: ["compare", "comparison", "two files", "second file", "versus"], text: "A second file can be loaded to compare against the first, and the analyzer keeps both sets of results so the same metrics can be read side by side." }
    ]
  },
  "instant-dashboard": {
    title: "Instant Dashboard",
    summary: "Profiles any file and builds a dashboard shaped around whatever it finds, with no column mapping or setup step.",
    topics: [
      { keywords: ["how", "work", "mapping", "setup", "configure", "automatic"], text: "There is no mapping step. Every column is profiled to decide whether it is a date, a measure, a category, an identifier or free text, and the charts worth drawing are chosen from the shape that profiling found." },
      { keywords: ["chart", "charts", "why", "missing", "not shown", "picked"], text: "A trend is drawn when there is a date column spanning at least two months plus a measure. Breakdowns and compositions are drawn per category column, with compositions preferred when a category has six or fewer distinct values. A distribution is added for the strongest measure." },
      { keywords: ["issue", "issues", "warning", "blank", "empty", "constant"], text: "Profiling reports data quality issues directly: columns that are completely empty, columns that hold the same value in every row, and columns that are more than a quarter blank." },
      { keywords: ["identifier", "id", "measure", "not summed", "excluded"], text: "Identifier columns are kept out of the measure list, so an order id that happens to be numeric is not offered as something to total." }
    ]
  },
  "dashboard-builder": {
    title: "Dashboard Builder",
    summary: "Build a dashboard from your own file with visuals, measures, breakdowns and slicers, then download it as a single self contained HTML page or send it as a link.",
    topics: [
      { keywords: ["visual", "visuals", "kind", "type", "kpi", "donut", "scatter", "table"], text: "Eight visual kinds are available: KPI tile, trend line, column, bar, donut, table, detail rows and scatter. Each can be laid out at quarter, half or full width on a twelve column grid." },
      { keywords: ["you build", "can you build", "build it for me", "make it for me", "do it for me", "build me", "ask you to build", "vanessa build"], text: "I can put the dashboard together for you on this page. Tell me what you want in plain words, like build me revenue by region, total revenue, revenue over time, let me filter by segment, and I will add those visuals and that slicer. Say build me a dashboard from this file and I will shape one around whatever is loaded. I always show you the list first and add nothing until you press Add them. No model is involved either way, so you get the same result whether or not one is running." },
      { keywords: ["tab", "tabs", "which tab", "sheet tab", "worksheet", "multiple tabs", "pick a tab"], text: "When you paste a Google Sheets link and the workbook has more than one tab, I show a picker listing every tab by name with its row and column count, and only the tab you choose is read. The choice is remembered on the link, so a downloaded dashboard keeps reading that same tab every time it opens. If the workbook cannot be listed, for example a published link, it falls back to the tab in the URL or the first one." },
      { keywords: ["slicer", "slicers", "filter control", "dropdown", "chip", "range"], text: "Slicers are dropdown, chip list, numeric range and date range controls that filter every visual at once for whoever is looking at the dashboard. Range and date range slicers have a handle at each end so both bounds move." },
      { keywords: ["measure", "measures", "named", "reuse", "reusable"], text: "Named measures are reusable calculations: a name, a column, an aggregation, their own filters, an optional divisor and a format. A visual points at one instead of defining its own number, so editing the measure updates every visual built on it. Measures compose, meaning a divisor can point at another measure, and recursion is bounded at a depth of four." },
      { keywords: ["rate", "ratio", "percentage", "percent", "divide", "win rate", "margin"], text: "A binding can divide one aggregate by another. The rule that makes rates correct is that the visual's own filters narrow the top number only, and the bottom number carries its own filters. Slicers rescope the numerator and denominator together, a category with no wins still appears at zero, and a ratio breakdown never rolls its tail into an Other bucket because summing percentages is meaningless." },
      { keywords: ["filter", "filters", "combine", "and", "or", "multiple"], text: "Filters on the same column combine with or, filters on different columns combine with and. So Region equals North plus Region equals South gives you both regions rather than nothing. Exclusions and numeric comparisons stay and, so greater than plus less than forms a range." },
      { keywords: ["download", "html", "share", "link", "hand over", "send"], text: "Download HTML produces a single self contained file. With no slicers it embeds only the computed series per visual, so a large export collapses to a few KB. With slicers it embeds the rows themselves, capped at 50,000, because the viewer needs to refilter them. A share link encodes the spec but not the data into the URL fragment, and fragments are never sent to the server." },
      { keywords: ["edit", "editing", "reopen", "change", "afterwards"], text: "A dashboard is never a dead end. A share link opens back into the builder, and a downloaded file carries an Edit this dashboard link that reopens it with every visual, slicer, filter, ratio and colour intact." },
      { keywords: ["placeholder", "fake", "sample", "not real", "invented", "amber"], text: "With no data attached the builder invents plausible figures seeded from each visual's id, so the layout can be reviewed before real data exists. An amber banner and the footer both say plainly that the numbers are not real." },
      { keywords: ["google", "sheet", "sheets", "connect", "live"], text: "A Google Sheet can be read straight from a pasted link with no API key and no sign in. The sheet has to be readable without signing in, because the browser fetches it directly with no credentials. A downloaded dashboard rereads the sheet every time it is opened, rendering its baked snapshot first and swapping in live data when the fetch returns." },
      { keywords: ["type", "typed", "instruction", "words", "plain english", "describe"], text: "Typing instructions like revenue by region, total orders, revenue over time, let me filter by segment produces three visuals and a slicer bound to real columns. It is deterministic with no AI and no network, and anything it cannot work out is handed back to you verbatim rather than guessed at." },
      { keywords: ["colour", "color", "palette", "accent", "brand", "hex"], text: "A palette picks one of six named colour sets and an accent overrides the main colour with any hex value, applied to KPI text, bars, lines, area fills and donut slices. A custom accent moves to the front of the palette rather than replacing it, so donut slices keep enough distinct colours." },
      { keywords: ["detail", "rows", "raw", "unaggregated", "list"], text: "Detail rows is the odd one out: it lists rows as they are with no aggregation, showing whichever columns you tick and sorted by whichever column you choose. It reports the true match count when it shows fewer rows than matched, so a capped table never reads as the whole story." }
    ]
  },
  "file-diff": {
    title: "File Diff",
    summary: "Compares two files by a key column and reports added, removed and changed rows.",
    topics: [
      { keywords: ["key", "column", "match", "join", "identifier"], text: "Pick a key column that uniquely identifies a row in both files. Rows are matched on that key, then compared field by field to classify them as added, removed or changed." },
      { keywords: ["changed", "difference", "field", "which"], text: "The changed tab lists each differing field with its before and after value, so you can see what actually moved rather than just that the row is different." },
      { keywords: ["nothing", "empty", "no match", "all added", "all removed"], text: "If every row shows as added and removed rather than changed, the key column is usually not lining up. Check that the same column exists in both files and that its values have not been reformatted, for example numbers stored as text in one export." }
    ]
  },
  "pivot-explorer": {
    title: "Pivot and Chart Explorer",
    summary: "Ad hoc pivot table and chart over any file, with no fixed schema.",
    topics: [
      { keywords: ["pivot", "row", "column", "value", "field", "build"], text: "Choose a field for rows, optionally one for columns, and a value field with an aggregation. The table recomputes immediately and the chart follows whatever the table currently shows." },
      { keywords: ["chart", "graph", "visual", "switch"], text: "The chart renders the current pivot result, so changing the pivot fields changes the chart without any separate configuration." }
    ]
  },
  "data-cleaner": {
    title: "Data Cleaner",
    summary: "Detects and fixes duplicate rows, blank values and messy headers.",
    topics: [
      { keywords: ["duplicate", "dupe", "remove", "exact"], text: "Duplicate detection here is exact: two rows count as duplicates only when every field matches. For near matches such as spelling variations, use the Fuzzy Duplicate Finder instead." },
      { keywords: ["blank", "empty", "missing", "null", "fill"], text: "Blank detection reports how much of each column is empty so you can decide whether to drop the column, drop the rows, or leave it alone." },
      { keywords: ["header", "messy", "rename", "clean", "tidy"], text: "Messy headers are normalised, and the tool reports exactly which columns it renamed and why, so nothing changes silently." }
    ]
  },
  "converter": {
    title: "Format Converter",
    summary: "Converts between CSV, Excel and JSON.",
    topics: [
      { keywords: ["convert", "format", "csv", "excel", "json", "how"], text: "Load a file in any supported format and download it in another. The conversion runs in the browser, so the file never leaves your computer." },
      { keywords: ["nested", "json", "flatten", "object", "array"], text: "Nested JSON is flattened into flat rows before being written to a tabular format, because CSV and Excel have no way to represent nesting." }
    ]
  },
  "column-stats": {
    title: "Column Statistics",
    summary: "Per column min, max, mean, median, standard deviation and null counts, with no mapping step.",
    topics: [
      { keywords: ["numeric", "text", "type", "classified", "why"], text: "A column is treated as numeric when at least 90 percent of its non blank values parse as numbers. Otherwise it is treated as text and gets a most common value instead of statistics." },
      { keywords: ["percentile", "p25", "p75", "quartile", "median"], text: "P25, median and P75 are interpolated between the two nearest sorted values rather than snapped to the nearest row, so they are stable on small columns." },
      { keywords: ["distribution", "sparkline", "histogram", "bar"], text: "The distribution column draws a small histogram of the numeric values across twelve buckets, so you can spot skew and outliers at a glance." },
      { keywords: ["export", "download", "csv"], text: "Export CSV writes the whole per column summary out as a file you can keep or share." },
      { keywords: ["anova", "significant", "significance", "p value", "f test", "compare groups", "difference between groups", "statistical test", "hypothesis", "eta squared", "t test", "chi square", "correlation", "regression"], text: "Significance testing lives in its own tool. Statistical Tests runs one way ANOVA, two sample and paired t-tests, chi-square, correlation and linear regression over the same kind of file, each with a p value, an effect size and a plain words verdict. This tool profiles columns; that one tests whether a difference is real." }
    ]
  },
  "dashboards": {
    title: "Dashboards",
    summary: "The workspace listing every dashboard you have saved from Dashboard Builder, where you can open, rename or delete them.",
    topics: [
      { keywords: ["save", "saving", "how do i save", "add a dashboard", "put it here", "keep it"], text: "Press Save to Dashboards in the builder and it appears here. Saving keeps the design and, when the figures are small enough, the computed numbers with them. Saving again from the same builder session updates the same entry rather than making a second copy." },
      { keywords: ["delete", "remove", "get rid", "clear", "tidy up"], text: "Delete on a card removes that dashboard from this browser. It asks first and cannot be undone, because there is no server holding a copy to restore from." },
      { keywords: ["rename", "name", "title", "call it"], text: "Rename changes the name shown in the workspace. It does not change the title printed inside the dashboard itself, which comes from the builder." },
      { keywords: ["where", "stored", "storage", "browser", "shared", "team", "everyone", "colleague", "see mine"], text: "The workspace is stored in this browser under the key hub_dashboards, so it is yours rather than the team's. Nobody else sees it and clearing site data removes it. To share one, use the builder's link or downloaded file, or commit the file to the dashboards folder in the repo so it appears under Published to the site." },
      { keywords: ["published", "repo", "commit", "team workspace", "shared list", "folder"], text: "Anything committed to the dashboards folder in the repo, and listed in dashboards/index.json, appears in a second section that everyone who opens the site can see. That list is read only here: a published dashboard is removed by deleting the file and pushing, not from this page." },
      { keywords: ["numbers", "data", "figures", "placeholder", "real", "stale", "out of date", "live"], text: "A dashboard connected to a Google Sheet reloads live from that sheet each time you open it and is marked Live sheet. One built from a file you picked shows the figures that were computed when you saved it, so it is a snapshot. Reattach the file in the builder if you need to change what it measures." },
      { keywords: ["full", "limit", "how many", "out of storage", "quota"], text: "The workspace holds up to 60 dashboards, and browser storage is the real ceiling before that. If saving fails, delete something you no longer need. Dashboards carrying a lot of baked data use the most room." },
      { keywords: ["open", "view", "edit", "change"], text: "Open renders the dashboard as a viewer. Edit reopens it in the builder with every visual, slicer, filter and colour intact, so you can change it and save over the same entry." }
    ]
  },
  "stat-tests": {
    title: "Statistical Tests",
    summary: "Runs the standard significance tests over a loaded file: ANOVA, t-tests, chi-square, correlation and linear regression, each with a plain words verdict.",
    topics: [
      { keywords: ["which test", "what test", "pick a test", "choose a test", "which one should i use", "what should i run"], text: "Pick by the shape of the question. Comparing an average across three or more groups is ANOVA. Comparing exactly two groups is the t-test. Comparing two measurements on the same rows, like before and after, is the paired t-test. Asking whether two categorical columns are related is chi-square. Asking whether two numbers move together is correlation. Asking how much one number shifts per unit of another is regression." },
      { keywords: ["p value", "p", "significance", "significant", "0.05", "confidence"], text: "The p value is the probability of seeing a pattern at least this strong if there were genuinely nothing going on. Below 0.05 is the usual line for calling a result real. It is not the probability that you are right, and a p above 0.05 is not proof that two things are the same. It only means this data cannot tell them apart." },
      { keywords: ["anova", "three groups", "many groups", "f value", "eta squared"], text: "One-way ANOVA compares the averages of a number across the values of a grouping column. It reports F, its two degrees of freedom, a p value, and eta squared, which is the share of the variation the grouping explains. With exactly two groups it gives the same answer as a pooled t-test, because F is t squared." },
      { keywords: ["t test", "ttest", "two groups", "welch", "student", "pooled", "equal variance"], text: "The two-sample t-test compares two groups. Welch is the default and does not assume the two groups have the same spread, which is why its degrees of freedom are usually fractional. Ticking equal spread switches to the classic pooled Student version. Welch is the safer default and you should need a reason to leave it." },
      { keywords: ["paired", "before and after", "same rows", "repeated", "matched"], text: "The paired t-test is for two measurements of the same thing, one row per subject. It tests the differences rather than the two columns separately, which is far more sensitive when the subjects vary a lot between themselves. Rows missing either value are dropped from the pairing." },
      { keywords: ["chi square", "chisquare", "chi", "categorical", "independence", "cramer", "cramers v", "contingency"], text: "Chi-square asks whether two categorical columns are related, by comparing the counts you have against the counts you would expect if they were unrelated. It needs no numeric column, only rows to count. Cramers V comes with it and says how strong the link is, from 0 for none to 1 for total. It tells you a link exists, not which direction it runs." },
      { keywords: ["expected count", "smallest expected", "less than 5", "unreliable", "thin cell"], text: "Chi-square becomes unreliable when any expected count falls below about 5, so the smallest expected count is reported every time and flagged when it is too thin. The usual fix is combining the smallest categories into one, not ignoring the warning." },
      { keywords: ["correlation", "correlate", "pearson", "spearman", "r value", "move together", "relationship"], text: "Correlation measures whether two numbers rise and fall together. Pearson looks for a straight line relationship, Spearman only for a consistent direction. When Spearman is clearly stronger than Pearson, the relationship is usually real but curved rather than straight, and the tool says so. A single extreme point can distort Pearson badly." },
      { keywords: ["regression", "predict", "slope", "intercept", "line", "r squared", "fit"], text: "Simple linear regression fits a straight line and reports the slope, the intercept, r squared and a p value for the slope. The slope is how much the outcome shifts per unit of the predictor. r squared is the share of movement the line explains. The p value on the slope is the same test as the correlation p value, because they are the same question asked twice." },
      { keywords: ["causation", "causal", "cause", "prove", "because"], text: "None of these tests show causation. They show that a pattern is unlikely to be chance. Something you did not measure can drive both columns, and reversing which column you call the predictor changes nothing about the p value. Treat a significant result as a reason to investigate rather than as an explanation." },
      { keywords: ["effect size", "how big", "how strong", "practical", "matters"], text: "A p value says whether a difference is detectable, not whether it is worth caring about. With enough rows a trivial difference becomes significant. That is why every test here also reports an effect size: eta squared for ANOVA, the raw difference for a t-test, Cramers V for chi-square, and r squared for correlation and regression. Read the effect size before you read the p value." },
      { keywords: ["assumption", "assumptions", "valid", "normal", "outlier", "when not to"], text: "Each result carries a note about what the test assumed. ANOVA and the pooled t-test assume similar spread across groups; the paired test assumes each row really is one subject measured twice; chi-square assumes reasonably sized expected counts; regression assumes a straight line is the right shape. A borderline p value plus a broken assumption is not a finding." },
      { keywords: ["no groups", "cannot pick", "empty dropdown", "not offered", "missing column"], text: "The pickers only offer columns that suit the test. Measures must be numeric, and grouping columns must have between 2 and 30 distinct values, since grouping by something nearly unique gives one row per group and nothing to test. If a list is empty, the file does not have the shape that test needs." },
      { keywords: ["two groups only", "exactly two", "more than two"], text: "The two-sample t-test needs exactly two groups. If the column you picked has more, the tool says how many it found and points you at ANOVA instead of quietly comparing the first two." }
    ]
  },
  "sql-workbench": {
    title: "SQL Workbench",
    summary: "Loads CSV, Excel and JSON files as tables and queries them with standard SQLite, including joins across files.",
    topics: [
      { keywords: ["sql", "dialect", "syntax", "sqlite", "supported"], text: "The engine is real SQLite compiled to WebAssembly, so standard SQLite syntax works, including joins, subqueries, common table expressions and window functions." },
      { keywords: ["table", "name", "called", "rename", "sanitised"], text: "Each loaded file becomes a table named after the file, with characters that are not valid in an identifier replaced. The table list shows the exact names to use in your query." },
      { keywords: ["join", "across", "multiple", "two files"], text: "Load more than one file and each becomes its own table, so you can join across files in a single query." },
      { keywords: ["type", "types", "number", "text", "wrong"], text: "Column types are inferred per column when the table is built. A column that mixes numbers and text falls back to text, which can make comparisons behave unexpectedly, so cast explicitly when a column is mixed." },
      { keywords: ["slow", "first", "loading", "wait"], text: "The SQLite engine is loaded lazily from a CDN the first time a query runs, so the first query is slower than the ones after it." }
    ]
  },
  "lookup-merge": {
    title: "Lookup and Merge",
    summary: "Matches two files on a shared key and pulls columns across, reporting the rows that did not match.",
    topics: [
      { keywords: ["key", "match", "join", "shared"], text: "Pick the key column in each file. Rows are matched on that key and the columns you select are pulled across from the second file into the first." },
      { keywords: ["unmatched", "missing", "not found", "blank"], text: "Rows that found no match are reported rather than silently dropped, so you always know how complete the merge was." },
      { keywords: ["duplicate", "many", "multiple match"], text: "When a key appears more than once in the lookup file, the match is ambiguous. Deduplicate the lookup side first if you need a predictable result." }
    ]
  },
  "fuzzy-dupes": {
    title: "Fuzzy Duplicate Finder",
    summary: "Finds near duplicate values that exact deduplication misses, with an adjustable similarity threshold.",
    topics: [
      { keywords: ["threshold", "similarity", "sensitive", "false", "too many", "too few", "tune", "slider"], text: "The similarity threshold runs from 0 to 1, where 1 means identical. Lowering it finds more near matches and produces more false positives, raising it finds fewer but more confident matches. If you are drowning in false matches, raise the threshold first before changing anything else." },
      { keywords: ["suffix", "inc", "ltd", "llc", "corp", "business", "company", "strip"], text: "Business suffixes such as Corp, Inc, Ltd, LLC, GmbH and Holdings can be stripped before comparing, so Acme Inc and Acme Ltd are recognised as the same company rather than two different ones." },
      { keywords: ["which column", "what column", "pick", "choose", "column", "run", "select", "best"], text: "Run the check on the column holding the messy human entered names, typically a customer, vendor, supplier or company column. Identifier columns such as an id or a code are the wrong choice, because they are already unique by design and near matches between them are meaningless. Numeric and date columns are not useful here either." },
      { keywords: ["how", "algorithm", "distance", "levenshtein", "compare", "work"], text: "Values are normalised to lowercase with punctuation removed, then compared with Levenshtein edit distance turned into a similarity ratio against the longer of the two strings." },
      { keywords: ["slow", "large", "long", "many rows"], text: "Comparison is pairwise, so the work grows with the square of the number of distinct values. A column with tens of thousands of distinct values will take a while." }
    ]
  },
  "chart-builder": {
    title: "Chart Builder",
    summary: "Turns two columns into a bar, line, pie or scatter chart, downloadable as a PNG.",
    topics: [
      { keywords: ["chart", "type", "bar", "line", "pie", "scatter", "which"], text: "Pick a label column and a value column, then choose bar, line, pie or scatter. Bar and pie suit categories, line suits a time ordered series, and scatter suits two numeric columns." },
      { keywords: ["png", "download", "image", "export", "save"], text: "Download PNG renders the chart exactly as shown to an image file you can drop into a document or a deck." }
    ]
  },
  "data-generator": {
    title: "Test Data Generator",
    summary: "Builds realistic sample files from a column spec, with a seed for repeatable output.",
    topics: [
      { keywords: ["seed", "repeat", "same", "reproduce", "deterministic"], text: "Setting a seed makes the generated data repeatable, so the same spec and seed always produce the same file. Change the seed to get a different but equally valid sample." },
      { keywords: ["column", "spec", "type", "kind", "define"], text: "Define each column by name and type, and the generator produces values that look plausible for that type rather than random noise." },
      { keywords: ["rows", "how many", "size", "large"], text: "Choose the row count before generating. Very large row counts take longer because the file is built in memory before download." }
    ]
  },
  "code-helper": {
    title: "Code Helper",
    summary: "Snippets for common data tasks in Python, R, SQL, JavaScript and Java, written against your own column names.",
    topics: [
      { keywords: ["language", "python", "sql", "javascript", "java", "which"], text: "Pick the language and the task, and the snippet is generated using the column names from a file you load, so you can paste it straight in without renaming anything." },
      { keywords: ["column", "name", "own", "real"], text: "Load a file first and the snippets use its real column names. Without a file you still get the snippet shape with placeholder names." }
    ]
  },
  "json-formatter": {
    title: "JSON Formatter",
    summary: "Validates, pretty prints and minifies JSON, and can flatten nested JSON into rows.",
    topics: [
      { keywords: ["invalid", "error", "broken", "parse", "wrong"], text: "Invalid JSON is reported with the position of the problem, which is usually a trailing comma, a single quote where a double quote is needed, or an unescaped character inside a string." },
      { keywords: ["flatten", "nested", "rows", "table", "tabular"], text: "Nested JSON can be flattened into flat rows, turning nested keys into dotted column names so the result fits a table." },
      { keywords: ["minify", "pretty", "format", "indent"], text: "Pretty print expands the JSON with indentation for reading, and minify strips all optional whitespace for transport." }
    ]
  },
  "timestamp-converter": {
    title: "Timestamp Converter",
    summary: "Converts between Unix timestamps and dates across timezones, with ISO 8601 and relative time.",
    topics: [
      { keywords: ["unix", "epoch", "seconds", "milliseconds", "ms"], text: "Both seconds and milliseconds are handled. A ten digit number is seconds and a thirteen digit number is milliseconds, which is the usual source of an answer that is off by decades." },
      { keywords: ["timezone", "utc", "local", "offset", "zone"], text: "The same instant is shown in UTC and in your local timezone at once, so you can see the offset rather than having to reason about it." },
      { keywords: ["relative", "ago", "from now"], text: "Relative time expresses the instant as a distance from now, which is useful for sanity checking whether a timestamp is plausible." }
    ]
  },
  "regex-tester": {
    title: "Regex Tester",
    summary: "Live highlighted pattern matches and capture groups against sample text.",
    topics: [
      { keywords: ["group", "capture", "bracket", "extract"], text: "Capture groups are listed per match, numbered in the order their opening bracket appears, so you can confirm which group holds what before using the pattern elsewhere." },
      { keywords: ["flag", "flags", "global", "case", "insensitive", "multiline"], text: "Flags control whether the pattern matches globally, ignores case, or treats the text as multiple lines. Without the global flag only the first match is found." },
      { keywords: ["no match", "nothing", "not working", "escape"], text: "If nothing matches, the usual causes are an unescaped special character such as a dot or a bracket, or the case sensitivity flag being off when the text differs in case." }
    ]
  },
  "text-diff": {
    title: "Text Diff",
    summary: "Line level diff between two pasted blocks of text.",
    topics: [
      { keywords: ["line", "level", "word", "character", "granularity"], text: "The comparison is line by line, so a single changed word marks the whole line as changed rather than highlighting the word itself." },
      { keywords: ["whitespace", "trailing", "space", "invisible"], text: "Lines that look identical but show as different usually differ in trailing whitespace or line endings, which are invisible on screen but real to the comparison." }
    ]
  },
  "color-tools": {
    title: "Color Tools",
    summary: "Shade palette generator from a base colour, plus a WCAG contrast ratio checker.",
    topics: [
      { keywords: ["contrast", "wcag", "accessible", "ratio", "pass", "fail"], text: "The contrast checker reports the ratio between two colours against the WCAG thresholds: 4.5 to 1 for normal body text and 3 to 1 for large text. A ratio below those fails for that text size." },
      { keywords: ["palette", "shade", "tint", "generate", "scale"], text: "Give a base colour and the generator produces a scale of lighter and darker shades from it, which is the usual starting point for a consistent theme." }
    ]
  },
  "text-analyzer": {
    title: "Text Analyzer",
    summary: "Word, character and sentence counts, reading time, and the most frequent words in a block of text.",
    topics: [
      { keywords: ["reading", "time", "minutes", "estimate"], text: "Reading time is estimated from the word count at a typical reading speed, so treat it as an approximation rather than a measurement." },
      { keywords: ["frequent", "common", "word", "frequency", "top"], text: "The most frequent words are counted after normalising case, which is why a word appearing capitalised at the start of sentences is not counted separately." }
    ]
  },
  "qr-generator": {
    title: "QR Code Generator",
    summary: "Turns text or a URL into a downloadable QR code PNG.",
    topics: [
      { keywords: ["scan", "not working", "unreadable", "fail", "size"], text: "A QR code that will not scan is usually too dense for its printed size. Shortening the encoded text lowers the density and makes it easier to read at small sizes." },
      { keywords: ["url", "link", "text", "what", "encode"], text: "Any text can be encoded, but a URL needs its full scheme, meaning https at the front, for a phone camera to open it as a link rather than showing it as plain text." },
      { keywords: ["bulk", "many", "column", "file", "batch"], text: "A column from a loaded file can be turned into codes in bulk rather than one at a time." }
    ]
  },
  "markdown-preview": {
    title: "Markdown Previewer",
    summary: "Live rendered Markdown with copy and download of the resulting HTML.",
    topics: [
      { keywords: ["safe", "script", "sanitise", "sanitize", "untrusted", "html"], text: "Rendered Markdown is passed through an allowlist sanitiser before it reaches the page. Only known good tags and attributes survive, every event handler is dropped, and only http, https, mailto, tel, ftp, relative and anchor links are allowed, plus data URLs for images only. Unknown tags are unwrapped so their text survives. This matters because the Markdown library does not sanitise its own output." },
      { keywords: ["copy", "download", "html", "export"], text: "Copy HTML and Download HTML both hand you the sanitised output, so pasting a README from an untrusted source cannot carry a script through into wherever you paste it." }
    ]
  },
  "encode-decode": {
    title: "Base64 and URL Encoder",
    summary: "UTF-8 safe Base64 and URL encoding and decoding, chainable in either direction.",
    topics: [
      { keywords: ["utf", "unicode", "accent", "emoji", "broken", "mangled"], text: "Encoding is UTF-8 safe, so accented characters and other non ASCII text survive a round trip instead of being mangled, which is the usual failure of a naive Base64 implementation." },
      { keywords: ["chain", "both", "twice", "combine", "order"], text: "The operations chain, so you can Base64 encode and then URL encode the result in one place, which is what most token and query string formats expect." }
    ]
  },
  "unit-converter": {
    title: "Unit Converter",
    summary: "Length, weight and temperature conversion with a quick reference table.",
    topics: [
      { keywords: ["temperature", "celsius", "fahrenheit", "kelvin", "wrong"], text: "Temperature is an offset scale rather than a simple ratio, so it is converted with the full formula rather than by multiplying. This is why doubling a Celsius value does not double the Fahrenheit one." },
      { keywords: ["unit", "supported", "which", "list"], text: "Length, weight and temperature are covered, with a quick reference table alongside the converter for the common conversions." }
    ]
  },
  "jwt-decoder": {
    title: "JWT Decoder",
    summary: "Decodes a JSON Web Token's header, payload and expiry. It does not verify signatures.",
    topics: [
      { keywords: ["verify", "signature", "valid", "trust", "check", "secure"], text: "This decodes but does not verify. The signature is not checked, so a decoded token proves only what it claims to say, not that it is genuine. Never make a trust decision from this output alone." },
      { keywords: ["expiry", "exp", "expired", "iat", "when"], text: "The exp and iat claims are shown as readable dates as well as raw numbers, so you can see at a glance whether a token has expired." },
      { keywords: ["paste", "safe", "secret", "leak"], text: "Decoding happens entirely in your browser and the token is not transmitted anywhere. Even so, a real token is a credential, so treat it with the same care you would a password." }
    ]
  }
};
