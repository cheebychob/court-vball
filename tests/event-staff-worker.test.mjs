import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = value => Buffer.from(value, 'base64').toString('binary');

const workerSource = await readFile(new URL('../cloudflare/court-sync-worker.js', import.meta.url), 'utf8');
const migrations = await Promise.all([
  '0001_event_registration_foundation.sql',
  '0002_team_registration_portal.sql',
  '0003_registration_event_imports.sql',
  '0004_registration_contact.sql',
  '0005_event_staff_access.sql',
  '0006_event_staff_pin_kdf_version.sql',
].map(name => readFile(new URL(`../cloudflare/migrations/${name}`, import.meta.url), 'utf8')));
const worker = (await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`)).default;
const ORIGIN = 'https://cheebychob.github.io';

class MemoryKV {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.gets = [];
    this.puts = [];
    this.lists = [];
  }
  async get(key) { this.gets.push(key); return this.values.get(key) ?? null; }
  async put(key, value) { this.puts.push([key, value]); this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list(options = {}) {
    this.lists.push(options);
    const prefix = options.prefix || '';
    return { keys: [...this.values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true };
  }
}

class SQLiteD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) { return new SQLiteD1Statement(this.database, this.sql, values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        changed_db: Number(result.changes) > 0,
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

class SQLiteD1 {
  constructor({ staffSchema = true } = {}) {
    this.database = new DatabaseSync(':memory:');
    const selected = staffSchema === false
      ? migrations.slice(0, 4)
      : staffSchema === 'v1'
        ? migrations.slice(0, 5)
        : migrations;
    this.database.exec(selected.join('\n'));
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

function env({ staffSchema = true, rooms = { 'room:owner-a': JSON.stringify({ ts: 1, data: '{}' }) } } = {}) {
  return {
    COURT: new MemoryKV(rooms),
    EVENT_REGISTRATION_DB: new SQLiteD1({ staffSchema }),
  };
}

function request(path, init = {}) {
  return new Request(`https://court-sync.example${path}`, init);
}

function ownerInit({ room = 'owner-a', method = 'GET', body } = {}) {
  return {
    method,
    headers: {
      Origin: ORIGIN,
      'X-Court-Room': room,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function fixedSnapshot(eventId = 'event-1', overrides = {}) {
  const gameMeta = { ratingVersion: 2, detailed: false, eventFamilies: {} };
  const scheduledAt = Date.now() + 60 * 60 * 1000;
  return {
    event: {
      id: eventId,
      name: 'Summer Staff Cup',
      eventDate: '2026-08-15',
      venue: 'Lakeside Courts',
      format: 'fixedTeams',
      done: false,
      teams: [
        { id: 'team-a', name: 'Alpha', players: ['player-a', 'player-b'] },
        { id: 'team-b', name: 'Bravo', players: ['player-c', 'player-d'] },
      ],
      sched: { start: '09:00', courts: 2, courtStyle: 'num' },
      brackets: [],
      registrationCheckIn: { entries: {}, updatedAt: null },
    },
    games: [],
    participants: [
      { id: 'player-a', name: 'Avery', active: true },
      { id: 'player-b', name: 'Blair', active: false },
      { id: 'player-c', name: 'Casey', active: true },
      { id: 'player-d', name: 'Devon', active: true },
    ],
    matches: [{
      id: 'fixed-match-1',
      format: 'fixedTeams',
      phase: 'pool',
      status: 'ready',
      label: 'Round 1',
      teamAId: 'team-a',
      teamBId: 'team-b',
      sideAName: 'Alpha',
      sideBName: 'Bravo',
      sideAPlayerIds: ['player-a', 'player-b'],
      sideBPlayerIds: ['player-c', 'player-d'],
      sideAEntryIds: [],
      sideBEntryIds: [],
      court: 1,
      courtLabel: 'Court 1',
      scheduledAt,
      slot: 0,
      validPlacements: [
        { court: 1, scheduledAt, slot: 0 },
        { court: 2, scheduledAt, slot: 0 },
      ],
      gameIds: [],
      gameMeta,
    }],
    gameMeta,
    ...overrides,
  };
}

function rotatingSnapshot(eventId = 'rotation-event', overrides = {}) {
  const gameMeta = { ratingVersion: 2, detailed: false, eventFamilies: {} };
  const scheduledAt = Date.now() + 2 * 60 * 60 * 1000;
  return {
    event: {
      id: eventId,
      name: 'Rotating Staff Cup',
      eventDate: '2026-08-16',
      venue: 'Lakeside Courts',
      format: 'rotatingGroups',
      done: false,
      teams: [],
      entries: [
        { id: 'entry-a', name: 'Avery', players: ['player-a'] },
        { id: 'entry-b', name: 'Blair', players: ['player-b'] },
        { id: 'entry-c', name: 'Casey', players: ['player-c'] },
        { id: 'entry-d', name: 'Devon', players: ['player-d'] },
      ],
      rotation: {
        entrySize: 1,
        teamSize: 2,
        winPoints: 3,
        tiePoints: 1,
        lossPoints: 0,
        tiebreakers: ['wins', 'pointDiff'],
      },
      brackets: [],
      registrationCheckIn: { entries: {}, updatedAt: null },
    },
    games: [],
    participants: [
      { id: 'player-a', name: 'Avery', active: true },
      { id: 'player-b', name: 'Blair', active: true },
      { id: 'player-c', name: 'Casey', active: true },
      { id: 'player-d', name: 'Devon', active: true },
    ],
    matches: [{
      id: 'rotation-match-1',
      gameRecordMatchId: 'rotation-match-1',
      format: 'rotatingGroups',
      phase: 'pool',
      status: 'ready',
      label: 'Round 1 · Court 1',
      sideAName: 'Avery + Blair',
      sideBName: 'Casey + Devon',
      sideAPlayerIds: ['player-a', 'player-b'],
      sideBPlayerIds: ['player-c', 'player-d'],
      sideAEntryIds: ['entry-a', 'entry-b'],
      sideBEntryIds: ['entry-c', 'entry-d'],
      court: 1,
      courtLabel: 'Court 1',
      scheduledAt,
      slot: 0,
      validPlacements: [
        { court: 1, scheduledAt, slot: 0 },
        { court: 2, scheduledAt, slot: 0 },
      ],
      gameIds: [],
      gameMeta,
      allowedScoreModes: ['set', 'bo3'],
    }],
    gameMeta,
    ...overrides,
  };
}

function bracketSnapshot(eventId = 'bracket-event') {
  const gameMeta = { ratingVersion: 2, detailed: false, eventFamilies: {} };
  const teams = ['a', 'b', 'c', 'd'].map(letter => ({
    id: `team-${letter}`,
    name: `Team ${letter.toUpperCase()}`,
    players: [`player-${letter}`],
  }));
  const participants = ['a', 'b', 'c', 'd'].map(letter => ({
    id: `player-${letter}`,
    name: `Player ${letter.toUpperCase()}`,
    active: true,
  }));
  const match = (id, roundIndex, matchIndex, a, b) => ({
    id,
    gameRecordMatchId: id,
    format: 'fixedTeams',
    phase: 'playoff',
    status: 'ready',
    label: roundIndex ? 'Championship' : `Semifinal ${matchIndex + 1}`,
    bracketId: 'bracket-1',
    bracketName: 'Championship bracket',
    roundIndex,
    matchIndex,
    upstreamComplete: true,
    teamAId: a,
    teamBId: b,
    sideAName: teams.find(team => team.id === a)?.name,
    sideBName: teams.find(team => team.id === b)?.name,
    sideAPlayerIds: teams.find(team => team.id === a)?.players || [],
    sideBPlayerIds: teams.find(team => team.id === b)?.players || [],
    sideAEntryIds: a ? [a] : [],
    sideBEntryIds: b ? [b] : [],
    gameIds: [],
    gameMeta,
    allowedScoreModes: ['set', 'bo3'],
  });
  const final = match('bracket-1:r1:m0', 1, 0, null, null);
  final.status = 'waiting';
  final.upstreamComplete = false;
  return {
    event: {
      id: eventId,
      name: 'Bracket Staff Cup',
      eventDate: '2026-08-17',
      venue: 'Lakeside Courts',
      format: 'fixedTeams',
      done: false,
      teams,
      brackets: [{
        id: 'bracket-1',
        name: 'Championship bracket',
        seeds: teams.map(team => team.id),
        created: Date.now(),
      }],
      registrationCheckIn: { entries: {}, updatedAt: null },
    },
    games: [],
    participants,
    matches: [
      match('bracket-1:r0:m0', 0, 0, 'team-a', 'team-b'),
      match('bracket-1:r0:m1', 0, 1, 'team-c', 'team-d'),
      final,
    ],
    gameMeta,
  };
}

async function seedSnapshot(bindings, eventId = 'event-1', body = fixedSnapshot(eventId), room = 'owner-a') {
  const response = await worker.fetch(request(`/api/event-staff/owner/events/${eventId}/snapshot`, ownerInit({
    room,
    method: 'PUT',
    body,
  })), bindings);
  return { response, body: await response.json() };
}

async function createGrant(bindings, eventId = 'event-1', body = {}, room = 'owner-a') {
  const response = await worker.fetch(request(`/api/event-staff/owner/events/${eventId}/grants`, ownerInit({
    room,
    method: 'POST',
    body: {
      staffLabel: 'Score Table',
      role: 'scorekeeper',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      ...body,
    },
  })), bindings);
  return { response, body: await response.json() };
}

function inviteToken(result) {
  return decodeURIComponent(new URL(result.inviteUrl).hash.slice('#token='.length));
}

async function redeem(bindings, token, pin = undefined, { origin, address = '203.0.113.10' } = {}) {
  const response = await worker.fetch(request('/api/event-staff/redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': address,
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify({ token, ...(pin === undefined ? {} : { pin }) }),
  }), bindings);
  return { response, body: await response.json() };
}

function staffInit(sessionToken, { method = 'GET', body, origin } = {}) {
  return {
    method,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

async function operate(bindings, sessionToken, body) {
  const response = await worker.fetch(request('/api/event-staff/operations', staffInit(sessionToken, {
    method: 'POST',
    body,
  })), bindings);
  return { response, body: await response.json() };
}

function storedEventStaffState(bindings, eventId = 'event-1') {
  const row = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT revision, event_json, games_json, participants_json, matches_json,
           deleted_game_ids_json, staff_score_match_ids_json
    FROM event_staff_events
    WHERE event_id = ?
  `).get(eventId);
  return {
    revision: Number(row.revision),
    event: JSON.parse(row.event_json),
    games: JSON.parse(row.games_json),
    participants: JSON.parse(row.participants_json),
    matches: JSON.parse(row.matches_json),
    deletedGameIds: JSON.parse(row.deleted_game_ids_json),
    staffScoreMatchIds: JSON.parse(row.staff_score_match_ids_json),
  };
}

function syncEnvelope(data, ts = 100) {
  return JSON.stringify({ ts, data: JSON.stringify(data) });
}

test('event-staff capability is schema-gated, private-origin scoped, and backward compatible', async t => {
  const readyEnv = env();
  t.after(() => readyEnv.EVENT_REGISTRATION_DB.close());
  const ready = await worker.fetch(request('/api/event-staff/status', { headers: { Origin: ORIGIN } }), readyEnv);
  assert.equal(ready.status, 200);
  const readyBody = await ready.json();
  assert.deepEqual({
    ...readyBody,
    roles: readyBody.roles.map(role => role.id),
  }, {
    available: true,
    apiVersion: 1,
    schemaVersion: 2,
    permissionSchemaVersion: 1,
    maxActiveGrantsPerEvent: 10,
    maxGrantDays: 30,
    roles: ['viewOnly', 'scorekeeper', 'tournamentOperator'],
  });
  assert.equal(ready.headers.get('cache-control'), 'no-store');
  assert.equal(ready.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(ready.headers.get('vary'), 'Origin');

  const oldEnv = env({ staffSchema: false });
  t.after(() => oldEnv.EVENT_REGISTRATION_DB.close());
  const unavailable = await worker.fetch(request('/api/event-staff/status', { headers: { Origin: ORIGIN } }), oldEnv);
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.available, false);
  assert.doesNotMatch(JSON.stringify(unavailableBody), /event_staff_|sqlite|d1|owner-a/i);

  const v1Env = env({ staffSchema: 'v1' });
  t.after(() => v1Env.EVENT_REGISTRATION_DB.close());
  const missingKdfVersion = await worker.fetch(
    request('/api/event-staff/status', { headers: { Origin: ORIGIN } }),
    v1Env,
  );
  assert.equal(missingKdfVersion.status, 503);
  assert.equal((await missingKdfVersion.json()).available, false);

  const blocked = await worker.fetch(request('/api/event-staff/status', { headers: { Origin: 'https://evil.example' } }), readyEnv);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});

test('event-staff owner routes reject missing, unknown, and cross-origin owner credentials', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const path = '/api/event-staff/owner/events/event-1/grants';

  const missing = await worker.fetch(request(path, { headers: { Origin: ORIGIN } }), bindings);
  assert.equal(missing.status, 401);
  const unknown = await worker.fetch(request(path, ownerInit({ room: 'missing-room' })), bindings);
  assert.equal(unknown.status, 403);
  const blocked = await worker.fetch(request(path, {
    headers: { Origin: 'https://evil.example', 'X-Court-Room': 'owner-a' },
  }), bindings);
  assert.equal(blocked.status, 403);
  for (const response of [missing, unknown, blocked]) {
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.clone().text(), /owner-a|room:|event_staff_|sqlite/i);
  }
});

test('owner seeds one bounded event and grant creation stores only token/PIN hashes with a fragment invite', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const seeded = await seedSnapshot(bindings);
  assert.equal(seeded.response.status, 201);
  assert.equal(seeded.body.revision, 1);

  const mismatch = await seedSnapshot(bindings, 'event-2', fixedSnapshot('another-event'));
  assert.equal(mismatch.response.status, 400);
  assert.equal(mismatch.body.error, 'event_mismatch');

  const missingRevision = await seedSnapshot(bindings, 'event-1', fixedSnapshot('event-1'));
  assert.equal(missingRevision.response.status, 409);
  assert.equal(missingRevision.body.error, 'revision_conflict');
  assert.equal(missingRevision.body.currentRevision, 1);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT revision FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').revision, 1);

  const created = await createGrant(bindings, 'event-1', { pin: '4826' });
  assert.equal(created.response.status, 201);
  assert.match(created.body.inviteUrl, /^https:\/\/court-sync\.example\/staff#token=[A-Za-z0-9_-]{43}$/);
  assert.equal(new URL(created.body.inviteUrl).search, '');
  const rawToken = new URL(created.body.inviteUrl).hash.slice('#token='.length);
  const stored = bindings.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_staff_grants WHERE id = ?').get(created.body.grant.id);
  assert.match(stored.token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.token_hash, rawToken);
  assert.notEqual(stored.pin_hash, '4826');
  assert.equal(stored.pin_iterations, 210000);
  assert.equal(stored.pin_kdf_version, 2);
  assert.equal(JSON.stringify(stored).includes(rawToken), false);
  assert.equal(JSON.stringify(stored).includes('4826'), false);

  const listedResponse = await worker.fetch(request('/api/event-staff/owner/events/event-1/grants', ownerInit()), bindings);
  const listed = await listedResponse.json();
  assert.equal(listedResponse.status, 200);
  assert.equal(listed.grants.length, 1);
  assert.equal(listed.grants[0].pinRequired, true);
  assert.equal(listed.grants[0].status, 'active');
  assert.equal(Object.hasOwn(listed.grants[0], 'token'), false);
  assert.doesNotMatch(JSON.stringify(listed), new RegExp(rawToken));

  const row = bindings.EVENT_REGISTRATION_DB.database.prepare('SELECT event_json, games_json, participants_json, matches_json FROM event_staff_events').get();
  const storedSnapshot = JSON.stringify(row);
  for (const forbidden of ['seedRating', 'deltas', 'winProb', 'history', 'aliases', 'sync', 'backup', 'owner-a']) {
    assert.doesNotMatch(storedSnapshot, new RegExp(forbidden, 'i'));
  }
});

test('PIN grant creation accepts every documented boundary, preserves leading zeroes, and uses unique versioned salts', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);

  const cases = [
    ['missing', {}, false],
    ['empty', { pin: '' }, false],
    ['minimum', { pin: '0123' }, true],
    ['six digits', { pin: '012345' }, true],
    ['maximum', { pin: '012345678901' }, true],
    ['same PIN first', { pin: '4826' }, true],
    ['same PIN second', { pin: '4826' }, true],
  ];
  const created = [];
  for (const [label, input, hasPin] of cases) {
    const result = await createGrant(bindings, 'event-1', {
      staffLabel: label,
      ...input,
    });
    assert.equal(result.response.status, 201, `${label}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.grant.pinRequired, hasPin, label);
    created.push(result);
  }

  const rows = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT staff_label, token_hash, pin_salt, pin_hash, pin_iterations, pin_kdf_version
    FROM event_staff_grants
    ORDER BY created_at, staff_label
  `).all();
  assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.token_hash)));
  for (const row of rows.filter(row => !['missing', 'empty'].includes(row.staff_label))) {
    assert.match(row.pin_salt, /^[A-Za-z0-9_-]{22}$/);
    assert.match(row.pin_hash, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(row.pin_iterations, 210000);
    assert.equal(row.pin_kdf_version, 2);
    assert.equal(JSON.stringify(row).includes('0123'), false);
    assert.equal(JSON.stringify(row).includes('012345'), false);
    assert.equal(JSON.stringify(row).includes('012345678901'), false);
    assert.equal(JSON.stringify(row).includes('4826'), false);
  }
  const repeated = rows.filter(row => row.staff_label.startsWith('same PIN'));
  assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].pin_salt, repeated[1].pin_salt);
  assert.notEqual(repeated[0].pin_hash, repeated[1].pin_hash);

  const leadingZeroGrant = created.find(result => result.body.grant.staffLabel === 'six digits');
  const token = inviteToken(leadingZeroGrant.body);
  const wrong = await redeem(bindings, token, '12345');
  assert.equal(wrong.response.status, 401);
  const accepted = await redeem(bindings, token, '012345');
  assert.equal(accepted.response.status, 200);
  const revokedResponse = await worker.fetch(request(
    `/api/event-staff/owner/events/event-1/grants/${leadingZeroGrant.body.grant.id}/revoke`,
    ownerInit({ method: 'POST', body: { reason: 'boundary_test_complete' } }),
  ), bindings);
  assert.equal(revokedResponse.status, 200);
  const ended = await redeem(bindings, token, '012345', { address: '203.0.113.61' });
  assert.equal(ended.response.status, 401);
});

test('PIN grant validation rejects malformed, non-string, whitespace, Unicode, and out-of-range inputs before crypto or D1', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);

  for (const [label, pin] of [
    ['too short', '123'],
    ['too long', '1'.repeat(13)],
    ['letters', '12ab'],
    ['whitespace', '    '],
    ['Unicode digits', '１２３４'],
    ['number', 1234],
    ['object', { value: '1234' }],
  ]) {
    const result = await createGrant(bindings, 'event-1', {
      staffLabel: label,
      pin,
    });
    assert.equal(result.response.status, 400, label);
    assert.equal(result.body.error, 'invalid_pin', label);
  }
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants'
  ).get().count, 0);

  const malformed = await worker.fetch(request('/api/event-staff/owner/events/event-1/grants', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'X-Court-Room': 'owner-a',
      'Content-Type': 'application/json',
    },
    body: '{"staffLabel":',
  }), bindings);
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'invalid_json');
});

test('legacy version-1 PIN grants continue to redeem with their original verifier', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);

  const token = 'L'.repeat(43);
  const pin = '0426';
  const saltBytes = Buffer.from('legacy-pin-salt');
  const salt = saltBytes.toString('base64url');
  const hash = pbkdf2Sync(pin, saltBytes, 210000, 32, 'sha256').toString('base64url');
  const event = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT owner_scope, access_epoch FROM event_staff_events WHERE event_id = ?
  `).get('event-1');
  const now = Date.now();
  bindings.EVENT_REGISTRATION_DB.database.prepare(`
    INSERT INTO event_staff_grants (
      id, owner_scope, event_id, event_access_epoch, token_hash,
      pin_salt, pin_hash, pin_iterations, pin_kdf_version, staff_label, role,
      permission_schema_version, permissions_json, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'viewOnly', 1, ?, ?, ?)
  `).run(
    'legacy-version-one',
    event.owner_scope,
    'event-1',
    event.access_epoch,
    createHash('sha256').update(token).digest('hex'),
    salt,
    hash,
    210000,
    'Legacy protected grant',
    JSON.stringify(['viewEvent']),
    now,
    now + 60 * 60 * 1000,
  );

  assert.equal((await redeem(bindings, token, '1426')).response.status, 401);
  const accepted = await redeem(bindings, token, pin, { address: '203.0.113.63' });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.state.grant.staffLabel, 'Legacy protected grant');
});

test('PIN crypto failures return a safe request ID and persist no grant or sensitive diagnostics', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const originalCrypto = globalThis.crypto;
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalConsoleError = console.error;
  const logs = [];
  t.after(() => {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    console.error = originalConsoleError;
  });
  console.error = value => logs.push(String(value));
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
    subtle: {
      digest: originalCrypto.subtle.digest.bind(originalCrypto.subtle),
      async importKey() {
        throw Object.assign(new Error('owner-a PIN 012345 leaked crypto detail'), {
          name: 'NotSupportedError',
        });
      },
      deriveBits: originalCrypto.subtle.deriveBits.bind(originalCrypto.subtle),
    },
  } });

  const result = await createGrant(bindings, 'event-1', {
    staffLabel: 'Diagnostic crypto failure',
    pin: '012345',
  });
  assert.equal(result.response.status, 500);
  assert.equal(result.body.code, 'EVENT_STAFF_GRANT_CREATION_FAILED', JSON.stringify({ body: result.body, logs }));
  assert.equal(result.body.retryable, true);
  assert.match(result.body.requestId, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(Object.hasOwn(result.body, 'inviteUrl'), false);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants'
  ).get().count, 0);
  assert.equal(logs.length, 1);
  const diagnostic = JSON.parse(logs[0]);
  assert.equal(diagnostic.requestId, result.body.requestId);
  assert.equal(diagnostic.operationStage, 'import_pin_key');
  assert.equal(diagnostic.errorClass, 'NotSupportedError');
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    'errorClass', 'eventRef', 'method', 'operationStage',
    'requestId', 'route', 'safeMessage',
  ]);
  assert.doesNotMatch(logs[0], /owner-a|012345|pin_hash|token|X-Court-Room/i);
});

test('random PIN salt failures are identified before persistence without leaking the PIN', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const originalCrypto = globalThis.crypto;
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalConsoleError = console.error;
  const logs = [];
  let randomCalls = 0;
  t.after(() => {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    console.error = originalConsoleError;
  });
  console.error = value => logs.push(String(value));
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues(value) {
      randomCalls += 1;
      if (randomCalls === 4) throw new Error('salt failed for PIN 012345');
      return originalCrypto.getRandomValues(value);
    },
    subtle: originalCrypto.subtle,
  } });

  const result = await createGrant(bindings, 'event-1', {
    staffLabel: 'Diagnostic salt failure',
    pin: '012345',
  });
  assert.equal(result.response.status, 500);
  assert.equal(result.body.code, 'EVENT_STAFF_GRANT_CREATION_FAILED');
  assert.equal(Object.hasOwn(result.body, 'inviteUrl'), false);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants'
  ).get().count, 0);
  assert.equal(JSON.parse(logs[0]).operationStage, 'generate_pin_salt');
  assert.doesNotMatch(logs[0], /012345|owner-a|salt failed|X-Court-Room/i);
});

test('PBKDF2 deriveBits failures are stage-logged safely and create no grant', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const originalCrypto = globalThis.crypto;
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalConsoleError = console.error;
  const logs = [];
  t.after(() => {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    console.error = originalConsoleError;
  });
  console.error = value => logs.push(String(value));
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
    subtle: {
      digest: originalCrypto.subtle.digest.bind(originalCrypto.subtle),
      importKey: originalCrypto.subtle.importKey.bind(originalCrypto.subtle),
      async deriveBits() {
        throw new Error('derive failed for PIN 012345 and owner-a');
      },
    },
  } });

  const result = await createGrant(bindings, 'event-1', {
    staffLabel: 'Diagnostic derivation failure',
    pin: '012345',
  });
  assert.equal(result.response.status, 500);
  assert.equal(result.body.code, 'EVENT_STAFF_GRANT_CREATION_FAILED');
  assert.equal(Object.hasOwn(result.body, 'inviteUrl'), false);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants'
  ).get().count, 0);
  assert.equal(JSON.parse(logs[0]).operationStage, 'derive_pin_hash');
  assert.doesNotMatch(logs[0], /012345|owner-a|derive failed|X-Court-Room/i);
});

test('PIN hash encoding failures withhold the invite and persist no partial grant', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const originalBtoa = globalThis.btoa;
  const originalConsoleError = console.error;
  const logs = [];
  let calls = 0;
  t.after(() => {
    globalThis.btoa = originalBtoa;
    console.error = originalConsoleError;
  });
  console.error = value => logs.push(String(value));
  globalThis.btoa = value => {
    calls += 1;
    if (calls === 5) throw new Error('encoding failed with PIN 012345');
    return originalBtoa(value);
  };

  const result = await createGrant(bindings, 'event-1', {
    staffLabel: 'Diagnostic encoding failure',
    pin: '012345',
  });
  assert.equal(result.response.status, 500);
  assert.equal(result.body.code, 'EVENT_STAFF_GRANT_CREATION_FAILED', JSON.stringify({ body: result.body, logs }));
  assert.equal(Object.hasOwn(result.body, 'inviteUrl'), false);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants'
  ).get().count, 0);
  assert.equal(JSON.parse(logs[0]).operationStage, 'encode_pin_hash');
  assert.doesNotMatch(logs[0], /012345|legacy-pin-salt|owner-a|X-Court-Room/i);
});

test('atomic D1 grant/audit failures return a request ID without a usable partial grant', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const originalBatch = bindings.EVENT_REGISTRATION_DB.batch.bind(bindings.EVENT_REGISTRATION_DB);
  const originalConsoleError = console.error;
  const logs = [];
  t.after(() => {
    bindings.EVENT_REGISTRATION_DB.batch = originalBatch;
    console.error = originalConsoleError;
  });
  console.error = value => logs.push(String(value));
  bindings.EVENT_REGISTRATION_DB.batch = async () => {
    throw new Error('D1 rejected SQL containing PIN 012345 and owner-a');
  };

  const result = await createGrant(bindings, 'event-1', {
    staffLabel: 'Diagnostic D1 failure',
    pin: '012345',
  });
  assert.equal(result.response.status, 500);
  assert.equal(result.body.code, 'EVENT_STAFF_GRANT_CREATION_FAILED');
  assert.match(result.body.requestId, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(Object.hasOwn(result.body, 'inviteUrl'), false);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants'
  ).get().count, 0);
  assert.equal(JSON.parse(logs[0]).operationStage, 'insert_grant_and_audit');
  assert.doesNotMatch(logs[0], /012345|owner-a|X-Court-Room|rejected SQL/i);
});

test('owner snapshots reject cross-event references and only expose explicit event projections', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());

  const wrongGameEvent = fixedSnapshot('bad-game-event');
  wrongGameEvent.games = [{
    id: 'bad-game',
    date: Date.now(),
    teamA: ['player-a', 'player-b'],
    teamB: ['player-c', 'player-d'],
    unkA: 0,
    unkB: 0,
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    log: {},
    evId: 'another-event',
    evA: 'team-a',
    evB: 'team-b',
  }];
  wrongGameEvent.matches[0].gameIds = ['bad-game'];
  const wrongGame = await seedSnapshot(bindings, 'bad-game-event', wrongGameEvent);
  assert.equal(wrongGame.response.status, 400);
  assert.equal(wrongGame.body.error, 'invalid_games');

  const outsider = fixedSnapshot('outsider-event');
  outsider.participants.push({
    id: 'outsider-player',
    name: 'Outside Person',
    active: true,
  });
  const unlinkedParticipant = await seedSnapshot(bindings, 'outsider-event', outsider);
  assert.equal(unlinkedParticipant.response.status, 400);
  assert.equal(unlinkedParticipant.body.error, 'unlinked_participant');

  const unknownEntry = fixedSnapshot('unknown-entry-event');
  unknownEntry.matches[0].teamAId = 'another-team';
  const unlinkedEntry = await seedSnapshot(bindings, 'unknown-entry-event', unknownEntry);
  assert.equal(unlinkedEntry.response.status, 400);
  assert.equal(unlinkedEntry.body.error, 'unlinked_match_entry');

  const rosterMismatch = fixedSnapshot('roster-mismatch-event');
  rosterMismatch.matches[0].sideAPlayerIds = ['player-a'];
  const mismatchedPlayers = await seedSnapshot(bindings, 'roster-mismatch-event', rosterMismatch);
  assert.equal(mismatchedPlayers.response.status, 400);
  assert.equal(mismatchedPlayers.body.error, 'match_participant_mismatch');

  const mismatchedGame = fixedSnapshot('game-roster-mismatch');
  mismatchedGame.games = [{
    id: 'mismatched-game',
    date: Date.now(),
    teamA: ['player-a', 'player-c'],
    teamB: ['player-b', 'player-d'],
    unkA: 0,
    unkB: 0,
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    log: {},
    evId: 'game-roster-mismatch',
    evA: 'team-a',
    evB: 'team-b',
  }];
  mismatchedGame.matches[0].gameIds = ['mismatched-game'];
  const mismatchedHistoricalGame = await seedSnapshot(
    bindings,
    'game-roster-mismatch',
    mismatchedGame,
  );
  assert.equal(mismatchedHistoricalGame.response.status, 400);
  assert.equal(mismatchedHistoricalGame.body.error, 'game_participant_mismatch');

  const crossCheckIn = fixedSnapshot('cross-check-in-event');
  crossCheckIn.event.teams[0].registrationId = 'registration-a';
  crossCheckIn.event.teams[0].checkIn = {
    teamStatus: 'checked_in',
    activePlayerIds: ['player-a', 'player-c'],
    substitutePlayerIds: [],
    playerStatuses: { 'player-a': 'present', 'player-c': 'present' },
    updatedAt: Date.now(),
  };
  crossCheckIn.event.registrationCheckIn = {
    entries: {
      'registration-a': structuredClone(crossCheckIn.event.teams[0].checkIn),
    },
    updatedAt: Date.now(),
  };
  const crossPlayer = await seedSnapshot(bindings, 'cross-check-in-event', crossCheckIn);
  assert.equal(crossPlayer.response.status, 400);
  assert.equal(crossPlayer.body.error, 'cross_event_check_in_participant');

  const crossRegistration = fixedSnapshot('cross-registration-event');
  crossRegistration.event.registrationCheckIn = {
    entries: {
      'another-event-registration': {
        teamStatus: 'checked_in',
        activePlayerIds: ['player-a'],
        substitutePlayerIds: [],
        playerStatuses: { 'player-a': 'present' },
        updatedAt: Date.now(),
      },
    },
    updatedAt: Date.now(),
  };
  const crossRegistrationRow = await seedSnapshot(
    bindings,
    'cross-registration-event',
    crossRegistration,
  );
  assert.equal(crossRegistrationRow.response.status, 400);
  assert.equal(crossRegistrationRow.body.error, 'cross_event_registration_check_in');

  const foreignTombstone = fixedSnapshot('foreign-tombstone-event', {
    deletedGameIds: { 'unrelated-root-game': Date.now() },
  });
  const tombstone = await seedSnapshot(bindings, 'foreign-tombstone-event', foreignTombstone);
  assert.equal(tombstone.response.status, 400);
  assert.equal(tombstone.body.error, 'unlinked_deleted_game');

  const safe = fixedSnapshot('safe-projection-event');
  safe.event.syncSecret = 'owner-sync-secret';
  safe.participants[0].seedRating = 99;
  safe.participants[0].privateNote = 'owner-only player note';
  safe.matches[0].ownerPrivatePlacement = 'hidden';
  const seeded = await seedSnapshot(bindings, 'safe-projection-event', safe);
  assert.equal(seeded.response.status, 201, JSON.stringify(seeded.body));
  const stored = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT participants_json, matches_json
    FROM event_staff_events WHERE event_id = ?
  `).get('safe-projection-event');
  assert.doesNotMatch(stored.participants_json, /seedRating|privateNote|owner-only/i);
  assert.doesNotMatch(stored.matches_json, /ownerPrivatePlacement|hidden/i);

  const grant = await createGrant(bindings, 'safe-projection-event', { role: 'viewOnly' });
  const accepted = await redeem(bindings, inviteToken(grant.body));
  assert.equal(accepted.response.status, 200);
  assert.doesNotMatch(JSON.stringify(accepted.body.state), /syncSecret|owner-sync-secret|seedRating|privateNote/i);

  const historical = fixedSnapshot('historical-projection-event');
  historical.participants.push({
    id: 'player-new',
    name: 'New Roster Player',
    active: true,
  });
  historical.event.teams[0].players = ['player-new', 'player-b'];
  historical.matches[0].sideAPlayerIds = ['player-new', 'player-b'];
  historical.games = [{
    id: 'historical-game',
    date: Date.now() - 60_000,
    teamA: ['player-a', 'player-b'],
    teamB: ['player-c', 'player-d'],
    unkA: 0,
    unkB: 0,
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    log: { 'player-a': { ace: 1 } },
    evId: 'historical-projection-event',
    evA: 'team-a',
    evB: 'team-b',
    ratingVersion: 2,
    detailed: true,
    eventFamilies: { serve: ['ace'] },
  }];
  historical.matches[0].gameIds = ['historical-game'];
  historical.historicalGameIds = ['historical-game'];
  const historicalSeeded = await seedSnapshot(
    bindings,
    'historical-projection-event',
    historical,
  );
  assert.equal(historicalSeeded.response.status, 201, JSON.stringify(historicalSeeded.body));
});

test('grant validation, rotation, individual revocation, revoke-all epochs, and owner audit are scoped', async t => {
  const bindings = env({
    rooms: {
      'room:owner-a': JSON.stringify({ ts: 1, data: '{}' }),
      'room:owner-b': JSON.stringify({ ts: 1, data: '{}' }),
    },
  });
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);

  const invalidRole = await createGrant(bindings, 'event-1', { role: 'owner' });
  assert.equal(invalidRole.response.status, 400);
  assert.equal(invalidRole.body.error, 'invalid_role');
  const tooLong = await createGrant(bindings, 'event-1', { expiresAt: Date.now() + 31 * 24 * 60 * 60 * 1000 });
  assert.equal(tooLong.response.status, 400);
  assert.equal(tooLong.body.error, 'invalid_expiration');
  const invalidPin = await createGrant(bindings, 'event-1', { pin: '12ab' });
  assert.equal(invalidPin.response.status, 400);
  assert.equal(invalidPin.body.error, 'invalid_pin');

  const first = await createGrant(bindings);
  assert.equal(first.response.status, 201);
  const crossOwner = await worker.fetch(request('/api/event-staff/owner/events/event-1/grants', ownerInit({ room: 'owner-b' })), bindings);
  assert.equal(crossOwner.status, 404);

  const rotateResponse = await worker.fetch(request(`/api/event-staff/owner/events/event-1/grants/${first.body.grant.id}/rotate`, ownerInit({
    method: 'POST',
    body: { expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, pin: '9632', reason: 'New score table device' },
  })), bindings);
  const rotated = await rotateResponse.json();
  assert.equal(rotateResponse.status, 201);
  assert.notEqual(rotated.grant.id, first.body.grant.id);
  assert.match(rotated.inviteUrl, /\/staff#token=[A-Za-z0-9_-]{43}$/);
  const original = bindings.EVENT_REGISTRATION_DB.database.prepare('SELECT revoked_at FROM event_staff_grants WHERE id = ?').get(first.body.grant.id);
  assert.ok(Number(original.revoked_at) > 0);

  const revokeResponse = await worker.fetch(request(`/api/event-staff/owner/events/event-1/grants/${rotated.grant.id}/revoke`, ownerInit({
    method: 'POST',
    body: { reason: 'Shift complete' },
  })), bindings);
  const revoked = await revokeResponse.json();
  assert.equal(revokeResponse.status, 200);
  assert.equal(revoked.grant.status, 'revoked');
  assert.equal(Object.hasOwn(revoked, 'inviteUrl'), false);

  const replacement = await createGrant(bindings, 'event-1', { role: 'viewOnly', staffLabel: 'Court Marshal' });
  assert.equal(replacement.response.status, 201);
  const revokeAllResponse = await worker.fetch(request('/api/event-staff/owner/events/event-1/revoke-all', ownerInit({
    method: 'POST',
    body: { expectedRevision: 1, reason: 'Emergency close' },
  })), bindings);
  const revokeAll = await revokeAllResponse.json();
  assert.equal(revokeAllResponse.status, 200);
  assert.equal(revokeAll.accessEpoch, 2);
  assert.equal(revokeAll.revision, 2);
  assert.equal(revokeAll.revokedCount, 1);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants WHERE owner_scope = (SELECT owner_scope FROM event_staff_events WHERE event_id = ?) AND revoked_at IS NULL'
  ).get('event-1').count, 0);

  const auditResponse = await worker.fetch(request('/api/event-staff/owner/events/event-1/audit', ownerInit()), bindings);
  const audit = await auditResponse.json();
  assert.equal(auditResponse.status, 200);
  assert.ok(audit.activity.some(row => row.action === 'grant.created'));
  assert.ok(audit.activity.some(row => row.action === 'grant.rotated'));
  assert.ok(audit.activity.some(row => row.action === 'grant.revoked'));
  assert.ok(audit.activity.some(row => row.action === 'grant.revokeAll'));
  assert.doesNotMatch(JSON.stringify(audit), /9632|owner-a|room:/);
  assert.equal(auditResponse.headers.get('cache-control'), 'no-store');
});

test('owner-wide emergency revocation advances only that owner events and audits every affected event', async t => {
  const bindings = env({
    rooms: {
      'room:owner-a': JSON.stringify({ ts: 1, data: '{}' }),
      'room:owner-b': JSON.stringify({ ts: 1, data: '{}' }),
    },
  });
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings, 'owner-a-event-1', fixedSnapshot('owner-a-event-1'))).response.status, 201);
  assert.equal((await seedSnapshot(bindings, 'owner-a-event-2', fixedSnapshot('owner-a-event-2'))).response.status, 201);
  assert.equal((await seedSnapshot(
    bindings,
    'owner-b-event',
    fixedSnapshot('owner-b-event'),
    'owner-b',
  )).response.status, 201);

  const grantA1 = await createGrant(bindings, 'owner-a-event-1', { staffLabel: 'A one' });
  const grantA2 = await createGrant(bindings, 'owner-a-event-2', { staffLabel: 'A two' });
  const grantB = await createGrant(bindings, 'owner-b-event', { staffLabel: 'B one' }, 'owner-b');
  const sessionA1 = await redeem(bindings, inviteToken(grantA1.body));
  const sessionA2 = await redeem(bindings, inviteToken(grantA2.body));
  const sessionB = await redeem(bindings, inviteToken(grantB.body));
  assert.equal(sessionA1.response.status, 200);
  assert.equal(sessionA2.response.status, 200);
  assert.equal(sessionB.response.status, 200);

  const revokedResponse = await worker.fetch(request('/api/event-staff/owner/revoke-all', ownerInit({
    method: 'POST',
    body: { reason: 'Owner credential may be exposed' },
  })), bindings);
  const revoked = await revokedResponse.json();
  assert.equal(revokedResponse.status, 200, JSON.stringify(revoked));
  assert.equal(revoked.eventCount, 2);
  assert.equal(revoked.revokedCount, 2);

  const eventRows = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT event_id, access_epoch, revision
    FROM event_staff_events
    ORDER BY event_id
  `).all();
  assert.deepEqual(eventRows.map(row => ({ ...row })), [
    { event_id: 'owner-a-event-1', access_epoch: 2, revision: 2 },
    { event_id: 'owner-a-event-2', access_epoch: 2, revision: 2 },
    { event_id: 'owner-b-event', access_epoch: 1, revision: 1 },
  ]);
  for (const session of [sessionA1, sessionA2]) {
    const ended = await worker.fetch(
      request('/api/event-staff/state', staffInit(session.body.sessionToken)),
      bindings,
    );
    assert.equal(ended.status, 401);
    assert.equal((await ended.json()).error, 'access_revoked');
  }
  const ownerBState = await worker.fetch(
    request('/api/event-staff/state', staffInit(sessionB.body.sessionToken)),
    bindings,
  );
  assert.equal(ownerBState.status, 200);

  const ownerAScope = bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT owner_scope FROM event_staff_events WHERE event_id = ?'
  ).get('owner-a-event-1').owner_scope;
  const ownerBScope = bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT owner_scope FROM event_staff_events WHERE event_id = ?'
  ).get('owner-b-event').owner_scope;
  const audits = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT event_id, action_type, resulting_revision, new_json
    FROM event_staff_audit
    WHERE owner_scope = ? AND action_type = 'owner.revokeAll'
    ORDER BY event_id
  `).all(ownerAScope);
  assert.deepEqual(audits.map(row => [row.event_id, row.action_type, row.resulting_revision]), [
    ['owner-a-event-1', 'owner.revokeAll', 2],
    ['owner-a-event-2', 'owner.revokeAll', 2],
  ]);
  assert.ok(audits.every(row =>
    JSON.parse(row.new_json).reason === 'Owner credential may be exposed'
  ));
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT COUNT(*) AS count FROM event_staff_audit
    WHERE owner_scope = ? AND action_type = 'owner.revokeAll'
  `).get(ownerBScope).count, 0);
});

test('at most ten grants are active in one event and rotation cannot bypass the limit', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const grants = [];
  for (let index = 0; index < 10; index += 1) {
    const created = await createGrant(bindings, 'event-1', { staffLabel: `Staff ${index + 1}` });
    assert.equal(created.response.status, 201);
    grants.push(created.body.grant);
  }
  const rejected = await createGrant(bindings, 'event-1', { staffLabel: 'Staff 11' });
  assert.equal(rejected.response.status, 409);
  assert.equal(rejected.body.error, 'grant_limit_reached');
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants WHERE revoked_at IS NULL'
  ).get().count, 10);

  const rotateResponse = await worker.fetch(request(`/api/event-staff/owner/events/event-1/grants/${grants[0].id}/rotate`, ownerInit({
    method: 'POST',
    body: {},
  })), bindings);
  assert.equal(rotateResponse.status, 201);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_grants WHERE revoked_at IS NULL'
  ).get().count, 10);
});

test('link redemption requires the optional PIN, stores only a session hash, and returns role-scoped event state', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const created = await createGrant(bindings, 'event-1', { pin: '4826' });
  const token = inviteToken(created.body);

  const wrong = await redeem(bindings, token, '0000');
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.body.error, 'access_denied');
  assert.doesNotMatch(JSON.stringify(wrong.body), /token|pin.*correct|4826/i);
  const oversized = await redeem(bindings, token, '9'.repeat(20_000), {
    address: '203.0.113.11',
  });
  assert.equal(oversized.response.status, 401);
  assert.equal(oversized.body.error, 'access_denied');
  assert.doesNotMatch(JSON.stringify(oversized.body), /too long|4 to 12|20,?000/i);
  const crossOrigin = await redeem(bindings, token, '4826', { origin: 'https://evil.example' });
  assert.equal(crossOrigin.response.status, 403);

  const accepted = await redeem(bindings, token, '4826');
  assert.equal(accepted.response.status, 200);
  assert.match(accepted.body.sessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(accepted.body.queueScope, /^[a-f0-9]{64}$/);
  assert.ok(accepted.body.sessionExpiresAt > Date.now());
  const storedSession = bindings.EVENT_REGISTRATION_DB.database.prepare('SELECT * FROM event_staff_sessions').get();
  assert.match(storedSession.session_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(storedSession.session_hash, accepted.body.sessionToken);
  assert.equal(JSON.stringify(storedSession).includes(accepted.body.sessionToken), false);

  const state = accepted.body.state;
  assert.equal(state.event.id, 'event-1');
  assert.equal(state.grant.role, 'scorekeeper');
  assert.equal(state.participants.find(player => player.id === 'player-b').active, false);
  assert.equal(Object.hasOwn(state, 'contacts'), false);
  assert.equal(Object.hasOwn(state, 'activity'), false);
  for (const forbidden of ['seedRating', 'ratingVersion', 'eventFamilies', 'deltas', 'winProb', 'owner_scope', 'room:', 'sync', 'backup']) {
    assert.doesNotMatch(JSON.stringify(state), new RegExp(forbidden, 'i'));
  }
  assert.equal(accepted.response.headers.get('cache-control'), 'no-store');
  assert.equal(accepted.response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(accepted.response.headers.get('x-robots-tag'), /noindex/);

  const refreshResponse = await worker.fetch(
    request('/api/event-staff/state?eventId=another-event', staffInit(accepted.body.sessionToken)),
    bindings,
  );
  const refreshed = await refreshResponse.json();
  assert.equal(refreshResponse.status, 200);
  assert.equal(refreshed.state.event.id, 'event-1');
  assert.equal(JSON.stringify(refreshed).includes('another-event'), false);

  const listed = await (await worker.fetch(request('/api/event-staff/owner/events/event-1/grants', ownerInit()), bindings)).json();
  assert.ok(Number(listed.grants[0].lastUsedAt) > 0);
});

test('only invalid redemptions consume the bounded token and address attempt budget', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const created = await createGrant(bindings, 'event-1', { pin: '4826' });
  const token = inviteToken(created.body);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const valid = await redeem(bindings, token, '4826', { address: '203.0.113.20' });
    assert.equal(valid.response.status, 200, `valid redemption ${attempt + 1} was throttled`);
  }
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COALESCE(SUM(attempt_count), 0) AS count FROM event_staff_rate_limits'
  ).get().count, 0);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const invalid = await redeem(bindings, token, '0000', { address: '203.0.113.21' });
    assert.equal(invalid.response.status, 401, `invalid redemption ${attempt + 1} was not generic`);
    assert.equal(invalid.body.error, 'access_denied');
  }
  const limited = await redeem(bindings, token, '0000', { address: '203.0.113.21' });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.body.error, 'rate_limited');
  assert.ok(Number(limited.body.retryAfter) > 0);
  assert.doesNotMatch(JSON.stringify(limited.body), /4826|pin.*correct|token.*correct/i);
});

test('concurrent redemption guesses share one token-global budget across addresses', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const created = await createGrant(bindings, 'event-1', { pin: '4826' });
  const token = inviteToken(created.body);

  const burst = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    redeem(bindings, token, '0000', { address: `198.51.100.${index + 1}` })
  ));
  const statuses = burst.map(result => result.response.status);
  assert.equal(statuses.filter(status => status === 401).length, 10);
  assert.equal(statuses.filter(status => status === 429).length, 10);
  assert.ok(burst.filter(result => result.response.status === 401)
    .every(result => result.body.error === 'access_denied'));
  assert.ok(burst.filter(result => result.response.status === 429)
    .every(result => result.body.error === 'rate_limited'));

  const validFromAnotherAddress = await redeem(bindings, token, '4826', {
    address: '203.0.113.250',
  });
  assert.equal(validFromAnotherAddress.response.status, 429);
  assert.equal(validFromAnotherAddress.body.error, 'rate_limited');
  const counters = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT attempt_count FROM event_staff_rate_limits
    ORDER BY attempt_count DESC
  `).all();
  assert.equal(counters[0].attempt_count, 10, 'the token-global counter exceeded its cap');
});

test('a capped address cannot create unbounded token rate-limit rows or consume a valid token budget', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const created = await createGrant(bindings);
  const token = inviteToken(created.body);
  const cappedAddress = '198.51.100.77';

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const invalid = await redeem(bindings, `invalid-token-${attempt}`, undefined, {
      address: cappedAddress,
    });
    assert.equal(invalid.response.status, 401);
  }
  const rowsAtCap = bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_rate_limits'
  ).get().count;
  assert.equal(rowsAtCap, 41, 'expected one address row and forty bounded token rows');

  for (let attempt = 40; attempt < 80; attempt += 1) {
    const limited = await redeem(bindings, `invalid-token-${attempt}`, undefined, {
      address: cappedAddress,
    });
    assert.equal(limited.response.status, 429);
  }
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_rate_limits'
  ).get().count, rowsAtCap, 'capped address requests created fresh token-scope rows');

  const validAtCap = await redeem(bindings, token, undefined, { address: cappedAddress });
  assert.equal(validAtCap.response.status, 429);
  const validElsewhere = await redeem(bindings, token, undefined, {
    address: '203.0.113.199',
  });
  assert.equal(validElsewhere.response.status, 200);
});

test('active sessions are bounded per grant and ended sessions are pruned without charging the token budget', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const created = await createGrant(bindings);
  const token = inviteToken(created.body);
  const sessions = [];
  for (let index = 0; index < 12; index += 1) {
    const accepted = await redeem(bindings, token, undefined, {
      address: `203.0.113.${index + 1}`,
    });
    assert.equal(accepted.response.status, 200);
    sessions.push(accepted.body.sessionToken);
  }
  const capped = await redeem(bindings, token, undefined, { address: '203.0.113.50' });
  assert.equal(capped.response.status, 401);
  assert.equal(capped.body.error, 'access_denied');
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_rate_limits'
  ).get().count, 0, 'a valid credential at the session cap consumed failure budget');

  const logout = await worker.fetch(request('/api/event-staff/logout', staffInit(sessions[0], {
    method: 'POST',
    body: {},
  })), bindings);
  assert.equal(logout.status, 200);
  const replacement = await redeem(bindings, token, undefined, { address: '203.0.113.51' });
  assert.equal(replacement.response.status, 200);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT COUNT(*) AS count FROM event_staff_sessions
    WHERE grant_id = ? AND revoked_at IS NULL AND expires_at > ?
  `).get(created.body.grant.id, Date.now()).count, 12);
});

test('grant, session, expiry, and access-epoch revocation are enforced on every staff request', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);

  const revokedGrant = await createGrant(bindings);
  const revokedSession = await redeem(bindings, inviteToken(revokedGrant.body));
  assert.equal(revokedSession.response.status, 200);
  const revokeGrantResponse = await worker.fetch(request(`/api/event-staff/owner/events/event-1/grants/${revokedGrant.body.grant.id}/revoke`, ownerInit({
    method: 'POST', body: {},
  })), bindings);
  assert.equal(revokeGrantResponse.status, 200, await revokeGrantResponse.clone().text());
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name LIKE 'event_staff_%'"
  ).get().count, 6);
  const revokedState = await worker.fetch(
    request('/api/event-staff/state', staffInit(revokedSession.body.sessionToken)),
    bindings,
  );
  const revokedStateBody = await revokedState.json();
  assert.equal(revokedState.status, 401, JSON.stringify(revokedStateBody));
  assert.equal(revokedStateBody.error, 'access_revoked');

  const epochGrant = await createGrant(bindings, 'event-1', { staffLabel: 'Epoch staff' });
  const epochSession = await redeem(bindings, inviteToken(epochGrant.body));
  assert.equal(epochSession.response.status, 200);
  const revokeAll = await worker.fetch(request('/api/event-staff/owner/events/event-1/revoke-all', ownerInit({
    method: 'POST', body: { expectedRevision: 1 },
  })), bindings);
  assert.equal(revokeAll.status, 200);
  const epochState = await worker.fetch(
    request('/api/event-staff/state', staffInit(epochSession.body.sessionToken)),
    bindings,
  );
  assert.equal(epochState.status, 401);
  assert.equal((await epochState.json()).error, 'access_revoked');

  const freshSnapshot = fixedSnapshot('event-1', { expectedRevision: 2 });
  const refreshed = await seedSnapshot(bindings, 'event-1', freshSnapshot);
  assert.equal(refreshed.response.status, 200);

  const expiringGrant = await createGrant(bindings, 'event-1', {
    staffLabel: 'Mid-session expiry staff',
  });
  const expiringSession = await redeem(bindings, inviteToken(expiringGrant.body));
  assert.equal(expiringSession.response.status, 200);
  assert.ok(expiringSession.body.sessionExpiresAt > Date.now());
  const beforeMidSessionExpiry = storedEventStaffState(bindings);
  bindings.EVENT_REGISTRATION_DB.database.prepare(`
    UPDATE event_staff_grants SET created_at = ?, expires_at = ? WHERE id = ?
  `).run(Date.now() - 10_000, Date.now() - 1, expiringGrant.body.grant.id);
  const expiredOperation = await operate(bindings, expiringSession.body.sessionToken, {
    eventId: 'event-1',
    action: 'recordEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 3,
    idempotencyKey: 'expired-session-score',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'A' },
  });
  assert.equal(expiredOperation.response.status, 401);
  assert.equal(expiredOperation.body.error, 'access_expired');
  assert.deepEqual(storedEventStaffState(bindings), beforeMidSessionExpiry);
  const expiredSessionState = await worker.fetch(
    request('/api/event-staff/state', staffInit(expiringSession.body.sessionToken)),
    bindings,
  );
  assert.equal(expiredSessionState.status, 401);
  assert.equal((await expiredSessionState.json()).error, 'access_expired');

  const expiredGrant = await createGrant(bindings, 'event-1', { staffLabel: 'Expired staff' });
  bindings.EVENT_REGISTRATION_DB.database.prepare(`
    UPDATE event_staff_grants SET created_at = ?, expires_at = ? WHERE id = ?
  `).run(Date.now() - 10_000, Date.now() - 1, expiredGrant.body.grant.id);
  const expired = await redeem(bindings, inviteToken(expiredGrant.body));
  assert.equal(expired.response.status, 401);
  assert.equal(expired.body.error, 'access_denied');

  const logoutGrant = await createGrant(bindings, 'event-1', { staffLabel: 'Logout staff' });
  const logoutSession = await redeem(bindings, inviteToken(logoutGrant.body));
  const logout = await worker.fetch(request('/api/event-staff/logout', staffInit(logoutSession.body.sessionToken, {
    method: 'POST', body: {},
  })), bindings);
  assert.equal(logout.status, 200);
  const afterLogout = await worker.fetch(
    request('/api/event-staff/state', staffInit(logoutSession.body.sessionToken)),
    bindings,
  );
  assert.equal(afterLogout.status, 401);
});

test('event deletion and explicit restore reset prevent old grants from reviving on reused IDs', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const originalGrant = await createGrant(bindings);
  const originalToken = inviteToken(originalGrant.body);
  const originalSession = await redeem(bindings, originalToken);
  assert.equal(originalSession.response.status, 200);

  const deleted = await seedSnapshot(bindings, 'event-1', fixedSnapshot('event-1', {
    expectedRevision: 1,
    deleted: true,
  }));
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.deleted, true);
  assert.equal(deleted.body.revision, 2);
  assert.equal(deleted.body.accessEpoch, 2);
  assert.ok(Number(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT revoked_at FROM event_staff_grants WHERE id = ?'
  ).get(originalGrant.body.grant.id).revoked_at) > 0);

  const ended = await worker.fetch(
    request('/api/event-staff/state', staffInit(originalSession.body.sessionToken)),
    bindings,
  );
  assert.equal(ended.status, 401);
  assert.equal((await ended.json()).error, 'access_revoked');
  assert.equal((await redeem(bindings, originalToken)).response.status, 401);

  const unsafeRestore = await seedSnapshot(bindings, 'event-1', fixedSnapshot('event-1', {
    expectedRevision: 2,
  }));
  assert.equal(unsafeRestore.response.status, 409);
  assert.equal(unsafeRestore.body.error, 'event_access_reset_required');

  const restored = await seedSnapshot(bindings, 'event-1', fixedSnapshot('event-1', {
    expectedRevision: 2,
    resetAccess: true,
  }));
  assert.equal(restored.response.status, 200);
  assert.equal(restored.body.revision, 3);
  assert.equal(restored.body.accessEpoch, 3);
  assert.equal((await redeem(bindings, originalToken)).response.status, 401);

  const freshGrant = await createGrant(bindings, 'event-1', { staffLabel: 'Restored event desk' });
  assert.equal(freshGrant.response.status, 201);
  assert.equal((await redeem(bindings, inviteToken(freshGrant.body))).response.status, 200);
});

test('legacy root omission atomically deletes staff access while preserving detached rating history', async t => {
  const rootData = {
    players: fixedSnapshot().participants,
    games: [],
    events: [fixedSnapshot().event],
    deletions: { games: {}, players: {}, events: {} },
    tomb: {},
    v: 4,
  };
  const bindings = env({
    rooms: { 'room:owner-a': syncEnvelope(rootData, 100) },
  });
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const grant = await createGrant(bindings);
  const session = await redeem(bindings, inviteToken(grant.body));
  assert.equal(session.response.status, 200);
  const scored = await operate(bindings, session.body.sessionToken, {
    eventId: 'event-1',
    action: 'recordEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'legacy-delete-score',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'A' },
  });
  assert.equal(scored.response.status, 200, JSON.stringify(scored.body));
  const scoredGameId = scored.body.state.games[0].id;

  const omitted = structuredClone(rootData);
  omitted.events = [];
  const deleted = await worker.fetch(request('/?room=owner-a', {
    method: 'POST',
    body: syncEnvelope(omitted, 101),
  }), bindings);
  assert.equal(deleted.status, 200, await deleted.clone().text());
  assert.equal((await worker.fetch(
    request('/api/event-staff/state', staffInit(session.body.sessionToken)),
    bindings,
  )).status, 401);
  const row = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT revision, access_epoch, deleted_at
    FROM event_staff_events WHERE event_id = 'event-1'
  `).get();
  assert.equal(row.revision, 3);
  assert.equal(row.access_epoch, 2);
  assert.ok(Number(row.deleted_at) > 0);
  assert.equal(bindings.COURT.puts.length, 1);
  const storedEnvelope = JSON.parse(bindings.COURT.values.get('room:owner-a'));
  const stored = JSON.parse(storedEnvelope.data);
  assert.equal(stored.events.some(event => event.id === 'event-1'), false);
  const historical = stored.games.find(game => game.id === scoredGameId);
  assert.ok(historical, 'unsynchronized staff game was lost during deletion');
  assert.deepEqual(historical.teamA, ['player-a', 'player-b']);
  assert.equal(historical.scoreA, 25);
  assert.equal(Object.hasOwn(historical, 'evId'), false);
  assert.equal(Object.hasOwn(historical, 'evA'), false);
  assert.equal(Object.hasOwn(historical, 'evMatchId'), false);
  assert.equal(stored.eventStaffRevisions['event-1'], 3);
  assert.equal(stored.deletions.events['event-1'], row.deleted_at);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT COUNT(*) AS count FROM event_staff_audit
    WHERE event_id = 'event-1' AND action_type = 'event.deleted'
  `).get().count, 1);

  const linkedGames = JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    "SELECT games_json FROM event_staff_events WHERE event_id = 'event-1'"
  ).get().games_json);
  const restoredSnapshot = fixedSnapshot('event-1', {
    expectedRevision: 3,
    resetAccess: true,
    games: linkedGames,
  });
  restoredSnapshot.matches[0].gameIds = [scoredGameId];
  restoredSnapshot.matches[0].status = 'complete';
  const reset = await seedSnapshot(bindings, 'event-1', restoredSnapshot);
  assert.equal(reset.response.status, 200, JSON.stringify(reset.body));
  assert.equal(reset.body.revision, 4);

  const restoredRoot = structuredClone(stored);
  restoredRoot.events.push(fixedSnapshot().event);
  restoredRoot.eventStaffRevisions['event-1'] = 4;
  const restoredPost = await worker.fetch(request('/?room=owner-a', {
    method: 'POST',
    body: syncEnvelope(restoredRoot, 102),
  }), bindings);
  assert.equal(restoredPost.status, 200, await restoredPost.clone().text());
  const restoredStored = JSON.parse(JSON.parse(
    bindings.COURT.values.get('room:owner-a')
  ).data);
  assert.equal(restoredStored.events.some(event => event.id === 'event-1'), true);
  assert.equal(Object.hasOwn(restoredStored.deletions.events, 'event-1'), false);
  assert.equal(restoredStored.games.find(game => game.id === scoredGameId).evId, 'event-1');
});

test('fixed-event scoring is scoped, revisioned, idempotent, canonical, correctable, and tie-safe', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const created = await createGrant(bindings);
  const accepted = await redeem(bindings, inviteToken(created.body));
  const sessionToken = accepted.body.sessionToken;
  const operatorGrant = await createGrant(bindings, 'event-1', {
    role: 'tournamentOperator',
    staffLabel: 'Score validation operator',
  });
  const operatorSession = await redeem(bindings, inviteToken(operatorGrant.body));
  assert.equal(operatorSession.response.status, 200);
  const firstOperation = {
    eventId: 'event-1',
    action: 'recordEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'fixed-score-0001',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'A' },
  };

  const beforeMissingTargets = storedEventStaffState(bindings);
  const missingMatch = await operate(bindings, sessionToken, {
    ...firstOperation,
    targetId: 'fixed-match-replaced',
    idempotencyKey: 'missing-match-score',
  });
  assert.equal(missingMatch.response.status, 404);
  assert.equal(missingMatch.body.error, 'match_not_found');
  assert.deepEqual(storedEventStaffState(bindings), beforeMissingTargets);
  const missingScore = await operate(bindings, operatorSession.body.sessionToken, {
    ...firstOperation,
    action: 'correctEventScore',
    idempotencyKey: 'missing-score-correction',
  });
  assert.equal(missingScore.response.status, 409);
  assert.equal(missingScore.body.error, 'score_not_found');
  assert.deepEqual(storedEventStaffState(bindings), beforeMissingTargets);

  const saved = await operate(bindings, sessionToken, firstOperation);
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.revision, 2);
  assert.equal(saved.body.state.games.length, 1);
  assert.equal(saved.body.state.matches[0].result.scoreLabel, '25–20');
  assert.equal(saved.body.state.matches[0].staffScoreCorrectable, true);
  assert.equal(saved.body.state.standings[0].id, 'team-a');
  assert.equal(saved.body.state.standings[0].wins, 1);
  const canonicalId = saved.body.state.games[0].id;
  const storedGames = JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT games_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').games_json);
  assert.deepEqual(storedGames[0], {
    ratingVersion: 2,
    detailed: false,
    eventFamilies: {},
    id: canonicalId,
    date: storedGames[0].date,
    teamA: ['player-a', 'player-b'],
    teamB: ['player-c', 'player-d'],
    unkA: 0,
    unkB: 0,
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    log: {},
    evId: 'event-1',
    label: 'Round 1',
    evA: 'team-a',
    evB: 'team-b',
  });
  assert.equal(storedGames[0].teamA.includes('player-b'), true, 'inactive historical participant was lost');

  const beforeDuplicateScore = storedEventStaffState(bindings);
  const duplicateScore = await operate(bindings, sessionToken, {
    ...firstOperation,
    expectedRevision: 2,
    idempotencyKey: 'fixed-score-duplicate',
    payload: { mode: 'set', sets: [[25, 19]], winner: 'A' },
  });
  assert.equal(duplicateScore.response.status, 409);
  assert.equal(duplicateScore.body.error, 'score_already_recorded');
  assert.deepEqual(storedEventStaffState(bindings), beforeDuplicateScore);

  const replay = await operate(bindings, sessionToken, firstOperation);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.body.idempotentReplay, true);
  assert.equal(replay.body.state.games.length, 1);
  assert.equal(replay.body.state.games[0].id, canonicalId);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    "SELECT COUNT(*) AS count FROM event_staff_audit WHERE action_type = 'recordEventScore'"
  ).get().count, 1);

  const reused = await operate(bindings, sessionToken, {
    ...firstOperation,
    payload: { mode: 'set', sets: [[25, 19]], winner: 'A' },
  });
  assert.equal(reused.response.status, 409);
  assert.equal(reused.body.error, 'idempotency_key_reused');

  const stale = await operate(bindings, sessionToken, {
    ...firstOperation,
    idempotencyKey: 'fixed-score-stale',
    payload: { mode: 'set', sets: [[21, 25]], winner: 'B' },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error, 'revision_conflict');
  assert.equal(stale.body.currentRevision, 2);
  assert.deepEqual(stale.body.attempted.payload.sets, [[21, 25]]);
  assert.equal(stale.body.state.matches[0].result.scoreLabel, '25–20');

  const corrected = await operate(bindings, sessionToken, {
    eventId: 'event-1',
    action: 'correctEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 2,
    idempotencyKey: 'fixed-correct-0001',
    payload: { mode: 'set', sets: [[21, 25]], winner: 'B', reason: 'Score sheet review' },
  });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.body));
  assert.equal(corrected.body.revision, 3);
  assert.equal(corrected.body.state.games.length, 1);
  assert.equal(corrected.body.state.games[0].id, canonicalId);
  assert.equal(corrected.body.state.standings[0].id, 'team-b');
  const correctionAudit = bindings.EVENT_REGISTRATION_DB.database.prepare(
    "SELECT previous_json, new_json FROM event_staff_audit WHERE action_type = 'correctEventScore'"
  ).get();
  assert.deepEqual(JSON.parse(correctionAudit.previous_json).sets, [[25, 20]]);
  assert.deepEqual(JSON.parse(correctionAudit.new_json).sets, [[21, 25]]);

  const tied = await operate(bindings, sessionToken, {
    eventId: 'event-1',
    action: 'correctEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 3,
    idempotencyKey: 'fixed-correct-tie',
    payload: { mode: 'set', sets: [[22, 22]], winner: null },
  });
  assert.equal(tied.response.status, 200);
  assert.equal(tied.body.state.games[0].id, canonicalId);
  assert.equal(tied.body.state.games[0].winner, null);
  assert.ok(tied.body.warnings.some(warning => warning.code === 'tie_no_rating_impact'));
  const tiedStored = JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT games_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').games_json)[0];
  assert.equal(tiedStored.winner, null, 'tie unexpectedly became a rating-applicable winner');
});

test('match state exposes correction provenance without leaking owner management activity', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const snapshot = fixedSnapshot('owner-scored-event');
  snapshot.games = [{
    id: 'owner-entered-game',
    date: Date.now(),
    teamA: ['player-a', 'player-b'],
    teamB: ['player-c', 'player-d'],
    unkA: 0,
    unkB: 0,
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    log: {},
    evId: 'owner-scored-event',
    evA: 'team-a',
    evB: 'team-b',
    ratingVersion: 2,
    detailed: false,
    eventFamilies: {},
  }];
  snapshot.matches[0].gameIds = ['owner-entered-game'];
  snapshot.matches[0].status = 'complete';
  assert.equal((await seedSnapshot(bindings, 'owner-scored-event', snapshot)).response.status, 201);

  const scoreGrant = await createGrant(bindings, 'owner-scored-event', {
    role: 'scorekeeper',
    staffLabel: 'Score table',
  });
  const scoreSession = await redeem(bindings, inviteToken(scoreGrant.body));
  assert.equal(scoreSession.response.status, 200);
  assert.equal(scoreSession.body.state.matches[0].staffScoreCorrectable, false);
  const blocked = await operate(bindings, scoreSession.body.sessionToken, {
    eventId: 'owner-scored-event',
    action: 'correctEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'owner-score-correction',
    payload: { mode: 'set', sets: [[20, 25]], winner: 'B' },
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.body.error, 'correction_not_permitted');

  const operatorGrant = await createGrant(bindings, 'owner-scored-event', {
    role: 'tournamentOperator',
    staffLabel: 'Director',
  });
  const operatorSession = await redeem(bindings, inviteToken(operatorGrant.body));
  assert.equal(operatorSession.response.status, 200);
  assert.equal(operatorSession.body.state.matches[0].staffScoreCorrectable, true);
  assert.deepEqual(operatorSession.body.state.activity, []);
});

test('a correction preserves same-timestamp game replay order and the corrected game id', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const snapshot = fixedSnapshot();
  const timestamp = 1_800_000_000_000;
  const targetGame = {
    id: 'game-target',
    date: timestamp,
    teamA: ['player-a', 'player-b'],
    teamB: ['player-c', 'player-d'],
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    evId: 'event-1',
    evA: 'team-a',
    evB: 'team-b',
    label: 'Round 1',
    ratingVersion: 2,
    detailed: false,
    eventFamilies: {},
    log: {},
  };
  const unrelatedGame = {
    id: 'game-unrelated',
    date: timestamp,
    teamA: ['player-c'],
    teamB: ['player-a'],
    scoreA: 21,
    scoreB: 19,
    winner: 'A',
    evId: 'event-1',
    evA: 'other-a',
    evB: 'other-b',
    label: 'Earlier replay neighbor',
    ratingVersion: 2,
    detailed: false,
    eventFamilies: {},
    log: {},
  };
  snapshot.games = [targetGame, unrelatedGame];
  snapshot.event.teams.push(
    { id: 'other-a', name: 'Historical A', players: ['player-c'] },
    { id: 'other-b', name: 'Historical B', players: ['player-a'] },
  );
  snapshot.matches[0].gameIds = [targetGame.id];
  snapshot.matches[0].status = 'complete';
  assert.equal((await seedSnapshot(bindings, 'event-1', snapshot)).response.status, 201);
  const created = await createGrant(bindings, 'event-1', { role: 'tournamentOperator' });
  const accepted = await redeem(bindings, inviteToken(created.body));

  const corrected = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'correctEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'same-time-correction',
    payload: { mode: 'set', sets: [[19, 25]], winner: 'B' },
  });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.body));
  const stored = JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT games_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').games_json);
  assert.deepEqual(stored.map(game => game.id), ['game-target', 'game-unrelated']);
  assert.deepEqual(stored.map(game => game.date), [timestamp, timestamp]);
  assert.equal(stored[0].id, targetGame.id);
  assert.equal(stored[0].scoreA, 19);
  assert.equal(stored[0].scoreB, 25);
});

test('correction preserves historical rosters and metadata after owner roster changes and audit pruning', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const initial = fixedSnapshot();
  initial.gameMeta = {
    ratingVersion: 2,
    detailed: true,
    eventFamilies: { serve: ['ace', 'serr'] },
  };
  initial.matches[0].gameMeta = structuredClone(initial.gameMeta);
  assert.equal((await seedSnapshot(bindings, 'event-1', initial)).response.status, 201);
  const created = await createGrant(bindings, 'event-1', { role: 'scorekeeper' });
  const accepted = await redeem(bindings, inviteToken(created.body));
  const recorded = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'recordEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'historical-roster-score',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'A' },
  });
  assert.equal(recorded.response.status, 200, JSON.stringify(recorded.body));
  const originalGames = JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT games_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').games_json);
  const originalId = originalGames[0].id;

  const changedRoster = fixedSnapshot('event-1', {
    expectedRevision: 2,
    games: originalGames,
  });
  changedRoster.participants.push({
    id: 'player-new',
    name: 'Future Roster Player',
    active: true,
  });
  changedRoster.event.teams[0].players = ['player-new', 'player-b'];
  changedRoster.matches[0].sideAPlayerIds = ['player-new', 'player-b'];
  changedRoster.matches[0].gameIds = [originalId];
  changedRoster.matches[0].status = 'complete';
  const rosterUpdate = await seedSnapshot(bindings, 'event-1', changedRoster);
  assert.equal(rosterUpdate.response.status, 200, JSON.stringify(rosterUpdate.body));
  assert.equal(rosterUpdate.body.revision, 3);

  const eventRow = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT owner_scope FROM event_staff_events WHERE event_id = ?
  `).get('event-1');
  const insertAudit = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    INSERT INTO event_staff_audit (
      id, owner_scope, event_id, grant_id, staff_label, role, action_type,
      target_type, target_id, previous_json, new_json, resulting_revision,
      idempotency_key, source, created_at
    ) VALUES (?, ?, 'event-1', NULL, 'Owner', 'owner', 'retention.noise',
      'event', 'event-1', NULL, NULL, 3, NULL, 'owner', ?)
  `);
  const future = Date.now() + 60_000;
  for (let index = 0; index < 510; index += 1) {
    insertAudit.run(`retention-noise-${index}`, eventRow.owner_scope, future + index);
  }

  const corrected = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'correctEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 3,
    idempotencyKey: 'historical-roster-correction',
    payload: {
      mode: 'bo3',
      sets: [[20, 25], [18, 25]],
      winner: 'B',
      reason: 'Signed score sheet',
    },
  });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.body));
  const correctedGames = JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT games_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').games_json);
  assert.equal(correctedGames[0].id, originalId);
  assert.ok(correctedGames.every(game =>
    JSON.stringify(game.teamA) === JSON.stringify(['player-a', 'player-b'])
  ));
  assert.ok(correctedGames.every(game => game.detailed === true));
  assert.ok(correctedGames.every(game =>
    JSON.stringify(game.eventFamilies) === JSON.stringify({ serve: ['ace', 'serr'] })
  ));
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT COUNT(*) AS count FROM event_staff_audit
    WHERE owner_scope = ? AND event_id = 'event-1'
  `).get(eventRow.owner_scope).count, 500);
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(`
    SELECT COUNT(*) AS count FROM event_staff_audit
    WHERE owner_scope = ? AND event_id = 'event-1' AND action_type = 'recordEventScore'
  `).get(eventRow.owner_scope).count, 0, 'durable correction permission depended on pruned audit');
});

test('rotating-group scoring preserves teamSize, entry identity, standings, and stable correction records', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings, 'rotation-event', rotatingSnapshot())).response.status, 201);
  const created = await createGrant(bindings, 'rotation-event', { staffLabel: 'Rotation table' });
  const accepted = await redeem(bindings, inviteToken(created.body));

  const saved = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'rotation-event',
    action: 'recordEventScore',
    targetId: 'rotation-match-1',
    expectedRevision: 1,
    idempotencyKey: 'rotation-score-0001',
    payload: { mode: 'bo3', sets: [[21, 15], [18, 21], [15, 11]], winner: 'A' },
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.state.games.length, 3);
  assert.deepEqual(saved.body.state.games.map(game => game.evMatchId), Array(3).fill('rotation-match-1'));
  assert.deepEqual(saved.body.state.games.map(game => game.evEntryIdsA), Array(3).fill(['entry-a', 'entry-b']));
  assert.deepEqual(saved.body.state.games.map(game => game.evEntryIdsB), Array(3).fill(['entry-c', 'entry-d']));
  assert.deepEqual(saved.body.state.games.map(game => game.eventFormat), Array(3).fill('rotatingGroups'));
  assert.equal(saved.body.state.event.format, 'rotatingGroups');
  assert.equal(JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT event_json FROM event_staff_events WHERE event_id = ?'
  ).get('rotation-event').event_json).rotation.teamSize, 2);
  const winningRows = saved.body.state.standings.filter(row => ['entry-a', 'entry-b'].includes(row.id));
  const losingRows = saved.body.state.standings.filter(row => ['entry-c', 'entry-d'].includes(row.id));
  assert.ok(winningRows.every(row => row.wins === 1 && row.standingsPoints === 3));
  assert.ok(losingRows.every(row => row.losses === 1 && row.standingsPoints === 0));

  const ids = saved.body.state.games.map(game => game.id);
  const corrected = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'rotation-event',
    action: 'correctEventScore',
    targetId: 'rotation-match-1',
    expectedRevision: 2,
    idempotencyKey: 'rotation-correct-0001',
    payload: { mode: 'bo3', sets: [[17, 21], [19, 21]], winner: 'B' },
  });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.body));
  assert.deepEqual(corrected.body.state.games.map(game => game.id), ids.slice(0, 2));
  assert.equal(corrected.body.state.deletedGameIds[ids[2]] > 0, true);
  assert.ok(corrected.body.state.standings
    .filter(row => ['entry-c', 'entry-d'].includes(row.id))
    .every(row => row.wins === 1 && row.standingsPoints === 3));
  assert.equal(JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT event_json FROM event_staff_events WHERE event_id = ?'
  ).get('rotation-event').event_json).rotation.teamSize, 2);
});

test('rotating standings force win percentage for unequal schedules and use stable ID ties', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const snapshot = rotatingSnapshot('unequal-rotation');
  snapshot.event.rotation = {
    ...snapshot.event.rotation,
    teamSize: 1,
    fairnessPolicy: 'equalGames',
    tiebreakers: ['standingsPoints', 'wins'],
  };
  snapshot.event.entries[2].name = 'Same name';
  snapshot.event.entries[3].name = 'Same name';
  const entry = id => snapshot.event.entries.find(value => value.id === id);
  const match = (id, a, b, slot) => ({
    id,
    gameRecordMatchId: id,
    format: 'rotatingGroups',
    phase: 'pool',
    status: 'complete',
    label: `Round ${slot + 1}`,
    sideAName: entry(a).name,
    sideBName: entry(b).name,
    sideAPlayerIds: entry(a).players,
    sideBPlayerIds: entry(b).players,
    sideAEntryIds: [a],
    sideBEntryIds: [b],
    court: 1,
    scheduledAt: Date.now() + slot * 60_000,
    slot,
    gameIds: [`game-${id}`],
    gameMeta: snapshot.gameMeta,
    allowedScoreModes: ['set'],
  });
  snapshot.matches = [
    match('unequal-m1', 'entry-a', 'entry-c', 0),
    match('unequal-m2', 'entry-a', 'entry-d', 1),
    match('unequal-m3', 'entry-a', 'entry-b', 2),
  ];
  snapshot.games = snapshot.matches.map((scheduled, index) => {
    const aWins = index < 2;
    return {
      id: scheduled.gameIds[0],
      date: 1_800_000_000_000 + index,
      teamA: scheduled.sideAPlayerIds,
      teamB: scheduled.sideBPlayerIds,
      unkA: 0,
      unkB: 0,
      scoreA: aWins ? 21 : 10,
      scoreB: aWins ? 10 : 21,
      winner: aWins ? 'A' : 'B',
      log: {},
      evId: 'unequal-rotation',
      evMatchId: scheduled.id,
      evEntryIdsA: scheduled.sideAEntryIds,
      evEntryIdsB: scheduled.sideBEntryIds,
      eventFormat: 'rotatingGroups',
      ratingVersion: 2,
      detailed: false,
      eventFamilies: {},
    };
  });
  assert.equal((await seedSnapshot(bindings, 'unequal-rotation', snapshot)).response.status, 201);
  const created = await createGrant(bindings, 'unequal-rotation', { role: 'viewOnly' });
  const accepted = await redeem(bindings, inviteToken(created.body));
  assert.equal(accepted.response.status, 200);
  const standings = accepted.body.state.standings;
  assert.deepEqual(standings.map(row => row.id), [
    'entry-b',
    'entry-a',
    'entry-c',
    'entry-d',
  ]);
  assert.equal(standings[0].standingsPoints, 3);
  assert.equal(standings[0].winPercentage, 1);
  assert.equal(standings[1].standingsPoints, 6);
  assert.ok(standings[1].winPercentage < standings[0].winPercentage);
});

test('operator check-in, no-show/withdrawal, and valid schedule moves preserve rosters and reject invalid placement', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const snapshot = fixedSnapshot();
  const checkIn = {
    teamStatus: 'not_checked_in',
    activePlayerIds: ['player-a', 'player-b'],
    substitutePlayerIds: [],
    playerStatuses: { 'player-a': 'not_present', 'player-b': 'not_present' },
    updatedAt: null,
  };
  snapshot.event.teams[0].registrationId = 'registration-a';
  snapshot.event.teams[0].checkIn = structuredClone(checkIn);
  snapshot.event.teams.push(
    { id: 'team-declined', name: 'Declined entry', players: [], registrationId: 'registration-declined' },
    { id: 'team-withdrawn', name: 'Withdrawn entry', players: [], registrationId: 'registration-withdrawn' },
    { id: 'team-cross', name: 'Other event entry', players: [], registrationId: 'registration-cross' },
  );
  snapshot.event.registrationCheckIn = {
    entries: { 'registration-a': structuredClone(checkIn) },
    updatedAt: null,
  };
  assert.equal((await seedSnapshot(bindings, 'event-1', snapshot)).response.status, 201);
  const ownerScope = bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT owner_scope FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').owner_scope;
  const registrationNow = Date.now();
  const configInsert = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, mode, status,
      public_token_hash, created_at, updated_at
    ) VALUES (?, ?, ?, '2026-08-15', 'fixedTeams', 'team', 'closed', ?, ?, ?)
  `);
  configInsert.run('event-1', ownerScope, 'Summer Staff Cup', 'a'.repeat(64), registrationNow, registrationNow);
  configInsert.run('other-event', ownerScope, 'Other event', 'b'.repeat(64), registrationNow, registrationNow);
  const registrationInsert = bindings.EVENT_REGISTRATION_DB.database.prepare(`
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, created_at, updated_at
    ) VALUES (?, ?, 'team', ?, ?, ?, ?)
  `);
  registrationInsert.run('registration-a', 'event-1', 'Alpha', 'accepted', registrationNow, registrationNow);
  registrationInsert.run('registration-declined', 'event-1', 'Declined', 'declined', registrationNow, registrationNow);
  registrationInsert.run('registration-withdrawn', 'event-1', 'Withdrawn', 'withdrawn', registrationNow, registrationNow);
  registrationInsert.run('registration-cross', 'other-event', 'Cross event', 'accepted', registrationNow, registrationNow);
  const created = await createGrant(bindings, 'event-1', {
    role: 'tournamentOperator',
    staffLabel: 'Tournament director',
  });
  const accepted = await redeem(bindings, inviteToken(created.body));

  const checkedIn = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'setEntryCheckIn',
    targetId: 'team-a',
    expectedRevision: 1,
    idempotencyKey: 'operator-checkin-0001',
    payload: { checkedIn: true },
  });
  assert.equal(checkedIn.response.status, 200, JSON.stringify(checkedIn.body));
  const checkedTeam = checkedIn.body.state.event.teams.find(team => team.id === 'team-a');
  assert.equal(checkedTeam.checkIn.teamStatus, 'checked_in');
  assert.deepEqual(checkedTeam.players, ['player-a', 'player-b']);
  assert.deepEqual(checkedTeam.checkIn.playerStatuses, { 'player-a': 'present', 'player-b': 'present' });

  const checkedOut = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'setEntryCheckIn',
    targetId: 'team-a',
    expectedRevision: 2,
    idempotencyKey: 'operator-checkout-0001',
    payload: { checkedIn: false },
  });
  assert.equal(checkedOut.response.status, 200, JSON.stringify(checkedOut.body));
  const checkedOutTeam = checkedOut.body.state.event.teams.find(team => team.id === 'team-a');
  assert.equal(checkedOutTeam.checkIn.teamStatus, 'not_checked_in');
  assert.deepEqual(checkedOutTeam.checkIn.playerStatuses, {
    'player-a': 'not_present',
    'player-b': 'not_present',
  });

  for (const [targetId, key] of [
    ['team-declined', 'operator-declined-0001'],
    ['team-withdrawn', 'operator-withdrawn-registration-0001'],
    ['team-cross', 'operator-cross-event-0001'],
  ]) {
    const rejected = await operate(bindings, accepted.body.sessionToken, {
      eventId: 'event-1',
      action: 'setEntryCheckIn',
      targetId,
      expectedRevision: 3,
      idempotencyKey: key,
      payload: { checkedIn: true },
    });
    assert.equal(rejected.response.status, 409);
    assert.equal(rejected.body.error, 'registration_not_accepted');
  }
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT revision FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').revision, 3);

  const noShow = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'setEntryAttendanceStatus',
    targetId: 'team-a',
    expectedRevision: 3,
    idempotencyKey: 'operator-noshow-0001',
    payload: { status: 'no_show', reason: 'Team missed its call time' },
  });
  assert.equal(noShow.response.status, 200, JSON.stringify(noShow.body));
  const noShowTeam = noShow.body.state.event.teams.find(team => team.id === 'team-a');
  assert.equal(noShowTeam.checkIn.teamStatus, 'no_show');
  assert.deepEqual(noShowTeam.checkIn.playerStatuses, {
    'player-a': 'not_present',
    'player-b': 'not_present',
  });

  const withdrawn = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'setEntryAttendanceStatus',
    targetId: 'team-a',
    expectedRevision: 4,
    idempotencyKey: 'operator-withdraw-0001',
    payload: { status: 'withdrawn', reason: 'Captain withdrew at the desk' },
  });
  assert.equal(withdrawn.response.status, 200, JSON.stringify(withdrawn.body));
  const withdrawnTeam = withdrawn.body.state.event.teams.find(team => team.id === 'team-a');
  assert.equal(withdrawnTeam.checkIn.teamStatus, 'withdrawn');
  assert.deepEqual(withdrawnTeam.players, ['player-a', 'player-b']);
  assert.equal(withdrawn.body.state.participants.some(player => player.id === 'player-a'), true);
  assert.equal(withdrawn.body.state.participants.some(player => player.id === 'player-b'), true);

  const placement = withdrawn.body.state.matches[0].validPlacements.find(value => value.court === 2);
  const moved = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'moveScheduledMatch',
    targetId: 'fixed-match-1',
    expectedRevision: 5,
    idempotencyKey: 'operator-move-0001',
    payload: { ...placement, reason: 'Court 1 is wet' },
  });
  assert.equal(moved.response.status, 200, JSON.stringify(moved.body));
  const movedMatch = moved.body.state.matches.find(match => match.id === 'fixed-match-1');
  assert.equal(movedMatch.court, 2);
  assert.equal(movedMatch.scheduledAt, placement.scheduledAt);
  assert.equal(movedMatch.slot, placement.slot);

  const invalidMove = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'event-1',
    action: 'moveScheduledMatch',
    targetId: 'fixed-match-1',
    expectedRevision: 6,
    idempotencyKey: 'operator-move-invalid',
    payload: { court: 99, scheduledAt: placement.scheduledAt, slot: placement.slot },
  });
  assert.equal(invalidMove.response.status, 409);
  assert.equal(invalidMove.body.error, 'invalid_match_placement');
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT revision FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').revision, 6);
  assert.equal(JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT event_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').event_json).teams[0].players.length, 2);
});

test('sequential match moves revalidate live placement collisions after the first move', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  const snapshot = fixedSnapshot('move-race-event');
  snapshot.event.teams.push(
    { id: 'team-c', name: 'Charlie', players: ['player-e', 'player-f'] },
    { id: 'team-d', name: 'Delta', players: ['player-g', 'player-h'] },
  );
  snapshot.participants.push(
    { id: 'player-e', name: 'Elliot', active: true },
    { id: 'player-f', name: 'Frankie', active: true },
    { id: 'player-g', name: 'Gray', active: true },
    { id: 'player-h', name: 'Harper', active: true },
  );
  const first = snapshot.matches[0];
  first.id = 'move-match-1';
  const shared = {
    court: 3,
    scheduledAt: first.scheduledAt + 2 * 60_000,
    slot: 2,
  };
  first.validPlacements.push(shared);
  const second = {
    ...structuredClone(first),
    id: 'move-match-2',
    label: 'Round 2',
    teamAId: 'team-c',
    teamBId: 'team-d',
    sideAName: 'Charlie',
    sideBName: 'Delta',
    sideAPlayerIds: ['player-e', 'player-f'],
    sideBPlayerIds: ['player-g', 'player-h'],
    court: 2,
    courtLabel: 'Court 2',
    scheduledAt: first.scheduledAt + 60_000,
    slot: 1,
    validPlacements: [
      {
        court: 2,
        scheduledAt: first.scheduledAt + 60_000,
        slot: 1,
      },
      shared,
    ],
  };
  snapshot.matches.push(second);
  assert.equal((await seedSnapshot(bindings, 'move-race-event', snapshot)).response.status, 201);
  const created = await createGrant(bindings, 'move-race-event', {
    role: 'tournamentOperator',
  });
  const accepted = await redeem(bindings, inviteToken(created.body));
  const movedFirst = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'move-race-event',
    action: 'moveScheduledMatch',
    targetId: 'move-match-1',
    expectedRevision: 1,
    idempotencyKey: 'move-race-first',
    payload: shared,
  });
  assert.equal(movedFirst.response.status, 200, JSON.stringify(movedFirst.body));
  const movedSecond = await operate(bindings, accepted.body.sessionToken, {
    eventId: 'move-race-event',
    action: 'moveScheduledMatch',
    targetId: 'move-match-2',
    expectedRevision: 2,
    idempotencyKey: 'move-race-second',
    payload: shared,
  });
  assert.equal(movedSecond.response.status, 409);
  assert.equal(movedSecond.body.error, 'match_placement_conflict');
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT revision FROM event_staff_events WHERE event_id = ?'
  ).get('move-race-event').revision, 2);
});

test('bracket results advance canonically and winner-changing corrections require audited downstream recovery', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings, 'bracket-event', bracketSnapshot())).response.status, 201);
  const created = await createGrant(bindings, 'bracket-event', {
    role: 'tournamentOperator',
    staffLabel: 'Bracket director',
  });
  const accepted = await redeem(bindings, inviteToken(created.body));
  const sessionToken = accepted.body.sessionToken;
  const complete = (targetId, expectedRevision, key, winner, sets) => operate(bindings, sessionToken, {
    eventId: 'bracket-event',
    action: 'completeBracketMatch',
    targetId,
    expectedRevision,
    idempotencyKey: key,
    payload: { mode: 'set', sets: [sets], winner },
  });

  const beforeEarlyFinal = storedEventStaffState(bindings, 'bracket-event');
  const earlyFinal = await complete(
    'bracket-1:r1:m0',
    1,
    'bracket-final-too-early',
    'A',
    [25, 20],
  );
  assert.equal(earlyFinal.response.status, 409);
  assert.equal(earlyFinal.body.error, 'bracket_not_ready');
  assert.deepEqual(
    storedEventStaffState(bindings, 'bracket-event'),
    beforeEarlyFinal,
  );

  const first = await complete('bracket-1:r0:m0', 1, 'bracket-semi-0001', 'A', [25, 20]);
  assert.equal(first.response.status, 200, JSON.stringify(first.body));
  const waitingFinal = first.body.state.matches.find(match => match.id === 'bracket-1:r1:m0');
  assert.equal(waitingFinal.teamAId, 'team-a');
  assert.deepEqual(waitingFinal.sideAPlayerIds, ['player-a']);
  assert.equal(waitingFinal.upstreamComplete, false);
  const second = await complete('bracket-1:r0:m1', 2, 'bracket-semi-0002', 'A', [25, 19]);
  assert.equal(second.response.status, 200, JSON.stringify(second.body));
  const readyFinal = second.body.state.matches.find(match => match.id === 'bracket-1:r1:m0');
  assert.equal(readyFinal.teamAId, 'team-a');
  assert.equal(readyFinal.teamBId, 'team-c');
  assert.equal(readyFinal.upstreamComplete, true);
  assert.equal(readyFinal.status, 'ready');
  const final = await complete('bracket-1:r1:m0', 3, 'bracket-final-001', 'A', [25, 23]);
  assert.equal(final.response.status, 200, JSON.stringify(final.body));
  const finalGameId = final.body.state.matches
    .find(match => match.id === 'bracket-1:r1:m0').result.gameIds[0];
  assert.equal(final.body.state.matches.find(match => match.id === 'bracket-1:r1:m0').result.winner, 'A');

  const blocked = await operate(bindings, sessionToken, {
    eventId: 'bracket-event',
    action: 'correctEventScore',
    targetId: 'bracket-1:r0:m0',
    expectedRevision: 4,
    idempotencyKey: 'bracket-correct-001',
    payload: { mode: 'set', sets: [[20, 25]], winner: 'B' },
  });
  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.body.error, 'downstream_confirmation_required');
  assert.equal(blocked.body.dependentMatches[0].id, 'bracket-1:r1:m0');
  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT revision FROM event_staff_events WHERE event_id = ?'
  ).get('bracket-event').revision, 4);

  const corrected = await operate(bindings, sessionToken, {
    eventId: 'bracket-event',
    action: 'correctEventScore',
    targetId: 'bracket-1:r0:m0',
    expectedRevision: 4,
    idempotencyKey: 'bracket-correct-002',
    payload: {
      mode: 'set',
      sets: [[20, 25]],
      winner: 'B',
      confirmDownstreamImpact: true,
      reason: 'Signed score sheet changed the semifinal winner',
    },
  });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.body));
  assert.ok(corrected.body.warnings.some(warning => warning.code === 'downstream_results_removed'));
  assert.equal(corrected.body.state.deletedGameIds[finalGameId] > 0, true);
  const correctedSemi = corrected.body.state.matches.find(match => match.id === 'bracket-1:r0:m0');
  const resetFinal = corrected.body.state.matches.find(match => match.id === 'bracket-1:r1:m0');
  assert.equal(correctedSemi.result.winner, 'B');
  assert.equal(resetFinal.result, null);
  assert.equal(resetFinal.teamAId, 'team-b', 'corrected winner did not advance into the canonical final');
  assert.deepEqual(resetFinal.sideAPlayerIds, ['player-b']);
  const audit = bindings.EVENT_REGISTRATION_DB.database.prepare(
    "SELECT previous_json, new_json FROM event_staff_audit WHERE action_type = 'correctEventScore'"
  ).get();
  assert.deepEqual(JSON.parse(audit.previous_json).sets, [[25, 20]]);
  assert.deepEqual(JSON.parse(audit.new_json).removedDependentGameIds, [finalGameId]);
});

test('normal owner sync overlays only staffed event operations, preserves unrelated data, and rejects stale owners without KV listing', async t => {
  const staffSnapshot = fixedSnapshot();
  const untouchedMatch = structuredClone(staffSnapshot.matches[0]);
  untouchedMatch.id = 'fixed-match-2';
  untouchedMatch.label = 'Round 2';
  untouchedMatch.scheduledAt += 60_000;
  untouchedMatch.slot = 1;
  untouchedMatch.validPlacements = [{
    court: 1,
    scheduledAt: untouchedMatch.scheduledAt,
    slot: 1,
  }];
  staffSnapshot.matches.push(untouchedMatch);
  const ownerEvent = {
    ...structuredClone(staffSnapshot.event),
    ownerPrivateRules: { ratingK: 0.6, note: 'owner-only setup stays intact' },
    sched: { start: '09:00', courts: 2, courtStyle: 'num', standardRounds: 1, seed: 'owner-seed', revision: 1 },
  };
  const unrelatedEvent = {
    id: 'unrelated-event',
    name: 'Private unrelated event',
    eventDate: '2026-09-01',
    teams: [{ id: 'secret-team', name: 'Secret team', players: ['secret-player'] }],
  };
  const initialData = {
    players: [
      { id: 'player-a', name: 'Avery', seedRating: 70, privateNote: 'owner data' },
      { id: 'secret-player', name: 'Unrelated Player', seedRating: 99, privateNote: 'unrelated secret' },
    ],
    games: [{
      id: 'unrelated-game',
      date: 10,
      teamA: ['secret-player'],
      teamB: [],
      scoreA: 25,
      scoreB: 0,
      winner: 'A',
      log: {},
      evId: 'unrelated-event',
    }],
    events: [ownerEvent, unrelatedEvent],
    settings: { hideRatings: true, syncSecretSetting: 'preserve-me' },
    backups: { ownerOnly: true },
    eventStaffRevisions: { 'event-1': 999_999 },
    deletions: { games: {}, players: {}, events: {} },
    tomb: {},
    v: 4,
  };
  const bindings = env({ rooms: { 'room:owner-a': syncEnvelope(initialData, 100) } });
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings, 'event-1', staffSnapshot)).response.status, 201);
  const beforeMoveResponse = await worker.fetch(request('/?room=owner-a'), bindings);
  const beforeMove = JSON.parse((await beforeMoveResponse.json()).data);
  assert.equal(
    beforeMove.events.find(event => event.id === 'event-1').sched.lockedMatches,
    undefined,
    'an untouched staff match changed the owner schedule',
  );
  const grant = await createGrant(bindings, 'event-1', {
    role: 'tournamentOperator',
    staffLabel: 'Sync operator',
  });
  const session = await redeem(bindings, inviteToken(grant.body));
  const placement = staffSnapshot.matches[0].validPlacements[1];
  const moved = await operate(bindings, session.body.sessionToken, {
    eventId: 'event-1',
    action: 'moveScheduledMatch',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'sync-move-0001',
    payload: placement,
  });
  assert.equal(moved.response.status, 200, JSON.stringify(moved.body));
  const scored = await operate(bindings, session.body.sessionToken, {
    eventId: 'event-1',
    action: 'recordEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 2,
    idempotencyKey: 'sync-score-0001',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'A' },
  });
  assert.equal(scored.response.status, 200, JSON.stringify(scored.body));

  const getResponse = await worker.fetch(request('/?room=owner-a'), bindings);
  assert.equal(getResponse.status, 200);
  const pulled = await getResponse.json();
  assert.ok(pulled.ts > 100, 'a normal non-force owner pull would ignore the staff update');
  const overlaid = JSON.parse(pulled.data);
  assert.equal(overlaid.eventStaffRevisions['event-1'], 3);
  assert.equal(overlaid.games.filter(game => game.evId === 'event-1').length, 1);
  assert.equal(overlaid.games.find(game => game.evId === 'event-1').scoreA, 25);
  assert.equal(overlaid.games.find(game => game.id === 'unrelated-game').scoreA, 25);
  assert.equal(overlaid.events.find(event => event.id === 'event-1').ownerPrivateRules.note, 'owner-only setup stays intact');
  assert.equal(overlaid.events.find(event => event.id === 'unrelated-event').name, 'Private unrelated event');
  assert.equal(overlaid.players.find(player => player.id === 'secret-player').privateNote, 'unrelated secret');
  assert.equal(overlaid.settings.syncSecretSetting, 'preserve-me');
  assert.deepEqual(overlaid.backups, { ownerOnly: true });
  const locked = overlaid.events.find(event => event.id === 'event-1').sched.lockedMatches;
  assert.equal(locked.length, 1);
  assert.equal(locked[0].court, 1, 'staff court 2 was not converted to the owner app’s zero-based court');
  assert.deepEqual(new Set([locked[0].a, locked[0].b]), new Set(['team-a', 'team-b']));
  assert.equal(bindings.COURT.lists.length, 0);

  const putsBeforeConflict = bindings.COURT.puts.length;
  const staleData = structuredClone(overlaid);
  staleData.eventStaffRevisions['event-1'] = 2;
  staleData.games = staleData.games.filter(game => game.evId !== 'event-1');
  const staleResponse = await worker.fetch(request('/?room=owner-a', {
    method: 'POST',
    body: syncEnvelope(staleData, pulled.ts + 1),
  }), bindings);
  const staleBody = await staleResponse.json();
  assert.equal(staleResponse.status, 409);
  assert.equal(staleBody.error, 'revision_conflict');
  assert.equal(staleBody.conflicts[0].currentRevision, 3);
  assert.equal(bindings.COURT.puts.length, putsBeforeConflict, 'stale owner data reached KV');

  const legacyData = structuredClone(overlaid);
  delete legacyData.eventStaffRevisions;
  legacyData.games = legacyData.games
    .filter(game => game.evId !== 'event-1')
    .concat({ id: 'stale-event-game', evId: 'event-1', scoreA: 1, scoreB: 0, winner: 'A' });
  const legacyResponse = await worker.fetch(request('/?room=owner-a', {
    method: 'POST',
    body: syncEnvelope(legacyData, pulled.ts + 2),
  }), bindings);
  const legacyBody = await legacyResponse.json();
  assert.equal(legacyResponse.status, 409);
  assert.equal(legacyBody.error, 'event_staff_revision_required');
  assert.equal(legacyBody.conflicts[0].currentRevision, 3);
  assert.equal(bindings.COURT.puts.length, putsBeforeConflict, 'legacy managed-event changes were acknowledged and discarded');
  assert.equal(bindings.COURT.lists.length, 0);
});

test('every operation enforces the grant role, event scope, action allowlist, and score participants', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  assert.equal((await seedSnapshot(bindings, 'event-2', fixedSnapshot('event-2'))).response.status, 201);
  const baseOperation = {
    eventId: 'event-1',
    action: 'recordEventScore',
    targetId: 'fixed-match-1',
    expectedRevision: 1,
    idempotencyKey: 'scope-check-0001',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'A' },
  };

  const unauthenticated = await operate(bindings, 'A'.repeat(43), baseOperation);
  assert.equal(unauthenticated.response.status, 401);

  const viewGrant = await createGrant(bindings, 'event-1', { role: 'viewOnly', staffLabel: 'Observer' });
  const viewSession = await redeem(bindings, inviteToken(viewGrant.body));
  const viewWrite = await operate(bindings, viewSession.body.sessionToken, baseOperation);
  assert.equal(viewWrite.response.status, 403);
  assert.equal(viewWrite.body.error, 'permission_denied');

  const scoreGrant = await createGrant(bindings, 'event-1', { role: 'scorekeeper' });
  const scoreSession = await redeem(bindings, inviteToken(scoreGrant.body));
  const crossEvent = await operate(bindings, scoreSession.body.sessionToken, {
    ...baseOperation,
    eventId: 'event-2',
    idempotencyKey: 'scope-check-0002',
  });
  assert.equal(crossEvent.response.status, 403);
  assert.equal(crossEvent.body.error, 'event_scope_mismatch');
  assert.doesNotMatch(JSON.stringify(crossEvent.body), /event-2.*Summer|player-a/i);

  const operatorAction = await operate(bindings, scoreSession.body.sessionToken, {
    eventId: 'event-1',
    action: 'setEntryAttendanceStatus',
    targetId: 'team-a',
    expectedRevision: 1,
    idempotencyKey: 'scope-check-0003',
    payload: { status: 'no_show' },
  });
  assert.equal(operatorAction.response.status, 403);
  assert.equal(operatorAction.body.error, 'permission_denied');

  for (const [action, idempotencyKey, payload] of [
    ['editPlayerRating', 'scope-check-rating', { rating: 99 }],
    ['editPlayerSeedRating', 'scope-check-seed', { seedRating: 99 }],
  ]) {
    const playerEdit = await operate(bindings, scoreSession.body.sessionToken, {
      eventId: 'event-1',
      action,
      targetId: 'player-a',
      expectedRevision: 1,
      idempotencyKey,
      payload,
    });
    assert.equal(playerEdit.response.status, 400);
    assert.equal(playerEdit.body.error, 'unsupported_action');
  }

  const operatorGrant = await createGrant(bindings, 'event-1', {
    role: 'tournamentOperator',
    staffLabel: 'Operator',
  });
  const operatorSession = await redeem(bindings, inviteToken(operatorGrant.body));
  assert.equal(operatorSession.response.status, 200);
  const beforePlayerDeletion = storedEventStaffState(bindings);
  for (const [role, sessionToken] of [
    ['viewOnly', viewSession.body.sessionToken],
    ['scorekeeper', scoreSession.body.sessionToken],
    ['tournamentOperator', operatorSession.body.sessionToken],
  ]) {
    const playerDelete = await operate(bindings, sessionToken, {
      eventId: 'event-1',
      action: 'deletePlayer',
      targetId: 'player-a',
      expectedRevision: 1,
      idempotencyKey: `delete-player-${role}`,
      payload: {},
    });
    assert.equal(playerDelete.response.status, 400);
    assert.equal(playerDelete.body.error, 'unsupported_action');
    assert.deepEqual(
      storedEventStaffState(bindings),
      beforePlayerDeletion,
      `${role} delete attempt mutated event staff state`,
    );
  }

  const injectedParticipants = await operate(bindings, scoreSession.body.sessionToken, {
    ...baseOperation,
    idempotencyKey: 'scope-check-0005',
    payload: { ...baseOperation.payload, teamA: ['secret-player'] },
  });
  assert.equal(injectedParticipants.response.status, 400);
  assert.equal(injectedParticipants.body.error, 'invalid_score_fields');

  const wrongWinner = await operate(bindings, scoreSession.body.sessionToken, {
    ...baseOperation,
    idempotencyKey: 'scope-check-0006',
    payload: { mode: 'set', sets: [[25, 20]], winner: 'B' },
  });
  assert.equal(wrongWinner.response.status, 400);
  assert.equal(wrongWinner.body.error, 'winner_mismatch');

  assert.equal(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT COUNT(*) AS count FROM event_staff_idempotency'
  ).get().count, 0);
  assert.equal(JSON.parse(bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT games_json FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').games_json).length, 0);
});

test('staff reads are event-scoped and registration contacts are operator-only', async t => {
  const bindings = env();
  t.after(() => bindings.EVENT_REGISTRATION_DB.close());
  assert.equal((await seedSnapshot(bindings)).response.status, 201);
  const other = fixedSnapshot('event-2');
  other.event.name = 'Unrelated Secret Event';
  other.participants = [{ id: 'secret-player', name: 'Secret Player', active: true }];
  other.matches = [];
  other.event.teams = [{ id: 'secret-team', name: 'Secret Team', players: ['secret-player'] }];
  assert.equal((await seedSnapshot(bindings, 'event-2', other)).response.status, 201);

  const ownerScope = bindings.EVENT_REGISTRATION_DB.database.prepare(
    'SELECT owner_scope FROM event_staff_events WHERE event_id = ?'
  ).get('event-1').owner_scope;
  const now = Date.now();
  bindings.EVENT_REGISTRATION_DB.database.prepare(`
    INSERT INTO event_registration_configs (
      event_id, owner_scope, event_name, event_date, event_format, enabled, event_available,
      mode, status, allow_substitutes, require_organizer_approval, allow_waitlist,
      public_token_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'fixedTeams', 1, 1, 'team', 'open', 1, 0, 1, ?, ?, ?)
  `).run('event-1', ownerScope, 'Summer Staff Cup', '2026-08-15', 'f'.repeat(64), now, now);
  bindings.EVENT_REGISTRATION_DB.database.prepare(`
    INSERT INTO event_registrations (
      id, event_id, registration_type, display_name, status, active_player_count,
      substitute_count, contact_json, created_at, updated_at
    ) VALUES (?, ?, 'team', ?, 'accepted', 2, 0, ?, ?, ?)
  `).run('registration-a', 'event-1', 'Alpha', JSON.stringify({
    name: 'Captain Alpha',
    email: 'captain@example.com',
    phone: '555-0100',
    preferredMethod: 'text',
    notes: 'Event-specific note',
  }), now, now);

  for (const role of ['viewOnly', 'scorekeeper', 'tournamentOperator']) {
    const created = await createGrant(bindings, 'event-1', { role, staffLabel: role });
    const accepted = await redeem(bindings, inviteToken(created.body));
    assert.equal(accepted.response.status, 200);
    const serialized = JSON.stringify(accepted.body.state);
    assert.equal(serialized.includes('Unrelated Secret Event'), false);
    assert.equal(serialized.includes('Secret Player'), false);
    if (role === 'tournamentOperator') {
      assert.equal(accepted.body.state.contacts[0].contact.email, 'captain@example.com');
      assert.ok(Array.isArray(accepted.body.state.activity));
      assert.ok(accepted.body.state.activity.every(row =>
        ['online', 'queued'].includes(row.source)
        && !/^(grant\.|event\.|owner\.)/.test(row.action)
      ));
    } else {
      assert.equal(Object.hasOwn(accepted.body.state, 'contacts'), false);
      assert.equal(Object.hasOwn(accepted.body.state, 'activity'), false);
      assert.equal(serialized.includes('captain@example.com'), false);
      assert.equal(serialized.includes('Event-specific note'), false);
    }
  }
});
