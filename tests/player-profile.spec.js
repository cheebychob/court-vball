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

async function seed(page, { hideRatings = false, playerList = playersFixture, gameList = gamesFixture } = {}) {
  await page.addInitScript(({ playerList, gameList, hideRatings }) => {
    localStorage.setItem('vb:players', JSON.stringify(playerList));
    localStorage.setItem('vb:games', JSON.stringify(gameList));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings }));
  }, { playerList, gameList, hideRatings });
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

test('player cards open a bounded read-only sports profile without mutating stored or runtime data', async ({ page }) => {
  await seed(page);
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
  await expect(sheet.getByText('Recent form', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Rating trend', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Player impact', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Recent games', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Passer', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Defense', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Reads hitters early.')).toBeVisible();
  await expect(sheet.locator('.profile-game-row')).toHaveCount(5);

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
  let layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    sheet: document.querySelector('.sheet').scrollWidth,
    sheetClient: document.querySelector('.sheet').clientWidth
  }));
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.sheet).toBeLessThanOrEqual(layout.sheetClient);

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
