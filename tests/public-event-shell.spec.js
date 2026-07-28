import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LONG_FIXED_NAME = 'The Extremely Long North Shore Championship Volleyball Collective Alpha';
const LONG_ROTATING_NAME = 'Rotating Participant With An Exceptionally Long Public Entry Name';
const VENUE = 'North & South Pavilion — Championship Courts 1–12';
const PUBLISHED_AT = new Date(2026, 6, 27, 14, 30).getTime();

function fixedEvent(overrides = {}) {
  return {
    id: 'public-shell-fixed',
    name: 'Public Shell Cup',
    eventDate: '2026-07-27',
    created: 1,
    done: false,
    format: 'fixedTeams',
    venue: VENUE,
    teams: [
      { id: 'fa', name: LONG_FIXED_NAME, pool: '', players: [] },
      { id: 'fb', name: 'Bravo', pool: '', players: [] }
    ],
    sched: {
      start: '09:00',
      courts: 1,
      courtStyle: 'num',
      setMin: 25,
      matchMin: 45,
      breakMin: 10,
      seed: 'public-shell-fixed',
      revision: 1
    },
    brackets: [],
    ...overrides
  };
}

function rotatingEvent(overrides = {}) {
  return {
    id: 'public-shell-rotating',
    name: 'Public Rotating Cup',
    eventDate: '2026-07-27',
    created: 2,
    done: false,
    format: 'rotatingGroups',
    venue: VENUE,
    teams: [],
    entries: [
      { id: 'e1', name: LONG_ROTATING_NAME, players: [] },
      { id: 'e2', name: 'Entry Two', players: [] },
      { id: 'e3', name: 'Entry Three', players: [] },
      { id: 'e4', name: 'Entry Four', players: [] }
    ],
    rotation: {
      entrySize: 1,
      teamSize: 2,
      rounds: 1,
      courts: 1,
      start: '10:00',
      setMin: 25,
      matchMin: 45,
      breakMin: 10,
      seed: 'public-shell-rotating',
      revision: 1
    },
    rotationSchedule: [{
      id: 'rotation-match-1',
      round: 1,
      court: 1,
      sideAEntryIds: ['e1', 'e2'],
      sideBEntryIds: ['e3', 'e4'],
      scheduleBlock: 'standard'
    }],
    brackets: [],
    ...overrides
  };
}

async function renderPublicHtml(page, event, { publishRules = true } = {}) {
  await page.goto('/');
  return page.evaluate(({ eventInput, shouldPublish, publishedAt }) => {
    const event = structuredClone(eventInput);
    if (shouldPublish) {
      event.rules = createEmptyRulesModel();
      event.rules.revisions = [{
        id: 'public-shell-rules',
        number: 1,
        document: rulesDocumentFromHtml('<h2>Scoring and Match Format</h2><p>One set to 25 points.</p><h2>Weather Policy</h2><p>Stop for lightning.</p>'),
        quickRules: {},
        publishedAt,
        changeSummary: 'Initial public rules',
        afterStart: false,
        settingsSnapshot: {},
        schemaVersion: 1
      }];
      event.rules.publishedRevisionId = 'public-shell-rules';
      event.rules.publicationUpdatedAt = publishedAt;
    }
    return renderPublicEventDocument(event);
  }, { eventInput: event, shouldPublish: publishRules, publishedAt: PUBLISHED_AT });
}

test('public event documents use one primary heading and conditional public metadata without changing standalone schedules', async ({ page }) => {
  const fixedHtml = await renderPublicHtml(page, fixedEvent());
  const emptyHtml = await renderPublicHtml(page, fixedEvent({ venue: undefined }), { publishRules: false });
  const result = await page.evaluate(({ fixed, empty, event }) => {
    const inspect = html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return {
        h1: [...doc.querySelectorAll('h1')].map(node => node.textContent),
        embeddedHeadingCount: doc.querySelectorAll('[data-public-schedule] .schedule-preview-head').length,
        venue: doc.querySelector('.public-event-head [data-event-venue]')?.textContent || null,
        updatedCount: doc.querySelectorAll('[data-public-last-updated]').length,
        updatedDateTime: doc.querySelector('[data-public-last-updated] time')?.dateTime || null
      };
    };
    const model = deriveFullScheduleExportModel(structuredClone(event));
    const standalone = new DOMParser().parseFromString(renderScheduleDocument(model), 'text/html');
    return {
      fixed: inspect(fixed),
      empty: inspect(empty),
      standaloneHeadings: [...standalone.querySelectorAll('h1')].map(node => node.textContent)
    };
  }, { fixed: fixedHtml, empty: emptyHtml, event: fixedEvent() });

  expect(result.fixed).toEqual({
    h1: ['Public Shell Cup'],
    embeddedHeadingCount: 0,
    venue: VENUE,
    updatedCount: 1,
    updatedDateTime: new Date(PUBLISHED_AT).toISOString()
  });
  expect(result.empty).toMatchObject({
    h1: ['Public Shell Cup'],
    embeddedHeadingCount: 0,
    venue: null,
    updatedCount: 0,
    updatedDateTime: null
  });
  expect(result.standaloneHeadings).toEqual(['Public Shell Cup']);
});

test('public navigation is opaque, active, overflow-aware, and clears sticky headings at 320px', async ({ page }, testInfo) => {
  const html = await renderPublicHtml(page, fixedEvent());
  const filePath = testInfo.outputPath('public-event-shell.html');
  writeFileSync(filePath, html);

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(pathToFileURL(filePath).href);

  const nav = page.getByRole('navigation', { name: 'Event navigation' });
  await expect(nav).toHaveAttribute('data-overflow', /end|both/);
  const initial = await nav.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    scrollable: element.scrollWidth > element.clientWidth
  }));
  expect(initial).toEqual({ background: 'rgb(23, 36, 59)', scrollable: true });

  await nav.evaluate(element => { element.scrollLeft = element.scrollWidth; element.dispatchEvent(new Event('scroll')); });
  await expect(nav).toHaveAttribute('data-overflow', /start|both/);

  await nav.getByRole('link', { name: 'Standings', exact: true }).click();
  const standingsLink = nav.getByRole('link', { name: 'Standings', exact: true });
  await expect(standingsLink).toHaveAttribute('aria-current', 'location');
  const standingClearance = await page.evaluate(() => {
    const navBox = document.querySelector('.public-nav').getBoundingClientRect();
    const headingBox = document.querySelector('#standings > h2').getBoundingClientRect();
    return headingBox.top - navBox.bottom;
  });
  expect(standingClearance).toBeGreaterThanOrEqual(8);

  await nav.getByRole('link', { name: 'Rules', exact: true }).click();
  await page.getByRole('navigation', { name: 'Rules table of contents' })
    .getByRole('link', { name: 'Weather Policy', exact: true }).click();
  const rulesClearance = await page.evaluate(() => {
    const navBox = document.querySelector('.public-nav').getBoundingClientRect();
    const searchBox = document.querySelector('.rules-search-bar').getBoundingClientRect();
    const headingBox = document.querySelector('#rule-weather_policy').getBoundingClientRect();
    return {
      searchBelowNav: searchBox.top - navBox.bottom,
      headingBelowSearch: headingBox.top - searchBox.bottom
    };
  });
  expect(rulesClearance.searchBelowNav).toBeGreaterThanOrEqual(-1);
  expect(rulesClearance.headingBelowSearch).toBeGreaterThanOrEqual(8);
});

test('fixed and rotating public names wrap without document overflow on mobile and desktop', async ({ page }, testInfo) => {
  for (const [kind, event] of [['fixed', fixedEvent()], ['rotating', rotatingEvent()]]) {
    const html = await renderPublicHtml(page, event);
    const filePath = testInfo.outputPath(`${kind}-public-event.html`);
    writeFileSync(filePath, html);
    for (const viewport of [{ width: 320, height: 700 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto(pathToFileURL(filePath).href);
      const layout = await page.evaluate(name => {
        const candidates = [...document.querySelectorAll('.public-table-row strong, [data-public-schedule] strong, [data-public-schedule] b')]
          .filter(node => node.textContent.includes(name));
        return {
          h1Count: document.querySelectorAll('h1').length,
          candidateCount: candidates.length,
          namesFit: candidates.every(node => node.scrollWidth <= node.clientWidth + 1),
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      }, kind === 'fixed' ? LONG_FIXED_NAME : LONG_ROTATING_NAME);
      expect(layout.h1Count, `${kind} ${viewport.width}px h1 count`).toBe(1);
      expect(layout.candidateCount, `${kind} ${viewport.width}px long-name coverage`).toBeGreaterThan(0);
      expect(layout.namesFit, `${kind} ${viewport.width}px long-name overflow`).toBe(true);
      expect(layout.pageOverflow, `${kind} ${viewport.width}px document overflow`).toBeLessThanOrEqual(0);
    }
  }
});

test('public event output excludes organizer controls and private registration or publication data', async ({ page }) => {
  const event = fixedEvent({
    registration: {
      enabled: true,
      publicDescription: 'PRIVATE REGISTRATION DESCRIPTION 9182',
      contactEmail: 'private-organizer-9182@example.test',
      publicToken: 'PUBLIC-REGISTRATION-TOKEN-9182',
      managementToken: 'PRIVATE-MANAGEMENT-TOKEN-9182'
    },
    registrationCheckIn: {
      entries: {
        secret: {
          contact: { email: 'player-private-9182@example.test', phone: '555-09182' },
          notes: 'PRIVATE CHECK-IN NOTES 9182'
        }
      }
    },
    schedulePublications: {
      full: {
        publicToken: 'PUBLIC-SCHEDULE-TOKEN-9182',
        managementToken: 'PRIVATE-SCHEDULE-MANAGEMENT-9182',
        publicUrl: 'https://example.test/s/public',
        updatedAt: PUBLISHED_AT
      }
    }
  });
  const html = await renderPublicHtml(page, event);
  const result = await page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    return {
      text: doc.body.textContent,
      organizerControls: doc.querySelectorAll('[data-public-print], [data-public-share], [data-registration-admin], [onclick]').length,
      buttons: [...doc.querySelectorAll('button')].map(button => button.textContent.trim())
    };
  }, html);

  for (const secret of [
    'PRIVATE REGISTRATION DESCRIPTION 9182',
    'private-organizer-9182@example.test',
    'PUBLIC-REGISTRATION-TOKEN-9182',
    'PRIVATE-MANAGEMENT-TOKEN-9182',
    'player-private-9182@example.test',
    '555-09182',
    'PRIVATE CHECK-IN NOTES 9182',
    'PUBLIC-SCHEDULE-TOKEN-9182',
    'PRIVATE-SCHEDULE-MANAGEMENT-9182'
  ]) expect(html).not.toContain(secret);
  expect(result.organizerControls).toBe(0);
  expect(result.buttons).toEqual(['Previous', 'Next', 'Clear']);
});
