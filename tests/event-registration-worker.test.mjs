import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');

const workerSource = await readFile(new URL('../cloudflare/court-sync-worker.js', import.meta.url), 'utf8');
const migrationSource = [
  await readFile(new URL('../cloudflare/migrations/0001_event_registration_foundation.sql', import.meta.url), 'utf8'),
  await readFile(new URL('../cloudflare/migrations/0002_team_registration_portal.sql', import.meta.url), 'utf8'),
  await readFile(new URL('../cloudflare/migrations/0003_registration_event_imports.sql', import.meta.url), 'utf8'),
].join('\n');
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
  bind(...values) {
    if (values.length > 100) throw new Error('D1_ERROR: too many SQL variables');
    return new SQLiteD1Statement(this.database, this.sql, values);
  }
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
  async batch(statements) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
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
  assert.equal((await submit(env, token, { registrationType: 'team', displayName: 'Too early', activePlayerCount: 4, substituteCount: 0 })).body.code, 'REGISTRATION_NOT_OPEN');

  await createConfig(env, 'event-public', { status: 'closed' });
  const closed = await (await worker.fetch(request(`/api/event-registration/public/${token}`), env)).json();
  assert.equal(closed.registration.status, 'closed');
  assert.equal((await submit(env, token, { registrationType: 'team', displayName: 'Too late', activePlayerCount: 4, substituteCount: 0 })).body.code, 'REGISTRATION_NOT_OPEN');

  await createConfig(env, 'event-public', { status: 'cancelled' });
  const cancelled = await (await worker.fetch(request(`/api/event-registration/public/${token}`), env)).json();
  assert.equal(cancelled.registration.status, 'cancelled');
  assert.equal((await submit(env, token, { registrationType: 'team', displayName: 'Cancelled', activePlayerCount: 4, substituteCount: 0 })).body.code, 'REGISTRATION_NOT_OPEN');

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
  assert.match(html, /Team name/);
  assert.match(html, /Add active player/);
  assert.match(html, /Can’t find this player/);
  assert.match(html, /Share management link/);
  assert.match(html, /localStorage\.getItem/);
  assert.doesNotMatch(html, /vb:players|vb:games|seedRating|X-Court-Room|Sync\.cfg/);
  const publicScript = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(publicScript);
  assert.doesNotThrow(() => new Function(publicScript));

  const managementPage = await worker.fetch(request(`/event-registration/manage/${'M'.repeat(43)}`), env);
  const managementHtml = await managementPage.text();
  assert.equal(managementPage.status, 200);
  assert.match(managementHtml, /PRIVATE TEAM MANAGEMENT/);
  assert.match(managementHtml, /Share private link/);
  assert.match(managementHtml, /safe-area-inset-bottom/);
  const managementScript = managementHtml.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(managementScript);
  assert.doesNotThrow(() => new Function(managementScript));

  const crossOrigin = await submit(env, created.body.publicToken, { registrationType: 'team', displayName: 'Cross origin', activePlayerCount: 4, substituteCount: 0 }, { Origin: 'https://evil.example' });
  assert.equal(crossOrigin.response.status, 403);
  assert.equal(crossOrigin.body.code, 'ORIGIN_NOT_ALLOWED');
  const wrongMethod = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/submissions`, { method: 'GET' }), env);
  assert.equal(wrongMethod.status, 405);
  const fallback = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/other`, { method: 'POST' }), env);
  assert.equal(fallback.status, 404);
});

test('public player lookup is bounded, ranked, alias-aware, stable across organizer devices, and strictly allowlisted', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = [
    { internalPlayerId: 'player-joshua', publicPlayerToken: 'A'.repeat(22), displayName: 'Joshua S', primaryName: 'Joshua', aliases: ['Josh'], eligible: true },
    { internalPlayerId: 'player-josh', publicPlayerToken: 'B'.repeat(22), displayName: 'Josh T', primaryName: 'Josh', aliases: ['JT'], eligible: true },
    { internalPlayerId: 'player-sarah', publicPlayerToken: 'C'.repeat(22), displayName: 'Sarah', primaryName: 'Sarah', aliases: ['Joshie'], eligible: true },
    { internalPlayerId: 'player-away', publicPlayerToken: 'D'.repeat(22), displayName: 'Josh Away', primaryName: 'Josh Away', aliases: [], eligible: false },
  ];
  const created = await createConfig(env, 'event-lookup', { players });
  const tooShort = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/players?q=j`), env);
  assert.equal(tooShort.status, 400);
  assert.equal((await tooShort.json()).code, 'SEARCH_QUERY_TOO_SHORT');

  const response = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/players?q=josh`, {
    headers: { 'CF-Connecting-IP': '203.0.113.7' },
  }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.players.map(player => player.displayName), ['Josh T', 'Joshua S', 'Sarah']);
  assert.deepEqual(Object.keys(body.players[0]).sort(), ['displayName', 'publicPlayerToken']);
  assert.doesNotMatch(JSON.stringify(body), /player-josh|aliases|rating|notes|roles|history/i);
  assert.equal(body.players.some(player => player.displayName === 'Josh Away'), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const secondDevicePlayers = players.map((player, index) => ({
    ...player,
    publicPlayerToken: String.fromCharCode(90 - index).repeat(22),
  }));
  const resynced = await createConfig(env, 'event-lookup', { players: secondDevicePlayers });
  assert.equal(resynced.response.status, 200);
  const stableTokens = env.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT internal_player_id, public_player_token
    FROM event_registration_players
    WHERE event_id = ?
    ORDER BY internal_player_id
  `).all('event-lookup');
  assert.deepEqual(
    stableTokens.map(row => row.public_player_token),
    ['D'.repeat(22), 'B'.repeat(22), 'A'.repeat(22), 'C'.repeat(22)],
  );

  for (let attempt = 1; attempt < 30; attempt++) {
    const allowed = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/players?q=josh`, {
      headers: { 'CF-Connecting-IP': '203.0.113.7' },
    }), env);
    assert.equal(allowed.status, 200);
  }
  const rateLimited = await worker.fetch(request(`/api/event-registration/public/${created.body.publicToken}/players?q=josh`, {
    headers: { 'CF-Connecting-IP': '203.0.113.7' },
  }), env);
  assert.equal(rateLimited.status, 429);
  assert.equal((await rateLimited.json()).code, 'RATE_LIMITED');

  const manyPlayers = Array.from({ length: 12 }, (_, index) => ({
    internalPlayerId: `common-${index}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Common Player ${String(index + 1).padStart(2, '0')}`,
    primaryName: `Common Player ${String(index + 1).padStart(2, '0')}`,
    aliases: [],
    eligible: true,
  }));
  const bounded = await createConfig(env, 'event-lookup-bounded', { players: manyPlayers });
  const boundedResponse = await worker.fetch(request(`/api/event-registration/public/${bounded.body.publicToken}/players?q=common`, {
    headers: { 'CF-Connecting-IP': '203.0.113.8' },
  }), env);
  const boundedBody = await boundedResponse.json();
  assert.equal(boundedResponse.status, 200);
  assert.equal(boundedBody.players.length, 8);
  assert.equal(boundedBody.resultLimit, 8);
});

test('organizer player directories above the D1 parameter limit save, preserve tokens, and remove stale players', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const tokenFor = index => Buffer.from(String(index).padStart(16, '0')).toString('base64url');
  const players = Array.from({ length: 103 }, (_, index) => ({
    internalPlayerId: `large-roster-${index}`,
    publicPlayerToken: tokenFor(index),
    displayName: `Large Roster ${index}`,
    primaryName: `Large Roster ${index}`,
    aliases: [],
    eligible: true,
  }));

  const created = await createConfig(env, 'event-large-directory', { players });
  assert.equal(created.response.status, 201);
  assert.equal(
    env.EVENT_REGISTRATION_DB.database.prepare(
      'SELECT COUNT(*) AS count FROM event_registration_players WHERE event_id = ?'
    ).get('event-large-directory').count,
    103,
  );

  const resynced = await createConfig(env, 'event-large-directory', {
    players: players.slice(0, 101).map((player, index) => ({
      ...player,
      publicPlayerToken: tokenFor(index + 200),
      displayName: `${player.displayName} updated`,
    })),
  });
  assert.equal(resynced.response.status, 200);
  const stored = env.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT internal_player_id, public_player_token, public_display_name
    FROM event_registration_players
    WHERE event_id = ?
    ORDER BY internal_player_id
  `).all('event-large-directory');
  assert.equal(stored.length, 101);
  assert.equal(stored.find(row => row.internal_player_id === 'large-roster-0').public_player_token, tokenFor(0));
  assert.equal(stored.find(row => row.internal_player_id === 'large-roster-0').public_display_name, 'Large Roster 0 updated');
  assert.equal(stored.some(row => row.internal_player_id === 'large-roster-102'), false);
});

test('roster-aware submission rejects invalid names, sizes, substitute counts, and player tokens without partial writes', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 6 }, (_, index) => ({
    internalPlayerId: `validation-${index}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Validation Player ${index + 1}`,
    primaryName: `Validation Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-validation', { players, maxSubstitutesPerTeam: 1 });
  const member = (index, role = 'active') => ({
    id: String.fromCharCode(109 + index).repeat(22),
    rosterRole: role,
    publicPlayerToken: players[index].publicPlayerToken,
  });
  const cases = [
    { body: { registrationType: 'team', teamName: '   ', members: [0, 1, 2, 3].map(index => member(index)) }, code: 'INVALID_TEAM_NAME' },
    { body: { registrationType: 'team', teamName: '<script>', members: [0, 1, 2, 3].map(index => member(index)) }, code: 'INVALID_TEAM_NAME' },
    { body: { registrationType: 'team', teamName: 'Too small', members: [0, 1, 2].map(index => member(index)) }, code: 'ROSTER_TOO_SMALL' },
    { body: { registrationType: 'team', teamName: 'Too large', members: [0, 1, 2, 3, 4].map(index => member(index)) }, code: 'ROSTER_TOO_LARGE' },
    { body: { registrationType: 'team', teamName: 'Too many subs', members: [0, 1, 2, 3].map(index => member(index)).concat([member(4, 'substitute'), member(5, 'substitute')]) }, code: 'TOO_MANY_SUBSTITUTES' },
    { body: { registrationType: 'team', teamName: 'Invalid token', members: [0, 1, 2].map(index => member(index)).concat([{ id: 'z'.repeat(22), rosterRole: 'active', publicPlayerToken: 'not-a-token' }]) }, code: 'INVALID_PLAYER' },
  ];
  for (const item of cases) {
    const result = await submit(env, created.body.publicToken, item.body);
    assert.equal(result.response.status, 400);
    assert.equal(result.body.code, item.code);
  }
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?').get('event-validation').count, 0);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registration_members').get().count, 0);
});

test('roster-aware submission stores stable members and only a management-token hash', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = [
    { internalPlayerId: 'p1', publicPlayerToken: 'A'.repeat(22), displayName: 'Alex #1', primaryName: 'Alex', aliases: [], eligible: true },
    { internalPlayerId: 'p2', publicPlayerToken: 'B'.repeat(22), displayName: 'Blair', primaryName: 'Blair', aliases: [], eligible: true },
    { internalPlayerId: 'p3', publicPlayerToken: 'C'.repeat(22), displayName: 'Casey', primaryName: 'Casey', aliases: [], eligible: true },
    { internalPlayerId: 'p4', publicPlayerToken: 'D'.repeat(22), displayName: 'Devon', primaryName: 'Devon', aliases: [], eligible: true },
    { internalPlayerId: 'p5', publicPlayerToken: 'E'.repeat(22), displayName: 'Emery', primaryName: 'Emery', aliases: [], eligible: true },
  ];
  const created = await createConfig(env, 'event-team-submit', { players, requireOrganizerApproval: true });
  const members = [
    { id: 'm'.repeat(22), rosterRole: 'active', publicPlayerToken: 'A'.repeat(22) },
    { id: 'n'.repeat(22), rosterRole: 'active', publicPlayerToken: 'B'.repeat(22) },
    { id: 'o'.repeat(22), rosterRole: 'active', publicPlayerToken: 'C'.repeat(22) },
    { id: 'p'.repeat(22), rosterRole: 'active', displayName: 'New Person' },
    { id: 'q'.repeat(22), rosterRole: 'substitute', publicPlayerToken: 'E'.repeat(22) },
  ];
  const submitted = await submit(env, created.body.publicToken, { registrationType: 'team', teamName: '  Net Results  ', members });
  assert.equal(submitted.response.status, 201, JSON.stringify(submitted.body));
  assert.equal(submitted.body.submission.teamName, 'Net Results');
  assert.equal(submitted.body.submission.status, 'needs_review');
  assert.match(submitted.body.submission.managementUrl, /\/event-registration\/manage\/[A-Za-z0-9_-]{43}$/);
  assert.equal(submitted.body.submission.activePlayerCount, 4);
  assert.equal(submitted.body.submission.substituteCount, 1);
  assert.doesNotMatch(JSON.stringify(submitted.body), /internalPlayerId|management_token_hash|p1/);

  const registration = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registrations WHERE event_id = ?').get('event-team-submit');
  const managementToken = submitted.body.submission.managementUrl.split('/').at(-1);
  assert.equal(registration.management_token_hash, createHash('sha256').update(managementToken).digest('hex'));
  assert.equal(JSON.stringify(registration).includes(managementToken), false);
  const storedMembers = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registration_members WHERE registration_id = ? ORDER BY created_at, id').all(registration.id);
  assert.equal(storedMembers.length, 5);
  assert.equal(storedMembers.filter(member => member.roster_role === 'active').length, 4);
  assert.equal(storedMembers.find(member => member.public_display_name === 'New Person').match_status, 'pending');
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare("SELECT COUNT(*) AS count FROM event_registration_players WHERE internal_player_id = 'New Person'").get().count, 0);

  const duplicateTeam = await submit(env, created.body.publicToken, { registrationType: 'team', teamName: 'net results', members: members.map((member, index) => ({ ...member, id: String(index).repeat(22) })) });
  assert.equal(duplicateTeam.response.status, 409);
  assert.equal(duplicateTeam.body.code, 'DUPLICATE_TEAM_NAME');
});

test('management edits use safe views, stable member IDs, revisions, locks, rotation, and withdrawal', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 5 }, (_, index) => ({
    internalPlayerId: `p${index + 1}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Player ${index + 1}`,
    primaryName: `Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-manage', { players, requireOrganizerApproval: true });
  const initialMembers = players.slice(0, 4).map((player, index) => ({
    id: String.fromCharCode(109 + index).repeat(22),
    rosterRole: 'active',
    publicPlayerToken: player.publicPlayerToken,
  }));
  const submitted = await submit(env, created.body.publicToken, { registrationType: 'team', teamName: 'Original', members: initialMembers });
  assert.equal(submitted.response.status, 201, JSON.stringify(submitted.body));
  const managementUrl = new URL(submitted.body.submission.managementUrl), managementToken = managementUrl.pathname.split('/').at(-1);
  const getResponse = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env);
  const getBody = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.headers.get('cache-control'), 'no-store');
  assert.equal(getBody.registration.members.length, 4);
  assert.deepEqual(Object.keys(getBody.registration.members[0]).sort(), ['createdAt', 'displayName', 'id', 'matchStatus', 'rosterRole', 'updatedAt']);
  assert.doesNotMatch(JSON.stringify(getBody), /internalPlayerId|aliases|rating|notes|roles|other team/i);

  const editedMembers = getBody.registration.members.map((member, index) => ({ id: member.id, rosterRole: index === 3 ? 'substitute' : 'active', displayName: member.displayName }));
  editedMembers.push({ id: 'z'.repeat(22), rosterRole: 'active', publicPlayerToken: 'E'.repeat(22) });
  const edit = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: getBody.registration.revision, teamName: 'Updated', members: editedMembers }),
  }), env);
  const editBody = await edit.json();
  assert.equal(edit.status, 200);
  assert.equal(editBody.registration.teamName, 'Updated');
  assert.equal(editBody.registration.activePlayerCount, 4);
  assert.equal(editBody.registration.substituteCount, 1);
  assert.equal(editBody.registration.status, 'needs_review');
  assert.equal(editBody.registration.members.filter(member => initialMembers.some(initial => initial.id === member.id)).length, 4);

  const activeToRemove = editBody.registration.members.find(member => member.rosterRole === 'active');
  const rearrangedMembers = editBody.registration.members
    .filter(member => member.id !== activeToRemove.id)
    .map(member => ({ id: member.id, rosterRole: 'active', displayName: member.displayName }));
  rearrangedMembers.push({ id: 'y'.repeat(22), rosterRole: 'substitute', displayName: 'Temporary Substitute' });
  const rearranged = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: editBody.registration.revision, teamName: 'Updated', members: rearrangedMembers }),
  }), env);
  const rearrangedBody = await rearranged.json();
  assert.equal(rearranged.status, 200);
  assert.equal(rearrangedBody.registration.activePlayerCount, 4);
  assert.equal(rearrangedBody.registration.substituteCount, 1);
  assert.equal(rearrangedBody.registration.members.some(member => member.id === activeToRemove.id), false);
  assert.equal(rearrangedBody.registration.members.find(member => member.id === 'y'.repeat(22)).matchStatus, 'pending');

  const cleanedMembers = rearrangedBody.registration.members
    .filter(member => member.id !== 'y'.repeat(22))
    .map(member => ({ id: member.id, rosterRole: member.rosterRole, displayName: member.displayName }));
  const cleaned = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: rearrangedBody.registration.revision, teamName: 'Updated', members: cleanedMembers }),
  }), env);
  const cleanedBody = await cleaned.json();
  assert.equal(cleaned.status, 200);
  assert.equal(cleanedBody.registration.activePlayerCount, 4);
  assert.equal(cleanedBody.registration.substituteCount, 0);

  const stale = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: getBody.registration.revision, teamName: 'Stale', members: editedMembers }),
  }), env);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'REGISTRATION_CONFLICT');

  const entryId = submitted.body.submission.registrationId;
  const locked = await worker.fetch(request(`/api/event-registration/organizer/event-manage/entries/${entryId}/management`, organizerInit('owner-a', { action: 'lock' })), env);
  assert.equal(locked.status, 200);
  const lockedEdit = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: cleanedBody.registration.revision + 1, teamName: 'Locked', members: cleanedMembers }),
  }), env);
  assert.equal(lockedEdit.status, 423);

  const rotated = await worker.fetch(request(`/api/event-registration/organizer/event-manage/entries/${entryId}/management`, organizerInit('owner-a', { action: 'rotate' })), env);
  const rotatedBody = await rotated.json();
  const nextToken = rotatedBody.managementUrl.split('/').at(-1);
  assert.equal((await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).status, 404);
  assert.equal((await worker.fetch(request(`/api/event-registration/manage/${nextToken}`), env)).status, 200);

  await worker.fetch(request(`/api/event-registration/organizer/event-manage/entries/${entryId}/management`, organizerInit('owner-a', { action: 'unlock' })), env);
  const current = await (await worker.fetch(request(`/api/event-registration/manage/${nextToken}`), env)).json();
  const withdrawn = await worker.fetch(request(`/api/event-registration/manage/${nextToken}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, revision: current.registration.revision }),
  }), env);
  const withdrawnBody = await withdrawn.json();
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawnBody.registration.status, 'withdrawn');
  assert.equal(withdrawnBody.registration.editable, false);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registration_members WHERE registration_id = ?').get(entryId).count, 4);
});

test('accepted management edits require review, close is read-only until organizer unlock, and withdrawal releases capacity', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 4 }, (_, index) => ({
    internalPlayerId: `lifecycle-${index}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Lifecycle Player ${index + 1}`,
    primaryName: `Lifecycle Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-management-lifecycle', {
    players,
    requireOrganizerApproval: true,
    activePlayerCapacity: 4,
  });
  const submitted = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Lifecycle Team',
    members: players.map((player, index) => ({
      id: String.fromCharCode(97 + index).repeat(22),
      rosterRole: 'active',
      publicPlayerToken: player.publicPlayerToken,
    })),
  });
  const entryId = submitted.body.submission.registrationId;
  const managementToken = submitted.body.submission.managementUrl.split('/').at(-1);
  const accepted = await worker.fetch(request(`/api/event-registration/organizer/event-management-lifecycle/entries/${entryId}/status`, organizerInit('owner-a', {
    status: 'accepted',
    overrideCapacity: false,
  })), env);
  assert.equal(accepted.status, 200);

  const original = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  const edit = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision: original.registration.revision,
      teamName: 'Lifecycle Team Renamed',
      members: original.registration.members.map(member => ({
        id: member.id,
        rosterRole: member.rosterRole,
        displayName: member.displayName,
      })),
    }),
  }), env);
  const edited = await edit.json();
  assert.equal(edit.status, 200);
  assert.equal(edited.registration.status, 'needs_review');
  assert.ok(edited.registration.lastEditedAt >= original.registration.updatedAt);

  const closedConfig = await createConfig(env, 'event-management-lifecycle', {
    players,
    requireOrganizerApproval: true,
    activePlayerCapacity: 4,
    status: 'closed',
  });
  assert.equal(closedConfig.response.status, 200);
  const closed = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  assert.equal(closed.registration.editable, false);
  const blocked = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision: closed.registration.revision,
      teamName: 'Blocked Edit',
      members: closed.registration.members.map(member => ({
        id: member.id,
        rosterRole: member.rosterRole,
        displayName: member.displayName,
      })),
    }),
  }), env);
  assert.equal(blocked.status, 423);

  const unlocked = await worker.fetch(request(`/api/event-registration/organizer/event-management-lifecycle/entries/${entryId}/management`, organizerInit('owner-a', { action: 'unlock' })), env);
  assert.equal(unlocked.status, 200);
  const unlockedState = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  assert.equal(unlockedState.registration.editable, true);
  const afterCloseEdit = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision: unlockedState.registration.revision,
      teamName: 'Organizer Unlocked Team',
      members: unlockedState.registration.members.map(member => ({
        id: member.id,
        rosterRole: member.rosterRole,
        displayName: member.displayName,
      })),
    }),
  }), env);
  assert.equal(afterCloseEdit.status, 200);

  const restored = await worker.fetch(request(`/api/event-registration/organizer/event-management-lifecycle/entries/${entryId}/status`, organizerInit('owner-a', {
    status: 'accepted',
    overrideCapacity: false,
  })), env);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).capacity.acceptedActivePlayers, 4);
  const beforeWithdraw = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  const withdrawn = await worker.fetch(request(`/api/event-registration/manage/${managementToken}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, revision: beforeWithdraw.registration.revision }),
  }), env);
  assert.equal(withdrawn.status, 200);
  const dashboard = await (await worker.fetch(request('/api/event-registration/organizer/event-management-lifecycle', organizerInit()), env)).json();
  assert.equal(dashboard.capacity.acceptedActivePlayers, 0);
  assert.equal(dashboard.entries[0].members.length, 4);

  const revoked = await worker.fetch(request(`/api/event-registration/organizer/event-management-lifecycle/entries/${entryId}/management`, organizerInit('owner-a', { action: 'revoke' })), env);
  assert.equal(revoked.status, 200);
  const invalid = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env);
  assert.equal(invalid.status, 404);
  assert.deepEqual(await invalid.json(), { ok: false, code: 'MANAGEMENT_LINK_UNAVAILABLE', message: 'This management link is unavailable.' });
  const reissued = await worker.fetch(request(`/api/event-registration/organizer/event-management-lifecycle/entries/${entryId}/management`, organizerInit('owner-a', { action: 'rotate' })), env);
  const reissuedBody = await reissued.json();
  assert.match(reissuedBody.managementUrl, /\/event-registration\/manage\/[A-Za-z0-9_-]{43}$/);
  const reissuedState = await (await worker.fetch(request(`/api/event-registration/manage/${reissuedBody.managementUrl.split('/').at(-1)}`), env)).json();
  assert.equal(reissuedState.registration.status, 'withdrawn');
  assert.equal(reissuedState.registration.editable, false);
});

test('management token guessing is address-rate-limited without revealing registration existence', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const headers = { 'CF-Connecting-IP': '198.51.100.44' };
  for (let attempt = 0; attempt < 60; attempt++) {
    const token = `${String(attempt).padStart(3, '0')}${'X'.repeat(40)}`;
    const response = await worker.fetch(request(`/api/event-registration/manage/${token}`, { headers }), env);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, code: 'MANAGEMENT_LINK_UNAVAILABLE', message: 'This management link is unavailable.' });
  }
  const blocked = await worker.fetch(request(`/api/event-registration/manage/${'Y'.repeat(43)}`, { headers }), env);
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, 'RATE_LIMITED');
});

test('matched-player duplicates are rejected safely within and across teams', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 7 }, (_, index) => ({
    internalPlayerId: `p${index + 1}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Player ${index + 1}`,
    primaryName: `Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-duplicates', { players });
  const member = (token, id, rosterRole = 'active') => ({ id: id.repeat(22), rosterRole, publicPlayerToken: token });
  const first = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'First',
    members: [
      member('A'.repeat(22), 'a'),
      member('B'.repeat(22), 'b'),
      member('C'.repeat(22), 'c'),
      member('D'.repeat(22), 'd'),
    ],
  });
  assert.equal(first.response.status, 201);

  const within = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Within',
    members: [
      member('E'.repeat(22), 'e'),
      member('F'.repeat(22), 'f'),
      member('G'.repeat(22), 'g'),
      member('E'.repeat(22), 'h', 'substitute'),
    ],
  });
  assert.equal(within.response.status, 400);
  assert.equal(within.body.code, 'DUPLICATE_MEMBER');

  const across = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Across',
    members: [
      member('A'.repeat(22), 'i'),
      member('E'.repeat(22), 'j'),
      member('F'.repeat(22), 'k'),
      member('G'.repeat(22), 'l'),
    ],
  });
  assert.equal(across.response.status, 409);
  assert.equal(across.body.code, 'PLAYER_ALREADY_REGISTERED');
  assert.doesNotMatch(across.body.message, /First|team/i);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare("SELECT COUNT(*) AS count FROM event_registrations WHERE display_name IN ('Within', 'Across')").get().count, 0);

  const editable = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Editable',
    members: [
      member('E'.repeat(22), 'm'),
      member('F'.repeat(22), 'n'),
      member('G'.repeat(22), 'o'),
      { id: 'p'.repeat(22), rosterRole: 'active', displayName: 'Pending Fourth' },
    ],
  });
  assert.equal(editable.response.status, 201);
  const managementToken = editable.body.submission.managementUrl.split('/').at(-1);
  const before = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  const conflictMembers = before.registration.members.map(memberRow => memberRow.id === 'p'.repeat(22)
    ? { id: memberRow.id, rosterRole: memberRow.rosterRole, publicPlayerToken: 'A'.repeat(22) }
    : { id: memberRow.id, rosterRole: memberRow.rosterRole, displayName: memberRow.displayName });
  const editConflict = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: before.registration.revision, teamName: 'Editable', members: conflictMembers }),
  }), env);
  assert.equal(editConflict.status, 409);
  assert.equal((await editConflict.json()).code, 'PLAYER_ALREADY_REGISTERED');
  const after = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  assert.equal(after.registration.revision, before.registration.revision);
  assert.equal(after.registration.members.find(memberRow => memberRow.id === 'p'.repeat(22)).matchStatus, 'pending');
});

test('organizer matches, creates, and rejects pending members before acceptance', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 5 }, (_, index) => ({
    internalPlayerId: `p${index + 1}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Player ${index + 1}`,
    primaryName: `Player ${index + 1}`,
    aliases: index === 3 ? ['Fourth Alias'] : [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-member-review', { players, requireOrganizerApproval: true });
  const submitted = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Review Team',
    members: [
      { id: 'a'.repeat(22), rosterRole: 'active', publicPlayerToken: 'A'.repeat(22) },
      { id: 'b'.repeat(22), rosterRole: 'active', publicPlayerToken: 'B'.repeat(22) },
      { id: 'c'.repeat(22), rosterRole: 'active', publicPlayerToken: 'C'.repeat(22) },
      { id: 'd'.repeat(22), rosterRole: 'active', displayName: 'Fourth Person' },
      { id: 'e'.repeat(22), rosterRole: 'substitute', displayName: 'Created Guest' },
      { id: 'f'.repeat(22), rosterRole: 'substitute', displayName: 'Rejected Guest' },
    ],
  });
  const entryId = submitted.body.submission.registrationId;
  const pending = env.EVENT_REGISTRATION_DB.database.prepare("SELECT id, public_display_name FROM event_registration_members WHERE registration_id = ? AND match_status = 'pending'").all(entryId);
  const fourth = pending.find(member => member.public_display_name === 'Fourth Person');
  const createdGuest = pending.find(member => member.public_display_name === 'Created Guest');
  const rejectedGuest = pending.find(member => member.public_display_name === 'Rejected Guest');

  const earlyAccept = await worker.fetch(request(`/api/event-registration/organizer/event-member-review/entries/${entryId}/status`, organizerInit('owner-a', { status: 'accepted', overrideCapacity: false })), env);
  assert.equal(earlyAccept.status, 409);
  assert.equal((await earlyAccept.json()).code, 'MEMBER_REVIEW_REQUIRED');

  const matched = await worker.fetch(request(`/api/event-registration/organizer/event-member-review/entries/${entryId}/members/${fourth.id}`, organizerInit('owner-a', {
    action: 'match',
    internalPlayerId: 'p4',
    duplicateOverride: false,
  })), env);
  const matchedBody = await matched.json();
  assert.equal(matched.status, 200);
  assert.equal(matchedBody.member.matchStatus, 'matched');
  assert.equal(matchedBody.member.displayName, 'Player 4');

  const organizerCreated = await worker.fetch(request(`/api/event-registration/organizer/event-member-review/entries/${entryId}/members/${createdGuest.id}`, organizerInit('owner-a', {
    action: 'match',
    internalPlayerId: 'p5',
    duplicateOverride: false,
    organizerCreated: true,
  })), env);
  assert.equal(organizerCreated.status, 200);
  assert.equal((await organizerCreated.json()).member.matchStatus, 'organizer_created');

  const rejected = await worker.fetch(request(`/api/event-registration/organizer/event-member-review/entries/${entryId}/members/${rejectedGuest.id}`, organizerInit('owner-a', {
    action: 'reject',
  })), env);
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).member.matchStatus, 'rejected');

  const accepted = await worker.fetch(request(`/api/event-registration/organizer/event-member-review/entries/${entryId}/status`, organizerInit('owner-a', { status: 'accepted', overrideCapacity: false })), env);
  assert.equal(accepted.status, 200);
  const dashboard = await worker.fetch(request('/api/event-registration/organizer/event-member-review', organizerInit()), env);
  const entry = (await dashboard.json()).entries[0];
  assert.equal(entry.activePlayerCount, 4);
  assert.equal(entry.substituteCount, 1);
  assert.equal(entry.members.length, 6);
  assert.equal(entry.members.some(member => member.matchStatus === 'organizer_created'), true);
  assert.equal(entry.members.some(member => member.matchStatus === 'rejected'), true);
  assert.equal(entry.members.some(member => member.matchStatus === 'pending'), false);
  assert.doesNotMatch(JSON.stringify(entry), /rating|notes|aliases|history/i);
});

test('organizer roster moves revalidate capacity, audit overrides, and preserve accepted status', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 5 }, (_, index) => ({
    internalPlayerId: `p${index + 1}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Player ${index + 1}`,
    primaryName: `Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-organizer-move', {
    players,
    activePlayerCapacity: 4,
    maxActivePlayersPerTeam: 5,
  });
  const submitted = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Move Team',
    members: players.map((player, index) => ({
      id: String.fromCharCode(97 + index).repeat(22),
      rosterRole: index === 4 ? 'substitute' : 'active',
      publicPlayerToken: player.publicPlayerToken,
    })),
  });
  assert.equal(submitted.body.submission.status, 'accepted');
  const entryId = submitted.body.submission.registrationId;
  const substituteId = 'e'.repeat(22);
  const route = `/api/event-registration/organizer/event-organizer-move/entries/${entryId}/members/${substituteId}`;

  const blocked = await worker.fetch(request(route, organizerInit('owner-a', {
    action: 'move',
    rosterRole: 'active',
    overrideCapacity: false,
  })), env);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'CAPACITY_EXCEEDED');

  const overridden = await worker.fetch(request(route, organizerInit('owner-a', {
    action: 'move',
    rosterRole: 'active',
    overrideCapacity: true,
  })), env);
  assert.equal(overridden.status, 200);
  let registration = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registrations WHERE id = ?').get(entryId);
  assert.equal(registration.status, 'accepted');
  assert.equal(registration.active_player_count, 5);
  assert.equal(registration.substitute_count, 0);
  assert.equal(registration.capacity_override, 1);

  const movedBack = await worker.fetch(request(route, organizerInit('owner-a', {
    action: 'move',
    rosterRole: 'substitute',
    overrideCapacity: false,
  })), env);
  assert.equal(movedBack.status, 200);
  registration = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registrations WHERE id = ?').get(entryId);
  assert.equal(registration.status, 'accepted');
  assert.equal(registration.active_player_count, 4);
  assert.equal(registration.substitute_count, 1);
});

test('accepted captain edit cannot silently waitlist an over-capacity roster', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 5 }, (_, index) => ({
    internalPlayerId: `captain-capacity-${index}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Capacity Player ${index + 1}`,
    primaryName: `Capacity Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-captain-capacity', {
    players,
    activePlayerCapacity: 4,
    maxActivePlayersPerTeam: 5,
  });
  const submitted = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Capacity Team',
    members: players.map((player, index) => ({
      id: String.fromCharCode(97 + index).repeat(22),
      rosterRole: index === 4 ? 'substitute' : 'active',
      publicPlayerToken: player.publicPlayerToken,
    })),
  });
  assert.equal(submitted.body.submission.status, 'accepted');
  const entryId = submitted.body.submission.registrationId;
  const managementToken = submitted.body.submission.managementUrl.split('/').at(-1);
  const before = await (await worker.fetch(request(`/api/event-registration/manage/${managementToken}`), env)).json();
  const overCapacityMembers = before.registration.members.map(member => ({
    id: member.id,
    rosterRole: 'active',
    displayName: member.displayName,
  }));
  const blocked = await worker.fetch(request(`/api/event-registration/manage/${managementToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision: before.registration.revision,
      teamName: before.registration.teamName,
      members: overCapacityMembers,
    }),
  }), env);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'CAPACITY_EXCEEDED');
  const registration = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registrations WHERE id = ?').get(entryId);
  assert.equal(registration.status, 'accepted');
  assert.equal(registration.active_player_count, 4);
  assert.equal(registration.substitute_count, 1);
  assert.equal(registration.revision, before.registration.revision);
});

test('organizer import preview is owner scoped, private, D1-backed, and import marks are revision safe', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const players = Array.from({ length: 5 }, (_, index) => ({
    internalPlayerId: `import-player-${index + 1}`,
    publicPlayerToken: String.fromCharCode(65 + index).repeat(22),
    displayName: `Import Player ${index + 1}`,
    primaryName: `Import Player ${index + 1}`,
    aliases: [],
    eligible: true,
  }));
  const created = await createConfig(env, 'event-import-preview', { players });
  const submitted = await submit(env, created.body.publicToken, {
    registrationType: 'team',
    teamName: 'Import Team',
    members: players.map((player, index) => ({
      id: String.fromCharCode(97 + index).repeat(22),
      rosterRole: index === 4 ? 'substitute' : 'active',
      publicPlayerToken: player.publicPlayerToken,
    })),
  });
  const registrationId = submitted.body.submission.registrationId;
  const previewPath = '/api/event-registration/organizer/event-import-preview/import-preview';

  assert.equal((await worker.fetch(request(previewPath), env)).status, 401);
  assert.equal((await worker.fetch(request(previewPath, organizerInit('owner-b')), env)).status, 404);
  const previewResponse = await worker.fetch(request(previewPath, organizerInit()), env);
  const preview = await previewResponse.json();
  assert.equal(previewResponse.status, 200);
  assert.equal(preview.entries.length, 1);
  assert.equal(preview.entries[0].id, registrationId);
  assert.equal(preview.entries[0].status, 'accepted');
  assert.equal(preview.entries[0].members.filter(member => member.rosterRole === 'active').length, 4);
  assert.equal(preview.entries[0].members.filter(member => member.rosterRole === 'substitute').length, 1);
  assert.equal(preview.entries[0].members[0].internalPlayerId, 'import-player-1');
  assert.equal(preview.entries[0].imported, null);
  assert.doesNotMatch(JSON.stringify(preview), /management|organizerNote|rating|seedRating|notes|stats|room/i);

  const revision = preview.entries[0].revision;
  const markPath = '/api/event-registration/organizer/event-import-preview/import-mark';
  const stale = await worker.fetch(request(markPath, organizerInit('owner-a', {
    registrationId,
    localEntryId: 'local-team-1',
    importedRevision: revision + 1,
  })), env);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'IMPORT_REVISION_CHANGED');

  const marked = await worker.fetch(request(markPath, organizerInit('owner-a', {
    registrationId,
    localEntryId: 'local-team-1',
    importedRevision: revision,
  })), env);
  const markedBody = await marked.json();
  assert.equal(marked.status, 200);
  assert.equal(markedBody.imported.localEntryId, 'local-team-1');
  assert.equal(markedBody.imported.importedRevision, revision);

  const repeated = await worker.fetch(request(markPath, organizerInit('owner-a', {
    registrationId,
    localEntryId: 'local-team-1',
    importedRevision: revision,
  })), env);
  assert.equal(repeated.status, 200);
  const stored = env.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_registration_imports').all();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].owner_scope, createHash('sha256').update('owner-a').digest('hex'));

  const refreshed = await (await worker.fetch(request(previewPath, organizerInit()), env)).json();
  assert.equal(refreshed.entries[0].imported.localEntryId, 'local-team-1');
  assert.equal(refreshed.entries[0].imported.importedRevision, revision);

  const reset = await worker.fetch(request('/api/event-registration/organizer/event-import-preview/import-reset', organizerInit('owner-a', {
    registrationId,
  })), env);
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).imported, null);
  assert.equal(env.EVENT_REGISTRATION_DB.database.prepare('SELECT COUNT(*) AS count FROM event_registration_imports').get().count, 0);
});

test('public and management tokens cannot reach organizer import routes and registration import never lists KV', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  const created = await createConfig(env, 'event-import-auth');
  let lists = 0;
  env.COURT.list = async () => { lists += 1; return { keys: [], list_complete: true }; };
  const path = '/api/event-registration/organizer/event-import-auth/import-preview';

  const publicTokenAttempt = await worker.fetch(request(path, {
    headers: { Origin: ORIGIN, 'X-Court-Room': created.body.publicToken },
  }), env);
  assert.equal(publicTokenAttempt.status, 403);
  const managementTokenAttempt = await worker.fetch(request(path, {
    headers: { Origin: ORIGIN, 'X-Court-Room': 'M'.repeat(43) },
  }), env);
  assert.equal(managementTokenAttempt.status, 403);
  const allowed = await worker.fetch(request(path, organizerInit()), env);
  assert.equal(allowed.status, 200);
  assert.equal(lists, 0);
});

test('organizer dashboard and import preview share one canonical D1 registration summary across statuses, players, capacity, and imports', async t => {
  const env = bindings(); t.after(() => env.EVENT_REGISTRATION_DB.close());
  await createConfig(env, 'event-summary', { activePlayerCapacity: 8 });
  await createConfig(env, 'event-summary-other', { activePlayerCapacity: null });
  const db = env.EVENT_REGISTRATION_DB.database;
  const rows = [
    ['a'.repeat(22), 'accepted', 4, 2, 101],
    ['b'.repeat(22), 'submitted', 2, 1, 102],
    ['c'.repeat(22), 'needs_review', 3, 1, 103],
    ['d'.repeat(22), 'waitlisted', 4, 2, 104],
    ['e'.repeat(22), 'declined', 6, 3, 105],
    ['f'.repeat(22), 'withdrawn', 5, 4, 106],
    ['g'.repeat(22), 'draft', 1, 1, 107],
  ];
  const insert = db.prepare(`
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count,
      substitute_count, created_at, updated_at, revision
    ) VALUES (?, 'event-summary', 'team', ?, ?, ?, ?, ?, ?, 1)
  `);
  for (const [id, status, active, substitutes, updatedAt] of rows) {
    insert.run(id, status, status, active, substitutes, updatedAt, updatedAt);
  }
  db.prepare(`
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count,
      substitute_count, created_at, updated_at, revision
    ) VALUES (?, 'event-summary-other', 'team', 'Other accepted', 'accepted', 7, 0, 201, 201, 1)
  `).run('z'.repeat(22));
  const acceptedId = 'a'.repeat(22);
  for (let index = 0; index < 5; index++) {
    db.prepare(`
      INSERT INTO event_registration_members (
        id, registration_id, roster_role, internal_player_id, public_display_name,
        normalized_name, match_status, duplicate_override, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'matched', 0, 100, 100)
    `).run(
      `${index}`.repeat(22), acceptedId, index === 4 ? 'substitute' : 'active',
      index === 3 ? 'player-1' : `player-${index + 1}`, `Player ${index + 1}`, `player ${index + 1}`
    );
  }
  const ownerScope = createHash('sha256').update('owner-a').digest('hex');
  db.prepare(`
    INSERT INTO event_registration_imports (
      event_id, registration_id, owner_scope, local_entry_id,
      imported_revision, imported_at, updated_at
    ) VALUES ('event-summary', ?, ?, 'local-summary', 1, 108, 108)
  `).run(acceptedId, ownerScope);

  const raw = db.prepare(`
    SELECT status, active_player_count, substitute_count
    FROM event_registrations WHERE event_id = 'event-summary' ORDER BY status
  `).all();
  assert.equal(raw.length, 7);
  assert.equal(raw.find(row => row.status === 'accepted').active_player_count, 4);
  assert.equal(raw.find(row => row.status === 'accepted').substitute_count, 2);

  const dashboardResponse = await worker.fetch(request('/api/event-registration/organizer/event-summary', organizerInit()), env);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(dashboard.summary.entryCounts, {
    draft: 1, submitted: 1, needsReview: 1, accepted: 1, waitlisted: 1, declined: 1, withdrawn: 1,
  });
  assert.deepEqual(dashboard.summary.playerCounts, {
    acceptedActive: 4, acceptedSubstitutes: 2,
    pendingActive: 5, pendingSubstitutes: 2,
    waitlistedActive: 4, waitlistedSubstitutes: 2, totalSubstitutes: 7,
  });
  assert.deepEqual(dashboard.summary.capacity, {
    activePlayerCapacity: 8, acceptedActivePlayers: 4, remainingActiveSpots: 4, isUnlimited: false,
  });
  assert.deepEqual(dashboard.summary.integration, {
    acceptedRegistrations: 1, importedRegistrations: 1, readyToImport: 0, blocked: 0, updatesAvailable: 0,
  });
  assert.equal(dashboard.summary.eventId, 'event-summary');
  assert.equal(dashboard.summary.effectiveStatus, 'open');
  assert.ok(dashboard.summary.revision >= 108);
  assert.deepEqual(dashboard.capacity, {
    capacity: 8, acceptedEntries: 1, submittedEntries: 1, needsReviewEntries: 1,
    pendingEntries: 2, waitlistedEntries: 1, declinedEntries: 1, withdrawnEntries: 1,
    acceptedActivePlayers: 4, pendingActivePlayers: 5, waitlistedActivePlayers: 4,
    acceptedSubstitutePlayers: 2, totalSubstitutePlayers: 7, remainingAcceptedCapacity: 4,
  });

  const summaryResponse = await worker.fetch(request('/api/event-registration/organizer/event-summary/summary', organizerInit()), env);
  const summaryBody = await summaryResponse.json();
  assert.equal(summaryResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(summaryBody.summary, dashboard.summary);
  assert.equal(Object.hasOwn(summaryBody, 'entries'), false);

  const previewResponse = await worker.fetch(request('/api/event-registration/organizer/event-summary/import-preview', organizerInit()), env);
  const preview = await previewResponse.json();
  assert.equal(previewResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(preview.summary, dashboard.summary);
  assert.equal(preview.revision, dashboard.summary.revision);

  const otherOwner = await (await worker.fetch(request('/api/event-registration/organizer/event-summary', organizerInit('owner-b')), env)).json();
  assert.deepEqual(otherOwner, { ok: true, configured: false, eventId: 'event-summary' });
  assert.equal(dashboard.summary.entryCounts.accepted, 1);
  assert.equal(dashboard.summary.playerCounts.acceptedActive, 4);

  const unlimited = await (await worker.fetch(request('/api/event-registration/organizer/event-summary-other', organizerInit()), env)).json();
  assert.deepEqual(unlimited.summary.capacity, {
    activePlayerCapacity: null, acceptedActivePlayers: 7, remainingActiveSpots: null, isUnlimited: true,
  });

  const plan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT status, SUM(active_player_count)
    FROM event_registrations
    WHERE event_id = ?
    GROUP BY status
  `).all('event-summary').map(row => row.detail).join(' ');
  assert.match(plan, /idx_event_registrations_event_status/);
});
