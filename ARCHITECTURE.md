# Signal Noir — architecture

A short map of how the pieces fit. The README explains what the product does;
this explains how it is built and where the boundaries are. Written to stay
true as the code changes, so it names structures rather than line numbers.

## Shape

Static files. No build step, no framework, no bundler, no dependencies to
install. Every page is plain HTML that loads shared modules in order, and each
module attaches itself to one `window.SignalNoir` namespace.

    tools/shared/     services used by every page
    tools/studio/     the workspace (Studio) and its views
    tools/<tool>/     26 standalone utilities
    site/             the public pages (home, tools, library, organization, settings)
    server/           the optional Connected Mode Worker (see server/DECISIONS.md)
    tests/            ten in-browser suites, no runner required

Load order matters and is the same everywhere:

    theme → catalog → projects-store → resilience → access → access-ui
          → artifacts → project-service → operations → connected → platform
          → page script

`resilience.js` loads early on purpose: it installs the error boundary before
anything that can throw.

## The layers

| Module | Owns |
|---|---|
| `catalog.js` | The single list of tools, categories, navigation, intents, templates |
| `access.js` | Organizations, teams, access profiles, capabilities, project access |
| `artifacts.js` | The project artifact model, lineage, activity, comments |
| `project-service.js` | Projects as a whole: creation, templates, duplication, export/import |
| `operations.js` | Workflows, automations, runs, monitors, alerts, the attention inbox |
| `analysis-engine.js` | Every calculation. Deterministic, no model involved |
| `platform.js` | Navigation, command palette, hand-off between tools and Studio |
| `resilience.js` | Error boundary, failure descriptions, development logging |
| `connected.js` | The optional Connected Mode client: session, organizations, repositories |

Studio views (`tools/studio/*.js`) render these services. They do not own
data. Vanessa (`tools/studio/vanessa/*.js`) drives the same services the UI
does, so there is one storage path and one definition of what a project
contains.

## Data model

    ORGANIZATION → PROJECT → DATA → ANALYSIS → FINDINGS → OUTPUTS
                                              → DECISIONS → TASKS → ACTIVITY
                           → WORKFLOW → AUTOMATION → RUN → ALERTS

A **project** is the durable container. **Artifacts** (finding, chart,
dashboard, report, workflow, decision, task, dataset) are a *view* projected
over the collections a project already had, with writes routed back to
whichever collection each type lives in. That is why old projects gain the
new model the moment they are read, and why nothing had to be migrated away.

`artifact` is an internal umbrella term. Users see "work", "findings",
"reports" — never "artifact registry".

## Storage

Everything is local to the browser.

| Store | Holds |
|---|---|
| IndexedDB `datahub_studio` | Projects, and everything inside them |
| IndexedDB `datahub_workspace` | The shared file passed between tools |
| localStorage `sn_access_v1` | Organizations, teams, profiles, memberships |
| localStorage (prefs) | Theme, motion, Studio mode, provider choice, favourites |
| sessionStorage | Tool → Studio hand-off, "preview as profile" |

Schema versions are applied in memory when a record is read, not by a
migration pass, so an older record is repaired rather than rewritten:

- `normalizeProject` (Studio) — project schema **v4**
- `artifacts.shape` — project metadata, links, activity, dataset versions
- `operations.shape` — workflows, automations, runs, monitors, alerts
- `access.normalizeState` — organization state **v1**

Every one of them is total: malformed, partial and unknown values are
repaired or dropped, never thrown on. Broken JSON yields empty state rather
than a locked-out app.

**Saving can fail.** `saveProject` returns `{ ok }`, keeps the project dirty
on failure, distinguishes quota from blocked storage, and surfaces "Save
failed" until a later save succeeds. A failed save never reads as "Saved".

**Retention.** Run detail is kept for the 30 most recent runs and summarized
after that (capped at 200). Alerts cap at 300, activity at 120. Nothing
important is deleted silently.

## Vanessa

    request → route → plan → run each tool → observe → adapt → respond

`router` (patterns and scores) → `planner` (recipes into steps) →
`executor` (runs registry tools, one at a time, cancellable). Every tool is
described as data in `registry.js` and carries the same capability as the
equivalent button elsewhere, so Vanessa can never reach something the UI
would refuse.

Numbers always come from `analysis-engine.js`. A language model is optional
and only ever routes unclear requests or writes clearly-labelled
interpretations. **Dataset rows are never sent to a model** — schema and
calculated aggregates only.

## Permissions

    ORGANIZATION → TEAM → ACCESS PROFILE → CAPABILITIES
    USER → MEMBERSHIP → TEAM MEMBERSHIP → EFFECTIVE CAPABILITIES

    effective = member profile ∪ team profiles + grants − restrictions

Restrictions are applied last and always win. The personal workspace has
every capability and needs no setup.

Capability answers *what kind of action*; project access answers *where*.
Both are enforced in the **service layer** — `artifacts.list/get/search`,
`projectService.visible`, `operations.attention`, `projects.recentWork` all
refuse projects the current member cannot reach — not only in the views.

## Local versus connected

| Works now | Needs a server |
|---|---|
| All analysis, all 26 tools | Unattended scheduled runs |
| Projects, findings, reports, dashboards | Real multi-user sharing |
| Workflows run manually, on import, on a met condition | Email/chat delivery |
| Local schedules **while Studio is open** | Cross-device sync |
| Local models (Ollama, Chrome) | Cloud AI providers |

Anything in the right column is labelled in the interface and never claims to
have happened. A local schedule that comes due while Signal Noir is closed is
recorded as a **missed run** with no outputs.

## Two modes

Signal Noir has two real operating modes, and neither is a degraded version
of the other.

**Local Mode** is the default and needs no account, no network and no server.
Projects live in this browser. This is the whole product for one person.

**Connected Mode** is optional. Signing in adds an organization, shared
projects and — the part that matters — a trusted server that decides what you
may see. It is described in `server/DECISIONS.md` and operated per
`server/README.md`.

A local project is never uploaded by anything. Moving one into an
organization is an explicit act that copies rather than moves, and the local
original stays until the person removes it themselves.

## Security boundary

**Read this before relying on access control.**

There are now two boundaries, and the difference between them is the whole
point:

| | Decides | Trust |
|---|---|---|
| `tools/shared/access.js` | what the interface shows | **None.** It runs in the browser, on code the viewer controls. |
| `server/lib/authorize.js` | what the API returns | **This is the boundary.** |

In **Local Mode** there is no server and nothing to protect from: the data is
already on the person's own device. The capability model shapes the interface
and that is all it claims to do.

In **Connected Mode** every request is decided by the Worker. Identity comes
from a session cookie; organization, membership, role and capabilities are
read from the database using that identity. Nothing the client asserts about
who it is or what it may do is read. The rule is **default deny**, and no
resource is ever fetched by id alone — every query joins through the
requesting user's membership, so an inaccessible row is not filtered out
afterwards, it is never selected. A denied project answers exactly like a
project that does not exist, because confirming an id exists is itself a
disclosure.

**The frontend checks have not been removed and should not be.** One decides
what to show; the other decides what to return. Neither replaces the other.

`server/README.md` lists precisely which parts of the product the server
currently protects and which are still frontend-only. That table is the
honest answer to "is this secure yet", and it is shorter than the product.

No compliance claim is made or implied.

What *is* handled today:

- Uploaded files are treated as untrusted: parsed, never executed.
- All rendered user and imported content is escaped; no `eval`, no
  `new Function`, no `document.write`.
- CSV export neutralises spreadsheet formula prefixes (`=`, `+`, `-`, `@`).
- No API keys anywhere in client code. Cloud providers are unavailable
  precisely because a browser cannot hold a key safely.
- Project bundles exclude connection configs, chat credentials and caches,
  and are validated as inert data on import.

## Errors

`SignalNoir.errors.describe(error)` returns `{ code, title, message,
recovery }`. Users see the title and message; stack traces stay in the
expandable technical details of the recovery screen. `errors.log` records
operation, ids and timing — never dataset contents, and only when debug
logging is on.

A fatal error shows a recovery screen that states plainly that locally saved
projects have not been deleted, and offers reload, home, and copy details.

## Testing

Ten in-browser suites, no runner. Open them from `./serve.sh`:

    tests/connected.test.html      authorization, capability registry, validation
    tests/worker.test.html         the real Worker, end to end (needs the D1 shim)
    tests/resilience.test.html     failure handling, escaping, CSV safety, vocabulary
    tests/operations.test.html     conditions, runs, automations, monitors, alerts
    tests/projects.test.html       artifacts, lineage, export/import, access boundary
    tests/access.test.html         capabilities, profiles, teams, preview, precedence
    tests/vanessa.test.html        routing, planning, execution, evidence
    tests/studio.test.html         analysis engine, catalog, workflow and evidence UI
    tests/shared.test.html         parsing, SQL, statistics, matching, flattening
    tests/data-analyzer.test.html  the Data Analyzer engine

The server also has a suite that needs no browser and no Wrangler, because
D1 is SQLite:

    python3 server/tests/test_queries.py    scoped queries against real SQLite

`tests/worker.test.html` drives the actual `server/worker.js` against a real
database through `server/tests/d1_server.py`; start that shim first.

## Deployment

Static hosting. `service-worker.js` is network-first (a deploy is picked up
immediately) with the cache as the offline fallback; bump `CACHE` when shipping
so old clients do not keep stale scripts. Nothing user-created is ever cached as
a public asset — projects live in IndexedDB, which the service worker does not
touch.

`404.html` is cached and served for unknown navigations. It is the only page
that uses root-anchored (`/…`) paths: a host serves it for a URL at any depth
while the document URL stays at the address that was requested, so relative
paths would resolve against the wrong directory and the page would arrive
unstyled with broken links. **This means Signal Noir must be served from a
domain root, not a subdirectory.** Every other page is fully relative and will
run from any location, including `file://`.
