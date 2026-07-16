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

function deletionRegistry(overrides = {}) {
  return { games: {}, players: {}, events: {}, eventTeams: {}, eventEntries: {}, eventBrackets: {}, eventScheduleMatches: {}, ...overrides };
}

function fixedEvent(id, extra = {}) {
  return { id, name: `Event ${id}`, eventDate: '2026-07-16', created: 1, done: false, format: 'fixedTeams', teams: [], brackets: [], ...extra };
}

function rotatingEvent(id, extra = {}) {
  return fixedEvent(id, { format: 'rotatingGroups', entries: [], rotation: { entrySize: 1, teamSize: 2, rounds: 1, courts: 1 }, rotationSchedule: [], ...extra });
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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vb:deletions')))).toEqual(deletionRegistry({ games: { gone: 20, carried: 9 } }));
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

test('generalized deletion filtering is malformed-safe, idempotent, and order independent', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const malformed = normalizeDeletionState({ deletions: {
      games: { valid: '12', zero: 0, negative: -1, infinite: 'Infinity', bool: true, object: { value: 3 } },
      players: [], events: 'bad', eventTeams: { team: 20 }, eventEntries: { entry: 30 }, eventBrackets: { bracket: 40 }
    } });
    const deletions = normalizeDeletionState({ deletions: {
      games: { 'game-old': 10 }, players: { 'player-old': 11 }, events: { 'event-old': 12 },
      eventTeams: { 'team-old': 13 }, eventEntries: { 'entry-old': 14 }, eventBrackets: { 'bracket-old': 15 }
    } });
    const clean = {
      players: [{ id: 'player-new' }], games: [{ id: 'game-new' }],
      events: [{ id: 'event-live', teams: [{ id: 'team-new' }], entries: [{ id: 'entry-new' }], brackets: [{ id: 'bracket-new' }] }]
    };
    const stale = {
      players: [{ id: 'player-old' }, { id: 'player-new' }], games: [{ id: 'game-old' }, { id: 'game-new' }],
      events: [
        { id: 'event-old', teams: [], entries: [], brackets: [] },
        { id: 'event-live', teams: [{ id: 'team-old' }, { id: 'team-new' }], entries: [{ id: 'entry-old' }, { id: 'entry-new' }], brackets: [{ id: 'bracket-old' }, { id: 'bracket-new' }] }
      ]
    };
    const summarize = value => ({
      players: value.players.map(record => record.id), games: value.games.map(record => record.id), events: value.events.map(event => event.id),
      teams: value.events.find(event => event.id === 'event-live')?.teams.map(record => record.id),
      entries: value.events.find(event => event.id === 'event-live')?.entries.map(record => record.id),
      brackets: value.events.find(event => event.id === 'event-live')?.brackets.map(record => record.id)
    });
    const mergedOnce = mergeDeletionStates(deletions, deletions);
    return {
      malformed,
      idempotent: JSON.stringify(mergedOnce) === JSON.stringify(mergeDeletionStates(mergedOnce, deletions)),
      orders: [
        summarize(resolveDeletionProtectedRecords(clean, stale, deletions, 'merge')),
        summarize(resolveDeletionProtectedRecords(stale, clean, deletions, 'merge'))
      ]
    };
  });
  expect(result.malformed).toEqual(deletionRegistry({ games: { valid: 12 }, eventTeams: { team: 20 }, eventEntries: { entry: 30 }, eventBrackets: { bracket: 40 } }));
  expect(result.idempotent).toBe(true);
  expect(result.orders).toEqual([0, 1].map(() => ({
    players: ['player-new'], games: ['game-new'], events: ['event-live'],
    teams: ['team-new'], entries: ['entry-new'], brackets: ['bracket-new']
  })));
});

test('event deletion keeps historical rating impact and defeats stale pushes in either order', async ({ page }) => {
  const code = 'event-delete-race', rooms = new Map();
  const roster = [player('a', 'A', 60), player('b', 'B', 40)];
  const event = fixedEvent('event-delete', { teams: [{ id: 'ta', name: 'A', players: ['a'] }, { id: 'tb', name: 'B', players: ['b'] }] });
  const historicalGame = game('event-game', 100, {
    teamA: ['a'], teamB: ['b'], evId: event.id, evA: 'ta', evB: 'tb', label: 'Final', matchId: 'match-1', eventFormat: 'fixedTeams'
  });
  await seedDevice(page, { players: roster, games: [historicalGame], events: [event], sync: { url: WORKER_URL, code, on: true } });
  await stubWorker(page, rooms);
  await page.goto('/');
  await expect.poll(() => rooms.get(code)?.data || null).not.toBeNull();

  const state = await page.evaluate(async () => {
    recomputeAll();
    const before = Object.fromEntries(players.map(p => [p.id, p.rating]));
    window.askConfirm = async () => true;
    await deleteEvent('event-delete');
    recomputeAll();
    return {
      before, after: Object.fromEntries(players.map(p => [p.id, p.rating])),
      eventIds: evts.map(e => e.id), game: games.find(g => g.id === 'event-game'),
      deletions: Sync.deletionState(), selected: window._evOpen
    };
  });
  expect(state.after).toEqual(state.before);
  expect(state.eventIds).toEqual([]);
  expect(state.game).toMatchObject({ id: 'event-game', teamA: ['a'], teamB: ['b'], winner: 'A' });
  for (const key of ['evId', 'evA', 'evB', 'label', 'matchId', 'eventFormat']) expect(state.game).not.toHaveProperty(key);
  expect(state.deletions.events['event-delete']).toBeGreaterThan(0);
  expect(state.selected).toBeNull();

  // Stale data reaches the room before the deleting device pushes.
  rooms.set(code, { ts: rooms.get(code).ts + 1, data: JSON.stringify(syncPayload({ players: roster, games: [historicalGame], events: [event] })) });
  await page.evaluate(() => Sync.push({ force: true }));
  let remote = JSON.parse(rooms.get(code).data);
  expect(remote.events).toEqual([]);
  expect(remote.games).toHaveLength(1);
  expect(remote.games[0]).not.toHaveProperty('evId');
  expect(remote.deletions.events['event-delete']).toBeGreaterThan(0);

  // A later stale push is pulled and resolved back to the deletion state.
  rooms.set(code, { ts: rooms.get(code).ts + 1, data: JSON.stringify(syncPayload({ players: roster, games: [historicalGame], events: [event] })) });
  await page.evaluate(() => Sync.pull({ force: true }));
  expect(await page.evaluate(() => ({ events: evts.map(e => e.id), linked: games.some(g => g.evId === 'event-delete') }))).toEqual({ events: [], linked: false });
  remote = JSON.parse(rooms.get(code).data);
  expect(remote.events).toEqual([]);
  expect(remote.deletions.events['event-delete']).toBeGreaterThan(0);
});

test('remote event deletion removes the local event but preserves and detaches its game', async ({ page }) => {
  const code = 'remote-event-delete';
  const event = fixedEvent('remote-dead', { teams: [{ id: 'one', name: 'One', players: ['a'] }, { id: 'two', name: 'Two', players: ['b'] }] });
  const linkedGame = game('kept-history', 10, { teamA: ['a'], teamB: ['b'], evId: event.id, evA: 'one', evB: 'two' });
  const rooms = new Map([[code, { ts: 50, data: JSON.stringify(syncPayload({
    players: [player('a', 'A'), player('b', 'B')], games: [linkedGame], events: [event],
    deletions: deletionRegistry({ events: { 'remote-dead': 500 } })
  })) }]]);
  await seedDevice(page, {
    players: [player('a', 'A'), player('b', 'B')], games: [linkedGame], events: [event],
    sync: { url: WORKER_URL, code, on: true }, syncTs: 0
  });
  await stubWorker(page, rooms);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => evts.length)).toBe(0);
  expect(await page.evaluate(() => ({ games: games.map(g => g.id), linked: games.some(g => g.evId), gamesPlayed: players.map(p => p.gamesPlayed) }))).toEqual({
    games: ['kept-history'], linked: false, gamesPlayed: [1, 1]
  });
});

test('nested delete actions create markers, flag retained schedules, and retain linked protections', async ({ page }) => {
  const fixed = fixedEvent('fixed-nested', {
    teams: [{ id: 'team-free', name: 'Free', players: [] }, { id: 'team-linked', name: 'Linked', players: [] }],
    brackets: [{ id: 'bracket-free', name: 'Playoffs', created: 2, seeds: ['team-free', 'team-linked'] }]
  });
  const rotating = rotatingEvent('rotating-nested', {
    entries: [{ id: 'entry-free', name: 'Free', players: [] }, { id: 'entry-linked', name: 'Linked', players: [] }, { id: 'entry-other', name: 'Other', players: [] }],
    rotationSchedule: [{ id: 'round-1', round: 1, court: 1, sideAEntryIds: ['entry-free'], sideBEntryIds: ['entry-other'] }]
  });
  await seedDevice(page, {
    events: [fixed, rotating],
    games: [
      game('fixed-linked', 1, { evId: fixed.id, evA: 'team-linked', evB: 'opponent' }),
      game('rotation-linked', 2, { evId: rotating.id, evMatchId: 'played', evEntryIdsA: ['entry-linked'], evEntryIdsB: ['entry-other'], eventFormat: 'rotatingGroups' })
    ]
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    window.askConfirm = async () => true;
    window._evTeamDraft = { evId: 'fixed-nested', tid: 'team-free' }; await deleteEventTeam();
    window._evTeamDraft = { evId: 'fixed-nested', tid: 'team-linked' }; await deleteEventTeam();
    window._entryDraft = { evId: 'rotating-nested', entryId: 'entry-free' }; await deleteEntry();
    window._entryDraft = { evId: 'rotating-nested', entryId: 'entry-linked' }; await deleteEntry();
    await resetBracket('fixed-nested', 'bracket-free');
    const fixed = evById('fixed-nested'), rotating = evById('rotating-nested');
    return {
      teams: fixed.teams.map(t => t.id), entries: rotating.entries.map(e => e.id), brackets: fixed.brackets.map(b => b.id),
      schedule: rotating.rotationSchedule, scheduleNeedsReview: rotating.rotation.scheduleNeedsReview, deletions: Sync.deletionState()
    };
  });
  expect(result.teams).toEqual(['team-linked']);
  expect(result.entries).toEqual(['entry-linked', 'entry-other']);
  expect(result.brackets).toEqual([]);
  expect(result.schedule).toHaveLength(1);
  expect(result.schedule[0]).toMatchObject({ id: 'round-1', scheduleBlock: 'standard' });
  expect(result.scheduleNeedsReview).toBe(true);
  expect(result.deletions.eventTeams['team-free']).toBeGreaterThan(0);
  expect(result.deletions.eventTeams).not.toHaveProperty('team-linked');
  expect(result.deletions.eventEntries['entry-free']).toBeGreaterThan(0);
  expect(result.deletions.eventEntries).not.toHaveProperty('entry-linked');
  expect(result.deletions.eventBrackets['bracket-free']).toBeGreaterThan(0);
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
    deletions: deletionRegistry({ games: { 'same-id': 123 } })
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
    deletions: deletionRegistry({ games: { 'dead-game': 20 }, players: { 'dead-player': 30 } })
  })) }]]);
  await stubWorker(page, rooms);
  await page.goto('/');
  expect(await page.evaluate(() => Sync.connect('', 'replace-deletions'))).toBe('has-data');
  await page.evaluate(() => Sync.adopt('replace'));
  expect(await page.evaluate(() => ({ players: players.map(p => p.id), games: games.map(g => g.id), deletions: JSON.parse(localStorage.getItem('vb:deletions')) }))).toEqual({
    players: ['keep-player'],
    games: ['keep-game'],
    deletions: deletionRegistry({ games: { 'dead-game': 20 }, players: { 'dead-player': 30 } })
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

test('old backups load, backup deletion metadata is honored, and exports include the registry', async ({ page }) => {
  await seedDevice(page, { players: [player('current', 'Current')], games: [game('current-game', 1)], events: [fixedEvent('current-event')] });
  await page.goto('/');
  const state = await page.evaluate(async oldBackup => {
    tab = 'more';render();openImport();$('#impTxt').value=JSON.stringify(oldBackup);await doImport();
    await Sync.markDeleted('events', 'backup-dead', 700);
    window.__backupText = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__backupText = text; } } });
    const originalCreate=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=()=> 'blob:test';HTMLAnchorElement.prototype.click=()=>{};
    await exportData();
    URL.createObjectURL=originalCreate;HTMLAnchorElement.prototype.click=originalClick;
    return {
      players: players.map(p => p.id), games: games.map(g => g.id), events: evts.map(e => e.id),
      exported: JSON.parse(window.__backupText), deletions: Sync.deletionState()
    };
  }, { players: [player('old-live', 'Old Live')], games: [], settings: {}, events: [], v: 1 });
  expect(state.players).toEqual(['old-live']);
  expect(state.games).toEqual([]);
  expect(state.events).toEqual([]);
  expect(state.deletions.players.current).toBeGreaterThan(0);
  expect(state.deletions.games['current-game']).toBeGreaterThan(0);
  expect(state.deletions.events['current-event']).toBeGreaterThan(0);
  expect(state.exported.v).toBe(3);
  expect(state.exported.deletions).toEqual(state.deletions);
  expect(state.exported.tomb).toEqual(state.deletions.games);
});

test('reset marks every named entity and stale records cannot repopulate it', async ({ page }) => {
  await seedDevice(page, {
    players: [player('reset-player', 'Reset Player')], games: [game('reset-game', 1)], events: [fixedEvent('reset-event')],
    settings: { hideRatings: true, eloK: 8 }
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    window.askConfirm = async () => true;
    await resetAll();
    const afterReset = { players: players.length, games: games.length, events: evts.length, settings: { hideRatings: settings.hideRatings, eloK: settings.eloK } };
    players.push({ id: 'reset-player' });games.push({ id: 'reset-game' });evts.push({ id: 'reset-event', teams: [], brackets: [] });
    Sync.applyLocalDeletions();
    return { afterReset, afterStale: { players: players.length, games: games.length, events: evts.length }, deletions: Sync.deletionState() };
  });
  expect(result.afterReset).toEqual({ players: 0, games: 0, events: 0, settings: { hideRatings: false, eloK: 5 } });
  expect(result.afterStale).toEqual({ players: 0, games: 0, events: 0 });
  expect(result.deletions.players['reset-player']).toBeGreaterThan(0);
  expect(result.deletions.games['reset-game']).toBeGreaterThan(0);
  expect(result.deletions.events['reset-event']).toBeGreaterThan(0);
});

test('loading the demo marks only the players and games it replaces', async ({ page }) => {
  await seedDevice(page, { players: [player('real-player', 'Real Player')], games: [game('real-game', 1)], events: [fixedEvent('kept-event')] });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    window.askConfirm = async () => true;await loadDemo();
    return { playerIds:players.map(p=>p.id),gameIds:games.map(g=>g.id),eventIds:evts.map(e=>e.id),deletions:Sync.deletionState() };
  });
  expect(result.playerIds).not.toContain('real-player');
  expect(result.gameIds).not.toContain('real-game');
  expect(result.eventIds).toEqual(['kept-event']);
  expect(result.deletions.players['real-player']).toBeGreaterThan(0);
  expect(result.deletions.games['real-game']).toBeGreaterThan(0);
  expect(result.deletions.events).toEqual({});
});

test('archival and ordinary status changes do not create deletion markers', async ({ page }) => {
  const roster = [player('historical', 'Historical', 60), player('opponent', 'Opponent', 40), player('status', 'Status', 50)];
  const historicalGame = game('archive-history', 1, { teamA: ['historical'], teamB: ['opponent'] });
  await seedDevice(page, { players: roster, games: [historicalGame], events: [fixedEvent('status-event')] });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    recomputeAll();const before=Object.fromEntries(players.map(p=>[p.id,p.rating]));
    window.askConfirm=async()=>true;editId='historical';await deletePlayer();
    await toggleEventDone('status-event');
    openPlayer('status');toggleActive();await savePlayer();
    recomputeAll();
    return {
      before,after:Object.fromEntries(players.map(p=>[p.id,p.rating])),
      historical:{archived:pById('historical').archived,active:pById('historical').active},statusActive:pById('status').active,
      eventDone:evById('status-event').done,deletions:Sync.deletionState(),gameIds:games.map(g=>g.id)
    };
  });
  expect(result.after).toEqual(result.before);
  expect(result.historical).toEqual({ archived: true, active: false });
  expect(result.statusActive).toBe(false);
  expect(result.eventDone).toBe(true);
  expect(result.gameIds).toEqual(['archive-history']);
  expect(result.deletions).toEqual(deletionRegistry());
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
  expect(sent.deletions).toEqual(deletionRegistry({ games: { deleted: 123 } }));
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
