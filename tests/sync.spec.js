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

function syncPayload({ players = [], games = [], events = [], settings = {}, tomb, deletions, v = deletions ? 2 : 1 } = {}) {
  const payload = { players, games, settings, events, v };
  if (tomb !== undefined) payload.tomb = tomb;
  if (deletions !== undefined) payload.deletions = deletions;
  return payload;
}

async function seedDevice(page, { players = [], games = [], events = [], settings = {}, sync, tomb, deletions, syncTs } = {}) {
  await page.addInitScript(state => {
    localStorage.setItem('vb:players', JSON.stringify(state.players));
    localStorage.setItem('vb:games', JSON.stringify(state.games));
    localStorage.setItem('vb:events', JSON.stringify(state.events));
    localStorage.setItem('vb:settings', JSON.stringify(state.settings));
    if (state.sync) localStorage.setItem('vb:sync', JSON.stringify(state.sync));
    if (state.tomb) localStorage.setItem('vb:tomb', JSON.stringify(state.tomb));
    if (state.deletions) localStorage.setItem('vb:deletions', JSON.stringify(state.deletions));
    if (state.syncTs != null) localStorage.setItem('vb:syncTs', String(state.syncTs));
  }, { players, games, events, settings, sync, tomb, deletions, syncTs });
}

async function stubWorker(page, rooms, options = {}) {
  await page.route(WORKER_ROUTE, async route => {
    if (options.isOnline && !options.isOnline()) {
      await route.abort('failed');
      return;
    }
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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vb:deletions')))).toEqual({ games: { gone: 20, carried: 9 }, players: {} });
  await expect.poll(() => rooms.get(code).ts).toBeGreaterThan(50);

  const current = rooms.get(code);
  const stale = JSON.parse(current.data);
  stale.games.push(game('gone', 99, { label: 'stale resurrection' }));
  stale.tomb = { ...stale.tomb, gone: 10 };
  stale.deletions.games.gone = 10;
  rooms.set(code, { ts: current.ts + 1, data: JSON.stringify(stale) });
  await page.evaluate(() => Sync.pull({ force: true }));

  expect(await page.evaluate(() => games.map(g => g.id).sort())).toEqual(['local', 'remote']);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('vb:deletions')))).games.gone).toBe(20);
});

test('deletion helpers normalize legacy and modern state without mixing record types', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const legacy = normalizeDeletionState({ tomb: { same: 10, gameOnly: 12 } });
    const modern = normalizeDeletionState({ deletions: { games: { same: 15 }, players: { same: 20, playerOnly: 18 } } });
    const merged = mergeDeletionStates(legacy, modern);
    return {
      legacy,
      modern,
      merged,
      gameDeleted: recordIsTombstoned('games', 'same', merged),
      playerDeleted: recordIsTombstoned('players', 'same', merged),
      filteredGames: filterTombstoned([{ id: 'same' }, { id: 'playerOnly' }], 'games', merged).map(x => x.id),
      filteredPlayers: filterTombstoned([{ id: 'same' }, { id: 'gameOnly' }], 'players', merged).map(x => x.id),
      union: unionById([{ id: 'a', value: 'local' }, { id: 'shared', value: 'local' }], [{ id: 'b', value: 'remote' }, { id: 'shared', value: 'remote' }], true)
    };
  });
  expect(result).toMatchObject({
    legacy: { games: { same: 10, gameOnly: 12 }, players: {} },
    modern: { games: { same: 15 }, players: { same: 20, playerOnly: 18 } },
    merged: { games: { same: 15, gameOnly: 12 }, players: { same: 20, playerOnly: 18 } },
    gameDeleted: true,
    playerDeleted: true,
    filteredGames: ['playerOnly'],
    filteredPlayers: ['gameOnly']
  });
  expect(result.union).toEqual([{ id: 'a', value: 'local' }, { id: 'shared', value: 'remote' }, { id: 'b', value: 'remote' }]);
});

test('legacy vb:tomb migrates to game deletions only even when a player shares the id', async ({ page }) => {
  await seedDevice(page, {
    players: [player('same-id', 'Same ID Player')],
    games: [game('same-id', 1)],
    tomb: { 'same-id': 123 }
  });
  await page.goto('/');
  expect(await page.evaluate(() => ({ players: players.map(p => p.id), games: games.map(g => g.id), deletions: JSON.parse(localStorage.getItem('vb:deletions')) }))).toEqual({
    players: ['same-id'],
    games: [],
    deletions: { games: { 'same-id': 123 }, players: {} }
  });
});

test('unreferenced player deletion persists a player tombstone', async ({ page }) => {
  await seedDevice(page, { players: [player('delete-me', 'Delete Me'), player('keep-me', 'Keep Me')] });
  await page.goto('/');
  await page.evaluate(async () => {
    editId = 'delete-me';
    window.askConfirm = async () => true;
    await deletePlayer();
  });
  const state = await page.evaluate(() => ({
    players: players.map(p => p.id),
    storedPlayers: JSON.parse(localStorage.getItem('vb:players')).map(p => p.id),
    deletions: JSON.parse(localStorage.getItem('vb:deletions'))
  }));
  expect(state.players).toEqual(['keep-me']);
  expect(state.storedPlayers).toEqual(['keep-me']);
  expect(state.deletions.players['delete-me']).toBeGreaterThan(0);
  expect(state.deletions.games).toEqual({});
});

test('game-log-only and event-only historical players archive without player tombstones', async ({ page }) => {
  await seedDevice(page, {
    players: [player('log-only', 'Log Only'), player('event-only', 'Event Only')],
    games: [game('historical-log', 1, { teamA: [], teamB: [], log: { 'log-only': { dig: 1 } } })],
    events: [{ id: 'historical-event', name: 'Historical Event', teams: [{ id: 'team', name: 'Team', players: ['event-only'] }], brackets: [] }]
  });
  await page.goto('/');
  await page.evaluate(async () => {
    window.askConfirm = async () => true;
    editId = 'log-only'; await deletePlayer();
    editId = 'event-only'; await deletePlayer();
  });
  const state = await page.evaluate(() => ({ players: players.map(p => ({ id: p.id, active: p.active, archived: p.archived })), deletions: JSON.parse(localStorage.getItem('vb:deletions')) }));
  expect(state.players).toEqual([
    { id: 'log-only', active: false, archived: true },
    { id: 'event-only', active: false, archived: true }
  ]);
  expect(state.deletions.players).toEqual({});
});

test('replace mode applies player and game tombstones before local persistence', async ({ page }) => {
  const code = 'replace-deletions';
  const rooms = new Map([[code, { ts: 50, data: JSON.stringify(syncPayload({
    players: [player('keep-player', 'Keep'), player('dead-player', 'Dead')],
    games: [game('keep-game', 1), game('dead-game', 2)],
    deletions: { games: { 'dead-game': 20 }, players: { 'dead-player': 30 } }
  })) }]]);
  await stubWorker(page, rooms);
  await page.goto('/');
  expect(await page.evaluate(() => Sync.connect('', 'replace-deletions'))).toBe('has-data');
  await page.evaluate(() => Sync.adopt('replace'));
  expect(await page.evaluate(() => ({ players: players.map(p => p.id), games: games.map(g => g.id), deletions: JSON.parse(localStorage.getItem('vb:deletions')) }))).toEqual({
    players: ['keep-player'],
    games: ['keep-game'],
    deletions: { games: { 'dead-game': 20 }, players: { 'dead-player': 30 } }
  });
});

test('a stale pull cannot restore a deleted player and the second device cannot push it back', async ({ browser }) => {
  const rooms = new Map();
  const contextA = await browser.newContext(), contextB = await browser.newContext();
  const pageA = await contextA.newPage(), pageB = await contextB.newPage();
  try {
    const roster = [player('gone-player', 'Gone Player'), player('keep-player', 'Keep Player')];
    await seedDevice(pageA, { players: roster });
    await seedDevice(pageB, { players: roster });
    await stubWorker(pageA, rooms); await stubWorker(pageB, rooms);
    await pageA.goto(BASE_URL);
    expect(await pageA.evaluate(() => Sync.connect('', 'player-delete-room'))).toBe('seeded');
    await pageB.goto(BASE_URL);
    expect(await pageB.evaluate(() => Sync.connect('', 'player-delete-room'))).toBe('has-data');
    await pageB.evaluate(() => Sync.adopt('replace'));

    await pageA.evaluate(async () => {
      editId = 'gone-player'; window.askConfirm = async () => true; await deletePlayer();
      await Sync.pull({ force: true });
    });
    expect(await pageA.evaluate(() => players.some(p => p.id === 'gone-player'))).toBe(false);
    await pageA.evaluate(() => Sync.push({ force: true }));

    await pageB.evaluate(() => Sync.pull({ force: true }));
    expect(await pageB.evaluate(() => players.some(p => p.id === 'gone-player'))).toBe(false);
    await pageB.evaluate(async stale => {
      players.push(stale);
      await Sync.push({ force: true });
    }, player('gone-player', 'Stale Copy'));
    expect(await pageB.evaluate(() => players.some(p => p.id === 'gone-player'))).toBe(false);
    const remote = JSON.parse(rooms.get('player-delete-room').data);
    expect(remote.players.some(p => p.id === 'gone-player')).toBe(false);
    expect(remote.deletions.players['gone-player']).toBeGreaterThan(0);
  } finally {
    await contextA.close(); await contextB.close();
  }
});

test('player deletion made offline persists and uploads when connectivity returns', async ({ page }) => {
  const code = 'offline-player-delete', rooms = new Map(), online = { value: false };
  await seedDevice(page, { players: [player('offline-delete', 'Offline Delete')], sync: { url: WORKER_URL, code, on: true } });
  await stubWorker(page, rooms, { isOnline: () => online.value });
  await page.goto('/');
  await page.evaluate(async () => {
    editId = 'offline-delete'; window.askConfirm = async () => true; await deletePlayer();
  });
  await page.waitForTimeout(1700);
  expect(rooms.has(code)).toBe(false);
  expect(await page.evaluate(() => ({ present: players.some(p => p.id === 'offline-delete'), deletedAt: JSON.parse(localStorage.getItem('vb:deletions')).players['offline-delete'] }))).toEqual({ present: false, deletedAt: expect.any(Number) });

  online.value = true;
  await page.evaluate(() => Sync.push({ force: true }));
  const remote = JSON.parse(rooms.get(code).data);
  expect(remote.players.some(p => p.id === 'offline-delete')).toBe(false);
  expect(remote.deletions.players['offline-delete']).toBeGreaterThan(0);
});

test('player deletion timestamps merge by maximum value from both devices', async ({ page }) => {
  const code = 'max-player-delete';
  const rooms = new Map([[code, { ts: 50, data: JSON.stringify(syncPayload({
    players: [player('newer-remote', 'Stale Remote'), player('newer-local', 'Stale Remote Two')],
    deletions: { games: {}, players: { 'newer-remote': 300, 'newer-local': 300 } }
  })) }]]);
  await seedDevice(page, {
    sync: { url: WORKER_URL, code, on: true }, syncTs: 0,
    deletions: { games: {}, players: { 'newer-remote': 200, 'newer-local': 400 } }
  });
  await stubWorker(page, rooms);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vb:deletions')).players)).toEqual({ 'newer-remote': 300, 'newer-local': 400 });
  expect(await page.evaluate(() => players)).toEqual([]);
});

test('imported backups cannot resurrect a player tombstoned on this device', async ({ page }) => {
  await seedDevice(page, { deletions: { games: {}, players: { dead: 500 } } });
  await page.goto('/');
  await page.evaluate(async backup => {
    tab = 'more'; render(); openImport(); $('#impTxt').value = JSON.stringify(backup); await doImport();
  }, { players: [player('dead', 'Old Backup Player'), player('live', 'Live Player')], games: [], settings: {}, events: [], v: 1 });
  expect(await page.evaluate(() => players.map(p => p.id))).toEqual(['live']);
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
  expect(Object.keys(sent).sort()).toEqual(['deletions', 'events', 'games', 'players', 'settings', 'tomb', 'v']);
  expect(JSON.stringify(sent)).not.toContain('vb:sync');
  expect(sent).not.toHaveProperty('sync');
  expect(sent).not.toHaveProperty('syncTs');
  expect(sent.deletions).toEqual({ games: { deleted: 123 }, players: {} });
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
    expect(remote.deletions.games['cross-device-game']).toBeGreaterThan(0);
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
