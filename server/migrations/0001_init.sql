













PRAGMA foreign_keys = ON;

/* ---------------------------------------------------------------- *
 * Identity
 * ---------------------------------------------------------------- */

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  email_lower   TEXT NOT NULL UNIQUE,      -- lookups are case-insensitive
  display_name  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),
  created_at    INTEGER NOT NULL,
  last_active_at INTEGER,
  preferences   TEXT NOT NULL DEFAULT '{}'
);


CREATE TABLE auth_tokens (
  id          TEXT PRIMARY KEY,
  email_lower TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  purpose     TEXT NOT NULL DEFAULT 'sign-in'
              CHECK (purpose IN ('sign-in', 'invitation')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX idx_auth_tokens_email ON auth_tokens (email_lower, expires_at);


CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at  INTEGER,
  user_agent  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_sessions_user ON sessions (user_id, expires_at);

/* ---------------------------------------------------------------- *
 * Organizations
 * ---------------------------------------------------------------- */

CREATE TABLE organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'suspended')),
  timezone   TEXT NOT NULL DEFAULT 'UTC',
  settings   TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL
);



CREATE TABLE access_profiles (
  id             TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  key            TEXT NOT NULL,            -- 'analyst', 'administrator', custom slug
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  builtin        INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE (organization_id, key)
);

CREATE TABLE access_profile_capabilities (
  profile_id    TEXT NOT NULL REFERENCES access_profiles (id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL,
  PRIMARY KEY (profile_id, capability_id)
);

CREATE TABLE organization_memberships (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  org_role        TEXT NOT NULL DEFAULT 'member'
                  CHECK (org_role IN ('member', 'administrator')),
  access_profile_id TEXT REFERENCES access_profiles (id) ON DELETE SET NULL,
  joined_at       INTEGER,
  invited_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_memberships_user ON organization_memberships (user_id, status);


CREATE TABLE membership_capability_overrides (
  membership_id TEXT NOT NULL REFERENCES organization_memberships (id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL,
  effect        TEXT NOT NULL CHECK (effect IN ('grant', 'restrict')),
  PRIMARY KEY (membership_id, capability_id, effect)
);

CREATE TABLE teams (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  access_profile_id TEXT REFERENCES access_profiles (id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_teams_org ON teams (organization_id);

CREATE TABLE team_memberships (
  id         TEXT PRIMARY KEY,
  team_id    TEXT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (team_id, user_id)
);
CREATE INDEX idx_team_memberships_user ON team_memberships (user_id);

CREATE TABLE invitations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email_lower     TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  access_profile_id TEXT REFERENCES access_profiles (id) ON DELETE SET NULL,
  team_id         TEXT REFERENCES teams (id) ON DELETE SET NULL,
  org_role        TEXT NOT NULL DEFAULT 'member'
                  CHECK (org_role IN ('member', 'administrator')),
  invited_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  consumed_at     INTEGER,
  consumed_by     TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_invitations_org ON invitations (organization_id, email_lower);

/* ---------------------------------------------------------------- *
 * Projects
 * ---------------------------------------------------------------- */



CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived', 'deleted')),
  visibility      TEXT NOT NULL DEFAULT 'members'
                  CHECK (visibility IN ('members', 'organization')),
  owner_team_id   TEXT REFERENCES teams (id) ON DELETE SET NULL,
  created_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1,   -- optimistic concurrency
  archived_at     INTEGER,
  deleted_at      INTEGER,
  migrated_from   TEXT,                          -- local project id, if migrated
  settings        TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_projects_org ON projects (organization_id, status);

CREATE TABLE project_memberships (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer'
             CHECK (role IN ('owner', 'editor', 'contributor', 'viewer')),
  granted_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_project_memberships_user ON project_memberships (user_id);

CREATE TABLE project_team_access (
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  team_id    TEXT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer'
             CHECK (role IN ('owner', 'editor', 'contributor', 'viewer')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, team_id)
);

/* ---------------------------------------------------------------- *
 * Data
 * ---------------------------------------------------------------- */

CREATE TABLE datasets (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  current_version_id TEXT          -- resolved to dataset_versions.id
);
CREATE INDEX idx_datasets_project ON datasets (project_id);


CREATE TABLE dataset_versions (
  id              TEXT PRIMARY KEY,
  dataset_id      TEXT NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
  version_no      INTEGER NOT NULL,
  r2_key          TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL DEFAULT '',
  content_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
  byte_size       INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  row_count       INTEGER,
  column_count    INTEGER,
  uploaded_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  uploaded_at     INTEGER NOT NULL,
  UNIQUE (dataset_id, version_no)
);

/* ---------------------------------------------------------------- *
 * Work produced in a project
 * ---------------------------------------------------------------- */



CREATE TABLE artifacts (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN ('finding', 'chart', 'dashboard', 'report',
                              'workflow', 'decision', 'task', 'dataset')),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '{}',     -- type-specific JSON
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'archived')),
  created_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  assigned_to TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  revision    INTEGER NOT NULL DEFAULT 1,     -- optimistic concurrency
  archived_at INTEGER
);
CREATE INDEX idx_artifacts_project ON artifacts (project_id, type, status);

CREATE TABLE artifact_sources (
  artifact_id TEXT NOT NULL REFERENCES artifacts (id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('artifact', 'dataset_version')),
  source_id   TEXT NOT NULL,
  recovered   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artifact_id, source_type, source_id)
);

CREATE TABLE comments (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  artifact_id TEXT REFERENCES artifacts (id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_comments_project ON comments (project_id, created_at);


CREATE TABLE activity_events (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  verb        TEXT NOT NULL,
  object_type TEXT NOT NULL DEFAULT '',
  object_id   TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_activity_project ON activity_events (project_id, created_at);

/* ---------------------------------------------------------------- *
 * Audit — administrative and security history
 * ---------------------------------------------------------------- */



CREATE TABLE audit_events (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_id        TEXT,
  actor_email     TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL DEFAULT '',
  entity_id       TEXT NOT NULL DEFAULT '',
  detail          TEXT NOT NULL DEFAULT '',
  request_id      TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_audit_org ON audit_events (organization_id, created_at);

/* ---------------------------------------------------------------- *
 * Organization AI policy
 * ---------------------------------------------------------------- */

CREATE TABLE organization_ai_policy (
  organization_id  TEXT PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  mode             TEXT NOT NULL DEFAULT 'local-only'
                   CHECK (mode IN ('local-only', 'remote-allowed')),
  allowed_providers TEXT NOT NULL DEFAULT '[]',
  allowed_models   TEXT NOT NULL DEFAULT '[]',
  share_level      TEXT NOT NULL DEFAULT 'schema'
                   CHECK (share_level IN ('schema', 'aggregates', 'row-samples')),
  max_request_bytes INTEGER NOT NULL DEFAULT 131072,
  updated_at       INTEGER NOT NULL,
  updated_by       TEXT REFERENCES users (id) ON DELETE SET NULL
);

/* ---------------------------------------------------------------- *
 * Background execution — schema only.
 *
 * These tables exist so automation has somewhere to live and so run
 * history has a shape. Nothing executes them in this pass; the scheduler
 * is not activated. See server/README.md.
 * ---------------------------------------------------------------- */

CREATE TABLE workflows (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '{}',
  version    INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_workflows_project ON workflows (project_id);

CREATE TABLE automations (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  workflow_id      TEXT NOT NULL REFERENCES workflows (id) ON DELETE CASCADE,
  workflow_version INTEGER NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  trigger          TEXT NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'active', 'paused')),


  run_as_user_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_by       TEXT REFERENCES users (id) ON DELETE SET NULL,
  next_run_at      INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX idx_automations_due ON automations (status, next_run_at);

CREATE TABLE workflow_runs (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  workflow_id   TEXT REFERENCES workflows (id) ON DELETE SET NULL,
  automation_id TEXT REFERENCES automations (id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'succeeded', 'failed',
                                  'cancelled', 'missed', 'waiting-approval')),
  trigger_kind  TEXT NOT NULL DEFAULT 'manual',
  ran_as_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  scheduled_for INTEGER,
  started_at    INTEGER,
  finished_at   INTEGER,
  error_code    TEXT,
  outputs       TEXT NOT NULL DEFAULT '[]',
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_runs_project ON workflow_runs (project_id, created_at);

/* ---------------------------------------------------------------- *
 * Migration bookkeeping
 * ---------------------------------------------------------------- */

CREATE TABLE schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

INSERT INTO schema_migrations (version, applied_at)
VALUES ('0001_init', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
