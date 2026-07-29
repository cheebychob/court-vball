import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const INVITE_TOKEN = 'I'.repeat(43);
const SESSION_TOKEN = 'S'.repeat(43);
const SESSION_KEY = 'court:event-staff:session:v1';
const DB_NAME = 'court-event-staff-v1';
const EVENT_ID = 'event-one';
const QUEUE_SCOPE = 'scope-event-one-grant-one';

const VIEW_PERMISSIONS = [
  'viewEvent', 'viewEntries', 'viewSchedule', 'viewMatches',
  'viewStandings', 'viewBracket', 'viewResults',
];
const SCOREKEEPER_PERMISSIONS = [
  ...VIEW_PERMISSIONS,
  'recordEventScore', 'correctEventScore', 'completeScheduledMatch',
];
const OPERATOR_PERMISSIONS = [
  ...SCOREKEEPER_PERMISSIONS,
  'setEntryCheckIn', 'setEntryAttendanceStatus',
  'viewRegistrationContact', 'moveScheduledMatch',
  'completeBracketMatch', 'viewActivity',
];

let STAFF_PAGE_HTML = '';
let STAFF_PAGE_HEADERS = {};
let STAFF_WORKER;

test.beforeAll(async () => {
  const workerSource = await readFile(`${process.cwd()}/cloudflare/court-sync-worker.js`, 'utf8');
  STAFF_WORKER = (await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`)).default;
  const response = await STAFF_WORKER.fetch(new Request('https://court-sync.example/staff'), {});
  STAFF_PAGE_HTML = await response.text();
  STAFF_PAGE_HEADERS = Object.fromEntries(response.headers.entries());
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deskState(role = 'tournamentOperator', overrides = {}) {
  const now = Date.now();
  const permissions = role === 'viewOnly'
    ? VIEW_PERMISSIONS
    : role === 'scorekeeper'
      ? SCOREKEEPER_PERMISSIONS
      : OPERATOR_PERMISSIONS;
  const state = {
    eventRevision: 7,
    accessEpoch: 2,
    serverTime: now,
    grant: {
      id: 'grant-one',
      staffLabel: role === 'viewOnly' ? 'Spectator tablet' : 'Head table',
      role,
      permissions,
      expiresAt: now + 60 * 60 * 1000,
    },
    event: {
      id: EVENT_ID,
      name: 'Lakefront Invitational',
      format: 'fixedTeams',
      eventDate: '2026-08-15',
      venue: 'Lakefront Fieldhouse',
      done: false,
      teams: [
        {
          id: 'team-a',
          name: 'Ospreys',
          players: ['player-a1', 'player-a2'],
          registrationId: 'registration-a',
          checkIn: {
            teamStatus: 'not_checked_in',
            activePlayerIds: ['player-a1', 'player-a2'],
            substitutePlayerIds: [],
            playerStatuses: {},
            updatedAt: null,
          },
        },
        {
          id: 'team-b',
          name: 'Anchors',
          players: ['player-b1', 'player-b2'],
          registrationId: 'registration-b',
          checkIn: {
            teamStatus: 'not_checked_in',
            activePlayerIds: ['player-b1', 'player-b2'],
            substitutePlayerIds: [],
            playerStatuses: {},
            updatedAt: null,
          },
        },
      ],
      entries: [],
      brackets: [{ id: 'bracket-main', name: 'Championship', seeds: ['team-a', 'team-b'], created: now - 1000 }],
    },
    games: [],
    participants: [
      { id: 'player-a1', name: 'Alex Rivera' },
      { id: 'player-a2', name: 'Avery Long' },
      { id: 'player-b1', name: 'Blair Chen' },
      { id: 'player-b2', name: 'Bailey West' },
    ],
    matches: [
      {
        id: 'pool-one',
        format: 'fixedTeams',
        phase: 'pool',
        status: 'ready',
        label: 'Pool A · Round 1',
        court: 1,
        courtLabel: 'Court 1',
        scheduledAt: now + 10 * 60 * 1000,
        slot: 0,
        sideAName: 'Ospreys',
        sideBName: 'Anchors',
        sideAPlayerIds: ['player-a1', 'player-a2'],
        sideBPlayerIds: ['player-b1', 'player-b2'],
        gameIds: [],
        result: null,
        staffScoreCorrectable: false,
        validPlacements: [
          { court: 1, scheduledAt: now + 10 * 60 * 1000, slot: 0 },
          { court: 2, scheduledAt: now + 55 * 60 * 1000, slot: 1 },
        ],
      },
      {
        id: 'final-one',
        format: 'fixedTeams',
        phase: 'playoff',
        status: 'ready',
        label: 'Championship semifinal',
        court: 2,
        courtLabel: 'Court 2',
        scheduledAt: now + 90 * 60 * 1000,
        sideAName: 'Ospreys',
        sideBName: 'Anchors',
        sideAPlayerIds: ['player-a1', 'player-a2'],
        sideBPlayerIds: ['player-b1', 'player-b2'],
        gameIds: [],
        downstreamMatchIds: ['final-two'],
        result: null,
        staffScoreCorrectable: false,
      },
    ],
    deletedGameIds: {},
    standings: [
      { id: 'team-a', name: 'Ospreys', wins: 1, losses: 0, ties: 0, pointDifferential: 4 },
      { id: 'team-b', name: 'Anchors', wins: 0, losses: 1, ties: 0, pointDifferential: -4 },
    ],
    bracket: [],
    contacts: [
      {
        registrationId: 'registration-a',
        displayName: 'Ospreys',
        status: 'accepted',
        contact: {
          name: 'Private Captain',
          email: 'captain.private@example.com',
          phone: '+1 555 0100',
          preferredMethod: 'email',
          notes: 'Private registration note',
        },
      },
    ],
    activity: [
      {
        id: 'activity-one',
        timestamp: now - 1000,
        staffLabel: 'Head table',
        role: 'tournamentOperator',
        action: 'setEntryCheckIn',
        targetId: 'team-a',
        revision: 6,
      },
    ],
  };
  state.bracket = state.matches.filter(match => match.phase === 'playoff');
  return { ...state, ...clone(overrides) };
}

async function installDeskMocks(page, {
  role = 'tournamentOperator',
  initialState = deskState(role),
  onOperation,
  onState,
  queueScope = QUEUE_SCOPE,
} = {}) {
  const mock = {
    state: clone(initialState),
    redeems: [],
    operations: [],
    logouts: [],
    stateReads: 0,
  };

  await page.route(url => new URL(url).pathname === '/staff', route => route.fulfill({
    status: 200,
    headers: STAFF_PAGE_HEADERS,
    body: STAFF_PAGE_HTML,
  }));

  await page.route('**/api/event-staff/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postData() ? request.postDataJSON() : {};
    const fulfillJson = (status, json) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(json),
    });

    if (url.pathname === '/api/event-staff/redeem') {
      mock.redeems.push(body);
      return fulfillJson(200, {
        ok: true,
        sessionToken: SESSION_TOKEN,
        sessionExpiresAt: Date.now() + 60 * 60 * 1000,
        queueScope,
        state: clone(mock.state),
      });
    }
    if (url.pathname === '/api/event-staff/state') {
      mock.stateReads += 1;
      if (onState) {
        const response = await onState({ request, mock });
        return fulfillJson(response.status ?? 200, response.json);
      }
      return fulfillJson(200, { ok: true, state: clone(mock.state) });
    }
    if (url.pathname === '/api/event-staff/operations') {
      mock.operations.push(clone(body));
      if (onOperation) {
        const response = await onOperation({ body: clone(body), attempt: mock.operations.length, request, mock });
        return fulfillJson(response.status ?? 200, response.json);
      }
      mock.state.eventRevision += 1;
      return fulfillJson(200, {
        ok: true,
        eventRevision: mock.state.eventRevision,
        revision: mock.state.eventRevision,
        state: clone(mock.state),
        warnings: [],
      });
    }
    if (url.pathname === '/api/event-staff/logout') {
      mock.logouts.push({ body, authorization: request.headers().authorization });
      return fulfillJson(200, { ok: true });
    }
    return fulfillJson(404, { ok: false, error: 'not_found' });
  });

  return mock;
}

async function openDesk(page, options = {}) {
  const mock = await installDeskMocks(page, options);
  await page.goto(`/staff#token=${INVITE_TOKEN}`);
  await expect(page).toHaveURL(/\/staff$/);
  await page.getByRole('button', { name: 'Open Tournament Desk' }).click();
  await expect(page.locator('#event-name')).toHaveText('Lakefront Invitational');
  return mock;
}

async function indexedDbRows(page) {
  return page.evaluate(async ({ dbName }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        ['queue', 'drafts', 'cache'].forEach(name => {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' });
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = {};
    for (const name of ['queue', 'drafts', 'cache']) {
      result[name] = await new Promise((resolve, reject) => {
        const request = db.transaction(name, 'readonly').objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }
    db.close();
    return result;
  }, { dbName: DB_NAME });
}

async function putIndexedDbRows(page, rows) {
  await page.evaluate(async ({ dbName, rows: values }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        ['queue', 'drafts', 'cache'].forEach(name => {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' });
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const [name, records] of Object.entries(values)) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(name, 'readwrite');
        records.forEach(record => transaction.objectStore(name).put(record));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    }
    db.close();
  }, { dbName: DB_NAME, rows });
}

async function queueTwoAttendanceChanges(page) {
  await page.getByRole('button', { name: 'Check-In' }).click();
  const selects = page.locator('select[aria-label^="Attendance status for"]');
  await expect(selects).toHaveCount(2);
  await selects.nth(0).selectOption('checked_in');
  await expect(page.locator('#queue-state')).toContainText('1 pending action');
  await selects.nth(1).selectOption('no_show');
  await expect(page.locator('#queue-state')).toContainText('2 pending actions');
}

test('the standalone Desk response is private, noindex, nonce-CSP protected, and not the full app', async () => {
  const response = await STAFF_WORKER.fetch(new Request('https://court-sync.example/staff'), {});
  const html = await response.text();
  const csp = response.headers.get('content-security-policy') || '';

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(/private.*no-store/);
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('x-robots-tag')).toMatch(/noindex.*nofollow.*noarchive/);
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('permissions-policy')).toContain('camera=()');
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(html).toContain('<meta name="robots" content="noindex,nofollow,noarchive">');
  expect(html).toContain('<meta name="referrer" content="no-referrer">');
  expect(html).not.toMatch(/<script[^>]+\bsrc=/i);
  expect(html).not.toContain('APP_INFO');
  expect(html).not.toContain('vb:players');

  const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];
  const styleNonce = html.match(/<style nonce="([^"]+)"/)?.[1];
  expect(scriptNonce).toBeTruthy();
  expect(styleNonce).toBe(scriptNonce);
  expect(csp).toContain(`script-src 'nonce-${scriptNonce}'`);
  expect(csp).toContain(`style-src 'nonce-${styleNonce}'`);

  const rejected = await STAFF_WORKER.fetch(new Request('https://court-sync.example/staff', { method: 'POST' }), {});
  expect(rejected.status).toBe(405);
  expect(rejected.headers.get('allow')).toBe('GET');
  expect(rejected.headers.get('cache-control')).toContain('no-store');
});

test('the invite fragment is scrubbed immediately and is never left in page state or markup', async ({ page }) => {
  const mock = await installDeskMocks(page);
  await page.goto(`/staff#token=${INVITE_TOKEN}`);

  await expect(page).toHaveURL(/\/staff$/);
  expect(await page.evaluate(() => location.hash)).toBe('');
  expect(await page.evaluate(token => document.documentElement.outerHTML.includes(token), INVITE_TOKEN)).toBe(false);
  expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toBeNull();
  expect(mock.redeems).toHaveLength(0);

  await page.getByRole('button', { name: 'Open Tournament Desk' }).click();
  await expect(page.locator('#event-name')).toHaveText('Lakefront Invitational');
  expect(mock.redeems).toEqual([{ token: INVITE_TOKEN, pin: '' }]);
  await expect(page).toHaveURL(/\/staff$/);
});

test('a new invite supersedes and clears an existing restricted session before redemption', async ({ page }) => {
  const mock = await installDeskMocks(page);
  const oldScope = 'scope-old-event-grant';
  await page.goto('/staff');
  await page.evaluate(({ key, token, queueScope }) => {
    sessionStorage.setItem(key, JSON.stringify({
      token,
      expiresAt: Date.now() + 60 * 60 * 1000,
      queueScope,
    }));
  }, { key: SESSION_KEY, token: 'O'.repeat(43), queueScope: oldScope });
  await putIndexedDbRows(page, {
    queue: [{
      key: `queue:${oldScope}:old-action`,
      scope: oldScope,
      createdAt: Date.now(),
      sequence: 1,
      operation: {},
    }],
    cache: [{
      key: `cache:${oldScope}`,
      scope: oldScope,
      state: deskState('viewOnly'),
      updatedAt: Date.now(),
    }],
  });

  await page.goto(`/staff#token=${INVITE_TOKEN}`);
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.locator('#access')).toBeVisible();
  expect(mock.stateReads).toBe(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toBeNull();
  const cleared = await indexedDbRows(page);
  expect(cleared.queue.some(row => row.scope === oldScope)).toBe(false);
  expect(cleared.cache.some(row => row.scope === oldScope)).toBe(false);

  await page.getByRole('button', { name: 'Open Tournament Desk' }).click();
  await expect(page.locator('#event-name')).toHaveText('Lakefront Invitational');
  expect(mock.redeems).toEqual([{ token: INVITE_TOKEN, pin: '' }]);
});

test('View Only renders event-safe data with no mutation, contacts, activity, ratings, or full-app navigation', async ({ page }) => {
  const viewState = deskState('viewOnly');
  // Deliberately leave operator-only fields in the mocked response: the UI
  // still must not expose them when the grant lacks the permission.
  await openDesk(page, { role: 'viewOnly', initialState: viewState });

  await expect(page.locator('#staff-meta')).toContainText('View Only');
  await expect(page.getByRole('navigation', { name: 'Tournament Desk sections' }).getByRole('button')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Check-In' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activity' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enter score|Correct score|Move match/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByRole('button', { name: /Enter score|Correct score|Move match/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Event Information' }).click();
  await expect(page.locator('#content')).not.toContainText('captain.private@example.com');
  await expect(page.locator('#content')).not.toContainText('Private registration note');
  await expect(page.locator('#content')).not.toContainText('setEntryCheckIn');

  expect(await page.locator('a').count()).toBe(0);
  await expect(page.getByRole('button', { name: /Players|Ratings|Backups|Settings|Sync|Public links/i })).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/\b\d{2,4}\s*(rating|elo)\b/i);
});

test('Scorekeeper can score scheduled matches but is not offered a playoff correction the Worker will reject', async ({ page }) => {
  const scorekeeperState = deskState('scorekeeper');
  scorekeeperState.matches[1].status = 'complete';
  scorekeeperState.matches[1].result = {
    gameIds: ['game-final-one'],
    sets: [[25, 19]],
    winner: 'A',
    scoreLabel: '25–19',
    tie: false,
  };
  await openDesk(page, { role: 'scorekeeper', initialState: scorekeeperState });

  await expect(page.locator('#staff-meta')).toContainText('Scorekeeper');
  await expect(page.getByRole('button', { name: 'Enter score' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check-In' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activity' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Bracket' }).click();
  await expect(page.locator('#content')).toContainText('25–19');
  await expect(page.getByRole('button', { name: 'Correct score' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enter score' })).toHaveCount(0);
});

test('score correction controls follow server provenance for Scorekeeper while Operator remains allowed', async ({ page, context }) => {
  const ownerResult = {
    gameIds: ['owner-game-pool-one'],
    sets: [[25, 19]],
    winner: 'A',
    scoreLabel: '25–19',
    tie: false,
  };
  const scorekeeperState = deskState('scorekeeper');
  scorekeeperState.matches[0].status = 'complete';
  scorekeeperState.matches[0].result = ownerResult;
  scorekeeperState.matches[0].staffScoreCorrectable = false;
  await openDesk(page, { role: 'scorekeeper', initialState: scorekeeperState });
  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.locator('#content')).toContainText('25–19');
  await expect(page.getByRole('button', { name: 'Correct score' })).toHaveCount(0);

  const operatorPage = await context.newPage();
  const operatorState = deskState('tournamentOperator');
  operatorState.matches[0].status = 'complete';
  operatorState.matches[0].result = ownerResult;
  operatorState.matches[0].staffScoreCorrectable = false;
  await openDesk(operatorPage, {
    role: 'tournamentOperator',
    initialState: operatorState,
  });
  await operatorPage.getByRole('button', { name: 'Schedule' }).click();
  await expect(operatorPage.getByRole('button', { name: 'Correct score' })).toBeVisible();
  await operatorPage.close();
});

test('manual Refresh is touch-safe and updates other-device state without polling', async ({ page }) => {
  let releaseRefresh;
  const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
  const mock = await openDesk(page, {
    onState: async ({ mock: apiMock }) => {
      await refreshGate;
      apiMock.state.event.name = 'Lakefront Invitational · Updated';
      apiMock.state.eventRevision = 8;
      return { json: { ok: true, state: clone(apiMock.state) } };
    },
  });
  const refresh = page.getByRole('button', { name: 'Refresh' });
  await expect(refresh).toBeVisible();
  expect((await refresh.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(mock.stateReads).toBe(0);

  await refresh.click();
  await expect(refresh).toBeDisabled();
  await expect(refresh).toHaveText('Refreshing…');
  await expect(page.locator('#notice')).toContainText('Refreshing event');
  expect(mock.stateReads).toBe(1);
  await page.waitForTimeout(75);
  expect(mock.stateReads).toBe(1);

  releaseRefresh();
  await expect(refresh).toBeEnabled();
  await expect(refresh).toHaveText('Refresh');
  await expect(page.locator('#event-name')).toHaveText('Lakefront Invitational · Updated');
  await expect(page.locator('#notice')).toContainText('Event refreshed');
  await expect(page.locator('#last-sync')).not.toHaveText('Not synchronized');
  await page.waitForTimeout(75);
  expect(mock.stateReads).toBe(1);
});

test('Tournament Operator gets check-in contacts and activity in a mobile, single-scroll, touch-safe, focus-safe Desk', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openDesk(page);

  const tabs = page.getByRole('navigation', { name: 'Tournament Desk sections' });
  await expect(tabs.getByRole('button', { name: 'Check-In' })).toBeVisible();
  await expect(tabs.getByRole('button', { name: 'Activity' })).toBeVisible();
  await tabs.getByRole('button', { name: 'Check-In' }).click();
  await expect(page.locator('#content')).toContainText('captain.private@example.com');
  await expect(page.locator('#content')).toContainText('+1 555 0100');
  await tabs.getByRole('button', { name: 'Activity' }).click();
  await expect(page.locator('#content')).toContainText('Head table · setEntryCheckIn');

  const layout = await page.evaluate(() => {
    const visible = node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const nestedScrollers = [...document.querySelectorAll('body *')].filter(node => {
      if (!visible(node)) return false;
      const overflow = getComputedStyle(node).overflowY;
      return /(auto|scroll)/.test(overflow) && node.scrollHeight > node.clientHeight + 1;
    }).map(node => node.id || node.className || node.tagName);
    return {
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nestedScrollers,
      scrollingElement: document.scrollingElement?.tagName,
    };
  });
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(layout.nestedScrollers).toEqual([]);
  expect(['HTML', 'BODY']).toContain(layout.scrollingElement);

  await tabs.getByRole('button', { name: 'Current Matches' }).click();
  const scoreTrigger = page.getByRole('button', { name: 'Enter score' }).first();
  await expect(scoreTrigger).toBeVisible();
  expect((await scoreTrigger.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await scoreTrigger.click();
  await expect(page.locator('#score-dialog')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.querySelector('#score-dialog').contains(document.activeElement))).toBe(true);

  const undersizedControls = await page.locator('#score-dialog button, #score-dialog input, #score-dialog select').evaluateAll(nodes =>
    nodes.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.height < 44 || rect.width < 44);
    }).map(node => ({ tag: node.tagName, id: node.id, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  expect(undersizedControls).toEqual([]);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(scoreTrigger).toBeFocused();
});

test('an online write stays Pending and never claims Saved before server acknowledgement', async ({ page }) => {
  let acknowledge;
  const acknowledgement = new Promise(resolve => { acknowledge = resolve; });
  const mock = await openDesk(page, {
    role: 'tournamentOperator',
    onOperation: async ({ mock: apiMock }) => {
      await acknowledgement;
      apiMock.state.eventRevision += 1;
      return {
        json: {
          ok: true,
          revision: apiMock.state.eventRevision,
          eventRevision: apiMock.state.eventRevision,
          state: clone(apiMock.state),
          warnings: [],
        },
      };
    },
  });

  await page.getByRole('button', { name: 'Enter score' }).first().click();
  await page.getByRole('spinbutton', { name: 'Side A set 1' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Side B set 1' }).fill('21');
  await page.getByRole('button', { name: 'Review & queue' }).click();

  await expect(page.locator('#notice')).toContainText('Pending server confirmation');
  await expect(page.locator('#queue-state')).toContainText('1 pending action');
  await expect(page.locator('body')).not.toContainText('Saved and synchronized');
  await expect.poll(() => mock.operations.length).toBe(1);
  expect(mock.operations[0]).toMatchObject({
    eventId: EVENT_ID,
    action: 'recordEventScore',
    targetId: 'pool-one',
    expectedRevision: 7,
    replayed: false,
    payload: { mode: 'set', sets: [[25, 21]], winner: 'A' },
  });
  expect(mock.operations[0].idempotencyKey).toMatch(/^desk-[A-Za-z0-9_-]{20,}$/);

  acknowledge();
  await expect(page.locator('#notice')).toContainText('Saved and synchronized');
  await expect(page.locator('#queue-state')).toBeHidden();
});

test('an online action queued during an in-flight acknowledgement rebases to that acknowledged revision', async ({ page }) => {
  let acknowledgeFirst;
  const firstAcknowledgement = new Promise(resolve => { acknowledgeFirst = resolve; });
  const mock = await openDesk(page, {
    onOperation: async ({ body, attempt, mock: apiMock }) => {
      if (attempt === 1) await firstAcknowledgement;
      if (body.expectedRevision !== apiMock.state.eventRevision) {
        return {
          status: 409,
          json: {
            ok: false,
            error: 'revision_conflict',
            currentRevision: apiMock.state.eventRevision,
            state: clone(apiMock.state),
          },
        };
      }
      apiMock.state.eventRevision += 1;
      return {
        json: {
          ok: true,
          revision: apiMock.state.eventRevision,
          eventRevision: apiMock.state.eventRevision,
          state: clone(apiMock.state),
          warnings: [],
        },
      };
    },
  });

  await page.getByRole('button', { name: 'Check-In' }).click();
  const attendance = page.locator('select[aria-label^="Attendance status for"]');
  await attendance.nth(0).selectOption('checked_in');
  await expect.poll(() => mock.operations.length).toBe(1);
  await attendance.nth(1).selectOption('no_show');
  await expect(page.locator('#queue-state')).toContainText('2 pending actions');

  acknowledgeFirst();
  await expect.poll(() => mock.operations.length).toBe(2);
  await expect(page.locator('#queue-state')).toBeHidden();
  await expect(page.locator('#notice')).toContainText('Saved and synchronized');

  expect(mock.operations.map(operation => ({
    targetId: operation.targetId,
    expectedRevision: operation.expectedRevision,
    replayed: operation.replayed,
  }))).toEqual([
    { targetId: 'team-a', expectedRevision: 7, replayed: false },
    { targetId: 'team-b', expectedRevision: 8, replayed: false },
  ]);
  expect(mock.state.eventRevision).toBe(9);
});

test('a failed IndexedDB queue write keeps the score dialog and draft open without claiming Pending or Saved', async ({ page }) => {
  const mock = await openDesk(page);
  await page.getByRole('button', { name: 'Enter score' }).first().click();
  await page.getByRole('spinbutton', { name: 'Side A set 1' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Side B set 1' }).fill('21');
  await page.locator('#score-reason').fill('Paper score sheet retained');
  await expect.poll(async () => {
    const rows = await indexedDbRows(page);
    return rows.drafts.some(row => row.scope === QUEUE_SCOPE && row.matchId === 'pool-one');
  }).toBe(true);

  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function put(value, ...args) {
      if (this.name === 'queue') {
        throw new DOMException('Simulated queue quota failure', 'QuotaExceededError');
      }
      return originalPut.call(this, value, ...args);
    };
  });
  await page.getByRole('button', { name: 'Review & queue' }).click();

  await expect(page.locator('#score-dialog')).toHaveAttribute('open', '');
  await expect(page.getByRole('spinbutton', { name: 'Side A set 1' })).toHaveValue('25');
  await expect(page.getByRole('spinbutton', { name: 'Side B set 1' })).toHaveValue('21');
  await expect(page.locator('#notice')).toContainText(/draft|local|storage|not saved/i);
  await expect(page.locator('#notice')).not.toContainText(/Pending server confirmation|Saved and synchronized/);
  await expect(page.locator('#queue-state')).toBeHidden();
  await page.waitForTimeout(100);
  expect(mock.operations).toHaveLength(0);

  const rows = await indexedDbRows(page);
  expect(rows.queue.filter(row => row.scope === QUEUE_SCOPE)).toEqual([]);
  const draft = rows.drafts.find(row => row.scope === QUEUE_SCOPE && row.matchId === 'pool-one');
  expect(draft).toBeTruthy();
  expect(draft.sets.map(pair => pair.map(Number))).toEqual([[25, 21]]);
  expect(draft.reason).toBe('Paper score sheet retained');
});

test('a failed IndexedDB check-in queue write restores the prior status and reports that nothing was queued', async ({ page }) => {
  const mock = await openDesk(page);
  await page.getByRole('button', { name: 'Check-In' }).click();
  const attendance = page.getByRole('combobox', { name: 'Attendance status for Ospreys' });
  await expect(attendance).toHaveValue('not_checked_in');

  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function put(value, ...args) {
      if (this.name === 'queue') {
        throw new DOMException('Simulated queue quota failure', 'QuotaExceededError');
      }
      return originalPut.call(this, value, ...args);
    };
  });
  await attendance.selectOption('checked_in');

  await expect(attendance).toHaveValue('not_checked_in');
  await expect(page.locator('#notice')).toContainText(/not queued|local|storage|not saved/i);
  await expect(page.locator('#notice')).not.toContainText(/Pending server confirmation|Saved and synchronized/);
  await expect(page.locator('#queue-state')).toBeHidden();
  await page.waitForTimeout(100);
  expect(mock.operations).toHaveLength(0);

  const rows = await indexedDbRows(page);
  expect(rows.queue.filter(row => row.scope === QUEUE_SCOPE)).toEqual([]);
});

test('an HTTP failure changes the connection pill until the pending action is acknowledged', async ({ page }) => {
  const mock = await openDesk(page, {
    onOperation: async ({ attempt, mock: apiMock }) => {
      if (attempt === 1) {
        return {
          status: 503,
          json: { ok: false, error: 'temporarily_unavailable', message: 'Try again.' },
        };
      }
      apiMock.state.eventRevision += 1;
      return {
        json: {
          ok: true,
          revision: apiMock.state.eventRevision,
          eventRevision: apiMock.state.eventRevision,
          state: clone(apiMock.state),
          warnings: [],
        },
      };
    },
  });
  await expect(page.locator('#connection')).toHaveText('Online');

  await page.getByRole('button', { name: 'Enter score' }).first().click();
  await page.getByRole('spinbutton', { name: 'Side A set 1' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Side B set 1' }).fill('21');
  await page.getByRole('button', { name: 'Review & queue' }).click();

  await expect.poll(() => mock.operations.length).toBe(1);
  await expect(page.locator('#queue-state')).toContainText('1 pending action');
  await expect(page.locator('#connection')).not.toHaveText('Online');
  await expect(page.locator('#connection')).toContainText(/offline|connection|unavailable|pending/i);
  await expect(page.locator('#notice')).not.toContainText('Saved and synchronized');

  await page.getByRole('button', { name: 'Retry network request' }).click();
  await expect.poll(() => mock.operations.length).toBe(2);
  await expect(page.locator('#queue-state')).toBeHidden();
  await expect(page.locator('#connection')).toHaveText('Online');
  await expect(page.locator('#notice')).toContainText('Saved and synchronized');
});

test('offline actions replay in creation order, keep their idempotency keys on retry, and advance the expected revision', async ({ page, context }) => {
  const mock = await openDesk(page, {
    onOperation: async ({ attempt, mock: apiMock }) => {
      if (attempt === 1) {
        return { status: 503, json: { ok: false, error: 'temporarily_unavailable', message: 'Try again.' } };
      }
      apiMock.state.eventRevision += 1;
      return {
        json: {
          ok: true,
          revision: apiMock.state.eventRevision,
          eventRevision: apiMock.state.eventRevision,
          state: clone(apiMock.state),
          warnings: [],
        },
      };
    },
  });

  await context.setOffline(true);
  await queueTwoAttendanceChanges(page);
  expect(mock.operations).toHaveLength(0);

  await context.setOffline(false);
  await expect.poll(() => mock.operations.length).toBe(1);
  await expect(page.locator('#notice')).toContainText(/Offline or unavailable|remains pending/);
  await page.getByRole('button', { name: 'Retry network request' }).click();
  await expect.poll(() => mock.operations.length).toBe(3);
  await expect(page.locator('#queue-state')).toBeHidden();

  const [failedFirst, retriedFirst, second] = mock.operations;
  expect(failedFirst.targetId).toBe('team-a');
  expect(retriedFirst.targetId).toBe('team-a');
  expect(second.targetId).toBe('team-b');
  expect(retriedFirst.idempotencyKey).toBe(failedFirst.idempotencyKey);
  expect(second.idempotencyKey).not.toBe(failedFirst.idempotencyKey);
  expect(failedFirst.expectedRevision).toBe(7);
  expect(retriedFirst.expectedRevision).toBe(7);
  expect(second.expectedRevision).toBe(8);
  expect(mock.operations.map(operation => operation.replayed)).toEqual([true, true, true]);
});

test('an offline score keeps its captured revision after reload and reviews the server conflict instead of overwriting it', async ({ page }) => {
  const currentState = deskState('tournamentOperator');
  currentState.eventRevision = 8;
  currentState.matches[0].status = 'complete';
  currentState.matches[0].result = {
    gameIds: ['game-current'],
    sets: [[25, 18]],
    winner: 'A',
    scoreLabel: '25–18',
    tie: false,
  };
  const idempotencyKey = 'desk-stale-reload-0001';
  const mock = await installDeskMocks(page, {
    onOperation: async ({ body, mock: apiMock }) => {
      if (body.expectedRevision === apiMock.state.eventRevision) {
        apiMock.state.eventRevision += 1;
        return {
          json: {
            ok: true,
            revision: apiMock.state.eventRevision,
            eventRevision: apiMock.state.eventRevision,
            state: clone(apiMock.state),
            warnings: [],
          },
        };
      }
      return {
        status: 409,
        json: {
          ok: false,
          error: 'revision_conflict',
          message: 'The event changed before this operation could be saved.',
          currentRevision: apiMock.state.eventRevision,
          attempted: {
            eventId: body.eventId,
            action: body.action,
            targetId: body.targetId,
            expectedRevision: body.expectedRevision,
            payload: body.payload,
          },
          state: clone(apiMock.state),
        },
      };
    },
  });

  await page.goto('/staff');
  await expect(page.locator('#access')).toBeVisible();
  await page.evaluate(({ key, token, queueScope }) => {
    sessionStorage.setItem(key, JSON.stringify({
      token,
      expiresAt: Date.now() + 60 * 60 * 1000,
      queueScope,
    }));
  }, { key: SESSION_KEY, token: SESSION_TOKEN, queueScope: QUEUE_SCOPE });
  await putIndexedDbRows(page, {
    queue: [{
      key: `queue:${QUEUE_SCOPE}:${idempotencyKey}`,
      scope: QUEUE_SCOPE,
      createdAt: Date.now(),
      sequence: 1,
      attempted: false,
      originatedOffline: true,
      operation: {
        eventId: EVENT_ID,
        action: 'recordEventScore',
        targetId: 'pool-one',
        expectedRevision: 7,
        idempotencyKey,
        payload: { mode: 'set', sets: [[21, 25]], winner: 'B' },
        replayed: false,
      },
    }],
    cache: [{
      key: `cache:${QUEUE_SCOPE}`,
      scope: QUEUE_SCOPE,
      state: deskState('tournamentOperator'),
      updatedAt: Date.now() - 1000,
    }],
  });
  mock.state = clone(currentState);

  await page.reload();
  await expect.poll(() => mock.stateReads).toBe(1);
  await expect.poll(() => mock.operations.length).toBe(1);

  expect(mock.operations[0]).toMatchObject({
    eventId: EVENT_ID,
    action: 'recordEventScore',
    targetId: 'pool-one',
    expectedRevision: 7,
    idempotencyKey,
    replayed: true,
    payload: { mode: 'set', sets: [[21, 25]], winner: 'B' },
  });
  await expect(page.locator('#queue-state')).toContainText(/current server score/i);
  await expect(page.locator('#queue-state')).toContainText(/attempted score/i);
  await expect(page.locator('#queue-state')).toContainText('25–18');
  await expect(page.locator('#queue-state')).toContainText('21–25');
  await expect(page.getByRole('button', { name: 'Review and create correction' })).toBeVisible();

  const rows = await indexedDbRows(page);
  expect(rows.queue).toHaveLength(1);
  expect(rows.queue[0].operation.expectedRevision).toBe(7);
  expect(rows.queue[0].operation.idempotencyKey).toBe(idempotencyKey);
});

test('a revision conflict shows the current and attempted results and requires a new intentional correction key', async ({ page }) => {
  let firstOperation;
  const currentState = deskState('tournamentOperator');
  currentState.eventRevision = 8;
  currentState.matches[0].status = 'complete';
  currentState.matches[0].result = {
    gameIds: ['game-current'],
    sets: [[25, 18]],
    winner: 'A',
    scoreLabel: '25–18',
    tie: false,
  };
  const mock = await openDesk(page, {
    onOperation: async ({ body, attempt, mock: apiMock }) => {
      if (attempt === 1) {
        firstOperation = body;
        apiMock.state = clone(currentState);
        return {
          status: 409,
          json: {
            ok: false,
            error: 'revision_conflict',
            message: 'The event changed before this operation could be saved.',
            currentRevision: 8,
            attempted: {
              eventId: body.eventId,
              action: body.action,
              targetId: body.targetId,
              expectedRevision: body.expectedRevision,
              payload: body.payload,
            },
            state: clone(currentState),
          },
        };
      }
      apiMock.state = clone(currentState);
      apiMock.state.eventRevision = 9;
      return {
        json: {
          ok: true,
          revision: 9,
          eventRevision: 9,
          state: clone(apiMock.state),
          warnings: [],
        },
      };
    },
  });

  await page.getByRole('button', { name: 'Enter score' }).first().click();
  await page.getByRole('spinbutton', { name: 'Side A set 1' }).fill('21');
  await page.getByRole('spinbutton', { name: 'Side B set 1' }).fill('25');
  await page.getByRole('button', { name: 'Review & queue' }).click();

  await expect(page.locator('#queue-state')).toContainText(/current/i);
  await expect(page.locator('#queue-state')).toContainText(/attempted/i);
  await expect(page.locator('#queue-state')).toContainText('25–18');
  await expect(page.locator('#queue-state')).toContainText('21–25');
  expect(mock.operations).toHaveLength(1);

  await page.getByRole('button', { name: 'Review and create correction' }).click();
  await expect(page.locator('#score-dialog')).toHaveAttribute('open', '');
  await expect(page.getByRole('spinbutton', { name: 'Side A set 1' })).toHaveValue('21');
  await expect(page.getByRole('spinbutton', { name: 'Side B set 1' })).toHaveValue('25');
  expect(mock.operations).toHaveLength(1);
  await page.getByRole('button', { name: 'Review & queue' }).click();
  await expect.poll(() => mock.operations.length).toBe(2);
  const correction = mock.operations[1];
  expect(correction.action).toBe('correctEventScore');
  expect(correction.expectedRevision).toBe(8);
  expect(correction.idempotencyKey).not.toBe(firstOperation.idempotencyKey);
  expect(correction.payload.sets).toEqual([[21, 25]]);
  await expect(page.locator('#notice')).toContainText('Saved and synchronized');
});

test('a playoff correction warns about dependent results and sends confirmation only after an explicit operator choice', async ({ page }) => {
  const playoffState = deskState('tournamentOperator');
  playoffState.matches[1].status = 'complete';
  playoffState.matches[1].result = {
    gameIds: ['game-final-one'],
    sets: [[25, 19]],
    winner: 'A',
    scoreLabel: '25–19',
    tie: false,
  };
  playoffState.bracket = playoffState.matches.filter(match => match.phase === 'playoff');
  const mock = await openDesk(page, {
    initialState: playoffState,
    onOperation: async ({ body, attempt, mock: apiMock }) => {
      if (attempt === 1) {
        return {
          status: 409,
          json: {
            ok: false,
            error: 'downstream_confirmation_required',
            message: 'Changing this winner affects completed later playoff matches.',
            dependentMatches: [
              {
                id: 'final-two',
                label: 'Championship final',
                result: { gameIds: ['game-final-two'], sets: [[25, 22]], winner: 'A', scoreLabel: '25–22' },
              },
            ],
          },
        };
      }
      apiMock.state.eventRevision += 1;
      return {
        json: {
          ok: true,
          revision: apiMock.state.eventRevision,
          eventRevision: apiMock.state.eventRevision,
          state: clone(apiMock.state),
          warnings: [{ code: 'downstream_results_removed', message: '1 dependent playoff game record must be re-entered.' }],
        },
      };
    },
  });

  await page.getByRole('button', { name: 'Bracket' }).click();
  await page.getByRole('button', { name: 'Correct score' }).click();
  await page.getByRole('spinbutton', { name: 'Side A set 1' }).fill('19');
  await page.getByRole('spinbutton', { name: 'Side B set 1' }).fill('25');
  await page.getByRole('button', { name: 'Review & queue' }).click();

  await expect(page.locator('#queue-state')).toContainText('invalidates 1 completed later bracket match');
  await expect(page.locator('#queue-state')).toContainText('removed and must be re-entered');
  expect(mock.operations).toHaveLength(1);
  expect(mock.operations[0].payload.confirmDownstreamImpact).toBeUndefined();

  await page.getByRole('button', { name: 'Confirm bracket recovery' }).click();
  await expect.poll(() => mock.operations.length).toBe(2);
  expect(mock.operations[1].payload.confirmDownstreamImpact).toBe(true);
  await expect(page.locator('#notice')).toContainText(/must be re-entered/i);
});

for (const [label, error] of [
  ['revoked', 'access_revoked'],
  ['expired', 'access_expired'],
]) {
  test(`${label} access stops ordered queue replay and clears sensitive local event data`, async ({ page, context }) => {
    const mock = await openDesk(page, {
      onOperation: async () => ({
        status: 401,
        json: { ok: false, error, message: `This staff access ${label}.` },
      }),
    });

    await context.setOffline(true);
    await queueTwoAttendanceChanges(page);
    await context.setOffline(false);
    await expect.poll(() => mock.operations.length).toBe(1);
    await expect(page.locator('#access')).toBeVisible();
    await expect(page.locator('#access-message')).toContainText(/expired or was revoked|revoked|expired/i);
    await page.waitForTimeout(100);
    expect(mock.operations).toHaveLength(1);
    expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toBeNull();
    const rows = await indexedDbRows(page);
    for (const name of ['queue', 'drafts', 'cache']) {
      expect(rows[name].filter(row => row.scope === QUEUE_SCOPE)).toEqual([]);
    }
  });
}

test('score drafts preserve mode, sets, and reason across Cancel, stay grant-scoped, and clear only on explicit Discard', async ({ page, context }) => {
  await openDesk(page);
  const scoreTrigger = page.getByRole('button', { name: 'Enter score' }).first();
  await scoreTrigger.click();
  await page.locator('#score-mode').selectOption('bo3');
  await page.getByRole('spinbutton', { name: 'Side A set 1' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Side B set 1' }).fill('21');
  await page.getByRole('spinbutton', { name: 'Side A set 2' }).fill('19');
  await page.getByRole('spinbutton', { name: 'Side B set 2' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Side A set 3' }).fill('15');
  await page.getByRole('spinbutton', { name: 'Side B set 3' }).fill('12');
  await page.locator('#score-reason').fill('Score sheet verified at the head table');

  await expect.poll(async () => {
    const rows = await indexedDbRows(page);
    const draft = rows.drafts.find(row => row.scope === QUEUE_SCOPE && row.matchId === 'pool-one');
    return draft && {
      mode: draft.mode,
      sets: draft.sets,
      reason: draft.reason,
    };
  }).toEqual({
    mode: 'bo3',
    sets: [['25', '21'], ['19', '25'], ['15', '12']],
    reason: 'Score sheet verified at the head table',
  });

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(scoreTrigger).toBeFocused();
  await scoreTrigger.click();
  await expect(page.locator('#score-mode')).toHaveValue('bo3');
  await expect(page.getByRole('spinbutton', { name: 'Side A set 1' })).toHaveValue('25');
  await expect(page.getByRole('spinbutton', { name: 'Side B set 1' })).toHaveValue('21');
  await expect(page.getByRole('spinbutton', { name: 'Side A set 2' })).toHaveValue('19');
  await expect(page.getByRole('spinbutton', { name: 'Side B set 2' })).toHaveValue('25');
  await expect(page.getByRole('spinbutton', { name: 'Side A set 3' })).toHaveValue('15');
  await expect(page.getByRole('spinbutton', { name: 'Side B set 3' })).toHaveValue('12');
  await expect(page.locator('#score-reason')).toHaveValue('Score sheet verified at the head table');
  await page.getByRole('button', { name: 'Cancel' }).click();

  const otherPage = await context.newPage();
  await openDesk(otherPage, { queueScope: 'other-grant-scope' });
  await otherPage.getByRole('button', { name: 'Enter score' }).first().click();
  await expect(otherPage.locator('#score-mode')).toHaveValue('set');
  await expect(otherPage.getByRole('spinbutton', { name: 'Side A set 1' })).toHaveValue('');
  await expect(otherPage.getByRole('spinbutton', { name: 'Side B set 1' })).toHaveValue('');
  await expect(otherPage.locator('#score-reason')).toHaveValue('');
  await otherPage.getByRole('button', { name: 'Cancel' }).click();
  await otherPage.close();

  await scoreTrigger.click();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.locator('#notice')).toContainText('Score draft discarded');
  await expect.poll(async () => {
    const rows = await indexedDbRows(page);
    return rows.drafts.filter(row => row.scope === QUEUE_SCOPE && row.matchId === 'pool-one').length;
  }).toBe(0);

  await scoreTrigger.click();
  await expect(page.locator('#score-mode')).toHaveValue('set');
  await expect(page.getByRole('spinbutton', { name: 'Side A set 1' })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Side B set 1' })).toHaveValue('');
  await expect(page.locator('#score-reason')).toHaveValue('');
});

test('logout revokes the server session and clears only this grant scope from session, queue, drafts, and cache', async ({ page }) => {
  const mock = await openDesk(page);
  await putIndexedDbRows(page, {
    queue: [
      { key: `queue:${QUEUE_SCOPE}:1`, scope: QUEUE_SCOPE, operation: { idempotencyKey: 'desk-current-one' } },
      { key: 'queue:other:1', scope: 'other-scope', operation: { idempotencyKey: 'desk-other-one' } },
    ],
    drafts: [
      { key: `draft:${QUEUE_SCOPE}:pool-one`, scope: QUEUE_SCOPE, sets: [[25, 20]] },
      { key: 'draft:other:pool-one', scope: 'other-scope', sets: [[21, 19]] },
    ],
    cache: [
      { key: `cache:${QUEUE_SCOPE}`, scope: QUEUE_SCOPE, state: { event: { id: EVENT_ID } } },
      { key: 'cache:other-scope', scope: 'other-scope', state: { event: { id: 'other-event' } } },
    ],
  });

  expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toContain(SESSION_TOKEN);
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.locator('#access')).toBeVisible();
  expect(mock.logouts).toHaveLength(1);
  expect(mock.logouts[0].authorization).toBe(`Bearer ${SESSION_TOKEN}`);
  expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toBeNull();

  const rows = await indexedDbRows(page);
  for (const name of ['queue', 'drafts', 'cache']) {
    expect(rows[name].filter(row => row.scope === QUEUE_SCOPE)).toEqual([]);
    expect(rows[name].filter(row => row.scope === 'other-scope')).toHaveLength(1);
  }
});
