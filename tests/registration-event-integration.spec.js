import { test, expect } from '@playwright/test';

const WORKER = 'https://court-registration-integration.example';
const TOKEN = 'R'.repeat(43);

function player(id, name, pickupEligible = true) {
  return {
    id, name, seedRating: 50, rating: 50, gamesPlayed: 0, trackedGames: 0,
    wins: 0, losses: 0, roles: {}, lifetime: {}, history: [{ i: 0, r: 50 }],
    notes: '', active: true, archived: false, pickupEligible, aliases: [],
  };
}

function registration() {
  return {
    enabled: true, status: 'open', mode: 'team', opensAt: Date.now() - 1000,
    closesAt: Date.now() + 1000000, activePlayerCapacity: 12, allowSubstitutes: true,
    maxSubstitutesPerTeam: 2, minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2,
    requireOrganizerApproval: true, allowWaitlist: true, publicTitle: '', publicDescription: '',
    publicToken: TOKEN, publicUrl: `${WORKER}/register/${TOKEN}`, updatedAt: Date.now(),
  };
}

function event(overrides = {}) {
  return {
    id: 'event-import', name: 'Import Cup', eventDate: '2026-08-15', created: 1,
    done: false, format: 'fixedTeams', teams: [], brackets: [], registration: registration(),
    ...overrides,
  };
}

function importEntry(overrides = {}) {
  return {
    id: 'A'.repeat(22), eventId: 'event-import', registrationType: 'team',
    displayName: 'Net Results', status: 'accepted', activePlayerCount: 2, substituteCount: 1,
    capacityOverride: false, revision: 1, createdAt: 8, submittedAt: 9, updatedAt: 10, imported: null,
    members: [
      { id: 'm1', rosterRole: 'active', displayName: 'Alex', matchStatus: 'matched', internalPlayerId: 'p1', duplicateOverride: false },
      { id: 'm2', rosterRole: 'active', displayName: 'Blair', matchStatus: 'matched', internalPlayerId: 'p2', duplicateOverride: false },
      { id: 'm3', rosterRole: 'substitute', displayName: 'Casey', matchStatus: 'organizer_created', internalPlayerId: 'p3', duplicateOverride: false },
    ],
    ...overrides,
  };
}

function preview(entries = [importEntry()]) {
  return {
    ok: true, eventId: 'event-import',
    config: {
      eventFormat: 'fixedTeams', entrySize: null, teamSize: null, mode: 'team',
      minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2,
      allowSubstitutes: true, maxSubstitutesPerTeam: 2,
    },
    entries, revision: Math.max(1, ...entries.map(row => row.updatedAt || 0)), serverTime: Date.now(),
  };
}

async function seed(page, events = [event()], games = []) {
  await page.addInitScript(({ events, games, worker }) => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'p1', name: 'Alex', seedRating: 50, rating: 50, gamesPlayed: 0, trackedGames: 0, wins: 0, losses: 0, roles: {}, lifetime: {}, history: [{ i: 0, r: 50 }], notes: '', active: true, archived: false, pickupEligible: true, aliases: [] },
      { id: 'p2', name: 'Blair', seedRating: 50, rating: 50, gamesPlayed: 0, trackedGames: 0, wins: 0, losses: 0, roles: {}, lifetime: {}, history: [{ i: 0, r: 50 }], notes: '', active: true, archived: false, pickupEligible: true, aliases: [] },
      { id: 'p3', name: 'Casey', seedRating: 50, rating: 50, gamesPlayed: 0, trackedGames: 0, wins: 0, losses: 0, roles: {}, lifetime: {}, history: [{ i: 0, r: 50 }], notes: '', active: true, archived: false, pickupEligible: false, aliases: [] },
      { id: 'p4', name: 'Devon', seedRating: 50, rating: 50, gamesPlayed: 0, trackedGames: 0, wins: 0, losses: 0, roles: {}, lifetime: {}, history: [{ i: 0, r: 50 }], notes: '', active: true, archived: false, pickupEligible: true, aliases: [] },
    ]));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', '{}');
    localStorage.setItem('vb:sync', JSON.stringify({ url: worker, code: 'owner-room', on: true }));
  }, { events, games, worker: WORKER });
}

async function mockWorker(page, state) {
  await page.route(`${WORKER}/**`, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: request.method() === 'GET' ? JSON.stringify({ ts: 0, data: null }) : JSON.stringify({ ok: true }) });
    }
    if (path.endsWith('/import-preview')) {
      state.previewGets++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.preview) });
    }
    if (path.endsWith('/import-mark')) {
      const body = request.postDataJSON(), row = state.preview.entries.find(entry => entry.id === body.registrationId);
      state.marks.push(body);
      const now = Date.now();
      row.imported = { localEntryId: body.localEntryId, importedRevision: body.importedRevision, importedAt: row.imported?.importedAt || now, updatedAt: now };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, imported: row.imported }) });
    }
    if (path.endsWith('/import-reset')) {
      const body = request.postDataJSON(), row = state.preview.entries.find(entry => entry.id === body.registrationId);
      if (row) row.imported = null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, imported: null }) });
    }
    if (path === '/api/event-registration/organizer/event-import' || path === '/api/event-registration/organizer/event-import/summary') {
      const accepted = state.preview.entries.filter(row => row.status === 'accepted').length;
      const importedCount = state.preview.entries.filter(row => row.imported).length, canonicalSummary = {
        eventId: 'event-import', effectiveStatus: 'open',
        entryCounts: { draft: 0, submitted: 0, needsReview: 0, accepted, waitlisted: 0, declined: 0, withdrawn: 0 },
        playerCounts: { acceptedActive: 2, acceptedSubstitutes: 1, pendingActive: 0, pendingSubstitutes: 0, waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 1 },
        capacity: { activePlayerCapacity: 12, acceptedActivePlayers: 2, remainingActiveSpots: 10, isUnlimited: false },
        integration: { acceptedRegistrations: accepted, importedRegistrations: importedCount, readyToImport: Math.max(0, accepted - importedCount), blocked: 0, updatesAvailable: 0 },
        revision: state.preview.revision, updatedAt: state.preview.revision,
      };
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          ok: true, configured: true, config: { ...registration(), eventFormat: 'fixedTeams', eventId: 'event-import', effectiveStatus: 'open' },
          summary: canonicalSummary,
          capacity: { acceptedEntries: accepted, acceptedActivePlayers: 2, pendingEntries: 0, remainingAcceptedCapacity: 10 },
          ...(path.endsWith('/summary') ? {} : { entries: state.preview.entries }), serverTime: Date.now(),
        }),
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

async function openEvent(page) {
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.getByRole('button', { name: /Import Cup/ }).click();
}

test('compatibility and preview validation are format-aware, identity-based, and non-mutating', async ({ page }) => {
  await seed(page, []);
  await mockWorker(page, { preview: preview(), previewGets: 0, marks: [] });
  await page.goto('/');
  const result = await page.evaluate(() => {
    players = [
      makePlayer('Alex', 50), makePlayer('Blair', 50), makePlayer('Casey', 50), makePlayer('Devon', 50),
    ]; ['p1', 'p2', 'p3', 'p4'].forEach((id, index) => players[index].id = id);
    const fixed = { id: 'event-import', name: 'Fixed', created: 1, format: 'fixedTeams', teams: [], registration: { ...DEFAULT_EVENT_REGISTRATION, enabled: true, mode: 'team', status: 'open', minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2 } };
    const pair = getRegistrationImportCompatibility(fixed, { eventFormat: 'fixedTeams', mode: 'team', minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2 });
    const rotatingIndividual = { id: 'individual', format: 'rotatingGroups', rotation: { entrySize: 1, teamSize: 4 }, entries: [], teams: [], registration: { ...DEFAULT_EVENT_REGISTRATION, enabled: true, mode: 'individual', status: 'open' } };
    const rotatingGroups = { id: 'groups', format: 'rotatingGroups', rotation: { entrySize: 2, teamSize: 4 }, entries: [], teams: [], registration: { ...DEFAULT_EVENT_REGISTRATION, enabled: false, mode: 'disabled', status: 'closed' } };
    const ready = {
      ok: true, revision: 1, config: { eventFormat: 'fixedTeams', mode: 'team', minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2, allowSubstitutes: true, maxSubstitutesPerTeam: 1 },
      entries: [{
        id: 'reg-ready', eventId: 'event-import', registrationType: 'team', displayName: 'Ready', status: 'accepted', revision: 1,
        activePlayerCount: 2, substituteCount: 1, members: [
          { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p1' },
          { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p2' },
          { rosterRole: 'substitute', matchStatus: 'matched', internalPlayerId: 'p3' },
        ],
      }],
    };
    const before = JSON.stringify(fixed),readyPreview = registrationImportPreview(fixed, ready),after = JSON.stringify(fixed);
    const pending = structuredClone(ready);pending.entries[0].members[1].matchStatus = 'pending';pending.entries[0].members[1].internalPlayerId = null;
    const duplicate = structuredClone(ready);duplicate.entries.push({ ...structuredClone(ready.entries[0]), id: 'reg-other', displayName: 'Other', members: [
      { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p1', duplicateOverride: false },
      { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p4', duplicateOverride: false },
    ] });
    const source = {
      schemaVersion: 1, registrationId: 'reg-ready', sourceRevision: 1, importedAt: 10, lastSyncedAt: 10,
      sourceSnapshot: { name: 'Ready', activePlayerIds: ['p1', 'p2'], substitutePlayerIds: ['p3'], status: 'accepted' },
    };
    const local = { ...fixed, teams: [{ id: 'team-ready', name: 'Ready', players: ['p1', 'p2'], substitutePlayerIds: ['p3'], registrationSource: source }], registrationCheckIn: { entries: { 'reg-ready': { teamStatus: 'checked_in', activePlayerIds: ['p1', 'p2'], substitutePlayerIds: ['p3'], playerStatuses: { p1: 'present' }, replacements: [], updatedAt: 20 } }, updatedAt: 20 } };
    const olderDevice = { ...fixed, teams: [{ id: 'team-ready', name: 'Ready', players: ['p1', 'p2'] }] };
    const merged = mergeEventRecords(local, olderDevice, true);
    return {
      pair, individual: getRegistrationImportCompatibility(rotatingIndividual, { eventFormat: 'rotatingGroups', mode: 'individual' }),
      groups: getRegistrationImportCompatibility(rotatingGroups, { eventFormat: 'rotatingGroups', mode: 'team' }),
      ready: readyPreview.items[0], pending: registrationImportPreview(fixed, pending).items[0],
      duplicate: registrationImportPreview(fixed, duplicate).items.map(item => item.action),
      unchanged: before === after,
      mergedSource: merged.teams[0].registrationSource,
      mergedSubstitutes: merged.teams[0].substitutePlayerIds,
      mergedCheckIn: merged.registrationCheckIn.entries['reg-ready'],
      legacy: normalizeEventRegistrationIntegration({ id: 'legacy', format: 'fixedTeams', teams: [{ id: 'legacy-team', players: ['p1'] }] }),
    };
  });
  expect(result.pair).toMatchObject({ supported: true, importUnit: 'pair' });
  expect(result.individual).toMatchObject({ supported: true, importUnit: 'individual' });
  expect(result.groups.supported).toBe(false);
  expect(result.ready).toMatchObject({ action: 'create', blockers: [] });
  expect(result.pending.action).toBe('blocked');
  expect(result.pending.blockers.join(' ')).toMatch(/Resolve all/);
  expect(result.duplicate).toEqual(['blocked', 'blocked']);
  expect(result.unchanged).toBe(true);
  expect(result.mergedSource).toMatchObject({ registrationId: 'reg-ready', sourceRevision: 1 });
  expect(result.mergedSubstitutes).toEqual(['p3']);
  expect(result.mergedCheckIn).toMatchObject({ teamStatus: 'checked_in', activePlayerIds: ['p1', 'p2'] });
  expect(result.legacy.teams[0]).toMatchObject({ players: ['p1'], substitutePlayerIds: [] });
});

test('organizer import is idempotent, preserves stable IDs and substitutes, and updates only after review', async ({ page }) => {
  const state = { preview: preview(), previewGets: 0, marks: [] };
  await seed(page);
  await mockWorker(page, state);
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Review import' }).click();
  const candidate = page.locator('[data-import-registration]');
  await expect(candidate).toContainText('Create new event entry');
  await expect(candidate).toContainText('Submitted');
  await expect(candidate).toContainText('Active players · 2');
  await expect(candidate).toContainText('Alex, Blair');
  await expect(candidate).toContainText('Substitutes · 1');
  await expect(candidate).toContainText('Casey');
  await expect(candidate).toContainText('Registrant / contact');
  await page.getByRole('button', { name: 'Select ready' }).click();
  await page.getByRole('button', { name: /Review import · 1 create · 0 update/ }).click();
  await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Apply 1 import' }).click();
  await expect(page.locator('[data-import-registration]')).toContainText('No change');

  const first = await page.evaluate(() => {
    const ev = evById('event-import'), entry = ev.teams[0];
    return {
      count: ev.teams.length, id: entry.id, name: entry.name, players: entry.players,
      substitutes: entry.substitutePlayerIds, source: entry.registrationSource,
      ratings: players.map(row => row.rating), games: games.length,
    };
  });
  expect(first).toMatchObject({ count: 1, name: 'Net Results', players: ['p1', 'p2'], substitutes: ['p3'], games: 0 });
  expect(first.source).toMatchObject({ registrationId: 'A'.repeat(22), sourceRevision: 1 });
  expect(first.ratings).toEqual([50, 50, 50, 50]);
  expect(state.marks).toHaveLength(1);

  state.preview.entries[0].displayName = 'Net Results Updated';
  state.preview.entries[0].revision = 2;
  state.preview.entries[0].updatedAt = 20;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('[data-import-registration]')).toContainText('Update imported event entry');
  await expect(page.locator('[data-import-registration]')).toContainText('Team name');
  await page.locator('[data-import-registration] input[type="checkbox"]').check();
  await page.getByRole('button', { name: /Review import · 0 create · 1 update/ }).click();
  await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Apply 1 import' }).click();
  await expect(page.locator('[data-import-registration]')).toContainText('No change');
  const updated = await page.evaluate(() => {
    const entry = evById('event-import').teams[0];
    return { count: evById('event-import').teams.length, id: entry.id, name: entry.name, revision: entry.registrationSource.sourceRevision };
  });
  expect(updated).toEqual({ count: 1, id: first.id, name: 'Net Results Updated', revision: 2 });
  expect(state.marks).toHaveLength(2);
});

test('import cards render legacy-safe details, block incomplete records, preserve stable-ID selection, and remain usable at 320px', async ({ page }) => {
  const first = importEntry({
    substituteCount: 0,
    members: importEntry().members.slice(0, 2),
  });
  const second = importEntry({
    id: 'B'.repeat(22),
    displayName: 'Block Party',
    substituteCount: 0,
    members: [
      { id: 'm4', rosterRole: 'active', displayName: 'Casey', matchStatus: 'matched', internalPlayerId: 'p3', duplicateOverride: false },
      { id: 'm5', rosterRole: 'active', displayName: 'Devon', matchStatus: 'matched', internalPlayerId: 'p4', duplicateOverride: false },
    ],
  });
  const legacy = {
    id: 'C'.repeat(22),
    eventId: 'event-import',
    registrationType: 'team',
    teamName: 'Legacy Spikers',
    status: 'accepted',
    activePlayerCount: 2,
    substituteCount: 0,
    revision: 1,
    members: [],
    imported: null,
  };
  const state = { preview: preview([first, second, legacy]), previewGets: 0, marks: [] };
  await seed(page);
  await mockWorker(page, state);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await page.getByRole('dialog', { name: /Registration · Import Cup/ }).getByRole('button', { name: 'Review import' }).click();

  const cards = page.locator('[data-import-registration]');
  await expect(cards).toHaveCount(3);
  const legacyCard = page.locator(`[data-import-registration="${'C'.repeat(22)}"]`);
  await expect(legacyCard).toContainText('Legacy Spikers');
  await expect(legacyCard).toContainText('Submission time not recorded');
  await expect(legacyCard).toContainText('Roster details are unavailable');
  await expect(legacyCard.getByRole('checkbox')).toBeDisabled();

  const firstCheckbox = page.locator(`[data-import-registration="${'A'.repeat(22)}"] input[type="checkbox"]`);
  const secondCheckbox = page.locator(`[data-import-registration="${'B'.repeat(22)}"] input[type="checkbox"]`);
  await firstCheckbox.check();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(firstCheckbox).toBeChecked();
  await expect(secondCheckbox).not.toBeChecked();
  await page.getByRole('button', { name: 'Select ready' }).click();
  await expect(firstCheckbox).toBeChecked();
  await expect(secondCheckbox).toBeChecked();
  await expect(legacyCard.getByRole('checkbox')).not.toBeChecked();
  await expect(page.locator('.registration-import-selected')).toContainText('2 selected · 2 to create · 0 to update');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(firstCheckbox).not.toBeChecked();
  await expect(secondCheckbox).not.toBeChecked();
  await page.locator(`[data-import-registration="${'B'.repeat(22)}"] .registration-import-detail`).first().click();
  await expect(secondCheckbox).toBeChecked();

  const layout = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet'), title = document.querySelector('.registration-import-title');
    return {
      sheetOverflow: sheet.scrollWidth - sheet.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titleColor: getComputedStyle(title).color,
    };
  });
  expect(layout.sheetOverflow).toBeLessThanOrEqual(0);
  expect(layout.documentOverflow).toBeLessThanOrEqual(0);
  expect(layout.titleColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await page.getByRole('dialog', { name: /Registration · Import Cup/ }).getByRole('button', { name: 'Review import' }).click();
  await expect(page.locator('[data-import-registration]')).toHaveCount(3);
});

test('schedule/game warnings preserve history and manual local conflicts block destructive updates', async ({ page }) => {
  const imported = event({
    sched: { start: '09:00', courts: 1, setMin: 20, matchMin: 45, breakMin: 10, seed: 'seed', revision: 1 },
    teams: [{
      id: 'stable-team', name: 'Net Results', players: ['p1', 'p2'], substitutePlayerIds: ['p3'],
      registrationSource: {
        schemaVersion: 1, registrationId: 'A'.repeat(22), sourceRevision: 1, importedAt: 10, lastSyncedAt: 10,
        sourceSnapshot: { name: 'Net Results', activePlayerIds: ['p1', 'p2'], substitutePlayerIds: ['p3'], status: 'accepted' },
      },
    }, { id: 'opponent', name: 'Opponent', players: ['p4'] }],
  });
  const games = [{ id: 'game-1', date: 10, teamA: ['p1', 'p2'], teamB: ['p4'], scoreA: 21, scoreB: 18, winner: 'A', log: {}, evId: 'event-import', evA: 'stable-team', evB: 'opponent' }];
  const changed = importEntry({ displayName: 'Server Rename', revision: 2, updatedAt: 20, imported: { localEntryId: 'stable-team', importedRevision: 1, importedAt: 10, updatedAt: 10 } });
  await seed(page, [imported], games);
  await mockWorker(page, { preview: preview([changed]), previewGets: 0, marks: [] });
  await page.goto('/');
  const safe = await page.evaluate(() => registrationImportPreview(evById('event-import'), {
    config: { eventFormat: 'fixedTeams', mode: 'team', minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2, allowSubstitutes: true, maxSubstitutesPerTeam: 2 },
    entries: [{
      id: 'A'.repeat(22), eventId: 'event-import', registrationType: 'team', displayName: 'Server Rename', status: 'accepted', revision: 2,
      members: [
        { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p1' },
        { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p2' },
        { rosterRole: 'substitute', matchStatus: 'matched', internalPlayerId: 'p3' },
      ],
    }],
  }).items[0]);
  expect(safe.action).toBe('update');
  expect(safe.warnings.join(' ')).toMatch(/schedule exists|Logged games/);
  const historicalBefore = await page.evaluate(() => JSON.stringify(games[0]));
  await page.evaluate(() => { evById('event-import').teams[0].players = ['p1', 'p4']; });
  const blocked = await page.evaluate(() => registrationImportPreview(evById('event-import'), {
    config: { eventFormat: 'fixedTeams', mode: 'team', minActivePlayersPerTeam: 2, maxActivePlayersPerTeam: 2, allowSubstitutes: true, maxSubstitutesPerTeam: 2 },
    entries: [{
      id: 'A'.repeat(22), eventId: 'event-import', registrationType: 'team', displayName: 'Server Rename', status: 'accepted', revision: 2,
      members: [
        { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p1' },
        { rosterRole: 'active', matchStatus: 'matched', internalPlayerId: 'p2' },
        { rosterRole: 'substitute', matchStatus: 'matched', internalPlayerId: 'p3' },
      ],
    }],
  }).items[0]);
  expect(blocked.action).toBe('blocked');
  expect(blocked.blockers.join(' ')).toMatch(/changed manually/);
  expect(await page.evaluate(() => JSON.stringify(games[0]))).toBe(historicalBefore);
});

test('a failed import persistence rolls back the complete event entry and schedule-review state atomically', async ({ page }) => {
  const imported = event({
    sched: { start: '09:00', courts: 1, setMin: 20, matchMin: 45, breakMin: 10, seed: 'stable-seed', revision: 1 },
    teams: [{
      id: 'stable-team',
      name: 'Net Results',
      players: ['p1', 'p2'],
      substitutePlayerIds: ['p3'],
      registrationSource: {
        schemaVersion: 1,
        registrationId: 'A'.repeat(22),
        sourceRevision: 1,
        importedAt: 10,
        lastSyncedAt: 10,
        sourceSnapshot: { name: 'Net Results', activePlayerIds: ['p1', 'p2'], substitutePlayerIds: ['p3'], status: 'accepted' },
      },
    }],
  });
  const changed = importEntry({
    displayName: 'Renamed Registration',
    revision: 2,
    updatedAt: 20,
    imported: { localEntryId: 'stable-team', importedRevision: 1, importedAt: 10, updatedAt: 10 },
  });
  await seed(page, [imported]);
  await mockWorker(page, { preview: preview([changed]), previewGets: 0, marks: [] });
  await page.goto('/');
  const result = await page.evaluate(async server => {
    const ev = evById('event-import'), item = registrationImportPreview(ev, server).items[0], before = JSON.stringify(ev), originalSave = saveEvents;
    let message = '';
    saveEvents = async () => { throw new Error('Persistence failed'); };
    try { await applyRegistrationImportItem(ev, item); }
    catch (error) { message = error.message; }
    finally { saveEvents = originalSave; }
    return { message, unchanged: JSON.stringify(ev) === before };
  }, preview([changed]));
  expect(result).toEqual({ message: 'Persistence failed', unchanged: true });
});

test('event-day arrival, substitute promotion, and existing or event-only replacements persist separately on mobile', async ({ page }) => {
  const imported = event({
    teams: [{
      id: 'stable-team', name: 'Net Results', players: ['p1', 'p2'], substitutePlayerIds: ['p3'],
      registrationSource: {
        schemaVersion: 1, registrationId: 'A'.repeat(22), sourceRevision: 1, importedAt: 10, lastSyncedAt: 10,
        sourceSnapshot: { name: 'Net Results', activePlayerIds: ['p1', 'p2'], substitutePlayerIds: ['p3'], status: 'accepted' },
      },
    }],
  });
  await seed(page, [imported]);
  await mockWorker(page, { preview: preview(), previewGets: 0, marks: [] });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await openEvent(page);
  await page.getByRole('button', { name: 'Event-day check-in' }).click();
  await expect(page.locator('[data-event-day-check-in]')).toBeVisible();
  await page.getByLabel('Arrival status for Net Results').selectOption('checked_in');
  await page.getByRole('button', { name: 'Promote Casey' }).click();
  await page.getByRole('button', { name: 'Add replacement' }).click();
  await page.getByRole('button', { name: 'Devon' }).click();
  await page.getByRole('button', { name: 'Add replacement' }).click();
  await page.getByRole('button', { name: 'Create event-only replacement' }).click();
  await expect(page.locator('#pPickupEligible')).not.toBeChecked();
  await page.locator('#pName').fill('Event Guest');
  await page.getByRole('button', { name: 'Add player' }).click();
  const state = await page.evaluate(() => {
    const ev = evById('event-import'), row = ev.registrationCheckIn.entries['A'.repeat(22)];
    const eventGuest = players.find(player => player.name === 'Event Guest');
    return {
      teamPlayers: ev.teams[0].players, teamSubstitutes: ev.teams[0].substitutePlayerIds,
      source: ev.teams[0].registrationSource.sourceSnapshot, checkIn: row,
      eventGuest: eventGuest && { id: eventGuest.id, pickupEligible: eventGuest.pickupEligible },
      overflow: document.querySelector('.sheet').scrollWidth - document.querySelector('.sheet').clientWidth,
    };
  });
  expect(state.teamPlayers).toEqual(['p1', 'p2']);
  expect(state.teamSubstitutes).toEqual(['p3']);
  expect(state.source).toMatchObject({ activePlayerIds: ['p1', 'p2'], substitutePlayerIds: ['p3'] });
  expect(state.eventGuest).toEqual({ id: expect.any(String), pickupEligible: false });
  expect(state.checkIn.activePlayerIds).toEqual(['p1', 'p2', 'p3', 'p4', state.eventGuest.id]);
  expect(state.checkIn.replacements).toEqual([
    expect.objectContaining({ playerId: 'p4' }),
    expect.objectContaining({ playerId: state.eventGuest.id }),
  ]);
  expect(state.overflow).toBeLessThanOrEqual(0);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:events'))[0].registrationCheckIn.entries['A'.repeat(22)]);
  expect(restored.activePlayerIds).toEqual(['p1', 'p2', 'p3', 'p4', state.eventGuest.id]);
});
