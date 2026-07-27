import { test, expect } from '@playwright/test';

function roster(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`, seedRating: 60 - i,
    rating: 60 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 60 - i }]
  }));
}

function fixedTeams(count = 4) {
  return Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, pool: 'A', players: [`p${i}`] }));
}

const SCHED = { start: '10:00', courts: 1, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 };

function fixedEvent(overrides = {}) {
  return { id: 'fixed', name: 'Lifecycle Cup', eventDate: '2026-07-25', created: 1, done: false, format: 'fixedTeams', teams: fixedTeams(), brackets: [], ...overrides };
}

/* Pool results carry a non-playoff evMatchId so they can never be mistaken for
   an untagged bracket result. */
function poolGame(id, a, b, date, scoreA = 25, scoreB = 20) {
  return { id, date, evId: 'fixed', evMatchId: `pool:${id}`, evA: a, evB: b, teamA: [], teamB: [], scoreA, scoreB, winner: scoreA > scoreB ? 'A' : 'B', log: {} };
}

/* Every pairing of a 4-team single-pool round robin. */
function allPoolGames() {
  const pairs = [['t1', 't2'], ['t1', 't3'], ['t1', 't4'], ['t2', 't3'], ['t2', 't4'], ['t3', 't4']];
  return pairs.map(([a, b], i) => poolGame(`pool-${i}`, a, b, 100 + i));
}

function playoffSets({ evId = 'fixed', brId = 'champ', round, match, a, b, scores, start, prefix }) {
  return scores.map(([scoreA, scoreB], i) => ({
    id: `${prefix}-s${i + 1}`, date: start + i, evId, evA: a, evB: b,
    evMatchId: `playoff:${brId}:r${round}:m${match}`, matchId: `${prefix}-group`,
    teamA: [], teamB: [], scoreA, scoreB, winner: scoreA > scoreB ? 'A' : 'B', log: {}
  }));
}

function rotatingEvent(overrides = {}) {
  const entries = Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], created: i }));
  return {
    id: 'rot', name: 'Rotation Night', eventDate: '2026-07-25', created: 2, done: false, format: 'rotatingGroups',
    teams: [], entries, brackets: [],
    rotation: { entrySize: 2, teamSize: 4, rounds: 1, courts: 1, seedMode: 'manual', winPoints: 1, tiePoints: .5, lossPoints: 0 },
    rotationSchedule: [{ id: 'rot-r1-c1', round: 1, court: 1, sideAEntryIds: ['e0', 'e1'], sideBEntryIds: ['e2', 'e3'], status: 'pending' }],
    ...overrides
  };
}

function rotatingGame() {
  return {
    id: 'rot-result', date: 50, evId: 'rot', evMatchId: 'rot-r1-c1', eventFormat: 'rotatingGroups',
    evEntryIdsA: ['e0', 'e1'], evEntryIdsB: ['e2', 'e3'], teamA: ['p0', 'p1', 'p2', 'p3'], teamB: ['p4', 'p5', 'p6', 'p7'],
    scoreA: 25, scoreB: 21, winner: 'A', log: {}
  };
}

async function seed(page, { events, games = [], playerCount = 12 }) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { events, games, players: roster(playerCount) });
}

async function openEvent(page, id) {
  await page.goto('/');
  await page.evaluate(eventId => { tab = 'events'; openEvent(eventId); }, id);
}

/* EUX-04 shows one event section at a time on mobile, so a lifecycle assertion
   about a non-default section has to select that destination first. */
async function showSection(page, id) {
  await page.evaluate(section => eventSection(section), id);
}

test('lifecycle derivation covers every supported state for fixed and rotating events without storing a status', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await page.goto('/');

  const states = await page.evaluate(({ sched, pool, playoffs, rotating, rotatingGame }) => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const base = evts[0], read = (ev, gameList) => {
      const previous = games;
      games = gameList || [];
      try { return eventLifecycleState(ev); } finally { games = previous; }
    };
    const bracket = { id: 'champ', name: 'Championship', created: 100, seeds: ['t1', 't2', 't3', 't4'] };
    const withPlayoffs = { ...clone(base), sched, brackets: [bracket] };
    const finished = [...pool, ...playoffs.semis, ...playoffs.final];
    const before = JSON.stringify(evts);
    const result = {
      emptyDraft: read({ ...clone(base), teams: [] }, []),
      draft: read(clone(base), []),
      scheduled: read({ ...clone(base), sched }, []),
      live: read({ ...clone(base), sched }, [pool[0]]),
      poolsComplete: read({ ...clone(base), sched }, pool),
      playoffs: read(withPlayoffs, [...pool, ...playoffs.semis]),
      champion: read(withPlayoffs, finished),
      doneFlag: read({ ...clone(base), sched, done: true }, pool),
      rotatingDraft: read({ ...clone(rotating), rotationSchedule: [] }, []),
      rotatingScheduled: read(clone(rotating), []),
      rotatingPoolsComplete: read(clone(rotating), [rotatingGame]),
      rotatingDone: read({ ...clone(rotating), done: true }, [rotatingGame])
    };
    return { result, unchanged: JSON.stringify(evts) === before, keys: EVENT_LIFECYCLE_STATES.slice() };
  }, {
    sched: SCHED,
    pool: allPoolGames(),
    playoffs: {
      semis: [
        ...playoffSets({ round: 1, match: 1, a: 't1', b: 't4', scores: [[25, 18], [25, 19]], start: 200, prefix: 'semi-a' }),
        ...playoffSets({ round: 1, match: 2, a: 't2', b: 't3', scores: [[25, 21], [25, 22]], start: 210, prefix: 'semi-b' })
      ],
      final: playoffSets({ round: 2, match: 1, a: 't1', b: 't2', scores: [[25, 20], [25, 23]], start: 300, prefix: 'final' })
    },
    rotating: rotatingEvent(),
    rotatingGame: rotatingGame()
  });

  expect(states.result).toEqual({
    emptyDraft: 'draft',
    draft: 'draft',
    scheduled: 'scheduled',
    live: 'live',
    poolsComplete: 'poolsComplete',
    playoffs: 'playoffs',
    champion: 'complete',
    doneFlag: 'complete',
    rotatingDraft: 'draft',
    rotatingScheduled: 'scheduled',
    rotatingPoolsComplete: 'poolsComplete',
    rotatingDone: 'complete'
  });
  expect(states.keys).toEqual(['draft', 'scheduled', 'live', 'poolsComplete', 'playoffs', 'complete']);
  expect(states.unchanged).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vb:events'))[0].lifecycle)).toBeUndefined();
});

test('a draft fixed event leads with setup and never shows results or championship actions', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ teams: [] })] });
  await openEvent(page, 'fixed');

  await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', 'draft');
  await expect(page.locator('#event-overview')).toContainText('Event setup');
  await expect(page.locator('#event-overview .pill')).toHaveText('draft');
  await expect(page.locator('[data-event-finale]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View full results' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log next result' })).toHaveCount(0);

  const setup = page.locator('[data-event-setup-actions]');
  await expect(setup).toHaveAttribute('data-demoted', 'false');
  await expect(setup.getByRole('button', { name: 'Add team', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seed pools', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => {
    const setup = document.querySelector('[data-event-setup-actions]');
    return document.querySelector('#event-overview').compareDocumentPosition(setup) & Node.DOCUMENT_POSITION_FOLLOWING ? 'after-overview' : 'before-overview';
  })).toBe('after-overview');
  expect(await page.evaluate(() => {
    const setup = document.querySelector('[data-event-setup-actions]'), schedule = document.querySelector('#event-schedule');
    return !!(setup.compareDocumentPosition(schedule) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
});

test('a live fixed event shows the compact progress treatment, one logging control, and demoted setup', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ sched: SCHED })], games: [poolGame('pool-live', 't1', 't2', 100)] });
  await openEvent(page, 'fixed');
  await showSection(page, 'overview');

  await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', 'live');
  await expect(page.locator('#event-overview .pill')).toHaveText('live');
  const progress = page.locator('[data-event-progress]');
  await expect(progress).toHaveCount(1);
  await expect(progress).toContainText('Results so far');
  await expect(progress).toContainText('Current leader');
  await expect(progress).not.toContainText('CHAMPION CROWNED');
  await expect(page.locator('.event-finale')).toHaveCount(0);
  await expect(page.locator('.finale-trophy')).toHaveCount(0);
  expect(await progress.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

  await expect(page.getByRole('button', { name: 'Log next result' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Log a game' })).toHaveCount(0);

  const setup = page.locator('[data-event-setup-actions]');
  await expect(setup).toHaveAttribute('data-demoted', 'true');
  await expect(setup).toContainText('Event setup');
  await expect(setup.getByRole('button', { name: 'Add team', exact: true })).toBeVisible();
  await expect(setup.getByRole('button', { name: 'Seed pools', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => {
    const setup = document.querySelector('[data-event-setup-actions]'), standings = document.querySelector('#event-standings');
    return !!(standings.compareDocumentPosition(setup) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('a completed fixed event leads with results and hides registration setup', async ({ page }) => {
  const registration = { enabled: true, mode: 'team', status: 'closed', publicToken: null };
  await seed(page, { events: [fixedEvent({ sched: SCHED, done: true, registration })], games: allPoolGames() });
  await openEvent(page, 'fixed');

  await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', 'complete');
  await expect(page.locator('#event-overview .pill')).toHaveText('final');
  await expect(page.locator('.event-finale')).toHaveCount(1);
  await expect(page.locator('.finale-trophy')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Log next result' })).toHaveCount(0);
  await expect(page.locator('[data-event-setup-actions]')).toHaveCount(0);

  const card = page.locator('#event-registration');
  await expect(card).toHaveAttribute('data-registration-display', 'final');
  await expect(card.getByRole('button', { name: 'Registration settings' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Set up registration' })).toHaveCount(0);
  expect(await page.evaluate(() => {
    const overview = document.querySelector('#event-overview'), finale = document.querySelector('.event-finale');
    return !!(overview.compareDocumentPosition(finale) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
});

test('a completed event that never used registration drops the section and its destination', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ sched: SCHED, done: true })], games: allPoolGames() });
  await openEvent(page, 'fixed');

  await expect(page.locator('#event-registration')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Event sections' });
  await expect(nav.getByRole('button')).toHaveCount(5);
  await expect(nav.getByRole('button', { name: 'Registration', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('.event-subnav [data-event-tab]')]
    .every(button => !!document.getElementById(`event-${button.dataset.eventTab}`)))).toBe(true);
});

test('an in-play event collapses disabled registration into a secondary row that still reaches setup', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ sched: SCHED })], games: [poolGame('pool-live', 't1', 't2', 100)] });
  await openEvent(page, 'fixed');
  await showSection(page, 'registration');

  const card = page.locator('#event-registration');
  await expect(card).toHaveAttribute('data-registration-display', 'compact');
  await expect(card).toContainText('Public registration is off');
  await expect(card).not.toContainText('Collect long-lived team or individual intent');
  await expect(card.getByRole('button', { name: 'Set up registration' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Event sections' }).getByRole('button', { name: 'Registration', exact: true })).toBeVisible();
});

test('rotating events follow the same lifecycle and keep every format control', async ({ page }) => {
  await seed(page, { events: [rotatingEvent()] });
  await openEvent(page, 'rot');

  await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', 'scheduled');
  await expect(page.locator('#event-overview .pill')).toHaveText('scheduled');
  await expect(page.locator('[data-event-finale]')).toHaveCount(0);
  await expect(page.locator('[data-event-next-action]')).toHaveText('Log next match');
  await showSection(page, 'schedule');
  await expect(page.getByRole('button', { name: 'Log final score', exact: true })).toBeVisible();
  await showSection(page, 'entries');
  await expect(page.getByRole('button', { name: 'Add entry', exact: true })).toBeVisible();
  await showSection(page, 'overview');

  await page.evaluate(game => { games.push(game); render(); }, rotatingGame());
  await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', 'poolsComplete');
  await expect(page.locator('[data-event-progress]')).toContainText('Results so far');
  await expect(page.locator('[data-event-progress]')).toContainText('Pair 1');
  await expect(page.locator('[data-event-next-action]')).toHaveCount(0);
  await expect(page.locator('.finale-trophy')).toHaveCount(0);

  await page.evaluate(() => { evts[0].done = true; render(); });
  await expect(page.locator('#event-overview')).toHaveAttribute('data-event-lifecycle', 'complete');
  await expect(page.locator('.event-finale')).toHaveCount(1);
});

test('lifecycle sections stay usable at 320 px and on desktop widths', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ sched: SCHED })], games: [poolGame('pool-live', 't1', 't2', 100)] });
  for (const viewport of [{ width: 320, height: 700 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openEvent(page, 'fixed');
    await showSection(page, 'overview');
    await expect(page.locator('[data-event-progress]')).toBeVisible();
    await expect(page.locator('[data-event-setup-actions]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${viewport.width}px event overflow`).toBeLessThanOrEqual(0);
    const action = await page.getByRole('button', { name: 'Log next result' }).boundingBox();
    expect(action.height, `${viewport.width}px next-action height`).toBeGreaterThanOrEqual(40);
  }
});
