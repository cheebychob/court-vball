import { test, expect } from '@playwright/test';

function roster(count = 24) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${i + 1}`, seedRating: 50 + i, active: true, archived: false, roles: {}
  }));
}

function fixedEvent({ withSchedule = true } = {}) {
  return {
    id: 'fixed-actions', name: 'Fixed Actions Cup', created: 1, done: false, format: 'fixedTeams', brackets: [],
    teams: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Team ${i + 1}`, pool: i < 4 ? 'A' : 'B', players: [`p${i}`] })),
    ...(withSchedule ? {
      sched: { start: '10:00', courts: 2, courtStyle: 'num', standardRounds: 3, fairnessPolicy: 'equalGames', setMin: 20, matchMin: 45, breakMin: 10, seed: 'fixed-actions-seed', revision: 2 },
      fixedScheduleExtras: [
        { id: 'fixed-custom', a: 't0', b: 't1', slot: 3, round: 4, court: 0, scheduleBlock: 'custom', makeupBlock: 1, custom: true, label: 'Keep custom' },
        { id: 'fixed-makeup', a: 't2', b: 't3', slot: 4, round: 5, court: 0, scheduleBlock: 'makeup', makeupBlock: 2, custom: false, label: 'Keep completed makeup' }
      ]
    } : {})
  };
}

function rotatingEvent({ withSchedule = true } = {}) {
  return {
    id: 'rotating-actions', name: 'Rotating Actions Night', created: 1, done: false, format: 'rotatingGroups', teams: [], brackets: [],
    entries: Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1 })),
    rotation: { entrySize: 2, teamSize: 4, rounds: 3, courts: 2, seedMode: 'manual', fairnessPolicy: 'equalGames', start: '09:30', setMin: 20, matchMin: 45, breakMin: 10, winPoints: 1, tiePoints: .5, lossPoints: 0, tiebreakers: ['winPct'], seed: 'rotating-actions-seed', revision: 2 },
    rotationSchedule: withSchedule ? [] : []
  };
}

async function seed(page, events, games = []) {
  await page.addInitScript(({ players, events, games }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { players: roster(), events, games });
}

async function materializeRotation(page, eventId = 'rotating-actions') {
  await page.evaluate(async id => {
    const ev = evById(id), made = generateRotationScheduleData(ev);
    ev.rotationSchedule = made.matches;
    ev.rotationScheduleQuality = made.quality;
    await saveEvents();
  }, eventId);
}

async function openEvent(page, eventId) {
  await page.evaluate(id => openEvent(id), eventId);
}

async function expectPrimaryScheduleActions(page) {
  const actions = page.locator('#event-schedule > .schedule-actions');
  await expect(actions.getByRole('button')).toHaveText(['Schedule settings', /Regenerate/, 'Save / Share Schedule']);
  await expect(actions.getByRole('button', { name: 'Add custom match', exact: true })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Balance games played', exact: true })).toHaveCount(0);
  expect(await actions.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const overflow = await page.evaluate(() => ({
    pixels: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => `${el.tagName.toLowerCase()}.${el.className}[${el.getAttribute('aria-label') || ''}] ${el.textContent.trim().slice(0, 40)}`)
  }));
  expect(overflow.pixels, `narrow schedule view overflow: ${overflow.offenders.join(', ')} ${JSON.stringify(overflow.nav)}`).toBe(0);
}

test('fixed schedule keeps three primary actions and settings workflows discard unsaved drafts on cancel', async ({ page }) => {
  const event = fixedEvent();
  const completed = { id: 'completed-makeup-result', date: 1, teamA: ['p2'], teamB: ['p3'], scoreA: 25, scoreB: 20, winner: 'A', log: {}, evId: event.id, evA: 't2', evB: 't3', evMatchId: 'fixed-makeup', label: 'Keep completed makeup' };
  await seed(page, [event], [completed]); await page.goto('/'); await page.setViewportSize({ width: 320, height: 720 }); await openEvent(page, event.id);
  await expectPrimaryScheduleActions(page);
  const before = await page.evaluate(() => JSON.stringify({ evts, games, players }));

  await page.getByRole('button', { name: 'Schedule settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Courts & schedule · ${event.name}`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Additional schedule actions', exact: true })).toBeVisible();
  await expect(page.getByText('These actions change scheduled matches without applying the settings above.', { exact: true })).toBeVisible();
  await page.locator('#evsStart').fill('11:30');
  await page.getByRole('button', { name: 'Add custom match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add custom match', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);

  await page.getByRole('button', { name: 'Schedule settings', exact: true }).click();
  await page.locator('#evsStart').fill('12:00');
  await page.getByRole('button', { name: 'Balance games played', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Played and custom matches stay unchanged');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);
});

test('rotating schedule keeps three primary actions and reuses custom/balance workflows without applying settings', async ({ page }) => {
  const event = rotatingEvent();
  await seed(page, [event]); await page.goto('/'); await materializeRotation(page); await page.setViewportSize({ width: 390, height: 844 }); await openEvent(page, event.id);
  await expectPrimaryScheduleActions(page);
  const before = await page.evaluate(() => JSON.stringify({ evts, games, players }));

  await page.getByRole('button', { name: 'Schedule settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rotating Groups settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Additional schedule actions', exact: true })).toBeVisible();
  await page.getByLabel('Rounds').fill('6');
  await page.getByRole('button', { name: 'Add custom match', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add custom match', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);

  await page.getByRole('button', { name: 'Schedule settings', exact: true }).click();
  await page.getByLabel('Rounds').fill('7');
  await page.getByRole('button', { name: 'Balance games played', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Played and custom matches stay unchanged');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);
});

test('additional schedule actions only appear after a usable schedule exists', async ({ page }) => {
  const fixed = fixedEvent({ withSchedule: false }), rotating = rotatingEvent({ withSchedule: false });
  await seed(page, [fixed, rotating]); await page.goto('/');

  await page.evaluate(id => openEvSettings(id), fixed.id);
  await expect(page.getByRole('heading', { name: 'Additional schedule actions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add custom match', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.evaluate(id => openRotationSettings(id), rotating.id);
  await expect(page.getByRole('heading', { name: 'Additional schedule actions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Balance games played', exact: true })).toHaveCount(0);
});
