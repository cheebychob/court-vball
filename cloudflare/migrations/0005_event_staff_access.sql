PRAGMA foreign_keys = ON;

CREATE TABLE event_staff_events (
  owner_scope TEXT NOT NULL,
  event_id TEXT NOT NULL,
  access_epoch INTEGER NOT NULL DEFAULT 1
    CHECK (access_epoch >= 1),
  revision INTEGER NOT NULL DEFAULT 1
    CHECK (revision >= 1),
  event_json TEXT NOT NULL,
  games_json TEXT NOT NULL DEFAULT '[]',
  participants_json TEXT NOT NULL DEFAULT '[]',
  matches_json TEXT NOT NULL DEFAULT '[]',
  deleted_game_ids_json TEXT NOT NULL DEFAULT '{}',
  staff_score_match_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (owner_scope, event_id)
);

CREATE INDEX idx_event_staff_events_owner_updated
ON event_staff_events(owner_scope, updated_at DESC, event_id);

CREATE TABLE event_staff_grants (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_access_epoch INTEGER NOT NULL
    CHECK (event_access_epoch >= 1),
  token_hash TEXT NOT NULL UNIQUE,
  pin_salt TEXT,
  pin_hash TEXT,
  pin_iterations INTEGER,
  staff_label TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('viewOnly', 'scorekeeper', 'tournamentOperator')),
  permission_schema_version INTEGER NOT NULL DEFAULT 1
    CHECK (permission_schema_version >= 1),
  permissions_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_used_at INTEGER,
  CHECK (
    (pin_salt IS NULL AND pin_hash IS NULL AND pin_iterations IS NULL) OR
    (pin_salt IS NOT NULL AND pin_hash IS NOT NULL AND pin_iterations IS NOT NULL)
  ),
  CHECK (expires_at > created_at),
  FOREIGN KEY (owner_scope, event_id)
    REFERENCES event_staff_events(owner_scope, event_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

CREATE INDEX idx_event_staff_grants_event
ON event_staff_grants(owner_scope, event_id, created_at DESC);

CREATE INDEX idx_event_staff_grants_active
ON event_staff_grants(owner_scope, event_id, revoked_at, expires_at);

CREATE TABLE event_staff_sessions (
  session_hash TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  owner_scope TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_access_epoch INTEGER NOT NULL
    CHECK (event_access_epoch >= 1),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (expires_at > created_at),
  FOREIGN KEY (grant_id)
    REFERENCES event_staff_grants(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

CREATE INDEX idx_event_staff_sessions_grant
ON event_staff_sessions(grant_id, revoked_at, expires_at);

CREATE INDEX idx_event_staff_sessions_event
ON event_staff_sessions(owner_scope, event_id, event_access_epoch);

CREATE INDEX idx_event_staff_sessions_retention
ON event_staff_sessions(expires_at, revoked_at);

CREATE TABLE event_staff_idempotency (
  owner_scope TEXT NOT NULL,
  event_id TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  resulting_revision INTEGER NOT NULL
    CHECK (resulting_revision >= 1),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_scope, event_id, grant_id, idempotency_key),
  FOREIGN KEY (grant_id)
    REFERENCES event_staff_grants(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

CREATE INDEX idx_event_staff_idempotency_retention
ON event_staff_idempotency(owner_scope, event_id, created_at DESC);

CREATE TABLE event_staff_audit (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL,
  event_id TEXT NOT NULL,
  grant_id TEXT,
  staff_label TEXT NOT NULL,
  role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  previous_json TEXT,
  new_json TEXT,
  resulting_revision INTEGER,
  idempotency_key TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('owner', 'online', 'queued')),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_event_staff_audit_event
ON event_staff_audit(owner_scope, event_id, created_at DESC, id DESC);

CREATE TABLE event_staff_rate_limits (
  scope_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope_hash, window_start)
);

CREATE INDEX idx_event_staff_rate_limits_updated
ON event_staff_rate_limits(updated_at);
