import { test, expect } from '@playwright/test';

const seedHistoryWarning = "Changing this starting level will recalculate this player's full rating history from their new baseline. Continue?";

async function replayState(page, gameId) {
  return page.evaluate(id => {
    const g = games.find(game => game.id === id);
    return {
      game: {
        deltas: g?.deltas,
        winProb: g?.winProb,
        predCorrect: g?.predCorrect
      },
      players: players.map(p => ({
        id: p.id,
        rating: p.rating,
        gamesPlayed: p.gamesPlayed,
        wins: p.wins,
        losses: p.losses,
        history: p.history
      }))
    };
  }, gameId);
}

function expectReplayedGame(state, playerIds) {
  expect(Object.keys(state.game.deltas || {}).sort()).toEqual(playerIds.slice().sort());
  for (const id of playerIds) {
    expect(state.game.deltas[id]).toMatchObject({
      before: expect.any(Number),
      after: expect.any(Number),
      elo: expect.any(Number),
      ev: expect.any(Number)
    });
  }
  expect(Number.isFinite(state.game.winProb)).toBe(true);
  expect([true, false, null]).toContain(state.game.predCorrect);
}

test('app boots and built-in self-test passes', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Court/);
  await expect(page.getByRole('heading', { name: /Roster/i })).toBeVisible();

  await page.getByRole('button', { name: /More/i }).click();
  await page.getByRole('button', { name: /Run self-test/i }).click();

  await expect(page.getByText(/Self-test · \d+\/\d+ passed/i)).toBeVisible();
});

test('volleyball level helper maps rating bands', async ({ page }) => {
  await page.goto('/');

  const labels = await page.evaluate(() =>
    [0, 24, 25, 39, 40, 59, 60, 74, 75, 89, 90, 100].map(r => volleyballLevelOf(r).label)
  );
  expect(labels).toEqual([
    'Rec', 'Rec',
    'C', 'C',
    'B', 'B',
    'BB', 'BB',
    'A', 'A',
    'AA/Open', 'AA/Open'
  ]);

  const level = await page.evaluate(() => volleyballLevelOf(60));
  expect(level).toMatchObject({
    key: 'bb',
    label: 'BB',
    short: 'Solid',
    overall: 'Solid player. Can contribute to structured volleyball and three-contact rallies.',
    anchors: {
      serving: expect.any(String),
      passing: expect.any(String),
      setting: expect.any(String),
      attacking: expect.any(String),
      defense: expect.any(String),
      iqCommunication: expect.any(String)
    }
  });
});

test('can add a player and persist after reload', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '+ Add player', exact: true }).click();
  await page.getByPlaceholder('Player name').fill('Test Player');
  await page.getByRole('button', { name: /B\s+Functional/i }).click();

  await page
    .locator('.sheet')
    .getByRole('button', { name: 'Add player', exact: true })
    .click();

  await expect(page.getByText('Test Player')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Test Player')).toBeVisible();
});

test('starting level buttons use volleyball placement labels and seeds', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '+ Add player', exact: true }).click();

  const startingLevels = await page.locator('.sheet .tiergrid button').evaluateAll(buttons =>
    buttons.map(button => ({
      label: button.childNodes[0].textContent.trim(),
      description: button.querySelector('.o2').textContent.trim(),
      seed: Number(button.getAttribute('onclick').match(/\d+/)[0])
    }))
  );

  expect(startingLevels).toEqual([
    { label: 'Rec', description: 'Learning / casual', seed: 20 },
    { label: 'C', description: 'Basic rec', seed: 32 },
    { label: 'B', description: 'Functional', seed: 48 },
    { label: 'BB', description: 'Solid', seed: 66 },
    { label: 'A', description: 'Strong', seed: 82 },
    { label: 'AA/Open', description: 'Elite', seed: 93 }
  ]);
  await expect(page.locator('.sheet .tiergrid').getByText(/Beginner|Novice|Recreational|Intermediate|Advanced|College/)).toHaveCount(0);
});

test('add player sheet has cancel button that closes without saving', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '+ Add player', exact: true }).click();
  await page.getByPlaceholder('Player name').fill('Cancel Draft');

  await expect(page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.getByText('Cancel Draft')).toHaveCount(0);
});

test('edit player cancel closes and discards draft changes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'cancel-edit', name: 'Cancel Original', seedRating: 48, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');

  await page.getByText('Cancel Original').click();
  await page.getByPlaceholder('Player name').fill('Cancel Changed');
  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.getByText('Cancel Original')).toBeVisible();
  await expect(page.getByText('Cancel Changed')).toHaveCount(0);

  const savedName = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).find(p => p.id === 'cancel-edit').name
  );
  expect(savedName).toBe('Cancel Original');
});

test('starting level guide opens and returns to the player draft', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '+ Add player', exact: true }).click();
  await page.getByPlaceholder('Player name').fill('Guide Draft');

  await page
    .locator('.sheet .field')
    .filter({ hasText: 'Starting level' })
    .getByRole('button', { name: /Help me choose/i })
    .click();

  await expect(page.getByRole('heading', { name: 'Starting level guide' })).toBeVisible();
  await expect(page.getByText('Court Level is a practical estimate, not an official universal certification.')).toBeVisible();
  await expect(page.locator('.sheet').getByText('AA/Open')).toBeVisible();
  await expect(page.locator('.sheet').getByText('Weapon serve, pressure with low error rate.')).toBeVisible();

  await page.locator('.sheet').getByRole('button', { name: 'Back to player', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Add player' })).toBeVisible();
  await expect(page.getByPlaceholder('Player name')).toHaveValue('Guide Draft');
});

test('shows volleyball level on roster and player details when ratings are visible', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'level-visible', name: 'Level Visible', seedRating: 62, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
  });

  await page.goto('/');

  const card = page.locator('.plist .card').filter({ hasText: 'Level Visible' });
  await expect(card.getByText(/BB/)).toBeVisible();

  await page.getByText('Level Visible').click();
  const summary = page.locator('.sheet .card').filter({ hasText: 'Court Level' });
  await expect(summary.getByText('Court Level')).toBeVisible();
  await expect(summary.getByText('BB', { exact: true })).toBeVisible();
});

test('hides volleyball level when hide ratings is on', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'level-hidden', name: 'Level Hidden', seedRating: 92, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: true }));
  });

  await page.goto('/');

  const card = page.locator('.plist .card').filter({ hasText: 'Level Hidden' });
  await expect(card.getByText('AA/Open')).toHaveCount(0);

  await page.getByText('Level Hidden').click();
  const summary = page.locator('.sheet .card').filter({ hasText: 'Current rating' });
  await expect(summary.getByText('Court Level')).toHaveCount(0);
  await expect(summary.getByText('AA/Open')).toHaveCount(0);
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

  const migrationStates = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).map(({ name, active, archived }) => ({ name, active, archived }))
  );
  expect(migrationStates).toContainEqual({ name: 'Old Import', active: true, archived: false });
  expect(migrationStates).toContainEqual({ name: 'Away Import', active: false, archived: false });

  await page.getByRole('button', { name: /Teams/i }).click();
  await expect(page.getByRole('button', { name: /Old Import/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Away Import/i })).toHaveCount(0);

  await page.getByRole('button', { name: /Track/i }).click();
  await expect(page.getByRole('button', { name: /Old Import/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Away Import/i })).toHaveCount(0);
});

test('restore from backup paste keeps players, game history, and replay details after reload', async ({ page }) => {
  const backup = {
    v: 1,
    players: [
      { id: 'restore-a', name: 'Restore Alpha', seedRating: 70 },
      { id: 'restore-b', name: 'Restore Beta', seedRating: 45 }
    ],
    games: [
      {
        id: 'restore-game',
        date: 1710000000000,
        teamA: ['restore-a'],
        teamB: ['restore-b'],
        scoreA: 25,
        scoreB: 19,
        winner: 'A',
        log: {
          'restore-a': { kill: 2, ace: 1 },
          'restore-b': { dig: 1, serr: 1 }
        }
      }
    ],
    settings: { hideRatings: false }
  };

  await page.goto('/');
  await page.getByRole('button', { name: /More/i }).click();
  await page.getByRole('button', { name: /Restore from backup/i }).click();
  await page.locator('#impTxt').fill(JSON.stringify(backup));
  await page.locator('.sheet').getByRole('button', { name: 'Restore from paste', exact: true }).click();

  await page.getByRole('button', { name: /Players/i }).click();
  await expect(page.getByText('Restore Alpha')).toBeVisible();
  await expect(page.getByText('Restore Beta')).toBeVisible();

  await page.getByRole('button', { name: /Games/i }).click();
  await expect(page.locator('.ghist').filter({ hasText: 'Restore Alpha' })).toBeVisible();

  const beforeReload = await replayState(page, 'restore-game');
  expectReplayedGame(beforeReload, ['restore-a', 'restore-b']);

  await page.reload();
  await expect(page.getByText('Restore Alpha')).toBeVisible();

  const afterReload = await replayState(page, 'restore-game');
  expectReplayedGame(afterReload, ['restore-a', 'restore-b']);
  expect(afterReload).toEqual(beforeReload);

  await page.getByRole('button', { name: /Games/i }).click();
  await page.locator('.ghist').filter({ hasText: 'Restore Alpha' }).click();
  await expect(page.locator('.sheet').getByText('Restore Alpha')).toBeVisible();
  await expect(page.locator('.sheet').getByText(/result/).first()).toBeVisible();
});

test('raw stored games without derived fields replay into usable game details', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'raw-a', name: 'Raw Alpha', seedRating: 82, active: true, archived: false },
      { id: 'raw-b', name: 'Raw Beta', seedRating: 38, active: true, archived: false },
      { id: 'raw-c', name: 'Raw Gamma', seedRating: 58, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', JSON.stringify([
      {
        id: 'raw-game',
        date: 1710000000000,
        teamA: ['raw-a', 'raw-c'],
        teamB: ['raw-b'],
        scoreA: 25,
        scoreB: 15,
        winner: 'A',
        log: {
          'raw-a': { ace: 1, kill: 3 },
          'raw-b': { perr: 1 },
          'raw-c': { dig: 2 }
        }
      }
    ]));
  });

  await page.goto('/');
  await expect(page.getByText('Raw Alpha')).toBeVisible();

  const state = await replayState(page, 'raw-game');
  expectReplayedGame(state, ['raw-a', 'raw-b', 'raw-c']);
  expect(state.players.find(p => p.id === 'raw-a')).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0 });
  expect(state.players.find(p => p.id === 'raw-b')).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 });

  await page.getByRole('button', { name: /Games/i }).click();
  await page.locator('.ghist').filter({ hasText: 'Raw Alpha' }).click();
  await expect(page.locator('.sheet').getByText('Raw Alpha')).toBeVisible();
  await expect(page.locator('.sheet').getByText('Raw Gamma')).toBeVisible();
  await expect(page.locator('.sheet').getByText(/result/).first()).toBeVisible();
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
  await page.locator('.sheet').getByRole('button', { name: /A\s+Strong/i }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(page.getByText(seedHistoryWarning)).toBeVisible();
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
  expect(afterConfirm).toBe(82);
});

test('editing an unplayed player seed saves without rating-history warning', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'fresh-seed', name: 'Fresh Seed', seedRating: 43, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');

  await page.getByText('Fresh Seed').click();
  await page.locator('.sheet').getByRole('button', { name: /A\s+Strong/i }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(page.getByText(seedHistoryWarning)).toHaveCount(0);

  const savedSeed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).find(p => p.id === 'fresh-seed').seedRating
  );
  expect(savedSeed).toBe(82);
});

test('deleting a historical player archives and hides them from active flows', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('vb:players')) return;

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

  await page.reload();

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
  await page.getByText(/Historic Player, Active Teammate/).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: /Game · 25–20/i })).toBeVisible();
  await expect(page.locator('.sheet').getByText('Historic Player')).toBeVisible();
});
