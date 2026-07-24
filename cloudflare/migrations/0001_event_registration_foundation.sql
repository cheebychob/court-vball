PRAGMA foreign_keys = ON;

CREATE TABLE event_registration_configs (
  event_id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_format TEXT NOT NULL CHECK (event_format IN ('fixedTeams', 'rotatingGroups')),
  entry_size INTEGER,
  team_size INTEGER,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  event_available INTEGER NOT NULL DEFAULT 1 CHECK (event_available IN (0, 1)),
  mode TEXT NOT NULL CHECK (mode IN ('disabled', 'team', 'individual')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'open', 'closed', 'cancelled')),
  opens_at INTEGER,
  closes_at INTEGER,
  active_player_capacity INTEGER CHECK (active_player_capacity IS NULL OR active_player_capacity >= 1),
  allow_substitutes INTEGER NOT NULL DEFAULT 1 CHECK (allow_substitutes IN (0, 1)),
  max_substitutes_per_team INTEGER CHECK (max_substitutes_per_team IS NULL OR max_substitutes_per_team >= 0),
  min_active_players_per_team INTEGER CHECK (min_active_players_per_team IS NULL OR min_active_players_per_team >= 1),
  max_active_players_per_team INTEGER CHECK (max_active_players_per_team IS NULL OR max_active_players_per_team >= 1),
  require_organizer_approval INTEGER NOT NULL DEFAULT 1 CHECK (require_organizer_approval IN (0, 1)),
  allow_waitlist INTEGER NOT NULL DEFAULT 1 CHECK (allow_waitlist IN (0, 1)),
  public_title TEXT NOT NULL DEFAULT '',
  public_description TEXT NOT NULL DEFAULT '',
  public_token_hash TEXT NOT NULL UNIQUE,
  public_slug TEXT,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at),
  CHECK (
    min_active_players_per_team IS NULL OR
    max_active_players_per_team IS NULL OR
    min_active_players_per_team <= max_active_players_per_team
  )
);

CREATE INDEX idx_event_registration_configs_owner
ON event_registration_configs(owner_scope, event_id);

CREATE INDEX idx_event_registration_configs_public
ON event_registration_configs(public_token_hash);

CREATE TABLE event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  registration_type TEXT NOT NULL CHECK (registration_type IN ('team', 'individual')),
  display_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'needs_review', 'accepted', 'waitlisted', 'declined', 'withdrawn')),
  active_player_count INTEGER NOT NULL DEFAULT 0 CHECK (active_player_count >= 0),
  substitute_count INTEGER NOT NULL DEFAULT 0 CHECK (substitute_count >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  submitted_at INTEGER,
  withdrawn_at INTEGER,
  organizer_note TEXT,
  capacity_override INTEGER NOT NULL DEFAULT 0 CHECK (capacity_override IN (0, 1)),
  FOREIGN KEY (event_id) REFERENCES event_registration_configs(event_id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX idx_event_registrations_event_status
ON event_registrations(event_id, status);

CREATE INDEX idx_event_registrations_event_submitted
ON event_registrations(event_id, submitted_at DESC, id);

CREATE TABLE event_registration_rate_limits (
  scope_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope_hash, window_start)
);

CREATE INDEX idx_event_registration_rate_limits_updated
ON event_registration_rate_limits(updated_at);
