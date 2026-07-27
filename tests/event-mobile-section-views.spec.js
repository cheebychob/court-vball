import { test, expect } from '@playwright/test';

/* EUX-04 — mobile event section views.
   Below the mobile breakpoint the event page shows one destination at a time;
   at larger widths it stays the scrollable long page EUX-02 built. */

const MOBILE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 700 };
const DESKTOP = { width: 1280, height: 900 };

const SCHED = { start: '10:00', courts: 1, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 };

function roster(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`, seedRating: 60 - i,
    rating: 60 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 60 - i }]
  }));
}

function fixedEvent(overrides = {}) {
  return {
    id: 'fixed', name: 'Section Cup', eventDate: '2026-07-27', created: 1, done: false, format: 'fixedTeams',
    brackets: [], sched: SCHED,
    teams: Array.from({ length: 4 }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, pool: 'A', players: [`p${i}`] })),
    ...overrides
  };
}

function rotatingEvent(overrides = {}) {
  return {
    id: 'rot', name: 'Rotation Night', eventDate: '2026-07-27', created: 2, done: false, format: 'rotatingGroups',
    teams: [], brackets: [],
    entries: Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], created: i })),
    rotation: { entrySize: 2, teamSize: 4, rounds: 1, courts: 1, seedMode: 'manual', winPoints: 1, tiePoints: .5, lossPoints: 0 },
    rotationSchedule: [{ id: 'rot-r1-c1', round: 1, court: 1, sideAEntryIds: ['e0', 'e1'], sideBEntryIds: ['e2', 'e3'], status: 'pending' }],
    ...overrides
  };
}

function poolGame(id, a, b, date) {
  return { id, date, evId: 'fixed', evMatchId: `pool:${id}`, evA: a, evB: b, teamA: [], teamB: [], scoreA: 25, scoreB: 20, winner: 'A', log: {} };
}

async function seed(page, { events, games = [] }) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { events, games, players: roster() });
}

async function openEvent(page, id) {
  await page.goto('/');
  await page.evaluate(eventId => { tab = 'events'; openEvent(eventId); }, id);
  await expect(page.locator('.event-subnav button.on')).toHaveCount(1);
}

/* One reading of the page: which destination is selected, which destination
   sections are actually on screen, and what the shared model expects. */
function sectionReport(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.event-subnav [data-event-tab]')];
    const shown = el => !!el && el.getBoundingClientRect().height > 0;
    return {
      mode: main.dataset.eventViewMode,
      view: main.dataset.eventView || null,
      active: buttons.filter(b => b.classList.contains('on')).map(b => b.dataset.eventTab),
      current: buttons.filter(b => b.getAttribute('aria-current') === 'location').map(b => b.dataset.eventTab),
      destinations: buttons.map(b => b.dataset.eventTab),
      visible: buttons.map(b => b.dataset.eventTab)
        .filter(id => shown(document.getElementById(`event-${id}`))),
      statusVisible: shown(document.querySelector('[data-event-status]')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

test('mobile event pages show one destination at a time and keep every destination reachable', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await seed(page, { events: [fixedEvent(), rotatingEvent()] });

  for (const [eventId, participants] of [['fixed', 'teams'], ['rot', 'entries']]) {
    await openEvent(page, eventId);
    const nav = page.getByRole('navigation', { name: 'Event sections' });

    const opening = await sectionReport(page);
    expect(opening.mode, `${eventId} uses section views on mobile`).toBe('sections');
    expect(opening.destinations).toEqual(['overview', 'registration', 'schedule', 'playoffs', participants, 'standings']);

    for (const id of opening.destinations) {
      await nav.locator(`[data-event-tab="${id}"]`).click();
      const report = await sectionReport(page);
      /* Standings live inside the participants card, so those two destinations
         share one view; every other destination stands alone. */
      const shared = [participants, 'standings'];
      const expected = shared.includes(id) ? shared : [id];
      expect(report.visible, `${eventId} · ${id} shows only its own section`).toEqual(expected);
      expect(report.view).toBe(shared.includes(id) ? participants : id);
      expect(report.active, `${eventId} · ${id} is the active destination`).toEqual([id]);
      expect(report.current).toEqual([id]);
      expect(report.overflow, `${eventId} · ${id} document overflow`).toBeLessThanOrEqual(0);
    }
  }
});

test('mobile section views open on the lifecycle-appropriate destination', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await seed(page, {
    events: [
      fixedEvent({ id: 'draft', name: 'Draft Cup', sched: null, teams: [] }),
      fixedEvent(),
      fixedEvent({ id: 'final', name: 'Final Cup', done: true })
    ],
    games: [poolGame('live', 't1', 't2', 100)]
  });

  /* A draft event opens on setup, an event under way opens on the schedule,
     and a completed event opens on results. */
  for (const [eventId, lifecycle, destination, view] of [
    ['draft', 'draft', 'overview', 'overview'],
    ['fixed', 'live', 'schedule', 'schedule'],
    ['final', 'complete', 'standings', 'teams']
  ]) {
    await openEvent(page, eventId);
    await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', lifecycle);
    await expect(page.locator('.event-subnav')).toHaveAttribute('data-event-default', destination);
    const report = await sectionReport(page);
    expect(report.active, `${eventId} opens on ${destination}`).toEqual([destination]);
    expect(report.view).toBe(view);
  }

  /* The completed event leads with the trophy above its standings table. */
  await expect(page.locator('.event-finale')).toBeVisible();
  await expect(page.locator('#event-standings')).toBeVisible();
});

test('the selected mobile section survives a rerender and returns after a sheet closes', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await seed(page, { events: [fixedEvent()], games: [poolGame('live', 't1', 't2', 100)] });
  await openEvent(page, 'fixed');
  const nav = page.getByRole('navigation', { name: 'Event sections' });

  await nav.locator('[data-event-tab="teams"]').click();
  expect((await sectionReport(page)).visible).toEqual(['teams', 'standings']);

  /* An ordinary application rerender keeps the reader where they were. */
  await page.evaluate(() => render());
  expect((await sectionReport(page)).active).toEqual(['teams']);
  expect((await sectionReport(page)).visible).toEqual(['teams', 'standings']);

  /* Opening and closing an event sheet returns to the same section. */
  await nav.locator('[data-event-tab="schedule"]').click();
  await page.getByRole('button', { name: 'Save / Share Schedule' }).click();
  await expect(page.locator('.sheet')).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await page.evaluate(() => render());

  const after = await sectionReport(page);
  expect(after.active).toEqual(['schedule']);
  expect(after.visible).toEqual(['schedule']);
});

test('the status summary and primary action stay visible outside the overview section', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await seed(page, { events: [fixedEvent()], games: [poolGame('live', 't1', 't2', 100)] });
  await openEvent(page, 'fixed');
  const nav = page.getByRole('navigation', { name: 'Event sections' });

  /* A live event opens on the schedule, so the compact strip carries the state
     and the primary action. Exactly one logging control is ever on screen. */
  const strip = page.locator('[data-event-status]');
  await expect(strip).toBeVisible();
  await expect(strip.locator('.pill')).toHaveText('live');
  await expect(strip.getByRole('button', { name: 'Log next result' })).toBeVisible();
  await expect(page.locator('[data-event-next-action],[data-event-status-action]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Log next result' })).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('[data-event-next-action],[data-event-status-action]')]
    .filter(el => el.getBoundingClientRect().height > 0).length)).toBe(1);
  expect((await strip.getByRole('button', { name: 'Log next result' }).boundingBox()).height).toBeGreaterThanOrEqual(40);

  /* On Overview the full card already carries both, so the strip stands down. */
  await nav.locator('[data-event-tab="overview"]').click();
  await expect(strip).toBeHidden();
  await expect(page.locator('#event-overview').getByRole('button', { name: 'Log next result' })).toBeVisible();
});

test('desktop event pages keep the long scrollable page with every section rendered', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await seed(page, { events: [fixedEvent(), rotatingEvent()], games: [poolGame('live', 't1', 't2', 100)] });

  for (const [eventId, participants] of [['fixed', 'teams'], ['rot', 'entries']]) {
    await openEvent(page, eventId);
    const report = await sectionReport(page);
    expect(report.mode, `${eventId} keeps the long page on desktop`).toBe('page');
    expect(report.view).toBeNull();
    expect(report.visible, `${eventId} renders every destination at once`).toEqual(report.destinations);
    expect(report.statusVisible, `${eventId} hides the mobile status strip`).toBe(false);
    expect(report.overflow).toBeLessThanOrEqual(0);
  }

  /* Scroll-aware navigation still follows the reader down the long page. */
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('event-standings').getBoundingClientRect().top + window.scrollY - 40, behavior: 'auto' }));
  await expect(page.getByRole('navigation', { name: 'Event sections' })
    .getByRole('button', { name: 'Standings', exact: true })).toHaveAttribute('aria-current', 'location');
});

test('resizing between mobile and desktop switches between section views and the long page', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await page.setViewportSize(MOBILE);
  await openEvent(page, 'fixed');

  await page.getByRole('navigation', { name: 'Event sections' }).locator('[data-event-tab="playoffs"]').click();
  expect((await sectionReport(page)).visible).toEqual(['playoffs']);

  await page.setViewportSize(DESKTOP);
  await expect.poll(async () => (await sectionReport(page)).mode).toBe('page');
  const wide = await sectionReport(page);
  expect(wide.visible).toEqual(wide.destinations);
  expect(wide.statusVisible).toBe(false);

  /* Back on mobile the page is a single section again. The destination follows
     the reading position the long page ended on. */
  await page.setViewportSize(MOBILE);
  await expect.poll(async () => (await sectionReport(page)).mode).toBe('sections');
  const narrow = await sectionReport(page);
  expect(narrow.active).toHaveLength(1);
  expect(narrow.visible).toContain(narrow.active[0]);
  expect(narrow.visible.length).toBeLessThanOrEqual(2);
});
