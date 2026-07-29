import { test, expect } from '@playwright/test';

const WORKER = 'https://court-staff.example/court-sync';
const RAW_TOKEN = 'T'.repeat(43);
const ROTATED_RAW_TOKEN = 'R'.repeat(43);

function localDateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function player(id, name, seedRating, extra = {}) {
  return {
    id, name, seedRating, rating: seedRating, active: true, archived: false,
    roles: {}, lifetime: {}, history: [{ i: 0, r: seedRating }], ...extra,
  };
}

function event(id = 'event-one', extra = {}) {
  return {
    id,
    name: id === 'event-one' ? 'Owner Cup' : 'Unrelated Secret Event',
    eventDate: localDateAfter(5),
    created: 1,
    done: false,
    format: 'fixedTeams',
    teams: [
      { id: `${id}-team-a`, name: 'Alpha', players: ['p1'] },
      { id: `${id}-team-b`, name: 'Bravo', players: ['p2'] },
    ],
    brackets: [],
    sched: { start: '09:00', courts: 1, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10 },
    registration: {
      enabled: true,
      status: 'open',
      publicToken: 'private-registration-token',
      managementToken: 'private-management-token',
    },
    organizerContact: 'owner-private@example.test',
    schedulePublications: { full: { managementToken: 'private-publish-token' } },
    ...extra,
  };
}

function game(id = 'game-one', extra = {}) {
  return {
    id,
    date: 100,
    teamA: ['p1'],
    teamB: ['p2'],
    scoreA: 21,
    scoreB: 18,
    winner: 'A',
    log: { p1: { ace: 1 }, p2: { serr: 1 } },
    evId: 'event-one',
    evA: 'event-one-team-a',
    evB: 'event-one-team-b',
    evMatchId: 'event-one-match',
    matchId: 'event-one-batch',
    eventFormat: 'fixedTeams',
    ratingVersion: 2,
    detailed: true,
    eventFamilies: { serve: ['ace', 'serr'] },
    ...extra,
  };
}

function ownerRootData({ games = [game()], events = [event(), event('event-other')], revision = 0 } = {}) {
  return {
    players: [
      player('p1', 'Alice', 67),
      player('p2', 'Bob', 43),
      player('p3', 'Unrelated Person', 50),
    ],
    games,
    events,
    settings: { ratingVersion: 2 },
    attendanceSessions: [],
    savedCrews: [],
    deletions: { games: {}, players: {}, events: {}, savedCrews: {}, eventTeams: {}, eventEntries: {}, eventBrackets: {}, eventScheduleMatches: {} },
    tomb: {},
    ...(revision > 0 ? { eventStaffRevisions: { 'event-one': revision } } : {}),
    v: 4,
  };
}

async function seedOwner(page, { sync = true, syncOn = true, games = [game()], events = [event(), event('event-other')] } = {}) {
  await page.addInitScript(({ sync, syncOn, games, events, worker }) => {
    const roster = [
      {
        id: 'p1', name: 'Alice', seedRating: 67, rating: 67, active: true, archived: false,
        roles: {}, lifetime: {}, history: [{ i: 0, r: 67 }], privateNotes: 'rating-history-secret',
        photo: { token: 'P'.repeat(43), revision: 'private-photo', contentType: 'image/jpeg', width: 100, height: 100, bytes: 10, public: false, updatedAt: 1 },
      },
      {
        id: 'p2', name: 'Bob', seedRating: 43, rating: 43, active: true, archived: false,
        roles: {}, lifetime: {}, history: [{ i: 0, r: 43 }],
      },
      {
        id: 'p3', name: 'Unrelated Person', seedRating: 50, rating: 50, active: true, archived: false,
        roles: {}, lifetime: {}, history: [{ i: 0, r: 50 }],
      },
    ];
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ ratingVersion: 2, ownerOnlySetting: 'settings-secret' }));
    if (sync) localStorage.setItem('vb:sync', JSON.stringify({ url: worker, code: 'owner-room-secret', on: syncOn }));
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => { window.__courtCopiedText = text; } },
      });
    } catch (_) {}
    try {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async data => { window.__courtSharedData = data; },
      });
    } catch (_) {}
    HTMLAnchorElement.prototype.click = function () { window.__courtDownloadName = this.download; };
  }, { sync, syncOn, games, events, worker: WORKER });
}

function workerState(overrides = {}) {
  return {
    available: true,
    revision: 0,
    accessEpoch: 1,
    statusRequests: 0,
    ownerRequests: [],
    rootPosts: [],
    snapshots: [],
    staffSnapshot: null,
    grantInputs: [],
    grantActions: [],
    revokeAllInputs: [],
    grants: [],
    activity: [],
    rootData: null,
    otherRootData: null,
    rootConflictOnce: false,
    resetRequiredOnce: false,
    snapshotDelaySequence: [],
    snapshotDelayActive: 0,
    snapshotFailureSequence: [],
    offlineStatus: false,
    statusCode: 0,
    statusBody: null,
    ...overrides,
  };
}

async function stubWorker(page, state) {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type, X-Court-Room',
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'content-type': 'application/json',
  };
  const json = (route, body, status = 200) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
  await page.route('https://court-staff.example/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors, body: '' });
      return;
    }
    if (path === '/court-sync/' || path === '/court-sync') {
      const room = url.searchParams.get('room');
      let rootData = room === 'owner-room-secret' ? state.rootData : state.otherRootData;
      if (rootData && room === 'owner-room-secret' && state.revision > 0) {
        rootData = structuredClone(rootData);
        rootData.eventStaffRevisions = { ...(rootData.eventStaffRevisions || {}), 'event-one': state.revision };
        if (state.staffSnapshot && !state.staffSnapshot.deleted) {
          rootData.games = [
            ...(rootData.games || []).filter(row => row.evId !== 'event-one'),
            ...(state.staffSnapshot.games || []),
          ];
        }
      }
      if (request.method() === 'GET') return json(route, {
        ts: rootData ? Number(state.rootTs) || 100 : 0,
        data: rootData ? JSON.stringify(rootData) : null,
      });
      const input = request.postDataJSON();
      state.rootPosts.push({ room, input });
      state.rootPosts.at(-1).duringReplacementSnapshot = state.snapshotDelayActive > 0;
      if (room === 'owner-room-secret' && state.rootConflictOnce) {
        state.rootConflictOnce = false;
        return json(route, {
          error: 'revision_conflict',
          eventStaffRevisions: { 'event-one': state.revision },
          currentRevisions: { 'event-one': state.revision },
          conflicts: [{ eventId: 'event-one', currentRevision: state.revision }],
        }, 409);
      }
      if (input?.data) {
        const parsed = JSON.parse(input.data);
        if (room === 'owner-room-secret') state.rootData = parsed;
        else state.otherRootData = parsed;
      }
      return json(route, { ok: true, eventStaffRevisions: room === 'owner-room-secret' && state.revision > 0 ? { 'event-one': state.revision } : {} });
    }
    if (path === '/court-sync/api/event-staff/status') {
      state.statusRequests++;
      if (state.offlineStatus) return route.abort('failed');
      if (state.statusCode) return json(route, state.statusBody || { error: 'temporarily_unavailable' }, state.statusCode);
      return json(route, state.available
        ? {
            available: true,
            maxGrantDays: 30,
            maxActiveGrantsPerEvent: 10,
            roles: [
              { id: 'viewOnly', label: 'View Only' },
              { id: 'scorekeeper', label: 'Scorekeeper' },
              { id: 'tournamentOperator', label: 'Tournament Operator' },
            ],
          }
        : { available: false, message: 'Event staff migration is not installed.' });
    }
    if (path.includes('/api/event-staff/owner/')) {
      state.ownerRequests.push({
        method: request.method(),
        path,
        room: await request.headerValue('x-court-room'),
      });
    }
    if (/\/api\/event-staff\/owner\/events\/event-one\/snapshot$/.test(path) && request.method() === 'PUT') {
      const input = request.postDataJSON();
      state.snapshots.push(input);
      const snapshotDelay = Number(state.snapshotDelaySequence.shift()) || 0;
      if (snapshotDelay > 0) {
        state.snapshotDelayActive++;
        await new Promise(resolve => setTimeout(resolve, snapshotDelay));
        state.snapshotDelayActive--;
      }
      const snapshotFailure = state.snapshotFailureSequence.shift();
      if (snapshotFailure) return json(route, {
        error: snapshotFailure.error || 'temporarily_unavailable',
        code: snapshotFailure.code || 'TEMPORARILY_UNAVAILABLE',
      }, snapshotFailure.status || 503);
      if (state.resetRequiredOnce) {
        state.resetRequiredOnce = false;
        return json(route, {
          error: 'event_access_reset_required',
          code: 'EVENT_ACCESS_RESET_REQUIRED',
          eventId: 'event-one',
          currentRevision: state.revision,
        }, 409);
      }
      if (state.revision > 0 && input.expectedRevision !== state.revision) {
        return json(route, {
          error: 'revision_conflict',
          code: 'REVISION_CONFLICT',
          eventId: 'event-one',
          currentRevision: state.revision,
        }, 409);
      }
      state.revision++;
      state.staffSnapshot = structuredClone(input);
      return json(route, { ok: true, eventId: 'event-one', revision: state.revision, accessEpoch: state.accessEpoch });
    }
    if (/\/api\/event-staff\/owner\/events\/event-one\/grants$/.test(path) && request.method() === 'GET') {
      if (state.revision <= 0) return json(route, { error: 'not_found' }, 404);
      return json(route, {
        ok: true,
        eventId: 'event-one',
        revision: state.revision,
        accessEpoch: state.accessEpoch,
        grants: state.grants,
      });
    }
    if (/\/api\/event-staff\/owner\/events\/event-one\/grants$/.test(path) && request.method() === 'POST') {
      const input = request.postDataJSON();
      state.grantInputs.push(input);
      state.revision++;
      const grant = {
        id: `grant-${state.grants.length + 1}`,
        staffLabel: input.staffLabel,
        role: input.role,
        expiresAt: input.expiresAt,
        hasPin: !!input.pin,
        createdAt: Date.now(),
        revokedAt: null,
        lastUsedAt: null,
      };
      state.grants.push(grant);
      return json(route, {
        ok: true,
        eventId: 'event-one',
        revision: state.revision,
        accessEpoch: state.accessEpoch,
        grant,
        inviteUrl: `${WORKER}/staff#token=${RAW_TOKEN}`,
      });
    }
    if (/\/api\/event-staff\/owner\/events\/event-one\/audit$/.test(path) && request.method() === 'GET') {
      return json(route, {
        ok: true,
        eventId: 'event-one',
        revision: state.revision,
        accessEpoch: state.accessEpoch,
        activity: state.activity,
      });
    }
    const revokeGrantMatch = path.match(/\/api\/event-staff\/owner\/events\/event-one\/grants\/([^/]+)\/revoke$/);
    if (revokeGrantMatch && request.method() === 'POST') {
      const input = request.postDataJSON();
      const grantId = decodeURIComponent(revokeGrantMatch[1]);
      const grant = state.grants.find(item => item.id === grantId);
      state.grantActions.push({ action: 'revoke', grantId, input });
      if (!grant) return json(route, { error: 'grant_not_found' }, 404);
      grant.revokedAt ||= Date.now();
      return json(route, {
        ok: true,
        eventId: 'event-one',
        revision: state.revision,
        accessEpoch: state.accessEpoch,
        grant,
      });
    }
    const rotateGrantMatch = path.match(/\/api\/event-staff\/owner\/events\/event-one\/grants\/([^/]+)\/rotate$/);
    if (rotateGrantMatch && request.method() === 'POST') {
      const input = request.postDataJSON();
      const grantId = decodeURIComponent(rotateGrantMatch[1]);
      const grant = state.grants.find(item => item.id === grantId);
      state.grantActions.push({ action: 'rotate', grantId, input });
      if (!grant) return json(route, { error: 'grant_not_found' }, 404);
      const now = Date.now();
      grant.revokedAt ||= now;
      const replacement = {
        ...grant,
        id: `${grantId}-rotated`,
        createdAt: now,
        revokedAt: null,
        lastUsedAt: null,
      };
      state.grants.push(replacement);
      return json(route, {
        ok: true,
        eventId: 'event-one',
        revision: state.revision,
        accessEpoch: state.accessEpoch,
        previousGrantId: grantId,
        grant: replacement,
        inviteUrl: `${WORKER}/staff#token=${ROTATED_RAW_TOKEN}`,
      }, 201);
    }
    if (/\/api\/event-staff\/owner\/events\/event-one\/revoke-all$/.test(path) && request.method() === 'POST') {
      const input = request.postDataJSON();
      state.revokeAllInputs.push(input);
      if (state.revision > 0 && input.expectedRevision !== state.revision) {
        return json(route, {
          error: 'revision_conflict',
          code: 'REVISION_CONFLICT',
          eventId: 'event-one',
          currentRevision: state.revision,
        }, 409);
      }
      state.revision++;
      state.accessEpoch++;
      state.grants = state.grants.map(grant => ({ ...grant, revokedAt: grant.revokedAt || Date.now() }));
      return json(route, {
        ok: true,
        eventId: 'event-one',
        revision: state.revision,
        accessEpoch: state.accessEpoch,
        grants: state.grants,
      });
    }
    if (path === '/court-sync/api/event-staff/owner/revoke-all' && request.method() === 'POST') {
      state.revision++;
      state.accessEpoch++;
      if (state.rootData?.eventStaffRevisions) state.rootData.eventStaffRevisions['event-one'] = state.revision;
      return json(route, { ok: true, revokedEvents: state.revision > 0 ? 1 : 0 });
    }
    return json(route, { error: 'not_found' }, 404);
  });
}

async function openOwnerEvent(page) {
  await page.goto('/');
  await page.evaluate(() => {
    tab = 'events';
    openEvent('event-one');
    eventSection('overview');
  });
  await expect(page.locator('[data-event-staff-card="event-one"]')).toBeVisible();
}

async function openStaffManager(page) {
  const trigger = page.locator('[data-event-staff-card="event-one"]').getByRole('button', { name: /Set up staff access|Manage staff access/ });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await expect(page.getByRole('heading', { name: 'Event Staff Access · Owner Cup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create staff link' })).toBeVisible();
}

test('capability gating requires device sync and a compatible Worker without blocking normal event tools', async ({ page }) => {
  await seedOwner(page, { sync: false });
  await openOwnerEvent(page);
  const card = page.locator('[data-event-staff-card="event-one"]');
  await expect(card).toContainText('Set up device sync');
  await expect(card.getByRole('button', { name: 'Staff access unavailable' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Event details' })).toBeVisible();

  const state = workerState({ available: false });
  await stubWorker(page, state);
  await page.evaluate(worker => {
    localStorage.setItem('vb:sync', JSON.stringify({ url: worker, code: 'owner-room-secret', on: true }));
  }, WORKER);
  await page.reload();
  await page.evaluate(() => {
    tab = 'events';
    openEvent('event-one');
    eventSection('overview');
  });
  await expect(card).toContainText('Event staff migration is not installed.');
  await expect(card.getByRole('button', { name: 'Retry compatibility check' })).toBeVisible();
  expect(state.statusRequests).toBeGreaterThan(0);
  expect(state.ownerRequests).toEqual([]);
  await expect(page.getByRole('button', { name: 'Event details' })).toBeVisible();
});

test('owner creates a named, expiring, PIN-protected grant and sees its raw fragment link only once', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await expect(page.locator('[data-event-staff-card="event-one"]').getByRole('button', { name: 'Set up staff access' })).toBeVisible();
  await openStaffManager(page);

  await page.getByRole('button', { name: 'Create staff link' }).click();
  await expect(page.locator('#eventStaffLabel')).toBeFocused();
  await expect(page.locator('#eventStaffRole')).toHaveValue('scorekeeper');
  await expect(page.locator('#eventStaffExpiry')).toHaveValue('event');
  await expect(page.locator('#eventStaffExpiry option:checked')).toContainText('24 hours after the planned event ends');
  await expect(page.locator('#eventStaffCustomExpiry')).toHaveAttribute('max', /T/);
  await expect(page.locator('#eventStaffPin')).toHaveAttribute('pattern', '[0-9]{4,12}');

  await page.locator('#eventStaffRole').selectOption('tournamentOperator');
  await expect(page.locator('#eventStaffRoleSummary')).toContainText('view this event’s registration contacts');
  await page.locator('#eventStaffRole').selectOption('scorekeeper');
  await page.locator('#eventStaffLabel').fill('Court 2 scorekeeper');
  await page.locator('#eventStaffPin').fill('123');
  await page.getByRole('button', { name: 'Create secure link' }).click();
  await expect(page.locator('#eventStaffPin')).toBeFocused();
  await expect(page.locator('#toast')).toContainText('PIN must be 4–12 digits');

  await page.locator('#eventStaffPin').fill('4321');
  await page.getByRole('button', { name: 'Create secure link' }).click();
  const invite = page.locator('#eventStaffInviteUrl');
  await expect(invite).toBeVisible();
  await expect(invite).toBeFocused();
  await expect(invite).toHaveValue(`${WORKER}/staff#token=${RAW_TOKEN}`);
  await expect(page.getByText('Court will not store or show this raw link again.')).toBeVisible();

  expect(state.grantInputs).toHaveLength(1);
  expect(state.grantInputs[0]).toMatchObject({
    staffLabel: 'Court 2 scorekeeper',
    role: 'scorekeeper',
    pin: '4321',
  });
  expect(state.grantInputs[0].expiresAt).toBeGreaterThan(Date.now());
  expect(state.grantInputs[0].expiresAt).toBeLessThanOrEqual(Date.now() + 30 * 86400000);
  expect(state.ownerRequests.every(request => request.room === 'owner-room-secret')).toBe(true);

  await page.getByRole('button', { name: 'Back to staff access' }).click();
  await expect(page.locator('[data-event-staff-grant="grant-1"]')).toContainText('Court 2 scorekeeper');
  await expect(page.locator('#eventStaffInviteUrl')).toHaveCount(0);
  await expect(page.locator('.sheet')).not.toContainText(RAW_TOKEN);
  expect(await page.evaluate(token => Object.values(localStorage).every(value => !String(value).includes(token)), RAW_TOKEN)).toBe(true);

  const backupText = await page.evaluate(async () => {
    await exportData();
    return window.__courtCopiedText;
  });
  const backup = JSON.parse(backupText);
  expect(backup).not.toHaveProperty('eventStaffRevisions');
  expect(backup).not.toHaveProperty('staffGrants');
  expect(backupText).not.toContain(RAW_TOKEN);
  expect(backupText).not.toContain('Court 2 scorekeeper');

  const duplicated = await page.evaluate(() => {
    const copy = duplicateEventData(evById('event-one'), {
      id: 'event-copy',
      name: 'Owner Cup Copy',
      now: Date.now(),
      eventDate: todayLocalDate(),
    });
    return {
      copiedKeys: Object.keys(copy).filter(key => /staff|grant|access/i.test(key)),
      grants: EventStaff.state(copy.id).grants,
      revision: Sync.eventStaffRevision(copy.id),
    };
  });
  expect(duplicated).toEqual({ copiedKeys: [], grants: null, revision: 0 });
});

test('owner grant management renders lifecycle details and confirms scoped revoke, rotate, and revoke-all actions', async ({ page }) => {
  const now = Date.now();
  const state = workerState({
    grants: [
      {
        id: 'grant-active',
        staffLabel: 'Court 1 scorekeeper',
        role: 'scorekeeper',
        expiresAt: now + 3 * 86400000,
        hasPin: true,
        createdAt: now - 2 * 86400000,
        revokedAt: null,
        lastUsedAt: now - 60 * 60 * 1000,
      },
      {
        id: 'grant-rotate',
        staffLabel: 'Head table',
        role: 'tournamentOperator',
        expiresAt: now + 7 * 86400000,
        hasPin: false,
        createdAt: now - 86400000,
        revokedAt: null,
        lastUsedAt: null,
      },
      {
        id: 'grant-expired',
        staffLabel: 'Morning volunteer',
        role: 'viewOnly',
        expiresAt: now - 60 * 1000,
        hasPin: false,
        createdAt: now - 2 * 86400000,
        revokedAt: null,
        lastUsedAt: null,
      },
    ],
    activity: [
      {
        id: 'activity-one',
        timestamp: now - 30 * 60 * 1000,
        staffLabel: 'Head table',
        action: 'score.recorded',
        targetId: 'event-one-match',
        previous: { scoreA: 18, scoreB: 21 },
        next: { scoreA: 21, scoreB: 18 },
        revision: 4,
        source: 'staff',
      },
    ],
  });
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);

  const activeRow = page.locator('[data-event-staff-grant="grant-active"]');
  await expect(activeRow).toContainText('Active');
  await expect(activeRow).toContainText('PIN required');
  const activeText = await activeRow.innerText();
  expect(activeText).toContain('Last used');
  expect(activeText).not.toContain('Last used Never');

  const expiredRow = page.locator('[data-event-staff-grant="grant-expired"]');
  await expect(expiredRow).toContainText('Expired');
  await expect(expiredRow).toContainText('Last used Never');
  await expect(expiredRow.getByRole('button', { name: /Rotate|Revoke/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Activity log' }).click();
  await expect(page.getByRole('heading', { name: 'Staff activity · Owner Cup' })).toBeVisible();
  const activitySheet = page.locator('.sheet');
  await expect(activitySheet).toContainText('Head table');
  await expect(activitySheet).toContainText('score recorded · event-one-match');
  await expect(activitySheet).toContainText('Before: {"scoreA":18,"scoreB":21}');
  await expect(activitySheet).toContainText('After: {"scoreA":21,"scoreB":18}');
  await expect(activitySheet).toContainText('Revision 4 · staff');
  await page.getByRole('button', { name: 'Back to staff access' }).click();

  await activeRow.getByRole('button', { name: 'Revoke', exact: true }).click();
  let confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('Revoke Court 1 scorekeeper?');
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  expect(state.grantActions).toEqual([]);
  await expect(activeRow).toContainText('Active');

  await activeRow.getByRole('button', { name: 'Revoke', exact: true }).click();
  confirmation = page.getByRole('alertdialog');
  await confirmation.getByRole('button', { name: 'Revoke link' }).click();
  await expect(page.locator('[data-event-staff-grant="grant-active"]')).toContainText('Revoked');
  expect(state.grantActions).toEqual([
    { action: 'revoke', grantId: 'grant-active', input: { reason: 'owner_revoked' } },
  ]);

  const rotateRow = page.locator('[data-event-staff-grant="grant-rotate"]');
  await rotateRow.getByRole('button', { name: 'Rotate link' }).click();
  confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('The old link and its open sessions will stop working immediately.');
  await confirmation.getByRole('button', { name: 'Rotate link' }).click();

  const rotatedInvite = `${WORKER}/staff#token=${ROTATED_RAW_TOKEN}`;
  await expect(page.locator('#eventStaffInviteUrl')).toHaveValue(rotatedInvite);
  await page.getByRole('button', { name: 'Copy full link' }).click();
  await expect.poll(() => page.evaluate(() => window.__courtCopiedText)).toBe(rotatedInvite);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__courtSharedData)).toEqual({
    title: 'Court event staff access',
    url: rotatedInvite,
  });
  expect(state.grantActions.at(-1)).toEqual({
    action: 'rotate',
    grantId: 'grant-rotate',
    input: { reason: 'owner_rotated' },
  });

  await page.getByRole('button', { name: 'Back to staff access' }).click();
  await expect(page.locator('[data-event-staff-grant="grant-rotate"]')).toContainText('Revoked');
  await expect(page.locator('[data-event-staff-grant="grant-rotate-rotated"]')).toContainText('Active');
  await expect(page.locator('.sheet')).not.toContainText(ROTATED_RAW_TOKEN);

  await page.getByRole('button', { name: 'Revoke all access' }).click();
  confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('Revoke all staff access for "Owner Cup"?');
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  expect(state.revokeAllInputs).toEqual([]);
  await expect(page.locator('[data-event-staff-grant="grant-rotate-rotated"]')).toContainText('Active');

  await page.getByRole('button', { name: 'Revoke all access' }).click();
  confirmation = page.getByRole('alertdialog');
  await confirmation.getByRole('button', { name: 'Revoke all access' }).click();
  await expect(page.locator('[data-event-staff-grant="grant-rotate-rotated"]')).toContainText('Revoked');
  expect(state.revokeAllInputs).toEqual([
    { expectedRevision: 1, reason: 'owner_emergency' },
  ]);
});

test('an event without a date requires an explicit staff-link expiration', async ({ page }) => {
  const state = workerState();
  await seedOwner(page, {
    events: [event('event-one', { eventDate: '' }), event('event-other')],
  });
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);

  await page.getByRole('button', { name: 'Create staff link' }).click();
  await expect(page.locator('#eventStaffExpiry')).toHaveValue('');
  await expect(page.locator('#eventStaffExpiry option:checked')).toHaveText('Choose an expiration');
  await page.locator('#eventStaffLabel').fill('Undated event scorekeeper');
  await page.getByRole('button', { name: 'Create secure link' }).click();
  await expect(page.locator('#toast')).toContainText('Choose an expiration at least a minute from now.');
  expect(state.grantInputs).toEqual([]);

  const beforePreset = Date.now();
  await page.locator('#eventStaffExpiry').selectOption('24h');
  await page.getByRole('button', { name: 'Create secure link' }).click();
  await expect.poll(() => state.grantInputs.length).toBe(1);
  expect(state.grantInputs[0].expiresAt).toBeGreaterThanOrEqual(beforePreset + 86400000);
  expect(state.grantInputs[0].expiresAt).toBeLessThanOrEqual(Date.now() + 86400000);
});

test('the owner snapshot is event-bounded and strips ratings, contacts, admin tokens, photos, settings, and unrelated records', async ({ page }) => {
  const state = workerState();
  await seedOwner(page, {
    games: [
      game(),
      game('other-game', { evId: 'event-other', evA: 'event-other-team-a', evB: 'event-other-team-b' }),
    ],
  });
  await stubWorker(page, state);
  await page.goto('/');

  const snapshot = await page.evaluate(() => EventStaff.snapshot(evById('event-one')));
  expect(snapshot.event.id).toBe('event-one');
  expect(snapshot.games.map(row => row.id)).toEqual(['game-one']);
  expect(snapshot.participants.map(row => row.id).sort()).toEqual(['p1', 'p2']);
  expect(Object.keys(snapshot.participants[0]).sort()).toEqual(['active', 'id', 'name']);
  expect(Object.keys(snapshot.event.registration).sort()).toEqual(['enabled', 'mode', 'status']);

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    'Unrelated Secret Event',
    'Unrelated Person',
    'owner-private@example.test',
    'private-registration-token',
    'private-management-token',
    'private-publish-token',
    'rating-history-secret',
    'private-photo',
    'settings-secret',
    'owner-room-secret',
  ]) expect(serialized, `snapshot excludes ${forbidden}`).not.toContain(forbidden);
  expect(serialized).not.toMatch(/"seedRating"|"rating"|"history"|"lifetime"|"photo"|"organizerContact"|"schedulePublications"/);

  const projectedFairnessPolicy = await page.evaluate(() => {
    const rotating = {
      ...structuredClone(evById('event-one')),
      id: 'rotation-policy-event',
      format: 'rotatingGroups',
      teams: [],
      entries: [
        { id: 'entry-a', name: 'Alice', players: ['p1'] },
        { id: 'entry-b', name: 'Bob', players: ['p2'] },
      ],
      rotation: {
        entrySize: 1,
        teamSize: 2,
        rounds: 1,
        courts: 1,
        fairnessPolicy: 'equalGames',
        tiebreakers: ['standingsPoints', 'winPct'],
      },
      rotationSchedule: [],
    };
    return EventStaff.snapshot(rotating).event.rotation.fairnessPolicy;
  });
  expect(projectedFairnessPolicy).toBe('equalGames');

  const historicalGameIds = await page.evaluate(() => {
    const changedRosterGame = {
      ...structuredClone(games.find(row => row.id === 'game-one')),
      id: 'historical-roster-game',
      teamA: ['p3'],
    };
    const unreferencedGame = {
      ...structuredClone(changedRosterGame),
      id: 'unreferenced-event-game',
      evA: null,
      evB: null,
    };
    games.push(changedRosterGame, unreferencedGame);
    const ids = EventStaff.snapshot(evById('event-one')).historicalGameIds;
    games.splice(-2, 2);
    return ids;
  });
  expect(historicalGameIds).toEqual(['historical-roster-game']);
});

test('a canonical tied event game remains projected but never changes player ratings', async ({ page }) => {
  const tied = game('tied-game', { scoreA: 21, scoreB: 21, winner: null });
  await seedOwner(page, { games: [tied], events: [event()] });
  await page.goto('/');

  const result = await page.evaluate(() => {
    recomputeAll();
    const projected = EventStaff.snapshot(evById('event-one')).games.find(row => row.id === 'tied-game');
    return {
      ratings: Object.fromEntries(players.filter(row => ['p1', 'p2'].includes(row.id)).map(row => [row.id, row.rating])),
      histories: Object.fromEntries(players.filter(row => ['p1', 'p2'].includes(row.id)).map(row => [row.id, row.history])),
      projected,
    };
  });
  expect(result.ratings).toEqual({ p1: 67, p2: 43 });
  expect(result.histories.p1).toEqual([{ i: 0, r: 67 }]);
  expect(result.histories.p2).toEqual([{ i: 0, r: 43 }]);
  expect(result.projected).toMatchObject({ id: 'tied-game', scoreA: 21, scoreB: 21, winner: null });
});

test('the mobile owner form traps focus, preserves page position on its touch control, and uses one safe-area-aware scroll container', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const pageScrollBeforeControl = await page.evaluate(() => window.scrollY);
  expect(pageScrollBeforeControl).toBeGreaterThan(0);
  const createControl = page.getByRole('button', { name: 'Create staff link' });
  expect(await createControl.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await createControl.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeControl);
  await expect(page.locator('#eventStaffLabel')).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.sheet-close')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await expect(page.locator('.sheet')).toHaveCSS('transform', 'none');

  const layout = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const style = getComputedStyle(sheet);
    const nested = [...sheet.querySelectorAll('*')].filter(node => {
      const overflow = getComputedStyle(node).overflowY;
      return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 1;
    });
    const rect = sheet.getBoundingClientRect();
    const controls = [...sheet.querySelectorAll('button')].map(node => node.getBoundingClientRect().height);
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      sheetOverflow: style.overflowY,
      paddingBottom: parseFloat(style.paddingBottom),
      nested: nested.map(node => node.id || node.className || node.tagName),
      top: rect.top,
      bottom: rect.bottom,
      viewport: innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shortestButton: Math.min(...controls),
    };
  });
  expect(layout.bodyOverflow).toBe('hidden');
  expect(layout.sheetOverflow).toBe('auto');
  expect(layout.paddingBottom).toBeGreaterThanOrEqual(20);
  expect(layout.nested).toEqual([]);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.bottom).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(layout.shortestButton).toBeGreaterThanOrEqual(44);

  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('staff revision knowledge survives reload and blocks lifecycle changes while revocation is offline', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);

  await expect.poll(() => page.evaluate(() => Sync.eventStaffRevision('event-one'))).toBeGreaterThan(0);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:eventStaffRevisions')));
  expect(persisted.identity).toContain('owner-room-secret');
  expect(persisted.revisions['event-one']).toBeGreaterThan(0);

  state.offlineStatus = true;
  await page.reload();
  await expect.poll(() => page.evaluate(() => Sync.eventStaffRevision('event-one'))).toBe(persisted.revisions['event-one']);

  const failures = await page.evaluate(async () => {
    const capture = async operation => {
      try {
        await operation();
        return '';
      } catch (error) {
        return error.message;
      }
    };
    return {
      eventDelete: await capture(() => EventStaff.beforeEventDelete(evById('event-one'))),
      restore: await capture(() => EventStaff.beforeRestore({ events: [] })),
      identity: await capture(() => EventStaff.beforeIdentityChange({
        url: Sync.cfg.url,
        code: 'replacement-owner-room',
      })),
    };
  });
  expect(failures.eventDelete).toContain('could not be revoked');
  expect(failures.restore).toContain('could not invalidate');
  expect(failures.identity).toContain('could not invalidate');
  expect(await page.evaluate(() => evById('event-one').name)).toBe('Owner Cup');
  expect(await page.evaluate(() => Sync.cfg.code)).toBe('owner-room-secret');
});

test('an indeterminate Worker response blocks lifecycle changes even without local grant history', async ({ page }) => {
  const state = workerState({ statusCode: 503 });
  await seedOwner(page);
  await stubWorker(page, state);
  await page.goto('/');

  expect(await page.evaluate(() => Sync.eventStaffRevision('event-one'))).toBe(0);
  const failures = await page.evaluate(async () => {
    const capture = async operation => {
      try {
        await operation();
        return '';
      } catch (error) {
        return error.message;
      }
    };
    return {
      eventDelete: await capture(() => EventStaff.beforeEventDelete(evById('event-one'))),
      restore: await capture(() => EventStaff.beforeRestore({ events: [] })),
      identity: await capture(() => EventStaff.beforeIdentityChange({
        url: Sync.cfg.url,
        code: 'replacement-owner-room',
      })),
    };
  });

  expect(failures.eventDelete).toContain('could not be revoked');
  expect(failures.restore).toContain('could not invalidate');
  expect(failures.identity).toContain('could not invalidate');
  expect(state.ownerRequests).toEqual([]);
});

test('a remembered staffed event refreshes its bounded snapshot after reload without reopening staff management', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const rememberedRevision = await page.evaluate(() => Sync.eventStaffRevision('event-one'));
  expect(rememberedRevision).toBeGreaterThan(0);

  state.snapshots.length = 0;
  await page.reload();
  await page.evaluate(async () => {
    evById('event-one').name = 'Owner Cup · Court change';
    await saveEvents();
    await Sync.push({ force: true });
  });

  await expect.poll(() => state.snapshots.length).toBeGreaterThan(0);
  expect(state.snapshots.at(-1).event.name).toBe('Owner Cup · Court change');
  expect(state.snapshots.at(-1).expectedRevision).toBeGreaterThanOrEqual(rememberedRevision);
});

test('a newer grant-list revision is root-reconciled without echoing the staff score as an owner snapshot', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  await page.getByRole('button', { name: 'Done' }).click();

  const staffScore = game('staff-score', {
    date: 200,
    scoreA: 16,
    scoreB: 21,
    winner: 'B',
  });
  const reconciledRevision = state.revision + 1;
  state.revision = reconciledRevision;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffScore.id), staffScore],
  };
  state.snapshots.length = 0;

  await openStaffManager(page);

  await expect.poll(() => page.evaluate(() => games.some(row => row.id === 'staff-score'))).toBe(true);
  expect(state.snapshots).toHaveLength(0);
  expect(await page.evaluate(() => Sync.eventStaffRevision('event-one'))).toBe(reconciledRevision);
});

test('a newer staff revision replaces a competing owner game ID for the same match without double-counting ratings', async ({ page }) => {
  const state = workerState();
  await seedOwner(page, { games: [] });
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const ownerAttempt = game('owner-competing-score', {
    date: 210,
    scoreA: 21,
    scoreB: 12,
    winner: 'A',
  });
  const staffCurrent = game('staff-current-score', {
    date: 211,
    scoreA: 14,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = { ...state.staffSnapshot, games: [staffCurrent] };
  state.rootPosts.length = 0;

  const reconciled = await page.evaluate(async attempted => {
    games.push(attempted);
    recomputeAll();
    await saveGames();
    let conflict = '';
    try {
      await EventStaff.putSnapshot(evById('event-one'), { force: true });
    } catch (error) {
      conflict = error.code || error.message;
    }
    await Sync.push({ force: true });
    return {
      conflict,
      eventGames: games.filter(row => row.evId === 'event-one').map(row => ({
        id: row.id,
        scoreA: row.scoreA,
        scoreB: row.scoreB,
        winner: row.winner,
      })),
      historyLengths: Object.fromEntries(players.filter(row => ['p1', 'p2'].includes(row.id)).map(row => [row.id, row.history.length])),
      notice: EventStaff.state('event-one').reviewNotice,
      reviews: EventStaff.state('event-one').scoreReviews,
      rejectedTombstone: !!Sync.deletionState().games[attempted.id],
    };
  }, ownerAttempt);

  expect(reconciled.conflict).toBe('revision_conflict');
  expect(reconciled.eventGames).toEqual([{
    id: 'staff-current-score',
    scoreA: 14,
    scoreB: 21,
    winner: 'B',
  }]);
  expect(reconciled.historyLengths).toEqual({ p1: 2, p2: 2 });
  expect(reconciled.notice).toContain('ratings were not counted twice');
  expect(reconciled.reviews[0]).toMatchObject({
    attempted: { id: 'owner-competing-score', scoreA: 21, scoreB: 12 },
    current: { id: 'staff-current-score', scoreA: 14, scoreB: 21 },
  });
  expect(reconciled.rejectedTombstone).toBe(false);
  expect(state.rootPosts.length).toBeGreaterThan(0);
  expect(state.rootPosts.every(post => !JSON.parse(post.input.data).games.some(row => row.id === 'owner-competing-score'))).toBe(true);

  await page.evaluate(() => EventStaff.openManager('event-one'));
  await expect(page.locator('[data-event-staff-score-review]')).toContainText('Attempted locally 21–12');
  await expect(page.locator('[data-event-staff-score-review]')).toContainText('Current staff result 14–21');
});

test('an authoritative staff score pull is not echoed back as a second owner revision', async ({ page }) => {
  const state = workerState({
    revision: 1,
    rootTs: 100,
    rootData: ownerRootData({ games: [], revision: 1 }),
    staffSnapshot: { games: [] },
  });
  await seedOwner(page, { games: [] });
  await stubWorker(page, state);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Sync.pull({ force: true }))).toBe(true);
  await page.waitForTimeout(1400);
  state.snapshots.length = 0;

  const staffScore = game('staff-first-attempt-score', {
    date: 220,
    scoreA: 25,
    scoreB: 22,
    winner: 'A',
  });
  state.revision = 2;
  state.rootTs = 200;
  state.staffSnapshot = { games: [staffScore] };

  await expect.poll(() => page.evaluate(() => Sync.pull({ force: true }))).toBe(true);
  await page.waitForTimeout(1400);

  expect(await page.evaluate(() => games.some(row => row.id === 'staff-first-attempt-score'))).toBe(true);
  expect(await page.evaluate(() => Sync.eventStaffRevision('event-one'))).toBe(2);
  expect(state.snapshots).toHaveLength(0);

  await page.evaluate(async () => {
    evById('event-one').name = 'Owner Cup renamed';
    await saveEvents();
  });
  await expect.poll(() => state.snapshots.length).toBe(1);
  expect(state.snapshots[0]).toMatchObject({
    expectedRevision: 2,
    event: { id: 'event-one', name: 'Owner Cup renamed' },
  });
});

test('a same-revision managed root pull preserves an unsynced owner game until its snapshot CAS', async ({ page }) => {
  const state = workerState();
  await seedOwner(page, { games: [] });
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const ownerScore = game('same-revision-owner-score', {
    date: 215,
    scoreA: 21,
    scoreB: 15,
    winner: 'A',
  });

  const result = await page.evaluate(async localGame => {
    games.push(localGame);
    recomputeAll();
    await saveGames();
    await Sync.pull({ force: true });
    return {
      ids: games.filter(row => row.evId === 'event-one').map(row => row.id),
      reviewNotice: EventStaff.state('event-one').reviewNotice,
    };
  }, ownerScore);

  expect(result).toEqual({ ids: ['same-revision-owner-score'], reviewNotice: '' });
  expect(state.staffSnapshot.games.map(row => row.id)).toEqual(['same-revision-owner-score']);
});

test('root POST conflicts remain observed-only until the forced root pull applies the staff projection', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const safeRevision = await page.evaluate(() => Sync.eventStaffRevision('event-one'));

  const staffScore = game('staff-root-conflict-score', {
    date: 225,
    scoreA: 18,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffScore.id), staffScore],
  };
  state.rootConflictOnce = true;

  const conflicted = await page.evaluate(async () => {
    const pushed = await Sync.push({ force: true });
    return {
      pushed,
      safe: Sync.eventStaffRevision('event-one'),
      observed: EventStaff.state('event-one').observedRevision,
    };
  });

  expect(conflicted).toEqual({ pushed: false, safe: safeRevision, observed: state.revision });
  await expect.poll(() => page.evaluate(() => games.some(row => row.id === 'staff-root-conflict-score'))).toBe(true);
});

test('an authoritative root revision can repair a poisoned future local CAS marker', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const authoritative = state.revision;

  const repaired = await page.evaluate(async () => {
    Sync.noteEventStaffRevision('event-one', 999999);
    await Sync.pull({ force: true, staffConflict: true, requireSuccess: true });
    return {
      safe: Sync.eventStaffRevision('event-one'),
      observed: EventStaff.state('event-one').observedRevision,
    };
  });

  expect(repaired).toEqual({ safe: authoritative, observed: authoritative });
});

test('owner snapshot recovery uses the Worker error slug when an uppercase diagnostic code is also present', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  state.snapshots.length = 0;
  state.resetRequiredOnce = true;

  await page.evaluate(() => EventStaff.putSnapshot(evById('event-one'), { force: true }));

  expect(state.snapshots).toHaveLength(2);
  expect(state.snapshots[0].expectedRevision).toBeGreaterThan(0);
  expect(state.snapshots[1]).toMatchObject({
    expectedRevision: state.snapshots[0].expectedRevision,
    resetAccess: true,
  });
});

test('backup restore uses the revoked D1 revision only as replacement CAS and never pulls the old event over the backup', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  state.snapshots.length = 0;
  const staffOnlyGame = game('staff-only-before-restore', {
    date: 240,
    scoreA: 17,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffOnlyGame.id), staffOnlyGame],
  };

  await page.evaluate(async () => {
    const restoredEvent = structuredClone(evById('event-one'));
    restoredEvent.name = 'Restored Owner Cup';
    const restoredGame = structuredClone(games.find(row => row.id === 'game-one'));
    restoredGame.id = 'restored-game';
    restoredGame.scoreA = 11;
    restoredGame.scoreB = 21;
    restoredGame.winner = 'B';
    await restoreBackupData({
      players: structuredClone(players),
      games: [restoredGame],
      events: [restoredEvent],
      settings: structuredClone(settings),
      attendanceSessions: [],
      savedCrews: [],
      v: 4,
    });
  });

  expect(await page.evaluate(() => evById('event-one').name)).toBe('Restored Owner Cup');
  expect(await page.evaluate(() => games.map(row => row.id))).toEqual(['restored-game']);
  expect(await page.evaluate(() => Sync.deletionState().games['staff-only-before-restore'] > 0)).toBe(true);
  const replacement = state.snapshots.find(input => input.resetAccess === true);
  expect(replacement).toBeTruthy();
  expect(replacement.event.name).toBe('Restored Owner Cup');
  expect(replacement.games.map(row => row.id)).toEqual(['restored-game']);
  expect(replacement.expectedRevision).toBeGreaterThan(0);
});

test('backup restore suppresses ordinary root sync until its delayed trusted staff replacement finishes', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const staffOnlyGame = game('staff-only-during-slow-restore', {
    date: 245,
    scoreA: 12,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffOnlyGame.id), staffOnlyGame],
  };
  state.snapshots.length = 0;
  state.rootPosts.length = 0;
  state.snapshotDelaySequence.push(2200);

  await page.evaluate(async () => {
    const restoredEvent = structuredClone(evById('event-one'));
    restoredEvent.name = 'Slow Restored Cup';
    const restoredGame = structuredClone(games.find(row => row.id === 'game-one'));
    restoredGame.id = 'slow-restored-game';
    restoredGame.scoreA = 8;
    restoredGame.scoreB = 21;
    restoredGame.winner = 'B';
    await restoreBackupData({
      players: structuredClone(players),
      games: [restoredGame],
      events: [restoredEvent],
      settings: structuredClone(settings),
      attendanceSessions: [],
      savedCrews: [],
      v: 4,
    });
  });

  expect(await page.evaluate(() => ({
    name: evById('event-one').name,
    gameIds: games.map(row => row.id),
    replacementActive: Sync.replacementActive(),
  }))).toEqual({
    name: 'Slow Restored Cup',
    gameIds: ['slow-restored-game'],
    replacementActive: false,
  });
  expect(state.rootPosts.length).toBeGreaterThan(0);
  expect(state.rootPosts.every(post => post.duringReplacementSnapshot === false)).toBe(true);
  const replacement = state.snapshots.find(input => input.resetAccess === true);
  expect(replacement?.event.name).toBe('Slow Restored Cup');
  expect(replacement?.games.map(row => row.id)).toEqual(['slow-restored-game']);
});

test('a failed trusted restore snapshot retries as a trusted reset without pulling old staff data over the backup', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const staffOnlyGame = game('staff-only-before-retry', {
    date: 247,
    scoreA: 13,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffOnlyGame.id), staffOnlyGame],
  };
  state.snapshots.length = 0;
  state.rootPosts.length = 0;
  state.snapshotFailureSequence.push({ status: 503 });

  await page.evaluate(async () => {
    const restoredEvent = structuredClone(evById('event-one'));
    restoredEvent.name = 'Retried Restore Cup';
    const restoredGame = structuredClone(games.find(row => row.id === 'game-one'));
    restoredGame.id = 'retried-restored-game';
    restoredGame.scoreA = 9;
    restoredGame.scoreB = 21;
    restoredGame.winner = 'B';
    await restoreBackupData({
      players: structuredClone(players),
      games: [restoredGame],
      events: [restoredEvent],
      settings: structuredClone(settings),
      attendanceSessions: [],
      savedCrews: [],
      v: 4,
    });
  });

  expect(state.snapshots.length).toBeGreaterThanOrEqual(2);
  expect(state.snapshots[0]).toMatchObject({ resetAccess: true });
  expect(state.snapshots[1]).toMatchObject({ resetAccess: true });
  expect(state.snapshots[1].event.name).toBe('Retried Restore Cup');
  expect(state.snapshots[1].games.map(row => row.id)).toEqual(['retried-restored-game']);
  expect(await page.evaluate(() => ({
    name: evById('event-one').name,
    ids: games.map(row => row.id),
    resetPending: EventStaff.state('event-one').error,
  }))).toEqual({
    name: 'Retried Restore Cup',
    ids: ['retried-restored-game'],
    resetPending: '',
  });
  expect(state.rootPosts.every(post => !JSON.parse(post.input.data).games.some(row => row.id === 'staff-only-before-retry'))).toBe(true);
});

test('event deletion reconciles a staff score before revocation and preserves the canonical game in owner history', async ({ page }) => {
  const closedEvent = event('event-one', {
    registration: { enabled: false, status: 'closed', mode: 'disabled' },
  });
  const state = workerState();
  await seedOwner(page, { events: [closedEvent, event('event-other')] });
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  await page.getByRole('button', { name: 'Done' }).click();

  const staffScore = game('staff-delete-score', {
    date: 250,
    scoreA: 14,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffScore.id), staffScore],
  };
  state.snapshots.length = 0;

  await page.evaluate(async () => {
    window.askConfirm = async () => true;
    await deleteEvent('event-one');
  });

  const deletion = state.snapshots.find(input => input.deleted === true);
  expect(deletion).toBeTruthy();
  expect(deletion.games.some(row => row.id === 'staff-delete-score' && row.winner === 'B')).toBe(true);
  const local = await page.evaluate(() => ({
    eventPresent: !!evById('event-one'),
    game: games.find(row => row.id === 'staff-delete-score'),
  }));
  expect(local.eventPresent).toBe(false);
  expect(local.game).toMatchObject({ id: 'staff-delete-score', scoreA: 14, scoreB: 21, winner: 'B' });
  expect(local.game).not.toHaveProperty('evId');
  await page.waitForTimeout(1300);
  expect(state.snapshots.at(-1).deleted).toBe(true);
});

test('changing sync identity freezes the old staff scope, reconciles its final score, and seeds the new identity with that history', async ({ page }) => {
  const state = workerState();
  await seedOwner(page);
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  await page.getByRole('button', { name: 'Done' }).click();

  const staffScore = game('staff-identity-score', {
    date: 300,
    scoreA: 12,
    scoreB: 21,
    winner: 'B',
  });
  state.revision++;
  state.staffSnapshot = {
    ...state.staffSnapshot,
    games: [...state.staffSnapshot.games.filter(row => row.id !== staffScore.id), staffScore],
  };

  const result = await page.evaluate(worker => Sync.connect(worker, 'replacement-owner-room'), WORKER);

  expect(result).toBe('seeded');
  expect(await page.evaluate(() => games.some(row => row.id === 'staff-identity-score'))).toBe(true);
  expect(await page.evaluate(() => Sync.cfg.code)).toBe('replacement-owner-room');
  expect(state.ownerRequests.some(request =>
    request.path === '/court-sync/api/event-staff/owner/revoke-all'
    && request.room === 'owner-room-secret'
  )).toBe(true);
  const seeded = state.rootPosts.find(request => request.room === 'replacement-owner-room');
  expect(seeded).toBeTruthy();
  expect(JSON.parse(seeded.input.data).games.some(row => row.id === 'staff-identity-score')).toBe(true);
});

test('staff management remains disabled until configured device sync is active', async ({ page }) => {
  const state = workerState();
  await seedOwner(page, { syncOn: false });
  await stubWorker(page, state);
  await openOwnerEvent(page);

  const card = page.locator('[data-event-staff-card="event-one"]');
  await expect(card).toContainText('Resume and finish adopting normal device sync');
  await expect(card.getByRole('button', { name: 'Staff access unavailable' })).toBeDisabled();
  expect(state.snapshots).toEqual([]);
});

test('event-relative expiration remains exactly 24 hours across a daylight-saving boundary', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-30T12:00:00-05:00') });
  const state = workerState();
  const dstEvent = event('event-one', {
    eventDate: '2026-10-31',
    sched: {
      start: '23:00',
      courts: 1,
      courtStyle: 'num',
      setMin: 20,
      matchMin: 45,
      breakMin: 10,
    },
  });
  await seedOwner(page, { events: [dstEvent, event('event-other')] });
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const plannedEnd = await page.evaluate(() => {
    const timeline = buildSchedule(evById('event-one'));
    return Math.max(...[timeline?.awards, timeline?.eventEnd, timeline?.poolsEnd]
      .map(Number).filter(Number.isFinite));
  });

  await page.getByRole('button', { name: 'Create staff link' }).click();
  await page.locator('#eventStaffLabel').fill('DST score table');
  await page.getByRole('button', { name: 'Create secure link' }).click();

  await expect.poll(() => state.grantInputs.length).toBe(1);
  expect(state.grantInputs[0].expiresAt - plannedEnd).toBe(24 * 60 * 60 * 1000);
  await context.close();
});

test('date-only fallback expiration is exactly 24 elapsed hours from event-date noon across daylight saving', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-30T12:00:00-05:00') });
  const state = workerState();
  const dateOnlyEvent = event('event-one', {
    eventDate: '2026-10-31',
    sched: null,
  });
  await seedOwner(page, { events: [dateOnlyEvent, event('event-other')] });
  await stubWorker(page, state);
  await openOwnerEvent(page);
  await openStaffManager(page);
  const eventDateNoon = await page.evaluate(() => {
    const parts = localDateParts(evById('event-one').eventDate);
    return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0).getTime();
  });

  await page.getByRole('button', { name: 'Create staff link' }).click();
  await page.locator('#eventStaffLabel').fill('Date-only score table');
  await page.getByRole('button', { name: 'Create secure link' }).click();

  await expect.poll(() => state.grantInputs.length).toBe(1);
  expect(state.grantInputs[0].expiresAt - eventDateNoon).toBe(24 * 60 * 60 * 1000);
  await context.close();
});
