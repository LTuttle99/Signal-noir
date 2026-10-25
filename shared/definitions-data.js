const HUB_DEFINITIONS = {
  "data-analyzer": [
    { selector: '[data-panel="kpis"]', text: "The headline numbers, recalculated from your file every time you change the mapping or a filter. Each tile is named after the columns you loaded rather than a generic label." },
    { selector: '[data-panel="forecast"]', text: "Projects where the current period finishes if the recent pattern continues. Confidence comes from how well the fitted model matched the history, so a noisy series honestly reports low confidence rather than a precise-looking guess." },
    { selector: '[data-panel="trend"]', text: "Your metric totalled by month across the whole file. This is the series every other time-based panel is built from, so if this looks wrong, the timeline column is the first thing to check." },
    { selector: '[data-panel="drivers"]', text: "Compares the two most recent complete months and lists which dimension values actually moved the total. It answers what changed rather than only that something changed." },
    { selector: '[data-panel="projection"]', text: "Projects the fitted trend forward twelve months and shows a conservative, expected and aggressive figure for each. Read the spread rather than the middle line: the gap between them is the honest part." },
    { selector: '[data-panel="seasonality"]', text: "How each calendar month behaves relative to the average. It needs at least one full cycle of history before it means anything, and it is where the strongest and weakest month figures come from." },
    { selector: '[data-panel="long-range"]', text: "Extends the projection further out and can be dragged by hand to model a scenario. Reset to model trend puts it back to what the maths actually predicts, so an adjusted line is never mistaken for a computed one." },
    { selector: '[data-panel="segment"]', text: "Your metric broken down by the dimension column. Clicking a bar drills the whole dashboard into that value, and a Clear drill-down link appears by the title. If every number suddenly looks small, check whether a drill-down is still applied." },
    { selector: '[data-panel="entity-split"]', text: "How much of the metric comes from entities appearing for the first time against ones seen before, using a 30-day first-seen rule. It is the visual form of the repeat rate tile." },
    { selector: '[data-panel="goals"]', text: "Compares progress against the elapsed share of the period rather than against the finish line, so being halfway at the halfway point reads as on pace rather than as half done." },
    { selector: '[data-panel="insights"]', text: "Written observations generated from the analysis results. Despite the name there is no language model involved: these are rules in the tool's own code, so the same numbers always produce the same text." },
    { selector: '[data-panel="concentration"]', text: "The entities carrying the most concentrated share of the total. This is the row-level detail behind the HHI tile, which squares each entity's share and sums them, so a few dominant entities produce a high number." },
    { selector: '[data-panel="anomalies"]', text: "Flags values whose latest month jumps or drops sharply against their own trailing three-month average. Comparing each against its own history rather than against the whole file is what stops a large but steady value being flagged every month." },
    { selector: '[data-panel="ask"]', text: "Answers from this dashboard's own computed numbers with no external service, so it recognises specific question shapes rather than free-form language. If a phrasing is not understood, that is the limit of the pattern list rather than a problem with your data." }
  ],

  "dashboards": [
    { selector: "#workspace-card", text: "Dashboards saved from the builder, held in this browser only. Open renders one, Edit reopens it in the builder, and Delete removes it for good, since there is no server holding a copy." },
    { selector: "#published-card", text: "Dashboards committed to the repo, which everyone opening this site can see. Read only from here: one is removed by deleting the file and pushing." }
  ],

  "stat-tests": [
    { selector: "#test-picker", closest: ".rounded-xl", text: "Pick by the shape of your question. Three or more groups is ANOVA, exactly two is a t-test, two measurements of the same rows is the paired test, two categorical columns is chi-square, and two numbers is correlation or regression." },
    { selector: "#field-picker", closest: ".rounded-xl", text: "Only columns that suit the chosen test are offered. Measures must be mostly numeric; grouping columns must have between 2 and 30 distinct values, because grouping by something nearly unique gives one row per group and nothing to test." },
    { selector: "#result", text: "Every result carries the statistic, its degrees of freedom, a p value, an effect size and a plain sentence. The p value says whether a difference is detectable; the effect size says whether it is big enough to care about. Read the effect size first." }
  ],

  "instant-dashboard": [
    { selector: "#kpi-row", text: "Headline counts and totals chosen from whatever the file turned out to contain. No mapping step happens first: every column is profiled and the useful summaries are picked from what was found." },
    { selector: "#issues-card", text: "Data quality problems found while profiling: columns that are completely empty, columns holding the same value in every row, and columns more than a quarter blank. These are the things that quietly break a join or an average later." },
    { selector: "#profile-table", closest: ".rounded-xl", text: "What each column was judged to be, and why. Date, measure, category, identifier or free text. The charts below are chosen from these judgements, so a wrong chart usually traces back to a wrong reading here." },
    { selector: "#blocks", text: "Charts chosen from the shape of the data rather than from a template. A trend needs a date column spanning at least two months; compositions are preferred when a category has six or fewer values; identifier columns are kept out of the measure list entirely." }
  ],

  "dashboard-builder": [
    { selector: "#data-input", closest: ".rounded-xl", text: "Load a file or connect a Google Sheet. Without data the builder still works and invents plausible placeholder figures, so a layout can be reviewed before real numbers exist. The footer says plainly when figures are not real." },
    { selector: "#measure-list", closest: ".rounded-xl", text: "Named measures are reusable calculations: a column, an aggregation, optional filters, an optional divisor and a format. A visual points at one instead of defining its own number, so editing the measure updates everything built on it." },
    { selector: "#add-buttons", closest: ".rounded-xl", text: "Eight visual kinds across a twelve column grid. Detail rows is the odd one out: it lists rows as they are with no aggregation, and reports the true match count when it shows fewer rows than matched." },
    { selector: "#preview", text: "The live preview. What you see here is exactly what a downloaded file or a shared link will render, including slicer behaviour." }
  ],

  "column-stats": [
    { selector: "#stat-rows", closest: ".rounded-xl", text: "Rows read from the file, after blank rows and any header banner are dropped." },
    { selector: "#stat-cols", closest: ".rounded-xl", text: "Columns found after blank columns are dropped and duplicate headers are made unique." },
    { selector: "#stat-dupes", closest: ".rounded-xl", text: "Rows identical to an earlier row across every column. Near duplicates are not counted here." },
    { selector: "#stat-numeric", closest: ".rounded-xl", text: "Columns where most values parse as numbers. Commas, currency symbols and percent signs still count." },
    { selector: "#summary-container", closest: ".rounded-xl", text: "One row per column. P25, median and P75 are interpolated between the two nearest sorted values rather than snapped to a row, so they stay stable on small columns. The distribution sparkline buckets the numeric values into twelve bars to show skew at a glance." }
  ],

  "fuzzy-dupes": [
    { selector: "#threshold", closest: ".rounded-xl", text: "How similar two values must be to count as a match, from 0 to 1 where 1 means identical. Lowering it finds more near matches and more false positives; raising it finds fewer but more confident ones. If you are drowning in false matches, raise this before changing anything else." },
    { selector: "#strip-suffixes", closest: ".rounded-xl", text: "Strips business suffixes such as Corp, Inc, Ltd, LLC and Holdings before comparing, so Acme Inc and Acme Ltd are read as one company rather than two." },
    { selector: "#results", text: "Values are normalised to lowercase with punctuation removed, then compared with Levenshtein edit distance turned into a similarity ratio against the longer string. Comparison is pairwise, so the work grows with the square of the number of distinct values." },
    { selector: "#groups-container", text: "Each group is a cluster of values the tool believes are the same thing. Review them before removing anything: the threshold decides how aggressive the grouping is, and it cannot know your domain." }
  ],

  "pivot-explorer": [
    { selector: "#controls", text: "Choose a field for rows, optionally one for columns, and a value field with an aggregation. The table recomputes immediately, with no schema or setup step." },
    { selector: "#pivotChart", closest: ".rounded-xl", text: "The chart always renders whatever the pivot currently shows, so changing the pivot fields changes the chart with no separate configuration." },
    { selector: "#pivot-table-container", closest: ".rounded-xl", text: "The cross-tabulation itself. Blank cells mean no rows matched that combination, which is different from a zero." }
  ],

  "data-cleaner": [
    { selector: "#report-section", text: "What the file looks like before anything is changed: duplicate rows, blank values per column and untidy headers. Nothing is modified until you apply a fix." },
    { selector: "#controls", text: "Each fix is opt-in and applied to a copy. Duplicate detection here is exact, meaning every field must match; for near matches use the Fuzzy Duplicate Finder instead." },
    { selector: "#header-notice", text: "Column names that collided or were empty and had to be renamed. Two columns called name become name and name_2 rather than one silently overwriting the other." },
    { selector: "#preview-container", closest: ".rounded-xl", text: "The first twenty rows after the selected fixes are applied, so you can see the effect before downloading." }
  ],

  "file-diff": [
    { selector: "#key-column", closest: ".rounded-xl", text: "The column that identifies the same row in both files. Everything else depends on this: rows are matched on the key, then compared field by field." },
    { selector: "#results", text: "Added means the key exists only in the second file, removed only in the first, and changed means the key is in both but at least one field differs. If everything shows as added and removed rather than changed, the key column is not lining up, often because numbers are stored as text in one export." },
    { selector: "#table-container", text: "For changed rows this lists each differing field with its before and after value, so you can see what actually moved rather than only that the row is different." }
  ],

  "lookup-merge": [
    { selector: "#main-key-wrap", closest: ".rounded-xl", text: "The shared key in each file. Rows are matched on it and the columns you tick are pulled across from the lookup file into the main one." },
    { selector: "#join-type", closest: ".rounded-xl", text: "Decides what happens to main rows with no match: keep them with blanks, or drop them. Keeping them is usually right, because a silently shrinking row count is how a bad merge hides." },
    { selector: "#stat-unmatched", closest: ".rounded-xl", text: "Rows that found no match. Reported rather than silently dropped, so you know how complete the merge was." },
    { selector: "#stat-dupes", closest: ".rounded-xl", text: "Keys appearing more than once in the lookup file, which makes the match ambiguous. Deduplicate that side first." }
  ],

  "sql-workbench": [
    { selector: "#schema-container", closest: ".rounded-xl", text: "Each loaded file becomes a table named after it, with characters that are not valid in an identifier replaced. Use exactly the names shown here in your query." },
    { selector: "#sql-editor", closest: ".rounded-xl", text: "Real SQLite compiled to WebAssembly, so standard syntax works including joins, subqueries, common table expressions and window functions. The engine loads on the first query, which is why the first run is slower than the ones after it." },
    { selector: "#results-container", text: "Column types are inferred per column when the table is built. A column mixing numbers and text falls back to text, which can make comparisons behave unexpectedly, so cast explicitly when a column is mixed." }
  ],

  "converter": [
    { selector: "#results", text: "Load in one format and download in another. Nested JSON is flattened into flat rows first, because CSV and Excel have no way to represent nesting." },
    { selector: "#preview-container", closest: ".rounded-xl", text: "The first twenty rows as the converter now understands them. If a column looks wrong here it will be wrong in the download." }
  ],

  "chart-builder": [
    { selector: "#controls", text: "Pick a label column and a value column. Bar and pie suit categories, line suits a time ordered series, and scatter suits two numeric columns." },
    { selector: "#top-n", closest: ".rounded-xl", text: "Limits how many categories are drawn. A chart with hundreds of bars communicates nothing, so this keeps the largest and drops the tail." },
    { selector: "#chart-card", text: "Download PNG renders the chart exactly as shown into an image file, at the size on screen." }
  ],

  "data-generator": [
    { selector: "#column-list", closest: ".rounded-xl", text: "Define each column by name and type. The generator produces values that look plausible for that type rather than random noise, so the output is safe to demo with and useless as real data." },
    { selector: "#seed", closest: ".rounded-xl", text: "The seed makes the output repeatable: the same spec and seed always produce the same file. Change it to get a different but equally valid sample." },
    { selector: "#null-rate", closest: ".rounded-xl", text: "Deliberately blanks a share of values, so you can test how something downstream copes with missing data." },
    { selector: "#preview-container", closest: ".rounded-xl", text: "The first twenty generated rows. The full row count is only built when you download." }
  ],

  "code-helper": [
    { selector: "#language-tabs", closest: ".rounded-xl", text: "The same task rendered in each language. Pick the one you are working in; the logic is equivalent across all of them." },
    { selector: "#task-list", closest: ".rounded-xl", text: "Common data tasks. Choosing one regenerates the snippet against whichever columns are currently mapped." },
    { selector: "#code-output", closest: ".rounded-xl", text: "The snippet is written using the real column names from a loaded file, so it can be pasted straight in. Without a file you still get the shape with placeholder names." }
  ],

  "json-formatter": [
    { selector: "#json-input", closest: ".rounded-xl", text: "Paste or load JSON. It is parsed in the browser, so nothing is uploaded and large documents are limited only by the tab's memory." },
    { selector: "#error-panel", text: "Invalid JSON is reported with the position of the problem. The usual causes are a trailing comma, a single quote where a double quote is needed, or an unescaped character inside a string." },
    { selector: "#info-panel", text: "Pretty print expands the document with indentation for reading; minify strips every optional character for transport. Flatten turns nested keys into dotted column names so the result fits a table." }
  ],

  "timestamp-converter": [
    { selector: "#ts-input", closest: ".rounded-xl", text: "Accepts a Unix timestamp or a date. A ten digit number is read as seconds and a thirteen digit number as milliseconds, which is the usual source of an answer that is out by decades." },
    { selector: "#standard-outputs", text: "The same instant in several standard formats. ISO 8601 is the one to use when handing a timestamp to another system." },
    { selector: "#timezone-outputs", text: "The same instant shown in UTC and in your local zone at once, so you can see the offset rather than having to reason about it. Relative time is there to sanity check whether a timestamp is even plausible." }
  ],

  "regex-tester": [
    { selector: "#pattern-input", closest: ".rounded-xl", text: "The pattern, without the surrounding slashes. Flags go in their own box." },
    { selector: "#flags-input", closest: ".rounded-xl", text: "Flags control behaviour: g matches every occurrence rather than only the first, i ignores case, and m makes the anchors work per line. Without g you will only ever see one match." },
    { selector: "#highlighted-output", closest: ".rounded-xl", text: "Live highlighting of what the pattern currently matches. If nothing matches, the usual causes are an unescaped special character such as a dot or a bracket, or case sensitivity." },
    { selector: "#match-list", text: "Capture groups per match, numbered in the order their opening bracket appears, so you can confirm which group holds what before using the pattern elsewhere." },
    { selector: "#replace-output", closest: ".rounded-xl", text: "A preview of the replacement applied to the sample text. Use dollar-one, dollar-two and so on to refer to capture groups." }
  ],

  "text-diff": [
    { selector: "#diff-output", closest: ".rounded-xl", text: "A line by line comparison. Lines that look identical but show as different usually differ in trailing whitespace or line endings, which are invisible on screen but real to the comparison." },
    { selector: "#ignore-space", closest: ".rounded-xl", text: "Ignore whitespace treats runs of spaces as equal, which removes most false differences between two copies of the same text. Word level narrows the highlight to the words that changed rather than marking the whole line." }
  ],

  "color-tools": [
    { selector: "#palette-output", closest: ".rounded-xl", text: "A scale of lighter and darker shades generated from one base colour, which is the usual starting point for a consistent theme." },
    { selector: "#contrast-ratio", closest: ".rounded-xl", text: "The contrast ratio between two colours, from 1 for identical to 21 for black on white. WCAG asks for at least 4.5 to 1 for normal body text and 3 to 1 for large text; the badges show which thresholds this pair passes." }
  ],

  "text-analyzer": [
    { selector: "#stat-words", closest: ".rounded-xl", text: "Counts taken from the text you paste. Nothing is sent anywhere." },
    { selector: "#stat-reading", closest: ".rounded-xl", text: "Estimated from word count at a typical reading speed. An approximation, not a measurement." },
    { selector: "#word-freq", closest: ".rounded-xl", text: "The most frequent words after normalising case, which is why a word capitalised at the start of a sentence is not counted separately from the same word mid-sentence." }
  ],

  "qr-generator": [
    { selector: "#panel-text", text: "Any text can be encoded, but a URL needs its full scheme, meaning https at the front, for a phone camera to open it as a link rather than showing it as plain text." },
    { selector: "#error-level", closest: ".rounded-xl", text: "Error correction decides how much of the code can be damaged or obscured and still scan. Higher levels survive more damage but make the code denser, which can make it harder to scan at small sizes." },
    { selector: "#cell-size", closest: ".rounded-xl", text: "How large each module is drawn, which sets the size of the downloaded image. A code that will not scan is usually too dense for its printed size; shortening the encoded text helps more than enlarging it." },
    { selector: "#panel-batch", text: "Turns a column from a loaded file into codes in bulk rather than one at a time." }
  ],

  "markdown-preview": [
    { selector: "#md-input", closest: ".rounded-xl", text: "Standard Markdown. It renders as you type and nothing is uploaded." },
    { selector: "#md-preview", closest: ".rounded-xl", text: "Rendered output passed through an allowlist sanitiser first. Only known-good tags and attributes survive and every event handler is dropped, which matters because the Markdown library does not sanitise its own output. Copy and Download hand you the sanitised version, so pasting a README from an untrusted source cannot carry a script through." }
  ],

  "encode-decode": [
    { selector: "#input-text", closest: ".rounded-xl", text: "Encoding is UTF-8 safe, so accented characters and other non-ASCII text survive a round trip instead of being mangled, which is the usual failure of a naive Base64 implementation." },
    { selector: "#output-text", closest: ".rounded-xl", text: "The operations chain, so you can Base64 encode and then URL encode the result in one place, which is what most token and query string formats expect." }
  ],

  "unit-converter": [
    { selector: "#from-value", closest: ".rounded-xl", text: "Conversion runs as you type, in both directions. Temperature is the exception to the usual arithmetic: it is an offset scale, so it is converted with the full formula rather than by multiplying, which is why doubling a Celsius value does not double the Fahrenheit one." },
    { selector: "#quick-reference", text: "The common conversions for the selected category, for when you want the number without typing anything." }
  ],

  "jwt-decoder": [
    { selector: "#token-input", closest: ".rounded-xl", text: "Decoding happens entirely in your browser and the token is not transmitted anywhere. Even so, a real token is a credential, so treat it with the same care as a password." },
    { selector: "#stat-status", closest: ".rounded-xl", text: "Decoded, not verified. The signature is never checked, so this proves what a token claims, not that it is genuine." },
    { selector: "#header-output", closest: ".rounded-xl", text: "The header says which algorithm the issuer claims to have used. Because the signature is not checked here, treat that as a claim rather than a fact." },
    { selector: "#payload-output", closest: ".rounded-xl", text: "The claims carried by the token. These are only Base64 encoded, not encrypted, so anyone holding the token can read them." },
    { selector: "#claims-card", text: "The registered claims spelled out: exp is when it expires, iat when it was issued, nbf the earliest it is valid, and sub who it is about. Shown as readable dates as well as raw numbers." }
  ]
};
