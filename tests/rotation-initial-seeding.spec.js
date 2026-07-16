import { test, expect } from '@playwright/test';

const ratings = [74, 82, 68, 60, 58, 56, 54, 52, 50];

function roster(hideRatings = false) {
  return ratings.map((rating, i) => ({
    id: `p${i}`,
    name: `Player ${String.fromCharCode(65 + i)}`,
    seedRating: rating,
    rating,
    active: true,
    archived: false,
    roles: {}
  }));
}

function rotatingEvent(id = 'rotation-seeds', seedMode = 'rating') {
  const names = ['Entry A', 'Entry B', 'Entry C', 'Entry D', 'Entry E', 'Entry F', 'Entry G', 'Entry H'];
  return {
    id,
    name: `Rotation ${id}`,
    created: 1,
    done: false,
    format: 'rotatingGroups',
    teams: [],
    brackets: [],
    entries: names.map((name, i) => ({ id: `${id}-e${i}`, name, players: [`p${i}`], manualSeed: i + 1, created: i + 1 })),
    rotation: {
      entrySize: 1,
      teamSize: 2,
      rounds: 3,
      courts: 2,
      seedMode,
      seed: `${id}-seed`,
      revision: 1,
      winPoints: 1,
      tiePoints: .5,
      lossPoints: 0,
      tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor']
    },
    rotationSchedule: []
  };
}

async function seed(page, { events = [rotatingEvent()], games = [], hideRatings = false } = {}) {
  await page.addInitScript(({ players, events, games, hideRatings }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings, playerSort: 'az', numTeams: 2 }));
  }, { players: roster(), events, games, hideRatings });
}

async function openEvent(page, id = 'rotation-seeds') {
  await page.goto('/');
  await page.evaluate(eventId => openEvent(eventId), id);
}

function entryRow(page, name) {
  return page.locator('.stand-row').filter({ hasText: name }).first();
}

test('rating projections use strength instead of entry order and explain the editor value', async ({ page }) => {
  await seed(page);
  await openEvent(page);

  await expect(entryRow(page, 'Entry A')).toContainText('projected seed 2 · rating 74');
  await expect(entryRow(page, 'Entry B')).toContainText('projected seed 1 · rating 82');
  expect(await page.locator('.stand-row:not(.stand-head) b').allTextContents()).toEqual([
    'Entry A', 'Entry B', 'Entry C', 'Entry D', 'Entry E', 'Entry F', 'Entry G', 'Entry H'
  ]);

  await page.evaluate(() => openEntryEditor('rotation-seeds', 'rotation-seeds-e0'));
  await expect(page.getByText('Rating seed strength: 74. Used to project the entry’s initial seed when Schedule seeding is Rating. It never affects standings.', { exact: true })).toBeVisible();

  await page.evaluate(() => { closeSheet(); openRotationSettings('rotation-seeds'); });
  await expect(page.getByText('Rating = strongest entries are initially seeded first. Manual = organizer controls initial order. Random = initial order is randomized.', { exact: true })).toBeVisible();
  await expect(page.getByText('Initial seeding helps construct the schedule and never directly changes standings.', { exact: true })).toBeVisible();
});

test('manual and random projected seeds share the schedule generator ordering', async ({ page }) => {
  await seed(page);
  await page.goto('/');

  const manual = await page.evaluate(() => {
    const ev = evts[0];
    ev.rotation.seedMode = 'manual';
    ev.entries.forEach((entry, i) => entry.manualSeed = [8, 1, 6, 2, 5, 3, 7, 4][i]);
    openEvent(ev.id);
    return entrySeedMetadata(ev).seeds;
  });
  expect(manual).toMatchObject({
    'rotation-seeds-e1': 1,
    'rotation-seeds-e3': 2,
    'rotation-seeds-e5': 3,
    'rotation-seeds-e7': 4
  });
  await expect(entryRow(page, 'Entry B')).toContainText('projected seed 1');
  await expect(entryRow(page, 'Entry D')).toContainText('projected seed 2');

  const result = await page.evaluate(() => {
    const ev = evts[0];
    ev.rotation.seedMode = 'random';
    const random = entrySeedMetadata(ev);
    const seeded = Object.fromEntries(seededEntries(ev).map((entry, i) => [entry.id, i + 1]));
    const generated = generateRotationScheduleData(ev);
    render();
    const displayed = Object.fromEntries(ev.entries.map(entry => {
      const row = document.querySelector(`[data-scroll-key="entry-${entry.id}"]`);
      return [entry.id, Number(row.textContent.match(/projected seed (\d+)/)[1])];
    }));
    return { random: random.seeds, seeded, generated: generated.initialSeeds, displayed };
  });

  expect(result.random).toEqual(result.seeded);
  expect(result.generated).toEqual(result.random);
  expect(result.displayed).toEqual(result.random);
});

test('generation persists initial seeds and later rating or standings changes cannot move them', async ({ page }) => {
  await seed(page);
  await page.goto('/');

  const state = await page.evaluate(async () => {
    const ev = evts[0], expected = generateRotationScheduleData(ev).initialSeeds;
    await generateRotationSchedule(ev.id);
    const snap = { ...ev.rotation.initialSeeds };

    pById('p1').rating = 10;
    pById('p7').rating = 99;
    const afterRatings = entrySeedMetadata(ev);

    const weakest = Object.entries(snap).sort((a, b) => b[1] - a[1])[0][0];
    const strongest = Object.entries(snap).sort((a, b) => a[1] - b[1])[0][0];
    const others = ev.entries.map(entry => entry.id).filter(id => id !== weakest && id !== strongest);
    games.push(
      { id: 'seed-result-1', date: 1, evId: ev.id, evMatchId: 'seed-result-1', eventFormat: 'rotatingGroups', evEntryIdsA: [weakest, others[0]], evEntryIdsB: [strongest, others[1]], scoreA: 25, scoreB: 20, winner: 'A' },
      { id: 'seed-result-2', date: 2, evId: ev.id, evMatchId: 'seed-result-2', eventFormat: 'rotatingGroups', evEntryIdsA: [weakest, others[1]], evEntryIdsB: [strongest, others[0]], scoreA: 25, scoreB: 18, winner: 'A' }
    );
    const standings = entryStandings(ev);
    openEvent(ev.id);
    return {
      expected,
      snap,
      afterRatings: afterRatings.seeds,
      kind: afterRatings.kind,
      leader: standings[0].entry.id,
      leaderStats: { played: standings[0].played, wins: standings[0].wins, losses: standings[0].losses, points: standings[0].standingsPoints },
      strongestStats: (() => { const row = standings.find(item => item.entry.id === strongest); return { wins: row.wins, losses: row.losses, points: row.standingsPoints }; })(),
      persisted: JSON.parse(localStorage.getItem('vb:events'))[0].rotation.initialSeeds
    };
  });

  expect(state.snap).toEqual(state.expected);
  expect(state.persisted).toEqual(state.snap);
  expect(state.afterRatings).toEqual(state.snap);
  expect(state.kind).toBe('initial');
  expect(state.leader).toBe(Object.entries(state.snap).sort((a, b) => b[1] - a[1])[0][0]);
  expect(state.leaderStats).toEqual({ played: 2, wins: 2, losses: 0, points: 2 });
  expect(state.strongestStats).toEqual({ wins: 0, losses: 2, points: 0 });
  await expect(page.locator('.entry-table')).toContainText('initial seed');
  await expect(page.locator('.entry-table')).not.toContainText('projected seed');
});

test('future-round regeneration preserves the snapshot and full regeneration replaces it validly', async ({ page }) => {
  await seed(page, { events: [rotatingEvent('future', 'random'), rotatingEvent('full', 'random')] });
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const future = evById('future');
    await generateRotationSchedule(future.id);
    const beforeSeeds = { ...future.rotation.initialSeeds };
    const firstRound = future.rotationSchedule.filter(match => match.round === 1);
    const played = firstRound[0];
    games.push({
      id: 'locked-game', date: 1, evId: future.id, evMatchId: played.id, eventFormat: 'rotatingGroups',
      evEntryIdsA: played.sideAEntryIds.slice(), evEntryIdsB: played.sideBEntryIds.slice(),
      teamA: played.sideAEntryIds.flatMap(id => entryById(future, id).players),
      teamB: played.sideBEntryIds.flatMap(id => entryById(future, id).players),
      scoreA: 25, scoreB: 20, winner: 'A', log: {}
    });
    const lockedBefore = JSON.stringify(firstRound);
    window.askConfirm = async () => true;
    await generateRotationSchedule(future.id);

    const full = evById('full');
    await generateRotationSchedule(full.id);
    const firstFullSeeds = { ...full.rotation.initialSeeds };
    await generateRotationSchedule(full.id);
    const expectedFull = generateRotationScheduleData(full).initialSeeds;
    return {
      futureSeeds: future.rotation.initialSeeds,
      beforeSeeds,
      lockedSame: JSON.stringify(future.rotationSchedule.filter(match => match.round === 1)) === lockedBefore,
      fullSeeds: full.rotation.initialSeeds,
      firstFullSeeds,
      expectedFull,
      validFull: Object.values(full.rotation.initialSeeds).slice().sort((a, b) => a - b)
    };
  });

  expect(result.futureSeeds).toEqual(result.beforeSeeds);
  expect(result.lockedSame).toBe(true);
  expect(result.fullSeeds).toEqual(result.expectedFull);
  expect(result.validFull).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(Object.values(result.firstFullSeeds).slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test('entry changes retain and flag schedules while seed-mode changes clear the unplayed plan', async ({ page }) => {
  const events = ['add', 'edit', 'delete', 'mode'].map(id => rotatingEvent(id));
  await seed(page, { events });
  await page.goto('/');

  const result = await page.evaluate(async () => {
    for (const ev of evts) {
      const made = generateRotationScheduleData(ev);
      ev.rotationSchedule = made.matches;
      ev.rotation.initialSeeds = made.initialSeeds;
    }
    window.askConfirm = async () => true;

    openEntryEditor('add');
    window._entryDraft.players = new Set(['p8']);
    await saveEntry();

    openEntryEditor('edit', 'edit-e0');
    document.querySelector('#entryName').value = 'Edited Entry';
    await saveEntry();

    openEntryEditor('delete', 'delete-e0');
    await deleteEntry();

    openRotationSettings('mode');
    document.querySelector('#rotationSeedMode').value = 'manual';
    scheduleFairnessChanged('allowDifference');
    await saveRotationSettings('mode');

    return Object.fromEntries(evts.map(ev => [ev.id, {
      schedule: rotationSchedule(ev).length,
      initialSeeds: ev.rotation.initialSeeds,
      scheduleNeedsReview: ev.rotation.scheduleNeedsReview,
      entries: ev.entries.length,
      seedMode: ev.rotation.seedMode
    }]));
  });

  expect(result.add).toMatchObject({ schedule: 6, entries: 9, scheduleNeedsReview: true });
  expect(result.edit).toMatchObject({ schedule: 6, entries: 8, scheduleNeedsReview: true });
  expect(result.delete).toMatchObject({ schedule: 6, entries: 7, scheduleNeedsReview: true });
  expect(result.mode).toMatchObject({ schedule: 0, entries: 8, seedMode: 'manual' });
  expect(result.add.initialSeeds).toBeDefined();
  expect(result.edit.initialSeeds).toBeDefined();
  expect(result.delete.initialSeeds).toBeDefined();
  expect(result.mode.initialSeeds).toBeUndefined();
});

test('legacy snapshots are optional and hidden ratings never leak through seed labels', async ({ page }) => {
  const legacy = rotatingEvent('legacy');
  legacy.rotationSchedule = [{
    id: 'legacy-r1-c1', round: 1, court: 1,
    sideAEntryIds: ['legacy-e0', 'legacy-e1'], sideBEntryIds: ['legacy-e2', 'legacy-e3'], status: 'pending'
  }];
  await seed(page, { events: [legacy], hideRatings: true });
  await openEvent(page, 'legacy');

  expect(await page.evaluate(() => entrySeedMetadata(evts[0]).kind)).toBe('projected');
  await expect(page.locator('.entry-table')).toContainText('projected seed');
  await expect(page.locator('.entry-table')).not.toContainText(/rating \d/);
  await expect(entryRow(page, 'Entry B')).not.toContainText('82');

  await page.evaluate(() => openEntryEditor('legacy', 'legacy-e1'));
  await expect(page.getByText('Rating seed strength is hidden. Used to project the entry’s initial seed when Schedule seeding is Rating. It never affects standings.', { exact: true })).toBeVisible();
});
