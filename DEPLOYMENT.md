# Hosting and Connected Mode migration

## Static application

The application remains framework-free HTML, CSS, and JavaScript. React/Next.js would add a rewrite and dependency cost without improving the existing local analysis workflows. Native CSS and Web Animations provide motion; Motion for React is not applicable to this stack.

Use Node 22+: `npm run dev`, `npm run build`, then `npm run start`. No install, credentials, or Wrangler is required. `serve.sh` delegates to the standard development command. `dist/` contains only public pages, tools, styles, scripts, dashboard fixtures and PWA assets. It excludes server source, SQL, tests, documentation, dotfiles, and secrets. The development server binds loopback and allows only application assets plus test modules. Production serves `dist/` only.

For Vercel, the included `vercel.json` specifies the build, output directory, and equivalent security headers. A generic static host can serve `dist/`; translate `_headers` if the host does not interpret it. Preserve existing `.html` and directory URLs. Root-domain hosting is the tested target. Static hosting does not supply the Connected API. No automatic deployment command is provided.

## Existing infrastructure retained

| Binding/service | Existing purpose | Migration requirement |
| --- | --- | --- |
| Worker `server/worker.js` | Same-origin `/api/*`, auth, authorization, scoped queries, audit, AI proxy | Adapt fetch handler to target runtime; preserve Request/Response, cookies, request IDs, authorization and no-store |
| `DB` / D1 `signal-noir` | Users, hashed sessions/tokens, memberships, access profiles, projects, artifacts, dataset metadata, audit, workflow records | Supply compatible `prepare().bind().first()/all()/run()` and `batch()` semantics; verify parameter binding, result metadata, atomicity and SQLite constraints |
| `R2` / bucket `signal-noir-datasets` | Dataset bytes accessed after project authorization | Implement `put/get`, content metadata/body semantics, checksums and storage-key compatibility; never expose buckets publicly |
| Preview database/bucket | Isolated test/preview resources | Keep preview isolated from production |
| `ASSETS` | Static asset fallthrough | Replaced for static hosting by `dist/`; retained API handler still expects this only for non-API fallthrough |
| `APP_ORIGIN`, `LOG_LEVEL` | Exact origin validation and logging | Set backend environment values for each deployment |
| AI endpoint/key, optional email configuration | Existing proxy and manual invitation/sign-in flow | Move secrets through host secret management; implement and verify delivery before enabling email |

No KV, Durable Objects, active cron triggers, or Cloudflare SDK dependencies were found. Wrangler configuration was removed from the checkout. This does not delete or change any cloud resources. Existing backend implementation and migrations remain intact. The static application probes `/api/health` and can use an existing same-origin API; a new host needs a reviewed proxy or backend adapter. No proxy target is guessed or configured here.

## Approved migration sequence required before connected production

1. Inventory the existing deployment and confirm authoritative database/bucket identifiers in the provider console. Take verified backups without modifying live data.
2. Implement a compatible database/object-storage adapter in an isolated environment, including query result and transaction semantics. Preserve all organization/team/project rules, schema constraints, session revocation, token hashing, CSRF and last-administrator protection.
3. Run query and Worker integration suites against the adapter. Verify dataset uploads/downloads, concurrency/revision checks, sign-in, invitations, search, permissions, audit and secret isolation.
4. Obtain explicit approval for production export/import. Copy database and object bytes, verify row counts, foreign keys, hashes, historical versions and permissions. Keep the source resources and a rollback plan.
5. Obtain approval for a deployment and any DNS or origin changes. Rehearse rollback and session-cookie behavior before cutover.

The backend adapter, data migration, live sign-in/invitation delivery, and production deployment are outstanding. Local Studio still uses browser projects, as before; Connected Studio integration was already incomplete. This update must not be described as fully production-ready Connected Mode.
