import { test, expect } from '@playwright/test';

/* EUX-02 — event navigation, anchors, touch targets, and long names. */

const LONG_TEAM = 'Northwest Regional Volleyball Collective Alpha Squadron';
const LONG_OPPONENT = 'Southeast Metropolitan Beach Volleyball Association Bravo';

function roster(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`, seedRating: 60 - i,
    rating: 60 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 60 - i }]
  }));
}

const SCHED = { start: '10:00', courts: 1, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 };

function fixedEvent(overrides = {}) {
  return {
    id: 'fixed', name: 'Navigation Cup', eventDate: '2026-07-25', created: 1, done: false, format: 'fixedTeams',
    sched: SCHED, brackets: [],
    teams: [
      { id: 't1', name: LONG_TEAM, pool: 'A', players: ['p0'] },
      { id: 't2', name: LONG_OPPONENT, pool: 'A', players: ['p1'] },
      { id: 't3', name: 'Team Three', pool: 'A', players: ['p2'] },
      { id: 't4', name: 'Team Four', pool: 'A', players: ['p3'] }
    ],
    ...overrides
  };
}

function rotatingEvent(overrides = {}) {
  const entries = [
    { id: 'e0', name: LONG_TEAM, players: ['p0', 'p1'], created: 0 },
    { id: 'e1', name: LONG_OPPONENT, players: ['p2', 'p3'], created: 1 },
    { id: 'e2', name: 'Pair Three', players: ['p4', 'p5'], created: 2 },
    { id: 'e3', name: 'Pair Four', players: ['p6', 'p7'], created: 3 }
  ];
  return {
    id: 'rot', name: 'Rotation Night', eventDate: '2026-07-25', created: 2, done: false, format: 'rotatingGroups',
    teams: [], entries, brackets: [],
    rotation: { entrySize: 2, teamSize: 4, rounds: 1, courts: 1, seedMode: 'manual', winPoints: 1, tiePoints: .5, lossPoints: 0 },
    rotationSchedule: [{ id: 'rot-r1-c1', round: 1, court: 1, sideAEntryIds: ['e0', 'e1'], sideBEntryIds: ['e2', 'e3'], status: 'pending' }],
    ...overrides
  };
}

function poolGame(id, a, b, date) {
  return {
    id, date, evId: 'fixed', evMatchId: `pool:${id}`, evA: a, evB: b,
    teamA: [], teamB: [], scoreA: 25, scoreB: 20, winner: 'A', log: {}
  };
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

/* EUX-04 keeps the scrollable long page above the mobile breakpoint, so the
   scroll-driven navigation behaviour is asserted at a desktop width. Mobile
   section views are covered by tests/event-mobile-section-views.spec.js. */
const DESKTOP = { width: 1280, height: 900 };

async function showSection(page, id) {
  await page.evaluate(section => eventSection(section), id);
}

/* Every destination the navigation offers, with the geometry needed to prove it
   leads to real content in the rendered order. */
function destinations(page) {
  return page.evaluate(() => [...document.querySelectorAll('.event-subnav [data-event-tab]')].map(button => {
    const id = button.dataset.eventTab;
    const target = document.getElementById(`event-${id}`);
    const rect = target?.getBoundingClientRect();
    return {
      id, label: button.textContent.trim(), exists: !!target,
      height: rect ? rect.height : 0,
      top: rect ? rect.top + window.scrollY : null,
      navHeight: button.getBoundingClientRect().height
    };
  }));
}

test('event navigation destinations all lead to rendered content in navigation order', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await seed(page, { events: [fixedEvent(), rotatingEvent()] });

  for (const [eventId, participants] of [['fixed', 'Teams'], ['rot', 'Entries']]) {
    await openEvent(page, eventId);
    const items = await destinations(page);
    expect(items.map(item => item.label)).toEqual(['Overview', 'Registration', 'Schedule', 'Playoffs', participants, 'Standings']);
    for (const item of items) {
      expect(item.exists, `${eventId} destination ${item.id} exists`).toBe(true);
      expect(item.height, `${eventId} destination ${item.id} has height`).toBeGreaterThan(0);
    }
    const tops = items.map(item => item.top);
    expect(tops, `${eventId} navigation order matches document order`)
      .toEqual([...tops].sort((a, b) => a - b));
  }
});

test('a completed event drops the registration destination and keeps the rest reachable', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await seed(page, { events: [fixedEvent({ done: true })], games: [poolGame('done', 't1', 't2', 100)] });
  await openEvent(page, 'fixed');

  const items = await destinations(page);
  expect(items.map(item => item.label)).toEqual(['Overview', 'Schedule', 'Playoffs', 'Teams', 'Standings']);
  expect(items.every(item => item.exists && item.height > 0)).toBe(true);
  const tops = items.map(item => item.top);
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
});

test('selecting a destination marks it active and keeps it under the sticky navigation', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await openEvent(page, 'fixed');
  const nav = page.getByRole('navigation', { name: 'Event sections' });

  await expect(nav.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'location');

  for (const label of ['Schedule', 'Playoffs', 'Teams', 'Standings']) {
    await nav.getByRole('button', { name: label, exact: true }).click();
    const button = nav.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveAttribute('aria-current', 'location');
    await expect(button).toHaveClass(/\bon\b/);
    await expect(nav.locator('button.on')).toHaveCount(1);
    await expect(page.locator('.event-subnav [aria-current]')).toHaveCount(1);
  }

  /* The selected section must clear the sticky navigation rather than hide under it. */
  const clearance = await page.evaluate(() => {
    const navRect = document.querySelector('.event-subnav').getBoundingClientRect();
    const section = document.getElementById('event-schedule').getBoundingClientRect();
    return { navBottom: navRect.bottom, sectionTop: section.top };
  });
  await nav.getByRole('button', { name: 'Schedule', exact: true }).click();
  const afterClick = await page.evaluate(() => {
    const navRect = document.querySelector('.event-subnav').getBoundingClientRect();
    return { navBottom: navRect.bottom, sectionTop: document.getElementById('event-schedule').getBoundingClientRect().top };
  });
  expect(afterClick.sectionTop).toBeGreaterThanOrEqual(afterClick.navBottom - 1);
  expect(clearance.navBottom).toBeGreaterThan(0);
});

test('the active destination follows manual scrolling and a repeated selection returns to it', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await seed(page, { events: [fixedEvent()] });
  await openEvent(page, 'fixed');
  const nav = page.getByRole('navigation', { name: 'Event sections' });

  await nav.getByRole('button', { name: 'Schedule', exact: true }).click();
  const scheduleY = await page.evaluate(() => window.scrollY);
  expect(scheduleY).toBeGreaterThan(0);
  await expect(nav.getByRole('button', { name: 'Schedule', exact: true })).toHaveAttribute('aria-current', 'location');

  /* Scrolling by hand releases the selection and follows the page. */
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await expect(nav.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(nav.getByRole('button', { name: 'Schedule', exact: true })).not.toHaveAttribute('aria-current', 'location');

  /* Selecting the same destination again after scrolling away returns to it. */
  await nav.getByRole('button', { name: 'Schedule', exact: true }).click();
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scheduleY, 0);
  await expect(nav.getByRole('button', { name: 'Schedule', exact: true })).toHaveAttribute('aria-current', 'location');

  await page.evaluate(() => window.scrollTo({ top: document.getElementById('event-standings').getBoundingClientRect().top + window.scrollY - 40, behavior: 'auto' }));
  await expect(nav.getByRole('button', { name: 'Standings', exact: true })).toHaveAttribute('aria-current', 'location');
});

test('a destination that no longer exists falls back to the shared default section', async ({ page }) => {
  await seed(page, { events: [fixedEvent()], games: [poolGame('live', 't1', 't2', 100)] });
  await openEvent(page, 'fixed');

  await expect(page.locator('.event-subnav')).toHaveAttribute('data-event-default', 'schedule');
  await page.evaluate(() => eventSection('no-such-section'));
  await expect(page.getByRole('navigation', { name: 'Event sections' })
    .getByRole('button', { name: 'Schedule', exact: true })).toHaveAttribute('aria-current', 'location');

  const defaults = await page.evaluate(() => {
    const ev = evts[0];
    return {
      draft: eventSectionModel({ ...ev, id: 'unplayed', sched: null, teams: [] }, {}).defaultId,
      complete: eventSectionModel({ ...ev, done: true }, {}).defaultId
    };
  });
  expect(defaults).toEqual({ draft: 'overview', complete: 'standings' });
});

test('event navigation shows a horizontal overflow cue while destinations stay off screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(page, { events: [fixedEvent()] });
  await openEvent(page, 'fixed');

  const nav = page.locator('.event-subnav');
  expect(await nav.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(1);
  await expect(nav).toHaveAttribute('data-overflow', 'end');

  await nav.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect(nav).toHaveAttribute('data-overflow', 'start');
  expect(await nav.evaluate(el => getComputedStyle(el).maskImage !== 'none' || getComputedStyle(el).webkitMaskImage !== 'none')).toBe(true);
});

test('event navigation and per-match controls meet the 44 px touch target minimum', async ({ page }) => {
  await seed(page, { events: [fixedEvent(), rotatingEvent()] });

  for (const eventId of ['fixed', 'rot']) {
    await openEvent(page, eventId);
    /* Per-match logging lives in the schedule destination. */
    await showSection(page, 'schedule');
    const measurements = await page.evaluate(() => {
      const visible = el => el.getBoundingClientRect().height > 0;
      const measure = selector => [...document.querySelectorAll(selector)].filter(visible)
        .map(el => ({ text: el.textContent.trim().slice(0, 32), height: el.getBoundingClientRect().height }));
      return {
        nav: measure('.event-subnav [data-event-tab]'),
        log: measure('main.event-detail .log-match'),
        small: measure('main.event-detail .btn.sm')
      };
    });
    expect(measurements.nav.length).toBeGreaterThan(0);
    expect(measurements.log.length).toBeGreaterThan(0);
    /* A control sized at exactly 44px measures 44 ± 1.5e-5 depending on the
       fractional scroll offset under the sticky strip, so allow sub-pixel
       noise rather than intermittently failing an on-spec target. */
    for (const group of ['nav', 'log', 'small']) {
      for (const control of measurements[group]) {
        expect(control.height, `${eventId} ${group} control "${control.text}"`).toBeGreaterThanOrEqual(43.5);
      }
    }
  }
});

test('long team and entry names wrap without hiding the opponent at 320 px and 375 px', async ({ page }) => {
  await seed(page, { events: [fixedEvent(), rotatingEvent()] });

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 780 });
    /* Fixed schedules render match rows; rotating schedules render entry sides. */
    for (const [eventId, selector] of [['fixed', '.match-teams'], ['rot', '.rotation-side b']]) {
      await openEvent(page, eventId);
      await showSection(page, 'schedule');
      const report = await page.evaluate(({ long, opponent, selector }) => {
        const rows = [...document.querySelectorAll(`main.event-detail ${selector}`)];
        return {
          rows: rows.length,
          clipped: rows.filter(el => el.scrollWidth - el.clientWidth > 1).length,
          ellipsized: rows.filter(el => getComputedStyle(el).textOverflow === 'ellipsis').length,
          nowrap: rows.filter(el => getComputedStyle(el).whiteSpace === 'nowrap').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          showsBoth: document.body.innerText.includes(long) && document.body.innerText.includes(opponent)
        };
      }, { long: LONG_TEAM, opponent: LONG_OPPONENT, selector });
      expect(report.rows, `${eventId} at ${width}px renders match rows`).toBeGreaterThan(0);
      expect(report.clipped, `${eventId} at ${width}px clipped names`).toBe(0);
      expect(report.ellipsized, `${eventId} at ${width}px ellipsized names`).toBe(0);
      expect(report.nowrap, `${eventId} at ${width}px non-wrapping names`).toBe(0);
      expect(report.overflow, `${eventId} at ${width}px document overflow`).toBeLessThanOrEqual(0);
      expect(report.showsBoth, `${eventId} at ${width}px shows both names`).toBe(true);
    }
  }
});

test('event pages clear the mobile dock without leaving a screen of empty space', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { events: [fixedEvent()] });
  await openEvent(page, 'fixed');

  const layout = await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
    const last = [...document.querySelectorAll('main.event-detail > .btn')].pop();
    const dock = document.querySelector('.dock-wrap').getBoundingClientRect();
    const rect = last.getBoundingClientRect();
    return {
      lastBottom: rect.bottom, dockTop: dock.top,
      trailing: document.documentElement.scrollHeight - (rect.bottom + window.scrollY)
    };
  });
  expect(layout.lastBottom).toBeLessThanOrEqual(layout.dockTop);
  expect(layout.trailing).toBeGreaterThan(60);
  expect(layout.trailing).toBeLessThan(470);
});

test('desktop event pages keep the same destinations, active state, and clearance', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { events: [fixedEvent()] });
  await openEvent(page, 'fixed');
  const nav = page.getByRole('navigation', { name: 'Event sections' });

  await expect(nav.getByRole('button')).toHaveCount(6);
  await nav.getByRole('button', { name: 'Standings', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Standings', exact: true })).toHaveAttribute('aria-current', 'location');

  const measures = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    navBottom: document.querySelector('.event-subnav').getBoundingClientRect().bottom,
    standingsTop: document.getElementById('event-standings').getBoundingClientRect().top,
    zeroHeight: [...document.querySelectorAll('.event-subnav [data-event-tab]')]
      .filter(button => (document.getElementById(`event-${button.dataset.eventTab}`)?.getBoundingClientRect().height || 0) <= 0).length
  }));
  expect(measures.overflow).toBeLessThanOrEqual(0);
  expect(measures.standingsTop).toBeGreaterThanOrEqual(measures.navBottom - 1);
  expect(measures.zeroHeight).toBe(0);
});
