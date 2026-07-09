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

const trackingRoster = [
  { id: 'solo-alpha', name: 'Solo Alpha', seedRating: 60, active: true, archived: false },
  { id: 'match-alpha', name: 'Match Alpha', seedRating: 58, active: true, archived: false },
  { id: 'match-beta', name: 'Match Beta', seedRating: 52, active: true, archived: false }
];

async function seedCourt(page, { players: seededPlayers, games: seededGames = [], settings: seededSettings = { hideRatings: false } }) {
  await page.addInitScript(({ seededPlayers, seededGames, seededSettings }) => {
    localStorage.setItem('vb:players', JSON.stringify(seededPlayers));
    localStorage.setItem('vb:games', JSON.stringify(seededGames));
    localStorage.setItem('vb:settings', JSON.stringify(seededSettings));
  }, { seededPlayers, seededGames, seededSettings });
}

async function seedTrackingRoster(page) {
  await seedCourt(page, { players: trackingRoster.map(p => ({ ...p })) });
}

async function clickNav(page, name) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name, exact: true })
    .click();
}

async function expectScreenLabel(page, label) {
  await expect(page.locator('main .screen-head .eyebrow')).toHaveText(label);
}

async function goToPlayers(page) {
  await clickNav(page, 'Players');
  await expectScreenLabel(page, 'Roster');
}

async function goToTrack(page) {
  await clickNav(page, 'Track');
  await expectScreenLabel(page, 'Track');
}

async function goToTeams(page) {
  await clickNav(page, 'Teams');
  await expectScreenLabel(page, 'Teams');
}

async function goToGames(page) {
  await clickNav(page, 'Games');
  await expectScreenLabel(page, 'History');
}

async function goToMore(page) {
  await clickNav(page, 'More');
  await expectScreenLabel(page, 'More');
}

async function openAddPlayer(page) {
  await goToPlayers(page);
  await page.locator('main').getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Add player', exact: true })).toBeVisible();
}

function playerCard(page, name) {
  return page.locator('.player-card').filter({ hasText: name }).first();
}

function gameHistoryRow(page, text) {
  return page.locator('.history-row').filter({ hasText: text }).first();
}

function trackCard(page, name) {
  return page.locator('.tcard').filter({ hasText: name }).first();
}

async function currentLive(page) {
  return page.evaluate(() => live ? JSON.parse(JSON.stringify(live)) : null);
}

async function gameCounts(page) {
  return page.evaluate(() => ({
    memory: games.length,
    stored: JSON.parse(localStorage.getItem('vb:games') || '[]').length
  }));
}

async function startSoloTracking(page) {
  await page.goto('/');
  await goToTrack(page);
  await page.locator('main .mode-btn').filter({ hasText: 'Scout / Solo' }).click();
  await page.locator('main .chip').filter({ hasText: 'Solo Alpha' }).click();
  await page.getByRole('button', { name: 'Start solo tracking', exact: true }).click();
  await expectScreenLabel(page, 'Scout / Solo');
  await expect(page.getByRole('heading', { name: 'Solo Alpha', exact: true })).toBeVisible();
}

async function startMatchTracking(page) {
  await page.goto('/');
  await goToTrack(page);
  await page.locator('main .mode-btn').filter({ hasText: 'Match' }).click();
  await page.locator('main .chip').filter({ hasText: 'Match Alpha' }).click();
  await page.locator('main .chip').filter({ hasText: 'Match Beta' }).click();
  await page.locator('main .chip').filter({ hasText: 'Match Beta' }).click();
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Track this game', exact: true })).toBeVisible();
}

async function logSoloAce(page) {
  const playerRow = trackCard(page, 'Solo Alpha');
  await playerRow.getByRole('button', { name: 'Ace', exact: true }).click();
  await expect(playerRow.locator('.cnt')).toHaveText('1');
}

async function openDiscardConfirm(page) {
  await page.locator('main').getByRole('button', { name: 'Discard', exact: true }).click();
  const confirm = page.locator('.scrim').last();
  await expect(confirm.getByText('Discard this game without saving?')).toBeVisible();
  return confirm;
}

test('app boots and built-in self-test passes', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Court/);
  await expect(page.getByRole('heading', { name: 'Set up your gym.', exact: true })).toBeVisible();
  await goToPlayers(page);
  await expectScreenLabel(page, 'Roster');

  await goToMore(page);
  await page.getByRole('button', { name: 'Run self-test', exact: true }).click();

  await expect(page.getByText(/Self-test · \d+\/\d+ passed/i)).toBeVisible();
  await expect(page.getByText('Everything checks out.')).toBeVisible();
});

test('event schedule spreads fewer pools across available courts', async ({ page }) => {
  const teams = Array.from({ length: 24 }, (_, i) => ({
    id: `sched-team-${i}`,
    name: `Schedule Team ${i + 1}`,
    pool: ['A', 'B', 'C'][Math.floor(i / 8)],
    players: []
  }));

  await page.addInitScript(({ teams }) => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    Date.now = () => now.getTime();
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
    localStorage.setItem('vb:events', JSON.stringify([{
      id: 'schedule-ui',
      name: 'Schedule UI Cup',
      created: 1,
      done: false,
      teams,
      sched: { start: '10:00', courts: 8, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 },
      brackets: []
    }]));
  }, { teams });

  await page.goto('/');

  const schedule = await page.evaluate(() => {
    const noDouble = sc => sc.slots.every(slot => {
      const used = new Set();
      return slot.every(match => {
        if (used.has(match.a) || used.has(match.b)) return false;
        used.add(match.a);
        used.add(match.b);
        return true;
      });
    });
    const sc8 = buildSchedule(evts[0]);
    const sc12 = buildSchedule({
      ...evts[0],
      id: 'schedule-ui-12',
      sched: { ...evts[0].sched, courts: 12 }
    });
    return {
      eight: {
        courts: sc8.courts.length,
        firstSlot: sc8.slots[0].length,
        noDouble: noDouble(sc8),
        allHavePool: sc8.slots.flat().every(match => match.pool)
      },
      twelve: {
        courts: sc12.courts.length,
        firstSlot: sc12.slots[0].length,
        noDouble: noDouble(sc12),
        allHavePool: sc12.slots.flat().every(match => match.pool)
      }
    };
  });

  expect(schedule.eight).toMatchObject({
    firstSlot: 8,
    noDouble: true,
    allHavePool: true
  });
  expect(schedule.eight.courts).toBeGreaterThan(3);
  expect(schedule.twelve).toMatchObject({
    courts: 12,
    firstSlot: 12,
    noDouble: true,
    allHavePool: true
  });

  await clickNav(page, 'Events');
  await page.locator('.ev-row').filter({ hasText: 'Schedule UI Cup' }).click();
  const scheduleCard = page.locator('.card').filter({
    has: page.locator('.stat-title', { hasText: /^Schedule$/ })
  }).first();
  await expect(scheduleCard.getByText('Planned from 10:00 AM.')).toBeVisible();
  await expect(scheduleCard.getByText('Court 8')).toBeVisible();
  await expect(scheduleCard.getByText('Pool A').first()).toBeVisible();
  await expect(scheduleCard.getByText('Pool B').first()).toBeVisible();
});

test('event schedule explains live time adjustments', async ({ page }) => {
  const teams = Array.from({ length: 4 }, (_, i) => ({
    id: `time-team-${i}`,
    name: `Time Team ${i + 1}`,
    pool: 'A',
    players: []
  }));

  await page.addInitScript(({ teams }) => {
    const now = new Date();
    now.setHours(11, 10, 0, 0);
    Date.now = () => now.getTime();
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', JSON.stringify([{
      id: 'progress-game',
      date: 1,
      teamA: [],
      teamB: [],
      scoreA: 21,
      scoreB: 15,
      winner: 'A',
      log: {},
      evId: 'progress-event',
      evA: 'time-team-0',
      evB: 'time-team-3'
    }]));
    localStorage.setItem('vb:events', JSON.stringify([
      {
        id: 'passed-event',
        name: 'Passed Start Cup',
        created: 2,
        done: false,
        teams,
        sched: { start: '10:00', courts: 4, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 },
        brackets: []
      },
      {
        id: 'progress-event',
        name: 'Progress Cup',
        created: 1,
        done: false,
        teams,
        sched: { start: '10:00', courts: 4, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 },
        brackets: []
      }
    ]));
  }, { teams });

  await page.goto('/');
  await clickNav(page, 'Events');

  await page.locator('.ev-row').filter({ hasText: 'Passed Start Cup' }).click();
  await expect(page.getByText('Live-adjusted from now because the 10:00 AM start time has passed.')).toBeVisible();

  await page.getByRole('button', { name: '‹ All events', exact: true }).click();
  await page.locator('.ev-row').filter({ hasText: 'Progress Cup' }).click();
  await expect(page.getByText('Live-adjusted from current progress.')).toBeVisible();
});

test('event schedule clamps extreme custom court saves', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify([{
      id: 'extreme-courts',
      name: 'Extreme Courts Cup',
      created: 1,
      done: false,
      teams: [
        { id: 'extreme-a', name: 'Extreme A', pool: 'A', players: [] },
        { id: 'extreme-b', name: 'Extreme B', pool: 'A', players: [] }
      ],
      sched: { start: '10:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 },
      brackets: []
    }]));
  });

  await page.goto('/');
  await clickNav(page, 'Events');
  await page.locator('.ev-row').filter({ hasText: 'Extreme Courts Cup' }).click();
  await page.getByRole('button', { name: 'Courts & schedule', exact: true }).click();
  await page.locator('#evsCourts').fill('1000000000');
  await page.locator('.sheet').getByRole('button', { name: 'Save schedule', exact: true }).click();

  const saved = await page.evaluate(() => {
    const ev = evts.find(event => event.id === 'extreme-courts');
    const sc = buildSchedule(ev);
    return {
      persistedCourts: ev.sched.courts,
      requestedCourts: sc.requestedCourts,
      effectiveCourts: sc.effectiveCourts,
      renderedCourts: sc.courts.length,
      firstSlot: sc.slots[0].length
    };
  });
  expect(saved).toEqual({
    persistedCourts: 64,
    requestedCourts: 64,
    effectiveCourts: 1,
    renderedCourts: 1,
    firstSlot: 1
  });
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

  await openAddPlayer(page);
  await page.getByPlaceholder('Player name').fill('Test Player');
  await page.getByRole('button', { name: /B\s+Functional/i }).click();

  await page
    .locator('.sheet')
    .getByRole('button', { name: 'Add player', exact: true })
    .click();

  await expect(page.getByText('Test Player')).toBeVisible();

  await page.reload();
  await goToPlayers(page);

  await expect(page.getByText('Test Player')).toBeVisible();
});

test('starting level buttons use volleyball placement labels and seeds', async ({ page }) => {
  await page.goto('/');

  await openAddPlayer(page);

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

  await openAddPlayer(page);
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

  await goToPlayers(page);
  await playerCard(page, 'Cancel Original').click();
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

  await openAddPlayer(page);
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

  await goToPlayers(page);
  const card = playerCard(page, 'Level Visible');
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

  await goToPlayers(page);
  const card = playerCard(page, 'Level Hidden');
  await expect(card.getByText('AA/Open')).toHaveCount(0);

  await page.getByText('Level Hidden').click();
  const summary = page.locator('.sheet .card').filter({ hasText: 'Current rating' });
  await expect(summary.getByText('Court Level')).toHaveCount(0);
  await expect(summary.getByText('AA/Open')).toHaveCount(0);
});

test('player detail sheet groups lifetime stats with readable labels and still saves', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'stats-player', name: 'Stats Alpha', seedRating: 60, active: true, archived: false },
      { id: 'stats-opponent', name: 'Stats Opponent', seedRating: 50, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', JSON.stringify([
      {
        id: 'stats-game',
        date: 1,
        teamA: ['stats-player'],
        teamB: ['stats-opponent'],
        scoreA: 25,
        scoreB: 20,
        winner: 'A',
        log: {
          'stats-player': {
            ace: 2,
            sin: 4,
            serr: 1,
            goodPass: 3,
            pget: 2,
            perr: 1,
            kill: 5,
            kerr: 1,
            block: 2,
            dig: 3,
            assist: 1
          },
          'stats-opponent': { dig: 1 }
        }
      }
    ]));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
  });

  await page.goto('/');
  await goToPlayers(page);
  await playerCard(page, 'Stats Alpha').click();

  const sheet = page.locator('.sheet');
  const stats = sheet.locator('.stat-card');
  await expect(stats.getByText('Stats', { exact: true })).toBeVisible();
  await expect(stats.getByText('Serve', { exact: true })).toBeVisible();
  await expect(stats.getByText('Receive', { exact: true })).toBeVisible();
  await expect(stats.getByText('Attack', { exact: true })).toBeVisible();
  await expect(stats.getByText('Serve errors', { exact: true })).toBeVisible();
  await expect(stats.getByText('Pass errors', { exact: true })).toBeVisible();
  await expect(stats.getByText('srv err', { exact: true })).toHaveCount(0);
  await expect(stats.getByText('pass err', { exact: true })).toHaveCount(0);

  await page.getByPlaceholder('Player name').fill('Stats Alpha Saved');
  await sheet.getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.getByText('Stats Alpha Saved')).toBeVisible();

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).find(p => p.id === 'stats-player')
  );
  expect(saved).toMatchObject({
    name: 'Stats Alpha Saved',
    lifetime: expect.objectContaining({ serr: 1, perr: 1, kill: 5 })
  });
});

test('player insights render for demo season and hide rating trend deltas', async ({ page }) => {
  await page.goto('/');
  await goToMore(page);
  await page.getByRole('button', { name: 'Load demo season', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Load demo', exact: true }).click();

  await expectScreenLabel(page, 'Roster');
  await page.locator('.player-card').first().click();

  const insights = page.locator('.sheet .insight-card');
  await expect(insights.getByText('Player insights', { exact: true })).toBeVisible();
  await expect(insights.getByText('Serve in', { exact: true })).toBeVisible();

  await page.locator('.sheet').getByRole('button', { name: 'Cancel', exact: true }).click();
  await goToMore(page);
  await page
    .locator('.card')
    .filter({ hasText: 'Hide ratings (stealth)' })
    .getByRole('button', { name: 'Off', exact: true })
    .click();
  await goToPlayers(page);
  await page.locator('.player-card').first().click();

  const hiddenInsights = page.locator('.sheet .insight-card');
  await expect(hiddenInsights.getByText('Player insights', { exact: true })).toBeVisible();
  await expect(hiddenInsights.getByText('Serve in', { exact: true })).toBeVisible();

  const hiddenText = await page.locator('.sheet').innerText();
  expect(hiddenText).not.toMatch(/[▲▼]\s*[+-]?\d+/);
  expect(hiddenText).not.toMatch(/[+-]\d+\s+last\s+\d+/i);
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

  await goToTeams(page);
  await expect(page.locator('main .chip').filter({ hasText: 'Old Import' })).toBeVisible();
  await expect(page.locator('main .chip').filter({ hasText: 'Away Import' })).toHaveCount(0);

  await goToTrack(page);
  await expect(page.locator('main .chip').filter({ hasText: 'Old Import' })).toBeVisible();
  await expect(page.locator('main .chip').filter({ hasText: 'Away Import' })).toHaveCount(0);
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
  await goToMore(page);
  await page.getByRole('button', { name: 'Restore from backup', exact: true }).click();
  await page.locator('#impTxt').fill(JSON.stringify(backup));
  await page.locator('.sheet').getByRole('button', { name: 'Restore from paste', exact: true }).click();

  await goToPlayers(page);
  await expect(page.getByText('Restore Alpha')).toBeVisible();
  await expect(page.getByText('Restore Beta')).toBeVisible();

  await goToGames(page);
  await expect(gameHistoryRow(page, 'Restore Alpha')).toBeVisible();

  const beforeReload = await replayState(page, 'restore-game');
  expectReplayedGame(beforeReload, ['restore-a', 'restore-b']);

  await page.reload();
  await goToPlayers(page);
  await expect(page.getByText('Restore Alpha')).toBeVisible();

  const afterReload = await replayState(page, 'restore-game');
  expectReplayedGame(afterReload, ['restore-a', 'restore-b']);
  expect(afterReload).toEqual(beforeReload);

  await goToGames(page);
  await gameHistoryRow(page, 'Restore Alpha').click();
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
  await goToPlayers(page);
  await expect(page.getByText('Raw Alpha')).toBeVisible();

  const state = await replayState(page, 'raw-game');
  expectReplayedGame(state, ['raw-a', 'raw-b', 'raw-c']);
  expect(state.players.find(p => p.id === 'raw-a')).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0 });
  expect(state.players.find(p => p.id === 'raw-b')).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 });

  await goToGames(page);
  await gameHistoryRow(page, 'Raw Alpha').click();
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
  await goToPlayers(page);

  const generatedNames = await page.evaluate(() => {
    window._pool = new Set(['active-a', 'active-b', 'inactive-c']);
    window.genTeams();
    return window._teams.flat().map(p => p.name);
  });

  expect(generatedNames).toEqual(expect.arrayContaining(['Active A', 'Active B']));
  expect(generatedNames).not.toContain('Inactive C');
});

test('solo discard confirm cancel keeps live solo stats', async ({ page }) => {
  await seedTrackingRoster(page);
  await startSoloTracking(page);
  await logSoloAce(page);

  const confirm = await openDiscardConfirm(page);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.locator('.scrim')).toHaveCount(0);
  await expectScreenLabel(page, 'Scout / Solo');
  await expect(trackCard(page, 'Solo Alpha').locator('.cnt')).toHaveText('1');
  expect(await currentLive(page)).toMatchObject({
    solo: true,
    player: 'solo-alpha',
    log: { 'solo-alpha': { ace: 1 } }
  });
  expect(await gameCounts(page)).toEqual({ memory: 0, stored: 0 });
});

test('solo discard confirm discard exits without saving', async ({ page }) => {
  await seedTrackingRoster(page);
  await startSoloTracking(page);
  await logSoloAce(page);

  const confirm = await openDiscardConfirm(page);
  await confirm.getByRole('button', { name: 'Discard', exact: true }).click();

  await expectScreenLabel(page, 'Track');
  await expect(page.getByRole('heading', { name: 'Scout one player', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start solo tracking', exact: true })).toBeVisible();
  expect(await currentLive(page)).toBeNull();
  expect(await gameCounts(page)).toEqual({ memory: 0, stored: 0 });
});

test('solo discard confirm scrim click cancels and keeps live solo stats', async ({ page }) => {
  await seedTrackingRoster(page);
  await startSoloTracking(page);
  await logSoloAce(page);

  await openDiscardConfirm(page);
  await page.mouse.click(5, 5);

  await expect(page.locator('.scrim')).toHaveCount(0);
  await expectScreenLabel(page, 'Scout / Solo');
  await expect(trackCard(page, 'Solo Alpha').locator('.cnt')).toHaveText('1');
  expect(await currentLive(page)).toMatchObject({
    solo: true,
    player: 'solo-alpha',
    log: { 'solo-alpha': { ace: 1 } }
  });
});

test('match discard confirm cancel keeps live score', async ({ page }) => {
  await seedTrackingRoster(page);
  await startMatchTracking(page);

  await page.locator('.score-box.A').getByRole('button', { name: 'Team A plus one', exact: true }).click();
  await expect(page.locator('.score-box.A .score-num')).toHaveText('1');

  const confirm = await openDiscardConfirm(page);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.locator('.scrim')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Track this game', exact: true })).toBeVisible();
  await expect(page.locator('.score-box.A .score-num')).toHaveText('1');
  expect(await currentLive(page)).toMatchObject({
    teamA: ['match-alpha'],
    teamB: ['match-beta'],
    scoreA: 1,
    scoreB: 0
  });
  expect(await gameCounts(page)).toEqual({ memory: 0, stored: 0 });
});

test('match discard confirm discard exits without saving', async ({ page }) => {
  await seedTrackingRoster(page);
  await startMatchTracking(page);

  await page.locator('.score-box.A').getByRole('button', { name: 'Team A plus one', exact: true }).click();
  await expect(page.locator('.score-box.A .score-num')).toHaveText('1');

  const confirm = await openDiscardConfirm(page);
  await confirm.getByRole('button', { name: 'Discard', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Track a game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start tracking', exact: true })).toBeVisible();
  expect(await currentLive(page)).toBeNull();
  expect(await gameCounts(page)).toEqual({ memory: 0, stored: 0 });
});

test('delete player confirmation cancel does not delete the player', async ({ page }) => {
  await seedCourt(page, {
    players: [
      { id: 'delete-cancel-player', name: 'Delete Cancel Player', seedRating: 43, active: true, archived: false }
    ]
  });

  await page.goto('/');
  await goToPlayers(page);
  await playerCard(page, 'Delete Cancel Player').click();
  await page.locator('.sheet').getByRole('button', { name: 'Delete player', exact: true }).click();

  const confirm = page.locator('.scrim').last();
  await expect(confirm.getByText('Delete this player? This cannot be undone.')).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.locator('.scrim')).toHaveCount(1);
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Edit player' })).toBeVisible();
  await expect(page.getByText('Delete Cancel Player')).toBeVisible();

  const savedPlayerIds = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:players')).map(p => p.id));
  expect(savedPlayerIds).toContain('delete-cancel-player');
});

test('deleting an unplayed player hard-deletes them', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'unused-player', name: 'Unused Player', seedRating: 43, active: true, archived: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');

  await goToPlayers(page);
  await playerCard(page, 'Unused Player').click();
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

  await goToPlayers(page);
  await playerCard(page, 'Seed Player').click();
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

  await goToPlayers(page);
  await playerCard(page, 'Fresh Seed').click();
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
  await goToPlayers(page);

  const before = await page.evaluate(() => {
    recomputeAll();
    const g = games.find(game => game.id === 'historic-game');
    return { deltas: JSON.stringify(g.deltas), ratings: players.map(p => p.rating) };
  });

  await playerCard(page, 'Historic Player').click();
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

  await goToPlayers(page);
  await expect(page.getByText('Historic Player')).toHaveCount(0);

  await goToTrack(page);
  await expect(page.locator('main .chip').filter({ hasText: 'Historic Player' })).toHaveCount(0);

  await goToTeams(page);
  await expect(page.locator('main .chip').filter({ hasText: 'Historic Player' })).toHaveCount(0);

  const generatedNames = await page.evaluate(() => {
    window._pool = new Set(['historic-player', 'active-teammate', 'active-opponent']);
    window.genTeams();
    return window._teams.flat().map(p => p.name);
  });
  expect(generatedNames).not.toContain('Historic Player');

  await goToGames(page);
  await gameHistoryRow(page, 'Historic Player, Active Teammate').click();
  await expect(page.locator('.sheet').getByRole('heading', { name: /Game · 25–20/i })).toBeVisible();
  await expect(page.locator('.sheet').getByText('Historic Player')).toBeVisible();
});
