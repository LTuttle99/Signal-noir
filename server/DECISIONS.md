# Connected Mode — architecture decision record

Status: accepted, partially implemented.
Date: 2026-09-23.

## The decision in one line

Cloudflare Workers + D1 + R2, same origin as the static site, with opaque
server-issued session cookies and email magic-link sign-in. No new frontend
framework, no build step, no runtime dependencies.

## What was already here

An audit of the repository before this pass found **no backend of any kind**:
no `package.json`, no `wrangler.toml`, no functions directory, no API routes,
no migrations, no environment configuration, no authentication.

Three things looked like backend and are not:

| Looks like | Actually is |
|---|---|
| `@supabase/supabase-js` in Studio | A **user-supplied** Realtime chat room. The person pastes their *own* Supabase URL and anon key for a project chat channel. It stores no Signal Noir data, has no identity model, and authenticates nobody. |
| `vanessa-providers.js` remote entry | A provider listed as `planned`, deliberately unavailable, with a comment saying it needs a server proxy first. |
| `access.js` capabilities | A real and well-shaped permission model that runs **entirely in the browser**, so it is product behaviour, not security. |

So Connected Mode starts from zero rather than from a half-built server. That
is the main reason the design below is small.

## Chosen components

| Component | Role | Why |
|---|---|---|
| **Cloudflare Workers** | The API, at `/api/*` | The site is static and already served from a CDN edge. A Worker on the **same origin** means session cookies are first-party and CORS is not needed at all — which removes a whole category of mistakes. |
| **D1** | Identity, organizations, teams, profiles, projects, access, artifacts metadata, audit | The data is unambiguously relational — memberships and access are joins. D1 is SQLite, so the schema is testable locally with `sqlite3` and needs no running service. |
| **R2** | Uploaded dataset objects | Large files do not belong in a relational database. R2 has no per-operation cost cliff and supports private buckets reached only through an authenticated Worker route. |

## Deliberately not chosen

Picking a service has a permanent cost, so each of these was rejected on purpose.

- **Durable Objects** — only justified by real-time coordination. This pass
  deliberately does not implement live multi-user editing, so a DO would be an
  unused moving part. Revisit when presence or live cursors are actually built.
- **KV** — D1 already answers every lookup here, and KV's eventual consistency
  is the wrong shape for authorization, where a stale read is a security bug.
- **Queues / Cron** — the *schema and interfaces* for background runs are
  included, but neither is activated. Turning them on without a way to test
  execution would recreate exactly the fake-background-execution problem that
  an earlier pass removed.
- **Supabase / Postgres** — adopting Supabase Auth would mean a second identity
  system alongside the BYO-Supabase chat already in Studio, on a different
  origin, with its own SDK loaded from a CDN. The relational needs here are
  modest and D1 covers them without adding a vendor or a dependency.

## Identity and sessions

**Email magic link. No passwords, ever.**

Signal Noir never stores a password, so it cannot leak one. This also removes
the need for password hashing, strength rules, reset flows and breach
monitoring — a large amount of security surface that buys nothing here.

    sign-in request → 32-byte random token → SHA-256 stored in D1
                    → link delivered (or displayed, see below)
                    → token verified, single-use, 15-minute expiry
                    → session created → opaque cookie

Sessions are **opaque random tokens**, not JWTs. The server stores only the
SHA-256 hash, so a database leak does not hand over live sessions, and a
session can be revoked instantly — which a stateless JWT cannot do.

The cookie is `HttpOnly; Secure; SameSite=Lax; Path=/`. `HttpOnly` means XSS
cannot read it. `SameSite=Lax` blocks cross-site form posts. State-changing
requests additionally require an `Origin` header match.

**Email is not configured.** Rather than pretend, the sign-in response returns
a link for the administrator to copy, and says plainly that automated delivery
is not set up. `EMAIL_PROVIDER` is the documented hook for when it is.

## Where authorization happens

    Browser (access.js)  →  shapes the UI.      Not security.
    Worker  (authorize)  →  decides.            This is the boundary.

The rule is **default deny**. Every resource lookup goes through a query that
joins to the requesting user's membership; nothing is fetched by id alone.
The client's claims about who it is, what organization it is in, or what it may
do are never read — identity comes from the session cookie and everything else
is derived server-side from that.

One shared capability list (`server/shared/capabilities.js`) is the single
source of truth, consumed by the Worker and mirrored into the browser registry,
with a test that fails if the two drift.

## Where things live

| Thing | Local Mode | Connected Mode |
|---|---|---|
| Identity | none needed | D1 `users` |
| Organizations, teams, profiles | localStorage `sn_access_v1` | D1 |
| Projects | IndexedDB `datahub_studio` | D1 metadata + R2 objects |
| Datasets | IndexedDB | R2, private, authenticated route |
| Analysis | browser | browser (unchanged) |
| AI | on-device only | on-device, or org provider via Worker proxy |

**Local projects stay local.** Nothing is uploaded unless the person explicitly
migrates a project, and migration copies rather than moves: the local original
remains until they remove it themselves.

## Analysis stays in the browser

A connected project fetches the data the person is permitted to see and then
analyses it **on the device**, exactly as Local Mode does. The server stores
and authorizes; it does not compute. This keeps the deterministic analysis
engine as the single implementation, avoids shipping a second copy of every
calculation, and means connected work is as private as the permission model
allows.

Background automation is the one case that will eventually need server-side
execution, which is why the run tables exist and the execution path does not.

## AI

On-device providers are unchanged and remain the default. An organization may
configure a provider whose key lives in Worker secrets and is never sent to a
browser:

    browser → Worker (verifies identity, project access, vanessa.use,
                      org AI policy, request size, allowed model)
            → provider

Dataset rows are still never sent. Schema and calculated aggregates only.

## What this does not claim

Client-side checks remain useful UX and remain untrusted. The Worker is the
boundary, and only for the resources actually moved to it — which, after this
pass, is the vertical slice and not the whole product. `server/README.md`
lists precisely what is enforced and what is still frontend-only.

No compliance claim is made or implied.
