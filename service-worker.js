const CACHE = "signal-noir-v5-0";
const TOOL_IDS = ["chart-builder","code-helper","color-tools","column-stats","converter","dashboard-builder","data-analyzer","data-cleaner","data-generator","encode-decode","file-diff","fuzzy-dupes","instant-dashboard","json-formatter","jwt-decoder","lookup-merge","markdown-preview","pivot-explorer","qr-generator","regex-tester","sql-workbench","stat-tests","text-analyzer","text-diff","timestamp-converter","unit-converter"];
const SHARED_ASSETS = ["resilience.js","connected.js","access.js","access-ui.js","artifacts.js","project-service.js","operations.js","analysis-engine.js","catalog.js","dashboard-data.js","dashboard-parse.js","dashboard-render.js","dashboard-spec.js","definitions-data.js","definitions.js","design-system.css","evidence-ui.js","flatten.js","match.js","parse.js","platform.css","platform.js","profile.js","projects-store.js","sanitize.js","sheet-connect.js","sheet-input.js","sql.js","stats.js","theme.js","vanessa-knowledge.js","vanessa-providers.js","vanessa.js","viz.js","workflow-ui.js","workspace.js"];
const STUDIO_ASSETS = ["index.html","studio.css","project-home.css","ops-view.css","source-guide.css","intelligence.css","analyst.css","collaboration.css","operations.css","experience.css","evidence.css","pulse.css","command-center.css","portfolio.css","studio-skin.css","studio-shell.css","studio.js","project-home.js","ops-view.js","intelligence.js","analyst.js","collaboration.js","operations.js","experience.js","evidence.js","pulse.js","command-center.js","portfolio.js","demo-project.js","studio-shell.js"];
const CORE = [
  "./",
  "./index.html",
  "./404.html",
  "./connect.html",
  "./library.html",
  "./organization.html",
  "./settings.html",
  "./getting-started.html",
  "./dashboards.html",
  "./manifest.webmanifest",
  "./signal-noir-icon.svg",
  "./tailwind.css",
  "./signal-pages.css",
  "./site/site.css",
  "./site/site-ui.js",
  "./site/home.js",
  "./site/tool-library.js",
  "./site/library.js",
  "./site/organization.js",
  "./site/settings.js",
  "./tools/index.html",
  "./tools/code-helper/code-helper.css"
];
const VANESSA_ASSETS = ["vanessa.css","context.js","findings.js","registry.js","tools-prepare.js","tools-analyze.js","tools-build.js","router.js","planner.js","executor.js","cards.js","workspace.js"];
CORE.push(
  ...VANESSA_ASSETS.map(name => `./tools/studio/vanessa/${name}`),
  ...TOOL_IDS.map(id => `./tools/${id}/index.html`),
  ...SHARED_ASSETS.map(name => `./tools/shared/${name}`),
  ...STUDIO_ASSETS.map(name => `./tools/studio/${name}`)
);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});


self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const navigation = event.request.mode === "navigate";
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && url.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request, { ignoreSearch: navigation });
      if (cached) return cached;
      if (navigation) return (await caches.match("./404.html")) || caches.match("./index.html");
      return new Response("Signal Noir is offline and this asset is not cached yet.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })
  );
});
