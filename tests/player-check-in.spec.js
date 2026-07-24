import { test, expect } from '@playwright/test';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');

const workerSource = readFileSync(`${process.cwd()}/cloudflare/court-sync-worker.js`, 'utf8');
let worker;
test.beforeAll(async () => {
  const loadModule = new Function('url', 'return import(url)');
  worker = (await loadModule(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`)).default;
});
const APP_WORKER = 'https://checkin.test';
const REAL_WORKER = 'https://court-sync.example';
const OWNER_ORIGIN = 'https://cheebychob.github.io';

function player(id, name, extra = {}) {
  return {
    id, name, seedRating: 48, rating: 48, active: true, archived: false,
    pickupEligible: true, aliases: [], roles: {}, lifetime: {}, history: [{ i: 0, r: 48 }],
    gamesPlayed: 0, wins: 0, losses: 0, notes: '', ...extra
  };
}

async function seed(page, roster, { sync = true } = {}) {
  await page.addInitScript(data => {
    localStorage.setItem('vb:players', JSON.stringify(data.roster));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', '[]');
    localStorage.setItem('vb:attendanceSessions', '[]');
    localStorage.setItem('vb:savedCrews', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ numTeams: 2, attendanceScope: 'all' }));
    if (data.sync) localStorage.setItem('vb:sync', JSON.stringify({ url: data.worker, code: 'test-room', on: false }));
  }, { roster, sync, worker: APP_WORKER });
}

function organizerMock(page) {
  const state = {
    session: null,
    checkIns: [],
    requests: [],
  };
  const makeSession = () => ({
    sessionId: 'S'.repeat(43),
    status: 'open',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    shortCode: '7KMFQ',
    publicUrl: `${APP_WORKER}/check-in/${'P'.repeat(43)}`,
    rosterCount: 3,
    label: 'Pickup volleyball',
  });
  page.route(`${APP_WORKER}/api/check-in/**`, async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    state.requests.push({ method, path: url.pathname, body: request.postDataJSON?.() });
    if (url.pathname === '/api/check-in/sessions' && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: state.session }) });
      return;
    }
    if (url.pathname === '/api/check-in/sessions' && method === 'POST') {
      state.session ||= makeSession();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, session: state.session, resumed: false }) });
      return;
    }
    if (url.pathname.endsWith('/review') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: state.session, checkIns: state.checkIns }) });
      return;
    }
    if (url.pathname.endsWith('/close') && method === 'POST') {
      state.session = { ...state.session, status: 'closed', updatedAt: Date.now() };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: state.session }) });
      return;
    }
    const disposition = url.pathname.match(/\/check-ins\/([^/]+)$/);
    if (disposition && method === 'POST') {
      const body = request.postDataJSON(), index = state.checkIns.findIndex(item => item.id === disposition[1]);
      if (index >= 0) {
        const current = state.checkIns[index];
        state.checkIns[index] = body.action === 'match'
          ? { ...current, playerId: body.playerId, status: 'checked-in', disposition: 'matched', updatedAt: Date.now() }
          : { ...current, status: body.action === 'dismiss' ? 'dismissed' : 'canceled', disposition: body.action, updatedAt: Date.now() };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, checkIn: state.checkIns[index] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  return state;
}

test('public roster projection is allowlisted and organizer can open, share, and close a session without snapshots', async ({ page }) => {
  const photo = { token: 'A'.repeat(43), revision: 'rev-1', contentType: 'image/webp', width: 512, height: 512, bytes: 100, public: true, updatedAt: 10 };
  const roster = [
    player('a', 'Same', { aliases: ['Ace'], rating: 99, seedRating: 90, notes: 'private', roles: { setter: true }, photo }),
    player('b', 'Same', { aliases: ['Bee'], rating: 12 }),
    player('inactive', 'Inactive', { active: false }),
    player('guest', 'Guest', { pickupEligible: false }),
  ];
  await seed(page, roster);
  const state = organizerMock(page);
  await page.goto('/');

  const projection = await page.evaluate(() => createPublicCheckInRoster());
  expect(projection).toHaveLength(2);
  expect(new Set(projection.map(row => row.displayName)).size).toBe(2);
  expect(Object.keys(projection[0]).sort()).toEqual(['displayName', 'photoUrl', 'sourcePlayerId']);
  expect(JSON.stringify(projection)).not.toMatch(/rating|seed|notes|roles|aliases|history|gamesPlayed/i);
  expect(projection[0].photoUrl).toMatch(/^\/media\/player-photos\//);
  expect(projection[1].photoUrl).toBeNull();

  await page.locator('[data-tab="teams"]:visible').first().click();
  await page.getByRole('button', { name: 'Open check-in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Open player check-in' })).toBeVisible();
  await page.locator('#scrim').getByRole('button', { name: 'Open check-in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Player check-in', exact: true, level: 3 })).toBeVisible();
  await expect(page.getByLabel('Player check-in link', { exact: true })).toHaveValue(state.session.publicUrl);
  await expect(page.getByLabel('Short code 7KMFQ')).toBeVisible();
  await expect(page.locator('.check-in-qr svg')).toBeVisible();
  expect(state.requests.find(request => request.method === 'POST').body.roster).toEqual(projection);
  expect(await page.evaluate(() => attendanceSessions)).toEqual([]);

  await page.getByRole('button', { name: 'Close session' }).click();
  await page.getByRole('button', { name: 'Close check-in', exact: true }).click();
  await expect(page.getByText('This public session has ended. Existing attendance is unchanged.')).toBeVisible();
  expect(await page.evaluate(() => attendanceSessions)).toEqual([]);
});

test('known and late check-ins merge additively, manual removal suppresses re-add, and pending names require review', async ({ page }) => {
  const roster = [player('a', 'Alpha'), player('b', 'Bravo', { aliases: ['Bee'] }), player('c', 'Charlie')];
  await seed(page, roster);
  const state = organizerMock(page);
  state.session = {
    sessionId: 'S'.repeat(43), status: 'open', createdAt: Date.now(), updatedAt: Date.now(),
    expiresAt: Date.now() + 60_000, shortCode: '7KMFQ',
    publicUrl: `${APP_WORKER}/check-in/${'P'.repeat(43)}`, rosterCount: 3, label: 'Pickup volleyball'
  };
  state.checkIns = [{
    id: 'K'.repeat(22), kind: 'known', publicPlayerId: 'Q'.repeat(22), playerId: 'a',
    displayName: 'Alpha', freeTextName: null, status: 'checked-in', disposition: null, createdAt: 1, updatedAt: 1
  }];
  await page.goto('/');
  await page.locator('[data-tab="teams"]:visible').first().click();
  await page.evaluate(() => { window._pool = new Set(['c']); renderTeams(); });
  await expect.poll(() => page.evaluate(() => [...window._pool].sort())).toEqual(['a', 'c']);
  await expect(page.locator('.attendance-selected-chip.check-in')).toContainText('Alpha');
  expect(await page.evaluate(() => attendanceSessions)).toEqual([]);

  state.checkIns.push({
    id: 'L'.repeat(22), kind: 'known', publicPlayerId: 'R'.repeat(22), playerId: 'b',
    displayName: 'Bravo', freeTextName: null, status: 'checked-in', disposition: null, createdAt: 2, updatedAt: 2
  });
  await page.evaluate(() => PlayerCheckIn.refresh());
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(['a', 'b', 'c']);

  await page.getByRole('button', { name: /Remove Alpha from attendance, public check-in/ }).click();
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(['b', 'c']);
  await page.evaluate(() => PlayerCheckIn.refresh());
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(['b', 'c']);

  state.checkIns.push({
    id: 'U'.repeat(22), kind: 'unknown', publicPlayerId: null, playerId: null,
    displayName: null, freeTextName: 'Jon from work', status: 'pending', disposition: null, createdAt: 3, updatedAt: 3
  });
  await page.evaluate(() => PlayerCheckIn.refresh());
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByText('Jon from work')).toBeVisible();
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(['b', 'c']);
  await page.getByRole('button', { name: 'Match', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search private roster for pending check-in' }).fill('Bee');
  await page.getByRole('button', { name: /Bravo · alias Bee/ }).click();
  await page.getByRole('button', { name: 'Match player', exact: true }).click();
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(['b', 'c']);
  expect(await page.evaluate(() => attendanceSessions)).toEqual([]);
});

class MemoryKV {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', limit = 1000 } = {}) {
    return { keys: [...this.values.keys()].filter(key => key.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name })), list_complete: true };
  }
}

async function proxyWorker(context, bindings) {
  await context.route(`${REAL_WORKER}/**`, async route => {
    const source = route.request(), headers = source.headers(), body = source.postDataBuffer();
    const response = await worker.fetch(new Request(source.url(), {
      method: source.method(), headers, body: ['GET', 'HEAD'].includes(source.method()) ? undefined : body
    }), bindings);
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: Buffer.from(await response.arrayBuffer())
    });
  });
}

test('standalone public page supports separate devices, returning state, cancellation, and pending unknowns', async ({ browser }) => {
  const bindings = {
    COURT: new MemoryKV({ 'room:test-room': JSON.stringify({ ts: 1, data: '{}' }) }),
    CHECK_IN_SESSIONS: new MemoryKV(),
    PUBLIC_SCHEDULES: new MemoryKV(),
  };
  const roster = [
    { sourcePlayerId: 'a', displayName: 'Lily D', photoUrl: null },
    { sourcePlayerId: 'b', displayName: 'Josh S', photoUrl: null },
    { sourcePlayerId: 'c', displayName: 'Claire R', photoUrl: null },
  ];
  const create = await worker.fetch(new Request(`${REAL_WORKER}/api/check-in/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Court-Room': 'test-room', Origin: OWNER_ORIGIN },
    body: JSON.stringify({ label: 'Tuesday volleyball', roster })
  }), bindings);
  const session = (await create.json()).session, pages = [], contexts = [];
  for (let index = 0; index < 3; index += 1) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await proxyWorker(context, bindings);
    contexts.push(context);
    pages.push(await context.newPage());
  }
  try {
    await Promise.all(pages.map(page => page.goto(session.publicUrl)));
    await pages[0].getByRole('searchbox', { name: 'Search public player names' }).fill('Lily');
    await pages[0].getByRole('button', { name: 'Lily D' }).click();
    await pages[0].getByRole('button', { name: 'Confirm' }).click();
    await expect(pages[0].getByText('You’re checked in as Lily D')).toBeVisible();

    await pages[1].getByRole('searchbox', { name: 'Search public player names' }).fill('Josh');
    await pages[1].getByRole('button', { name: 'Josh S' }).click();
    await pages[1].getByRole('button', { name: 'Confirm' }).click();
    await expect(pages[1].getByText('You’re checked in as Josh S')).toBeVisible();

    await pages[2].getByRole('button', { name: 'I’m not on the list' }).click();
    await pages[2].getByLabel('Name for organizer review').fill('<script>Guest Player</script>');
    await pages[2].getByRole('button', { name: 'Send for review' }).click();
    await expect(pages[2].getByText('Your name is pending organizer review.')).toBeVisible();

    await pages[0].reload();
    await expect(pages[0].getByText('You’re checked in as Lily D')).toBeVisible();
    await expect(pages[0].locator('body')).not.toContainText(/99|48|private note|Ace|setter|Josh S|Claire R/i);
    await pages[0].getByRole('button', { name: 'Cancel check-in' }).click();
    await expect(pages[0].getByRole('searchbox', { name: 'Search public player names' })).toBeVisible();

    const review = await worker.fetch(new Request(`${REAL_WORKER}/api/check-in/sessions/${session.sessionId}/review`, {
      headers: { 'X-Court-Room': 'test-room', Origin: OWNER_ORIGIN }
    }), bindings);
    const checkIns = (await review.json()).checkIns;
    expect(checkIns.filter(item => item.status === 'checked-in')).toHaveLength(1);
    expect(checkIns.filter(item => item.status === 'pending')).toHaveLength(1);
    expect(JSON.stringify(checkIns)).not.toContain('<script>');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
