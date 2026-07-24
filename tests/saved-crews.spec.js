import { test, expect } from '@playwright/test';

function player(id, name, extra = {}) {
  return {
    id, name, seedRating: 48, rating: 48, active: true, archived: false,
    pickupEligible: true, aliases: [], roles: {}, lifetime: {}, history: [{ i: 0, r: 48 }],
    ...extra
  };
}

function crew(id, name, playerIds, extra = {}) {
  return { id, name, playerIds, createdAt: 100, updatedAt: 200, lastUsedAt: null, ...extra };
}

async function seed(page, { players = [], crews = [], games = [], events = [], sessions = [], settings = {} } = {}) {
  await page.addInitScript(data => {
    localStorage.setItem('vb:players', JSON.stringify(data.players));
    localStorage.setItem('vb:games', JSON.stringify(data.games));
    localStorage.setItem('vb:events', JSON.stringify(data.events));
    localStorage.setItem('vb:attendanceSessions', JSON.stringify(data.sessions));
    localStorage.setItem('vb:savedCrews', JSON.stringify(data.crews));
    localStorage.setItem('vb:settings', JSON.stringify({ numTeams: 2, attendanceScope: 'all', ...data.settings }));
  }, { players, crews, games, events, sessions, settings });
}

async function openTeams(page) {
  await page.goto('/');
  await page.locator('[data-tab="teams"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Make even teams', exact: true })).toBeVisible();
}

test('saved-crew schema is legacy-safe, malformed-safe, deterministic, idempotent, and history-neutral', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const roster = [{ id: 'a', name: 'Alpha' }];
    const history = {
      players: structuredClone(roster),
      games: [{ id: 'g', teamA: ['a'], teamB: ['b'] }],
      events: [{ id: 'e', name: 'Event' }],
      sessions: [{ id: 's', date: '2026-07-01', playerIds: ['a'] }]
    };
    const before = JSON.stringify(history);
    const valid = {
      id: 'crew-1', name: '  Tuesday   Regulars  ', playerIds: ['a', 'a', 'missing', null, ' '],
      createdAt: 10, updatedAt: 20, lastUsedAt: 30
    };
    const normalized = normalizeSavedCrews([null, [], { name: '   ' }, { name: 4 }, valid]);
    const again = normalizeSavedCrews(normalized);
    const withoutIdA = normalizeSavedCrew({ name: 'Stable', playerIds: ['a'], createdAt: 5 });
    const withoutIdB = normalizeSavedCrew({ name: 'Stable', playerIds: ['a'], createdAt: 5 });
    return {
      legacy: normalizeSavedCrews(undefined),
      normalized, again,
      deterministicId: withoutIdA.id === withoutIdB.id,
      invalidLastUsed: normalizeSavedCrew({ id: 'x', name: 'X', playerIds: [], createdAt: 1, lastUsedAt: 'bad' }).lastUsedAt,
      historyUnchanged: before === JSON.stringify(history)
    };
  });

  expect(result.legacy).toEqual([]);
  expect(result.normalized).toEqual([{
    id: 'crew-1', name: 'Tuesday Regulars', playerIds: ['a', 'missing'],
    createdAt: 10, updatedAt: 20, lastUsedAt: 30
  }]);
  expect(result.again).toEqual(result.normalized);
  expect(result.deterministicId).toBe(true);
  expect(result.invalidLastUsed).toBeNull();
  expect(result.historyUnchanged).toBe(true);
});

test('crew resolution and Add/Replace classify availability and preserve unrelated state', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const roster = [
      { id: 'a', name: 'Same', active: true, pickupEligible: true },
      { id: 'b', name: 'Same', active: true, pickupEligible: true },
      { id: 'inactive', name: 'Inactive', active: false, pickupEligible: true },
      { id: 'guest', name: 'Guest', active: true, pickupEligible: false }
    ];
    const saved = { id: 'c', name: 'Crew', playerIds: ['a', 'b', 'inactive', 'guest', 'missing'], createdAt: 1, updatedAt: 1 };
    const history = { games: [{ id: 'g' }], events: [{ id: 'e' }], sessions: [{ id: 's' }], ratings: roster.map(p => p.rating) };
    const before = JSON.stringify(history);
    const resolution = resolveCrewMembers(saved, roster);
    const add = savedCrewApplication(saved, ['a'], { playerList: roster, mode: 'add' });
    const replace = savedCrewApplication(saved, ['a', 'outside'], { playerList: roster, mode: 'replace' });
    const labels = [...buildUniquePlayerDisplayLabels(roster).values()];
    return {
      resolution: Object.fromEntries(Object.entries(resolution).map(([key, rows]) => [key, rows.map(row => row.id)])),
      add: { ...add, resolution: undefined },
      replace: { ...replace, resolution: undefined },
      labels,
      historyUnchanged: before === JSON.stringify(history)
    };
  });

  expect(result.resolution).toEqual({
    available: ['a', 'b'], inactive: ['inactive'], pickupIneligible: ['guest'], missing: ['missing']
  });
  expect(result.add).toMatchObject({
    selectionIds: ['a', 'b'], appliedIds: ['a', 'b'], addedCount: 1, alreadySelectedCount: 1,
    unavailableCount: 3, inactiveCount: 1, pickupIneligibleCount: 1, missingCount: 1
  });
  expect(result.replace.selectionIds).toEqual(['a', 'b']);
  expect(new Set(result.labels).size).toBe(result.labels.length);
  expect(result.historyUnchanged).toBe(true);
});

test('crew creation validates names and IDs, blocks case-insensitive duplicates, and preserves attendance', async ({ page }) => {
  const roster = [player('a', 'Alpha'), player('b', 'Bravo')];
  await seed(page, { players: roster });
  await openTeams(page);
  const result = await page.evaluate(async () => {
    window._pool = new Set(['a', 'b']);
    const selectedBefore = [...window._pool];
    const emptyName = await saveSavedCrew({ name: '   ', playerIds: ['a'] });
    const emptyMembers = await saveSavedCrew({ name: 'Empty', playerIds: [] });
    const created = await saveSavedCrew({ name: '  Tuesday Regulars  ', playerIds: ['a', 'a', 'b'], now: 1000 });
    const duplicate = await saveSavedCrew({ name: 'tuesday regulars', playerIds: ['b'], now: 2000 });
    const updated = await saveSavedCrew({ id: created.crew.id, name: 'Tuesday Crew', playerIds: ['b'], now: 3000 });
    return {
      emptyName: emptyName.status, emptyMembers: emptyMembers.status,
      created, duplicate: { status: duplicate.status, id: duplicate.existingCrew?.id }, updated,
      crews: savedCrews, stored: JSON.parse(localStorage.getItem('vb:savedCrews')),
      selectedBefore, selectedAfter: [...window._pool], sessions: attendanceSessions
    };
  });

  expect(result.emptyName).toBe('invalid-name');
  expect(result.emptyMembers).toBe('empty');
  expect(result.duplicate).toEqual({ status: 'duplicate', id: result.created.crew.id });
  expect(result.updated.crew).toMatchObject({
    id: result.created.crew.id, name: 'Tuesday Crew', playerIds: ['b'], createdAt: 1000, updatedAt: 3000
  });
  expect(result.crews).toEqual(result.stored);
  expect(result.crews[0]).not.toHaveProperty('players');
  expect(result.selectedAfter).toEqual(result.selectedBefore);
  expect(result.sessions).toEqual([]);
});

test('attendance UI creates exactly one crew from current selection and Cancel is inert', async ({ page }) => {
  await seed(page, { players: [player('a', 'Alpha', { rating: 88 }), player('b', 'Bravo', { rating: 22 })] });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(['a', 'b']); renderTeams(); });

  await page.getByRole('button', { name: 'Save crew', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Save current selection' })).toBeVisible();
  await expect(page.locator('.crew-editor-preview')).toContainText('Alpha');
  await expect(page.locator('.crew-editor-preview')).not.toContainText('88');
  await page.getByLabel('Crew name').fill('Canceled');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => savedCrews)).toEqual([]);

  await page.getByRole('button', { name: 'Save crew', exact: true }).click();
  await page.getByLabel('Crew name').fill('Tuesday & Friends 🏐');
  await page.evaluate(() => Promise.all([saveCrewEditor(), saveCrewEditor()]));
  await expect(page.getByRole('button', { name: /Add Tuesday & Friends 🏐/ })).toBeVisible();
  expect(await page.evaluate(() => ({
    crews: savedCrews, selected: [...window._pool], sessions: attendanceSessions
  }))).toMatchObject({
    crews: [{ name: 'Tuesday & Friends 🏐', playerIds: ['a', 'b'] }],
    selected: ['a', 'b'], sessions: []
  });
});

test('primary crew action Adds, explicit Replace is atomic, and unavailable warnings are accessible', async ({ page }) => {
  const saved = crew('regulars', 'Tuesday Regulars', ['a', 'b', 'inactive', 'guest', 'missing']);
  await seed(page, {
    players: [
      player('a', 'Alpha'), player('b', 'Bravo'), player('c', 'Charlie'),
      player('inactive', 'Inactive', { active: false }), player('guest', 'Guest', { pickupEligible: false })
    ],
    crews: [saved]
  });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(['a', 'c']); renderTeams(); });

  const add = page.getByRole('button', { name: /Add Tuesday Regulars, 2 available · ⚠ 3 unavailable players/ });
  await expect(add).toBeVisible();
  await add.click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['a', 'c', 'b']);
  await expect(page.locator('#toast')).toContainText('Added 1 player. 1 already selected. 3 unavailable.');
  expect(await page.evaluate(() => ({
    lastUsedAt: savedCrews[0].lastUsedAt,
    sessions: attendanceSessions
  }))).toMatchObject({ lastUsedAt: expect.any(Number), sessions: [] });

  await page.getByRole('button', { name: 'More actions for Tuesday Regulars' }).click();
  await page.getByRole('button', { name: 'Replace attendance with Tuesday Regulars' }).click();
  await page.getByRole('button', { name: 'Replace selection', exact: true }).click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['a', 'b']);
  await expect(page.locator('#toast')).toContainText('Loaded 2 players. 3 are unavailable.');

  const noOp = await page.evaluate(() => applySavedCrewById('regulars', 'replace'));
  expect(noOp.selectionIds).toEqual(['a', 'b']);
  expect(await page.evaluate(() => attendanceSessions)).toEqual([]);
});

test('crew editing supports alias search, retained unavailable members, rename, and attendance isolation', async ({ page }) => {
  await seed(page, {
    players: [
      player('a', 'Alpha'), player('b', 'Bravo', { aliases: ['Bee'] }),
      player('inactive', 'Inactive', { active: false })
    ],
    crews: [crew('edit-me', 'Old Name', ['a', 'inactive'])]
  });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(['a']); renderTeams(); });
  await page.getByRole('button', { name: 'More actions for Old Name' }).click();
  await page.getByRole('button', { name: 'Edit name and members' }).click();

  await expect(page.getByText('Unavailable members', { exact: true })).toBeVisible();
  await expect(page.getByText('⚠ Inactive', { exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search crew members' });
  await search.fill('Bee');
  await page.getByRole('button', { name: 'Add Bravo to crew' }).click();
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: 'Remove Inactive from crew' }).click();
  await page.getByLabel('Crew name').fill('Renamed Crew');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const result = await page.evaluate(() => ({
    crew: savedCrews[0], selected: [...window._pool], sessions: attendanceSessions
  }));
  expect(result.crew).toMatchObject({
    id: 'edit-me', name: 'Renamed Crew', playerIds: ['a', 'b'], createdAt: 100
  });
  expect(result.crew.updatedAt).toBeGreaterThan(200);
  expect(result.selected).toEqual(['a']);
  expect(result.sessions).toEqual([]);
});

test('crew deletion is confirmed, tombstoned, persistent, and does not touch players or attendance history', async ({ page }) => {
  const sessions = [{ id: 's', date: '2026-07-18', playerIds: ['a'], createdAt: 1, updatedAt: 1 }];
  await seed(page, {
    players: [player('a', 'Alpha')],
    crews: [crew('delete-me', 'Delete Me', ['a'])],
    sessions
  });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(['a']); renderTeams(); });
  const before = await page.evaluate(() => JSON.stringify({ players, attendanceSessions, selected: [...window._pool] }));

  await page.getByRole('button', { name: 'More actions for Delete Me' }).click();
  await page.getByRole('button', { name: 'Delete crew' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => savedCrews.length)).toBe(1);

  await page.getByRole('button', { name: 'Delete crew' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete crew', exact: true }).click();
  expect(await page.evaluate(() => ({
    crews: savedCrews,
    stored: JSON.parse(localStorage.getItem('vb:savedCrews')),
    deletedAt: JSON.parse(localStorage.getItem('vb:deletions')).savedCrews['delete-me'],
    unchanged: JSON.stringify({ players, attendanceSessions, selected: [...window._pool] })
  }))).toMatchObject({
    crews: [], stored: [], deletedAt: expect.any(Number), unchanged: before
  });

  await page.reload();
  expect(await page.evaluate(() => savedCrews)).toEqual([]);
});

test('backup, restore, and sync retain crews while older payloads that omit crews preserve explicit local data', async ({ page }) => {
  const saved = crew('sync-crew', 'Sync Crew', ['a'], { updatedAt: 500 });
  await seed(page, { players: [player('a', 'Alpha')], crews: [saved] });
  let posted;
  await page.route('https://sync.test/**', async route => {
    if (route.request().method() === 'POST') posted = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');

  const backup = await page.evaluate(async () => {
    window.__backupText = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__backupText = text; } } });
    const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = () => 'blob:test'; HTMLAnchorElement.prototype.click = () => {};
    await exportData();
    URL.createObjectURL = create; HTMLAnchorElement.prototype.click = click;
    return JSON.parse(window.__backupText);
  });
  expect(backup.savedCrews).toEqual([saved]);

  const result = await page.evaluate(async data => {
    const oldBackup = { players: data.players, games: [], events: [], attendanceSessions: [], settings: {} };
    await restoreBackupData(oldBackup);
    const afterOld = structuredClone(savedCrews);
    await restoreBackupData(data);
    Sync.cfg.url = 'https://sync.test'; Sync.cfg.code = 'room'; Sync.cfg.on = true;
    await Sync.push({ force: true });
    return { afterOld, restored: savedCrews };
  }, backup);
  expect(result.afterOld).toEqual([saved]);
  expect(result.restored).toEqual([saved]);
  expect(JSON.parse(posted.data).savedCrews).toEqual([saved]);
});

test('crew merge is updatedAt last-write-wins and tombstones defeat stale records', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const local = [{ id: 'same', name: 'Local', playerIds: ['a'], createdAt: 1, updatedAt: 20 }];
    const older = [{ id: 'same', name: 'Older', playerIds: ['b'], createdAt: 1, updatedAt: 10 }];
    const newer = [{ id: 'same', name: 'Newer', playerIds: ['c'], createdAt: 1, updatedAt: 30 }];
    const state = normalizeDeletionState({ deletions: { savedCrews: { gone: 50 } } });
    return {
      older: mergeSavedCrewsById(local, older, true),
      newer: mergeSavedCrewsById(local, newer, true),
      filtered: filterPersistedRecords({
        players: [], games: [], events: [],
        savedCrews: [{ id: 'gone', name: 'Gone', playerIds: ['a'], createdAt: 1, updatedAt: 1 }]
      }, state).savedCrews,
      deletionState: state.savedCrews
    };
  });
  expect(result.older[0].name).toBe('Local');
  expect(result.newer[0].name).toBe('Newer');
  expect(result.filtered).toEqual([]);
  expect(result.deletionState).toEqual({ gone: 50 });
});

test('mobile crews remain compact with many crews and a 40-member group', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const roster = Array.from({ length: 50 }, (_, index) => player(`p${index}`, `Player ${String(index + 1).padStart(2, '0')}`));
  const crews = Array.from({ length: 20 }, (_, index) => crew(`c${index}`, `Crew ${String(index + 1).padStart(2, '0')}`, roster.slice(0, index ? 5 : 40).map(p => p.id), {
    updatedAt: 1000 + index
  }));
  await seed(page, { players: roster, crews });
  await openTeams(page);

  await expect(page.locator('.attendance-crew-item')).toHaveCount(6);
  await page.getByRole('button', { name: 'Show all 20' }).click();
  await expect(page.locator('.attendance-crew-item')).toHaveCount(20);
  const geometry = await page.evaluate(() => {
    const strip = document.querySelector('.attendance-crew-strip').getBoundingClientRect();
    const footer = document.querySelector('[data-attendance-actions]').getBoundingClientRect();
    return {
      stripRight: strip.right, viewportWidth: innerWidth,
      footerBottom: footer.bottom, viewportHeight: innerHeight,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(geometry.stripRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole('button', { name: /Add Crew 01, 40 available players/ })).toBeVisible();
});
