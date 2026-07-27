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

async function seed(page, events = [fixedEvent()], playerList = []) {
  await page.addInitScript(({ events, worker, playerList }) => {
    localStorage.setItem('vb:players', JSON.stringify(playerList));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', '{}');
    localStorage.setItem('vb:sync', JSON.stringify({ url: worker, code: 'owner-room', on: true }));
  }, { events, worker: WORKER, playerList });
}

async function openEvent(page) {
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.getByRole('button', { name: /Summer Sand/ }).click();
  /* Mobile event pages show one section at a time (EUX-04). */
  await page.evaluate(() => eventSection('registration'));
}

function organizerState() {
  return {
    config: null,
    entries: [
      {
        id: 'entry-alpha', registrationType: 'team', displayName: 'Alpha Squad', status: 'submitted',
        activePlayerCount: 4, substituteCount: 1, createdAt: 10, updatedAt: 10, submittedAt: 10,
        withdrawnAt: null, organizerNote: '', capacityOverride: false, editingLocked: false,
        managementAccessRevoked: false, lastEditedAt: 10, revision: 1, duplicateWarnings: [],
        contact: { name: 'Alex Captain', email: 'alex@example.com', phone: '(555) 555-0100', preferredMethod: 'text', notes: 'Text after work.' },
        members: [
          { id: 'member-a', rosterRole: 'active', displayName: 'Alex A', matchStatus: 'matched', internalPlayerId: 'p1', createdAt: 10, updatedAt: 10 },
          { id: 'member-b', rosterRole: 'substitute', displayName: 'New Player', matchStatus: 'pending', internalPlayerId: null, createdAt: 10, updatedAt: 10 },
        ],
      },
      {
        id: 'entry-bravo', registrationType: 'team', displayName: 'Bravo Squad', status: 'accepted',
        activePlayerCount: 4, substituteCount: 2, createdAt: 9, updatedAt: 9, submittedAt: 9,
        withdrawnAt: null, organizerNote: '', capacityOverride: false, editingLocked: false,
        managementAccessRevoked: false, lastEditedAt: null, revision: 1, duplicateWarnings: [], members: [],
      },
    ],
    capacity: {
      capacity: 12, acceptedEntries: 1, submittedEntries: 1, needsReviewEntries: 0, pendingEntries: 1,
      waitlistedEntries: 0, declinedEntries: 0, withdrawnEntries: 0, acceptedActivePlayers: 4,
      pendingActivePlayers: 4, waitlistedActivePlayers: 0, acceptedSubstitutePlayers: 2,
      totalSubstitutePlayers: 3, remainingAcceptedCapacity: 8,
    },
    organizerGets: 0,
    summaryGets: 0,
    dashboardGets: 0,
    organizerActive: 0,
    organizerMaxActive: 0,
    organizerDelayMs: 0,
    failOrganizer: false,
    summary: null,
    configPosts: 0,
    contactPosts: [],
    lastConfigInput: null,
    failConfig: false,
  };
}

function canonicalSummary(overrides = {}) {
  return {
    eventId: 'registration-event',
    effectiveStatus: 'open',
    entryCounts: { draft: 0, submitted: 0, needsReview: 0, accepted: 1, waitlisted: 0, declined: 0, withdrawn: 0 },
    playerCounts: {
      acceptedActive: 4, acceptedSubstitutes: 0, pendingActive: 0, pendingSubstitutes: 0,
      waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 0,
    },
    capacity: { activePlayerCapacity: 12, acceptedActivePlayers: 4, remainingActiveSpots: 8, isUnlimited: false },
    integration: { acceptedRegistrations: 1, importedRegistrations: 0, readyToImport: 1, blocked: 0, updatesAvailable: 0 },
    revision: 10,
    updatedAt: 10,
    ...overrides,
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
      state.lastConfigInput = input;
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
    const organizerMatch = path.match(/^\/api\/event-registration\/organizer\/([^/]+)(\/summary)?$/);
    if (organizerMatch && request.method() === 'GET') {
      const organizer = state.organizers?.[organizerMatch[1]] || state;
      state.organizerGets++;
      if (organizerMatch[2]) state.summaryGets++;
      else state.dashboardGets++;
      state.organizerActive++;
      state.organizerMaxActive = Math.max(state.organizerMaxActive, state.organizerActive);
      if (state.organizerDelayMs) await new Promise(resolve => setTimeout(resolve, state.organizerDelayMs));
      state.organizerActive--;
      if (state.failOrganizer) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'REGISTRATION_UNAVAILABLE', message: 'Registration summary is temporarily unavailable.' }) });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          ok: true, configured: !!organizer.config, config: organizer.config, summary: organizer.summary,
          capacity: organizer.capacity, ...(organizerMatch[2] ? {} : { entries: organizer.entries }), serverTime: Date.now()
        })
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
    if (path.endsWith('/contact') && path.includes('/entries/')) {
      const entryId = path.split('/').at(-2), input = request.postDataJSON(), entry = state.entries.find(row => row.id === entryId);
      state.contactPosts.push(input);
      entry.contact = input.contact;entry.revision++;entry.updatedAt++;entry.lastEditedAt=Date.now();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, entry }) });
    }
    if (path.includes('/api/event-registration/') && path.endsWith('/status')) {
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

test('canonical registration summary normalization is safe, numeric, idempotent, and keeps statuses, players, substitutes, capacity, and imports distinct', async ({ page }) => {
  await seed(page, []);
  await mockWorker(page, organizerState());
  await page.goto('/');
  const result = await page.evaluate(() => {
    const raw = {
      summary: {
        eventId: 'summary-event', effectiveStatus: 'open',
        entryCounts: { draft: '1', submitted: '2', needsReview: '3', accepted: '1', waitlisted: '4', declined: '5', withdrawn: '6' },
        playerCounts: {
          acceptedActive: '4', acceptedSubstitutes: '2', pendingActive: '9', pendingSubstitutes: '3',
          waitlistedActive: '8', waitlistedSubstitutes: '1', totalSubstitutes: '6',
        },
        capacity: { activePlayerCapacity: '12', acceptedActivePlayers: '4', remainingActiveSpots: '8', isUnlimited: false },
        integration: { acceptedRegistrations: '1', importedRegistrations: '0', readyToImport: '1', blocked: '2', updatesAvailable: '3' },
        revision: '44', updatedAt: '43',
      },
    };
    const before = JSON.stringify(raw), normalized = normalizeRegistrationSummary(raw);
    const repeated = normalizeRegistrationSummary(normalized);
    const legacy = normalizeRegistrationSummary({
      eventId: 'legacy-event',
      capacity: {
        capacity: null, acceptedEntries: '1', submittedEntries: '2', needsReviewEntries: '3',
        acceptedActivePlayers: '4', acceptedSubstitutePlayers: '2', remainingAcceptedCapacity: null,
      },
    });
    const missing = normalizeRegistrationSummary(null, { eventId: 'missing-event' });
    const importSummary = normalizeRegistrationImportSummary({ counts: { accepted: '4', imported: '1', ready: '2', updated: '1', blocked: '3', current: '1' }, revision: '9' });
    return {
      unchanged: before === JSON.stringify(raw), normalized,
      idempotent: JSON.stringify(normalized) === JSON.stringify(repeated),
      legacy, missing, importSummary,
      statuses: REGISTRATION_ENTRY_STATUSES.slice(),
    };
  });
  expect(result.unchanged).toBe(true);
  expect(result.idempotent).toBe(true);
  expect(result.normalized).toMatchObject({
    eventId: 'summary-event',
    entryCounts: { submitted: 2, needsReview: 3, accepted: 1, waitlisted: 4, declined: 5, withdrawn: 6 },
    playerCounts: { acceptedActive: 4, acceptedSubstitutes: 2, pendingActive: 9, pendingSubstitutes: 3 },
    capacity: { activePlayerCapacity: 12, acceptedActivePlayers: 4, remainingActiveSpots: 8, isUnlimited: false },
    integration: { acceptedRegistrations: 1, importedRegistrations: 0, readyToImport: 1, blocked: 2, updatesAvailable: 3 },
    revision: 44, updatedAt: 43,
  });
  expect(result.legacy).toMatchObject({
    entryCounts: { accepted: 1, submitted: 2, needsReview: 3 },
    playerCounts: { acceptedActive: 4, acceptedSubstitutes: 2 },
    capacity: { activePlayerCapacity: null, remainingActiveSpots: null, isUnlimited: true },
  });
  expect(result.missing).toMatchObject({
    eventId: 'missing-event',
    entryCounts: { accepted: 0, submitted: 0, needsReview: 0 },
    capacity: { activePlayerCapacity: null, remainingActiveSpots: null, isUnlimited: true },
  });
  expect(result.importSummary).toEqual({
    acceptedRegistrations: 4, importedRegistrations: 1, readyToImport: 2,
    blocked: 3, updatesAvailable: 1, current: 1, revision: 9,
  });
  expect(result.statuses).toEqual(['draft', 'submitted', 'needs_review', 'accepted', 'waitlisted', 'declined', 'withdrawn']);
  expect(result.statuses).not.toContain('pending');
  expect(result.statuses).not.toContain('approved');
});

test('event-registration player directory uses public-safe unique labels and a dedicated eligibility rule', async ({ page }) => {
  const playerList = [
    { id: 'p1', name: 'Alex', aliases: ['Ace'], active: true, archived: false, pickupEligible: true, rating: 99, notes: 'private' },
    { id: 'p2', name: 'Alex', aliases: ['Lex'], active: true, archived: false, pickupEligible: false, rating: 12, notes: 'private' },
    { id: 'p3', name: 'Away', aliases: [], active: false, archived: false, pickupEligible: true, rating: 50 },
    { id: 'p4', name: 'Excluded', aliases: [], active: true, archived: false, registrationEligible: false, rating: 50 },
  ];
  await seed(page, [fixedEvent()], playerList);
  await mockWorker(page, organizerState());
  await page.goto('/');
  const result = await page.evaluate(() => {
    const event = evById('registration-event');
    const directory = createEventRegistrationPlayerDirectory(event);
    const repeated = createEventRegistrationPlayerDirectory(event);
    const payload = registrationServerPayload(event, { ...deriveRegistrationDefaultsFromEvent(event), enabled: true, status: 'open', mode: 'team' });
    return { directory, repeated, players: payload.players };
  });
  expect(result.directory).toHaveLength(2);
  expect(result.directory.map(player => player.displayName)).toEqual(['Alex #1', 'Alex #2']);
  expect(result.directory.map(player => player.publicPlayerToken).every(token => /^[A-Za-z0-9_-]{22}$/.test(token))).toBe(true);
  expect(result.repeated.map(player => player.publicPlayerToken)).toEqual(result.directory.map(player => player.publicPlayerToken));
  expect(result.directory.find(player => player.internalPlayerId === 'p2')).toMatchObject({ eligible: true, aliases: ['Lex'] });
  expect(JSON.stringify(result.players)).not.toMatch(/rating|notes|roles|stats|history/i);
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
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('Active roster · 1');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('Substitutes · 1');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('New Player');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).not.toContainText(/rating|seed|stats/i);
  await expect(page.getByRole('button', { name: 'Move New Player to active players' })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review New Player' })).toBeVisible();
  await page.getByRole('button', { name: 'Create event-only participant', exact: true }).click();
  await expect(page.locator('#pName')).toHaveValue('New Player');
  await expect(page.locator('#pPickupEligible')).not.toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-registration-dashboard]')).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Create normal player', exact: true }).click();
  await expect(page.locator('#pPickupEligible')).toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-registration-dashboard]')).toBeVisible();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const passiveState = await page.evaluate(() => {
    const root = document.querySelector('[data-registration-dashboard]');
    root.__identity = 'dashboard';
    const row = root.querySelector('[data-registration-entry="entry-alpha"]');
    row.__identity = 'alpha';
    const sheet = root.closest('.sheet');
    sheet.style.maxHeight = '320px';
    row.querySelector('select').focus({ preventScroll: true });
    sheet.scrollTop = 180;
    return { scrollTop: sheet.scrollTop };
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
    scrollTop: document.querySelector('[data-registration-dashboard]').closest('.sheet').scrollTop,
  }))).toEqual({ dashboard: 'dashboard', row: 'alpha', focused: true, scrollTop: passiveState.scrollTop });
  expect(await page.evaluate(() => EventRegistration.modalEventId)).toBe('registration-event');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await page.evaluate(() => ({ modal: EventRegistration.modalEventId, timer: EventRegistration._pollTimer }))).toMatchObject({ modal: null });
});

test('registration dashboard uses one scroller, leads with entries, and preserves filter, sheet position, focus, and member review', async ({ page }) => {
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: Date.now() - 1000, closesAt: Date.now() + 100000,
    activePlayerCapacity: 28, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: Date.now(),
  };
  const rotatingRegistration = { ...registration, mode: 'individual', minActivePlayersPerTeam: 1, maxActivePlayersPerTeam: 1 };
  const rotating = fixedEvent({
    id: 'registration-rotating',
    name: 'Rotating Registration',
    format: 'rotatingGroups',
    teams: [],
    entries: [],
    rotation: { entrySize: 1, teamSize: 4 },
    registration: rotatingRegistration,
  });
  const state = organizerState();
  state.entries.push(...Array.from({ length: 6 }, (_, index) => ({
    ...structuredClone(state.entries[1]),
    id: `entry-extra-${index}`,
    displayName: `Accepted Entry ${index + 1}`,
    updatedAt: 20 + index,
  })));
  state.config = {
    ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventDate: '2026-08-15',
    eventFormat: 'fixedTeams', eventAvailable: true, effectiveStatus: 'open',
  };
  state.summary = canonicalSummary({
    entryCounts: { draft: 0, submitted: 1, needsReview: 0, accepted: 7, waitlisted: 0, declined: 0, withdrawn: 0 },
    playerCounts: {
      acceptedActive: 28, acceptedSubstitutes: 2, pendingActive: 4, pendingSubstitutes: 1,
      waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 3,
    },
    capacity: { activePlayerCapacity: 28, acceptedActivePlayers: 28, remainingActiveSpots: 0, isUnlimited: false },
    revision: 20,
  });
  state.organizers = {
    'registration-rotating': {
      config: {
        ...rotatingRegistration, eventId: 'registration-rotating', eventName: rotating.name,
        eventDate: '2026-08-15', eventFormat: 'rotatingGroups', eventAvailable: true, effectiveStatus: 'open',
      },
      summary: canonicalSummary({ eventId: 'registration-rotating', revision: 21 }),
      capacity: state.capacity,
      entries: structuredClone(state.entries),
    },
  };
  await seed(page, [fixedEvent({ registration }), rotating], [
    { id: 'p1', name: 'Alex A', active: true, archived: false, pickupEligible: true, aliases: [] },
  ]);
  await mockWorker(page, state);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-registration-entry]')).toHaveCount(8);

  const mobileLayout = await page.evaluate(() => {
    const root = document.querySelector('[data-registration-dashboard]');
    const sheet = root.closest('.sheet'), list = root.querySelector('[data-registration-entry-list]');
    const first = list.querySelector('[data-registration-entry]'), footer = root.querySelector('[data-sheet-foot]');
    const sheetBox = sheet.getBoundingClientRect(), firstBox = first.getBoundingClientRect(), footerBox = footer.getBoundingClientRect();
    return {
      headlineCount: root.querySelectorAll('[data-registration-headlines] > div').length,
      secondaryOpen: root.querySelector('[data-registration-secondary-summary]').open,
      entriesBeforeSecondary: !!(list.compareDocumentPosition(root.querySelector('[data-registration-secondary-summary]')) & Node.DOCUMENT_POSITION_FOLLOWING),
      listOverflowY: getComputedStyle(list).overflowY,
      listOwnsScroll: list.scrollHeight > list.clientHeight + 1,
      sheetOwnsScroll: sheet.scrollHeight > sheet.clientHeight + 1,
      firstUseful: firstBox.top >= sheetBox.top && firstBox.top < footerBox.top,
      footerPosition: getComputedStyle(footer).position,
      footerInSheet: footerBox.top >= sheetBox.top && footerBox.bottom <= sheetBox.bottom + 1,
    };
  });
  expect(mobileLayout).toEqual({
    headlineCount: 2,
    secondaryOpen: false,
    entriesBeforeSecondary: true,
    listOverflowY: 'visible',
    listOwnsScroll: false,
    sheetOwnsScroll: true,
    firstUseful: true,
    footerPosition: 'sticky',
    footerInSheet: true,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => {
    const root = document.querySelector('[data-registration-dashboard]');
    const sheet = root.closest('.sheet'), list = root.querySelector('[data-registration-entry-list]');
    const first = list.querySelector('[data-registration-entry]'), footer = root.querySelector('[data-sheet-foot]');
    const firstBox = first.getBoundingClientRect(), footerBox = footer.getBoundingClientRect();
    return {
      sheetOverflow: sheet.scrollWidth - sheet.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      firstUseful: firstBox.top >= sheet.getBoundingClientRect().top && firstBox.top < footerBox.top,
      footerVisible: footerBox.bottom <= sheet.getBoundingClientRect().bottom + 1,
    };
  })).toEqual({ sheetOverflow: 0, documentOverflow: 0, firstUseful: true, footerVisible: true });
  await expect(page.locator('[data-reg-active]')).toBeHidden();
  await page.locator('[data-registration-secondary-summary] summary').click();
  await expect(page.locator('[data-reg-active]')).toBeVisible();
  for (const action of ['Review import', 'Event-day check-in']) {
    await expect(page.locator('[data-registration-dashboard-actions]').getByRole('button', { name: action, exact: true })).toBeVisible();
  }
  await page.locator('.registration-dashboard-more-actions > summary').click();
  for (const action of ['Settings', 'Share link', 'Copy link']) {
    await expect(page.locator('[data-registration-dashboard-actions]').getByRole('button', { name: action, exact: true })).toBeVisible();
  }
  await page.locator('.registration-dashboard-more-actions > summary').click();

  await page.locator('#registrationFilter').selectOption('pending');
  await expect(page.locator('[data-registration-entry]')).toHaveCount(1);
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toBeVisible();
  const interaction = await page.evaluate(() => {
    const sheet = document.querySelector('[data-registration-dashboard]').closest('.sheet');
    const select = document.querySelector('[data-registration-entry="entry-alpha"] select');
    select.focus({ preventScroll: true });
    sheet.scrollTop = Math.min(220, sheet.scrollHeight - sheet.clientHeight);
    return { scrollTop: sheet.scrollTop };
  });
  await page.evaluate(() => EventRegistration.refresh('registration-event', { poll: true }));
  await expect(page.locator('#registrationFilter')).toHaveValue('pending');
  await expect(page.locator('[data-registration-entry="entry-alpha"] select')).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-registration-dashboard]').closest('.sheet').scrollTop)).toBe(interaction.scrollTop);

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const reviewSearch = page.getByRole('searchbox', { name: 'Search private roster' });
  await reviewSearch.fill('Alex');
  await expect(reviewSearch).toBeFocused();
  await page.evaluate(() => EventRegistration.refresh('registration-event', { poll: true }));
  await expect(page.locator('[data-registration-member-review]')).toBeVisible();
  await expect(reviewSearch).toHaveValue('Alex');
  await expect(reviewSearch).toBeFocused();
  expect(await page.evaluate(() => EventRegistration.modalEventId)).toBe('registration-event');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => EventRegistration.modalEventId)).toBeNull();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { window._evOpen = null; render({ scroll: 'top' }); });
  await page.getByRole('button', { name: /Rotating Registration/ }).click();
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-registration-entry]')).toHaveCount(8);
  const desktopLayout = await page.evaluate(() => {
    const root = document.querySelector('[data-registration-dashboard]');
    const sheet = root.closest('.sheet'), list = root.querySelector('[data-registration-entry-list]');
    return {
      listOverflowY: getComputedStyle(list).overflowY,
      listOwnsScroll: list.scrollHeight > list.clientHeight + 1,
      sheetOverflowY: getComputedStyle(sheet).overflowY,
      footerPosition: getComputedStyle(root.querySelector('[data-sheet-foot]')).position,
    };
  });
  expect(desktopLayout).toEqual({ listOverflowY: 'visible', listOwnsScroll: false, sheetOverflowY: 'auto', footerPosition: 'sticky' });
});

test('organizer registration details show, link, and edit private contact without changing roster or status', async ({ page }) => {
  const state = organizerState();
  state.config = {
    eventId: 'registration-event',
    eventName: 'Summer Sand',
    eventDate: '2026-08-15',
    eventFormat: 'fixedTeams',
    enabled: true,
    status: 'open',
    effectiveStatus: 'open',
    mode: 'team',
    opensAt: null,
    closesAt: null,
    activePlayerCapacity: 12,
    allowSubstitutes: true,
    maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4,
    maxActivePlayersPerTeam: 4,
    requireOrganizerApproval: true,
    allowWaitlist: true,
  };
  state.summary = canonicalSummary();
  await seed(page, [fixedEvent({ registration: {
    enabled: true, status: 'open', mode: 'team', opensAt: null, closesAt: null,
    activePlayerCapacity: 12, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: 10,
  } })]);
  await mockWorker(page, state);
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();

  const alpha = page.locator('[data-registration-entry="entry-alpha"]');
  await expect(alpha).toContainText('Registrant / contact');
  await expect(alpha).toContainText('Alex Captain');
  await expect(alpha.getByRole('link', { name: 'alex@example.com' })).toHaveAttribute('href', 'mailto:alex%40example.com');
  await expect(alpha.getByRole('link', { name: '(555) 555-0100' })).toHaveAttribute('href', 'tel:5555550100');
  await expect(alpha).toContainText('Preferred: Text');
  await expect(page.locator('[data-registration-entry="entry-bravo"]')).toContainText('Not provided');

  const originalMembers = structuredClone(state.entries[0].members), originalStatus = state.entries[0].status;
  await alpha.getByRole('button', { name: 'Edit contact' }).click();
  await alpha.locator('input[id*="contact-name"]').fill('Updated Captain');
  await alpha.locator('input[id*="contact-email"]').fill('');
  await alpha.locator('input[id*="contact-phone"]').fill('+1 555 555 0199');
  await alpha.locator('select[id*="contact-method"]').selectOption('phone');
  await alpha.locator('textarea[id*="contact-notes"]').fill('Call in the evening.');
  await alpha.getByRole('button', { name: 'Save contact' }).click();
  await expect(alpha).toContainText('Updated Captain');
  await expect(alpha).toContainText('+1 555 555 0199');
  expect(state.contactPosts).toHaveLength(1);
  expect(state.contactPosts[0]).toMatchObject({
    revision: 1,
    contact: { name: 'Updated Captain', email: '', phone: '+1 555 555 0199', preferredMethod: 'phone', notes: 'Call in the evening.' },
  });
  expect(state.entries[0].members).toEqual(originalMembers);
  expect(state.entries[0].status).toBe(originalStatus);
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

test('event card and management modal share live canonical counts without zero-loading, overlap, stale clearing, or a reload', async ({ page }) => {
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: Date.now() - 1000, closesAt: Date.now() + 100000,
    activePlayerCapacity: 12, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: Date.now(),
  };
  const state = organizerState();
  state.config = {
    ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventDate: '2026-08-15',
    eventFormat: 'fixedTeams', eventAvailable: true, effectiveStatus: 'open', archivedAt: null, createdAt: 1,
  };
  state.summary = canonicalSummary();
  state.organizerDelayMs = 200;
  await seed(page, [fixedEvent({ registration })]);
  await mockWorker(page, state);
  await page.goto('/');
  await openEvent(page);

  const card = page.locator('[data-registration-summary="registration-event"]');
  const cardMetrics = card.locator('.registration-capacity-grid .num');
  expect(await cardMetrics.allTextContents()).toEqual(['—', '—', '—', '—']);
  await expect(cardMetrics.nth(0)).toHaveText('1');
  await expect(cardMetrics.nth(1)).toHaveText('4');
  await expect(cardMetrics.nth(2)).toHaveText('0');
  await expect(cardMetrics.nth(3)).toHaveText('8');
  expect(state.summaryGets).toBeGreaterThan(0);
  expect(state.dashboardGets).toBe(0);
  await page.evaluate(() => { document.querySelector('[data-registration-summary]').__identity = 'same-summary-card'; });
  await page.evaluate(() => EventRegistration.refresh('registration-event'));
  expect(await page.evaluate(() => document.querySelector('[data-registration-summary]').__identity)).toBe('same-summary-card');

  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-reg-accepted]')).toHaveText('1');
  await expect(page.locator('[data-reg-active]')).toHaveText('4');
  await expect.poll(() => state.dashboardGets).toBeGreaterThan(0);
  expect(await page.evaluate(() => EventRegistration.get('registration-event').summary)).toMatchObject({
    entryCounts: { accepted: 1 }, playerCounts: { acceptedActive: 4 }, revision: 10,
  });

  state.summary = canonicalSummary({
    entryCounts: { draft: 0, submitted: 0, needsReview: 1, accepted: 1, waitlisted: 0, declined: 0, withdrawn: 0 },
    playerCounts: {
      acceptedActive: 4, acceptedSubstitutes: 1, pendingActive: 4, pendingSubstitutes: 0,
      waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 1,
    },
    revision: 11, updatedAt: 11,
  });
  state.organizerDelayMs = 0;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('[data-reg-pending]')).toHaveText('1');
  await expect(page.locator('[data-reg-subs]')).toHaveText('1');
  await expect(cardMetrics.nth(2)).toHaveText('1');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(cardMetrics.nth(0)).toHaveText('1');
  await expect(cardMetrics.nth(1)).toHaveText('4');
  await expect(cardMetrics.nth(2)).toHaveText('1');

  state.failOrganizer = true;
  await page.evaluate(() => EventRegistration.refresh('registration-event'));
  await expect(cardMetrics.nth(0)).toHaveText('1');
  await expect(cardMetrics.nth(1)).toHaveText('4');
  await expect(card.locator('[data-registration-summary-error]')).toHaveText('Registration summary is temporarily unavailable.');

  state.failOrganizer = false;
  state.summary = canonicalSummary({
    entryCounts: { draft: 0, submitted: 0, needsReview: 0, accepted: 2, waitlisted: 0, declined: 0, withdrawn: 0 },
    playerCounts: {
      acceptedActive: 8, acceptedSubstitutes: 1, pendingActive: 0, pendingSubstitutes: 0,
      waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 1,
    },
    capacity: { activePlayerCapacity: null, acceptedActivePlayers: 8, remainingActiveSpots: null, isUnlimited: true },
    integration: { acceptedRegistrations: 2, importedRegistrations: 0, readyToImport: 2, blocked: 0, updatesAvailable: 0 },
    revision: 12, updatedAt: 12,
  });
  const before = state.organizerGets;
  state.organizerDelayMs = 100;
  await page.evaluate(() => Promise.all([
    EventRegistration.refresh('registration-event'),
    EventRegistration.refresh('registration-event'),
    EventRegistration.refresh('registration-event'),
  ]));
  expect(state.organizerGets - before).toBe(1);
  expect(state.organizerMaxActive).toBe(1);
  await expect(cardMetrics.nth(0)).toHaveText('2');
  await expect(cardMetrics.nth(1)).toHaveText('8');
  await expect(cardMetrics.nth(3)).toHaveText('∞');
  expect(await page.evaluate(() => EventRegistration.pollState)).toMatchObject({
    visibleEventId: 'registration-event', modalEventId: null, scheduled: true, inFlight: [],
  });
});

test('registration state and response sequencing stay scoped to stable event IDs when events refresh concurrently', async ({ page }) => {
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: Date.now() - 1000, closesAt: Date.now() + 100000,
    activePlayerCapacity: 20, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: Date.now(),
  };
  const otherRegistration = { ...registration, publicToken: 'S'.repeat(43), publicUrl: `${WORKER}/register/${'S'.repeat(43)}` };
  const otherEvent = fixedEvent({ id: 'registration-other', name: 'Other Event', teams: [], registration: otherRegistration });
  const state = organizerState();
  state.config = {
    ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventDate: '2026-08-15',
    eventFormat: 'fixedTeams', eventAvailable: true, effectiveStatus: 'open',
  };
  state.summary = canonicalSummary();
  state.organizerDelayMs = 100;
  state.organizers = {
    'registration-other': {
      config: {
        ...otherRegistration, eventId: 'registration-other', eventName: 'Other Event', eventDate: '2026-08-15',
        eventFormat: 'fixedTeams', eventAvailable: true, effectiveStatus: 'open',
      },
      summary: canonicalSummary({
        eventId: 'registration-other',
        entryCounts: { draft: 0, submitted: 0, needsReview: 0, accepted: 3, waitlisted: 1, declined: 0, withdrawn: 0 },
        playerCounts: {
          acceptedActive: 12, acceptedSubstitutes: 2, pendingActive: 0, pendingSubstitutes: 0,
          waitlistedActive: 4, waitlistedSubstitutes: 0, totalSubstitutes: 2,
        },
        capacity: { activePlayerCapacity: 20, acceptedActivePlayers: 12, remainingActiveSpots: 8, isUnlimited: false },
        integration: { acceptedRegistrations: 3, importedRegistrations: 0, readyToImport: 3, blocked: 0, updatesAvailable: 0 },
        revision: 20, updatedAt: 20,
      }),
      capacity: { ...state.capacity, acceptedEntries: 3, acceptedActivePlayers: 12, remainingAcceptedCapacity: 8 },
      entries: [],
    },
  };
  await seed(page, [fixedEvent({ registration }), otherEvent]);
  await mockWorker(page, state);
  await page.goto('/');
  await page.evaluate(() => Promise.all([
    EventRegistration.refresh('registration-event'),
    EventRegistration.refresh('registration-other'),
  ]));
  const summaries = await page.evaluate(() => ({
    first: EventRegistration.get('registration-event').summary,
    second: EventRegistration.get('registration-other').summary,
  }));
  expect(summaries.first).toMatchObject({ eventId: 'registration-event', entryCounts: { accepted: 1 }, playerCounts: { acceptedActive: 4 } });
  expect(summaries.second).toMatchObject({ eventId: 'registration-other', entryCounts: { accepted: 3 }, playerCounts: { acceptedActive: 12 } });

  await openEvent(page);
  await expect(page.locator('[data-registration-summary] .registration-capacity-grid .num').nth(0)).toHaveText('1');
  await page.evaluate(() => { window._evOpen = null; render({ scroll: 'top' }); });
  await page.getByRole('button', { name: /Other Event/ }).click();
  await expect(page.locator('[data-registration-summary] .registration-capacity-grid .num').nth(0)).toHaveText('3');
  await expect(page.locator('[data-registration-summary] .registration-capacity-grid .num').nth(1)).toHaveText('12');
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
  const dashboard = page.locator('[data-registration-dashboard]');
  await expect(dashboard).toBeVisible();
  for (const removed of ['Rotate link', 'Open', 'Close', 'Cancel registration']) {
    await expect(dashboard.getByRole('button', { name: removed, exact: true })).toHaveCount(0);
  }
  for (const retained of ['Review import', 'Event-day check-in']) {
    await expect(dashboard.getByRole('button', { name: retained, exact: true })).toBeVisible();
  }
  await dashboard.locator('.registration-dashboard-more-actions > summary').click();
  for (const retained of ['Share link', 'Copy link', 'Settings']) {
    await expect(dashboard.getByRole('button', { name: retained, exact: true })).toBeVisible();
  }
  const dashboardOverflow = await page.evaluate(() => document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth);
  expect(dashboardOverflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('[data-registration-settings]')).toBeVisible();
  const settingsOverflow = await page.evaluate(() => document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth);
  expect(settingsOverflow).toBeLessThanOrEqual(0);
  await expect(page.locator('#registrationEnabled')).toHaveAccessibleName(/Public registration enabled/);
  await expect(page.locator('[data-registration-settings] input[type="checkbox"]')).toHaveCount(4);
  await expect(page.locator('[data-registration-settings] input[type="checkbox"]:not(.court-checkbox-input)')).toHaveCount(0);
  const substituteToggle = page.locator('#registrationAllowSubstitutes');
  await expect(substituteToggle).toHaveAccessibleName(/Allow substitutes/);
  await page.locator('label[for="registrationAllowSubstitutes"]').click();
  await expect(substituteToggle).not.toBeChecked();
  await expect(page.locator('#registrationMaxSubstitutes')).toBeDisabled();
  await page.locator('label[for="registrationAllowSubstitutes"]').click();
  await expect(substituteToggle).toBeChecked();
  await expect(page.locator('#registrationMaxSubstitutes')).toBeEnabled();
  const checkboxLayout = await page.evaluate(() => {
    const row = document.querySelector('label[for="registrationEnabled"]');
    const control = row.querySelector('.court-checkbox-control');
    const nextField = row.nextElementSibling;
    const rowBox = row.getBoundingClientRect(), fieldBox = nextField.getBoundingClientRect();
    return {
      rowHeight: rowBox.height,
      gap: fieldBox.top - rowBox.bottom,
      rowOutline: getComputedStyle(row).outlineStyle,
      controlOutline: getComputedStyle(control).outlineStyle,
    };
  });
  expect(checkboxLayout.rowHeight).toBeGreaterThanOrEqual(44);
  expect(checkboxLayout.gap).toBeGreaterThanOrEqual(10);
  expect(checkboxLayout.rowOutline).toBe('none');
  expect(checkboxLayout.controlOutline).toBe('none');
  await page.locator('#registrationEnabled').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#registrationEnabled')).toBeFocused();
  await expect(page.locator('label[for="registrationEnabled"] .court-checkbox-control')).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('button', { name: 'Rotate link', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rotate link', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('old link will stop working immediately');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel registration', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel registration', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Existing entries remain');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
});
