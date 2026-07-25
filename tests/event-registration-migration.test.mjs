import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const foundationMigration = await readFile(new URL('../cloudflare/migrations/0001_event_registration_foundation.sql', import.meta.url), 'utf8');
const teamMigration = await readFile(new URL('../cloudflare/migrations/0002_team_registration_portal.sql', import.meta.url), 'utf8');
const migration = `${foundationMigration}\n${teamMigration}`;

test('registration migration applies cleanly with tables, indexes, foreign keys, and uniqueness constraints', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
  assert.ok(tables.includes('event_registration_configs'));
  assert.ok(tables.includes('event_registrations'));
  assert.ok(tables.includes('event_registration_rate_limits'));
  assert.ok(tables.includes('event_registration_members'));
  assert.ok(tables.includes('event_registration_players'));
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
