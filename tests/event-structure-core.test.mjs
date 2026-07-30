import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../event-structure-core.js', import.meta.url), 'utf8');
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const core = globalThis.CourtEventStructureCore;

test('shared fixed scheduler is deterministic, pool-scoped, unique-opponent, and fair with makeups', () => {
  const input = {
    eventId: 'fixed-core',
    entries: Array.from({ length: 5 }, (_, index) => ({
      id: `team-${index + 1}`,
      pool: '',
    })),
    settings: {
      rounds: 2,
      courts: 2,
      fairnessPolicy: 'equalGames',
      seed: 'fixed-core-seed',
      revision: 3,
    },
  };
  const first = core.generateFixedSchedule(input);
  const second = core.generateFixedSchedule(structuredClone(input));
  assert.deepEqual(second, first);
  assert.equal(first.error, undefined);
  assert.equal(first.audit.gameDifference, 0);
  assert.equal(first.audit.duplicateOpponentCount, 0);
  const bySlot = new Map();
  first.matches.forEach(match => {
    const used = bySlot.get(match.slot) || new Set();
    assert.equal(used.has(match.a) || used.has(match.b), false);
    used.add(match.a);
    used.add(match.b);
    bySlot.set(match.slot, used);
  });

  const pooled = core.generateFixedSchedule({
    eventId: 'pooled-core',
    entries: Array.from({ length: 6 }, (_, index) => ({
      id: `pool-team-${index + 1}`,
      pool: index < 3 ? 'A' : 'B',
    })),
    settings: {
      rounds: 3,
      courts: 2,
      fairnessPolicy: 'allowDifference',
      seed: 'pooled-core-seed',
      revision: 1,
    },
  });
  assert.equal(pooled.error, undefined);
  const pools = new Map(Array.from({ length: 6 }, (_, index) => [
    `pool-team-${index + 1}`,
    index < 3 ? 'A' : 'B',
  ]));
  assert.ok(pooled.matches.every(match => pools.get(match.a) === pools.get(match.b)));
  assert.equal(new Set(pooled.matches.map(match => [match.a, match.b].sort().join('|'))).size, pooled.matches.length);
});

test('shared rotating scheduler preserves locks and minimizes only unavoidable repeats', () => {
  const input = {
    eventId: 'rotation-core',
    entries: ['a', 'b', 'c', 'd'].map(id => ({ id, players: [`player-${id}`] })),
    settings: {
      entrySize: 1,
      teamSize: 2,
      rounds: 3,
      courts: 1,
      fairnessPolicy: 'allowDifference',
      seed: 'rotation-core-seed',
      revision: 4,
    },
  };
  const generated = core.generateRotatingSchedule(input);
  assert.equal(generated.error, undefined);
  assert.equal(generated.matches.length, 3);
  assert.equal(generated.audit.invalidRounds, 0);
  assert.equal(generated.audit.avoidableOpponentRepeats, 0);
  assert.equal(new Set(generated.matches.map(match => [
    match.sideAEntryIds.slice().sort().join(','),
    match.sideBEntryIds.slice().sort().join(','),
  ].sort().join('~'))).size, 3);

  const locked = structuredClone(generated.matches[0]);
  const regenerated = core.generateRotatingSchedule({
    ...input,
    settings: { ...input.settings, revision: 5 },
    lockedMatches: [locked],
  });
  assert.equal(regenerated.error, undefined);
  assert.deepEqual(regenerated.matches.find(match => match.id === locked.id), locked);
  assert.equal(regenerated.audit.invalidRounds, 0);
});

test('shared fixed scheduler keeps standard and makeup matches on pool-eligible courts', () => {
  const entries = ['A', 'B'].flatMap(pool => Array.from({ length: 5 }, (_, index) => ({
    id: `${pool}-${index + 1}`,
    pool,
  })));
  const settings = {
    rounds: 3,
    courts: 3,
    fairnessPolicy: 'equalGames',
    seed: 'fixed-pool-courts',
    revision: 1,
    poolCourtAssignments: {
      enabled: true,
      courts: { 1: 'A', 2: 'B', 3: '*' },
    },
  };
  const generated = core.generateFixedSchedule({ eventId: 'fixed-pools', entries, settings });
  assert.equal(generated.error, undefined);
  assert.equal(generated.audit.gameDifference, 0);
  assert.ok(generated.matches.some(match => match.scheduleBlock === 'makeup'));
  assert.ok(generated.matches.every(match =>
    match.pool === 'A' ? [0, 2].includes(match.court) : [1, 2].includes(match.court)));
  assert.equal(new Set(generated.matches.map(match =>
    [match.a, match.b].sort().join('|'))).size, generated.matches.length);

  const unavailable = core.generateFixedSchedule({
    eventId: 'fixed-no-court',
    entries,
    settings: {
      ...settings,
      courts: 2,
      poolCourtAssignments: { enabled: true, courts: { 1: 'A', 2: 'A' } },
    },
  });
  assert.deepEqual(unavailable.error, [
    'pool_has_no_court',
    'Pool B has no eligible court.',
  ]);
});

test('shared rotating scheduler isolates pools, honors dedicated/shared courts, and rejects undersized pools', () => {
  const entries = ['A', 'B'].flatMap(pool => Array.from({ length: 5 }, (_, index) => ({
    id: `${pool}-${index + 1}`,
    pool,
    players: [`player-${pool}-${index + 1}`],
  })));
  const settings = {
    entrySize: 1,
    teamSize: 2,
    rounds: 3,
    courts: 3,
    fairnessPolicy: 'equalGames',
    seed: 'rotating-pool-courts',
    revision: 1,
    poolCourtAssignments: {
      enabled: true,
      courts: { 1: 'A', 2: 'B', 3: '*' },
    },
  };
  const generated = core.generateRotatingSchedule({
    eventId: 'rotating-pools',
    entries,
    settings,
  });
  const poolById = new Map(entries.map(entry => [entry.id, entry.pool]));
  assert.equal(generated.error, undefined);
  assert.equal(generated.audit.gameDifference, 0);
  assert.equal(generated.audit.avoidableOpponentRepeats, 0);
  assert.ok(generated.matches.some(match => match.scheduleBlock === 'makeup'));
  assert.ok(generated.matches.every(match => {
    const participants = [...match.sideAEntryIds, ...match.sideBEntryIds];
    return participants.every(id => poolById.get(id) === match.pool)
      && (match.pool === 'A' ? [1, 3].includes(match.court) : [2, 3].includes(match.court));
  }));
  const byRound = new Map();
  generated.matches.forEach(match => {
    const round = byRound.get(match.round) || [];
    round.push(match);
    byRound.set(match.round, round);
  });
  assert.ok([...byRound.values()].every(matches => {
    const participants = matches.flatMap(match => [...match.sideAEntryIds, ...match.sideBEntryIds]);
    return new Set(participants).size === participants.length
      && new Set(matches.map(match => match.court)).size === matches.length;
  }));

  const tooSmall = core.generateRotatingSchedule({
    eventId: 'rotating-small-pool',
    entries: entries.filter(entry => entry.pool === 'A' || Number(entry.id.split('-')[1]) <= 3),
    settings,
  });
  assert.equal(tooSmall.error?.[0], 'pool_too_small');
  assert.match(tooSmall.error?.[1] || '', /Pool B has 3 entries/);
});

test('shared bracket order keeps top seeds on opposite sides', () => {
  assert.deepEqual(core.bracketSeedOrder(2), [0, 1]);
  assert.deepEqual(core.bracketSeedOrder(4), [0, 3, 1, 2]);
  assert.deepEqual(core.bracketSeedOrder(8), [0, 7, 3, 4, 1, 6, 2, 5]);
});
