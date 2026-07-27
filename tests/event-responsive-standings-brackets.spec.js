import { test, expect } from '@playwright/test';

/* EUX-05 — responsive rotating standings and brackets.
   Below 760px the rotating standings table becomes stacked labeled rows and a
   bracket shows one round at a time; 760px and up keeps the wide table and the
   multi-column bracket. */

const ENTRY_NAMES = ['Alpha Pair', 'Bravo Pair', 'Charlie Pair', 'Delta Pair'];

function roster() {
  return Array.from({ length: 16 }, (_, i) => ({
    id: `p${i}`, name: `Player ${String.fromCharCode(65 + i)}`, seedRating: 70 - i,
    rating: 70 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 70 - i }]
  }));
}

function rotatingEvent() {
  return {
    id: 'rot', name: 'Saturday Rotation', eventDate: '2026-07-27', created: 1, done: false,
    format: 'rotatingGroups', teams: [], brackets: [],
    entries: ENTRY_NAMES.map((name, i) => ({ id: `e${i}`, name, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1, created: i + 1 })),
    rotation: {
      entrySize: 2, teamSize: 4, rounds: 2, courts: 1, seedMode: 'manual', seed: 'rot-seed', revision: 1,
      winPoints: 1, tiePoints: .5, lossPoints: 0, tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor']
    },
    rotationSchedule: []
  };
}

/* Two completed rotating matches, so every standings column carries a real
   value instead of a zero. */
function rotatingGames() {
  const match = (id, date, a, b, scoreA, scoreB) => ({
    id, date, evId: 'rot', evMatchId: id, eventFormat: 'rotatingGroups',
    evEntryIdsA: a, evEntryIdsB: b, teamA: [], teamB: [],
    scoreA, scoreB, winner: scoreA > scoreB ? 'A' : 'B', log: {}
  });
  return [
    match('rot-m1', 20, ['e0', 'e1'], ['e2', 'e3'], 25, 18),
    match('rot-m2', 30, ['e0', 'e2'], ['e1', 'e3'], 21, 25)
  ];
}

function fixedBracketEvent({ withSchedule = false, games = [] } = {}) {
  const teams = Array.from({ length: 8 }, (_, i) => ({ id: `t${i + 1}`, name: `Seed ${i + 1}`, pool: 'A', players: [`p${i}`] }));
  const event = {
    id: 'cup', name: 'Sunday Cup', eventDate: '2026-07-27', created: 1, done: false, teams,
    brackets: [{ id: 'gold', name: 'Gold', created: 100, seeds: teams.map(t => t.id) }]
  };
  if (withSchedule) event.sched = { start: '09:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'cup-seed', revision: 1 };
  return { event, games };
}

/* Quarterfinal results for seeds 1v8 and 4v5, leaving the rest of round 1 open. */
function quarterfinalGames() {
  const set = (id, date, matchIndex, a, b) => ({
    id, date, evId: 'cup', evA: a, evB: b, evMatchId: `playoff:gold:r1:m${matchIndex}`,
    matchId: `qf-${matchIndex}`, teamA: [], teamB: [], unkA: 1, unkB: 1,
    scoreA: 25, scoreB: 19, winner: 'A', log: {}
  });
  return [set('qf1-s1', 200, 1, 't1', 't8'), set('qf1-s2', 201, 1, 't1', 't8')];
}

async function seed(page, { events, games = [] }) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { events, games, players: roster() });
}

async function openEvent(page, id, section) {
  await page.goto('/');
  await page.evaluate(eventId => openEvent(eventId), id);
  if (section) await page.evaluate(sectionId => eventSection(sectionId), section);
}

const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('rotating standings stack without a horizontal scroller at 320px and 375px', async ({ page }) => {
  await seed(page, { events: [rotatingEvent()], games: rotatingGames() });

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 780 });
    await openEvent(page, 'rot', 'entries');

    const table = page.locator('.entry-table');
    await expect(table).toBeVisible();
    const scroller = await table.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(scroller.scrollWidth, `${width}px standings scroller`).toBeLessThanOrEqual(scroller.clientWidth + 1);
    expect(await overflow(page), `${width}px document overflow`).toBeLessThanOrEqual(0);

    /* The wide-table header stands down; each value carries its own label. */
    await expect(page.locator('.entry-table .stand-head')).toBeHidden();

    /* Bravo swept its second match, so Alpha sits second on win percentage. */
    const row = page.locator('.stand-row').filter({ hasText: 'Alpha Pair' }).first();
    await expect(row.locator('.entry-rank')).toHaveText('2');
    await expect(row.locator('.entry-name b')).toHaveText('Alpha Pair');
    const stats = await row.evaluate(el => Object.fromEntries([...el.querySelectorAll('.entry-stat')]
      .map(stat => [stat.dataset.stat, { label: stat.querySelector('.entry-stat-label')?.textContent, value: stat.querySelector('.entry-stat-value')?.textContent }])));
    expect(stats).toEqual({
      played: { label: 'P · Win%', value: '2 · 50%' },
      record: { label: 'W-L-T', value: '1-1-0' },
      points: { label: 'Pts', value: '1' },
      diff: { label: '+/-', value: '+3' },
      pfpa: { label: 'PF-PA', value: '46-43' }
    });

    /* Nothing is clipped off the right edge of the card. */
    const clipped = await row.evaluate(el => {
      const limit = el.getBoundingClientRect().right + 1;
      return [...el.querySelectorAll('.entry-stat')].filter(stat => stat.getBoundingClientRect().right > limit).length;
    });
    expect(clipped, `${width}px clipped standings values`).toBe(0);
  }
});

test('standings row activation still opens the participant schedule', async ({ page }) => {
  await seed(page, { events: [rotatingEvent()], games: rotatingGames() });
  await page.setViewportSize({ width: 375, height: 780 });
  await openEvent(page, 'rot', 'entries');

  await page.locator('.stand-row').filter({ hasText: 'Bravo Pair' }).first().click();
  const sheet = page.locator('.sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Bravo Pair');
});

test('every bracket round is reachable one at a time on a phone', async ({ page }) => {
  await seed(page, { events: [fixedBracketEvent().event], games: quarterfinalGames() });
  await page.setViewportSize({ width: 375, height: 780 });
  await openEvent(page, 'cup', 'playoffs');

  const scroll = page.locator('.bracket-scroll');
  const scroller = await scroll.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const tabs = page.locator('.bracket-rounds button');
  await expect(tabs).toHaveText(['Quarterfinals', 'Semifinals', 'Final', 'Champion']);
  /* Quarterfinals still have open matches, so that is where the card opens. */
  await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true');

  for (let index = 0; index < 4; index++) {
    await tabs.nth(index).click();
    await expect(page.locator('.br-col:visible')).toHaveCount(1);
    await expect(page.locator(`.br-col[data-round-index="${index}"]`)).toBeVisible();
    await expect(tabs.nth(index)).toHaveAttribute('aria-pressed', 'true');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  }
  await expect(page.locator('.br-champ')).toBeVisible();
});

test('bracket matches open by touch and keyboard and the chosen round survives a rerender', async ({ page }) => {
  await seed(page, { events: [fixedBracketEvent().event], games: quarterfinalGames() });
  await page.setViewportSize({ width: 375, height: 780 });
  await openEvent(page, 'cup', 'playoffs');

  /* Keyboard: the completed quarterfinal opens from the focused control and
     focus returns to it when the sheet closes. */
  const completed = page.locator('.br-match.complete:visible').first();
  await completed.focus();
  await expect(completed).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sheet')).toContainText('Quarterfinal');
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(completed).toBeFocused();

  /* Touch: a ready quarterfinal opens the logging sheet for that matchup. */
  await page.locator('.br-match.ready:visible').first().click();
  await expect(page.locator('.sheet')).toBeVisible();
  expect(await page.evaluate(() => window._evGameDraft?.label)).toContain('Quarterfinal');
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);

  /* Hidden rounds are display:none, so their controls stay out of tab order. */
  await expect(page.locator('.br-col[data-round-active="false"] .br-match').first()).toBeHidden();

  await page.locator('.bracket-rounds button').nth(1).click();
  await page.evaluate(() => render());
  await expect(page.locator('.br-col[data-round-index="1"]')).toBeVisible();
  await expect(page.locator('.bracket-rounds button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.br-col:visible')).toHaveCount(1);
});

test('desktop keeps the standings table and the multi-column bracket', async ({ page }) => {
  await seed(page, { events: [rotatingEvent(), fixedBracketEvent().event], games: [...rotatingGames(), ...quarterfinalGames()] });
  await page.setViewportSize({ width: 1280, height: 900 });

  await openEvent(page, 'rot');
  await expect(page.locator('.entry-table .stand-head')).toBeVisible();
  const layout = await page.locator('.entry-table .stand-row').first().evaluate(el => getComputedStyle(el).display);
  expect(layout).toBe('grid');
  await expect(page.locator('.entry-stat-label').first()).toBeHidden();
  await expect(page.locator('.stand-row').filter({ hasText: 'Alpha Pair' }).first()).toContainText('1-1-0');

  await openEvent(page, 'cup');
  await expect(page.locator('.bracket-rounds')).toBeHidden();
  await expect(page.locator('.br-col:visible')).toHaveCount(4);
  /* Rounds sit side by side rather than stacked. */
  const columns = await page.locator('.br-col').evaluateAll(els => els.map(el => {
    const box = el.getBoundingClientRect();
    return { left: Math.round(box.left), top: Math.round(box.top) };
  }));
  expect(new Set(columns.map(c => c.left)).size).toBe(4);
  expect(new Set(columns.map(c => c.top)).size).toBe(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the bracket setup sheet warns about unfinished pool play without blocking the organizer', async ({ page }) => {
  const { event } = fixedBracketEvent({ withSchedule: true });
  event.brackets = [];
  await seed(page, { events: [event] });
  await page.goto('/');

  const warned = await page.evaluate(() => {
    openBracketSetup('cup');
    const sheet = document.querySelector('.sheet');
    return { note: sheet.querySelector('[data-pool-incomplete]')?.textContent || '', facts: eventLifecycleFacts(evts[0]) };
  });
  expect(warned.facts.poolsComplete).toBe(false);
  expect(warned.note).toContain('Pool play is not finished');
  expect(warned.note).toContain('You can create and run this bracket anyway.');

  const created = await page.evaluate(async () => {
    brUseAutomatic(); brName('Gold');
    const disabled = document.querySelector('#brCreate').disabled;
    await createBracketNow();
    return { disabled, brackets: evts[0].brackets.length };
  });
  expect(created.disabled).toBe(false);
  expect(created.brackets).toBe(1);
});

test('a completed pool schedule drops the warning', async ({ page }) => {
  const { event } = fixedBracketEvent();
  event.brackets = [];
  await seed(page, { events: [event] });
  await page.goto('/');
  const note = await page.evaluate(() => {
    openBracketSetup('cup');
    return document.querySelector('.sheet').querySelector('[data-pool-incomplete]');
  });
  expect(note).toBeNull();
});
