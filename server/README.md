# Connected Mode — operating the server

`DECISIONS.md` explains why this architecture. This explains how to run it,
and — more importantly — exactly how much of Signal Noir it currently
protects.

## What is actually enforced today

This is the part to read before trusting anything.

| Area | Where it is decided | Trustworthy? |
|---|---|---|
| Who you are | Session cookie → `sessions` table | **Yes** |
| Organization membership | `organization_memberships`, joined into every query | **Yes** |
| Capabilities | `authorize()` in the Worker | **Yes** |
| Project access | Query-level join; no fetch by id alone | **Yes** |
| Dataset download | `/api/datasets/:id/content`, re-checked per request | **Yes** |
| Search results | Scoped inside the SQL | **Yes** |
| Audit trail | `audit_events`, append-only, survives deletion | **Yes** |
| Last-administrator protection | Server-side check | **Yes** |
| **Local Mode projects** | Browser only | **Not applicable** — they never leave the device |
| **Studio's own views** | Browser | **No** — UX only |
| **Local organization prototypes** | localStorage | **No** — a prototype, clearly labelled |
| **Vanessa's tool gating** | Browser | **Partly** — see below |

**Vanessa** runs in the browser and drives local analysis. In Connected Mode
she can only reach connected data through the same API as everything else, so
the server bounds what she can retrieve. Her *tool list* is still filtered
client-side, which shapes what she offers but is not a security boundary. A
person cannot use her to read a project the server would refuse.

**The frontend permission system has not been removed and should not be.** It
decides what to show. The server decides what to return. Both are needed;
neither replaces the other.

## What is not built

Named plainly so nobody assumes otherwise:

- **No background execution.** The `automations` and `workflow_runs` tables
  exist and carry an execution identity, but no cron trigger is declared and
  no scheduler runs. Nothing executes while the browser is closed. A scheduler would require separate implementation and validation.
- **No real-time collaboration.** No Durable Objects, no websockets. Shared
  projects are read on request.
- **No email.** Sign-in and invitation links are shown to be copied, and the
  interface says so.
- **No connected Studio.** The Worker serves projects, artifacts, comments,
  activity, datasets and search. Studio still reads and writes local projects;
  wiring its views to `connectedRepository` is the next slice.
- **No compliance certification of any kind.**

## Local workflow and deployment

The root `npm run dev`, `npm run build`, and `npm run start` commands serve the static application without Cloudflare tooling. The local server returns an explicit unavailable response for `/api/`; it never impersonates a signed-in backend.

The existing fetch handler and SQL migration are retained for Connected Mode. A backend adapter and an approved data migration are required before hosting that API outside Cloudflare. See [DEPLOYMENT.md](../DEPLOYMENT.md) for the infrastructure inventory and migration steps. No production resources have been changed.

## Environment variables

| Name | Kind | Purpose |
|---|---|---|
| `APP_ORIGIN` | var | Origins allowed to make state-changing requests. Comma separated, exact match. Empty rejects every mutation. |
| `LOG_LEVEL` | var | `info`, `debug` or `silent` |
| `AI_PROVIDER_URL` | **secret** | Organization model endpoint |
| `AI_PROVIDER_KEY` | **secret** | Provider key. Never reaches a browser. |
| `EMAIL_PROVIDER` | **secret** | Unset today; links are shown instead |

Configure secrets in the chosen backend host's secret store. Never expose them through frontend configuration. The frontend discovers the same-origin API through `/api/health`. Preserve exact `APP_ORIGIN` matching when moving hosts.

## Migrations

Numbered files in `server/migrations`, applied in order, tracked in
`schema_migrations`. They are forward-only and additive. A migration that
would drop or rewrite a column needs a copy-verify-switch pair of migrations
instead, so a failure never destroys data.

Because D1 is SQLite, the schema can be checked without deploying anything:

```bash
sqlite3 /tmp/check.db < server/migrations/0001_init.sql
python3 server/tests/test_queries.py
```

## Testing

```bash
python3 server/tests/test_queries.py     # scoped queries, real SQLite
```

Plus `tests/connected.test.html` in a browser, which imports the real server
modules and attacks `authorize()` directly.

Neither needs Wrangler, a deployment or a network.

## Backups

D1 provides point-in-time recovery through Cloudflare; use
the existing provider backup controls to inspect or restore. R2 objects are not
versioned by default — enable object versioning on the bucket if dataset
history matters beyond the `dataset_versions` rows, which record checksums
but do not themselves preserve the bytes.

No custom backup system exists, deliberately.

## Retention

What the system does today, with no guarantees implied:

- Sessions expire after 14 days; revoked ones stay as rows.
- Sign-in tokens expire after 15 minutes and are single-use.
- Invitations expire after 7 days.
- Deleted projects are soft-deleted and retain their rows.
- Audit events are never deleted and outlive the organization.
- `rate_events` are pruned beyond 24 hours.

Nothing is automatically purged. Hard deletion is not implemented.

## Security headers

The Worker sets `no-store`, `nosniff` and `same-origin` referrer on API
responses, and serves dataset downloads as sandboxed attachments.

The static site's headers belong to the hosting layer — see `_headers` at the
repository root.
