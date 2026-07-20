import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');

const source = await readFile(new URL('../cloudflare/court-sync-worker.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
const ORIGIN = 'https://cheebychob.github.io';

class MemoryKV {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.gets = [];
    this.puts = [];
  }
  async get(key) { this.gets.push(key); return this.values.get(key) ?? null; }
  async put(key, value) { this.puts.push([key, value]); this.values.set(key, value); }
}

class MemoryR2 {
  constructor() {
    this.values = new Map();
    this.heads = [];
    this.gets = [];
    this.puts = [];
    this.deletes = [];
    this.sequence = 0;
  }
  view(record, body = false) {
    if (!record) return null;
    return {
      size: record.bytes.byteLength,
      etag: record.etag,
      httpEtag: `"${record.etag}"`,
      version: record.version,
      uploaded: record.uploaded,
      httpMetadata: { ...record.httpMetadata },
      customMetadata: { ...record.customMetadata },
      ...(body ? { body: new Response(record.bytes.slice()).body } : {})
    };
  }
  async head(key) { this.heads.push(key); return this.view(this.values.get(key)); }
  async get(key) { this.gets.push(key); return this.view(this.values.get(key), true); }
  async put(key, value, options = {}) {
    let bytes;
    if (value instanceof Uint8Array) bytes = value.slice();
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value.slice(0));
    else bytes = new Uint8Array(await new Response(value).arrayBuffer());
    const record = {
      bytes,
      etag: digest(bytes),
      version: `version-${++this.sequence}`,
      uploaded: new Date(1721147120000 + this.sequence),
      httpMetadata: { ...(options.httpMetadata || {}) },
      customMetadata: { ...(options.customMetadata || {}) }
    };
    this.puts.push({ key, bytes: bytes.slice(), options: structuredClone(options) });
    this.values.set(key, record);
    return this.view(record);
  }
  async delete(key) { this.deletes.push(key); this.values.delete(key); }
}

const digest = value => createHash('sha256').update(value).digest('hex');
const scheduleHtml = title => `<!DOCTYPE html><html lang="en"><head><title>${title}</title><style>body{color:#172033}</style></head><body><main>${title}</main></body></html>`;

function env({ room = true, publicBinding = true, photoBinding = true, rooms = null } = {}) {
  const roomValues = rooms || (room ? { 'room:test-room': JSON.stringify({ ts: 1, data: '{}' }) } : {});
  return {
    COURT: new MemoryKV(roomValues),
    ...(publicBinding ? { PUBLIC_SCHEDULES: new MemoryKV() } : {}),
    ...(photoBinding ? { PLAYER_PHOTOS: new MemoryR2() } : {}),
  };
}

function request(path = '/', init = {}) {
  return new Request(`https://court-sync.example${path}`, init);
}

function createInit(html = scheduleHtml('Summer Cup'), extra = {}) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Court-Room': 'test-room', Origin: ORIGIN, ...(extra.headers || {}) },
    body: JSON.stringify({ html, title: 'Summer Cup · Court schedule', contentHash: digest(html), scope: 'full', ...(extra.body || {}) }),
  };
}

async function createPublication(bindings, html = scheduleHtml('Summer Cup')) {
  const response = await worker.fetch(request('/api/public-schedules', createInit(html)), bindings);
  const body = await response.json();
  return { response, body, record: JSON.parse(bindings.PUBLIC_SCHEDULES.values.get(`schedule:${body.token}`) || 'null') };
}

const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

function photoInit(body = webp, extra = {}) {
  return {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/webp',
      'X-Court-Room': 'test-room',
      'X-Photo-Width': '512',
      'X-Photo-Height': '512',
      'X-Photo-Public': '0',
      Origin: ORIGIN,
      ...(extra.headers || {})
    },
    body,
  };
}

async function uploadPhoto(bindings, playerId = 'player-1', body = webp, extra = {}) {
  const response = await worker.fetch(request(`/api/player-photos/${playerId}`, photoInit(body, extra)), bindings);
  let result = {};
  try { result = await response.clone().json(); } catch {}
  return { response, body: result };
}

test('legacy GET/POST contract, missing-room response, keys, payloads, and wildcard CORS remain exact', async () => {
  const bindings = env({ room: false });
  const missing = await worker.fetch(request('/?room=test'), bindings);
  assert.equal(missing.status, 200);
  assert.deepEqual(await missing.json(), { ts: 0, data: null });
  assert.deepEqual(bindings.COURT.gets, ['room:test']);
  assert.equal(bindings.PUBLIC_SCHEDULES.gets.length, 0);

  const raw = '{"ts":42,"data":"opaque sync payload"}';
  const posted = await worker.fetch(request('/?room=test', { method: 'POST', body: raw }), bindings);
  assert.equal(posted.status, 200);
  assert.deepEqual(await posted.json(), { ok: true });
  assert.deepEqual(bindings.COURT.puts, [['room:test', raw]]);
  assert.equal(posted.headers.get('access-control-allow-origin'), '*');
  assert.equal(bindings.PUBLIC_SCHEDULES.puts.length, 0);

  const fetched = await worker.fetch(request('/?room=test'), bindings);
  assert.equal(await fetched.text(), raw);
  const noRoom = await worker.fetch(request('/'), bindings);
  assert.equal(noRoom.status, 400);
  assert.deepEqual(await noRoom.json(), { ok: false, error: 'missing room' });
});

test('public route ordering bypasses missing-room handling and unknown paths return 404', async () => {
  const bindings = env();
  const status = await worker.fetch(request('/api/public-schedules/status', { headers: { Origin: ORIGIN } }), bindings);
  assert.deepEqual(await status.json(), { available: true });
  const publicMissing = await worker.fetch(request('/s/AAAAAAAAAAAAAAAAAAAAAA'), bindings);
  assert.equal(publicMissing.status, 404);
  assert.doesNotMatch(await publicMissing.text(), /missing room/i);
  assert.equal(bindings.COURT.gets.length, 0);
  const unknown = await worker.fetch(request('/unknown'), bindings);
  assert.equal(unknown.status, 404);
});

test('public event behavior script is same-origin, storage-free, and served with strict headers', async () => {
  const bindings = env();
  const response = await worker.fetch(request('/assets/public-event.js'), bindings);
  const script = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/javascript/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(script, /data-rules-search/);
  assert.match(script, /rules-search-hit-active/);
  assert.match(script, /No results/);
  assert.match(script, /navigator\.share/);
  assert.doesNotMatch(script, /COURT|PUBLIC_SCHEDULES|room:|managementToken|localStorage/i);
  assert.equal(source.match(/const PUBLIC_EVENT_SCRIPT = `([\s\S]*?)`;/)?.[1], appSource.match(/function publicEventBehaviorScript\(\)\{return `([\s\S]*?)`;\}/)?.[1]);
  assert.equal(bindings.COURT.gets.length, 0);
  assert.equal(bindings.PUBLIC_SCHEDULES.gets.length, 0);
});

test('capability status reports ready and distinguishes a missing public binding without private details', async () => {
  const ready = await worker.fetch(request('/api/public-schedules/status', { headers: { Origin: ORIGIN } }), env());
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { available: true });
  assert.equal(ready.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(ready.headers.get('vary'), 'Origin');

  const unavailable = await worker.fetch(request('/api/public-schedules/status', { headers: { Origin: ORIGIN } }), env({ publicBinding: false }));
  assert.equal(unavailable.status, 503);
  const body = await unavailable.json();
  assert.deepEqual(body, { available: false, error: 'public schedule storage unavailable' });
  assert.doesNotMatch(JSON.stringify(body), /COURT|room:|court-data|account/i);
});

test('create requires a known sync room and never exposes the room secret', async () => {
  const noHeaderBindings = env();
  const noHeaderInit = createInit();
  delete noHeaderInit.headers['X-Court-Room'];
  const noHeader = await worker.fetch(request('/api/public-schedules', noHeaderInit), noHeaderBindings);
  assert.equal(noHeader.status, 401);

  const unknownBindings = env({ room: false });
  const unknown = await worker.fetch(request('/api/public-schedules', createInit()), unknownBindings);
  assert.equal(unknown.status, 403);
  assert.doesNotMatch(await unknown.text(), /test-room|room:/);
  assert.equal(unknownBindings.PUBLIC_SCHEDULES.puts.length, 0);

  const bindings = env();
  const created = await createPublication(bindings);
  assert.equal(created.response.status, 201);
  assert.equal(bindings.COURT.gets.at(-1), 'room:test-room');
  assert.equal(bindings.COURT.puts.length, 0);
  assert.doesNotMatch(JSON.stringify(created.body), /test-room|room:/);
  assert.doesNotMatch(created.body.url, /test-room|room=/);
  assert.doesNotMatch(created.record.html, /test-room/);
  assert.doesNotMatch(JSON.stringify(created.record), /test-room|room:/);
});

test('create uses separate URL-safe 256-bit tokens and stores only the management hash', async () => {
  const bindings = env();
  const first = await createPublication(bindings);
  const second = await createPublication(bindings, scheduleHtml('Second Cup'));
  for (const value of [first.body.token, first.body.managementToken, second.body.token, second.body.managementToken]) {
    assert.match(value, /^[A-Za-z0-9_-]{43}$/);
  }
  assert.equal(new Set([first.body.token, first.body.managementToken, second.body.token, second.body.managementToken]).size, 4);
  assert.notEqual(first.body.token, first.body.managementToken);
  assert.equal(first.record.managementTokenHash, digest(first.body.managementToken));
  assert.equal(first.record.managementToken, undefined);
  assert.doesNotMatch(JSON.stringify(first.record), new RegExp(first.body.managementToken));
  assert.doesNotMatch(first.body.url, new RegExp(first.body.managementToken));
  assert.doesNotMatch(first.record.html, new RegExp(first.body.managementToken));
});

test('create stores only supplied document metadata under PUBLIC_SCHEDULES', async () => {
  const bindings = env();
  const { body, record } = await createPublication(bindings);
  assert.deepEqual(bindings.PUBLIC_SCHEDULES.puts.map(([key]) => key), [`schedule:${body.token}`]);
  assert.deepEqual(Object.keys(record).sort(), ['contentHash', 'createdAt', 'disabledAt', 'html', 'managementTokenHash', 'scope', 'title', 'updatedAt']);
  assert.equal(record.scope, 'full');
  assert.equal(record.contentHash, digest(record.html));
  assert.equal(bindings.COURT.puts.length, 0);
  for (const forbidden of ['players', 'games', 'events', 'ratings', 'seedRating', 'history', 'notes', 'settings', 'deletions', 'tomb']) {
    assert.equal(Object.hasOwn(record, forbidden), false);
  }
});

test('create accepts results and existing scopes, stores results, and rejects other scope forms', async () => {
  const resultsBindings = env();
  const resultsHtml = scheduleHtml('Summer Cup Results');
  const resultsResponse = await worker.fetch(request('/api/public-schedules', createInit(resultsHtml, {
    body: { title: 'Summer Cup Results · Court event recap', scope: 'results' }
  })), resultsBindings);
  assert.equal(resultsResponse.status, 201);
  const resultsBody = await resultsResponse.json();
  assert.match(resultsBody.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(resultsBody.managementToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(resultsBody.url, `https://court-sync.example/s/${resultsBody.token}`);
  const resultsRecord = JSON.parse(resultsBindings.PUBLIC_SCHEDULES.values.get(`schedule:${resultsBody.token}`));
  assert.equal(resultsRecord.scope, 'results');

  for (const scope of ['full', 'team:x', 'entry:x', 'player:x']) {
    const response = await worker.fetch(request('/api/public-schedules', createInit(undefined, { body: { scope } })), env());
    assert.equal(response.status, 201, `expected scope ${scope} to be accepted`);
  }

  for (const scope of ['recap', 'results:extra']) {
    const response = await worker.fetch(request('/api/public-schedules', createInit(undefined, { body: { scope } })), env());
    assert.equal(response.status, 400, `expected scope ${scope} to be rejected`);
    assert.deepEqual(await response.json(), { ok: false, error: 'scope is invalid' });
  }
});

test('public GET returns the exact stored HTML with security headers and never reads COURT', async () => {
  const bindings = env();
  const html = scheduleHtml('Exact bytes: café & volleyball');
  const { body } = await createPublication(bindings, html);
  bindings.COURT.gets.length = 0;
  const response = await worker.fetch(request(`/s/${body.token}`), bindings);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), html);
  assert.equal(bindings.COURT.gets.length, 0);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  const behaviorScript = await (await worker.fetch(request('/assets/public-event.js'), bindings)).text();
  const behaviorHash = createHash('sha256').update(behaviorScript).digest('base64');
  assert.ok(response.headers.get('content-security-policy').includes(`'sha256-${behaviorHash}'`));
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
});

test('update requires the management token, preserves identity/creation, and replaces exact document fields', async () => {
  const bindings = env();
  const created = await createPublication(bindings);
  const nextHtml = scheduleHtml('Updated Cup');
  const updateBody = { html: nextHtml, title: 'Updated Cup · Court schedule', contentHash: digest(nextHtml) };
  const bad = await worker.fetch(request(`/api/public-schedules/${created.body.token}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Management-Token': 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'X-Court-Room': 'test-room', Origin: ORIGIN }, body: JSON.stringify(updateBody)
  }), bindings);
  assert.equal(bad.status, 403);

  const response = await worker.fetch(request(`/api/public-schedules/${created.body.token}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Management-Token': created.body.managementToken, Origin: ORIGIN }, body: JSON.stringify(updateBody)
  }), bindings);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.token, created.body.token);
  assert.equal(result.url, created.body.url);
  assert.equal(result.publishedAt, created.record.createdAt);
  assert.ok(result.updatedAt >= created.record.updatedAt);
  assert.equal(result.managementToken, undefined);
  const record = JSON.parse(bindings.PUBLIC_SCHEDULES.values.get(`schedule:${created.body.token}`));
  assert.equal(record.createdAt, created.record.createdAt);
  assert.equal(record.html, nextHtml);
  assert.equal(record.title, updateBody.title);
  assert.equal(record.contentHash, updateBody.contentHash);
});

test('disable is management-token protected, retained, isolated, and returns 410 without old HTML', async () => {
  const bindings = env();
  const one = await createPublication(bindings, scheduleHtml('Private old document marker'));
  const two = await createPublication(bindings, scheduleHtml('Still active'));
  const roomSubstitute = await worker.fetch(request(`/api/public-schedules/${one.body.token}`, {
    method: 'DELETE', headers: { 'X-Management-Token': 'test-room', 'X-Court-Room': 'test-room', Origin: ORIGIN }
  }), bindings);
  assert.equal(roomSubstitute.status, 403);
  const response = await worker.fetch(request(`/api/public-schedules/${one.body.token}`, {
    method: 'DELETE', headers: { 'X-Management-Token': one.body.managementToken, Origin: ORIGIN }
  }), bindings);
  assert.equal(response.status, 200);
  const record = JSON.parse(bindings.PUBLIC_SCHEDULES.values.get(`schedule:${one.body.token}`));
  assert.ok(record.disabledAt);
  const disabled = await worker.fetch(request(`/s/${one.body.token}`), bindings);
  assert.equal(disabled.status, 410);
  assert.doesNotMatch(await disabled.text(), /Private old document marker/);
  assert.equal((await worker.fetch(request(`/s/${two.body.token}`), bindings)).status, 200);
  const again = await worker.fetch(request(`/api/public-schedules/${one.body.token}`, {
    method: 'DELETE', headers: { 'X-Management-Token': one.body.managementToken, Origin: ORIGIN }
  }), bindings);
  assert.equal(again.status, 410);
});

test('validation rejects malformed, non-HTML, mismatched, oversized, extra-state, invalid-token, and unsupported-method requests', async () => {
  const bindings = env();
  const malformed = await worker.fetch(request('/api/public-schedules', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Court-Room': 'test-room', Origin: ORIGIN }, body: '{' }), bindings);
  assert.equal(malformed.status, 400);
  const nonHtml = await worker.fetch(request('/api/public-schedules', createInit('not html')), bindings);
  assert.equal(nonHtml.status, 400);
  const html = scheduleHtml('Mismatch');
  const mismatch = await worker.fetch(request('/api/public-schedules', createInit(html, { body: { contentHash: '0'.repeat(64) } })), bindings);
  assert.equal(mismatch.status, 400);
  const privateState = await worker.fetch(request('/api/public-schedules', createInit(html, { body: { players: [{ rating: 99 }] } })), bindings);
  assert.equal(privateState.status, 400);
  const oversizedHtml = `<!DOCTYPE html><html><head><title>Large</title></head><body>${'x'.repeat(10 * 1024 * 1024)}</body></html>`;
  const oversized = await worker.fetch(request('/api/public-schedules', createInit(oversizedHtml)), bindings);
  assert.equal(oversized.status, 413);
  const invalidToken = await worker.fetch(request('/api/public-schedules/not-valid!', { method: 'DELETE', headers: { 'X-Management-Token': 'A'.repeat(43), Origin: ORIGIN } }), bindings);
  assert.equal(invalidToken.status, 400);
  const unsupported = await worker.fetch(request('/api/public-schedules', { method: 'GET', headers: { Origin: ORIGIN } }), bindings);
  assert.equal(unsupported.status, 405);
});

test('private API CORS allows exact approved/local origins and rejects disallowed origins', async () => {
  const bindings = env();
  for (const origin of [ORIGIN, 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173']) {
    const preflight = await worker.fetch(request('/api/public-schedules', {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type,X-Court-Room,X-Management-Token' }
    }), bindings);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
    assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/);
    assert.match(preflight.headers.get('access-control-allow-methods'), /DELETE/);
    assert.match(preflight.headers.get('access-control-allow-headers'), /X-Court-Room/);
    assert.match(preflight.headers.get('access-control-allow-headers'), /X-Management-Token/);
    assert.equal(preflight.headers.get('vary'), 'Origin');
  }
  const rejected = await worker.fetch(request('/api/public-schedules', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), bindings);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  const createRejected = await worker.fetch(request('/api/public-schedules', createInit(undefined, { headers: { Origin: 'https://evil.example' } })), bindings);
  assert.equal(createRejected.status, 403);
});

test('photo capability status and preflight are safe, allowlisted, and ordered before legacy sync', async () => {
  const bindings = env();
  const ready = await worker.fetch(request('/api/player-photos/status', { headers: { Origin: ORIGIN } }), bindings);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { available: true });
  assert.equal(ready.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(bindings.COURT.gets.length, 0);

  const unavailable = await worker.fetch(request('/api/player-photos/status', { headers: { Origin: ORIGIN } }), env({ photoBinding: false }));
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.json();
  assert.deepEqual(unavailableBody, { available: false, error: 'player photo storage unavailable' });
  assert.doesNotMatch(JSON.stringify(unavailableBody), /PLAYER_PHOTOS|bucket|account|R2/i);

  const preflight = await worker.fetch(request('/api/player-photos/player-1', {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'Content-Type,X-Court-Room,X-Photo-Width,X-Photo-Height,X-Photo-Public,X-Photo-Token' }
  }), bindings);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  for (const value of ['PATCH', 'X-Court-Room', 'X-Photo-Width', 'X-Photo-Height', 'X-Photo-Public', 'X-Photo-Token']) {
    assert.match(`${preflight.headers.get('access-control-allow-methods')} ${preflight.headers.get('access-control-allow-headers')}`, new RegExp(value, 'i'));
  }
  assert.notEqual(preflight.headers.get('access-control-allow-origin'), '*', 'private photo CORS must never be wildcard');
});

test('photo capability and preflight use strict approved-origin CORS without wildcard access', async () => {
  const bindings = env();
  const preflight = await worker.fetch(request('/api/player-photos/player-1', {
    method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'PUT' }
  }), bindings);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  assert.notEqual(preflight.headers.get('access-control-allow-origin'), '*');
  assert.match(preflight.headers.get('access-control-allow-methods'), /PATCH/);
  for (const header of ['X-Court-Room', 'X-Photo-Width', 'X-Photo-Height', 'X-Photo-Public', 'X-Photo-Token']) {
    assert.match(preflight.headers.get('access-control-allow-headers'), new RegExp(header, 'i'));
  }
  const rejected = await worker.fetch(request('/api/player-photos/status', { headers: { Origin: 'https://evil.example' } }), bindings);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  const rejectedUpload = await worker.fetch(request('/api/player-photos/player-1', photoInit(webp, { headers: { Origin: 'https://evil.example' } })), bindings);
  assert.equal(rejectedUpload.status, 403);
  assert.equal(bindings.PLAYER_PHOTOS.puts.length, 0);
});

test('photo routes require an existing room and validate IDs and tokens before R2 access', async () => {
  const missingHeader = photoInit();
  delete missingHeader.headers['X-Court-Room'];
  const missing = await worker.fetch(request('/api/player-photos/player-1', missingHeader), env());
  assert.equal(missing.status, 401);

  const unknownBindings = env({ room: false });
  const unknown = await uploadPhoto(unknownBindings);
  assert.equal(unknown.response.status, 403);
  assert.doesNotMatch(JSON.stringify(unknown.body), /test-room|room:/);
  assert.equal(unknownBindings.PLAYER_PHOTOS.heads.length, 0);
  assert.equal(unknownBindings.PLAYER_PHOTOS.puts.length, 0);

  const invalidIdBindings = env();
  const invalidId = await uploadPhoto(invalidIdBindings, 'bad$id');
  assert.equal(invalidId.response.status, 400);
  assert.equal(invalidIdBindings.PLAYER_PHOTOS.puts.length, 0);

  const invalidTokenBindings = env();
  const invalidToken = await worker.fetch(request('/api/player-photos/not-valid!', { method: 'GET', headers: { 'X-Court-Room': 'test-room', Origin: ORIGIN } }), invalidTokenBindings);
  assert.equal(invalidToken.status, 400);
  assert.equal(invalidTokenBindings.PLAYER_PHOTOS.heads.length + invalidTokenBindings.PLAYER_PHOTOS.gets.length, 0);
});

test('upload rejects unsupported, empty, mismatched, SVG, GIF, invalid dimensions, and oversized bodies', async () => {
  const cases = [
    { body: webp, extra: { headers: { 'Content-Type': 'image/png' } }, status: 415 },
    { body: new Uint8Array(), extra: {}, status: 415 },
    { body: jpeg, extra: {}, status: 415 },
    { body: new TextEncoder().encode('<svg></svg>'), extra: { headers: { 'Content-Type': 'image/jpeg' } }, status: 415 },
    { body: Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), extra: { headers: { 'Content-Type': 'image/jpeg' } }, status: 415 },
    { body: webp, extra: { headers: { 'X-Photo-Width': '0' } }, status: 400 },
    { body: webp, extra: { headers: { 'X-Photo-Height': '1025' } }, status: 400 },
    { body: new Uint8Array(750 * 1024 + 1).fill(1), extra: {}, status: 413 },
  ];
  for (const [index, entry] of cases.entries()) {
    const bindings = env();
    const result = await uploadPhoto(bindings, `player-${index}`, entry.body, entry.extra);
    assert.equal(result.response.status, entry.status, `case ${index}`);
    assert.equal(bindings.PLAYER_PHOTOS.puts.length, 0, `case ${index} must not write`);
  }
});

test('valid WebP and JPEG uploads use opaque keys, hashed room metadata, and safe response metadata', async () => {
  for (const [body, contentType] of [[webp, 'image/webp'], [jpeg, 'image/jpeg']]) {
    const bindings = env();
    const result = await uploadPhoto(bindings, 'safe-player.1', body, { headers: { 'Content-Type': contentType } });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.ok, true);
    assert.match(result.body.photo.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(result.body.photo.contentType, contentType);
    assert.equal(result.body.photo.public, false);
    assert.equal(result.body.photo.width, 512);
    assert.equal(result.body.photo.height, 512);
    assert.equal(result.body.photo.bytes, body.byteLength);
    assert.match(result.body.photo.revision, /^[A-Za-z0-9._~-]+$/);
    const write = bindings.PLAYER_PHOTOS.puts[0];
    assert.equal(write.key, `player-photos/${result.body.photo.token}`);
    assert.deepEqual(Object.keys(write.options.customMetadata).sort(), ['height', 'playerId', 'public', 'roomHash', 'width']);
    assert.equal(write.options.customMetadata.roomHash, digest('test-room'));
    assert.equal(write.options.customMetadata.playerId, 'safe-player.1');
    assert.equal(write.options.customMetadata.public, '0');
    assert.equal(write.options.httpMetadata.contentType, contentType);
    assert.equal(write.options.httpMetadata.contentDisposition, 'inline');
    assert.doesNotMatch(write.key + JSON.stringify(write.options), /test-room/);
    assert.doesNotMatch(JSON.stringify(result.body), /roomHash|room:|test-room|player-photos\//);
  }
});

test('replacement reuses tokens only for the matching room and player and updates revision', async () => {
  const bindings = env({ rooms: {
    'room:test-room': JSON.stringify({ ts: 1, data: '{}' }),
    'room:other-room': JSON.stringify({ ts: 1, data: '{}' })
  } });
  const first = await uploadPhoto(bindings, 'owner-player');
  const token = first.body.photo.token, revision = first.body.photo.revision;
  const replacement = await uploadPhoto(bindings, 'owner-player', jpeg, { headers: { 'Content-Type': 'image/jpeg', 'X-Photo-Token': token } });
  assert.equal(replacement.response.status, 200);
  assert.equal(replacement.body.photo.token, token);
  assert.notEqual(replacement.body.photo.revision, revision);
  assert.equal(replacement.body.photo.contentType, 'image/jpeg');

  const crossPlayer = await uploadPhoto(bindings, 'different-player', webp, { headers: { 'X-Photo-Token': token } });
  assert.equal(crossPlayer.response.status, 404);
  const crossRoom = await uploadPhoto(bindings, 'owner-player', webp, { headers: { 'X-Photo-Token': token, 'X-Court-Room': 'other-room' } });
  assert.equal(crossRoom.response.status, 404);
  assert.equal(bindings.PLAYER_PHOTOS.puts.length, 2);
  assert.doesNotMatch(JSON.stringify(crossPlayer.body) + JSON.stringify(crossRoom.body), /roomHash|test-room|other-room/);
});

test('private reads are room-scoped, stream bytes, support ETag, and use conservative headers', async () => {
  const bindings = env({ rooms: {
    'room:test-room': JSON.stringify({ ts: 1, data: '{}' }),
    'room:other-room': JSON.stringify({ ts: 1, data: '{}' })
  } });
  const uploaded = await uploadPhoto(bindings, 'reader');
  const path = `/api/player-photos/${uploaded.body.photo.token}`;
  const own = await worker.fetch(request(path, { headers: { 'X-Court-Room': 'test-room', Origin: ORIGIN } }), bindings);
  assert.equal(own.status, 200);
  assert.deepEqual(new Uint8Array(await own.arrayBuffer()), webp);
  assert.equal(own.headers.get('content-type'), 'image/webp');
  assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(own.headers.get('referrer-policy'), 'no-referrer');
  assert.match(own.headers.get('cache-control'), /private/);
  assert.ok(own.headers.get('etag'));
  const conditional = await worker.fetch(request(path, { headers: { 'X-Court-Room': 'test-room', Origin: ORIGIN, 'If-None-Match': own.headers.get('etag') } }), bindings);
  assert.equal(conditional.status, 304);
  const other = await worker.fetch(request(path, { headers: { 'X-Court-Room': 'other-room', Origin: ORIGIN } }), bindings);
  assert.equal(other.status, 404);
  assert.doesNotMatch(await other.text(), /roomHash|test-room|other-room/);
});

test('visibility opt-in and opt-out rewrite only metadata and immediately gate public GET and HEAD', async () => {
  const bindings = env();
  const uploaded = await uploadPhoto(bindings, 'visible-player');
  const token = uploaded.body.photo.token;
  const apiPath = `/api/player-photos/${token}`, mediaPath = `/media/player-photos/${token}?v=${uploaded.body.photo.revision}`;
  assert.equal((await worker.fetch(request(mediaPath), bindings)).status, 404);

  const enabled = await worker.fetch(request(apiPath, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Court-Room': 'test-room', Origin: ORIGIN }, body: JSON.stringify({ public: true })
  }), bindings);
  assert.equal(enabled.status, 200);
  const enabledBody = await enabled.json();
  assert.equal(enabledBody.photo.public, true);
  assert.notEqual(enabledBody.photo.revision, uploaded.body.photo.revision);
  assert.deepEqual(bindings.PLAYER_PHOTOS.puts[1].bytes, webp);
  assert.deepEqual(Object.keys(bindings.PLAYER_PHOTOS.puts[1].options.customMetadata).sort(), ['height', 'playerId', 'public', 'roomHash', 'width']);

  const publicGet = await worker.fetch(request(`/media/player-photos/${token}?v=${enabledBody.photo.revision}`), bindings);
  assert.equal(publicGet.status, 200);
  assert.deepEqual(new Uint8Array(await publicGet.arrayBuffer()), webp);
  assert.equal(publicGet.headers.get('content-type'), 'image/webp');
  assert.equal(publicGet.headers.get('content-disposition'), 'inline');
  assert.equal(publicGet.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(publicGet.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(publicGet.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(publicGet.headers.get('cache-control'), /immutable/);
  assert.equal(publicGet.headers.get('x-amz-meta-roomhash'), null);
  assert.equal(publicGet.headers.get('roomHash'), null);

  const publicHead = await worker.fetch(request(`/media/player-photos/${token}`, { method: 'HEAD' }), bindings);
  assert.equal(publicHead.status, 200);
  assert.equal((await publicHead.arrayBuffer()).byteLength, 0);
  const disabled = await worker.fetch(request(apiPath, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Court-Room': 'test-room', Origin: ORIGIN }, body: JSON.stringify({ public: false })
  }), bindings);
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).photo.public, false);
  assert.equal((await worker.fetch(request(`/media/player-photos/${token}`), bindings)).status, 404);
});

test('visibility validation, unsupported methods, and public invalid tokens do not mutate or disclose objects', async () => {
  const bindings = env();
  const uploaded = await uploadPhoto(bindings, 'method-player');
  const path = `/api/player-photos/${uploaded.body.photo.token}`;
  for (const value of [{ public: 'yes' }, { public: true, extra: 1 }, null]) {
    const response = await worker.fetch(request(path, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Court-Room': 'test-room', Origin: ORIGIN }, body: JSON.stringify(value)
    }), bindings);
    assert.equal(response.status, 400);
  }
  assert.equal(bindings.PLAYER_PHOTOS.puts.length, 1);
  assert.equal((await worker.fetch(request(path, { method: 'POST', headers: { 'X-Court-Room': 'test-room', Origin: ORIGIN } }), bindings)).status, 405);
  assert.equal((await worker.fetch(request(`/media/player-photos/${uploaded.body.photo.token}`, { method: 'POST' }), bindings)).status, 405);
  const getsBefore = bindings.PLAYER_PHOTOS.gets.length, headsBefore = bindings.PLAYER_PHOTOS.heads.length;
  assert.equal((await worker.fetch(request('/media/player-photos/not-valid!'), bindings)).status, 404);
  assert.equal(bindings.PLAYER_PHOTOS.gets.length, getsBefore);
  assert.equal(bindings.PLAYER_PHOTOS.heads.length, headsBefore);
});

test('delete is exact, room-authorized, idempotent for missing objects, and cannot cross rooms', async () => {
  const bindings = env({ rooms: {
    'room:test-room': JSON.stringify({ ts: 1, data: '{}' }),
    'room:other-room': JSON.stringify({ ts: 1, data: '{}' })
  } });
  const one = await uploadPhoto(bindings, 'delete-one');
  const two = await uploadPhoto(bindings, 'delete-two');
  const path = `/api/player-photos/${one.body.photo.token}`;
  const crossRoom = await worker.fetch(request(path, { method: 'DELETE', headers: { 'X-Court-Room': 'other-room', Origin: ORIGIN } }), bindings);
  assert.equal(crossRoom.status, 404);
  assert.equal(bindings.PLAYER_PHOTOS.deletes.length, 0);
  assert.ok(bindings.PLAYER_PHOTOS.values.has(`player-photos/${one.body.photo.token}`));
  assert.ok(bindings.PLAYER_PHOTOS.values.has(`player-photos/${two.body.photo.token}`));

  const removed = await worker.fetch(request(path, { method: 'DELETE', headers: { 'X-Court-Room': 'test-room', Origin: ORIGIN } }), bindings);
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { ok: true });
  assert.deepEqual(bindings.PLAYER_PHOTOS.deletes, [`player-photos/${one.body.photo.token}`]);
  assert.ok(bindings.PLAYER_PHOTOS.values.has(`player-photos/${two.body.photo.token}`));
  const again = await worker.fetch(request(path, { method: 'DELETE', headers: { 'X-Court-Room': 'test-room', Origin: ORIGIN } }), bindings);
  assert.equal(again.status, 200);
  assert.equal(bindings.PLAYER_PHOTOS.deletes.length, 1);
});

test('public schedule CSP adds only same-origin images and missing R2 never breaks legacy or schedules', async () => {
  const bindings = env({ photoBinding: false });
  const posted = await worker.fetch(request('/?room=legacy-room', { method: 'POST', body: '{"ts":9,"data":"legacy"}' }), bindings);
  assert.equal(posted.status, 200);
  assert.deepEqual(await posted.json(), { ok: true });
  assert.equal((await worker.fetch(request('/?room=legacy-room'), bindings)).status, 200);
  const publication = await createPublication(bindings);
  const publicPage = await worker.fetch(request(`/s/${publication.body.token}`), bindings);
  assert.equal(publicPage.status, 200);
  const csp = publicPage.headers.get('content-security-policy');
  assert.match(csp, /^default-src 'none';/);
  assert.match(csp, /img-src 'self' data:/);
  assert.doesNotMatch(csp, /img-src[^;]*https:|default-src \*/);
});

test('Worker source keeps one passthrough renderer boundary and no schedule template implementation', () => {
  assert.match(source, /return new Response\(record\.html/);
  assert.doesNotMatch(source, /scheduleExportBodyHtml|participantScheduleBodyHtml|scheduleDocumentStyles|deriveFullScheduleExportModel/);
  assert.doesNotMatch(source, /Math\.random/);
});
