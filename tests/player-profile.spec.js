import { test, expect } from '@playwright/test';

const playersFixture = [
  {
    id: 'profile-main', name: 'Jordan Rivera', seedRating: 72, rating: 72, active: true, archived: false,
    roles: { passer: true, defense: true }, notes: 'Reads hitters early.\nCalm in serve receive.',
    history: [{ i: 0, r: 72 }], gamesPlayed: 0, trackedGames: 0, wins: 0, losses: 0, lifetime: {}
  },
  { id: 'profile-two', name: 'Alex Chen', seedRating: 64, rating: 64, active: true, archived: false },
  { id: 'profile-three', name: 'Morgan Lee', seedRating: 56, rating: 56, active: true, archived: false },
  { id: 'profile-four', name: 'Sam Patel', seedRating: 48, rating: 48, active: true, archived: false },
  { id: 'profile-archived', name: 'Archived Ace', seedRating: 90, rating: 90, active: false, archived: true }
];

const gamesFixture = Array.from({ length: 7 }, (_, index) => {
  const mainOnA = index % 2 === 0;
  const opponent = ['profile-two', 'profile-three', 'profile-four'][index % 3];
  const winner = index === 3 ? null : (index % 3 === 2 ? (mainOnA ? 'B' : 'A') : (mainOnA ? 'A' : 'B'));
  return {
    id: `profile-game-${index + 1}`,
    date: Date.UTC(2026, 6, index + 1, 18),
    teamA: mainOnA ? ['profile-main'] : [opponent],
    teamB: mainOnA ? [opponent] : ['profile-main'],
    scoreA: mainOnA ? 25 : 19,
    scoreB: mainOnA ? 19 : 25,
    winner,
    detailed: index < 3,
    ratingVersion: 2,
    log: index < 3 ? {
      'profile-main': { ace: index + 1, sin: 4, serr: 1, goodPass: 3, pget: 1, perr: 1, kill: 2, dig: 3, block: 1 },
      [opponent]: { dig: 1 }
    } : {}
  };
});

async function seed(page, { hideRatings = false, playerList = playersFixture, gameList = gamesFixture, eventList = [] } = {}) {
  await page.addInitScript(({ playerList, gameList, eventList, hideRatings }) => {
    localStorage.setItem('vb:players', JSON.stringify(playerList));
    localStorage.setItem('vb:games', JSON.stringify(gameList));
    localStorage.setItem('vb:events', JSON.stringify(eventList));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings }));
  }, { playerList, gameList, eventList, hideRatings });
}

async function openPlayers(page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Players', exact: true }).click();
}

async function openProfile(page, name = 'Jordan Rivera') {
  await openPlayers(page);
  const card = page.locator('.player-card').filter({ hasText: name }).first();
  await card.click();
  await expect(page.locator('.sheet').getByRole('heading', { name, exact: true })).toBeVisible();
  return card;
}

test('player cards open a streamlined read-only sports profile without crosshairs or layout overflow', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');
  const before = await page.evaluate(() => ({
    players: JSON.stringify(players), games: JSON.stringify(games), storedPlayers: localStorage.getItem('vb:players'), storedGames: localStorage.getItem('vb:games')
  }));
  await openProfile(page);

  const sheet = page.locator('.sheet');
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  await expect(sheet.locator('input, textarea, select')).toHaveCount(0);
  await expect(sheet.getByText('Court Rating', { exact: true })).toBeVisible();
  await expect(sheet.getByText(/#1/).first()).toBeVisible();
  await expect(sheet.locator('.player-profile-direction')).toBeVisible();
  await expect(sheet.locator('.player-profile-direction')).toHaveAttribute('aria-label', /Court Rating (up|down|unchanged).*rated game/);
  await expect(sheet.getByText('Recent form', { exact: true })).toHaveCount(0);
  await expect(sheet.getByText('Rating trend', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Player impact', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Recent games', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Passer', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Defense', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Reads hitters early.')).toBeVisible();
  await expect(sheet.locator('.profile-game-row')).toHaveCount(5);
  await expect(sheet.getByRole('button', { name: 'View all games for Jordan Rivera', exact: true })).toBeVisible();

  const profileLayout = await page.evaluate(() => {
    const hero = document.querySelector('.player-profile-hero');
    const grid = document.querySelector('.player-profile-grid');
    const trend = document.querySelector('.profile-rating-trend-panel');
    const chart = trend.querySelector('.profile-trend');
    const bounds = element => element.getBoundingClientRect();
    return {
      crosshairBackground: getComputedStyle(hero, '::before').backgroundImage,
      innerBorder: getComputedStyle(hero, '::before').borderTopStyle,
      gridWidth: bounds(grid).width,
      trendWidth: bounds(trend).width,
      chartOverflow: chart.scrollWidth - chart.clientWidth,
      sheetOverflow: document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth
    };
  });
  expect(profileLayout).toMatchObject({ crosshairBackground: 'none', innerBorder: 'solid' });
  expect(profileLayout.trendWidth).toBeGreaterThanOrEqual(profileLayout.gridWidth - 2);
  expect(profileLayout.chartOverflow).toBeLessThanOrEqual(0);
  expect(profileLayout.sheetOverflow).toBeLessThanOrEqual(0);

  const model = await page.evaluate(() => {
    const beforeRuntime = JSON.stringify({ players, games });
    const value = playerProfileViewModel(pById('profile-main'));
    const afterRuntime = JSON.stringify({ players, games });
    return {
      beforeRuntime, afterRuntime, recentIds: value.recentGames.map(game => game.id), rank: value.rank,
      stats: value.statItems, trendLength: value.trendPoints.length,
      storedProfileKeys: Object.keys(JSON.parse(localStorage.getItem('vb:players'))[0]).filter(key => /profile|summary|recentForm|rank/i.test(key))
    };
  });
  expect(model.beforeRuntime).toBe(model.afterRuntime);
  expect(model.recentIds).toEqual(['profile-game-7', 'profile-game-6', 'profile-game-5', 'profile-game-4', 'profile-game-3']);
  expect(model.rank).toEqual({ position: 1, population: 4 });
  expect(model.stats.length).toBeGreaterThan(0);
  expect(model.stats.length).toBeLessThanOrEqual(6);
  expect(model.stats.every(stat => stat.value > 0)).toBe(true);
  expect(model.trendLength).toBeLessThanOrEqual(32);
  expect(model.storedProfileKeys).toEqual([]);

  const after = await page.evaluate(() => ({
    players: JSON.stringify(players), games: JSON.stringify(games), storedPlayers: localStorage.getItem('vb:players'), storedGames: localStorage.getItem('vb:games')
  }));
  expect(after).toEqual(before);
});

test('profile layout stays inside narrow and wide viewports and reports archived status honestly', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await openProfile(page);
  let layout = await page.evaluate(() => {
    const bounds = element => { const { left, right, width, height } = element.getBoundingClientRect(); return { left, right, width, height }; };
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      sheet: document.querySelector('.sheet').scrollWidth,
      sheetClient: document.querySelector('.sheet').clientWidth,
      trend: bounds(document.querySelector('.profile-rating-trend-panel')),
      chart: bounds(document.querySelector('.profile-trend')),
      viewAll: bounds(document.querySelector('[data-focus-key="view-all-games"]'))
    };
  });
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.sheet).toBeLessThanOrEqual(layout.sheetClient);
  expect(layout.chart.left).toBeGreaterThanOrEqual(layout.trend.left);
  expect(layout.chart.right).toBeLessThanOrEqual(layout.trend.right);
  expect(layout.viewAll.left).toBeGreaterThanOrEqual(0);
  expect(layout.viewAll.right).toBeLessThanOrEqual(layout.viewport);
  expect(layout.viewAll.height).toBeGreaterThanOrEqual(44);

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    layout = await page.evaluate(() => {
      const bounds = element => { const { left, right, top, bottom } = element.getBoundingClientRect(); return { left, right, top, bottom }; };
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        sheet: document.querySelector('.sheet').scrollWidth,
        sheetClient: document.querySelector('.sheet').clientWidth,
        edit: bounds(document.querySelector('.player-profile-edit')),
        close: bounds(document.querySelector('.sheet-x'))
      };
    });
    expect(layout.document).toBeLessThanOrEqual(layout.viewport);
    expect(layout.sheet).toBeLessThanOrEqual(layout.sheetClient);
    expect(layout.edit.right <= layout.close.left || layout.edit.bottom <= layout.close.top || layout.close.bottom <= layout.edit.top).toBe(true);
  }

  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.setViewportSize({ width: 1180, height: 850 });
  await page.getByRole('button', { name: /Archived · 1/ }).click();
  await page.locator('.player-card').filter({ hasText: 'Archived Ace' }).click();
  await expect(page.locator('.sheet').getByText('Archived', { exact: true })).toBeVisible();
  layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    sheet: document.querySelector('.sheet').scrollWidth,
    sheetClient: document.querySelector('.sheet').clientWidth
  }));
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.sheet).toBeLessThanOrEqual(layout.sheetClient);
});

test('player history filters every supported saved structure by stable ID and sorts newest first', async ({ page }) => {
  const sameNamePlayer = { id: 'profile-same-name', name: 'Jordan Rivera', seedRating: 60, rating: 60, active: true, archived: false };
  const fixedEvent = {
    id: 'profile-fixed-event', name: 'Fixed Team Cup', eventDate: '2026-07-08', created: Date.UTC(2026, 6, 8), done: true,
    teams: [
      { id: 'fixed-main', name: 'Main Six', players: ['profile-main'] },
      { id: 'fixed-opponent', name: 'Visitors', players: ['profile-two'] }
    ],
    brackets: [], sched: { start: '10:00', standardRounds: 1, courts: 1, setMin: 20, matchMin: 45, breakMin: 10, seed: 'fixed-profile', revision: 1 }
  };
  const rotatingEvent = {
    id: 'profile-rotating-event', name: 'Rotating Pairs', format: 'rotatingPairs4s', eventDate: '2026-07-09', created: Date.UTC(2026, 6, 9), done: true,
    teams: [], brackets: [],
    pairs: [
      { id: 'pair-main', name: 'Main Pair', players: ['profile-main'] },
      { id: 'pair-opponent', name: 'Other Pair', players: ['profile-three'] }
    ],
    pairSettings: { entrySize: 1, teamSize: 2, rounds: 1, courts: 1, start: '11:00', setMin: 20 },
    pairSchedule: [{ id: 'rotating-match', round: 1, court: 1, pairIdsA: ['pair-main'], pairIdsB: ['pair-opponent'] }]
  };
  const extraGames = [
    {
      id: 'fixed-legacy-game', teamA: [], teamB: [], scoreA: 25, scoreB: 21, winner: 'A', log: {},
      evId: fixedEvent.id, evA: 'fixed-main', evB: 'fixed-opponent', evMatchId: 'fixed-match', label: 'Pool play'
    },
    {
      id: 'rotating-legacy-tie', date: Date.UTC(2026, 6, 9, 11), teamA: [], teamB: [], scoreA: 21, scoreB: 21, winner: null, log: {},
      evId: rotatingEvent.id, evMatchId: 'rotating-match', evPairIdsA: ['pair-main'], evPairIdsB: ['pair-opponent'], eventFormat: 'rotatingPairs4s'
    },
    {
      id: 'unrated-solo', date: Date.UTC(2026, 6, 10, 12), solo: true, teamA: ['profile-main'], teamB: [], scoreA: 1, scoreB: 0, winner: 'A', log: {}
    },
    {
      id: 'same-name-other-player', date: Date.UTC(2026, 6, 11, 12), teamA: ['profile-same-name'], teamB: ['profile-four'], scoreA: 25, scoreB: 20, winner: 'A', log: {}
    },
    {
      id: 'unrelated-game', date: Date.UTC(2026, 6, 12, 12), teamA: ['profile-two'], teamB: ['profile-three'], scoreA: 25, scoreB: 20, winner: 'A', log: {}
    }
  ];
  await seed(page, {
    playerList: [...playersFixture, sameNamePlayer],
    gameList: [...gamesFixture, ...extraGames],
    eventList: [fixedEvent, rotatingEvent]
  });
  await page.goto('/');
  await openProfile(page);

  const selector = await page.evaluate(() => ({
    ids: getGamesForPlayer('profile-main').map(game => game.id),
    sameNameIds: getGamesForPlayer('profile-same-name').map(game => game.id),
    preview: playerProfileViewModel(pById('profile-main')).recentGames.map(game => game.id),
    pureBefore: JSON.stringify({ games, evts }),
    pureAfter: (() => { getGamesForPlayer('profile-main'); return JSON.stringify({ games, evts }); })()
  }));
  expect(selector.ids).toEqual([
    'unrated-solo', 'rotating-legacy-tie', 'fixed-legacy-game',
    'profile-game-7', 'profile-game-6', 'profile-game-5', 'profile-game-4', 'profile-game-3', 'profile-game-2', 'profile-game-1'
  ]);
  expect(selector.sameNameIds).toEqual(['same-name-other-player']);
  expect(selector.preview).toEqual(selector.ids.slice(0, 5));
  expect(selector.pureAfter).toBe(selector.pureBefore);

  await page.locator('.sheet').getByRole('button', { name: 'View all games for Jordan Rivera', exact: true }).click();
  const history = page.locator('[data-player-history="profile-main"]');
  await expect(history.getByRole('heading', { name: 'Games for Jordan Rivera', exact: true })).toBeVisible();
  await expect(history).toContainText('10 saved games');
  await expect(history.locator('.history-row')).toHaveCount(10);
  await expect(history.locator('[data-focus-key="player-history-game-rotating-legacy-tie"]')).toContainText('tie · not rated');
  await expect(history.locator('[data-focus-key="player-history-game-unrated-solo"]')).toContainText('solo scout');
  await expect(history.locator('[data-focus-key="player-history-game-same-name-other-player"]')).toHaveCount(0);
  await expect(history.locator('[data-focus-key="player-history-game-unrelated-game"]')).toHaveCount(0);
  expect(await history.locator('.history-row').evaluateAll(rows => rows.map(row => row.dataset.focusKey))).toEqual(selector.ids.map(id => `player-history-game-${id}`));
});

test('profile history and game details use one modal, restore focus, and remain read-only', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const before = await page.evaluate(() => JSON.stringify({
    players, games, events: evts, settings,
    storage: Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])
  }));
  await openProfile(page);
  const viewAll = page.locator('.sheet').getByRole('button', { name: 'View all games for Jordan Rivera', exact: true });
  await viewAll.click();

  const history = page.locator('[data-player-history="profile-main"]');
  await expect(history.locator('.history-row')).toHaveCount(7);
  await expect(page.locator('.scrim')).toHaveCount(1);
  const mobileHistoryLayout = await page.evaluate(() => {
    const back = document.querySelector('[data-focus-key="player-history-back"]').getBoundingClientRect();
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      sheetOverflow: document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth,
      back: { left: back.left, right: back.right, height: back.height }
    };
  });
  expect(mobileHistoryLayout.document).toBeLessThanOrEqual(mobileHistoryLayout.viewport);
  expect(mobileHistoryLayout.sheetOverflow).toBeLessThanOrEqual(0);
  expect(mobileHistoryLayout.back.left).toBeGreaterThanOrEqual(0);
  expect(mobileHistoryLayout.back.right).toBeLessThanOrEqual(mobileHistoryLayout.viewport);
  expect(mobileHistoryLayout.back.height).toBeGreaterThanOrEqual(44);

  const opener = history.locator('[data-focus-key="player-history-game-profile-game-7"]');
  await opener.evaluate(element => element.closest('.sheet').scrollTop = element.offsetTop);
  await opener.click();
  await expect(page.locator('.sheet').getByRole('heading', { name: /Game ·/ })).toBeVisible();
  await expect(page.locator('.sheet').getByRole('button', { name: 'Back to games for Jordan Rivera', exact: true })).toBeFocused();
  await expect(page.locator('.sheet').getByRole('button', { name: 'Delete game', exact: true })).toHaveCount(0);
  await expect(page.locator('.scrim')).toHaveCount(1);

  await page.locator('.sheet').getByRole('button', { name: 'Back to games for Jordan Rivera', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Games for Jordan Rivera', exact: true })).toBeVisible();
  await expect(page.locator('[data-focus-key="player-history-game-profile-game-7"]')).toBeFocused();
  await page.locator('.sheet').getByRole('button', { name: 'Back to Jordan Rivera profile', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Jordan Rivera', exact: true })).toBeVisible();
  await expect(page.locator('[data-focus-key="view-all-games"]')).toBeFocused();
  await expect(page.locator('.scrim')).toHaveCount(1);

  await page.locator('[data-focus-key="view-all-games"]').click();
  await expect(page.locator('[data-player-history="profile-main"] .history-row')).toHaveCount(7);
  await expect(page.locator('.scrim')).toHaveCount(1);
  await page.locator('.sheet').getByRole('button', { name: 'Back to Jordan Rivera profile', exact: true }).click();

  const after = await page.evaluate(() => JSON.stringify({
    players, games, events: evts, settings,
    storage: Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])
  }));
  expect(after).toBe(before);
});

test('archived players keep historical game access and players without games get an empty state', async ({ page }) => {
  const archivedGame = {
    id: 'archived-history', date: Date.UTC(2025, 2, 4, 19), teamA: ['profile-two'], teamB: ['profile-archived'],
    scoreA: 18, scoreB: 25, winner: 'B', log: {}
  };
  await seed(page, { gameList: [archivedGame] });
  await page.goto('/');
  await openPlayers(page);
  await page.getByRole('button', { name: /Archived · 1/ }).click();
  await page.locator('.player-card').filter({ hasText: 'Archived Ace' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'View all games for Archived Ace', exact: true }).click();
  await expect(page.locator('[data-player-history="profile-archived"] .history-row')).toHaveCount(1);
  await expect(page.locator('[data-focus-key="player-history-game-archived-history"]')).toBeVisible();

  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await page.getByRole('button', { name: /Archived · 1/ }).click();
  await page.locator('.player-card').filter({ hasText: 'Archived Ace' }).click();
  await page.evaluate(() => { games = []; });
  await page.locator('.sheet').getByRole('button', { name: 'View all games for Archived Ace', exact: true }).click();
  await expect(page.locator('[data-player-history="profile-archived"]')).toContainText('No games for this player');
});

test('edit Cancel returns to the same profile and a dirty close confirms before discarding', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const card = await openProfile(page);
  const storedBefore = await page.evaluate(() => localStorage.getItem('vb:players'));

  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Edit player', exact: true })).toBeVisible();
  await page.getByPlaceholder('Player name').fill('Unsaved Name');
  await page.getByPlaceholder('e.g. great serve receive').fill('Unsaved notes');
  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Jordan Rivera', exact: true })).toBeVisible();
  await expect(page.locator('.sheet')).toContainText('Reads hitters early.');
  expect(await page.evaluate(() => localStorage.getItem('vb:players'))).toBe(storedBefore);

  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await page.getByPlaceholder('Player name').fill('Still Unsaved');
  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Discard unsaved profile changes?');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByPlaceholder('Player name')).toHaveValue('Still Unsaved');
  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(card).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('vb:players'))).toBe(storedBefore);
});

test('closing an unchanged edit does not show a discard confirmation', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openProfile(page);
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Edit player', exact: true })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('.sheet')).toHaveCount(0);
});

test('saving non-rating profile fields returns to profile without replaying ratings or changing IDs and games', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.evaluate(() => {
    window.__profileCommitCalls = 0;
    const original = commit;
    window.__restoreProfileCommit = () => { commit = original; };
    commit = async (...args) => { window.__profileCommitCalls++; return original(...args); };
  });
  await openProfile(page);
  const before = await page.evaluate(() => ({
    rating: pById('profile-main').rating, history: JSON.stringify(pById('profile-main').history), games: JSON.stringify(games), ids: players.map(player => player.id)
  }));
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await page.getByPlaceholder('Player name').fill('Jordan Rivera Updated');
  await page.getByPlaceholder('e.g. great serve receive').fill('Updated profile note');
  await page.locator('.sheet').getByRole('button', { name: 'Hitter', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Jordan Rivera Updated', exact: true })).toBeVisible();
  const after = await page.evaluate(() => {
    const value = {
      rating: pById('profile-main').rating, history: JSON.stringify(pById('profile-main').history), games: JSON.stringify(games), ids: players.map(player => player.id),
      notes: pById('profile-main').notes, hitter: pById('profile-main').roles.hitter, commitCalls: window.__profileCommitCalls
    };
    window.__restoreProfileCommit();
    return value;
  });
  expect(after).toMatchObject({ ...before, notes: 'Updated profile note', hitter: true, commitCalls: 0 });
});

test('stealth mode removes rating, rank, trend values, and recent-game deltas from the profile', async ({ page }) => {
  await seed(page, { hideRatings: true });
  await page.goto('/');
  await openProfile(page);
  const sheet = page.locator('.sheet');
  await expect(sheet).toContainText('Court Rating, active rank, deltas, and trend are hidden in stealth mode.');
  await expect(sheet).toContainText('Rating trend is hidden in stealth mode.');
  await expect(sheet.getByText('Court Rating', { exact: true })).toHaveCount(0);
  await expect(sheet.locator('.player-profile-rank')).toHaveCount(0);
  await expect(sheet.locator('.profile-game-score').getByText(/rating/i)).toHaveCount(0);
  const model = await page.evaluate(() => playerProfileViewModel(pById('profile-main')));
  expect(model).toMatchObject({ ratingsHidden: true, rating: null, level: null, rank: null, trendPoints: [], trendDelta: null });
});

test('single-player ranks and unusual names use honest fallbacks', async ({ page }) => {
  await seed(page, {
    playerList: [{ id: 'only', name: '  !!!  ', seedRating: 50, rating: 50, active: true, archived: false }],
    gameList: []
  });
  await page.goto('/');
  const data = await page.evaluate(() => ({ initials: initials('  !!!  '), unicode: initials('Élodie 王'), rank: playerProfileViewModel(players[0]).rank }));
  expect(data).toEqual({ initials: '?', unicode: 'É王', rank: null });
});
