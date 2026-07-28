import { test, expect } from '@playwright/test';

function player(id, name, extra = {}) {
  const rating = extra.rating ?? 50;
  return {
    id, name, seedRating: rating, rating, active: true, archived: false,
    pickupEligible: true, aliases: [], roles: {}, lifetime: {}, history: [{ i: 0, r: rating }],
    ...extra
  };
}

function roster(count = 12, extra = {}) {
  return Array.from({ length: count }, (_, index) =>
    player(`p${index}`, `Player ${String(index + 1).padStart(2, '0')}`, {
      rating: extra.equalRatings ? 50 : 42 + (index % 17)
    })
  );
}

async function seed(page, { players, crews = [], games = [], events = [], settings = {} }) {
  await page.addInitScript(data => {
    localStorage.setItem('vb:players', JSON.stringify(data.players));
    localStorage.setItem('vb:games', JSON.stringify(data.games));
    localStorage.setItem('vb:events', JSON.stringify(data.events));
    localStorage.setItem('vb:attendanceSessions', '[]');
    localStorage.setItem('vb:savedCrews', JSON.stringify(data.crews));
    localStorage.setItem('vb:settings', JSON.stringify({
      numTeams: 2, attendanceScope: 'all', attendanceSort: 'az', ...data.settings
    }));
  }, { players, crews, games, events, settings });
}

async function openTab(page, name) {
  await page.locator(`[data-tab="${name}"]:visible`).click();
}

async function openTeams(page) {
  await page.goto('/');
  await openTab(page, 'teams');
  await expect(page.getByRole('heading', { name: 'Make even teams', exact: true })).toBeVisible();
}

async function openTrack(page) {
  await page.goto('/');
  await openTab(page, 'track');
  await expect(page.getByRole('heading', { name: 'Track a game', exact: true })).toBeVisible();
}

const teamSignature = page => page.evaluate(() => canonicalMatchupSignature(window._teams));

test('Teams direct entry is explicit, filters are inert, review is complete, and eligibility is preserved', async ({ page }) => {
  const active = roster(52);
  const players = [
    ...active,
    player('inactive', 'Inactive Player', { active: false }),
    player('archived', 'Archived Player', { active: false, archived: true }),
    player('ineligible', 'Event Only Player', { pickupEligible: false })
  ];
  const crews = [{ id: 'crew', name: 'Saved Six', playerIds: active.slice(0, 6).map(p => p.id), createdAt: 1, updatedAt: 1, lastUsedAt: null }];
  await seed(page, { players, crews });
  await openTeams(page);

  expect(await page.evaluate(() => window._pool.size)).toBe(0);
  await expect(page.locator('.attendance-selected-chip')).toHaveCount(0);
  await expect(page.locator('[data-attendance-summary]')).toContainText('0 players selected');
  await expect(page.getByRole('button', { name: /Add Saved Six/ })).toBeVisible();
  expect(await page.evaluate(() => window._pool.size)).toBe(0);

  for (const label of ['Regulars 0', 'Recent 0', 'All 52']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(await page.evaluate(() => window._pool.size)).toBe(0);
  }
  await expect(page.locator('[data-player-choice="inactive"]')).toHaveCount(0);
  await expect(page.locator('[data-player-choice="archived"]')).toHaveCount(0);
  await expect(page.locator('[data-player-choice="ineligible"]')).toHaveCount(0);

  const search = page.getByRole('searchbox', { name: 'Search attendance', exact: true });
  await search.fill('Player 01');
  const first = page.locator('[data-player-choice="p0"]');
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('Player 01');
  await expect(page.getByRole('button', { name: 'Build teams · 1', exact: true })).toBeDisabled();
  await search.fill('');
  await page.getByRole('button', { name: 'Select all shown', exact: true }).click();
  expect(await page.evaluate(() => window._pool.size)).toBe(52);
  await expect(page.getByRole('button', { name: 'Build teams · 52', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review selected players', exact: true })).toBeVisible();
  await expect(page.locator('[data-attendance-review-list] .attendance-review-row')).toHaveCount(52);
  await page.getByRole('button', { name: 'Remove Player 52 from selected players', exact: true }).click();
  await expect(page.locator('[data-attendance-review-list] .attendance-review-row')).toHaveCount(51);
  expect(await page.evaluate(() => window._pool.has('p51'))).toBe(false);
  await page.getByRole('button', { name: 'Back to player list', exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  expect(await page.evaluate(() => window._pool.size)).toBe(0);
  await expect(page.locator('[data-attendance-actions]')).toHaveClass(/empty/);

  await page.getByRole('button', { name: /Add Saved Six/ }).click();
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(active.slice(0, 6).map(p => p.id).sort());
});

test('Teams mobile uses document flow, leaves the final row reachable, and selection taps stay stable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await seed(page, { players: roster(60) });
  await openTeams(page);

  const layout = await page.evaluate(() => {
    const list = document.querySelector('[data-attendance-results]'), style = getComputedStyle(list);
    return {
      overflowY: style.overflowY,
      clipped: list.scrollHeight > list.clientHeight,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(layout).toEqual({ overflowY: 'visible', clipped: false, horizontal: 0 });

  const target = page.locator('[data-player-choice="p30"]');
  await target.scrollIntoViewIfNeeded();
  const before = await target.evaluate(element => ({ y: window.scrollY, top: element.getBoundingClientRect().top }));
  await target.click();
  const after = await target.evaluate(element => ({ y: window.scrollY, top: element.getBoundingClientRect().top }));
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const reachability = await page.evaluate(() => {
    const row = document.querySelector('[data-player-choice="p59"]').getBoundingClientRect();
    const dock = document.querySelector('[data-attendance-actions]').getBoundingClientRect();
    return { rowBottom: row.bottom, dockTop: dock.top, horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(reachability.rowBottom).toBeLessThanOrEqual(reachability.dockTop + 1);
  expect(reachability.horizontal).toBeLessThanOrEqual(0);
});

test('Shuffle teams changes the canonical partition, preserves data, and result actions have distinct outcomes', async ({ page }) => {
  const players = roster(8, { equalRatings: true });
  players[0].name = 'Rachel Alexandra Montgomery Sventek';
  await seed(page, { players });
  await openTeams(page);
  await page.getByRole('button', { name: 'Select all shown', exact: true }).click();
  await page.getByRole('button', { name: 'Build teams · 8', exact: true }).click();

  const before = await teamSignature(page);
  const snapshot = await page.evaluate(() => JSON.stringify({ players, games, events: evts }));
  const selected = await page.evaluate(() => [...window._pool].sort());
  await expect(page.getByRole('button', { name: 'Build teams · 8', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Shuffle teams', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Shuffle teams', exact: true }).click();

  const shuffled = await teamSignature(page);
  expect(shuffled).not.toBe(before);
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(selected);
  expect(await page.evaluate(() => {
    const pool = getSelectablePlayers({ context: 'pickupAttendance' }).filter(player => window._pool.has(player.id));
    return acceptableAlternateMatchup(window._teams, matchupBalanceQuality(balance(pool, settings.numTeams)));
  })).toBe(true);
  expect(await page.evaluate(() => JSON.stringify({ players, games, events: evts }))).toBe(snapshot);

  const second = shuffled;
  await page.getByRole('button', { name: 'Shuffle teams', exact: true }).click();
  expect(await teamSignature(page)).not.toBe(second);

  await page.getByRole('button', { name: 'Change players', exact: true }).click();
  expect(await page.evaluate(() => [...window._pool].sort())).toEqual(selected);
  await expect(page.getByRole('searchbox', { name: 'Search attendance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Build teams · 8', exact: true }).click();
  const intended = await page.evaluate(() => window._teams.map(team => team.map(player => player.id).sort()));
  await page.getByRole('button', { name: 'Track matchup', exact: true }).click();
  expect(await page.evaluate(() => [[...window._sel.A].sort(), [...window._sel.B].sort()])).toEqual(intended);
  await expect(page.locator('[data-track-count="A"]')).toContainText('4');
  await expect(page.locator('[data-track-count="B"]')).toContainText('4');
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test('Shuffle explains when no alternate balanced partition exists', async ({ page }) => {
  await seed(page, { players: [player('a', 'Alpha'), player('b', 'Bravo')] });
  await openTeams(page);
  await page.getByRole('button', { name: 'Select all shown', exact: true }).click();
  await page.getByRole('button', { name: 'Build teams · 2', exact: true }).click();
  const before = await teamSignature(page);
  await page.getByRole('button', { name: 'Shuffle teams', exact: true }).click();
  expect(await teamSignature(page)).toBe(before);
  await expect(page.getByText('No different balanced lineup was available for this player group.', { exact: true })).toBeVisible();
});

test('Track direct entry clears stale picks while assignments remain accessible, searchable, valid, and stable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { players: roster(55) });
  await openTrack(page);
  const search = page.getByRole('searchbox', { name: 'Search available players', exact: true });

  const formatTop = await page.getByText('Players per side', { exact: true }).evaluate(element => element.getBoundingClientRect().top);
  const teamTop = await page.locator('.selection-panel.A').evaluate(element => element.getBoundingClientRect().top);
  const searchTop = await search.evaluate(element => element.getBoundingClientRect().top);
  expect(formatTop).toBeLessThan(teamTop);
  expect(teamTop).toBeLessThan(searchTop);

  const first = page.locator('[data-track-player-id="p0"]');
  await first.click();
  await expect(first).toHaveAttribute('data-team', 'A');
  await expect(first).toHaveAttribute('aria-label', /assigned to Team A/);
  await expect(first.locator('.team-assignment-badge')).toHaveText('A');
  await expect(page.getByRole('button', { name: 'Start tracking', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '4s', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start tracking', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Any', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start tracking', exact: true })).toBeDisabled();

  await search.fill('Player 31');
  const target = page.locator('[data-track-player-id="p30"]');
  await target.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const states = [];
  for (const team of ['A', 'B', '']) {
    const before = await target.evaluate(element => ({ y: window.scrollY, top: element.getBoundingClientRect().top }));
    await target.click();
    const after = await target.evaluate(element => ({ y: window.scrollY, top: element.getBoundingClientRect().top, team: element.dataset.team, focused: document.activeElement === element }));
    states.push({ before, after });
    expect(after.team).toBe(team);
    expect(after.focused).toBe(true);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
    await expect(search).toHaveValue('Player 31');
  }

  await search.fill('');
  await first.click();
  const remove = page.locator('[data-track-remove="p0"]');
  await remove.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const removeY = await page.evaluate(() => window.scrollY);
  await remove.click();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - removeY)).toBeLessThanOrEqual(2);
  await expect(first).toHaveAttribute('data-team', '');

  await openTab(page, 'home');
  await openTab(page, 'track');
  expect(await page.evaluate(() => ({ A: window._sel.A.size, B: window._sel.B.size }))).toEqual({ A: 0, B: 0 });
  const mobileLayout = await page.evaluate(() => {
    const list = document.querySelector('[data-preserve-scroll="track-roster"]');
    return {
      overflowY: getComputedStyle(list).overflowY,
      clipped: list.scrollHeight > list.clientHeight,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(mobileLayout).toEqual({ overflowY: 'visible', clipped: false, horizontal: 0 });
});
