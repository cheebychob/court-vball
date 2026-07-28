import { test, expect } from '@playwright/test';

const players = [
  { id: 'p-josh', name: 'Josh Sventek', rating: 81, seedRating: 81 },
  { id: 'p-alex', name: 'Alexandria Very Long Public Volleyball Name', rating: 78, seedRating: 78 },
  { id: 'p-riley', name: 'Riley Chen', rating: 74, seedRating: 74 },
  { id: 'p-morgan', name: 'Morgan Lee', rating: 70, seedRating: 70 },
  { id: 'p-taylor', name: 'Taylor Ray', rating: 66, seedRating: 66 },
  { id: 'p-sub', name: 'Sam Substitute', rating: 60, seedRating: 60 },
].map(player => ({
  ...player, active: true, archived: false, pickupEligible: true, roles: {}, lifetime: {},
  history: [{ i: 0, r: player.rating }],
}));

function registrationSource(registrationId, name, activePlayerIds, substitutePlayerIds = []) {
  return {
    schemaVersion: 1, registrationId, sourceRevision: 1, importedAt: 10, lastSyncedAt: 10,
    sourceSnapshot: { name, activePlayerIds, substitutePlayerIds, status: 'accepted' },
  };
}

function individualEvent(overrides = {}) {
  return {
    id: 'individual', name: 'Individual Draw', eventDate: '2026-07-28', created: 1, done: false,
    format: 'rotatingGroups', teams: [], brackets: [], rotationSchedule: [],
    entries: [
      {
        id: 'e-josh', name: 'Josh', players: ['p-josh'], substitutePlayerIds: ['p-sub'], manualSeed: 1, created: 1,
        registrationSource: registrationSource('J'.repeat(22), 'Josh', ['p-josh'], ['p-sub']),
      },
      { id: 'e-alex', name: 'Night Flight', players: ['p-alex'], manualSeed: 2, created: 2 },
      { id: 'e-riley', name: 'Riley', players: ['p-riley'], manualSeed: 3, created: 3 },
      { id: 'e-morgan', name: 'Morgan', players: ['p-morgan'], manualSeed: 4, created: 4 },
      { id: 'e-taylor', name: 'Taylor', players: ['p-taylor'], manualSeed: 5, created: 5 },
    ],
    rotation: {
      entrySize: 1, teamSize: 2, rounds: 1, courts: 1, seedMode: 'manual',
      winPoints: 1, tiePoints: .5, lossPoints: 0,
      tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor'],
    },
    ...overrides,
  };
}

function fixedPairEvent() {
  return {
    id: 'pairs', name: 'Fixed Pair Draw', eventDate: '2026-07-28', created: 2, done: false,
    format: 'rotatingGroups', teams: [], brackets: [], rotationSchedule: [],
    entries: [
      { id: 'pair-a', name: 'Net Results', players: ['p-josh', 'p-alex'], manualSeed: 1, created: 1 },
      { id: 'pair-b', name: 'Side Out', players: ['p-riley', 'p-morgan'], manualSeed: 2, created: 2 },
    ],
    rotation: {
      entrySize: 2, teamSize: 4, rounds: 1, courts: 1, seedMode: 'manual',
      winPoints: 1, tiePoints: .5, lossPoints: 0,
      tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor'],
    },
  };
}

function fixedTeamEvent() {
  return {
    id: 'teams', name: 'Fixed Team Cup', eventDate: '2026-07-28', created: 3, done: false,
    format: 'fixedTeams', brackets: [],
    teams: [
      {
        id: 'team-long', name: 'The Extremely Long Team Name That Must Wrap Cleanly', pool: 'A',
        players: ['p-josh', 'p-alex'], substitutePlayerIds: ['p-sub'],
        registrationSource: registrationSource('T'.repeat(22), 'The Extremely Long Team Name That Must Wrap Cleanly', ['p-josh', 'p-alex'], ['p-sub']),
      },
      { id: 'team-riley', name: 'Riley Rockets', pool: 'A', players: ['p-riley', 'p-morgan'] },
      { id: 'team-not-started', name: 'Waiting Wings', pool: 'A', players: ['p-taylor'] },
    ],
  };
}

function rotatingTieGame() {
  return {
    id: 'rotation-tie', date: 10, evId: 'individual', evMatchId: 'rotation-match-1',
    eventFormat: 'rotatingGroups', evEntryIdsA: ['e-josh', 'e-alex'], evEntryIdsB: ['e-riley', 'e-morgan'],
    teamA: [], teamB: [], scoreA: 21, scoreB: 21, winner: null, log: {},
  };
}

function fixedTieGame() {
  return {
    id: 'team-tie', date: 20, evId: 'teams', matchId: 'team-match-1',
    evA: 'team-long', evB: 'team-riley', teamA: [], teamB: [],
    scoreA: 25, scoreB: 25, winner: null, log: {},
  };
}

async function seed(page, events, games = []) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { events, games, players });
}

async function openEvent(page, eventId, section) {
  await page.goto('/');
  await page.evaluate(id => { tab = 'events'; openEvent(id); }, eventId);
  if (section) await page.evaluate(id => eventSection(id), section);
}

test('Entries manages participants while Standings ranks them and the selected tab survives refreshes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, [individualEvent()], [rotatingTieGame()]);
  await openEvent(page, 'individual', 'entries');

  const entries = page.locator('#event-entries');
  const standings = page.locator('#event-standings');
  await expect(entries).toBeVisible();
  await expect(standings).toBeHidden();
  await expect(entries.getByRole('button', { name: /Add entry/ })).toBeVisible();
  await expect(entries).toContainText('Manage participant names, rosters, registration links, substitutes, and seed information.');
  await expect(entries.locator('[data-event-entry-management="e-josh"]')).toContainText('Active: Josh Sventek · Substitutes: Sam Substitute');
  await expect(entries.locator('[data-event-entry-management="e-josh"]')).toContainText('Registration linked');
  await expect(entries.locator('[data-event-entry-management="e-josh"]').getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(entries.locator('.event-standing-row')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Event sections' }).getByRole('button', { name: 'Standings', exact: true }).click();
  await expect(entries).toBeHidden();
  await expect(standings).toBeVisible();
  await expect(standings.getByRole('button', { name: /Add entry/ })).toHaveCount(0);
  await expect(standings.locator('.event-standing-row')).toHaveCount(5);
  await expect(page.locator('.event-subnav [data-event-tab="standings"]')).toHaveClass(/on/);

  await page.evaluate(() => render());
  await expect(page.locator('#event-standings')).toBeVisible();
  await expect(page.locator('#event-entries')).toBeHidden();
  await expect(page.locator('.event-subnav [data-event-tab="standings"]')).toHaveClass(/on/);
});

test('individual standings lead with public identity, retain custom context and imported source, and preserve canonical tie calculations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, [individualEvent()], [rotatingTieGame()]);
  await openEvent(page, 'individual', 'standings');

  const josh = page.locator('.event-standing-row[data-scroll-key="entry-e-josh"]');
  const alex = page.locator('.event-standing-row[data-scroll-key="entry-e-alex"]');
  const notStarted = page.locator('.event-standing-row[data-scroll-key="entry-e-taylor"]');

  await expect(josh.locator('.event-standing-name')).toHaveText('Josh Sventek');
  await expect(josh.locator('.event-standing-context')).not.toContainText('Entry: Josh');
  await expect(josh.locator('.event-source-badge')).toHaveText('Imported');
  await expect(josh).not.toContainText('Imported from registration');
  await expect(alex.locator('.event-standing-name')).toHaveText('Alexandria Very Long Public Volleyball Name');
  await expect(alex.locator('.event-standing-context')).toContainText('Entry: Night Flight');
  await expect(notStarted.locator('.event-standing-mobile-stats')).toHaveText('Not started');
  await expect(notStarted.locator('[data-stat="record"]')).toHaveText('Not started');

  await expect(josh.locator('.event-standing-mobile-stats')).toContainText('0-0-1 · 0% · Pts 0.5 · Diff 0');
  await expect(josh.locator('.event-standing-mobile-detail')).toHaveText('PF-PA 21-21');
  const rendered = await page.locator('.event-standing-row').evaluateAll(rows => rows.map(row => ({
    id: row.dataset.scrollKey.replace('entry-', ''),
    record: row.querySelector('[data-stat="record"]').textContent,
    winPct: row.querySelector('[data-stat="winPct"]').textContent,
    points: row.querySelector('[data-stat="points"]').textContent,
    diff: row.querySelector('[data-stat="diff"]').textContent,
    pfpa: row.querySelector('[data-stat="pfpa"]').textContent,
  })));
  const canonical = await page.evaluate(() => entryStandings(evById('individual')).map(row => ({
    id: row.entry.id,
    record: row.played ? `${row.wins}-${row.losses}-${row.ties}` : 'Not started',
    winPct: row.played ? `${Math.round(row.winPct * 100)}%` : '—',
    points: row.played ? String(row.standingsPoints) : '—',
    diff: row.played ? `${row.diff > 0 ? '+' : ''}${row.diff}` : '—',
    pfpa: row.played ? `${row.pf}-${row.pa}` : '—',
  })));
  expect(rendered).toEqual(canonical);

  await josh.click();
  await expect(page.locator('.sheet')).toBeVisible();
  await expect(page.locator('.sheet')).toContainText('Individual Draw');
  await expect(page.locator('.sheet')).toContainText('Josh Sventek');
});

test('fixed-pair and fixed-team formats keep their participant identity and management/ranking split', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 844 });
  await seed(page, [fixedPairEvent(), fixedTeamEvent()], [fixedTieGame()]);

  await openEvent(page, 'pairs', 'entries');
  await expect(page.locator('#event-entries')).toContainText('Net Results');
  await expect(page.locator('#event-entries')).toContainText('Josh Sventek + Alexandria Very Long Public Volleyball Name');
  await expect(page.locator('#event-entries').getByRole('button', { name: /Add entry/ })).toBeVisible();
  await page.evaluate(() => eventSection('standings'));
  await expect(page.locator('#event-standings').locator('.event-standing-name').filter({ hasText: 'Net Results' })).toBeVisible();
  await expect(page.locator('#event-standings').getByRole('button', { name: /Add entry/ })).toHaveCount(0);

  await openEvent(page, 'teams', 'teams');
  await expect(page.locator('#event-teams').getByRole('button', { name: /Add team/ })).toBeVisible();
  await expect(page.locator('#event-teams')).toContainText('Active: Josh Sventek, Alexandria Very Long Public Volleyball Name · Substitutes: Sam Substitute');
  await page.evaluate(() => eventSection('standings'));
  const team = page.locator('.event-standing-row[data-scroll-key="team-team-long"]');
  await expect(team.locator('.event-standing-name')).toHaveText('The Extremely Long Team Name That Must Wrap Cleanly');
  await expect(team.locator('.event-standing-context')).toContainText('Josh Sventek, Alexandria Very Long Public Volleyball Name');
  await expect(team.locator('.event-source-badge')).toHaveText('Imported');
  await expect(team.locator('.event-standing-mobile-stats')).toContainText('0-0-1 · 0% · Sets 0-0-1 · Diff 0');
  await expect(page.locator('.event-standing-row[data-scroll-key="team-team-not-started"]')).toContainText('Not started');
  await expect(page.locator('#event-standings').getByRole('button', { name: /Add team/ })).toHaveCount(0);
});

test('standings switch between compact mobile rows and aligned desktop columns without overflow', async ({ page }) => {
  await seed(page, [individualEvent()], [rotatingTieGame()]);
  const reports = [];
  for (const width of [1440, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await openEvent(page, 'individual', 'standings');
    reports.push(await page.evaluate(() => {
      const table = document.querySelector('#event-standings .event-standing-table');
      const row = table.querySelector('.event-standing-row');
      const head = table.querySelector('.event-standing-head');
      const name = row.querySelector('.event-standing-name');
      return {
        width: innerWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tableOverflow: table.scrollWidth - table.clientWidth,
        rowDisplay: getComputedStyle(row).display,
        headVisible: head.getBoundingClientRect().height > 0,
        mobileStatsVisible: row.querySelector('.event-standing-mobile-stats').getBoundingClientRect().height > 0,
        rowHeight: row.getBoundingClientRect().height,
        nameWrap: getComputedStyle(name).whiteSpace,
      };
    }));
  }
  expect(reports.map(report => report.width)).toEqual([1440, 1024, 768, 430, 390]);
  expect(reports.every(report => report.pageOverflow <= 0 && report.tableOverflow <= 0)).toBe(true);
  expect(reports.slice(0, 3).every(report => report.rowDisplay === 'grid' && report.headVisible && !report.mobileStatsVisible)).toBe(true);
  expect(reports.slice(3).every(report => !report.headVisible && report.mobileStatsVisible && report.rowHeight >= 44)).toBe(true);
  expect(reports.every(report => report.nameWrap !== 'nowrap')).toBe(true);
});
