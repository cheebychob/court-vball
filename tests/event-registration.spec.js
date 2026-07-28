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
    configDelayMs: 0,
    contactPosts: [],
    managementPosts: [],
    statusPosts: [],
    statusDelayMs: 0,
    failStatus: false,
    forceCapacityError: false,
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
      if (state.configDelayMs) await new Promise(resolve => setTimeout(resolve, state.configDelayMs));
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
      state.statusPosts.push({ entryId, ...input });
      if (state.statusDelayMs) await new Promise(resolve => setTimeout(resolve, state.statusDelayMs));
      if (state.failStatus) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'REGISTRATION_UNAVAILABLE', message: 'Status service is offline.' }) });
      if (state.forceCapacityError && input.status === 'accepted' && !input.overrideCapacity) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'CAPACITY_EXCEEDED', message: 'Accepting this entry exceeds active-player capacity.' }) });
      }
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
    if (path.endsWith('/management') && path.includes('/entries/')) {
      const entryId = path.split('/').at(-2), input = request.postDataJSON(), entry = state.entries.find(row => row.id === entryId);
      state.managementPosts.push({ entryId, ...input });
      if (input.action === 'revoke') entry.managementAccessRevoked = true;
      if (input.action === 'lock') entry.editingLocked = true;
      if (input.action === 'unlock') entry.editingLocked = false;
      entry.revision++;entry.updatedAt++;
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

  await expect(page.locator('[data-registration-settings]')).toBeVisible();
  await expect(page.locator('[data-registration-settings-success]')).toHaveText('Registration settings saved.');
  await expect(page.locator('#event-registration')).toContainText('Open');
  expect(state.configPosts).toBe(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:events'))[0].registration);
  expect(stored).toMatchObject({
    enabled: true, status: 'open', mode: 'team', activePlayerCapacity: 12,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4,
    publicToken: TOKEN, publicUrl: `${WORKER}/register/${TOKEN}`,
  });

  await page.locator('[data-registration-settings]').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-registration-dashboard]')).toBeVisible();
  await expect(page.locator('[data-reg-accepted]')).toHaveText('1');
  await expect(page.locator('[data-reg-active]')).toHaveText('4');
  await expect(page.locator('[data-reg-subs]')).toHaveText('2');
  const alphaEntry = page.locator('[data-registration-entry="entry-alpha"]');
  await expect(alphaEntry.locator('[data-registration-primary-label]')).toHaveText('Alpha Squad');
  await expect(alphaEntry).toContainText('Captain / contact');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('Active roster · 1');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('Substitutes · 1');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toContainText('New Player');
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).not.toContainText(/rating|seed|stats/i);
  const alphaManagement = alphaEntry.locator('.registration-management-toggle');
  await expect(alphaManagement).toHaveAttribute('aria-expanded', 'false');
  await alphaManagement.click();
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
  if (await alphaManagement.getAttribute('aria-expanded') === 'false') await alphaManagement.click();
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

test('status-aware quick actions reuse organizer persistence without duplicate requests, deletion, or modal jumps', async ({ page }) => {
  const state = organizerState();
  const cloneEntry = (id, displayName, status) => ({
    ...structuredClone(state.entries[0]), id, displayName, status, updatedAt: 10, revision: 1,
    contact: { name: `${displayName} Captain`, email: `${id}@example.com`, phone: '', preferredMethod: 'email', notes: '' },
    members: [],
  });
  state.entries.push(
    cloneEntry('entry-review', 'Review Squad', 'needs_review'),
    cloneEntry('entry-wait', 'Waitlist Squad', 'waitlisted'),
    cloneEntry('entry-declined', 'Declined Squad', 'declined'),
    cloneEntry('entry-fail', 'Failure Squad', 'submitted'),
  );
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: null, closesAt: null,
    activePlayerCapacity: 12, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: 10,
  };
  state.config = {
    ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventDate: '2026-08-15',
    eventFormat: 'fixedTeams', eventAvailable: true, effectiveStatus: 'open',
  };
  state.summary = canonicalSummary({
    entryCounts: { draft: 0, submitted: 2, needsReview: 1, accepted: 1, waitlisted: 1, declined: 1, withdrawn: 0 },
  });
  await seed(page, [fixedEvent({ registration })]);
  await mockWorker(page, state);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();

  const alpha = page.locator('[data-registration-entry="entry-alpha"]');
  const accepted = page.locator('[data-registration-entry="entry-bravo"]');
  const review = page.locator('[data-registration-entry="entry-review"]');
  const waitlisted = page.locator('[data-registration-entry="entry-wait"]');
  const declined = page.locator('[data-registration-entry="entry-declined"]');
  const failure = page.locator('[data-registration-entry="entry-fail"]');

  for (const row of [alpha, review]) {
    await expect(row.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Decline', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'More options', exact: true })).toBeVisible();
  }
  await expect(waitlisted.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
  await expect(waitlisted.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0);
  await expect(accepted.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  await expect(declined.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0);

  await alpha.getByRole('button', { name: 'More options', exact: true }).click();
  await expect(alpha.locator('.registration-management-panel')).toBeVisible();
  expect(await alpha.locator('select option').allTextContents()).toEqual(['Submitted', 'Needs review', 'Accepted', 'Waitlisted', 'Declined', 'Withdrawn']);
  for (const action of ['Lock editing', 'Rotate management link', 'Revoke access']) {
    await expect(alpha.getByRole('button', { name: action, exact: true })).toBeVisible();
  }

  state.statusDelayMs = 150;
  const beforeAccept = await page.evaluate(() => {
    const sheet = document.querySelector('[data-registration-dashboard]').closest('.sheet');
    sheet.style.maxHeight = '360px';
    sheet.scrollTop = Math.min(180, sheet.scrollHeight - sheet.clientHeight);
    const button = document.querySelector('[data-registration-entry="entry-alpha"] .registration-quick-accept');
    button.focus({ preventScroll: true });
    return { sheetScroll: sheet.scrollTop, windowScroll: window.scrollY };
  });
  await page.evaluate(() => {
    void quickRegistrationEntryStatus('entry-alpha', 'accepted');
    void quickRegistrationEntryStatus('entry-alpha', 'accepted');
  });
  await expect(alpha.getByRole('button', { name: 'Accepting…', exact: true })).toBeDisabled();
  await expect(alpha.locator('.pill')).toHaveText('Accepted');
  await expect(alpha.locator('.registration-quick-feedback')).toHaveText('Registration accepted.');
  expect(state.statusPosts.filter(post => post.entryId === 'entry-alpha')).toEqual([
    { entryId: 'entry-alpha', status: 'accepted', overrideCapacity: false },
  ]);
  expect(await page.evaluate(() => ({
    modal: EventRegistration.modalEventId,
    sheetScroll: document.querySelector('[data-registration-dashboard]').closest('.sheet').scrollTop,
    windowScroll: window.scrollY,
  }))).toEqual({ modal: 'registration-event', sheetScroll: beforeAccept.sheetScroll, windowScroll: beforeAccept.windowScroll });
  await expect(alpha.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  await expect(alpha.locator('.registration-management-panel')).toBeVisible();

  const countBeforeDecline = state.entries.length;
  await page.evaluate(() => quickRegistrationEntryStatus('entry-review', 'declined'));
  await expect(review.locator('.pill')).toHaveText('Declined');
  await expect(review.locator('.registration-quick-feedback')).toHaveText('Registration declined.');
  expect(state.entries).toHaveLength(countBeforeDecline);
  expect(state.entries.find(entry => entry.id === 'entry-review')).toMatchObject({ status: 'declined' });

  state.failStatus = true;
  const previousFailureStatus = state.entries.find(entry => entry.id === 'entry-fail').status;
  await page.evaluate(() => quickRegistrationEntryStatus('entry-fail', 'declined'));
  await expect(failure.locator('.registration-quick-feedback')).toHaveText('Status service is offline.');
  await expect(failure.locator('.pill')).toHaveText('Submitted');
  expect(state.entries.find(entry => entry.id === 'entry-fail').status).toBe(previousFailureStatus);
  state.failStatus = false;

  state.forceCapacityError = true;
  await page.evaluate(() => { void quickRegistrationEntryStatus('entry-wait', 'accepted'); });
  const capacityDialog = page.getByRole('alertdialog');
  await expect(capacityDialog).toContainText('capacity override');
  await capacityDialog.getByRole('button', { name: 'Accept over capacity', exact: true }).click();
  await expect(waitlisted.locator('.pill')).toHaveText('Accepted');
  expect(state.statusPosts.filter(post => post.entryId === 'entry-wait')).toEqual([
    { entryId: 'entry-wait', status: 'accepted', overrideCapacity: false },
    { entryId: 'entry-wait', status: 'accepted', overrideCapacity: true },
  ]);
  await expect(page.locator('[data-registration-dashboard]')).toBeVisible();

  const quickLayout = await page.evaluate(() => {
    const card = document.querySelector('[data-registration-entry="entry-fail"]');
    const actions = card.querySelector('.registration-quick-actions');
    return {
      cardOverflow: card.scrollWidth - card.clientWidth,
      actionOverflow: actions.scrollWidth - actions.clientWidth,
      columns: getComputedStyle(actions).gridTemplateColumns.split(' ').length,
      minButtonHeight: Math.min(...[...actions.querySelectorAll('button')].map(button => button.getBoundingClientRect().height)),
    };
  });
  expect(quickLayout).toMatchObject({ cardOverflow: 0, actionOverflow: 0, columns: 2 });
  expect(quickLayout.minButtonHeight).toBeGreaterThanOrEqual(44);
});

test('individual entry cards lead with public participant identity and preserve compact management state', async ({ page }) => {
  const submittedAt = Date.UTC(2026, 6, 28, 14, 9);
  const registration = {
    enabled: true, status: 'open', mode: 'individual', opensAt: null, closesAt: null,
    activePlayerCapacity: 24, allowSubstitutes: false, maxSubstitutesPerTeam: 0,
    minActivePlayersPerTeam: 1, maxActivePlayersPerTeam: 1, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: submittedAt,
  };
  const individual = (id, displayName, member, overrides = {}) => ({
    id, registrationType: 'individual', displayName, status: 'submitted',
    activePlayerCount: 1, substituteCount: 0, createdAt: submittedAt, updatedAt: submittedAt,
    submittedAt, withdrawnAt: null, organizerNote: '', capacityOverride: false, editingLocked: false,
    managementAccessRevoked: false, lastEditedAt: submittedAt, revision: 1, duplicateWarnings: [],
    contact: { name: member.displayName, email: `${id}@example.com`, phone: '612-338-5747', preferredMethod: 'phone', notes: '' },
    members: [member], ...overrides,
  });
  const state = organizerState();
  state.entries = [
    individual('individual-same', 'Logan Public', { id: 'member-logan', rosterRole: 'active', displayName: 'Logan Public', matchStatus: 'matched', internalPlayerId: 'p1' }),
    individual('individual-custom', 'Monday Night Entry', { id: 'member-morgan', rosterRole: 'active', displayName: 'Morgan Public', matchStatus: 'matched', internalPlayerId: 'p2' }, {
      status: 'accepted', lastEditedAt: submittedAt + 5 * 60 * 1000,
      contact: { name: 'Jamie Contact', email: 'jamie@example.com', phone: '', preferredMethod: 'email', notes: '' },
    }),
    individual('individual-unmatched', '', { id: 'member-sam', rosterRole: 'active', displayName: 'Submitted Sam', matchStatus: 'pending', internalPlayerId: null }),
    individual('individual-created', 'Casey Public', { id: 'member-casey', rosterRole: 'active', displayName: 'Casey Public', matchStatus: 'organizer_created', internalPlayerId: 'p3' }),
    individual('individual-event-only', 'Guest Public', { id: 'member-guest', rosterRole: 'active', displayName: 'Guest Public', matchStatus: 'organizer_created', internalPlayerId: 'p4' }),
  ];
  state.config = {
    ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventDate: '2026-08-15',
    eventFormat: 'rotatingGroups', eventAvailable: true, effectiveStatus: 'open',
  };
  state.summary = canonicalSummary({
    entryCounts: { draft: 0, submitted: 4, needsReview: 0, accepted: 1, waitlisted: 0, declined: 0, withdrawn: 0 },
    playerCounts: {
      acceptedActive: 1, acceptedSubstitutes: 0, pendingActive: 4, pendingSubstitutes: 0,
      waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 0,
    },
    capacity: { activePlayerCapacity: 24, acceptedActivePlayers: 1, remainingActiveSpots: 23, isUnlimited: false },
  });
  await seed(page, [fixedEvent({ format: 'rotatingGroups', teams: [], entries: [], rotation: { entrySize: 1, teamSize: 4 }, registration })], [
    { id: 'p1', name: 'Private Logan Legal Name', active: true, archived: false, pickupEligible: true, aliases: [] },
    { id: 'p2', name: 'Private Morgan Legal Name', active: true, archived: false, pickupEligible: true, aliases: [] },
    { id: 'p3', name: 'Private Casey Legal Name', active: true, archived: false, pickupEligible: true, aliases: [] },
    { id: 'p4', name: 'Private Guest Legal Name', active: true, archived: false, pickupEligible: false, aliases: [] },
  ]);
  await mockWorker(page, state);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();

  const same = page.locator('[data-registration-entry="individual-same"]');
  await expect(same.locator('[data-registration-primary-label]')).toHaveText('Logan Public');
  await expect(same.locator('.registration-entry-secondary')).toHaveCount(0);
  await expect(same.locator('.registration-roster-group').filter({ hasText: 'Active roster' })).toHaveCount(0);
  await expect(same.locator('.registration-roster-group').filter({ hasText: 'Substitutes' })).toHaveCount(0);
  await expect(same).not.toContainText('Private Logan Legal Name');
  expect((await same.innerText()).match(/Logan Public/g)).toHaveLength(1);
  await expect(same.locator('.registration-entry-metadata')).toContainText('Individual registration');
  await expect(same.locator('.registration-entry-metadata')).toContainText('Submitted');
  await expect(same.locator('.registration-entry-metadata')).not.toContainText('Edited');
  await expect(same.getByRole('link', { name: '612-338-5747' })).toHaveAttribute('href', 'tel:6123385747');
  await expect(same.getByRole('link', { name: 'individual-same@example.com' })).toHaveAttribute('href', 'mailto:individual-same%40example.com');
  await expect(same).toContainText('Phone preferred');
  await expect(same.getByRole('button', { name: 'Edit contact' })).toBeVisible();
  await expect(same.getByRole('button', { name: 'Player profile' })).toBeVisible();

  const custom = page.locator('[data-registration-entry="individual-custom"]');
  await expect(custom.locator('[data-registration-primary-label]')).toHaveText('Morgan Public');
  await expect(custom.locator('.registration-entry-secondary')).toHaveText('Entry: Monday Night Entry');
  await expect(custom).toContainText('Jamie Contact');
  await expect(custom.locator('.registration-entry-metadata')).toContainText('Edited');
  await expect(custom.getByRole('heading')).toHaveCount(1);

  const unmatched = page.locator('[data-registration-entry="individual-unmatched"]');
  await expect(unmatched.locator('[data-registration-primary-label]')).toHaveText('Submitted Sam');
  await expect(unmatched).not.toContainText(/\b(?:undefined|null)\b/);
  await expect(unmatched.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
  await expect(unmatched.getByRole('button', { name: 'Player profile' })).toHaveCount(0);
  await expect(page.locator('[data-registration-entry="individual-same"] [data-registration-source-state="matched"]')).toHaveText('Matched');
  await expect(page.locator('[data-registration-entry="individual-created"] [data-registration-source-state="organizer-created"]')).toHaveText('Organizer created');
  await expect(page.locator('[data-registration-entry="individual-event-only"] [data-registration-source-state="event-only"]')).toHaveText('Event-only participant');
  await expect(unmatched.locator('[data-registration-source-state="unmatched"]')).toHaveText('Unmatched');

  const disclosure = same.locator('.registration-management-toggle'), panelId = await disclosure.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(`#${panelId}`)).toBeHidden();
  const beforeOpen = await disclosure.evaluate(button => {
    button.scrollIntoView({ block: 'center' });
    const sheet = button.closest('.sheet');
    return { sheetScroll: sheet.scrollTop, windowScroll: window.scrollY, bodyOverflow: getComputedStyle(document.body).overflow };
  });
  await disclosure.evaluate(button => button.click());
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  await expect(same.locator('#registration-status-individual-same')).toBeVisible();
  for (const action of ['Move Logan Public to substitutes', 'Unmatch Logan Public', 'Lock editing', 'Rotate management link', 'Revoke access']) {
    await expect(same.getByRole('button', { name: action, exact: true })).toBeVisible();
  }
  await expect.poll(() => page.evaluate(() => ({
    sheetScroll: document.querySelector('[data-registration-dashboard]').closest('.sheet').scrollTop,
    windowScroll: window.scrollY,
    bodyOverflow: getComputedStyle(document.body).overflow,
  }))).toEqual(beforeOpen);

  state.entries[0].revision++;
  await page.evaluate(() => EventRegistration.refresh('registration-event', { poll: true }));
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-registration-dashboard]').closest('.sheet').scrollTop)).toBe(beforeOpen.sheetScroll);

  await same.getByRole('button', { name: 'Revoke access', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  expect(state.managementPosts).toHaveLength(0);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.managementPosts).toHaveLength(0);
  await same.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect.poll(() => state.managementPosts).toEqual([{ entryId: 'individual-same', action: 'revoke' }]);
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(disclosure.locator('small')).toContainText('Access revoked');

  const layouts = [];
  for (const width of [1440, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 700 });
    layouts.push(await page.evaluate(() => {
      const root = document.querySelector('[data-registration-dashboard]'), sheet = root.closest('.sheet');
      const card = root.querySelector('[data-registration-entry="individual-same"]'), finalCard = root.querySelector('[data-registration-entry="individual-event-only"]');
      const contact = card.querySelector('.registration-contact-details'), toggle = card.querySelector('.registration-management-toggle');
      const actions = card.querySelector('.registration-organizer-actions'), footer = root.querySelector('[data-sheet-foot]');
      sheet.scrollTop = sheet.scrollHeight;
      return {
        width: innerWidth,
        sheetOverflow: sheet.scrollWidth - sheet.clientWidth,
        cardOverflow: card.scrollWidth - card.clientWidth,
        contactOverflow: contact.scrollWidth - contact.clientWidth,
        toggleHeight: toggle.getBoundingClientRect().height,
        managementColumns: getComputedStyle(actions).gridTemplateColumns.split(' ').length,
        finalCardClear: finalCard.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top + 1,
      };
    }));
  }
  expect(layouts.map(layout => layout.width)).toEqual([1440, 1024, 768, 430, 390]);
  expect(layouts.every(layout => layout.sheetOverflow <= 0 && layout.cardOverflow <= 0 && layout.contactOverflow <= 0)).toBe(true);
  expect(layouts.every(layout => layout.toggleHeight >= 44 && layout.finalCardClear)).toBe(true);
  expect(layouts.map(layout => layout.managementColumns)).toEqual([2, 2, 2, 1, 1]);
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
  await expect(page.locator('[data-registration-dashboard-actions]').getByRole('button', { name: 'Review import', exact: true })).toBeVisible();
  await page.locator('.registration-dashboard-more-actions > summary').click();
  for (const action of ['Event-day check-in', 'Settings', 'Share link', 'Copy link']) {
    await expect(page.locator('[data-registration-dashboard-actions]').getByRole('button', { name: action, exact: true })).toBeVisible();
  }
  await page.locator('.registration-dashboard-more-actions > summary').click();

  await page.locator('#registrationFilter').selectOption('pending');
  await expect(page.locator('[data-registration-entry]')).toHaveCount(1);
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toBeVisible();
  await page.locator('[data-registration-entry="entry-alpha"] .registration-management-toggle').click();
  await page.locator('[data-registration-entry="entry-alpha"] details[data-registration-disclosure="contact-notes"] > summary').click();
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
  await expect(page.locator('[data-registration-entry="entry-alpha"] .registration-management-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-registration-entry="entry-alpha"] details[data-registration-disclosure="contact-notes"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-registration-secondary-summary]')).toHaveAttribute('open', '');
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-registration-dashboard]').closest('.sheet').scrollTop)).toBe(interaction.scrollTop);

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const reviewSearch = page.getByRole('searchbox', { name: 'Search private roster' });
  await reviewSearch.fill('Alex');
  await expect(reviewSearch).toBeFocused();
  const reviewIdentity = await page.evaluate(() => {
    const root = document.querySelector('[data-registration-member-review]');
    const results = root.querySelector('[data-registration-member-results]');
    root.__identity = 'same-review';
    results.__identity = 'same-results';
    return { root: root.__identity, results: results.__identity };
  });
  await page.evaluate(() => EventRegistration.refresh('registration-event', { poll: true }));
  await expect(page.locator('[data-registration-member-review]')).toBeVisible();
  await expect(reviewSearch).toHaveValue('Alex');
  await expect(reviewSearch).toBeFocused();
  await expect(page.locator('[data-registration-member-review]')).not.toContainText(/\bundefined\b/);
  expect(await page.evaluate(() => ({
    root: document.querySelector('[data-registration-member-review]').__identity,
    results: document.querySelector('[data-registration-member-results]').__identity,
  }))).toEqual(reviewIdentity);
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
  const longEmail = 'alex.captain.with.a.very.long.registration.address@example-volleyball-club.com';
  state.entries[0].contact.email = longEmail;
  state.entries[1].substituteCount = 0;
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
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();

  const alpha = page.locator('[data-registration-entry="entry-alpha"]');
  await expect(alpha.locator('[data-registration-primary-label]')).toHaveText('Alpha Squad');
  await expect(alpha).toContainText('Captain / contact');
  await expect(alpha).toContainText('Active roster · 1');
  await expect(alpha).toContainText('New Player');
  await expect(alpha.locator('.registration-roster-group').filter({ hasText: 'Substitutes' })).toHaveCount(1);
  await expect(page.locator('[data-registration-entry="entry-bravo"] .registration-roster-group').filter({ hasText: 'Substitutes' })).toHaveCount(0);
  await expect(alpha).toContainText('Alex Captain');
  await expect(alpha.getByRole('link', { name: longEmail })).toHaveAttribute('href', `mailto:${encodeURIComponent(longEmail)}`);
  await expect(alpha.getByRole('link', { name: '(555) 555-0100' })).toHaveAttribute('href', 'tel:5555550100');
  await expect(alpha.getByRole('link', { name: longEmail })).toHaveClass(/registration-contact-link/);
  await expect(alpha.getByRole('link', { name: '(555) 555-0100' })).toHaveClass(/registration-contact-link/);
  const contactLinkStyles = await alpha.getByRole('link', { name: longEmail }).evaluate(link => {
    const style = getComputedStyle(link), card = link.closest('[data-registration-entry]');
    return {
      color: style.color,
      decoration: style.textDecorationLine,
      overflowWrap: style.overflowWrap,
      cardOverflow: card.scrollWidth - card.clientWidth,
    };
  });
  expect(contactLinkStyles.color).not.toBe('rgb(0, 0, 238)');
  expect(contactLinkStyles.decoration).toContain('underline');
  expect(contactLinkStyles.overflowWrap).toBe('anywhere');
  expect(contactLinkStyles.cardOverflow).toBeLessThanOrEqual(0);
  await alpha.getByRole('link', { name: longEmail }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(alpha.getByRole('link', { name: longEmail })).toHaveCSS('outline-style', 'solid');
  await expect(alpha).toContainText('Text preferred');
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
  await expect(page.locator('[data-registration-settings]')).toBeVisible();
  await expect(page.locator('#registrationCapacity')).toHaveValue('16');
  expect(await page.evaluate(() => eventRegistration(evts[0]))).toMatchObject({ enabled: false, status: 'closed', publicToken: null });
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('vb:events')))[0].registration).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Save registration' })).toBeEnabled();
});

test('registration settings save stays open, preserves interaction, prevents duplicates, and leaves X and Cancel as close controls', async ({ page }) => {
  const state = organizerState();
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: null, closesAt: null,
    activePlayerCapacity: 12, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: 10,
  };
  state.configDelayMs = 150;
  state.summary = canonicalSummary();
  await seed(page, [fixedEvent({ registration })]);
  await mockWorker(page, state);
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Registration settings' }).click();
  await page.locator('#registrationPublicDescription').fill('Keep these edited values after saving.');
  const before = await page.evaluate(() => {
    const root = document.querySelector('[data-registration-settings]'), sheet = root.closest('.sheet'), field = document.querySelector('#registrationPublicDescription');
    root.__identity = 'same-settings';
    sheet.style.maxHeight = '360px';
    sheet.scrollTop = Math.max(0, sheet.scrollHeight - sheet.clientHeight - 80);
    field.focus({ preventScroll: true });
    return { scrollTop: sheet.scrollTop, windowScroll: window.scrollY };
  });
  await page.evaluate(() => {
    void saveRegistrationSettings('registration-event');
    void saveRegistrationSettings('registration-event');
  });
  const save = page.getByRole('button', { name: 'Saving…' });
  await expect(save).toBeDisabled();
  await expect(page.locator('[data-registration-settings-success]')).toHaveText('Registration settings saved.');
  await expect(page.locator('[data-registration-settings]')).toBeVisible();
  await expect(page.locator('#registrationPublicDescription')).toHaveValue('Keep these edited values after saving.');
  await expect(page.locator('#registrationPublicDescription')).toBeFocused();
  expect(state.configPosts).toBe(1);
  expect(await page.evaluate(() => ({
    identity: document.querySelector('[data-registration-settings]').__identity,
    scrollTop: document.querySelector('[data-registration-settings]').closest('.sheet').scrollTop,
    windowScroll: window.scrollY,
    poll: EventRegistration.pollState,
  }))).toMatchObject({ identity: 'same-settings', scrollTop: before.scrollTop, windowScroll: before.windowScroll, poll: { scheduled: true } });

  const settings = page.locator('[data-registration-settings]');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(settings).toHaveCount(0);
  await page.getByRole('button', { name: 'Registration settings' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('[data-registration-settings]')).toHaveCount(0);
});

test('player match review uses deliberate fallbacks and never renders missing data as undefined', async ({ page }) => {
  const state = organizerState();
  const registration = {
    enabled: true, status: 'open', mode: 'team', opensAt: null, closesAt: null,
    activePlayerCapacity: 12, allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, requireOrganizerApproval: true,
    allowWaitlist: true, publicTitle: '', publicDescription: '', publicToken: TOKEN,
    publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: 10,
  };
  state.config = { ...registration, eventId: 'registration-event', eventName: 'Summer Sand', eventFormat: 'fixedTeams', effectiveStatus: 'open' };
  state.summary = canonicalSummary();
  await seed(page, [fixedEvent({ registration })]);
  await mockWorker(page, state);
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await expect(page.locator('[data-registration-entry="entry-alpha"]')).toBeVisible();
  await page.evaluate(() => {
    delete icons.search;
    const member = EventRegistration.get('registration-event').entries.find(entry => entry.id === 'entry-alpha').members.find(row => row.id === 'member-b');
    member.displayName = undefined;
    reviewRegistrationMember('entry-alpha', 'member-b');
  });
  const review = page.locator('[data-registration-member-review]');
  await expect(review).toBeVisible();
  await expect(review.getByRole('heading')).toHaveText('Review Roster member');
  await expect(review).not.toContainText(/\b(?:undefined|null|\[object Object\])\b/);
  await expect(review.getByRole('searchbox', { name: 'Search private roster' })).toBeVisible();
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
  await expect(dashboard.getByRole('button', { name: 'Review import', exact: true })).toBeVisible();
  await dashboard.locator('.registration-dashboard-more-actions > summary').click();
  await expect(dashboard.getByRole('button', { name: 'Event-day check-in', exact: true })).toBeVisible();
  await dashboard.locator('.registration-dashboard-more-actions > summary').click();
  await dashboard.locator('[data-registration-entry="entry-alpha"] .registration-management-toggle').click();
  const organizerLayouts = [];
  for (const width of [1440, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 700 });
    organizerLayouts.push(await page.evaluate(() => {
      const card = document.querySelector('[data-registration-entry="entry-alpha"]');
      const controls = card.querySelector('.registration-organizer-controls');
      const select = controls.querySelector('select'), actions = controls.querySelector('.registration-organizer-actions');
      const selectBox = select.getBoundingClientRect(), actionsBox = actions.getBoundingClientRect(), cardBox = card.getBoundingClientRect();
      return {
        width: innerWidth,
        controlsClass: controls.className,
        actionsClass: actions.className,
        gap: actionsBox.top - selectBox.bottom,
        selectInside: selectBox.left >= cardBox.left && selectBox.right <= cardBox.right + 1,
        actionsInside: actionsBox.left >= cardBox.left && actionsBox.right <= cardBox.right + 1 && actionsBox.bottom <= cardBox.bottom + 1,
        buttonHeights: [...actions.querySelectorAll('button')].map(button => button.getBoundingClientRect().height),
      };
    }));
  }
  expect(organizerLayouts.map(layout => layout.width)).toEqual([1440, 1024, 768, 430, 390]);
  expect(organizerLayouts.every(layout => layout.controlsClass.includes('registration-organizer-controls'))).toBe(true);
  expect(organizerLayouts.every(layout => layout.actionsClass.includes('registration-organizer-actions'))).toBe(true);
  expect(organizerLayouts.every(layout => layout.gap >= 10 && layout.selectInside && layout.actionsInside)).toBe(true);
  expect(organizerLayouts.every(layout => layout.buttonHeights.every(height => height >= 44))).toBe(true);
  await page.setViewportSize({ width: 375, height: 667 });
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
  await page.locator('#registrationWaitlist').uncheck();
  await page.locator('#registrationEnabled').uncheck();
  await expect(page.locator('#registrationApproval')).toBeDisabled();
  await expect(page.locator('#registrationApproval')).toBeChecked();
  await expect(page.locator('#registrationWaitlist')).toBeDisabled();
  await expect(page.locator('#registrationWaitlist')).not.toBeChecked();
  const disabledCheckboxes = await page.evaluate(() => ['registrationApproval', 'registrationWaitlist'].map(id => {
    const input = document.getElementById(id), control = input.nextElementSibling, row = input.closest('.court-checkbox-row');
    const inputBox = input.getBoundingClientRect(), controlBox = control.getBoundingClientRect(), style = getComputedStyle(input);
    return {
      checked: input.checked,
      inputWidth: inputBox.width,
      inputHeight: inputBox.height,
      inputOpacity: style.opacity,
      controlWidth: controlBox.width,
      controlHeight: controlBox.height,
      cursor: getComputedStyle(row).cursor,
    };
  }));
  expect(disabledCheckboxes).toEqual([
    { checked: true, inputWidth: 22, inputHeight: 22, inputOpacity: '0', controlWidth: 22, controlHeight: 22, cursor: 'not-allowed' },
    { checked: false, inputWidth: 22, inputHeight: 22, inputOpacity: '0', controlWidth: 22, controlHeight: 22, cursor: 'not-allowed' },
  ]);
  await page.locator('#registrationEnabled').check();
  await expect(page.getByRole('button', { name: 'Rotate link', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rotate link', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('old link will stop working immediately');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel registration', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel registration', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Existing entries remain');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
});
