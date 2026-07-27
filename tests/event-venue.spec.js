import { test, expect } from '@playwright/test';

const LONG_VENUE = 'North & South <Pavilion> — Courts 1–12, Upper Recreation Level, Building C, 12345 Championship Boulevard';

function fixedEvent(overrides = {}) {
  return {
    id: 'fixed-venue',
    name: 'Fixed Venue Cup',
    eventDate: '2026-07-27',
    created: 1,
    done: false,
    format: 'fixedTeams',
    teams: [
      { id: 'fa', name: 'Fixed Alpha', pool: '', players: [] },
      { id: 'fb', name: 'Fixed Bravo', pool: '', players: [] }
    ],
    sched: { start: '09:00', courts: 1, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'venue-fixed', revision: 1 },
    brackets: [],
    ...overrides
  };
}

function rotatingEvent(overrides = {}) {
  const event = {
    id: 'rotating-venue',
    name: 'Rotating Venue Cup',
    eventDate: '2026-07-27',
    created: 2,
    done: false,
    format: 'rotatingGroups',
    teams: [],
    entries: Array.from({ length: 4 }, (_, index) => ({
      id: `re${index + 1}`,
      name: `Entry ${index + 1}`,
      players: [`rp${index + 1}`],
      manualSeed: index + 1
    })),
    rotation: {
      entrySize: 1,
      teamSize: 2,
      rounds: 1,
      courts: 1,
      seedMode: 'manual',
      start: '10:00',
      setMin: 20,
      matchMin: 45,
      breakMin: 10,
      seed: 'venue-rotating',
      revision: 1
    },
    rotationSchedule: [],
    brackets: [],
    ...overrides
  };
  return event;
}

async function seed(page, events = []) {
  await page.addInitScript(eventsValue => {
    window.__backupText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__backupText = text; } }
    });
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify(eventsValue));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, events);
}

async function openEvents(page) {
  await page.goto('/');
  await page.locator('[data-tab="events"]:visible').first().click();
}

test('new fixed and rotating events save an optional venue and Event details can edit or clear it', async ({ page }) => {
  await seed(page);
  await openEvents(page);

  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await expect(page.locator('#evVenue')).toHaveValue('');
  await page.locator('#evName').fill('Created Venue Cup');
  await page.locator('#evDate').fill('2026-07-27');
  await page.locator('#evVenue').fill(LONG_VENUE);
  await page.getByRole('button', { name: 'Create event', exact: true }).click();

  expect(await page.evaluate(() => ({
    memory: evts[0].venue,
    stored: JSON.parse(localStorage.getItem('vb:events'))[0].venue
  }))).toEqual({ memory: LONG_VENUE, stored: LONG_VENUE });
  await expect(page.locator('.screen-head [data-event-venue]')).toHaveText(LONG_VENUE);

  await page.getByRole('button', { name: 'Event details', exact: true }).click();
  await expect(page.locator('#evVenue')).toHaveValue(LONG_VENUE);
  await page.locator('#evVenue').fill('Edited Gym & Annex');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.screen-head [data-event-venue]')).toHaveText('Edited Gym & Annex');

  await page.getByRole('button', { name: 'Event details', exact: true }).click();
  await page.locator('#evVenue').fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.screen-head [data-event-venue]')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(evts[0], 'venue'))).toBe(false);

  await page.getByRole('button', { name: 'All events' }).click();
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await page.locator('#evName').fill('Created Rotating Venue Cup');
  await page.locator('#evVenue').fill('Rotation Center');
  await page.getByRole('button', { name: 'Rotating Groups', exact: true }).click();
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  expect(await page.evaluate(() => {
    const event = evts.find(item => item.name === 'Created Rotating Venue Cup');
    return { format: event?.format, venue: event?.venue };
  })).toEqual({ format: 'rotatingGroups', venue: 'Rotation Center' });
  await expect(page.locator('.screen-head [data-event-venue]')).toHaveText('Rotation Center');
});

test('legacy, backup, restore, sync-merge, and duplication paths preserve venue compatibility', async ({ page }) => {
  const legacy = fixedEvent({ id: 'legacy-location', name: 'Legacy Location', venue: undefined, location: 'Legacy Gym & Annex' });
  delete legacy.venue;
  const empty = fixedEvent({ id: 'no-location', name: 'No Location' });
  await seed(page, [legacy, empty]);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const legacyEvent = evById('legacy-location');
    const emptyEvent = evById('no-location');
    const legacyRead = eventVenue(legacyEvent);
    const duplicated = duplicateEventData(legacyEvent, { id: 'legacy-copy', name: 'Legacy Copy', now: 100, eventDate: '2026-07-28' });
    const remoteWins = mergeEventRecords(
      { ...legacyEvent, venue: 'Local Venue' },
      { id: legacyEvent.id, name: 'Remote Name', venue: 'Remote Venue' },
      true
    );
    const localSurvives = mergeEventRecords(
      { ...legacyEvent, venue: 'Local Venue' },
      { id: legacyEvent.id, name: 'Remote Name' },
      true
    );

    legacyEvent.venue = 'Backup Venue';
    await saveEvents();
    await exportData();
    const backup = JSON.parse(window.__backupText);
    evts = [];
    await saveEvents();
    await restoreBackupData(backup);
    await load();

    return {
      legacyRead,
      emptyRead: eventVenue(emptyEvent),
      duplicateRead: eventVenue(duplicated),
      duplicateLocation: duplicated.location,
      remoteWins: remoteWins.venue,
      localSurvives: localSurvives.venue,
      backupVenue: backup.events.find(event => event.id === 'legacy-location')?.venue,
      restoredVenue: evById('legacy-location')?.venue,
      emptyStillValid: !!evById('no-location') && eventVenue(evById('no-location')) === ''
    };
  });

  expect(result).toEqual({
    legacyRead: 'Legacy Gym & Annex',
    emptyRead: '',
    duplicateRead: 'Legacy Gym & Annex',
    duplicateLocation: 'Legacy Gym & Annex',
    remoteWins: 'Remote Venue',
    localSurvives: 'Local Venue',
    backupVenue: 'Backup Venue',
    restoredVenue: 'Backup Venue',
    emptyStillValid: true
  });
});

test('venue is safe and complete in fixed and rotating summaries, schedules, public headers, results, recap images, and empty exports', async ({ page }) => {
  const fixed = fixedEvent({ venue: LONG_VENUE });
  const rotating = rotatingEvent({ venue: LONG_VENUE });
  await seed(page, [fixed, rotating]);
  await page.goto('/');

  const output = await page.evaluate(venue => {
    const fixed = evById('fixed-venue');
    const rotating = evById('rotating-venue');
    rotating.rotationSchedule = generateRotationScheduleData(rotating).matches;
    const fixedFull = deriveFullScheduleExportModel(fixed);
    const fixedParticipant = deriveParticipantScheduleExportModel(fixed, 'team', 'fa');
    const rotatingFull = deriveFullScheduleExportModel(rotating);
    const rotatingParticipant = deriveParticipantScheduleExportModel(rotating, 'entry', 're1');
    const empty = { ...fixed, id: 'empty-venue' };
    delete empty.venue;

    const inspect = (html, selector = '[data-event-venue]') => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const venues = [...doc.querySelectorAll(selector)];
      return {
        count: venues.length,
        text: venues.map(node => node.textContent).join('|'),
        childCount: venues.reduce((sum, node) => sum + node.children.length, 0)
      };
    };

    const drawn = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      drawn.push(String(text));
      return originalFillText.call(this, text, ...args);
    };
    try {
      drawEventResultsCard(document.createElement('canvas'), eventResultsData(fixed));
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }

    return {
      models: [fixedFull, fixedParticipant, rotatingFull, rotatingParticipant].map(model => ({
        format: model.formatKind,
        scope: model.scope,
        venue: model.venue
      })),
      fixedPreview: inspect(scheduleExportPreviewHtml(fixedFull)),
      fixedPrint: inspect(renderScheduleDocument(fixedFull, { photoContext: PUBLIC_PHOTO_CONTEXTS.print })),
      fixedParticipant: inspect(renderScheduleDocument(fixedParticipant)),
      rotatingPreview: inspect(scheduleExportPreviewHtml(rotatingFull)),
      rotatingParticipant: inspect(renderScheduleDocument(rotatingParticipant)),
      publicEvent: inspect(renderPublicEventDocument(fixed), '.public-event-head [data-event-venue]'),
      results: inspect(eventResultsHtml(fixed, eventResultsData(fixed))),
      resultsDocument: inspect(renderResultsDocument(deriveResultsPublicationModel(fixed))),
      emptySchedule: inspect(renderScheduleDocument(deriveFullScheduleExportModel(empty))),
      emptyPublic: inspect(renderPublicEventDocument(empty)),
      emptyResults: inspect(eventResultsHtml(empty, eventResultsData(empty))),
      recapIncludesVenue: drawn.some(text => text.includes(venue.slice(0, 30)))
    };
  }, LONG_VENUE);

  expect(output.models).toEqual([
    { format: 'fixed', scope: 'full', venue: LONG_VENUE },
    { format: 'fixed', scope: 'participant', venue: LONG_VENUE },
    { format: 'rotating', scope: 'full', venue: LONG_VENUE },
    { format: 'rotating', scope: 'participant', venue: LONG_VENUE }
  ]);
  for (const rendered of [
    output.fixedPreview,
    output.fixedPrint,
    output.fixedParticipant,
    output.rotatingPreview,
    output.rotatingParticipant,
    output.publicEvent,
    output.results,
    output.resultsDocument
  ]) {
    expect(rendered).toEqual({ count: 1, text: LONG_VENUE, childCount: 0 });
  }
  expect(output.emptySchedule.count).toBe(0);
  expect(output.emptyPublic.count).toBe(0);
  expect(output.emptyResults.count).toBe(0);
  expect(output.recapIncludesVenue).toBe(true);
});

test('long venue text wraps without document overflow for fixed and rotating events on mobile and desktop', async ({ page }) => {
  await seed(page, [
    fixedEvent({ venue: LONG_VENUE }),
    rotatingEvent({ venue: LONG_VENUE })
  ]);
  await openEvents(page);

  for (const viewport of [{ width: 320, height: 760 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    for (const name of ['Fixed Venue Cup', 'Rotating Venue Cup']) {
      await page.locator('.ev-row').filter({ hasText: name }).click();
      const venue = page.locator('.screen-head [data-event-venue]');
      await expect(venue).toHaveText(LONG_VENUE);
      const layout = await page.evaluate(() => {
        const venueNode = document.querySelector('.screen-head [data-event-venue]');
        return {
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          venueOverflow: venueNode.scrollWidth - venueNode.clientWidth
        };
      });
      expect(layout.pageOverflow, `${viewport.width}px ${name} page overflow`).toBeLessThanOrEqual(1);
      expect(layout.venueOverflow, `${viewport.width}px ${name} venue overflow`).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: 'All events' }).click();
    }
  }
});
