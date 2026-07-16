import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5173/';
const WORKER_URL = 'https://court-sync.joshsven92.workers.dev';
const WORKER_ROUTE = /^https:\/\/court-sync\.joshsven92\.workers\.dev\/.*/;

function player(id, name, seedRating = 50) {
  return { id, name, seedRating, rating: seedRating, roles: {}, lifetime: {}, history: [{ i: 0, r: seedRating }], active: true, archived: false };
}

function game(id, date, extra = {}) {
  return { id, date, teamA: [], teamB: [], scoreA: 25, scoreB: 20, winner: 'A', log: {}, ...extra };
}

function syncPayload({ players = [], games = [], events = [], settings = {}, tomb = {} } = {}) {
  return { players, games, settings, events, tomb, v: 1 };
}

async function seedDevice(page, { players = [], games = [], events = [], settings = {}, sync, tomb, syncTs } = {}) {
  await page.addInitScript(state => {
    localStorage.setItem('vb:players', JSON.stringify(state.players));
    localStorage.setItem('vb:games', JSON.stringify(state.games));
    localStorage.setItem('vb:events', JSON.stringify(state.events));
    localStorage.setItem('vb:settings', JSON.stringify(state.settings));
    if (state.sync) localStorage.setItem('vb:sync', JSON.stringify(state.sync));
    if (state.tomb) localStorage.setItem('vb:tomb', JSON.stringify(state.tomb));
    if (state.syncTs != null) localStorage.setItem('vb:syncTs', String(state.syncTs));
  }, { players, games, events, settings, sync, tomb, syncTs });
}

async function stubWorker(page, rooms) {
  await page.route(WORKER_ROUTE, async route => {
    const request = route.request();
    const code = new URL(request.url()).searchParams.get('room');
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET,POST,OPTIONS' }, body: '' });
      return;
    }
    if (request.method() === 'GET') {
      const room = rooms.get(code) || { ts: 0, data: null };
      await route.fulfill({ status: 200, headers, body: JSON.stringify(room) });
      return;
    }
    if (request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      rooms.set(code, { ts: body.ts, data: body.data });
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 405, headers, body: JSON.stringify({ error: 'method' }) });
  });
}

test('newer remote data unions records by id and wins id collisions', async ({ page }) => {
  const code = 'merge-room';
  const rooms = new Map([[code, {
    ts: 20,
    data: JSON.stringify(syncPayload({
      players: [player('p-shared', 'Remote Shared', 60), player('p-remote', 'Remote Only', 55)],
      games: [game('g-shared', 2, { label: 'remote game' }), game('g-remote', 3)],
      events: [{ id: 'e-shared', name: 'Remote Event' }, { id: 'e-remote', name: 'Remote Only Event' }],
      settings: { hideRatings: true, eloK: 8 }
    }))
  }]]);
  await seedDevice(page, {
    players: [player('p-local', 'Local Only'), player('p-shared', 'Local Shared')],
    games: [game('g-local', 1), game('g-shared', 2, { label: 'local game' })],
    events: [{ id: 'e-local', name: 'Local Event' }, { id: 'e-shared', name: 'Local Event Name' }],
    settings: { hideRatings: false, eloK: 3 },
    sync: { url: WORKER_URL, code, on: true },
    syncTs: 10
  });
  await stubWorker(page, rooms);
  await page.goto('/');

  await expect.poll(() => page.evaluate(() => players.find(p => p.id === 'p-shared')?.name)).toBe('Remote Shared');
  const merged = await page.evaluate(() => ({
    players: players.map(p => p.id).sort(),
    games: games.map(g => g.id).sort(),
    events: evts.map(e => e.id).sort(),
    sharedGame: games.find(g => g.id === 'g-shared')?.label,
    sharedEvent: evts.find(e => e.id === 'e-shared')?.name,
    settings: { hideRatings: settings.hideRatings, eloK: settings.eloK }
  }));
  expect(merged).toEqual({
    players: ['p-local', 'p-remote', 'p-shared'],
    games: ['g-local', 'g-remote', 'g-shared'],
    events: ['e-local', 'e-remote', 'e-shared'],
    sharedGame: 'remote game',
    sharedEvent: 'Remote Event',
    settings: { hideRatings: true, eloK: 8 }
  });
});

test('game tombstones drop merged games, retain max timestamps, and prevent resurrection', async ({ page }) => {
  const code = 'tomb-room';
  const rooms = new Map([[code, {
    ts: 50,
    data: JSON.stringify(syncPayload({
      games: [game('gone', 1), game('remote', 3)],
      tomb: { gone: 10, carried: 9 }
    }))
  }]]);
  await seedDevice(page, {
    games: [game('gone', 1), game('local', 2)],
    sync: { url: WORKER_URL, code, on: true },
    tomb: { gone: 20, carried: 5 },
    syncTs: 0
  });
  await stubWorker(page, rooms);
  await page.goto('/');

  await expect.poll(() => page.evaluate(() => games.map(g => g.id).sort())).toEqual(['local', 'remote']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vb:tomb')))).toEqual({ gone: 20, carried: 9 });
  await expect.poll(() => rooms.get(code).ts).toBeGreaterThan(50);

  const current = rooms.get(code);
  const stale = JSON.parse(current.data);
  stale.games.push(game('gone', 99, { label: 'stale resurrection' }));
  stale.tomb = { ...stale.tomb, gone: 10 };
  rooms.set(code, { ts: current.ts + 1, data: JSON.stringify(stale) });
  await page.evaluate(() => Sync.pull({ force: true }));

  expect(await page.evaluate(() => games.map(g => g.id).sort())).toEqual(['local', 'remote']);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('vb:tomb')))).gone).toBe(20);
});

test('rating replay is independent of stored game order', async ({ page }) => {
  await page.goto('/');
  const ratings = await page.evaluate(() => {
    const basePlayers = [
      { id: 'a', name: 'A', seedRating: 60 }, { id: 'b', name: 'B', seedRating: 55 },
      { id: 'c', name: 'C', seedRating: 45 }, { id: 'd', name: 'D', seedRating: 40 }
    ];
    const records = [
      { id: 'later', date: 200, teamA: ['a', 'c'], teamB: ['b', 'd'], scoreA: 18, scoreB: 25, winner: 'B', log: {} },
      { id: 'earlier', date: 100, teamA: ['a', 'b'], teamB: ['c', 'd'], scoreA: 25, scoreB: 15, winner: 'A', log: {} }
    ];
    const replay = order => {
      players = basePlayers.map(p => ({ ...p, roles: {}, lifetime: {}, history: [{ i: 0, r: p.seedRating }], active: true, archived: false }));
      games = order.map(index => JSON.parse(JSON.stringify(records[index])));
      settings = { ...DEFAULT_SETTINGS };
      recomputeAll();
      return Object.fromEntries(players.map(p => [p.id, p.rating]));
    };
    return [replay([0, 1]), replay([1, 0])];
  });
  expect(ratings[0]).toEqual(ratings[1]);
});

test('sync payload excludes device-local config keys', async ({ page }) => {
  const code = 'payload-room';
  const rooms = new Map();
  await seedDevice(page, {
    players: [player('local', 'Local')],
    sync: { url: WORKER_URL, code, on: true },
    tomb: { deleted: 123 },
    syncTs: 7
  });
  await stubWorker(page, rooms);
  await page.goto('/');
  await expect.poll(() => rooms.get(code)?.data || null).not.toBeNull();

  const sent = JSON.parse(rooms.get(code).data);
  expect(Object.keys(sent).sort()).toEqual(['events', 'games', 'players', 'settings', 'tomb', 'v']);
  expect(JSON.stringify(sent)).not.toContain('vb:sync');
  expect(sent).not.toHaveProperty('sync');
  expect(sent).not.toHaveProperty('syncTs');
  expect(sent.tomb).toEqual({ deleted: 123 });
});

test('failed network requests never block local game persistence', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await seedDevice(page, { sync: { url: WORKER_URL, code: 'offline-room', on: true } });
  await page.route(WORKER_ROUTE, route => route.abort('failed'));
  await page.goto('/');

  const stored = await page.evaluate(async () => {
    games.push({ id: 'offline-game', date: 1, teamA: [], teamB: [], scoreA: 25, scoreB: 20, winner: 'A', log: {} });
    await commit();
    return JSON.parse(localStorage.getItem('vb:games')).map(g => g.id);
  });
  expect(stored).toContain('offline-game');
  await page.waitForTimeout(1700);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vb:games')).some(g => g.id === 'offline-game'))).toBe(true);
});

test('stubbed worker round-trip syncs a new game and its later deletion', async ({ browser }) => {
  const rooms = new Map();
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    await seedDevice(pageA, { players: [player('a', 'A'), player('b', 'B')] });
    await stubWorker(pageA, rooms);
    await stubWorker(pageB, rooms);
    await pageA.goto(BASE_URL);
    expect(await pageA.evaluate(() => Sync.connect('', 'roundtrip-room'))).toBe('seeded');

    await pageB.goto(BASE_URL);
    expect(await pageB.evaluate(async () => ({ result: await Sync.connect('', 'roundtrip-room'), on: Sync.cfg.on }))).toEqual({ result: 'has-data', on: false });
    await pageB.evaluate(() => Sync.adopt('replace'));
    expect(await pageB.evaluate(() => Sync.cfg.on)).toBe(true);
    expect(await pageB.evaluate(() => players.map(p => p.id).sort())).toEqual(['a', 'b']);

    await pageA.evaluate(async () => {
      games.push({ id: 'cross-device-game', date: 100, teamA: ['a'], teamB: ['b'], scoreA: 25, scoreB: 20, winner: 'A', log: {} });
      await commit();
      await Sync.push({ force: true });
    });
    await pageB.evaluate(() => Sync.pull({ force: true }));
    expect(await pageB.evaluate(() => games.some(g => g.id === 'cross-device-game'))).toBe(true);

    await pageB.evaluate(async () => {
      window.askConfirm = async () => true;
      await deleteGame('cross-device-game');
      await Sync.push({ force: true });
    });
    await pageA.evaluate(() => Sync.pull({ force: true }));
    expect(await pageA.evaluate(() => games.some(g => g.id === 'cross-device-game'))).toBe(false);
    const remote = JSON.parse(rooms.get('roundtrip-room').data);
    expect(remote.games.some(g => g.id === 'cross-device-game')).toBe(false);
    expect(remote.tomb['cross-device-game']).toBeGreaterThan(0);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('setup prefills the default worker and a code-only connection uses it', async ({ page }) => {
  const rooms = new Map();
  await stubWorker(page, rooms);
  await page.goto('/');
  const prefilled = await page.evaluate(() => {
    tab = 'more';
    render();
    openSyncSetup();
    return $('#syncUrl').value;
  });
  expect(prefilled).toBe(WORKER_URL);

  await page.locator('#syncUrl').fill('');
  await page.locator('#syncCode').fill('code-only-room');
  await page.locator('.sheet').getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Sync on · this device is the source');
  await expect.poll(() => rooms.get('code-only-room')?.data || null).not.toBeNull();
  expect(await page.evaluate(() => ({ ...Sync.cfg, endpoint: Sync.endpoint() }))).toEqual({
    url: WORKER_URL,
    code: 'code-only-room',
    on: true,
    endpoint: `${WORKER_URL}/?room=code-only-room`
  });
});
