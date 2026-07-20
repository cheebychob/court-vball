import { test, expect } from '@playwright/test';

const cardPlayers = [
  {
    id: 'card-stats',
    name: 'Card Stats',
    seedRating: 60,
    active: true,
    archived: false,
    roles: { passer: true }
  },
  { id: 'card-peer-a', name: 'Card Peer A', seedRating: 55, active: true, archived: false },
  { id: 'card-peer-b', name: 'Card Peer B', seedRating: 50, active: true, archived: false },
  { id: 'card-fresh', name: 'Card Fresh', seedRating: 72, active: true, archived: false },
  {
    id: 'card-hidden',
    name: 'Card Hidden',
    seedRating: 61,
    active: true,
    archived: false,
    skills: { serving: 1, passing: 2, setting: 3, hitting: 4, defense: 5, iq: 5 }
  }
];

const cardGames = [
  {
    id: 'card-game-1',
    date: 1,
    teamA: ['card-stats'],
    teamB: ['card-peer-a'],
    scoreA: 25,
    scoreB: 20,
    winner: 'A',
    detailed: true,
    ratingVersion: 2,
    log: {
      'card-stats': { goodPass: 3, pget: 1, perr: 1, ace: 1, sin: 3, serr: 1, kill: 3, dig: 2, block: 1 },
      'card-peer-a': { goodPass: 2, perr: 1, dig: 2 }
    }
  },
  {
    id: 'card-game-2',
    date: 2,
    teamA: ['card-stats'],
    teamB: ['card-peer-b'],
    scoreA: 25,
    scoreB: 18,
    winner: 'A',
    detailed: true,
    ratingVersion: 2,
    log: {
      'card-stats': { goodPass: 3, pget: 1, perr: 1, ace: 1, sin: 3, serr: 1, kill: 2, kerr: 1, dig: 4, block: 1 },
      'card-peer-b': { sin: 3, serr: 1, dig: 1 }
    }
  },
  {
    id: 'card-peer-game',
    date: 3,
    teamA: ['card-peer-a'],
    teamB: ['card-peer-b'],
    scoreA: 21,
    scoreB: 25,
    winner: 'B',
    detailed: true,
    ratingVersion: 2,
    log: {
      'card-peer-a': { sin: 2, serr: 1, dig: 1 },
      'card-peer-b': { goodPass: 2, pget: 1, dig: 2 }
    }
  }
];

async function seedCardData(page, hideRatings = false) {
  await page.addInitScript(({ players, games, hideRatings }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings }));
  }, {
    players: cardPlayers.map(player => ({ ...player })),
    games: cardGames.map(game => ({ ...game })),
    hideRatings
  });
}

async function clickNav(page, name) {
  if (name === 'Games' || name === 'More') {
    await page.getByRole('button', { name: 'Open more menu', exact: true }).click();
    await page.locator('.sheet').getByRole('button', { name: name === 'Games' ? 'History' : 'Settings', exact: true }).click();
    return;
  }
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name, exact: true })
    .click();
}

async function openPlayerProfile(page, name) {
  await clickNav(page, 'Players');
  await page.locator('.player-card').filter({ hasText: name }).first().click();
  await expect(page.locator('.sheet').getByRole('heading', { name, exact: true })).toBeVisible();
}

async function openProfileCard(page) {
  await page
    .locator('.sheet')
    .getByRole('button', { name: /View & share player card/i })
    .click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Player card', exact: true })).toBeVisible();
}

test('demo player card renders a non-blank 1080x1500 image', async ({ page }) => {
  await page.goto('/');
  await clickNav(page, 'More');
  await page.getByRole('button', { name: 'Load demo season', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Load demo', exact: true }).click();

  const demoPlayer = await page.evaluate(() => {
    const player = players.find(p => p.gamesPlayed > 0 && eventTotal(p) > 0);
    return player ? { id: player.id, name: player.name } : null;
  });
  expect(demoPlayer).not.toBeNull();

  await page.locator('.player-card').filter({ hasText: demoPlayer.name }).first().click();
  await openProfileCard(page);

  const canvas = page.locator('#cardCanvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('width', '1080');
  await expect(canvas).toHaveAttribute('height', '1500');

  const image = await canvas.evaluate(element => {
    const ctx = element.getContext('2d');
    const colors = new Set();
    for (let y = 20; y < element.height; y += 120) {
      for (let x = 20; x < element.width; x += 120) {
        colors.add(Array.from(ctx.getImageData(x, y, 1, 1).data).join(','));
      }
    }
    const dataUrl = element.toDataURL('image/png');
    return { dataUrlPrefix: dataUrl.slice(0, 22), dataUrlLength: dataUrl.length, colorCount: colors.size };
  });
  expect(image.dataUrlPrefix).toBe('data:image/png;base64,');
  expect(image.dataUrlLength).toBeGreaterThan(10000);
  expect(image.colorCount).toBeGreaterThan(1);
});

test('profile data reports real stats and honest empty-state values', async ({ page }) => {
  await seedCardData(page);
  await page.goto('/');

  const data = await page.evaluate(() => {
    const stats = profileCardData(pById('card-stats'));
    const fresh = profileCardData(pById('card-fresh'));
    return {
      stats: Object.fromEntries(stats.stats),
      freshStats: fresh.stats,
      freshStrengths: fresh.strengths || 'Log more events',
      freshWorkOn: fresh.workOn || 'Log more events'
    };
  });

  expect(data.stats).toMatchObject({
    'Passer rating': '2.00 (2 games)',
    'Hit efficiency': '.667',
    'Serve in': '80% (2 games)',
    'Ace rate': '20% (2 games)',
    'Digs / game': '3.0',
    'Blocks / game': '1.0'
  });
  expect(data.freshStats).toHaveLength(6);
  expect(data.freshStats.every(([, value]) => value === '—')).toBe(true);
  expect(data.freshStrengths).toBe('Log more events');
  expect(data.freshWorkOn).toBe('Log more events');
});

test('radar axes and passer rating preserve their invariants', async ({ page }) => {
  await seedCardData(page);
  await page.goto('/');

  const result = await page.evaluate(() => {
    const player = pById('card-stats');
    const axes = radarAxes(player);
    const fresh = pById('card-fresh');
    const freshAxes = radarAxes(fresh);
    return {
      axes,
      freshRating: fresh.rating,
      freshAxes,
      passer: passerRating(player),
      noPasses: passerRating(fresh)
    };
  });

  expect(result.axes).toHaveLength(6);
  expect(result.axes.every(axis => axis.value >= 0 && axis.value <= 100)).toBe(true);
  expect(result.axes.find(axis => axis.key === 'iq').w).toBe(0);
  expect(result.freshAxes).toHaveLength(6);
  expect(result.freshAxes.every(axis => axis.value === result.freshRating)).toBe(true);
  expect(result.passer).toEqual({ value: 2, n: 10, games: 2 });
  expect(result.noPasses).toEqual({ value: null, n: 0, games: 0 });
});

test('hidden ratings remove the level and raw rating from card JSON', async ({ page }) => {
  await seedCardData(page, true);
  await page.goto('/');

  const hidden = await page.evaluate(() => {
    const player = pById('card-hidden');
    const data = profileCardData(player);
    return { level: data.level, rating: String(Math.round(player.rating)), json: JSON.stringify(data) };
  });

  expect(hidden.level).toBeNull();
  expect(hidden.json).not.toContain(hidden.rating);
});

test('share falls back to a download and shows a toast', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
  await seedCardData(page);
  await page.goto('/');
  await openPlayerProfile(page, 'Card Stats');
  await openProfileCard(page);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.sheet').getByRole('button', { name: 'Save / share image', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('Card_Stats_court_card.png');
  await expect(page.locator('#toast')).toHaveText('Card image saved');
  await expect(page.locator('#toast')).toHaveClass(/show/);
});

test('Back returns from the share card to the read-only profile across repeated opens', async ({ page }) => {
  await seedCardData(page);
  await page.goto('/');
  await openPlayerProfile(page, 'Card Stats');

  await openProfileCard(page);
  await page.locator('.sheet').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Card Stats', exact: true })).toBeVisible();

  await openProfileCard(page);
  expect(await page.evaluate(() => ({ mode: playerWindowMode, draft }))).toEqual({ mode: 'profile', draft: null });
  await page.locator('.sheet').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Card Stats', exact: true })).toBeVisible();
});

test('correcting and deleting games updates the next derived card', async ({ page }) => {
  await seedCardData(page);
  await page.goto('/');

  const initial = await page.evaluate(() => profileCardData(pById('card-stats')));
  await page.evaluate(async () => {
    games.find(game => game.id === 'card-game-1').log['card-stats'].goodPass = 0;
    await commit();
  });
  await openPlayerProfile(page, 'Card Stats');
  await openProfileCard(page);
  const corrected = await page.evaluate(() => profileCardData(pById('card-stats')));
  expect(corrected).not.toEqual(initial);
  expect(Object.fromEntries(corrected.stats)['Passer rating']).toBe('1.57 (2 games)');

  await page.locator('.sheet').getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await clickNav(page, 'Games');
  await page.locator('.history-row').filter({ hasText: '25 – 18' }).first().click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete game', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Delete game', exact: true }).click();

  await openPlayerProfile(page, 'Card Stats');
  await openProfileCard(page);
  const afterDelete = await page.evaluate(() => ({
    data: profileCardData(pById('card-stats')),
    storedCardKeys: Object.keys(localStorage).filter(key => /card|profile/i.test(key)),
    playerCardFields: Object.keys(pById('card-stats')).filter(key => /card|profile/i.test(key))
  }));
  expect(afterDelete.data).not.toEqual(corrected);
  expect(afterDelete.data.footer).toBe('1 game');
  expect(afterDelete.storedCardKeys).toEqual([]);
  expect(afterDelete.playerCardFields).toEqual([]);
});
