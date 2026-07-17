import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');

const source = await readFile(new URL('../cloudflare/court-sync-worker.js', import.meta.url), 'utf8');
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

const digest = value => createHash('sha256').update(value).digest('hex');
const scheduleHtml = title => `<!DOCTYPE html><html lang="en"><head><title>${title}</title><style>body{color:#172033}</style></head><body><main>${title}</main></body></html>`;

function env({ room = true, publicBinding = true } = {}) {
  return {
    COURT: new MemoryKV(room ? { 'room:test-room': JSON.stringify({ ts: 1, data: '{}' }) } : {}),
    ...(publicBinding ? { PUBLIC_SCHEDULES: new MemoryKV() } : {}),
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
  assert.match(script, /navigator\.share/);
  assert.doesNotMatch(script, /COURT|PUBLIC_SCHEDULES|room:|managementToken|localStorage/i);
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

test('Worker source keeps one passthrough renderer boundary and no schedule template implementation', () => {
  assert.match(source, /return new Response\(record\.html/);
  assert.doesNotMatch(source, /scheduleExportBodyHtml|participantScheduleBodyHtml|scheduleDocumentStyles|deriveFullScheduleExportModel/);
  assert.doesNotMatch(source, /Math\.random/);
});
