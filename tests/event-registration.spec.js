import { test, expect } from '@playwright/test';

const WORKER = 'https://court-registration.example';
const TOKEN = 'R'.repeat(43);

function fixedEvent(overrides = {}) {
  return {
    id: 'registration-event',
    name: 'Summer Sand',
    eventDate: '2026-08-15',
    created: 1,
    done: false,
    format: 'fixedTeams',
    teams: [
      { id: 'team-a', name: 'Alpha', players: ['p1', 'p2', 'p3', 'p4'] },
      { id: 'team-b', name: 'Bravo', players: ['p5', 'p6', 'p7', 'p8'] },
    ],
    brackets: [],
    ...overrides,
  };
}

async function seed(page, events = [fixedEvent()]) {
  await page.addInitScript(({ events, worker }) => {
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', '{}');
    localStorage.setItem('vb:sync', JSON.stringify({ url: worker, code: 'owner-room', on: true }));
  }, { events, worker: WORKER });
}

async function openEvent(page) {
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.getByRole('button', { name: /Summer Sand/ }).click();
}

function organizerState() {
  return {
    config: null,
    entries: [
      {
        id: 'entry-alpha', registrationType: 'team', displayName: 'Alpha Squad', status: 'submitted',
        activePlayerCount: 4, substituteCount: 1, createdAt: 10, updatedAt: 10, submittedAt: 10,
        withdrawnAt: null, organizerNote: '', capacityOverride: false,
      },
      {
        id: 'entry-bravo', registrationType: 'team', displayName: 'Bravo Squad', status: 'accepted',
        activePlayerCount: 4, substituteCount: 2, createdAt: 9, updatedAt: 9, submittedAt: 9,
        withdrawnAt: null, organizerNote: '', capacityOverride: false,
      },
    ],
    capacity: {
      capacity: 12, acceptedEntries: 1, submittedEntries: 1, needsReviewEntries: 0, pendingEntries: 1,
      waitlistedEntries: 0, declinedEntries: 0, withdrawnEntries: 0, acceptedActivePlayers: 4,
      pendingActivePlayers: 4, waitlistedActivePlayers: 0, acceptedSubstitutePlayers: 2,
      totalSubstitutePlayers: 3, remainingAcceptedCapacity: 8,
    },
    organizerGets: 0,
    configPosts: 0,
    failConfig: false,
  };
}

async function mockWorker(page, state) {
  await page.route(`${WORKER}/**`, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === '/') {
      if (request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ts: 0, data: null }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (path.endsWith('/config') && request.method() === 'POST') {
      state.configPosts++;
      if (state.failConfig) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'REGISTRATION_UNAVAILABLE', message: 'Registration storage is offline.' }) });
      const input = request.postDataJSON();
      state.config = {
        eventId: 'registration-event', eventName: input.eventName, eventDate: input.eventDate,
        eventFormat: input.eventFormat, entrySize: input.entrySize, teamSize: input.teamSize,
        enabled: input.enabled, eventAvailable: true, status: input.status,
        effectiveStatus: input.status, mode: input.mode, opensAt: input.opensAt, closesAt: input.closesAt,
        activePlayerCapacity: input.activePlayerCapacity, allowSubstitutes: input.allowSubstitutes,
        maxSubstitutesPerTeam: input.maxSubstitutesPerTeam,
        minActivePlayersPerTeam: input.minActivePlayersPerTeam,
        maxActivePlayersPerTeam: input.maxActivePlayersPerTeam,
        requireOrganizerApproval: input.requireOrganizerApproval, allowWaitlist: input.allowWaitlist,
        publicTitle: input.publicTitle, publicDescription: input.publicDescription,
        archivedAt: null, createdAt: 1, updatedAt: Date.now(),
      };
      state.capacity.capacity = input.activePlayerCapacity;
      state.capacity.remainingAcceptedCapacity = input.activePlayerCapacity == null ? null : input.activePlayerCapacity - state.capacity.acceptedActivePlayers;
      return route.fulfill({
        status: state.configPosts === 1 ? 201 : 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true, configured: true, config: state.config, capacity: state.capacity,
          publicToken: state.configPosts === 1 ? TOKEN : null,
          publicUrl: state.configPosts === 1 ? `${WORKER}/register/${TOKEN}` : null,
        })
      });
    }
    if (path === '/api/event-registration/organizer/registration-event' && request.method() === 'GET') {
      state.organizerGets++;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, configured: !!state.config, config: state.config, capacity: state.capacity, entries: state.entries, serverTime: Date.now() })
      });
    }
    if (path.endsWith('/status') && path.includes('/entries/')) {
      const entryId = path.split('/').at(-2), input = request.postDataJSON(), entry = state.entries.find(row => row.id === entryId);
      entry.status = input.status; entry.updatedAt++;
      if (input.status === 'accepted') {
        state.capacity.acceptedEntries++;
        state.capacity.pendingEntries--;
        state.capacity.acceptedActivePlayers += entry.activePlayerCount;
        state.capacity.remainingAcceptedCapacity = state.capacity.capacity - state.capacity.acceptedActivePlayers;
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, entry, capacity: state.capacity, override: { used: false } }) });
    }
    if (path.endsWith('/status')) {
      const input = request.postDataJSON();state.config.status = input.status;state.config.effectiveStatus = input.status;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, config: state.config, capacity: state.capacity }) });
    }
    if (path.endsWith('/token/rotate')) {
      const rotated = 'N'.repeat(43);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, publicToken: rotated, publicUrl: `${WORKER}/register/${rotated}`, updatedAt: Date.now() }) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

test('registration normalization is backward-compatible, idempotent, format-aware, and independent from games and ratings', async ({ page }) => {
  await seed(page, []);
  await mockWorker(page, organizerState());
  await page.goto('/');
  const result = await page.evaluate(() => {
    const legacy = {
      id: 'legacy', name: 'Legacy', eventDate: '2026-08-15', created: 1, format: 'fixedTeams',
      teams: [{ id: 'a', players: ['p1', 'p2', 'p3', 'p4'] }, { id: 'b', players: ['p5', 'p6', 'p7', 'p8'] }],
      games: [{ id: 'historical', score: [21, 18] }], ratingSnapshot: { p1: 55 },
    };
    const first = normalizeEventRegistration(undefined, legacy);
    const second = normalizeEventRegistration(first, legacy);
    const fixedDefaults = deriveRegistrationDefaultsFromEvent(legacy);
    const solo = { id: 'solo', format: 'rotatingGroups', rotation: { entrySize: 1, teamSize: 4 }, teams: [], entries: [] };
    const pairs = { id: 'pairs', format: 'rotatingGroups', rotation: { entrySize: 2, teamSize: 4 }, teams: [], entries: [] };
    const invalidStatus = normalizeEventRegistration({ ...fixedDefaults, enabled: true, mode: 'team', status: 'mystery' }, legacy);
    const invalidMode = validateEventRegistration({ ...fixedDefaults, enabled: true, mode: 'individual', status: 'open' }, legacy);
    const invalidWindow = validateEventRegistration({ ...fixedDefaults, enabled: true, mode: 'team', status: 'open', opensAt: 200, closesAt: 100 }, legacy);
    const before = JSON.stringify({ games: legacy.games, ratings: legacy.ratingSnapshot, id: legacy.id });
    normalizeEventRegistration({ ...fixedDefaults, enabled: true, mode: 'team', status: 'open' }, legacy);
    return {
      legacy: first,
      idempotent: JSON.stringify(first) === JSON.stringify(second),
      fixedDefaults,
      soloModes: getSupportedRegistrationModesForEvent(solo),
      pairModes: getSupportedRegistrationModesForEvent(pairs),
      invalidStatus,
      invalidMode,
      invalidWindow,
      unrelated: before === JSON.stringify({ games: legacy.games, ratings: legacy.ratingSnapshot, id: legacy.id }),
      capacity: calculateRegistrationCapacity({
        activePlayerCapacity: 12,
        registrations: [
          { status: 'accepted', activePlayerCount: 8, substituteCount: 3 },
          { status: 'submitted', activePlayerCount: 4, substituteCount: 1 },
          { status: 'waitlisted', activePlayerCount: 4, substituteCount: 2 },
          { status: 'withdrawn', activePlayerCount: 4, substituteCount: 0 },
        ]
      }),
      transitions: [
        canTransitionRegistrationStatus('submitted', 'accepted'),
        canTransitionRegistrationStatus('accepted', 'draft'),
        canTransitionRegistrationStatus('withdrawn', 'accepted'),
      ],
    };
  });
  expect(result.legacy).toMatchObject({ enabled: false, status: 'closed', mode: 'disabled' });
  expect(result.idempotent && result.unrelated).toBe(true);
  expect(result.fixedDefaults).toMatchObject({ mode: 'team', minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4 });
  expect(result.soloModes.find(row => row.mode === 'individual').supported).toBe(true);
  expect(result.pairModes.filter(row => row.mode !== 'disabled').every(row => !row.supported)).toBe(true);
  expect(result.invalidStatus).toMatchObject({ enabled: true, status: 'closed' });
  expect(result.invalidMode.valid).toBe(false);
  expect(result.invalidWindow.valid).toBe(false);
  expect(result.capacity).toEqual({
    capacity: 12, acceptedActivePlayers: 8, pendingActivePlayers: 4, waitlistedActivePlayers: 4,
    substitutePlayers: 3, remainingAcceptedCapacity: 4,
  });
  expect(result.transitions).toEqual([true, false, true]);
});

test('organizer settings derive roster defaults, save server-first, persist a public reference, and render a stable dashboard', async ({ page }) => {
  const state = organizerState();
  await seed(page);
  await mockWorker(page, state);
  await page.goto('/');
  await openEvent(page);
  await expect(page.locator('#event-registration')).toContainText('Public registration is off');
  await page.getByRole('button', { name: 'Set up registration' }).click();
  await expect(page.locator('#registrationMinActive')).toHaveValue('4');
  await expect(page.locator('#registrationMaxActive')).toHaveValue('4');
  await page.locator('#registrationEnabled').check();
  await page.locator('#registrationStatus').selectOption('open');
  await page.locator('#registrationOpens').fill('2026-07-25T09:00');
  await page.locator('#registrationCloses').fill('2026-08-14T20:00');
  await page.locator('#registrationCapacity').fill('12');
  await page.locator('#registrationMaxSubstitutes').fill('2');
  await page.locator('#registrationPublicDescription').fill('Four-player teams under the lights.');
  await page.getByRole('button', { name: 'Save registration' }).click();

  await expect(page.locator('#event-registration')).toContainText('Open');
  expect(state.configPosts).toBe(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:events'))[0].registration);
  expect(stored).toMatchObject({
    enabled: true, status: 'open', mode: 'team', activePlayerCapacity: 12,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4,
    publicToken: TOKEN, publicUrl: `${WORKER}/register/${TOKEN}`,
  });

  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-registration-dashboard]')).toBeVisible();
  await expect(page.locator('[data-reg-accepted]')).toHaveText('1');
  await expect(page.locator('[data-reg-active]')).toHaveText('4');
  await expect(page.locator('[data-reg-subs]')).toHaveText('2');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('Alpha Squad');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const passiveState = await page.evaluate(() => {
    const root = document.querySelector('[data-registration-dashboard]');
    root.__identity = 'dashboard';
    const row = root.querySelector('[data-registration-entry="entry-alpha"]');
    row.__identity = 'alpha';
    const list = root.querySelector('[data-registration-entry-list]');
    list.style.height = '80px';
    row.querySelector('select').focus({ preventScroll: true });
    list.scrollTop = 25;
    return { scrollTop: list.scrollTop };
  });
  const organizerGetsBeforeRefresh = state.organizerGets;
  await page.evaluate(() => Promise.all([
    EventRegistration.refresh('registration-event'),
    EventRegistration.refresh('registration-event', { poll: true }),
  ]));
  expect(state.organizerGets - organizerGetsBeforeRefresh).toBe(1);
  await expect.poll(() => page.evaluate(() => ({
    dashboard: document.querySelector('[data-registration-dashboard]').__identity,
    row: document.querySelector('[data-registration-entry="entry-alpha"]').__identity,
    focused: document.activeElement === document.querySelector('[data-registration-entry="entry-alpha"] select'),
    scrollTop: document.querySelector('[data-registration-entry-list]').scrollTop,
  }))).toEqual({ dashboard: 'dashboard', row: 'alpha', focused: true, scrollTop: passiveState.scrollTop });
  expect(await page.evaluate(() => EventRegistration.modalEventId)).toBe('registration-event');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await page.evaluate(() => ({ modal: EventRegistration.modalEventId, timer: EventRegistration._pollTimer }))).toMatchObject({ modal: null });
});

test('failed registration persistence leaves the event unchanged and shows a retryable error', async ({ page }) => {
  const state = organizerState();state.failConfig = true;
  await seed(page);
  await mockWorker(page, state);
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Set up registration' }).click();
  await page.locator('#registrationEnabled').check();
  await page.locator('#registrationStatus').selectOption('open');
  await page.locator('#registrationOpens').fill('2026-07-25T09:00');
  await page.locator('#registrationCloses').fill('2026-08-14T20:00');
  await page.locator('#registrationCapacity').fill('16');
  await page.getByRole('button', { name: 'Save registration' }).click();
  await expect(page.locator('[data-registration-settings-error]')).toHaveText('Registration storage is offline.');
  expect(await page.evaluate(() => eventRegistration(evts[0]))).toMatchObject({ enabled: false, status: 'closed', publicToken: null });
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('vb:events')))[0].registration).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Save registration' })).toBeEnabled();
});

test('registration settings and dashboard fit a narrow mobile viewport without overlap', async ({ page }) => {
  const state = organizerState();
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: Date.now() - 1000, closesAt: Date.now() + 100000,
    activePlayerCapacity: 12, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: Date.now(),
  };
  state.config = {
    ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventDate: '2026-08-15',
    eventFormat: 'fixedTeams', eventAvailable: true, effectiveStatus: 'open', archivedAt: null, createdAt: 1,
  };
  await seed(page, [fixedEvent({ registration })]);
  await mockWorker(page, state);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-registration-dashboard]')).toBeVisible();
  const dashboardOverflow = await page.evaluate(() => document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth);
  expect(dashboardOverflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('[data-registration-settings]')).toBeVisible();
  const settingsOverflow = await page.evaluate(() => document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth);
  expect(settingsOverflow).toBeLessThanOrEqual(0);
  await expect(page.locator('#registrationEnabled')).toHaveAccessibleName(/Enable public registration/);
});
