import { test, expect } from '@playwright/test';

const DAY = 24 * 60 * 60 * 1000;

function player(id, name, extra = {}) {
  return {
    id, name, seedRating: 48, rating: 48, active: true, archived: false,
    pickupEligible: true, aliases: [], roles: {}, lifetime: {}, history: [{ i: 0, r: 48 }],
    ...extra
  };
}

async function seed(page, { players = [], games = [], events = [], sessions, settings = {} } = {}) {
  await page.addInitScript(data => {
    localStorage.setItem('vb:players', JSON.stringify(data.players));
    localStorage.setItem('vb:games', JSON.stringify(data.games));
    localStorage.setItem('vb:events', JSON.stringify(data.events));
    localStorage.setItem('vb:settings', JSON.stringify({ numTeams: 2, ...data.settings }));
    if (data.sessions !== undefined) localStorage.setItem('vb:attendanceSessions', JSON.stringify(data.sessions));
  }, { players, games, events, sessions, settings });
}

async function openTeams(page) {
  await page.goto('/');
  await page.locator('[data-tab="teams"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Make even teams', exact: true })).toBeVisible();
}

test('attendance snapshots normalize legacy and malformed data without touching historical state', async ({ page }) => {
  const roster = [player('a', 'Alpha'), player('b', 'Bravo')];
  const savedGames = [{ id: 'g', date: 100, teamA: ['a'], teamB: ['b'], winner: 'A', scoreA: 25, scoreB: 20, log: {} }];
  await seed(page, { players: roster, games: savedGames });
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const historyBefore = JSON.stringify({ players, games, evts });
    const legacyBefore = attendanceSessions.slice();
    const malformed = normalizeAttendanceSessions([
      null,
      { id: 'bad-date', date: 'not-a-date', playerIds: ['a'] },
      { id: 'valid', date: '2026-07-18', playerIds: ['a', 'a', null, 'b'], createdAt: 10, updatedAt: 20, source: 'team-builder' }
    ]);
    attendanceSessions = [];
    const first = await saveAttendanceSnapshot(['a', 'a', 'b'], { date: '2026-07-24', now: 1000 });
    const second = await saveAttendanceSnapshot(['b'], { date: '2026-07-24', now: 2000 });
    return {
      legacyBefore,
      malformed,
      first,
      second,
      sessions: attendanceSessions,
      historyUnchanged: historyBefore === JSON.stringify({ players, games, evts })
    };
  });

  expect(result.malformed).toEqual([{
    id: 'valid', date: '2026-07-18', playerIds: ['a', 'b'],
    createdAt: 10, updatedAt: 20, source: 'team-builder'
  }]);
  expect(result.legacyBefore).toEqual([]);
  expect(result.sessions).toHaveLength(1);
  expect(result.sessions[0]).toMatchObject({
    id: result.first.id, date: '2026-07-24', playerIds: ['b'],
    createdAt: 1000, updatedAt: 2000, source: 'team-builder'
  });
  expect(result.sessions[0]).not.toHaveProperty('players');
  expect(result.historyUnchanged).toBe(true);
});

test('backup, restore, and sync payloads retain attendance snapshots while temporary picker state stays local', async ({ page }) => {
  const sessions = [{ id: 'session', date: '2026-07-18', playerIds: ['a'], createdAt: 10, updatedAt: 20, source: 'team-builder' }];
  await seed(page, { players: [player('a', 'Alpha')], sessions });
  let posted;
  await page.route('https://sync.test/**', async route => {
    if (route.request().method() === 'POST') posted = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');

  const backup = await page.evaluate(async () => {
    window._attendanceUndo = { playerIds: ['a'], expiresAt: Date.now() + 9000 };
    window._teamQuery = 'temporary';
    window.__backupText = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__backupText = text; } } });
    const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = () => 'blob:test'; HTMLAnchorElement.prototype.click = () => {};
    await exportData();
    URL.createObjectURL = create; HTMLAnchorElement.prototype.click = click;
    return JSON.parse(window.__backupText);
  });
  expect(backup.attendanceSessions).toEqual(sessions);
  expect(backup).not.toHaveProperty('_attendanceUndo');
  expect(JSON.stringify(backup)).not.toContain('temporary');

  await page.evaluate(async data => {
    attendanceSessions = [];
    await restoreBackupData(data);
    Sync.cfg.url = 'https://sync.test'; Sync.cfg.code = 'room'; Sync.cfg.on = true;
    await Sync.push({ force: true });
  }, backup);
  expect(await page.evaluate(() => attendanceSessions)).toEqual(sessions);
  expect(JSON.parse(posted.data).attendanceSessions).toEqual(sessions);
});

test('previous attendance prefers explicit snapshots and game fallback counts ties, both sides, and unavailable IDs', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const roster = [
      { id: 'a', name: 'Alpha', active: true, pickupEligible: true },
      { id: 'b', name: 'Bravo', active: true, pickupEligible: true },
      { id: 'inactive', name: 'Inactive', active: false, pickupEligible: true },
      { id: 'event-only', name: 'Guest', active: true, pickupEligible: false }
    ];
    const sessions = [
      { id: 'older', date: '2026-07-17', playerIds: ['a'], createdAt: 1, updatedAt: 1 },
      { id: 'latest', date: '2026-07-18', playerIds: ['b', 'inactive', 'missing'], createdAt: 2, updatedAt: 2 },
      { id: 'today', date: '2026-07-24', playerIds: ['a'], createdAt: 3, updatedAt: 3 }
    ];
    const atNoon = date => {
      const [year, month, day] = date.split('-').map(Number);
      return new Date(year, month - 1, day, 12).getTime();
    };
    const savedGames = [
      { id: 'tie-a', date: atNoon('2026-07-19'), teamA: ['a', 'a'], teamB: ['b'], scoreA: 20, scoreB: 20, log: {} },
      { id: 'tie-b', date: atNoon('2026-07-19') + 1000, teamA: ['b'], teamB: ['inactive', 'event-only', 'missing'], scoreA: 22, scoreB: 22, log: {} },
      { id: 'event', date: atNoon('2026-07-20'), evId: 'event', teamA: ['a'], teamB: ['b'], scoreA: 25, scoreB: 20, winner: 'A', log: {} }
    ];
    return {
      explicit: getPreviousAttendanceSelection({ attendanceSessions: sessions, games: savedGames, players: roster, beforeDate: '2026-07-24' }),
      fallback: getPreviousAttendanceSelection({ attendanceSessions: [], games: savedGames, players: roster, beforeDate: '2026-07-24' })
    };
  });

  expect(result.explicit).toEqual({
    date: '2026-07-18', playerIds: ['b'], unavailableCount: 2, source: 'attendance-session'
  });
  expect(result.fallback).toEqual({
    date: '2026-07-19', playerIds: ['a', 'b'], unavailableCount: 3, source: 'game-history'
  });
});

test('Same as last time excludes today, displays valid count and date, and safely loads the valid remainder', async ({ page }) => {
  const formatLocalDate = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const today = new Date();
  const priorDate = new Date(today);
  priorDate.setDate(priorDate.getDate() - 6);
  const sessions = [
    { id: 'past', date: formatLocalDate(priorDate), playerIds: ['a', 'inactive', 'missing'], createdAt: 10, updatedAt: 10, source: 'team-builder' },
    { id: 'today', date: formatLocalDate(today), playerIds: ['b'], createdAt: 20, updatedAt: 20, source: 'team-builder' }
  ];
  await seed(page, {
    players: [player('a', 'Alpha'), player('b', 'Bravo'), player('inactive', 'Inactive', { active: false })],
    sessions
  });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(); renderTeams(); });

  const previous = page.locator('.attendance-last');
  await expect(previous).toContainText('Use last session · 1 player');
  await expect(previous).toContainText(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(priorDate));
  await previous.click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['a']);
  await expect(page.locator('.attendance-notice[role="status"]')).toContainText('Loaded 1 player. 2 are no longer available.');
});

test('attendance scope and sort default independently and persist through settings reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(roster => {
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ numTeams: 2 }));
  }, [player('a', 'Alpha'), player('b', 'Bravo')]);
  await page.reload();
  await page.locator('[data-tab="teams"]:visible').first().click();
  await expect(page.getByRole('button', { name: /^Regulars / })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Recent first', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^All / }).click();
  await page.getByRole('button', { name: 'Recent first', exact: true }).click();
  await expect(page.getByRole('button', { name: 'A–Z', exact: true })).toBeVisible();
  await page.reload();
  await page.locator('[data-tab="teams"]:visible').first().click();
  await expect(page.getByRole('button', { name: /^All / })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'A–Z', exact: true })).toBeVisible();
});

test('Regulars, Recent, All, and attendance ordering use participation rather than rating', async ({ page }) => {
  await page.goto('/');
  const now = Date.UTC(2026, 6, 24, 12);
  const result = await page.evaluate(({ now, day }) => {
    const roster = [
      { id: 'recent-low', name: 'Zulu', active: true, pickupEligible: true, rating: 1 },
      { id: 'frequent-high', name: 'Alpha', active: true, pickupEligible: true, rating: 99 },
      { id: 'never', name: 'Never', active: true, pickupEligible: true, rating: 50 },
      { id: 'event-player', name: 'Event Player', active: true, pickupEligible: true, rating: 90 },
      { id: 'inactive', name: 'Inactive', active: false, pickupEligible: true },
      { id: 'guest', name: 'Guest', active: true, pickupEligible: false }
    ];
    const game = (id, date, ids) => ({ id, date, teamA: [ids[0]], teamB: [ids[1] || 'missing'], winner: 'A', log: {} });
    const savedGames = [
      game('recent', now - day, ['recent-low']),
      game('old-1', now - 60 * day, ['frequent-high']),
      game('old-2', now - 61 * day, ['frequent-high']),
      { ...game('event-game', now - day, ['event-player']), evId: 'event' }
    ];
    const scopes = attendanceScopes({ playerList: roster, gameList: savedGames, eventList: [], now });
    const labels = buildUniquePlayerDisplayLabels(scopes.all);
    const recentOrder = scopes.all.slice().sort((a, b) => attendancePlayerComparator(a, b, { participationIndex: scopes.participationIndex, displayLabels: labels, sort: 'recent' })).map(p => p.id);
    const azOrder = scopes.all.slice().sort((a, b) => attendancePlayerComparator(a, b, { participationIndex: scopes.participationIndex, displayLabels: labels, sort: 'az' })).map(p => p.id);
    return {
      recent: scopes.recent.map(p => p.id),
      regulars: scopes.regulars.map(p => p.id).sort(),
      all: scopes.all.map(p => p.id).sort(),
      recentOrder, azOrder,
      threshold: RECENT_PLAYER_DAYS,
      constants: [REGULAR_MIN_GAMES, REGULAR_MAX_COUNT]
    };
  }, { now, day: DAY });

  expect(result).toMatchObject({
    recent: ['recent-low'],
    regulars: ['frequent-high', 'recent-low'],
    all: ['event-player', 'frequent-high', 'never', 'recent-low'],
    recentOrder: ['recent-low', 'frequent-high', 'event-player', 'never'],
    azOrder: ['frequent-high', 'event-player', 'never', 'recent-low'],
    threshold: 30,
    constants: [2, 40]
  });
});

test('search ranks primary and alias matches, Enter selects the first unselected, and preserves focus', async ({ page }) => {
  const roster = [
    player('exact-primary', 'Abdi', { rating: 1 }),
    player('exact-alias', 'Zed', { aliases: ['Abdi'], rating: 99 }),
    player('prefix-primary', 'Abdikarim'),
    player('prefix-alias', 'Yara', { aliases: ['Abdil'] }),
    player('substring', 'Mohamed Abdi'),
    player('inactive', 'Abdi Away', { active: false }),
    player('guest', 'Abdi Guest', { pickupEligible: false })
  ];
  await seed(page, { players: roster });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(); renderTeams(); });

  const search = page.getByRole('searchbox', { name: 'Search attendance' });
  await search.fill('Abdi');
  const resultNames = await page.locator('[data-attendance-results] .attendance-player b').allTextContents();
  expect(resultNames.slice(0, 5)).toEqual(['Abdi', 'Zed', 'Abdikarim', 'Yara', 'Mohamed Abdi']);
  await expect(page.locator('[data-player-choice="exact-alias"] small')).toHaveText('Alias match: Abdi');
  await expect(page.locator('[data-player-choice="inactive"]')).toHaveCount(0);
  await expect(page.locator('[data-player-choice="guest"]')).toHaveCount(0);

  await search.press('Enter');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  expect(await page.evaluate(() => [...window._pool])).toEqual(['exact-primary']);

  await search.fill('Abdi');
  await search.press('Enter');
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(['exact-alias', 'exact-primary']);
  await search.fill('Abdi');
  await page.locator('[data-player-choice="exact-primary"]').click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['exact-alias']);
});

test('selected tray, Hide selected, Clear Undo, ratings omission, and sticky actions share canonical selection', async ({ page }) => {
  await seed(page, { players: [player('a', 'Alpha', { rating: 88 }), player('b', 'Bravo', { rating: 22 }), player('c', 'Charlie')] });
  await openTeams(page);
  await page.evaluate(() => { window._pool = new Set(['a', 'b']); renderTeams(); });

  await expect(page.locator('[data-attendance-tray]')).toContainText('2 players');
  await expect(page.locator('[data-attendance-actions]')).toContainText('Build teams · 2');
  await expect(page.locator('[data-selector="teams"]')).not.toContainText('88');
  await expect(page.locator('[data-selector="teams"]')).not.toContainText('Unrated');

  await page.getByRole('button', { name: 'Hide selected', exact: true }).click();
  await expect(page.locator('[data-attendance-results] [data-player-choice="a"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Alpha from attendance' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Alpha from attendance' }).click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['b']);

  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  expect(await page.evaluate(() => [...window._pool])).toEqual([]);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['b']);
});

test('building teams keeps selected IDs, writes one same-day snapshot, and leaves balancing inputs unchanged', async ({ page }) => {
  const roster = [player('a', 'Alpha', { rating: 80 }), player('b', 'Bravo', { rating: 60 }), player('c', 'Charlie', { rating: 40 }), player('d', 'Delta', { rating: 20 })];
  await seed(page, { players: roster, sessions: [] });
  await openTeams(page);
  const result = await page.evaluate(async () => {
    window._pool = new Set(['a', 'c', 'd']);
    const selectedBefore = [...window._pool], ratingsBefore = players.map(p => p.rating), gamesBefore = JSON.stringify(games), eventsBefore = JSON.stringify(evts);
    await genTeams();
    const generated = window._teams.flat().map(p => p.id).sort();
    await genTeams();
    return {
      selectedBefore,
      selectedAfter: [...window._pool],
      generated,
      sessions: attendanceSessions,
      ratingsUnchanged: JSON.stringify(ratingsBefore) === JSON.stringify(players.map(p => p.rating)),
      historyUnchanged: gamesBefore === JSON.stringify(games) && eventsBefore === JSON.stringify(evts)
    };
  });
  expect(result.selectedAfter).toEqual(result.selectedBefore);
  expect(result.generated).toEqual(['a', 'c', 'd']);
  expect(result.sessions).toHaveLength(1);
  expect(result.sessions[0].playerIds).toEqual(['a', 'c', 'd']);
  expect(result.ratingsUnchanged).toBe(true);
  expect(result.historyUnchanged).toBe(true);
});

test('mobile selection and search preserve the attendance scroller, page position, and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const roster = Array.from({ length: 70 }, (_, index) => player(`p${index}`, `Player ${String(index + 1).padStart(2, '0')}`));
  await seed(page, { players: roster });
  await openTeams(page);
  await page.evaluate(() => {
    window._pool = new Set();
    settings.attendanceScope = 'all';
    renderTeams();
    const list = document.querySelector('[data-attendance-results]');
    list.scrollTop = 500;
    window.scrollTo(0, 120);
  });
  const before = await page.evaluate(() => ({
    list: document.querySelector('[data-attendance-results]').scrollTop,
    page: window.scrollY
  }));
  await page.evaluate(() => document.querySelector('[data-player-choice="p10"]').click());
  const after = await page.evaluate(() => ({
    list: document.querySelector('[data-attendance-results]').scrollTop,
    page: window.scrollY
  }));
  expect(after.list).toBeGreaterThanOrEqual(before.list - 2);
  expect(Math.abs(after.page - before.page)).toBeLessThanOrEqual(2);

  const search = page.getByRole('searchbox', { name: 'Search attendance' });
  await search.fill('Player 55');
  await search.press('Enter');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  const geometry = await page.evaluate(() => {
    const footer = document.querySelector('[data-attendance-actions]').getBoundingClientRect();
    return { footerBottom: footer.bottom, viewport: innerHeight, widthOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.widthOverflow).toBeLessThanOrEqual(0);
});
