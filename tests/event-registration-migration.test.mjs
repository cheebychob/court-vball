import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const foundationMigration = await readFile(new URL('../cloudflare/migrations/0001_event_registration_foundation.sql', import.meta.url), 'utf8');
const teamMigration = await readFile(new URL('../cloudflare/migrations/0002_team_registration_portal.sql', import.meta.url), 'utf8');
const integrationMigration = await readFile(new URL('../cloudflare/migrations/0003_registration_event_imports.sql', import.meta.url), 'utf8');
const contactMigration = await readFile(new URL('../cloudflare/migrations/0004_registration_contact.sql', import.meta.url), 'utf8');
const eventStaffMigration = await readFile(new URL('../cloudflare/migrations/0005_event_staff_access.sql', import.meta.url), 'utf8');
const migration = `${foundationMigration}\n${teamMigration}\n${integrationMigration}\n${contactMigration}\n${eventStaffMigration}`;

test('registration migration applies cleanly with tables, indexes, foreign keys, and uniqueness constraints', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
  assert.ok(tables.includes('event_registration_configs'));
  assert.ok(tables.includes('event_registrations'));
  assert.ok(tables.includes('event_registration_rate_limits'));
  assert.ok(tables.includes('event_registration_members'));
  assert.ok(tables.includes('event_registration_players'));
  assert.ok(tables.includes('event_registration_imports'));
  assert.ok(tables.includes('event_staff_events'));
  assert.ok(tables.includes('event_staff_grants'));
  assert.ok(tables.includes('event_staff_sessions'));
  assert.ok(tables.includes('event_staff_idempotency'));
  assert.ok(tables.includes('event_staff_audit'));
  assert.ok(tables.includes('event_staff_rate_limits'));
  assert.ok(database.prepare("PRAGMA table_info('event_registrations')").all().some(row => row.name === 'contact_json'));
  const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name").all().map(row => row.name);
  for (const name of [
    'idx_event_registration_configs_owner',
    'idx_event_registration_configs_public',
    'idx_event_registrations_event_status',
    'idx_event_registrations_event_submitted',
    'idx_event_registration_rate_limits_updated',
    'idx_event_registrations_management_token',
    'idx_event_registrations_event_updated',
    'idx_event_registrations_active_team_name',
    'idx_registration_members_registration',
    'idx_registration_members_internal_player',
    'idx_event_registration_players_lookup',
    'idx_event_registration_members_conflicts',
    'idx_event_registration_imports_owner_event',
    'idx_event_registration_imports_local_entry',
    'idx_event_staff_events_owner_updated',
    'idx_event_staff_grants_event',
    'idx_event_staff_grants_active',
    'idx_event_staff_sessions_grant',
    'idx_event_staff_sessions_event',
    'idx_event_staff_sessions_retention',
    'idx_event_staff_idempotency_retention',
    'idx_event_staff_audit_event',
    'idx_event_staff_rate_limits_updated',
  ]) assert.ok(indexes.includes(name), `${name} exists`);

  const insertConfig = database.prepare(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, enabled, event_available,
      mode, status, allow_substitutes, require_organizer_approval, allow_waitlist,
      public_token_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertConfig.run('event-1', 'owner', 'Cup', '2026-08-15', 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, 'a'.repeat(64), 1, 1);
  assert.throws(() => insertConfig.run('event-1', 'owner', 'Duplicate', '2026-08-15', 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, 'b'.repeat(64), 1, 1), /UNIQUE constraint failed/);
  assert.throws(() => insertConfig.run('event-2', 'owner', 'Duplicate token', '2026-08-15', 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, 'a'.repeat(64), 1, 1), /UNIQUE constraint failed/);
  assert.throws(() => database.prepare(`
    INSERT INTO event_registrations (id, event_id, registration_type, status, active_player_count, substitute_count, created_at, updated_at)
    VALUES ('missing-entry', 'missing-event', 'team', 'submitted', 4, 0, 1, 1)
  `).run(), /FOREIGN KEY constraint failed/);
  assert.throws(() => database.prepare(`
    INSERT INTO event_registrations (id, event_id, registration_type, status, active_player_count, substitute_count, created_at, updated_at)
    VALUES ('bad-status', 'event-1', 'team', 'mystery', 4, 0, 1, 1)
  `).run(), /CHECK constraint failed/);
  database.close();
});

test('team portal migration applies after populated foundation data and preserves registrations', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(foundationMigration);
  database.exec(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, enabled, event_available,
      mode, status, allow_substitutes, require_organizer_approval, allow_waitlist,
      public_token_hash, created_at, updated_at
    ) VALUES
      ('event-existing', 'owner', 'Cup', '2026-08-15', 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, '${'a'.repeat(64)}', 1, 1);
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count,
      substitute_count, created_at, updated_at
    ) VALUES
      ('existing-a', 'event-existing', 'team', 'Duplicate', 'submitted', 4, 0, 1, 1),
      ('existing-b', 'event-existing', 'team', 'Duplicate', 'submitted', 4, 0, 2, 2);
  `);
  database.exec(teamMigration);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM event_registrations').get().count, 2);
  assert.equal(database.prepare('SELECT revision FROM event_registrations WHERE id = ?').get('existing-a').revision, 1);
  const foreignKeys = database.prepare("PRAGMA foreign_key_list('event_registration_members')").all();
  assert.ok(foreignKeys.some(row => row.table === 'event_registrations' && row.on_delete === 'CASCADE'));
  database.close();
});

test('registration event import migration is additive, owner scoped, and preserves stable mappings', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(foundationMigration);
  database.exec(teamMigration);
  const now = Date.now();
  database.prepare(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, enabled, event_available,
      mode, status, allow_substitutes, require_organizer_approval, allow_waitlist,
      public_token_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, ?, ?, ?)
  `).run('event-import', 'owner-a', 'Import Cup', '2026-08-15', 'token-hash', now, now);
  database.prepare(`
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count,
      substitute_count, created_at, updated_at, revision
    ) VALUES (?, ?, 'team', 'Alpha', 'accepted', 2, 0, ?, ?, 3)
  `).run('registration-import', 'event-import', now, now);

  assert.doesNotThrow(() => database.exec(integrationMigration));
  database.prepare(`
    INSERT INTO event_registration_imports (
      event_id, registration_id, owner_scope, local_entry_id,
      imported_revision, imported_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('event-import', 'registration-import', 'owner-a', 'local-team-1', 3, now, now);

  const mapping = database.prepare('SELECT * FROM event_registration_imports').get();
  assert.equal(mapping.local_entry_id, 'local-team-1');
  assert.equal(mapping.imported_revision, 3);
  assert.throws(() => database.prepare(`
    INSERT INTO event_registration_imports (
      event_id, registration_id, owner_scope, local_entry_id,
      imported_revision, imported_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('event-import', 'registration-import', 'owner-a', 'local-team-2', 3, now, now));
  database.close();
});

test('registration contact migration is additive and leaves old registrations untouched', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(foundationMigration);
  database.exec(teamMigration);
  database.exec(integrationMigration);
  database.exec(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, enabled, event_available,
      mode, status, allow_substitutes, require_organizer_approval, allow_waitlist,
      public_token_hash, created_at, updated_at
    ) VALUES ('event-contact', 'owner', 'Cup', '2026-08-15', 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, '${'c'.repeat(64)}', 1, 1);
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count,
      substitute_count, created_at, updated_at
    ) VALUES ('old-registration', 'event-contact', 'team', 'Legacy Team', 'submitted', 4, 0, 1, 1);
  `);
  database.exec(contactMigration);
  assert.equal(database.prepare('SELECT contact_json FROM event_registrations WHERE id = ?').get('old-registration').contact_json, null);
  database.close();
});

test('event staff migration is additive and enforces scoped grants, role presets, epochs, and hashed credentials', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(foundationMigration);
  database.exec(teamMigration);
  database.exec(integrationMigration);
  database.exec(contactMigration);
  database.exec(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, enabled, event_available,
      mode, status, allow_substitutes, require_organizer_approval, allow_waitlist,
      public_token_hash, created_at, updated_at
    ) VALUES ('event-existing', 'owner-a', 'Cup', '2026-08-15', 'fixedTeams', 1, 1, 'team', 'open', 1, 1, 1, '${'d'.repeat(64)}', 1, 1);
  `);

  assert.doesNotThrow(() => database.exec(eventStaffMigration));
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM event_registration_configs').get().count, 1);
  const now = Date.now();
  database.prepare(`
    INSERT INTO event_staff_events (
      owner_scope, event_id, event_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run('owner-a', 'event-1', '{"id":"event-1"}', now, now);
  database.prepare(`
    INSERT INTO event_staff_grants (
      id, owner_scope, event_id, event_access_epoch, token_hash, staff_label, role,
      permissions_json, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'grant-1', 'owner-a', 'event-1', 1, 'a'.repeat(64), 'Score Table',
    'scorekeeper', '["viewEvent","recordEventScore"]', now, now + 60_000
  );

  const grant = database.prepare('SELECT * FROM event_staff_grants WHERE id = ?').get('grant-1');
  assert.equal(grant.token_hash, 'a'.repeat(64));
  assert.equal(grant.event_access_epoch, 1);
  assert.equal(grant.role, 'scorekeeper');
  assert.equal(grant.pin_hash, null);
  assert.throws(() => database.prepare(`
    INSERT INTO event_staff_grants (
      id, owner_scope, event_id, event_access_epoch, token_hash, staff_label, role,
      permissions_json, created_at, expires_at
    ) VALUES ('bad-role', 'owner-a', 'event-1', 1, '${'b'.repeat(64)}', 'Bad', 'owner',
      '[]', ${now}, ${now + 60_000})
  `).run(), /CHECK constraint failed/);
  assert.throws(() => database.prepare(`
    INSERT INTO event_staff_grants (
      id, owner_scope, event_id, event_access_epoch, token_hash, pin_salt, staff_label, role,
      permissions_json, created_at, expires_at
    ) VALUES ('partial-pin', 'owner-a', 'event-1', 1, '${'c'.repeat(64)}', 'salt', 'Bad PIN',
      'viewOnly', '[]', ${now}, ${now + 60_000})
  `).run(), /CHECK constraint failed/);
  assert.throws(() => database.prepare(`
    INSERT INTO event_staff_grants (
      id, owner_scope, event_id, event_access_epoch, token_hash, staff_label, role,
      permissions_json, created_at, expires_at
    ) VALUES ('duplicate-token', 'owner-a', 'event-1', 1, '${'a'.repeat(64)}', 'Duplicate',
      'viewOnly', '[]', ${now}, ${now + 60_000})
  `).run(), /UNIQUE constraint failed/);
  assert.throws(() => database.prepare(`
    INSERT INTO event_staff_grants (
      id, owner_scope, event_id, event_access_epoch, token_hash, staff_label, role,
      permissions_json, created_at, expires_at
    ) VALUES ('missing-event', 'owner-a', 'event-missing', 1, '${'e'.repeat(64)}', 'Missing',
      'viewOnly', '[]', ${now}, ${now + 60_000})
  `).run(), /FOREIGN KEY constraint failed/);
  database.close();
});
