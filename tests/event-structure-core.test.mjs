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

test('shared bracket order keeps top seeds on opposite sides', () => {
  assert.deepEqual(core.bracketSeedOrder(2), [0, 1]);
  assert.deepEqual(core.bracketSeedOrder(4), [0, 3, 1, 2]);
  assert.deepEqual(core.bracketSeedOrder(8), [0, 7, 3, 4, 1, 6, 2, 5]);
});
