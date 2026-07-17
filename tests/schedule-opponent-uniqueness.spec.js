import { test, expect } from '@playwright/test';

function fixedEvent({ id = 'fixed-unique', poolSizes = [6, 6, 6], courts = 7, rounds = 3, fairnessPolicy = 'allowDifference', revision = 1, opponentPolicy = 'unique-v1' } = {}) {
  let index = 0;
  const teams = poolSizes.flatMap((size, poolIndex) => Array.from({ length: size }, () => {
    const teamIndex = index++;
    return { id: `${id}-t${teamIndex}`, name: `Team ${teamIndex + 1}`, pool: String.fromCharCode(65 + poolIndex), players: [] };
  }));
  return {
    id, name: id, eventDate: '2026-07-18', created: 1, done: false, format: 'fixedTeams', teams, brackets: [],
    sched: { start: '09:00', courts, courtStyle: 'num', standardRounds: rounds, fairnessPolicy, setMin: 20, matchMin: 45, breakMin: 10, seed: `${id}-seed`, revision, ...(opponentPolicy ? { opponentPolicy } : {}) }
  };
}

function rotatingEvent({ id, entrySize, teamSize, entries, courts, rounds, revision = 1 }) {
  return {
    id, name: id, eventDate: '2026-07-18', created: 1, done: false, format: 'rotatingGroups', teams: [], brackets: [],
    entries: Array.from({ length: entries }, (_, i) => ({
      id: `${id}-e${i}`, name: `Entry ${i + 1}`,
      players: Array.from({ length: entrySize }, (_, j) => `${id}-p${i}-${j}`), manualSeed: i + 1
    })),
    rotation: { entrySize, teamSize, rounds, courts, seedMode: 'manual', fairnessPolicy: 'allowDifference', seed: `${id}-seed`, revision, start: '09:00', setMin: 20 },
    rotationSchedule: []
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the reported 18-team, 7-court, 3-pool setup never repeats a pool opponent', async ({ page }) => {
  const result = await page.evaluate(async event => {
    const equalEvent = event;
    equalEvent.sched.fairnessPolicy = 'equalGames';
    const equal = buildSchedule(equalEvent, []), equalValidation = fixedScheduleValidation(equalEvent, equal.allMatches.filter(match => !isCustomScheduleMatch(match)));
    const revisions = Array.from({ length: 8 }, (_, index) => {
      const candidate = { ...event, sched: { ...event.sched, fairnessPolicy: 'allowDifference', revision: index + 1 } };
      const schedule = buildSchedule(candidate, []), validation = fixedScheduleValidation(candidate, schedule.allMatches);
      return { order: fixedScheduleOrderSignature(schedule), set: fixedMatchupSetSignature(schedule), validation, slots: schedule.plannedSlots.map(slot => slot.length) };
    });
    const live = structuredClone(event); live.sched.fairnessPolicy = 'allowDifference'; evts = [live]; games = []; window.askConfirm = async () => true; const apiRegenerations = [];
    for (let attempt = 0; attempt < 4; attempt++) { await regenerateFixedSchedule(live.id); const schedule = buildSchedule(live, []), validation = fixedScheduleValidation(live, schedule.allMatches); apiRegenerations.push({ revision: live.sched.revision, valid: validation.valid, duplicates: validation.duplicateMatchups.length, crossPool: validation.crossPoolMatchups.length, conflicts: validation.slotConflicts.length, order: fixedScheduleOrderSignature(schedule) }); }
    return {
      equal: { standard: equal.standardTotal, makeup: equal.makeupSlots.flat().length, games: Object.values(equalValidation.gamesPerTeam), validation: equalValidation },
      revisions: revisions.map(row => ({ valid: row.validation.valid, duplicateCount: row.validation.duplicateMatchups.length, crossPoolCount: row.validation.crossPoolMatchups.length, slotConflictCount: row.validation.slotConflicts.length, slots: row.slots })),
      matchupSetCount: new Set(revisions.map(row => row.set)).size,
      orderCount: new Set(revisions.map(row => row.order)).size,
      apiRegenerations
    };
  }, fixedEvent({ fairnessPolicy: 'equalGames' }));

  expect(result.equal).toMatchObject({ standard: 21, makeup: 6 });
  expect(new Set(result.equal.games)).toEqual(new Set([3]));
  expect(result.equal.validation.duplicateMatchups).toEqual([]);
  expect(result.equal.validation.crossPoolMatchups).toEqual([]);
  expect(result.equal.validation.slotConflicts).toEqual([]);
  expect(result.equal.validation.avoidableRepeatCount).toBe(0);
  expect(result.revisions.every(row => row.valid && row.duplicateCount === 0 && row.crossPoolCount === 0 && row.slotConflictCount === 0 && row.slots.every(size => size === 7))).toBe(true);
  expect(result.matchupSetCount).toBe(1);
  expect(result.orderCount).toBeGreaterThan(1);
  expect(result.apiRegenerations.every(row => row.valid && row.duplicates === 0 && row.crossPool === 0 && row.conflicts === 0)).toBe(true);
  expect(new Set(result.apiRegenerations.map(row => row.revision)).size).toBe(4);
  expect(new Set(result.apiRegenerations.map(row => row.order)).size).toBeGreaterThan(1);
});

test('six-team round robin is complete and five physical slots are not confused with five games per team', async ({ page }) => {
  const result = await page.evaluate(({ complete, capacity }) => {
    const full = buildSchedule(complete, []), fullValidation = fixedScheduleValidation(complete, full.allMatches);
    const partial = buildSchedule(capacity, []), partialValidation = fixedScheduleValidation(capacity, partial.allMatches);
    return {
      full: { matches: full.allMatches.length, slots: full.plannedSlots.length, games: Object.values(fullValidation.gamesPerTeam), unused: fullValidation.unusedValidMatchupCount, valid: fullValidation.valid },
      partial: { matches: partial.standardTotal, slots: partial.plannedSlots.length, capacity: partial.capacity, warnings: partial.warnings, validation: partialValidation }
    };
  }, {
    complete: fixedEvent({ id: 'six-complete', poolSizes: [6], courts: 3, rounds: 5 }),
    capacity: fixedEvent({ id: 'capacity-18', courts: 7, rounds: 5 })
  });

  expect(result.full).toMatchObject({ matches: 15, slots: 5, unused: 0, valid: true });
  expect(new Set(result.full.games)).toEqual(new Set([5]));
  expect(result.partial).toMatchObject({ matches: 35, slots: 5, capacity: { uniqueMatchups: 45, completeRoundRobinSlots: 7, scheduledUniqueCapacity: 35 } });
  expect(result.partial.validation.duplicateMatchups).toEqual([]);
  expect(result.partial.warnings.join(' ')).toContain('a complete round robin needs 7 slots');
  expect(result.partial.warnings.join(' ')).toContain('will not add rematches');
});

test('odd pools distribute byes within each pool and edge fields stop after exhausting unique opponents', async ({ page }) => {
  const result = await page.evaluate(({ odd, two, three }) => {
    const summarize = event => { const schedule = buildSchedule(event, []), validation = fixedScheduleValidation(event, schedule.allMatches); return { schedule, validation }; };
    const oddResult = summarize(odd), byPool = Object.fromEntries(fixedPoolGroups(odd).map(group => [group.pool, group.ids.map(id => oddResult.validation.gamesPerTeam[id])]));
    const twoResult = summarize(two), threeResult = summarize(three);
    return {
      odd: { valid: oddResult.validation.valid, byPool, matches: oddResult.schedule.standardTotal },
      two: { valid: twoResult.validation.valid, matches: twoResult.schedule.standardTotal, games: Object.values(twoResult.validation.gamesPerTeam), warnings: twoResult.schedule.warnings },
      three: { valid: threeResult.validation.valid, matches: threeResult.schedule.standardTotal, games: Object.values(threeResult.validation.gamesPerTeam) }
    };
  }, {
    odd: fixedEvent({ id: 'odd-pools', poolSizes: [5, 3], courts: 3, rounds: 5 }),
    two: fixedEvent({ id: 'two-edge', poolSizes: [2], courts: 8, rounds: 4 }),
    three: fixedEvent({ id: 'three-edge', poolSizes: [3], courts: 8, rounds: 3 })
  });

  expect(result.odd).toMatchObject({ valid: true, matches: 13 });
  expect(new Set(result.odd.byPool.A)).toEqual(new Set([4]));
  expect(new Set(result.odd.byPool.B)).toEqual(new Set([2]));
  expect(result.two).toMatchObject({ valid: true, matches: 1, games: [1, 1] });
  expect(result.two.warnings.join(' ')).toContain('Additional requested slots stay empty');
  expect(result.three).toMatchObject({ valid: true, matches: 3 });
  expect(new Set(result.three.games)).toEqual(new Set([2]));
});

test('rotating solos, pairs, trios, and limited courts avoid unused opponent repeats', async ({ page }) => {
  const cases = [
    rotatingEvent({ id: 'solo-rotation', entrySize: 1, teamSize: 2, entries: 8, courts: 2, rounds: 3 }),
    rotatingEvent({ id: 'pair-rotation', entrySize: 2, teamSize: 4, entries: 12, courts: 3, rounds: 3 }),
    rotatingEvent({ id: 'trio-rotation', entrySize: 3, teamSize: 6, entries: 12, courts: 3, rounds: 3 }),
    rotatingEvent({ id: 'limited-rotation', entrySize: 2, teamSize: 4, entries: 10, courts: 1, rounds: 5 })
  ];
  const result = await page.evaluate(events => events.map(event => {
    const made = generateRotationScheduleData(event), audit = rotationScheduleAudit(event, made.matches), rounds = Object.values(Object.groupBy(made.matches.filter(isStandardScheduleMatch), match => match.round));
    return {
      id: event.id, error: made.error || '', avoidable: audit.avoidableOpponentRepeats, repeated: audit.repeatedOpponents,
      conflicts: audit.roundEntryConflicts.length, invalid: audit.invalidMatches, games: [audit.gamesMin, audit.gamesMax], byes: [audit.byesMin, audit.byesMax],
      noRoundOverlap: rounds.every(matches => { const ids = matches.flatMap(rotationMatchEntryIds); return ids.length === new Set(ids).size; })
    };
  }), cases);

  expect(result.every(row => !row.error && row.avoidable === 0 && row.repeated === 0 && row.conflicts === 0 && row.invalid === 0 && row.noRoundOverlap)).toBe(true);
  expect(result.find(row => row.id === 'limited-rotation')).toMatchObject({ games: [2, 2], byes: [3, 3] });
});

test('mathematically unavoidable rotating repeats hit the lower bound fairly and explain why', async ({ page }) => {
  const event = rotatingEvent({ id: 'unavoidable-rotation', entrySize: 2, teamSize: 4, entries: 8, courts: 2, rounds: 5 });
  const result = await page.evaluate(event => {
    const revisions = Array.from({ length: 5 }, (_, index) => {
      const candidate = { ...event, rotation: { ...event.rotation, revision: index + 1 } }, made = generateRotationScheduleData(candidate), audit = rotationScheduleAudit(candidate, made.matches);
      return { error: made.error || '', audit, material: rotationMaterialSignature(made.matches) };
    });
    return { revisions: revisions.map(row => ({ error: row.error, repeated: row.audit.repeatedOpponents, unavoidable: row.audit.unavoidableOpponentRepeats, avoidable: row.audit.avoidableOpponentRepeats, unused: row.audit.unusedOpponentCombinationCount, games: [row.audit.gamesMin, row.audit.gamesMax], reason: row.audit.repeatReason, conflicts: row.audit.roundEntryConflicts.length })), materialCount: new Set(revisions.map(row => row.material)).size };
  }, event);

  expect(result.revisions.every(row => !row.error && row.repeated === 12 && row.unavoidable === 12 && row.avoidable === 0 && row.unused === 0 && row.games[0] === 5 && row.games[1] === 5 && row.conflicts === 0)).toBe(true);
  expect(result.revisions[0].reason).toContain('mathematically unavoidable');
  expect(result.materialCount).toBeGreaterThan(1);
});

test('stable-ID validators identify cross-pool, slot, duplicate, and unused-opponent failures', async ({ page }) => {
  const result = await page.evaluate(event => {
    const fixedMatches = [
      { id: 'm1', a: `${event.id}-t0`, b: `${event.id}-t1`, slot: 0 },
      { id: 'm2', a: `${event.id}-t1`, b: `${event.id}-t0`, slot: 1 },
      { id: 'm3', a: `${event.id}-t0`, b: `${event.id}-t6`, slot: 1 }
    ];
    const fixed = fixedScheduleValidation(event, fixedMatches);
    const rotation = rotatingEventForValidation();
    function rotatingEventForValidation(){return { id: 'validator-rotation', format: 'rotatingGroups', entries: Array.from({ length: 8 }, (_, i) => ({ id: `ve${i}`, players: [`vp${i}`] })), rotation: { entrySize: 1, teamSize: 2, rounds: 2, courts: 2 } };}
    const rotatingMatches = [
      { id: 'r1', round: 1, court: 1, sideAEntryIds: ['ve0', 've1'], sideBEntryIds: ['ve2', 've3'] },
      { id: 'r2', round: 1, court: 2, sideAEntryIds: ['ve0', 've4'], sideBEntryIds: ['ve5', 've6'] }
    ];
    const rotating = rotationScheduleAudit(rotation, rotatingMatches);
    return { fixed, rotating: { conflicts: rotating.roundEntryConflicts, unused: rotating.unusedOpponentCombinationCount, avoidable: rotating.avoidableOpponentRepeats } };
  }, fixedEvent());

  expect(result.fixed.duplicateMatchups).toHaveLength(1);
  expect(result.fixed.crossPoolMatchups).toHaveLength(1);
  expect(result.fixed.slotConflicts).toHaveLength(1);
  expect(result.fixed.unusedValidMatchupCount).toBeGreaterThan(0);
  expect(result.fixed.avoidableRepeatCount).toBe(1);
  expect(result.rotating.conflicts).toHaveLength(1);
  expect(result.rotating.unused).toBeGreaterThan(0);
});

test('imported schedules missing the new policy remain untouched until explicit upgrade', async ({ page }) => {
  const result = await page.evaluate(legacy => {
    const before = JSON.stringify(legacy), historical = buildSchedule(legacy, []), afterHistorical = JSON.stringify(legacy);
    const upgraded = structuredClone(legacy); upgraded.sched.opponentPolicy = UNIQUE_OPPONENT_POLICY; upgraded.sched.revision++;
    const corrected = buildSchedule(upgraded, []), validation = fixedScheduleValidation(upgraded, corrected.allMatches);
    return { historicalUnchanged: before === afterHistorical, historicalPolicy: usesUniqueOpponentPolicy(legacy.sched), historicalMatches: historical.allMatches.length, upgradedPolicy: usesUniqueOpponentPolicy(upgraded.sched), correctedMatches: corrected.allMatches.length, validation };
  }, fixedEvent({ id: 'legacy-import', opponentPolicy: '', rounds: 3 }));

  expect(result).toMatchObject({ historicalUnchanged: true, historicalPolicy: false, historicalMatches: 21, upgradedPolicy: true, correctedMatches: 21 });
  expect(result.validation.valid).toBe(true);
  expect(result.validation.duplicateMatchups).toEqual([]);
});
