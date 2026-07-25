PRAGMA foreign_keys = ON;

ALTER TABLE event_registrations
ADD COLUMN normalized_team_name TEXT;

ALTER TABLE event_registrations
ADD COLUMN management_token_hash TEXT;

ALTER TABLE event_registrations
ADD COLUMN management_token_rotated_at INTEGER;

ALTER TABLE event_registrations
ADD COLUMN management_token_revoked_at INTEGER;

ALTER TABLE event_registrations
ADD COLUMN editing_locked INTEGER NOT NULL DEFAULT 0
CHECK (editing_locked IN (0, 1));

ALTER TABLE event_registrations
ADD COLUMN public_edit_override INTEGER NOT NULL DEFAULT 0
CHECK (public_edit_override IN (0, 1));

ALTER TABLE event_registrations
ADD COLUMN last_edited_at INTEGER;

ALTER TABLE event_registrations
ADD COLUMN revision INTEGER NOT NULL DEFAULT 1
CHECK (revision >= 1);

ALTER TABLE event_registrations
ADD COLUMN last_edit_key TEXT;

UPDATE event_registrations
SET normalized_team_name = lower(trim(display_name))
WHERE registration_type = 'team'
  AND normalized_team_name IS NULL;

CREATE UNIQUE INDEX idx_event_registrations_management_token
ON event_registrations(management_token_hash)
WHERE management_token_hash IS NOT NULL;

CREATE INDEX idx_event_registrations_event_updated
ON event_registrations(event_id, updated_at DESC, id);

CREATE UNIQUE INDEX idx_event_registrations_active_team_name
ON event_registrations(event_id, normalized_team_name)
WHERE registration_type = 'team'
  AND normalized_team_name IS NOT NULL
  AND management_token_hash IS NOT NULL
  AND status NOT IN ('withdrawn', 'declined');

CREATE TABLE event_registration_members (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  roster_role TEXT NOT NULL
    CHECK (roster_role IN ('active', 'substitute')),
  internal_player_id TEXT,
  public_display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  match_status TEXT NOT NULL
    CHECK (match_status IN ('matched', 'pending', 'organizer_created', 'rejected')),
  duplicate_override INTEGER NOT NULL DEFAULT 0
    CHECK (duplicate_override IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (registration_id)
    REFERENCES event_registrations(id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);

CREATE INDEX idx_registration_members_registration
ON event_registration_members(registration_id, roster_role, created_at, id);

CREATE INDEX idx_registration_members_internal_player
ON event_registration_members(internal_player_id, registration_id)
WHERE internal_player_id IS NOT NULL;

CREATE TABLE event_registration_players (
  event_id TEXT NOT NULL,
  internal_player_id TEXT NOT NULL,
  public_player_token TEXT NOT NULL,
  public_display_name TEXT NOT NULL,
  normalized_primary_name TEXT NOT NULL,
  normalized_aliases TEXT NOT NULL DEFAULT '[]',
  eligible INTEGER NOT NULL DEFAULT 1
    CHECK (eligible IN (0, 1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, internal_player_id),
  UNIQUE (event_id, public_player_token),
  FOREIGN KEY (event_id)
    REFERENCES event_registration_configs(event_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);

CREATE INDEX idx_event_registration_players_lookup
ON event_registration_players(event_id, eligible, normalized_primary_name, public_display_name);

CREATE INDEX idx_event_registration_members_conflicts
ON event_registration_members(internal_player_id, registration_id, roster_role)
WHERE internal_player_id IS NOT NULL
  AND match_status IN ('matched', 'organizer_created');
