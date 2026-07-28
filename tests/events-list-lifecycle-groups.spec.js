import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'America/Chicago' });

const TODAY = '2026-07-27';

function fixedEvent({
  id,
  name = id,
  eventDate = TODAY,
  created = 1,
  done = false,
  teamCount = 0,
  scheduled = false
}) {
  return {
    id, name, eventDate, created, done,
    teams: Array.from({ length: teamCount }, (_, index) => ({
      id: `${id}-t${index}`,
      name: `${name} Team ${index + 1}`,
      pool: 'A',
      players: []
    })),
    brackets: [],
    ...(scheduled ? {
      sched: {
        start: '09:00', courts: 2, courtStyle: 'num', setMin: 20,
        matchMin: 45, breakMin: 10, seed: `${id}-seed`, revision: 1
      }
    } : {})
  };
}

function rotatingEvent({ id, name = id, eventDate = TODAY, created = 1 }) {
  return {
    id, name, eventDate, created, done: false, format: 'rotatingGroups',
    teams: [], brackets: [],
    entries: [
      { id: `${id}-e0`, name: `${name} Entry 1`, players: [] },
      { id: `${id}-e1`, name: `${name} Entry 2`, players: [] }
    ],
    rotation: {
      entrySize: 1, teamSize: 1, rounds: 1, courts: 1,
      seedMode: 'manual', seed: `${id}-seed`, revision: 1
    },
    rotationSchedule: [{
      id: `${id}-m0`, round: 1, court: 1,
      sideAEntryIds: [`${id}-e0`], sideBEntryIds: [`${id}-e1`]
    }]
  };
}

async function seed(page, { events, games }) {
  await page.addInitScript(({ events, games }) => {
    const fixedNow = new Date(2026, 6, 27, 12, 0, 0, 0).getTime();
    Date.now = () => fixedNow;
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
  }, { events, games });
}

function eventFixtures() {
  const todayOlder = fixedEvent({
    id: 'today-older', name: 'Today Older', created: 10
  });
  const todayNewer = fixedEvent({
    id: 'today-newer',
    name: 'Today Newer With A Long Tournament Name That Must Wrap',
    created: 20
  });
  const missingDate = fixedEvent({
    id: 'missing-date', name: 'Missing Date', created: null
  });
  delete missingDate.eventDate;

  const upcomingOlder = fixedEvent({
    id: 'upcoming-older', name: 'Upcoming Older', eventDate: '2026-07-29',
    created: 50, teamCount: 2, scheduled: true
  });
  const upcomingNewer = fixedEvent({
    id: 'upcoming-newer', name: 'Upcoming Newer', eventDate: '2026-07-30',
    created: 60, teamCount: 2, scheduled: true
  });

  const liveFixed = fixedEvent({
    id: 'live-fixed', name: 'Live Fixed', eventDate: '2026-07-24',
    created: 40, teamCount: 3, scheduled: true
  });
  const completeRotating = rotatingEvent({
    id: 'rotating-progress', name: 'Rotating Progress',
    eventDate: '2026-07-25', created: 30
  });

  const pastDraft = fixedEvent({
    id: 'past-draft', name: 'Past Draft', eventDate: '2026-07-20',
    created: 80
  });
  const finalToday = fixedEvent({
    id: 'final-today', name: 'Final Today', created: 70, done: true,
    teamCount: 2, scheduled: true
  });

  const games = [
    {
      id: 'live-result', date: 1, evId: liveFixed.id,
      evA: `${liveFixed.id}-t0`, evB: `${liveFixed.id}-t1`,
      teamA: [], teamB: [], scoreA: 21, scoreB: 17, winner: 'A', log: {}
    },
    {
      id: 'rotating-result', date: 2, evId: completeRotating.id,
      evMatchId: `${completeRotating.id}-m0`,
      evEntryIdsA: [`${completeRotating.id}-e0`],
      evEntryIdsB: [`${completeRotating.id}-e1`],
      eventFormat: 'rotatingGroups',
      teamA: [], teamB: [], scoreA: 21, scoreB: 18, winner: 'A', log: {}
    },
    {
      id: 'final-result', date: 3, evId: finalToday.id,
      evA: `${finalToday.id}-t0`, evB: `${finalToday.id}-t1`,
      teamA: [], teamB: [], scoreA: 21, scoreB: 12, winner: 'A', log: {}
    }
  ];

  return {
    events: [
      pastDraft, todayOlder, upcomingOlder, liveFixed, todayNewer,
      upcomingNewer, completeRotating, finalToday, missingDate
    ],
    games
  };
}

async function openEvents(page) {
  await page.locator('[data-tab="events"]:visible').first().click();
}

test('groups events by local date and derived lifecycle with stable order and sensible missing-date fallback', async ({ page }) => {
  const fixtures = eventFixtures();
  await seed(page, fixtures);
  await page.goto('/');

  const model = await page.evaluate(() => eventListSections(evts).map(section => ({
    key: section.key,
    label: section.label,
    items: section.items.map(item => ({
      id: item.event.id,
      state: item.state,
      date: item.date,
      progress: item.progressLabel
    }))
  })));

  expect(model.map(section => section.key)).toEqual([
    'today', 'upcoming', 'inProgress', 'past'
  ]);
  expect(model.map(section => section.label)).toEqual([
    'Today', 'Upcoming', 'In progress', 'Past'
  ]);
  expect(model[0].items.map(item => item.id)).toEqual([
    'today-newer', 'today-older', 'missing-date'
  ]);
  expect(model[1].items.map(item => item.id)).toEqual([
    'upcoming-newer', 'upcoming-older'
  ]);
  expect(model[2].items).toEqual([
    {
      id: 'live-fixed', state: 'live', date: '2026-07-24',
      progress: '1 of 3 scheduled matches complete'
    },
    {
      id: 'rotating-progress', state: 'poolsComplete', date: '2026-07-25',
      progress: '1 of 1 scheduled match complete'
    }
  ]);
  expect(model[3].items.map(item => [item.id, item.state])).toEqual([
    ['past-draft', 'draft'],
    ['final-today', 'complete']
  ]);
  expect(model[0].items.find(item => item.id === 'missing-date').date).toBe(TODAY);
});

test('renders compact lifecycle and progress rows for fixed and rotating events on mobile and desktop without persisting list state', async ({ page }) => {
  const fixtures = eventFixtures();
  await seed(page, fixtures);

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 1280, height: 800 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const storedBefore = await page.evaluate(() => localStorage.getItem('vb:events'));
    await openEvents(page);

    const groups = page.locator('[data-event-group]');
    await expect(groups).toHaveCount(4);
    await expect(page.locator('[data-event-group-heading]')).toHaveText([
      'Today', 'Upcoming', 'In progress', 'Past'
    ]);

    const liveRow = page.locator('.ev-row').filter({ hasText: 'Live Fixed' });
    await expect(liveRow.locator('[data-event-lifecycle="live"]')).toHaveText('live');
    await expect(liveRow.locator('[data-event-progress]')).toHaveText(
      '1 of 3 scheduled matches complete'
    );

    const rotatingRow = page.locator('.ev-row').filter({ hasText: 'Rotating Progress' });
    await expect(rotatingRow.locator('[data-event-lifecycle="poolsComplete"]'))
      .toHaveText('pools complete');
    await expect(rotatingRow.locator('[data-event-progress]')).toHaveText(
      '1 of 1 scheduled match complete'
    );

    const finalRow = page.locator('.ev-row').filter({ hasText: 'Final Today' });
    await expect(finalRow.locator('[data-event-lifecycle="complete"]')).toHaveText('final');
    await expect(finalRow).toBeVisible();

    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rowsContained: [...document.querySelectorAll('.ev-row')].every(row => {
        const rect = row.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
      }),
      rotatingTitleWidth: document.querySelector('[data-event-id="rotating-progress"] .event-list-row-title')
        ?.getBoundingClientRect().width || 0
    }));
    expect(layout.overflow, `${viewport.width}px document overflow`).toBeLessThanOrEqual(0);
    expect(layout.rowsContained, `${viewport.width}px event rows stay contained`).toBe(true);
    if (viewport.width === 320) {
      expect(layout.rotatingTitleWidth, '320px rotating title keeps a readable line width')
        .toBeGreaterThanOrEqual(240);
    }
    expect(await page.evaluate(() => localStorage.getItem('vb:events'))).toBe(storedBefore);
  }
});

test('event rows still open the same fixed and rotating event detail and return to the grouped list', async ({ page }) => {
  const fixtures = eventFixtures();
  await seed(page, fixtures);
  await page.goto('/');
  await openEvents(page);

  await page.locator('.ev-row').filter({ hasText: 'Live Fixed' }).click();
  await expect(page.getByRole('heading', { name: 'Live Fixed', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Event sections' })).toBeVisible();

  await page.getByRole('button', { name: '‹ All events', exact: true }).click();
  await expect(page.locator('[data-event-group="inProgress"]')).toContainText('Live Fixed');

  await page.locator('.ev-row').filter({ hasText: 'Rotating Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Rotating Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Event sections' })).toBeVisible();
});
