import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'America/Chicago' });

async function seed(page, { events = [], games = [] } = {}) {
  await page.addInitScript(({ events, games }) => {
    window.__backupText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__backupText = text; } }
    });
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
  }, { events, games });
}

async function openEvents(page) {
  await page.locator('[data-tab="events"]:visible').first().click();
}

test('event creation defaults locally, selected and edited dates persist, and backups round-trip the date', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openEvents(page);
  await page.getByRole('button', { name: 'New event', exact: true }).click();

  const localToday = await page.evaluate(() => todayLocalDate());
  const dateInput = page.locator('#evDate');
  await expect(dateInput).toHaveAttribute('type', 'date');
  await expect(dateInput).toHaveAttribute('required', '');
  await expect(dateInput).toHaveValue(localToday);

  await page.locator('#evName').fill('Date Cup');
  await dateInput.fill('2026-07-18');
  await page.getByRole('button', { name: 'Create event', exact: true }).click();

  let state = await page.evaluate(() => ({
    memory: evts[0].eventDate,
    stored: JSON.parse(localStorage.getItem('vb:events'))[0].eventDate
  }));
  expect(state).toEqual({ memory: '2026-07-18', stored: '2026-07-18' });
  await expect(page.locator('main .screen-head')).toContainText('July 18, 2026');

  await page.getByRole('button', { name: 'Event details', exact: true }).click();
  await page.locator('#evDate').fill('2026-07-19');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.evaluate(async () => { evts = []; await load(); });
  state = await page.evaluate(() => ({
    memory: evts[0].eventDate,
    stored: JSON.parse(localStorage.getItem('vb:events'))[0].eventDate
  }));
  expect(state).toEqual({ memory: '2026-07-19', stored: '2026-07-19' });

  const backup = await page.evaluate(async () => {
    await exportData();
    return JSON.parse(window.__backupText);
  });
  expect(backup.events[0].eventDate).toBe('2026-07-19');

  await page.evaluate(async () => { evts = []; await saveEvents(); render(); openImport(); });
  await page.locator('#impTxt').fill(JSON.stringify(backup));
  await page.getByRole('button', { name: 'Restore from paste', exact: true }).click();
  await expect.poll(() => page.evaluate(() => evts[0]?.eventDate)).toBe('2026-07-19');
  await page.evaluate(async () => { evts = []; await load(); });
  expect(await page.evaluate(() => evts[0]?.eventDate)).toBe('2026-07-19');
});

test('legacy event-date migration uses local created dates, falls back safely, is idempotent, and preserves unrelated fields', async ({ page }) => {
  const created = new Date(2026, 6, 17, 23, 45, 0, 0).getTime();
  const events = [
    { id: 'created', name: 'Created fallback', created, done: false, teams: [], brackets: [], history: { untouched: [1, 2, 3] } },
    { id: 'invalid', name: 'Invalid fallback', eventDate: '07/18/2026', created, done: false, teams: [], brackets: [], seeds: ['a', 'b'] },
    { id: 'today', name: 'Today fallback', eventDate: 'not-a-date', created: null, done: false, teams: [], brackets: [], custom: 'keep' },
    { id: 'valid', name: 'Valid date', eventDate: '2026-08-02', created, done: false, teams: [], brackets: [], custom: 'valid' }
  ];
  await seed(page, { events });
  await page.goto('/');

  const result = await page.evaluate(() => {
    const migratedOnce = JSON.parse(JSON.stringify(evts));
    migrateEvents();
    const migratedTwice = JSON.parse(JSON.stringify(evts));
    const withoutDates = migratedOnce.map(event => { const copy = { ...event }; delete copy.eventDate; return copy; });
    const rawWithoutDates = JSON.parse(localStorage.getItem('vb:events')).map(event => { const copy = { ...event }; delete copy.eventDate; return copy; });
    return {
      dates: migratedOnce.map(event => event.eventDate),
      expectedCreated: localDateFromTimestamp(migratedOnce[0].created),
      today: todayLocalDate(),
      idempotent: JSON.stringify(migratedOnce) === JSON.stringify(migratedTwice),
      unrelatedSame: JSON.stringify(withoutDates) === JSON.stringify(rawWithoutDates)
    };
  });

  expect(result.dates).toEqual([result.expectedCreated, result.expectedCreated, result.today, '2026-08-02']);
  expect(result.idempotent).toBe(true);
  expect(result.unrelatedSame).toBe(true);
});

test('fixed and rotating planned schedules use the event date, ignore the current clock, cross midnight clearly, and stay read-only', async ({ page }) => {
  await seed(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const parts = timestamp => {
      const d = new Date(timestamp);
      return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
    };
    const baseFixed = {
      id: 'fixed-plan', name: 'Fixed Plan', eventDate: '2026-07-18', created: 1, done: false,
      teams: Array.from({ length: 4 }, (_, i) => ({ id: `ft${i}`, name: `Fixed ${i + 1}`, pool: 'A', players: [] })),
      sched: { start: '09:00', courts: 1, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'date-fixed', revision: 4 },
      brackets: []
    };
    const viewedLate = new Date(2026, 6, 18, 10, 15).getTime();
    const viewedEarlier = new Date(2026, 6, 10, 8, 0).getTime();
    const viewedLater = new Date(2026, 6, 25, 8, 0).getTime();
    const todaySchedule = buildSchedule(baseFixed, [], viewedLate);
    const futureSchedule = buildSchedule({ ...baseFixed, eventDate: '2026-07-20' }, [], viewedEarlier);
    const pastSchedule = buildSchedule({ ...baseFixed, eventDate: '2026-07-10' }, [], viewedLater);

    const dateChanged = { ...baseFixed, eventDate: '2026-07-19' };
    const timingChanged = { ...baseFixed, sched: { ...baseFixed.sched, start: '13:30', setMin: 35 } };
    const dateSchedule = buildSchedule(dateChanged, [], viewedLate);
    const timingSchedule = buildSchedule(timingChanged, [], viewedLate);
    const dstSpring = parts(combineLocalDateTime('2026-03-08', '01:50', 20));
    const dstFall = parts(combineLocalDateTime('2026-11-01', '00:50', 80));

    const overnight = {
      ...baseFixed, id: 'overnight', name: 'Overnight Cup', eventDate: '2026-07-18',
      sched: { ...baseFixed.sched, start: '23:50', setMin: 20, seed: 'overnight' }
    };
    const overnightModel = deriveFullScheduleExportModel(overnight, { gameList: [], playerList: [], now: viewedLate });

    const fixedBefore = JSON.stringify(baseFixed);
    const fixedFull = deriveFullScheduleExportModel(baseFixed, { gameList: [], playerList: [], now: viewedLate });
    const fixedParticipant = deriveParticipantScheduleExportModel(baseFixed, 'team', 'ft0', { gameList: [], playerList: [], now: viewedLate });
    scheduleExportPreviewHtml(fixedFull);
    await createScheduleHtmlFile(fixedFull).text();
    const fixedReadOnly = fixedBefore === JSON.stringify(baseFixed);

    const rotating = {
      id: 'rot-plan', name: 'Rotating Plan', eventDate: '2026-07-18', created: 1, done: false, format: 'rotatingGroups', teams: [], brackets: [],
      entries: Array.from({ length: 8 }, (_, i) => ({ id: `re${i}`, name: `Entry ${i + 1}`, players: [`rp${i}`], manualSeed: i + 1 })),
      rotation: { entrySize: 1, teamSize: 2, rounds: 3, courts: 2, seedMode: 'manual', start: '09:00', setMin: 20, matchMin: 45, breakMin: 10, seed: 'date-rotation', revision: 2 }
    };
    rotating.rotationSchedule = generateRotationScheduleData(rotating).matches;
    const firstRotating = rotating.rotationSchedule[0];
    const rotatingGame = { id: 'played', date: viewedLate, evId: rotating.id, evMatchId: firstRotating.id };
    const rotatingBefore = JSON.stringify(rotating);
    const timeline = rotationTimeline(rotating, [rotatingGame], viewedLate);
    const rotatingFull = deriveFullScheduleExportModel(rotating, { gameList: [rotatingGame], playerList: [], now: viewedLate });
    const rotatingParticipant = deriveParticipantScheduleExportModel(rotating, 'entry', firstRotating.sideAEntryIds[0], { gameList: [rotatingGame], playerList: [], now: viewedLate });
    scheduleExportPreviewHtml(rotatingFull);

    return {
      today: todaySchedule.slots.slice(0, 3).map(slot => parts(slot[0].est)),
      todayMode: todaySchedule.timeMode,
      future: parts(futureSchedule.slots[0][0].est),
      past: parts(pastSchedule.slots[0][0].est),
      dateSame: fixedSchedulePlacementSignature(todaySchedule) === fixedSchedulePlacementSignature(dateSchedule),
      timingSame: fixedSchedulePlacementSignature(todaySchedule) === fixedSchedulePlacementSignature(timingSchedule),
      revisions: [baseFixed.sched.revision, dateChanged.sched.revision, timingChanged.sched.revision],
      dstSpring,
      dstFall,
      overnightTimes: overnightModel.rounds.slice(0, 3).map(round => round.time),
      fixedFullTimes: fixedFull.rounds.slice(0, 3).map(round => round.time),
      fixedParticipantTimes: fixedParticipant.rows.slice(0, 3).map(row => row.time),
      fixedDate: fixedFull.eventDate,
      fixedReadOnly,
      rotatingTimes: Object.values(timeline.roundEst).map(parts),
      rotatingMode: timeline.timeMode,
      rotatingFullTimes: rotatingFull.rounds.map(round => round.time),
      rotatingParticipantTimes: rotatingParticipant.rows.map(row => row.time),
      rotatingDate: rotatingFull.eventDate,
      rotatingReadOnly: rotatingBefore === JSON.stringify(rotating)
    };
  });

  expect(result.todayMode).toBe('planned');
  expect(result.today).toEqual([
    [2026, 7, 18, 9, 0],
    [2026, 7, 18, 9, 20],
    [2026, 7, 18, 9, 40]
  ]);
  expect(result.future).toEqual([2026, 7, 20, 9, 0]);
  expect(result.past).toEqual([2026, 7, 10, 9, 0]);
  expect(result.dateSame && result.timingSame).toBe(true);
  expect(result.revisions).toEqual([4, 4, 4]);
  expect(result.dstSpring).toEqual([2026, 3, 8, 3, 10]);
  expect(result.dstFall).toEqual([2026, 11, 1, 2, 10]);
  expect(result.overnightTimes[0]).toBe('11:50 PM');
  expect(result.overnightTimes[1]).toMatch(/^12:10 AM · Jul 19, 2026$/);
  expect(result.fixedFullTimes).toEqual(['9:00 AM', '9:20 AM', '9:40 AM']);
  expect(result.fixedParticipantTimes.every(time => /^9:(00|20|40) AM$/.test(time))).toBe(true);
  expect(result.fixedDate).toBe('July 18, 2026');
  expect(result.fixedReadOnly).toBe(true);
  expect(result.rotatingMode).toBe('planned');
  expect(result.rotatingTimes).toEqual([
    [2026, 7, 18, 9, 0],
    [2026, 7, 18, 9, 20],
    [2026, 7, 18, 9, 40]
  ]);
  expect(result.rotatingFullTimes).toEqual(['9:00 AM', '9:20 AM', '9:40 AM']);
  expect(result.rotatingParticipantTimes).toEqual(['9:00 AM', '9:20 AM', '9:40 AM']);
  expect(result.rotatingDate).toBe('July 18, 2026');
  expect(result.rotatingReadOnly).toBe(true);
});
