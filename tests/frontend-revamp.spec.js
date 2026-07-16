import { test, expect } from '@playwright/test';

const fixturePlayers = [
  { id: 'alpha', name: 'Alpha Setter', seedRating: 62, active: true, archived: false, roles: { setter: true } },
  { id: 'beta', name: 'Beta Away', seedRating: 54, active: false, archived: false, roles: {} },
  { id: 'gamma', name: 'Gamma Passer', seedRating: 58, active: true, archived: false, roles: { passer: true } },
  { id: 'archive', name: 'Archive History', seedRating: 48, active: false, archived: true, roles: {} }
];

const fixtureGames = [
  { id: 'full-game', date: 1000, teamA: ['alpha'], teamB: ['gamma'], scoreA: 25, scoreB: 20, winner: 'A', log: { alpha: { ace: 1 }, gamma: { dig: 1 } } },
  { id: 'archive-game', date: 2000, teamA: ['archive'], teamB: ['alpha'], scoreA: 18, scoreB: 25, winner: 'B', log: {} },
  { id: 'event-score', date: 3000, teamA: ['alpha'], teamB: ['gamma'], scoreA: 21, scoreB: 19, winner: 'A', log: {}, evId: 'event-1', evA: 'event-a', evB: 'event-b', label: 'Pool A' }
];

const fixtureEvents = [{
  id: 'event-1', name: 'Summer Command Cup', created: 1, done: false,
  teams: [
    { id: 'event-a', name: 'Aces', pool: 'A', players: ['alpha'] },
    { id: 'event-b', name: 'Blocks', pool: 'A', players: ['gamma'] }
  ],
  sched: { start: '10:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 },
  brackets: []
}];

async function seedFixture(page) {
  await page.addInitScript(({ players, games, events }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, detailed: false, playerSort: 'az', numTeams: 2 }));
  }, { players: fixturePlayers, games: fixtureGames, events: fixtureEvents });
}

async function mobileMoreDestination(page, name) {
  await page.getByRole('button', { name: 'Open more menu', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name, exact: true }).click();
}

async function integritySnapshot(page) {
  return page.evaluate(() => ({
    players: players.map(p => ({
      id: p.id, active: p.active, archived: p.archived, rating: p.rating,
      gamesPlayed: p.gamesPlayed, trackedGames: p.trackedGames, wins: p.wins,
      losses: p.losses, history: p.history, lifetime: p.lifetime
    })),
    games: games.map(g => ({
      id: g.id, teamA: g.teamA, teamB: g.teamB, scoreA: g.scoreA, scoreB: g.scoreB,
      winner: g.winner, log: g.log, evId: g.evId, evA: g.evA, evB: g.evB,
      label: g.label, deltas: g.deltas, winProb: g.winProb
    })),
    events: evts,
    settings
  }));
}

test('mobile uses five primary destinations and More keeps History and Settings reachable', async ({ page }) => {
  await seedFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const mobileNav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(mobileNav.getByRole('button')).toHaveCount(5);
  await expect(mobileNav.getByRole('button', { name: 'Track', exact: true })).toBeVisible();
  await expect(mobileNav.getByRole('button', { name: 'History', exact: true })).toHaveCount(0);

  await mobileMoreDestination(page, 'History');
  await expect(page.locator('main .eyebrow')).toHaveText('History');
  await expect(page.getByRole('button', { name: 'Open more menu', exact: true })).toHaveClass(/active/);

  await mobileMoreDestination(page, 'Settings');
  await expect(page.locator('main .eyebrow')).toHaveText('Settings');
  await expect(page.getByRole('heading', { name: 'Data & backup', exact: true })).toBeVisible();
});

test('desktop sidebar has stable destinations and uses desktop width', async ({ page }) => {
  await seedFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const side = page.getByRole('navigation', { name: 'Desktop navigation' });
  await expect(side.getByRole('button')).toHaveCount(7);
  for (const label of ['Home', 'Players', 'Track', 'Teams', 'Events', 'History', 'Settings']) {
    await expect(side.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await side.getByRole('button', { name: 'History', exact: true }).click();
  await expect(side.getByRole('button', { name: 'History', exact: true })).toHaveAttribute('aria-current', 'page');
  const layout = await page.evaluate(() => ({ main: document.querySelector('main').getBoundingClientRect().width, body: document.body.scrollWidth, viewport: innerWidth }));
  expect(layout.main).toBeGreaterThan(1000);
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
});

test('roster search, status filters, editor Escape, and focus return work', async ({ page }) => {
  await seedFixture(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Players', exact: true }).click();

  const search = page.getByRole('searchbox', { name: 'Search players', exact: true });
  await search.fill('Gamma');
  await expect(page.locator('.player-card').filter({ hasText: 'Gamma Passer' })).toBeVisible();
  await expect(page.locator('.player-card').filter({ hasText: 'Alpha Setter' })).toBeHidden();

  await search.fill('');
  await page.getByRole('button', { name: /Away · 1/ }).click();
  await expect(page.locator('.player-card').filter({ hasText: 'Beta Away' })).toContainText('away');
  await page.getByRole('button', { name: /Archived · 1/ }).click();
  await expect(page.locator('.player-card').filter({ hasText: 'Archive History' })).toContainText('archived');

  await page.getByRole('button', { name: /All · 3/ }).click();
  const add = page.locator('main').getByRole('button', { name: 'Add player', exact: true });
  await add.click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Add player', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(add).toBeFocused();
});

test('match setup is searchable, shows explicit sides, and live controls remain reachable', async ({ page }) => {
  await seedFixture(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Track', exact: true }).click();

  await expect(page.getByRole('searchbox', { name: 'Search available players', exact: true })).toBeVisible();
  const alpha = page.locator('.available-list .chip').filter({ hasText: 'Alpha Setter' });
  const gamma = page.locator('.available-list .chip').filter({ hasText: 'Gamma Passer' });
  await alpha.click();
  await gamma.click();
  await gamma.click();
  await expect(page.getByRole('region', { name: 'Team A selections' })).toContainText('Alpha Setter');
  await expect(page.getByRole('region', { name: 'Team B selections' })).toContainText('Gamma Passer');
  await page.getByRole('button', { name: '2s', exact: true }).click();
  await expect(page.getByText(/2 untracked slots/)).toBeVisible();
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click();

  await page.getByRole('button', { name: 'Team A plus one', exact: true }).click();
  await expect(page.locator('.score-box.A .score-num')).toHaveText('1');
  await page.locator('.tcard').filter({ hasText: 'Alpha Setter' }).getByRole('button', { name: 'Ace', exact: true }).click();
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Score only: off', exact: true }).click();
  await expect(page.getByText(/Score-only mode/)).toBeVisible();

  const sticky = await page.evaluate(() => {
    const finish = document.querySelector('.live-finish').getBoundingClientRect();
    const dock = document.querySelector('.dock-wrap').getBoundingClientRect();
    return { finishBottom: finish.bottom, dockTop: dock.top, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(sticky.finishBottom).toBeLessThanOrEqual(sticky.dockTop + 1);
  expect(sticky.overflow).toBeLessThanOrEqual(0);
});

test('event detail exposes command-center sections and history filters overlap correctly', async ({ page }) => {
  await seedFixture(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Events', exact: true }).click();
  await page.locator('.ev-row').filter({ hasText: 'Summer Command Cup' }).click();
  const eventNav = page.getByRole('navigation', { name: 'Event sections' });
  await expect(eventNav.getByRole('button')).toHaveCount(5);
  await eventNav.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(page.locator('#event-schedule')).toBeVisible();
  await eventNav.getByRole('button', { name: 'Playoffs', exact: true }).click();
  await expect(page.locator('#event-playoffs')).toContainText('No playoff bracket yet');

  await mobileMoreDestination(page, 'History');
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Score only', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search history', exact: true }).fill('Summer');
  await expect(page.locator('.history-row').filter({ hasText: '21 – 19' })).toBeVisible();
});

test('responsive shell has no horizontal overflow and UI navigation preserves derived data', async ({ page }) => {
  await seedFixture(page);
  const viewports = [[320, 700], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 800], [1280, 800], [1440, 900]];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(sizes.scroll, `${width}x${height} horizontal overflow`).toBeLessThanOrEqual(sizes.client);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const before = await integritySnapshot(page);
  for (const destination of ['Players', 'Track', 'Teams', 'Events', 'Home']) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: destination, exact: true }).click();
  }
  await mobileMoreDestination(page, 'History');
  await mobileMoreDestination(page, 'Settings');
  const after = await integritySnapshot(page);
  expect(after).toEqual(before);
});
