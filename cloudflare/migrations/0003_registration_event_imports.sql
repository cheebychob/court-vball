PRAGMA foreign_keys = ON;

CREATE TABLE event_registration_imports (
  event_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  owner_scope TEXT NOT NULL,
  local_entry_id TEXT NOT NULL,
  imported_revision INTEGER NOT NULL CHECK (imported_revision >= 1),
  imported_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, registration_id),
  FOREIGN KEY (event_id)
    REFERENCES event_registration_configs(event_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  FOREIGN KEY (registration_id)
    REFERENCES event_registrations(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

CREATE INDEX idx_event_registration_imports_owner_event
ON event_registration_imports(owner_scope, event_id, updated_at DESC);

CREATE UNIQUE INDEX idx_event_registration_imports_local_entry
ON event_registration_imports(owner_scope, event_id, local_entry_id);
