import { test, expect } from '@playwright/test';

function player(id, name, extra = {}) {
  return {
    id, name, seedRating: 48, rating: 48, active: true, archived: false,
    roles: {}, lifetime: {}, history: [{ i: 0, r: 48 }], ...extra
  };
}

async function seed(page, { players = [], games = [], events = [] } = {}) {
  await page.addInitScript(data => {
    localStorage.setItem('vb:players', JSON.stringify(data.players));
    localStorage.setItem('vb:games', JSON.stringify(data.games));
    localStorage.setItem('vb:events', JSON.stringify(data.events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { players, games, events });
}

test('legacy normalization infers pickup eligibility, normalizes aliases, and is idempotent without touching history', async ({ page }) => {
  const players = [
    player('played', 'Played Legacy', { active: undefined, rating: 73, aliases: ['  PJ ', '', 'pj', 12, 'Played Legacy'] }),
    player('event-only', 'Event Legacy', { active: undefined }),
    player('ordinary', 'Ordinary Legacy', { active: undefined }),
    player('explicit', 'Explicit Legacy', { pickupEligible: false, aliases: undefined })
  ];
  const games = [{ id: 'saved', date: 1000, teamA: ['played'], teamB: ['missing'], scoreA: 10, scoreB: 10, log: {} }];
  const events = [{ id: 'event', name: 'Legacy Event', created: 1, teams: [{ id: 'team', name: 'Team', players: ['event-only'] }], brackets: [] }];
  await seed(page, { players, games, events });
  await page.goto('/');

  const result = await page.evaluate(() => {
    const beforeSecondPass = JSON.stringify(players);
    const historical = { ids: players.map(p => p.id), ratings: players.map(p => p.rating), games: JSON.stringify(games), events: JSON.stringify(evts) };
    migratePlayers();
    return {
      normalized: players.map(({ id, active, pickupEligible, aliases }) => ({ id, active, pickupEligible, aliases })),
      searchTerms: getPlayerSearchTerms(players[0]),
      idempotent: JSON.stringify(players) === beforeSecondPass,
      historical,
      after: { ids: players.map(p => p.id), ratings: players.map(p => p.rating), games: JSON.stringify(games), events: JSON.stringify(evts) }
    };
  });

  expect(result.normalized).toEqual([
    { id: 'played', active: true, pickupEligible: true, aliases: ['PJ'] },
    { id: 'event-only', active: true, pickupEligible: false, aliases: [] },
    { id: 'ordinary', active: true, pickupEligible: true, aliases: [] },
    { id: 'explicit', active: true, pickupEligible: false, aliases: [] }
  ]);
  expect(result.searchTerms).toEqual(['played legacy', 'pj']);
  expect(result.idempotent).toBe(true);
  expect(result.after).toEqual(result.historical);
});

test('participation metadata counts saved ties once, finds all event member formats, and tolerates missing references', async ({ page }) => {
  await page.goto('/');
  const now = Date.UTC(2026, 6, 24);
  const result = await page.evaluate(nowValue => {
    const roster = [
      { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'pair', name: 'Pair' },
      { id: 'entry', name: 'Entry' }, { id: 'never', name: 'Never' }
    ];
    const savedGames = [
      { id: 'tie', date: nowValue - 1000, teamA: ['a', 'a'], teamB: ['b'], scoreA: 20, scoreB: 20, log: {} },
      { id: 'older', date: nowValue - 40 * 86400000, teamA: ['a'], teamB: ['missing'], winner: 'A', log: {} }
    ];
    const savedEvents = [{
      id: 'event', teams: [{ id: 't', players: ['b'] }],
      pairs: [{ id: 'p', players: ['pair'] }], entries: [{ id: 'e', members: ['entry', 'missing-event-player'] }]
    }];
    return [...buildPlayerParticipationIndex(roster, savedGames, savedEvents, nowValue)].map(([id, meta]) => [id, meta]);
  }, now);
  const index = Object.fromEntries(result);

  expect(index.a).toMatchObject({ gamesPlayed: 2, lastPlayedAt: now - 1000, hasTrackedGame: true, participationCategory: 'recent' });
  expect(index.b).toMatchObject({ gamesPlayed: 1, hasTrackedGame: true, appearsInEvent: true });
  expect(index.pair).toMatchObject({ gamesPlayed: 0, appearsInEvent: true, participationCategory: 'eventOnly' });
  expect(index.entry).toMatchObject({ appearsInEvent: true, participationCategory: 'eventOnly' });
  expect(index.never).toMatchObject({ hasTrackedGame: false, appearsInEvent: false, participationCategory: 'neverPlayed' });
});

test('pickup attendance is context-aware while event selection keeps event-only players and unavailable selections are explained', async ({ page }) => {
  const players = [
    player('regular', 'Regular Player', { pickupEligible: true }),
    player('away', 'Away Player', { active: false, pickupEligible: true }),
    player('event-only', 'Tournament Guest', { pickupEligible: false })
  ];
  const events = [{ id: 'event', name: 'Tournament', created: 1, teams: [], brackets: [] }];
  await seed(page, { players, events });
  await page.goto('/');

  const pools = await page.evaluate(() => ({
    pickup: getSelectablePlayers({ context: 'pickupAttendance' }).map(p => p.id),
    event: getSelectablePlayers({ context: 'eventMembers' }).map(p => p.id)
  }));
  expect(pools).toEqual({ pickup: ['regular'], event: ['regular', 'event-only'] });

  await page.evaluate(() => {
    window._pool = new Set(['regular', 'event-only']);
    tab = 'teams';
    render();
  });
  await expect(page.locator('[data-selector="teams"] .chip')).toHaveCount(1);
  await expect(page.locator('[data-selector="teams"]')).toContainText('Regular Player');
  await expect(page.locator('[data-selector="teams"]')).not.toContainText('Tournament Guest');
  await expect(page.locator('.unkline[role="status"]')).toContainText('1 previously selected player was removed');

  await page.evaluate(() => openEventTeam('event'));
  await expect(page.locator('[data-selector="eventTeam"] [data-player-choice="event-only"]')).toBeVisible();
});

test('unique labels are deterministic and no tested selector renders duplicate option text', async ({ page }) => {
  const players = [
    player('jordan-smith', 'Jordan Smith'),
    player('jordan-lee', 'Jordan Lee'),
    player('alex-a', 'Alex', { aliases: ['Ace'] }),
    player('alex-b', 'Alex', { aliases: ['Lex'] }),
    player('sam-b', 'Sam'),
    player('sam-a', 'Sam')
  ];
  await seed(page, { players });
  await page.goto('/');

  const labels = await page.evaluate(() => {
    const forward = Object.fromEntries(buildUniquePlayerDisplayLabels(players));
    const reverse = Object.fromEntries(buildUniquePlayerDisplayLabels(players.slice().reverse()));
    return { forward, reverse };
  });
  expect(labels.forward).toEqual(labels.reverse);
  expect(labels.forward['jordan-smith']).toBe('Jordan Smith');
  expect(labels.forward['jordan-lee']).toBe('Jordan Lee');
  expect(labels.forward['alex-a']).toBe('Alex · Ace');
  expect(labels.forward['alex-b']).toBe('Alex · Lex');
  expect(labels.forward['sam-a']).not.toBe(labels.forward['sam-b']);

  await page.evaluate(() => { tab = 'track'; window._trackMode = 'match'; render(); });
  const rendered = await page.locator('[data-selector="track"] .chip').allTextContents();
  const normalized = rendered.map(text => text.trim().toLocaleLowerCase());
  expect(new Set(normalized).size).toBe(normalized.length);
});

test('unplayed seed ratings display as Unrated without mutation while played ratings remain numeric', async ({ page }) => {
  const players = [
    player('unrated', 'Fresh Forty Eight', { rating: 48 }),
    player('rated', 'Played Sixty Two', { seedRating: 62, rating: 62 })
  ];
  const games = [{ id: 'played-game', date: 1000, teamA: ['rated'], teamB: ['missing'], winner: 'A', scoreA: 25, scoreB: 10, log: {} }];
  await seed(page, { players, games });
  await page.goto('/');
  await page.evaluate(() => { tab = 'players'; render(); });

  const freshCard = page.locator('.player-card').filter({ hasText: 'Fresh Forty Eight' });
  const playedCard = page.locator('.player-card').filter({ hasText: 'Played Sixty Two' });
  await expect(freshCard.locator('.rating-badge')).toHaveText('Unrated');
  await expect(playedCard.locator('.rating-badge')).toContainText('62');
  const result = await page.evaluate(() => {
    recomputeAll();
    const fresh = pById('unrated'), rated = pById('rated'), index = buildPlayerParticipationIndex(players, games, evts);
    const before = { fresh: fresh.rating, rated: rated.rating, games: JSON.stringify(games), players: JSON.stringify(players) };
    const displays = [getPlayerRatingDisplay(fresh, index.get('unrated')), getPlayerRatingDisplay(rated, index.get('rated'))];
    migratePlayers();
    recomputeAll();
    return { before, after: { fresh: fresh.rating, rated: rated.rating, games: JSON.stringify(games), players: JSON.stringify(players) }, displays };
  });
  expect(result.displays).toEqual([{ status: 'unrated', label: 'Unrated' }, { status: 'rated', label: '62' }]);
  expect(result.after).toEqual(result.before);
});

test('editor saves and cancels aliases and pickup eligibility, warns on duplicate names, and backup plus sync preserve fields', async ({ page }) => {
  const players = [player('edit', 'Casey'), player('duplicate', 'Casey')];
  await seed(page, { players });
  let posted;
  await page.route('https://sync.test/**', async route => {
    if (route.request().method() === 'POST') posted = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  await page.evaluate(() => openPlayer('edit', 'edit'));

  await expect(page.locator('[data-player-identity-warning]')).toContainText('Another player has this same display name');
  await page.locator('#pAliases').fill('  Caz, caz, , CJ ');
  await page.locator('#pPickupEligible').uncheck();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.player-profile-name')).toHaveText('Casey');
  expect(await page.evaluate(() => ({ aliases: pById('edit').aliases, pickupEligible: pById('edit').pickupEligible }))).toEqual({
    aliases: ['Caz', 'CJ'], pickupEligible: false
  });

  await page.getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await page.locator('#pAliases').fill('Unsaved');
  await page.locator('#pPickupEligible').check();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => ({ aliases: pById('edit').aliases, pickupEligible: pById('edit').pickupEligible }))).toEqual({
    aliases: ['Caz', 'CJ'], pickupEligible: false
  });

  const backup = await page.evaluate(async () => {
    window.__backupText = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__backupText = text; } } });
    const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = () => 'blob:test'; HTMLAnchorElement.prototype.click = () => {};
    await exportData();
    URL.createObjectURL = create; HTMLAnchorElement.prototype.click = click;
    return JSON.parse(window.__backupText);
  });
  expect(backup.players.find(p => p.id === 'edit')).toMatchObject({ aliases: ['Caz', 'CJ'], pickupEligible: false });

  await page.evaluate(async data => {
    players = []; games = []; evts = [];
    await restoreBackupData(data);
    Sync.cfg.url = 'https://sync.test';
    Sync.cfg.code = 'room';
    Sync.cfg.on = true;
    await Sync.push({ force: true });
  }, backup);
  expect(await page.evaluate(() => pById('edit'))).toMatchObject({ id: 'edit', aliases: ['Caz', 'CJ'], pickupEligible: false });
  expect(posted).toBeTruthy();
  const synced = JSON.parse(posted.data);
  expect(synced.players.find(p => p.id === 'edit')).toMatchObject({ aliases: ['Caz', 'CJ'], pickupEligible: false });
  expect(await page.evaluate(() => mergePlayersById(
    [{ id: 'edit', name: 'Casey', aliases: ['Caz', 'CJ'], pickupEligible: false }],
    [{ id: 'edit', name: 'Casey from older device' }],
    true
  )[0])).toMatchObject({ name: 'Casey from older device', aliases: ['Caz', 'CJ'], pickupEligible: false });
});

test('player editor controls stay within a narrow mobile sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { players: [player('mobile', 'Mobile Player')] });
  await page.goto('/');
  await page.evaluate(() => openPlayer('mobile', 'edit'));
  const geometry = await page.evaluate(() => {
    const sheet = document.querySelector('.player-editor-sheet');
    const aliases = document.querySelector('#pAliases');
    const pickup = document.querySelector('#pPickupEligible');
    const bounds = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    return { sheet: bounds(sheet), aliases: bounds(aliases), pickup: bounds(pickup), viewport: innerWidth };
  });
  expect(geometry.sheet.left).toBeGreaterThanOrEqual(0);
  expect(geometry.sheet.right).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.aliases.left).toBeGreaterThanOrEqual(geometry.sheet.left);
  expect(geometry.aliases.right).toBeLessThanOrEqual(geometry.sheet.right);
  expect(geometry.pickup.left).toBeGreaterThanOrEqual(geometry.sheet.left);
});
