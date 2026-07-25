PRAGMA foreign_keys = ON;

ALTER TABLE event_registrations
ADD COLUMN contact_json TEXT;
