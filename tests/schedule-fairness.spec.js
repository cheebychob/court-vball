import { test, expect } from '@playwright/test';

function fairnessData() {
  const players = Array.from({ length: 40 }, (_, i) => ({
    id: `p${i}`, name: `Player ${i + 1}`, seedRating: 40 + (i % 20), rating: 40 + (i % 20),
    active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 40 + (i % 20) }]
  }));
  const rotating = {
    id: 'rot-fair', name: 'Rotating Fairness Cup', eventDate: '2026-07-18', created: 1, done: false,
    format: 'rotatingGroups', teams: [], brackets: [],
    entries: Array.from({ length: 16 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1, created: 1 })),
    rotation: { entrySize: 2, teamSize: 4, rounds: 5, courts: 3, seedMode: 'manual', start: '09:00', setMin: 25, matchMin: 45, breakMin: 10, winPoints: 1, tiePoints: .5, lossPoints: 0, tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor'], seed: 'fairness-seed', revision: 1 },
    rotationSchedule: []
  };
  const fixed = {
    id: 'fixed-fair', name: 'Fixed Fairness Cup', eventDate: '2026-07-18', created: 2, done: false,
    format: 'fixedTeams', brackets: [], teams: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Team ${i + 1}`, pool: '', players: [] }))
  };
  return { players, events: [rotating, fixed] };
}

async function seed(page) {
  const data = fairnessData();
  await page.addInitScript(({ players, events }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
    localStorage.setItem('vb:events', JSON.stringify(events));
  }, data);
  await page.goto('/');
}

test('rotating mobile flow requires a policy, adds one makeup match, and can keep exactly five rounds', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.evaluate(() => { openEvent('rot-fair'); openRotationSettings('rot-fair'); });

  const sheet = page.locator('.sheet');
  await expect(sheet).toContainText('Equal games require 1 makeup match');
  await expect(sheet).toContainText('12 pairs × 4 games');
  await expect(sheet).toContainText('4 pairs × 3 games');
  await expect(sheet).toContainText('4 rounds · equal without makeup');
  await expect(sheet.getByRole('radio', { name: /Equal games/ })).not.toBeChecked();

  await sheet.getByRole('radio', { name: /Equal games/ }).check();
  await sheet.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.locator('#event-schedule').getByRole('button', { name: 'Generate schedule', exact: true }).click();

  const schedule = page.locator('#event-schedule');
  await expect(schedule.getByText('Makeup matches', { exact: false }).first()).toBeVisible();
  await expect(schedule.locator('.makeup-label')).toContainText('balances games played');
  await expect(schedule.locator('[data-schedule-fairness-audit]')).toContainText('Games per pair: 4');
  await expect(schedule.locator('[data-schedule-fairness-audit]')).toContainText('Makeup matches: 1');

  const generated = await page.evaluate(() => {
    const ev = evById('rot-fair'), matches = rotationSchedule(ev), makeup = matches.filter(isMakeupScheduleMatch)[0];
    const involved = makeup.sideAEntryIds[0], notInvolved = ev.entries.find(entry => !rotationMatchEntryIds(makeup).includes(entry.id)).id;
    const full = deriveScheduleExportModel(ev, { gameList: [], playerList: players });
    const participant = deriveParticipantScheduleExportModel(ev, 'entry', involved, { gameList: [], playerList: players });
    const uninvolved = deriveParticipantScheduleExportModel(ev, 'entry', notInvolved, { gameList: [], playerList: players });
    const resultGame = { id: 'makeup-result', date: 1, teamA: [], teamB: [], scoreA: 21, scoreB: 18, winner: 'A', log: {}, evId: ev.id, evMatchId: makeup.id, evEntryIdsA: makeup.sideAEntryIds, evEntryIdsB: makeup.sideBEntryIds, eventFormat: 'rotatingGroups' };
    const scored = deriveParticipantScheduleExportModel(ev, 'entry', involved, { gameList: [resultGame], playerList: players });
    return {
      standard: matches.filter(isStandardScheduleMatch).length, makeup: matches.filter(isMakeupScheduleMatch).length,
      counts: Object.values(rotationScheduleAudit(ev, matches).counts), distinct: new Set(rotationMatchEntryIds(makeup)).size,
      fullMakeupSections: full.rounds.filter(round => round.isMakeup).length,
      participantMakeups: participant.rows.filter(row => row.isMakeup).length,
      uninvolvedMakeups: uninvolved.rows.filter(row => row.isMakeup).length,
      makeupResult: scored.rows.find(row => row.isMakeup)?.result?.score,
      persisted: makeup.scheduleBlock === 'makeup' && makeup.makeupIndex === 1 && Number.isInteger(makeup.timeOffsetMinutes)
    };
  });
  expect(generated).toMatchObject({ standard: 15, makeup: 1, distinct: 4, fullMakeupSections: 1, participantMakeups: 1, uninvolvedMakeups: 0, makeupResult: '21–18', persisted: true });
  expect(new Set(generated.counts)).toEqual(new Set([4]));

  await page.evaluate(() => openRotationSettings('rot-fair'));
  await sheet.getByRole('radio', { name: /Keep exactly 5 rounds/ }).check();
  await sheet.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Save and review schedule', exact: true }).click();
  await page.locator('#event-schedule').getByRole('button', { name: 'Generate schedule', exact: true }).click();
  await expect(page.locator('#event-schedule').locator('[data-schedule-fairness-audit]')).toContainText('Games per pair: 3–4');
  expect(await page.evaluate(() => rotationSchedule(evById('rot-fair')).filter(isMakeupScheduleMatch).length)).toBe(0);
});

test('fixed mobile settings produce one makeup match and a fair actual schedule', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.evaluate(() => { openEvent('fixed-fair'); openEvSettings('fixed-fair'); });
  const sheet = page.locator('.sheet');
  await sheet.locator('#evsRounds').fill('5');
  await sheet.locator('#evsCourts').fill('3');
  await sheet.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(sheet).toContainText('Equal games require 1 makeup match');
  await expect(sheet).toContainText('6 teams × 4 games');
  await expect(sheet).toContainText('2 teams × 3 games');
  await sheet.getByRole('radio', { name: /Equal games/ }).check();
  await sheet.getByRole('button', { name: 'Save schedule', exact: true }).click();

  const schedule = page.locator('#event-schedule');
  await expect(schedule).toContainText('Makeup matches');
  await expect(schedule.locator('[data-schedule-fairness-audit]')).toContainText('Games per team: 4');
  const result = await page.evaluate(() => {
    const ev = evById('fixed-fair'), sc = buildSchedule(ev, []), model = deriveScheduleExportModel(ev, { gameList: [], playerList: players });
    return { standard: sc.standardTotal, makeup: sc.makeupSlots.flat().length, counts: Object.values(sc.fairnessAudit.counts), exportMakeup: model.rounds.filter(round => round.isMakeup).length, policy: ev.sched.fairnessPolicy };
  });
  expect(result).toMatchObject({ standard: 15, makeup: 1, exportMakeup: 1, policy: 'equalGames' });
  expect(new Set(result.counts)).toEqual(new Set([4]));
});

test('custom match editors reject duplicate participants and linked matches cannot be deleted', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const ev = evById('rot-fair'); ev.rotation.fairnessPolicy = 'equalGames';
    const made = generateRotationScheduleData(ev); ev.rotationSchedule = made.matches; await saveEvents();
    openEvent('rot-fair'); openCustomScheduleMatch('rot-fair');
  });
  const selects = page.locator('[data-custom-entry]');
  await selects.nth(0).selectOption('e0');
  await selects.nth(1).selectOption('e0');
  await selects.nth(2).selectOption('e1');
  await selects.nth(3).selectOption('e2');
  await page.locator('.sheet').getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('Scheduled entry composition is invalid');

  await selects.nth(1).selectOption('e1');
  await selects.nth(2).selectOption('e2');
  await selects.nth(3).selectOption('e3');
  await page.locator('.sheet').getByRole('button', { name: 'Save match', exact: true }).click();
  const deletedCustom = await page.evaluate(async () => {
    const ev = evById('rot-fair'), match = rotationSchedule(ev).find(isCustomScheduleMatch);
    window.askConfirm = async () => true;
    await deleteCustomScheduleMatch(ev.id, match.id);
    return { remains: rotationSchedule(ev).some(m => m.id === match.id), tombstone: Sync.deletionState().eventScheduleMatches[match.id] };
  });
  expect(deletedCustom.remains).toBe(false);
  expect(deletedCustom.tombstone).toBeGreaterThan(0);

  const protectedResult = await page.evaluate(async () => {
    const ev = evById('rot-fair'), match = rotationSchedule(ev)[0];
    games.push({ id: 'linked', date: 1, teamA: [], teamB: [], scoreA: 21, scoreB: 19, winner: 'A', log: {}, evId: ev.id, evMatchId: match.id, evEntryIdsA: match.sideAEntryIds, evEntryIdsB: match.sideBEntryIds, eventFormat: 'rotatingGroups' });
    await deleteCustomScheduleMatch(ev.id, match.id);
    return rotationSchedule(ev).some(m => m.id === match.id);
  });
  expect(protectedResult).toBe(true);
  await expect(page.locator('#toast')).toContainText('Delete or unlink the saved result first');
});
