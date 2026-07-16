import { test, expect } from '@playwright/test';

function roster(count = 24) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${String.fromCharCode(65 + i)}`,
    seedRating: 100 - i,
    rating: 100 - i,
    active: true,
    archived: false,
    roles: {},
    lifetime: {},
    history: [{ i: 0, r: 100 - i }]
  }));
}

function fixedEvent(id = 'fixed-seeds', teamCount = 12, pools = 3) {
  return {
    id,
    name: `Fixed ${id}`,
    created: 1,
    done: false,
    format: 'fixedTeams',
    teams: Array.from({ length: teamCount }, (_, i) => ({
      id: `${id}-t${i}`,
      name: `Team ${String.fromCharCode(65 + i)}`,
      pool: pools ? String.fromCharCode(65 + (i % pools)) : '',
      players: [`p${i}`]
    })),
    brackets: [],
    sched: { start: '10:00', courts: 3, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: `${id}-schedule`, revision: 1 }
  };
}

async function seed(page, { events = [fixedEvent()], games = [], hideRatings = false, players = roster() } = {}) {
  await page.addInitScript(({ events, games, hideRatings, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings, playerSort: 'az', numTeams: 2 }));
  }, { events, games, hideRatings, players });
}

async function openFixedEvent(page, id = 'fixed-seeds') {
  await page.goto('/');
  await page.evaluate(eventId => openEvent(eventId), id);
}

async function previewAssignments(page) {
  return page.locator('[data-pool-seed-preview]').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.dataset.poolSeedPreview, row.dataset.pool])));
}

test('snake, manual, guest, and fallback plans follow the fixed pool-seeding rules', async ({ page }) => {
  await seed(page, { events: [fixedEvent('algorithms', 20, 0)] });
  await page.goto('/');

  const result = await page.evaluate(() => {
    const ev = evts[0];
    const snake = fixedPoolSeedPlan(ev, 'snake', 4);
    const repeat = fixedPoolSeedPlan(ev, 'snake', 4);
    const manualRanks = Object.fromEntries(ev.teams.map((team, i) => [team.id, ev.teams.length - i]));
    const manual = fixedPoolSeedPlan(ev, 'manual', 4, { manualRanks });
    const guestEvent = { ...ev, id: 'guest-algorithm', teams: ev.teams.slice(0, 9).map(team => ({ ...team })).concat({ id: 'guest-team', name: 'Guest Middle', pool: '', players: [] }) };
    const guest = fixedPoolSeedPlan(guestEvent, 'snake', 2);
    const guestIndex = guest.rows.findIndex(row => row.team.id === 'guest-team');
    const allGuest = fixedPoolSeedPlan({ id: 'all-guests', teams: Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, name: `Guest ${i}`, players: [] })) }, 'snake', 2);
    pById('p19').archived = true;
    const archivedStrength = teamPoolSeedStrength({ players: ['p19'] });
    return {
      snakePools: snake.rows.map(row => row.pool),
      snakeCounts: Object.values(snake.rows.reduce((counts, row) => ({ ...counts, [row.pool]: (counts[row.pool] || 0) + 1 }), {})).sort((a, b) => a - b),
      deterministic: JSON.stringify(snake) === JSON.stringify(repeat),
      manualFirst: manual.rows[0].team.id,
      manualPools: manual.rows.map(row => row.pool),
      guestIndex,
      guestStrength: guest.rows[guestIndex].strength,
      knownMedian: medianNumber(guest.rows.filter(row => row.team.id !== 'guest-team').map(row => row.strength)),
      allGuest: { valid: allGuest.valid, fallback: allGuest.fallback, mode: allGuest.mode, count: Object.keys(allGuest.assign).length },
      archivedStrength,
      defaultMode: fixedPoolSeedMode(ev),
      cleanLabels: Array.from({ length: 30 }, (_, i) => cleanPoolLabel(poolLabel(i)) === poolLabel(i)).every(Boolean)
    };
  });

  expect(result.snakePools).toEqual(['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A', 'A', 'B', 'C', 'D', 'D', 'C', 'B', 'A', 'A', 'B', 'C', 'D']);
  expect(result.snakeCounts).toEqual([5, 5, 5, 5]);
  expect(result.deterministic).toBe(true);
  expect(result.manualFirst).toBe('algorithms-t19');
  expect(result.manualPools).toEqual(result.snakePools);
  expect(result.guestIndex).toBeGreaterThanOrEqual(4);
  expect(result.guestIndex).toBeLessThanOrEqual(5);
  expect(result.guestStrength).toBe(result.knownMedian);
  expect(result.allGuest).toEqual({ valid: true, fallback: true, mode: 'shuffle', count: 8 });
  expect(result.archivedStrength).toBeNull();
  expect(result.defaultMode).toBe('shuffle');
  expect(result.cleanLabels).toBe(true);
});

test('the preview is draft-only, manual ranks apply through snake, and hidden ratings stay hidden', async ({ page }) => {
  const event = fixedEvent('preview', 8, 2);
  const original = Object.fromEntries(event.teams.map(team => [team.id, team.pool]));
  await seed(page, { events: [event] });
  await openFixedEvent(page, 'preview');

  await page.getByRole('button', { name: 'Seed pools', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seed pools · Fixed preview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Snake', exact: true }).click();
  await expect(page.locator('[data-pool-seed-preview]').first()).toContainText(/rating \d+/);
  expect(await page.evaluate(() => Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])))).toEqual(original);
  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])))).toEqual(original);

  await page.getByRole('button', { name: 'Seed pools', exact: true }).click();
  await page.getByRole('button', { name: 'Manual', exact: true }).click();
  await expect(page.locator('[data-pool-seed-rank]')).toHaveCount(8);
  const expected = await page.evaluate(() => {
    const d = window._poolSeedDraft, ev = evts[0];
    ev.teams.forEach((team, i) => d.manualRanks[team.id] = ev.teams.length - i);
    renderPoolSeedingSheet();
    return fixedPoolSeedPlan(ev, 'manual', d.count, { manualRanks: d.manualRanks }).assign;
  });
  await page.getByRole('button', { name: 'Confirm pool assignments', exact: true }).click();
  expect(await page.evaluate(() => ({ mode: evts[0].poolSeedMode, pools: Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])) }))).toEqual({ mode: 'manual', pools: expected });

  const hidden = fixedEvent('hidden', 8, 2);
  await page.evaluate(async hiddenEvent => {
    evts = [hiddenEvent]; settings.hideRatings = true; await saveEvents(); openEvent(hiddenEvent.id);
  }, hidden);
  await page.getByRole('button', { name: 'Seed pools', exact: true }).click();
  await page.getByRole('button', { name: 'Snake', exact: true }).click();
  await expect(page.locator('[data-pool-seed-preview]')).toHaveCount(8);
  await expect(page.locator('.sheet')).not.toContainText(/rating \d+/);

  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => { evts[0].teams.forEach(team => team.players = []); openPoolSeeding(evts[0].id); });
  await page.getByRole('button', { name: 'Snake', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('No teams have current roster ratings, so Court used deterministic shuffle instead.');
  await expect(page.locator('.sheet')).toContainText('No teams have current roster ratings, so Court used deterministic shuffle instead.');
});

test('random previews are fresh, require confirmation, and save the previewed assignment', async ({ page }) => {
  const event = fixedEvent('random', 12, 3);
  const original = Object.fromEntries(event.teams.map(team => [team.id, team.pool]));
  await seed(page, { events: [event] });
  await openFixedEvent(page, 'random');

  await page.getByRole('button', { name: 'Seed pools', exact: true }).click();
  await page.getByRole('button', { name: 'Random', exact: true }).click();
  const first = await previewAssignments(page);
  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])))).toEqual(original);

  await page.getByRole('button', { name: 'Seed pools', exact: true }).click();
  await page.getByRole('button', { name: 'Random', exact: true }).click();
  const second = await previewAssignments(page);
  expect(second).not.toEqual(first);
  await page.getByRole('button', { name: 'Confirm pool assignments', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('fresh randomized assignment');
  await dialog.getByRole('button', { name: 'Apply random pools', exact: true }).click();
  expect(await page.evaluate(() => ({ mode: evts[0].poolSeedMode, pools: Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])) }))).toEqual({ mode: 'random', pools: second });
});

test('confirmation recomputes from live teams and preserves saved games and ratings', async ({ page }) => {
  const event = fixedEvent('live', 12, 3);
  const game = { id: 'pool-game', date: 10, evId: event.id, evA: event.teams[0].id, evB: event.teams[3].id, teamA: ['p0'], teamB: ['p3'], scoreA: 25, scoreB: 20, winner: 'A', log: {} };
  await seed(page, { events: [event], games: [game] });
  await openFixedEvent(page, 'live');
  const before = await page.evaluate(() => ({ games: JSON.stringify(games), ratings: players.map(player => player.rating), pools: Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])) }));

  await page.getByRole('button', { name: 'Seed pools', exact: true }).click();
  await page.getByRole('button', { name: 'Snake', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm pool assignments', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Saved games and player ratings will not be deleted or recalculated differently.');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => Object.fromEntries(evts[0].teams.map(team => [team.id, team.pool])))).toEqual(before.pools);

  await page.getByRole('button', { name: 'Confirm pool assignments', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Update pools', exact: true }).click();
  const after = await page.evaluate(() => ({ games: JSON.stringify(games), ratings: players.map(player => player.rating), mode: evts[0].poolSeedMode }));
  expect(after).toEqual({ games: before.games, ratings: before.ratings, mode: 'snake' });

  await page.evaluate(() => {
    const ev = evts[0]; games = []; openEvent(ev.id); openPoolSeeding(ev.id); poolSeedMode('snake');
    ev.teams.push({ id: 'live-added', name: 'Team Added', pool: '', players: ['p12'] });
  });
  await page.evaluate(async () => { await savePoolSeeding(); });
  expect(await page.evaluate(() => evts[0].teams.find(team => team.id === 'live-added').pool)).toMatch(/^[A-C]$/);
});

test('Seed pools is disabled with an obvious reason when an event has no teams', async ({ page }) => {
  const empty = { id: 'empty-fixed', name: 'Empty Fixed', created: 1, done: false, format: 'fixedTeams', teams: [], brackets: [] };
  await seed(page, { events: [empty] });
  await openFixedEvent(page, empty.id);
  await expect(page.getByRole('button', { name: 'Seed pools', exact: true })).toBeDisabled();
  await expect(page.getByText('Add at least two teams before seeding pools.', { exact: true })).toBeVisible();
});
