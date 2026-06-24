import { test, expect } from '@playwright/test';

test('app boots and built-in self-test passes', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Court/);
  await expect(page.getByRole('heading', { name: /Roster/i })).toBeVisible();

  await page.getByRole('button', { name: /More/i }).click();
  await page.getByRole('button', { name: /Run self-test/i }).click();

  await expect(page.getByText(/Self-test · \d+\/\d+ passed/i)).toBeVisible();
});

test('can add a player and persist after reload', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '+ Add player', exact: true }).click();
  await page.getByPlaceholder('Player name').fill('Test Player');
  await page.getByRole('button', { name: /Intermediate/i }).click();

  await page
    .locator('.sheet')
    .getByRole('button', { name: 'Add player', exact: true })
    .click();

  await expect(page.getByText('Test Player')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Test Player')).toBeVisible();
});

test('migrates old imported players with missing active to active', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'old-import', name: 'Old Import', seedRating: 43 },
      { id: 'away-import', name: 'Away Import', seedRating: 43, active: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');

  const activeStates = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).map(({ name, active }) => ({ name, active }))
  );
  expect(activeStates).toContainEqual({ name: 'Old Import', active: true });
  expect(activeStates).toContainEqual({ name: 'Away Import', active: false });

  await page.getByRole('button', { name: /Teams/i }).click();
  await expect(page.getByRole('button', { name: /Old Import/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Away Import/i })).toHaveCount(0);
});

test('generated teams exclude inactive players left in the pool', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'active-a', name: 'Active A', seedRating: 60, active: true },
      { id: 'active-b', name: 'Active B', seedRating: 50, active: true },
      { id: 'inactive-c', name: 'Inactive C', seedRating: 90, active: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Roster/i })).toBeVisible();

  const generatedNames = await page.evaluate(() => {
    window._pool = new Set(['active-a', 'active-b', 'inactive-c']);
    window.genTeams();
    return window._teams.flat().map(p => p.name);
  });

  expect(generatedNames).toEqual(expect.arrayContaining(['Active A', 'Active B']));
  expect(generatedNames).not.toContain('Inactive C');
});

test('deleting an unplayed player hard-deletes them', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'unused-player', name: 'Unused Player', seedRating: 43, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');

  await page.getByText('Unused Player').click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete player', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Delete player', exact: true }).click();

  const savedPlayers = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:players')));
  expect(savedPlayers.map(p => p.id)).not.toContain('unused-player');
  await expect(page.getByText('Unused Player')).toHaveCount(0);
});

test('editing a historical player seed asks before rewriting rating history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'seed-player', name: 'Seed Player', seedRating: 43, active: true, archived: false },
      { id: 'seed-opponent', name: 'Seed Opponent', seedRating: 50, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', JSON.stringify([
      {
        id: 'seed-game',
        date: 1,
        teamA: ['seed-player'],
        teamB: ['seed-opponent'],
        scoreA: 25,
        scoreB: 20,
        winner: 'A',
        log: {}
      }
    ]));
  });

  await page.goto('/');

  await page.getByText('Seed Player').click();
  await page.locator('.sheet').getByRole('button', { name: /Advanced/i }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(page.getByText("Changing this starting level will recalculate this player's full rating history from their new baseline. Continue?")).toBeVisible();
  await page.locator('.scrim').last().getByRole('button', { name: 'Cancel', exact: true }).click();

  const afterCancel = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).find(p => p.id === 'seed-player').seedRating
  );
  expect(afterCancel).toBe(43);

  await page.locator('.sheet').getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Continue', exact: true }).click();

  const afterConfirm = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).find(p => p.id === 'seed-player').seedRating
  );
  expect(afterConfirm).toBe(73);
});

test('deleting a historical player archives and hides them from active flows', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'historic-player', name: 'Historic Player', seedRating: 60, active: true, archived: false },
      { id: 'active-teammate', name: 'Active Teammate', seedRating: 55, active: true, archived: false },
      { id: 'active-opponent', name: 'Active Opponent', seedRating: 50, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', JSON.stringify([
      {
        id: 'historic-game',
        date: 1,
        teamA: ['historic-player', 'active-teammate'],
        teamB: ['active-opponent'],
        scoreA: 25,
        scoreB: 20,
        winner: 'A',
        log: { 'historic-player': { kill: 2 } }
      }
    ]));
  });

  await page.goto('/');

  const before = await page.evaluate(() => {
    recomputeAll();
    const g = games.find(game => game.id === 'historic-game');
    return { deltas: JSON.stringify(g.deltas), ratings: players.map(p => p.rating) };
  });

  await page.getByText('Historic Player').click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete player', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Archive player', exact: true }).click();

  const after = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('vb:players'));
    const archived = saved.find(p => p.id === 'historic-player');
    const g = games.find(game => game.id === 'historic-game');
    return {
      archived,
      deltas: JSON.stringify(g.deltas),
      ratings: players.map(p => p.rating)
    };
  });

  expect(after.archived).toMatchObject({ id: 'historic-player', active: false, archived: true });
  expect(after.deltas).toBe(before.deltas);
  expect(after.ratings).toEqual(before.ratings);

  await expect(page.getByText('Historic Player')).toHaveCount(0);

  await page.getByRole('button', { name: /Track/i }).click();
  await expect(page.getByRole('button', { name: /Historic Player/i })).toHaveCount(0);

  await page.getByRole('button', { name: /Teams/i }).click();
  await expect(page.getByRole('button', { name: /Historic Player/i })).toHaveCount(0);

  const generatedNames = await page.evaluate(() => {
    window._pool = new Set(['historic-player', 'active-teammate', 'active-opponent']);
    window.genTeams();
    return window._teams.flat().map(p => p.name);
  });
  expect(generatedNames).not.toContain('Historic Player');

  await page.getByRole('button', { name: /Games/i }).click();
  await expect(page.getByText(/Historic Player, Active Teammate/)).toBeVisible();
});
