ALTER TABLE event_staff_grants
ADD COLUMN pin_kdf_version INTEGER;

UPDATE event_staff_grants
SET pin_kdf_version = 1
WHERE pin_hash IS NOT NULL;
