import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');

const workerSource = await readFile(new URL('../cloudflare/court-sync-worker.js', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../cloudflare/migrations/0001_event_registration_foundation.sql', import.meta.url), 'utf8');
const worker = (await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`)).default;
const ORIGIN = 'https://cheebychob.github.io';
const NOW = Date.now();

class MemoryKV {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true };
  }
}

class SQLiteD1Statement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new SQLiteD1Statement(this.database, this.sql, values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

class SQLiteD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(migrationSource);
  }
  prepare(sql) { return new SQLiteD1Statement(this.database, sql); }
  close() { this.database.close(); }
}

function bindings({ rooms = { 'room:owner-a': '{}', 'room:owner-b': '{}' } } = {}) {
  return { COURT: new MemoryKV(rooms), EVENT_REGISTRATION_DB: new SQLiteD1() };
}

function request(path, init = {}) {
  return new Request(`https://court-sync.example${path}`, init);
}

function organizerInit(room = 'owner-a', body = undefined) {
  return {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: ORIGIN, 'X-Court-Room': room, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function fixedConfig(overrides = {}) {
  return {
    eventName: 'Summer Sand Tournament',
    eventDate: '2026-08-15',
    eventFormat: 'fixedTeams',
    entrySize: null,
    teamSize: null,
    enabled: true,
    status: 'open',
    mode: 'team',
    opensAt: NOW - 60_000,
    closesAt: NOW + 30 * 24 * 60 * 60 * 1000,
    activePlayerCapacity: 8,
    allowSubstitutes: true,
    maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4,
    maxActivePlayersPerTeam: 4,
    requireOrganizerApproval: false,
    allowWaitlist: true,
    publicTitle: 'Summer Sand Tournament',
    publicDescription: 'Four-player teams under the lights.',
    ...overrides,
  };
}

async function createConfig(env, eventId = 'event-1', overrides = {}, room = 'owner-a') {
  const response = await worker.fetch(request(`/api/event-registration/organizer/${eventId}/config`, organizerInit(room, fixedConfig(overrides))), env);
  return { response, body: await response.json() };
}

async function submit(env, token, body, extraHeaders = {}) {
  const response = await worker.fetch(request(`/api/event-registration/public/${token}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${Math.floor(Math.random() * 100) + 1}`, ...extraHeaders },
    body: JSON.stringify(body),
  }), env);
  return { response, body: await response.json() };
}

test('organizer config requires a known room, validates modes/windows, scopes ownership, and stores only a public-token hash', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const unauthenticated = await worker.fetch(request('/api/event-registration/organizer/event-1/config', {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(fixedConfig())
  }), env);
  assert.equal(unauthenticated.status, 401);

  const invalidWindow = await createConfig(env, 'bad-window', { closesAt: NOW - 120_000 });
  assert.equal(invalidWindow.response.status, 400);
  assert.equal(invalidWindow.body.code, 'INVALID_WINDOW');

  const incompatible = await createConfig(env, 'bad-mode', { eventFormat: 'rotatingGroups', entrySize: 2, teamSize: 4, mode: 'team' });
  assert.equal(incompatible.response.status, 400);
  assert.equal(incompatible.body.code, 'UNSUPPORTED_MODE');

  const created = await createConfig(env);
  assert.equal(created.response.status, 201);
  assert.match(created.body.publicToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(created.body.publicUrl, new RegExp(`/register/${created.body.publicToken}$`));
  assert.equal(created.response.headers.get('cache-control'), 'no-store');

  const stored = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registration_configs WHERE event_id = ?').get('event-1');
  assert.equal(stored.public_token_hash, createHash('sha256').update(created.body.publicToken).digest('hex'));
  assert.equal(stored.owner_scope, createHash('sha256').update('owner-a').digest('hex'));
  assert.equal(stored.public_token_hash.includes(created.body.publicToken), false);

  const otherOwner = await worker.fetch(request('/api/event-registration/organizer/event-1/config', organizerInit('owner-b', fixedConfig({ publicTitle: 'Hijacked' }))), env);
  assert.equal(otherOwner.status, 404);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT public_title FROM event_registration_configs WHERE event_id = ?').get('event-1').public_title, 'Summer Sand Tournament');
});

test('public reads use an explicit privacy allowlist and enforce scheduled, closed, cancelled, invalid, and rotated-token states', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-public');
  const token = created.body.publicToken;

  const open = await worker.fetch(request(`/api/event-registration/public/${token}`), env);
  const openBody = await open.json();
  assert.equal(open.status, 200);
  assert.deepEqual(Object.keys(openBody.registration).sort(), [
    'allowSubstitutes', 'allowWaitlist', 'capacity', 'closesAt', 'description', 'eventDate',
    'maxActivePlayersPerTeam', 'maxSubstitutesPerTeam', 'minActivePlayersPerTeam', 'mode',
    'opensAt', 'serverTime', 'status', 'submissionAvailable', 'title'
  ]);
  for (const forbidden of ['rating', 'seedRating', 'notes', 'roles', 'aliases', 'playerId', 'owner', 'room', 'eventId', 'games']) {
    assert.doesNotMatch(JSON.stringify(openBody), new RegExp(forbidden, 'i'));
  }
  assert.equal(open.headers.get('cache-control'), 'no-store');

  await createConfig(env, 'event-public', { status: 'scheduled', opensAt: NOW + 60_000 });
  const scheduled = await (await worker.fetch(request(`/api/event-registration/public/${token}`), env)).json();
  assert.equal(scheduled.registration.status, 'scheduled');

  await createConfig(env, 'event-public', { status: 'closed' });
  const closed = await (await worker.fetch(request(`/api/event-registration/public/${token}`), env)).json();
  assert.equal(closed.registration.status, 'closed');

  await createConfig(env, 'event-public', { status: 'cancelled' });
  const cancelled = await (await worker.fetch(request(`/api/event-registration/public/${token}`), env)).json();
  assert.equal(cancelled.registration.status, 'cancelled');

  const rotate = await worker.fetch(request('/api/event-registration/organizer/event-public/token/rotate', organizerInit('owner-a', {})), env);
  const rotated = await rotate.json();
  assert.match(rotated.publicToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await worker.fetch(request(`/api/event-registration/public/${token}`), env)).status, 404);
  assert.equal((await worker.fetch(request(`/api/event-registration/public/${rotated.publicToken}`), env)).status, 200);
  const invalid = await worker.fetch(request(`/api/event-registration/public/${'Z'.repeat(43)}`), env);
  assert.equal(invalid.status, 404);
  assert.deepEqual(await invalid.json(), { ok: false, code: 'REGISTRATION_UNAVAILABLE', message: 'This registration link is unavailable.' });
});

test('public submissions atomically count active players, exclude substitutes, waitlist whole teams, and reject full no-waitlist entries', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-capacity');
  const token = created.body.publicToken;
  const first = await submit(env, token, { registrationType: 'team', displayName: 'Alpha', activePlayerCount: 4, substituteCount: 2 });
  assert.equal(first.response.status, 201);
  assert.equal(first.body.submission.status, 'accepted');
  assert.deepEqual(first.body.capacity, { activePlayerCapacity: 8, acceptedActivePlayers: 4, remainingActivePlayers: 4 });

  const second = await submit(env, token, { registrationType: 'team', displayName: 'Bravo', activePlayerCount: 4, substituteCount: 1 });
  assert.equal(second.body.submission.status, 'accepted');
  assert.equal(second.body.capacity.acceptedActivePlayers, 8);

  const third = await submit(env, token, { registrationType: 'team', displayName: 'Charlie', activePlayerCount: 4, substituteCount: 0 });
  assert.equal(third.body.submission.status, 'waitlisted');
  assert.equal(third.body.capacity.acceptedActivePlayers, 8);
  const rows = env.EVENT_REGISTRATION_DB.database.prepare('SELECT display_name, status, active_player_count, substitute_count FROM event_registrations ORDER BY created_at, display_name').all();
  assert.deepEqual(rows.map(row => [row.display_name, row.status]), [['Alpha', 'accepted'], ['Bravo', 'accepted'], ['Charlie', 'waitlisted']]);
  assert.equal(rows.filter(row => row.status === 'accepted').reduce((sum, row) => sum + row.active_player_count, 0), 8);
  assert.equal(rows.filter(row => row.status === 'accepted').reduce((sum, row) => sum + row.substitute_count, 0), 3);

  const noWaitlist = await createConfig(env, 'event-no-waitlist', { activePlayerCapacity: 4, allowWaitlist: false });
  await submit(env, noWaitlist.body.publicToken, { registrationType: 'team', displayName: 'Full', activePlayerCount: 4, substituteCount: 0 });
  const rejected = await submit(env, noWaitlist.body.publicToken, { registrationType: 'team', displayName: 'No room', activePlayerCount: 4, substituteCount: 0 });
  assert.equal(rejected.response.status, 409);
  assert.equal(rejected.body.code, 'REGISTRATION_FULL');
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?').get('event-no-waitlist').count, 1);
});

test('approval submissions stay pending, organizer transitions are explicit, acceptance rechecks capacity, and override is audited', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-review', { activePlayerCapacity: 4, requireOrganizerApproval: true });
  const token = created.body.publicToken;
  const alpha = await submit(env, token, { registrationType: 'team', displayName: 'Alpha', activePlayerCount: 4, substituteCount: 2 });
  const bravo = await submit(env, token, { registrationType: 'team', displayName: 'Bravo', activePlayerCount: 4, substituteCount: 0 });
  assert.equal(alpha.body.submission.status, 'submitted');
  assert.equal(bravo.body.submission.status, 'submitted');
  const entries = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY display_name').all('event-review');

  const accept = await worker.fetch(request(`/api/event-registration/organizer/event-review/entries/${entries[0].id}/status`, organizerInit('owner-a', { status: 'accepted', overrideCapacity: false })), env);
  assert.equal(accept.status, 200);
  assert.equal((await accept.json()).capacity.acceptedActivePlayers, 4);

  const over = await worker.fetch(request(`/api/event-registration/organizer/event-review/entries/${entries[1].id}/status`, organizerInit('owner-a', { status: 'accepted', overrideCapacity: false })), env);
  assert.equal(over.status, 409);
  assert.equal((await over.json()).code, 'CAPACITY_EXCEEDED');
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT status FROM event_registrations WHERE id = ?').get(entries[1].id).status, 'submitted');

  const override = await worker.fetch(request(`/api/event-registration/organizer/event-review/entries/${entries[1].id}/status`, organizerInit('owner-a', { status: 'accepted', overrideCapacity: true })), env);
  const overrideBody = await override.json();
  assert.equal(override.status, 200);
  assert.deepEqual(overrideBody.override, { used: true, beforeAcceptedActivePlayers: 4, afterAcceptedActivePlayers: 8 });
  assert.equal(overrideBody.entry.capacityOverride, true);

  const invalid = await worker.fetch(request(`/api/event-registration/organizer/event-review/entries/${entries[1].id}/status`, organizerInit('owner-a', { status: 'draft' })), env);
  assert.equal(invalid.status, 409);
  assert.equal((await invalid.json()).code, 'INVALID_STATUS_TRANSITION');
});

test('concurrent auto-accept attempts cannot silently overfill active capacity', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-concurrent', { activePlayerCapacity: 4, requireOrganizerApproval: false, allowWaitlist: true });
  const [alpha, bravo] = await Promise.all([
    submit(env, created.body.publicToken, { registrationType: 'team', displayName: 'Alpha', activePlayerCount: 4, substituteCount: 1 }),
    submit(env, created.body.publicToken, { registrationType: 'team', displayName: 'Bravo', activePlayerCount: 4, substituteCount: 2 }),
  ]);
  assert.equal(alpha.response.status, 201);
  assert.equal(bravo.response.status, 201);
  assert.deepEqual([alpha.body.submission.status, bravo.body.submission.status].sort(), ['accepted', 'waitlisted']);
  const committed = env.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT COALESCE(SUM(active_player_count), 0) AS active, COALESCE(SUM(substitute_count), 0) AS substitutes
    FROM event_registrations WHERE event_id = ? AND status = 'accepted'
  `).get('event-concurrent');
  assert.equal(committed.active, 4);
  assert.ok([1, 2].includes(committed.substitutes));
});

test('disabling and event deletion lifecycle close public writes without deleting registration records', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-lifecycle');
  const token = created.body.publicToken;
  await submit(env, token, { registrationType: 'team', displayName: 'Preserved', activePlayerCount: 4, substituteCount: 1 });

  const disabled = await createConfig(env, 'event-lifecycle', { enabled: false, status: 'closed' });
  assert.equal(disabled.response.status, 200);
  assert.equal((await worker.fetch(request(`/api/event-registration/public/${token}`), env)).status, 404);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?').get('event-lifecycle').count, 1);

  await createConfig(env, 'event-lifecycle');
  assert.equal((await worker.fetch(request(`/api/event-registration/public/${token}`), env)).status, 200);
  const unavailable = await worker.fetch(request('/api/event-registration/organizer/event-lifecycle/status', organizerInit('owner-a', { status: 'closed', eventAvailable: false })), env);
  assert.equal(unavailable.status, 200);
  assert.equal((await worker.fetch(request(`/api/event-registration/public/${token}`), env)).status, 404);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?').get('event-lifecycle').count, 1);
  assert.ok(env.EVENT_REGISTRATION_DB.database.prepare('SELECT archived_at FROM event_registration_configs WHERE event_id = ?').get('event-lifecycle').archived_at);
});

test('public registration page is standalone, mobile-safe, private-state-free, and same-origin submission boundaries are exact', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-page');
  const page = await worker.fetch(request(`/register/${created.body.publicToken}`), env);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(html, /EVENT REGISTRATION/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /form coming next/);
  assert.doesNotMatch(html, /vb:players|vb:games|seedRating|X-Court-Room|localStorage|Sync\.cfg/);

  const crossOrigin = await submit(env, created.body.publicToken, { registrationType: 'team', displayName: 'Cross origin', activePlayerCount: 4, substituteCount: 0 }, { Origin: 'https://evil.example' });
  assert.equal(crossOrigin.response.status, 403);
  assert.equal(crossOrigin.body.code, 'ORIGIN_NOT_ALLOWED');
  const wrongMethod = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/submissions`, { method: 'GET' }), env);
  assert.equal(wrongMethod.status, 405);
  const fallback = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/other`, { method: 'POST' }), env);
  assert.equal(fallback.status, 404);
});
