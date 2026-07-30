import { test, expect } from '@playwright/test';

function rotatingEvent({
  id = 'rotating-pools',
  pools = [['A', 8], ['B', 8]],
  courts = 4,
  rounds = 3,
  fairnessPolicy = 'allowDifference',
  assignments = { enabled: true, courts: { 1: 'A', 2: 'A', 3: 'B', 4: 'B' } },
} = {}) {
  const entries = pools.flatMap(([pool, count]) => Array.from({ length: count }, (_, index) => ({
    id: `${id}-${pool || 'none'}-${index}`,
    name: `${pool || 'No pool'} Entry ${index + 1}`,
    pool,
    players: [`${id}-${pool}-${index}-p1`, `${id}-${pool}-${index}-p2`],
    manualSeed: index + 1,
  })));
  return {
    id, name: id, eventDate: '2026-07-29', created: 1, done: false,
    format: 'rotatingGroups', entries, teams: [], brackets: [], rotationSchedule: [],
    rotation: {
      entrySize: 2, teamSize: 4, rounds, courts, fairnessPolicy,
      seedMode: 'manual', seed: `${id}-seed`, revision: 1,
      start: '09:00', setMin: 20, matchMin: 45, breakMin: 10,
      poolCourtAssignments: assignments,
    },
  };
}

function fixedEvent({
  id = 'fixed-pool-courts',
  courts = 3,
  assignments = { enabled: true, courts: { 1: 'A', 2: 'B', 3: '*' } },
} = {}) {
  const teams = ['A', 'B'].flatMap(pool => Array.from({ length: 4 }, (_, index) => ({
    id: `${id}-${pool}-${index}`, name: `${pool} Team ${index + 1}`, pool, players: [],
  })));
  return {
    id, name: id, eventDate: '2026-07-29', created: 1, done: false,
    format: 'fixedTeams', teams, brackets: [],
    sched: {
      start: '09:00', courts, courtStyle: 'num', standardRounds: 3,
      fairnessPolicy: 'allowDifference', opponentPolicy: 'unique-v1',
      setMin: 20, matchMin: 45, breakMin: 10,
      seed: `${id}-seed`, revision: 1, poolCourtAssignments: assignments,
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('rotating pool generation is deterministic, pool-scoped, court-eligible, and conflict-free', async ({ page }) => {
  const result = await page.evaluate(event => {
    const first = generateRotationScheduleData(event);
    const second = generateRotationScheduleData(structuredClone(event));
    const poolsById = Object.fromEntries(event.entries.map(entry => [entry.id, entry.pool]));
    const eligible = match => eligibleCourtsForPool(event, event.rotation, match.pool).includes(match.court);
    const rounds = Object.values(Object.groupBy(first.matches.filter(isStandardScheduleMatch), match => match.round));
    return {
      error: first.error || '',
      signature: rotationPlacementSignature(first.matches),
      secondSignature: rotationPlacementSignature(second.matches),
      allStored: first.matches.every(match => match.pool),
      allSamePool: first.matches.every(match => {
        const pools = new Set([...match.sideAEntryIds, ...match.sideBEntryIds].map(id => poolsById[id]));
        return pools.size === 1 && pools.has(match.pool);
      }),
      allEligible: first.matches.every(eligible),
      roundSafe: rounds.every(matches => {
        const entries = matches.flatMap(match => [...match.sideAEntryIds, ...match.sideBEntryIds]);
        const courts = matches.map(match => match.court);
        return new Set(entries).size === entries.length && new Set(courts).size === courts.length;
      }),
      audit: rotationScheduleAudit(event, first.matches),
    };
  }, rotatingEvent());

  expect(result.error).toBe('');
  expect(result.signature).toBe(result.secondSignature);
  expect(result.allStored && result.allSamePool && result.allEligible && result.roundSafe).toBe(true);
  expect(result.audit.crossPoolMatches).toEqual([]);
  expect(result.audit.ineligibleCourtMatches).toEqual([]);
  expect(result.audit.avoidableOpponentRepeats).toBe(0);
});

test('pool-specific validation, makeup placement, no-pool grouping, and normalization are precise', async ({ page }) => {
  const result = await page.evaluate(({ uneven, tooSmall }) => {
    const made = generateRotationScheduleData(uneven);
    const small = generateRotationScheduleData(tooSmall);
    const malformed = structuredClone(uneven);
    malformed.rotation.courts = 2;
    malformed.rotation.poolCourtAssignments = {
      enabled: true,
      courts: { 1: 'MISSING', 2: '*', 3: 'A', 999: 'B' },
    };
    const normalized = rotationSettings(malformed).poolCourtAssignments;
    const noPoolGroups = eventSchedulingGroups({
      ...uneven,
      entries: uneven.entries.map((entry, index) => ({ ...entry, pool: index < 5 ? 'A' : '' })),
    }).map(group => group.label);
    return {
      error: made.error || '',
      makeupCount: made.matches.filter(isMakeupScheduleMatch).length,
      makeupSafe: made.matches.filter(isMakeupScheduleMatch).every(match => {
        const ids = [...match.sideAEntryIds, ...match.sideBEntryIds];
        return ids.every(id => entryById(uneven, id)?.pool === match.pool)
          && eligibleCourtsForPool(uneven, uneven.rotation, match.pool).includes(match.court);
      }),
      smallError: small.error || '',
      normalized,
      noPoolGroups,
    };
  }, {
    uneven: rotatingEvent({
      id: 'uneven-pools',
      pools: [['A', 5], ['B', 5]],
      courts: 2,
      rounds: 3,
      fairnessPolicy: 'equalGames',
      assignments: { enabled: true, courts: { 1: 'A', 2: 'B' } },
    }),
    tooSmall: rotatingEvent({
      id: 'small-pool',
      pools: [['A', 4], ['B', 3]],
      courts: 2,
      rounds: 2,
      assignments: { enabled: false, courts: {} },
    }),
  });

  expect(result.error).toBe('');
  expect(result.makeupCount).toBeGreaterThan(0);
  expect(result.makeupSafe).toBe(true);
  expect(result.smallError).toContain('Pool B has 3 entries');
  expect(result.smallError).toContain('at least 4 entries in a pool');
  expect(result.normalized).toEqual({ enabled: true, courts: { 1: '*', 2: '*' } });
  expect(result.noPoolGroups).toEqual(['Pool A', 'No pool']);
});

test('fixed schedules enforce dedicated/shared courts and capacity uses eligible courts', async ({ page }) => {
  const result = await page.evaluate(event => {
    const schedule = buildSchedule(event, []);
    const matches = schedule.allMatches.filter(match => !isCustomScheduleMatch(match));
    const validation = fixedScheduleValidation(event, matches);
    const byPool = Object.fromEntries(['A', 'B'].map(pool => [
      pool,
      [...new Set(matches.filter(match => match.pool === pool).map(match => match.court + 1))].sort(),
    ]));
    const capacity = fixedScheduleCapacityInfo(event);
    const letter = structuredClone(event);
    letter.sched.courtStyle = 'letter';
    const letterAssignments = poolCourtAssignmentsFor(letter, letter.sched);
    const disabled = structuredClone(event);
    disabled.sched.poolCourtAssignments.enabled = false;
    const disabledSchedule = buildSchedule(disabled, []);
    return {
      valid: validation.valid,
      byPool,
      noCourtConflicts: validation.courtConflicts.length === 0,
      capacity: capacity.groupCapacity.map(group => ({
        pool: group.pool, eligibleCourtCount: group.eligibleCourtCount,
      })),
      letterAssignments,
      disabledValid: fixedScheduleValidation(disabled, disabledSchedule.allMatches).valid,
    };
  }, fixedEvent());

  expect(result.valid && result.noCourtConflicts && result.disabledValid).toBe(true);
  expect(result.byPool.A.every(court => [1, 3].includes(court))).toBe(true);
  expect(result.byPool.B.every(court => [2, 3].includes(court))).toBe(true);
  expect(result.capacity).toEqual([
    { pool: 'A', eligibleCourtCount: 2 },
    { pool: 'B', eligibleCourtCount: 2 },
  ]);
  expect(result.letterAssignments).toEqual({ enabled: true, courts: { 1: 'A', 2: 'B', 3: '*' } });
});

test('pool seeding, grouped standings, pool-rank playoffs, exports, and history preservation stay deterministic', async ({ page }) => {
  const result = await page.evaluate(event => {
    const snakeOne = fixedPoolSeedPlan(event, 'snake', 2);
    const snakeTwo = fixedPoolSeedPlan(event, 'snake', 2);
    const randomOne = fixedPoolSeedPlan(event, 'random', 2, { randomSeed: 'one' });
    const randomAgain = fixedPoolSeedPlan(event, 'random', 2, { randomSeed: 'one' });
    const randomTwo = fixedPoolSeedPlan(event, 'random', 2, { randomSeed: 'two' });
    games = [
      {
        id: 'ga', evId: event.id, evMatchId: 'ma', eventFormat: 'rotatingGroups',
        evEntryIdsA: ['A0', 'A1'], evEntryIdsB: ['A2', 'A3'],
        scoreA: 25, scoreB: 20, winner: 'A', date: 1,
      },
      {
        id: 'gb', evId: event.id, evMatchId: 'mb', eventFormat: 'rotatingGroups',
        evEntryIdsA: ['B0', 'B1'], evEntryIdsB: ['B2', 'B3'],
        scoreA: 25, scoreB: 20, winner: 'A', date: 2,
      },
    ];
    const beforeGames = JSON.stringify(games);
    const grouped = entryStandingsGroups(event).map(group => ({
      label: group.label,
      ranks: group.rows.map(row => row.poolRank),
    }));
    const playoff = rotationPlayoffOrder(event).map(entry => entry.id);
    const made = generateRotationScheduleData(event);
    event.rotationSchedule = made.matches;
    const full = deriveFullScheduleExportModel(event, { gameList: games, playerList: [] });
    const reports = scoreReportSessionMatches(event);
    const assignment = Object.fromEntries(event.entries.map((entry, index) => [entry.id, index < 4 ? 'B' : 'A']));
    applyPoolAssignments(event, assignment);
    return {
      snakeStable: JSON.stringify(snakeOne.assign) === JSON.stringify(snakeTwo.assign),
      randomStable: JSON.stringify(randomOne.assign) === JSON.stringify(randomAgain.assign),
      randomChanged: JSON.stringify(randomOne.assign) !== JSON.stringify(randomTwo.assign),
      grouped,
      playoff,
      exportPools: [...new Set(full.rounds.flatMap(round => round.matches.map(match => match.pool)))].sort(),
      reportPools: [...new Set(reports.map(match => match.pool))].sort(),
      gamesUnchanged: beforeGames === JSON.stringify(games),
    };
  }, rotatingEvent({
    id: 'standings-pools',
    pools: [['A', 4], ['B', 4]],
    courts: 2,
    rounds: 2,
    assignments: { enabled: true, courts: { 1: 'A', 2: 'B' } },
  }).entries.reduce((event, entry, index) => {
    entry.id = `${entry.pool}${index % 4}`;
    entry.name = `${entry.pool}${index % 4}`;
    event.entries.push(entry);
    return event;
  }, {
    id: 'standings-pools', name: 'Standings pools', eventDate: '2026-07-29',
    created: 1, done: false, format: 'rotatingGroups', entries: [], teams: [], brackets: [],
    rotationSchedule: [],
    rotation: {
      entrySize: 2, teamSize: 4, rounds: 2, courts: 2,
      fairnessPolicy: 'allowDifference', seedMode: 'manual', seed: 'standings-seed',
      revision: 1, start: '09:00', setMin: 20,
      poolCourtAssignments: { enabled: true, courts: { 1: 'A', 2: 'B' } },
    },
  }));

  expect(result.snakeStable && result.randomStable && result.randomChanged).toBe(true);
  expect(result.grouped).toEqual([
    { label: 'Pool A', ranks: [1, 2, 3, 4] },
    { label: 'Pool B', ranks: [1, 2, 3, 4] },
  ]);
  expect(new Set(result.playoff.slice(0, 2))).toEqual(new Set(['A0', 'B0']));
  expect(result.exportPools).toEqual(['A', 'B']);
  expect(result.reportPools).toEqual(['A', 'B']);
  expect(result.gamesUnchanged).toBe(true);
});

test('backup restore preserves rotating pools and assignments while legacy backups stay all-shared', async ({ page }) => {
  const result = await page.evaluate(async event => {
    evts = [event];
    games = [];
    window.__poolBackup = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async value => { window.__poolBackup = value; } },
    });
    await exportData();
    const backup = JSON.parse(window.__poolBackup);
    evts = [];
    await restoreBackupData(backup);
    const restored = evById(event.id);
    const current = {
      pools: restored.entries.map(entry => entry.pool),
      assignments: rotationSettings(restored).poolCourtAssignments,
    };

    await restoreBackupData({
      v: 1,
      players: [],
      games: [],
      settings: {},
      events: [{
        ...event,
        id: 'legacy-rotating-pools',
        entries: event.entries.map(entry => ({ id: entry.id, name: entry.name, players: entry.players })),
        rotation: Object.fromEntries(Object.entries(event.rotation)
          .filter(([key]) => key !== 'poolCourtAssignments')),
      }],
    });
    const legacy = evById('legacy-rotating-pools');
    const legacyMade = generateRotationScheduleData(legacy);
    return {
      current,
      backupPools: backup.events[0].entries.map(entry => entry.pool),
      backupAssignments: backup.events[0].rotation.poolCourtAssignments,
      legacyGroups: eventSchedulingGroups(legacy).map(group => group.label),
      legacyAssignments: rotationSettings(legacy).poolCourtAssignments,
      legacyError: legacyMade.error || '',
      legacyCourts: [...new Set(legacyMade.matches.map(match => match.court))].sort(),
    };
  }, rotatingEvent());

  expect(result.current.pools).toEqual(result.backupPools);
  expect(result.current.assignments).toEqual(result.backupAssignments);
  expect(result.legacyGroups).toEqual(['Open group']);
  expect(result.legacyAssignments.enabled).toBe(false);
  expect(result.legacyError).toBe('');
  expect(result.legacyCourts.length).toBeGreaterThan(1);
});

test('started rotating rounds and saved results stay exact while regenerated future rounds use new courts', async ({ page }) => {
  const result = await page.evaluate(event => {
    const initial = generateRotationScheduleData(event);
    event.rotationSchedule = initial.matches.map(match => ({ ...match }));
    const completed = event.rotationSchedule.find(match => match.round === 1);
    games = [{
      id: 'saved-round-one',
      date: 1,
      evId: event.id,
      evMatchId: completed.id,
      eventFormat: 'rotatingGroups',
      evEntryIdsA: completed.sideAEntryIds.slice(),
      evEntryIdsB: completed.sideBEntryIds.slice(),
      teamA: [],
      teamB: [],
      scoreA: 25,
      scoreB: 20,
      winner: 'A',
      log: {},
    }];
    const gamesBefore = JSON.stringify(games);
    const roundOneBefore = JSON.stringify(event.rotationSchedule.filter(match => match.round === 1));
    const locked = event.rotationSchedule.filter(match => match.round === 1);
    event.rotation = {
      ...event.rotation,
      revision: 2,
      poolCourtAssignments: {
        enabled: true,
        courts: { 1: 'B', 2: 'B', 3: 'A', 4: 'A' },
      },
    };
    const regenerated = generateRotationScheduleData(event, { lockedMatches: locked });
    const auditEvent = { ...event, rotationSchedule: regenerated.matches };
    const future = regenerated.matches.filter(match => match.round > 1 && isStandardScheduleMatch(match));
    return {
      error: regenerated.error || '',
      gamesUnchanged: gamesBefore === JSON.stringify(games),
      roundOneUnchanged: roundOneBefore
        === JSON.stringify(regenerated.matches.filter(match => match.round === 1)),
      futureEligible: future.every(match =>
        eligibleCourtsForPool(event, event.rotation, match.pool).includes(match.court)),
      protectedLegacyExceptions: rotationScheduleAudit(auditEvent, regenerated.matches).protectedLegacyExceptions,
      completedId: completed.id,
    };
  }, rotatingEvent({
    id: 'started-pool-courts',
    courts: 4,
    rounds: 3,
    assignments: { enabled: true, courts: { 1: 'A', 2: 'A', 3: 'B', 4: 'B' } },
  }));

  expect(result.error).toBe('');
  expect(result.gamesUnchanged && result.roundOneUnchanged && result.futureEligible).toBe(true);
  expect(result.protectedLegacyExceptions).toContain(result.completedId);
});

test('rotating pool and court controls are progressively disclosed and mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(event => {
    evts = [event];
    games = [];
    openEvent(event.id);
    eventSection('entries');
  }, rotatingEvent());

  await expect(page.getByRole('button', { name: 'Manage pools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seed pools' })).toBeVisible();
  await page.evaluate(() => openRotationSettings('rotating-pools'));
  await expect(page.getByText('Pool court assignments · optional')).toBeVisible();
  await expect(page.locator('[data-pool-court-row]')).toHaveCount(4);
  await page.getByRole('button', { name: 'All courts shared' }).click();
  await expect(page.locator('[data-pool-court-row]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Assign courts by pool' }).click();
  await expect(page.locator('[data-pool-court-row]')).toHaveCount(4);

  const layout = await page.evaluate(() => {
    const section = document.querySelector('[data-pool-court-assignments]');
    const selects = [...document.querySelectorAll('[data-pool-court]')];
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nestedScroll: ['auto', 'scroll'].includes(getComputedStyle(section).overflowY),
      minimumTapHeight: Math.min(...selects.map(node => node.getBoundingClientRect().height)),
    };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.nestedScroll).toBe(false);
  expect(layout.minimumTapHeight).toBeGreaterThanOrEqual(40);

  await page.getByRole('button', { name: 'Reset all to shared' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pool-court-summary]')).toContainText('Shared');
});
