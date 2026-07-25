import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const TOKEN = 'R'.repeat(43);
const WORKER = 'https://court-registration-mobile.example';
let PUBLIC_PAGE_HTML = '';

test.beforeAll(async () => {
  const workerSource = await readFile(`${process.cwd()}/cloudflare/court-sync-worker.js`, 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`)).default;
  const publicPageResponse = await worker.fetch(new Request(`https://court-sync.example/register/${TOKEN}`), {});
  PUBLIC_PAGE_HTML = await publicPageResponse.text();
});

const publicPlayers = [
  { internalPlayerId: 'p1', publicPlayerToken: 'A'.repeat(22), displayName: 'Alex Rivera' },
  { internalPlayerId: 'p2', publicPlayerToken: 'B'.repeat(22), displayName: 'Blair Chen' },
  { internalPlayerId: 'p3', publicPlayerToken: 'C'.repeat(22), displayName: 'Casey Morgan' },
  { internalPlayerId: 'p4', publicPlayerToken: 'D'.repeat(22), displayName: 'Devon Patel' },
  { internalPlayerId: 'p5', publicPlayerToken: 'E'.repeat(22), displayName: 'Emery Long Substitute Name That Wraps' },
];

function publicConfig(overrides = {}) {
  return {
    title: 'Mobile Sand Cup',
    eventDate: '2026-08-15',
    description: 'Four-player teams under the lights.',
    status: 'open',
    mode: 'team',
    opensAt: Date.now() - 1000,
    closesAt: Date.now() + 1000000,
    activePlayerCapacity: 12,
    allowSubstitutes: true,
    maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4,
    maxActivePlayersPerTeam: 4,
    allowWaitlist: true,
    capacity: {
      activePlayerCapacity: 12,
      acceptedActivePlayers: 0,
      remainingActivePlayers: 12,
      full: false,
    },
    ...overrides,
  };
}

async function mockPublicRegistration(page, { config = publicConfig(), failFirst = false, failureBody = null } = {}) {
  const state = { submissions: [], failFirst, failureBody };
  await page.route(`**/register/${TOKEN}`, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: PUBLIC_PAGE_HTML,
  }));
  await page.route(`**/api/event-registration/public/${TOKEN}**`, async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith('/players')) {
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase();
      const players = publicPlayers
        .filter(player => player.displayName.toLocaleLowerCase().includes(query))
        .map(({ publicPlayerToken, displayName }) => ({ publicPlayerToken, displayName }));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, players }) });
    }
    if (url.pathname.endsWith('/submissions')) {
      const body = request.postDataJSON();
      state.submissions.push(body);
      if (state.failFirst && state.submissions.length === 1) {
        return route.fulfill({
          status: state.failureBody ? 409 : 503,
          contentType: 'application/json',
          body: JSON.stringify(state.failureBody || { ok: false, code: 'REGISTRATION_UNAVAILABLE', message: 'Registration is temporarily unavailable.' }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          submission: {
            registrationId: 'Z'.repeat(22),
            teamName: body.teamName || body.displayName,
            status: 'accepted',
            activePlayerCount: body.members.filter(member => member.rosterRole === 'active').length,
            substituteCount: body.members.filter(member => member.rosterRole === 'substitute').length,
            managementUrl: `http://127.0.0.1:5173/event-registration/manage/${'M'.repeat(43)}`,
            warnings: [],
          },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, registration: config }),
    });
  });
  return state;
}

async function addPublicPlayer(page, player, role = 'active') {
  await page.getByRole('button', { name: role === 'active' ? 'Add active player' : 'Add substitute' }).click();
  await page.getByRole('searchbox', { name: 'Search Court players' }).fill(player.displayName.slice(0, 4));
  await page.getByRole('option', { name: player.displayName, exact: true }).click();
}

async function buildPublicRoster(page, { substitutes = 0 } = {}) {
  await page.locator('#team-name').fill('Mobile Net Results');
  for (const player of publicPlayers.slice(0, 4)) await addPublicPlayer(page, player);
  for (const player of publicPlayers.slice(4, 4 + substitutes)) await addPublicPlayer(page, player, 'substitute');
  await page.locator('#contact-name').fill('Morgan Captain');
  await page.locator('#contact-email').fill('morgan@example.com');
}

test('public team contact validates inline and survives review, back, and roster errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPublicRegistration(page);
  await page.goto(`/register/${TOKEN}`);
  await expect(page.getByRole('region', { name: 'Team contact' })).toContainText('Used only by the event organizer');
  await expect(page.getByText('Contact information is shared only with the event organizer and is not shown publicly.')).toBeVisible();
  await page.locator('#team-name').fill('Contact Team');
  for (const player of publicPlayers.slice(0, 4)) await addPublicPlayer(page, player);

  await page.getByRole('button', { name: 'Review and submit' }).click();
  await expect(page.locator('#contact-name')).toBeFocused();
  await expect(page.locator('#contact-name-error')).toHaveText('Enter a contact name.');
  await page.locator('#contact-name').fill('Taylor Captain');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await expect(page.locator('#contact-email-error')).toHaveText('Enter an email address or phone number.');
  await page.locator('#contact-email').fill('invalid-email');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await expect(page.locator('#contact-email-error')).toHaveText('Enter a valid email address.');
  await page.locator('#contact-email').fill('');
  await page.locator('#contact-phone').fill('extension only');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await expect(page.locator('#contact-phone-error')).toHaveText('Enter a phone number with at least one digit.');

  await page.locator('#contact-phone').fill('+1 (555) 555-0123 ext. 4');
  await expect(page.locator('#contact-method option[value="email"]')).toBeDisabled();
  await expect(page.locator('#contact-method option[value="phone"]')).toBeEnabled();
  await page.locator('#contact-method').selectOption('text');
  await page.locator('#contact-notes').fill('Please text after 5 PM.');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  const review = page.getByRole('dialog', { name: 'Review your team' });
  await expect(review.getByRole('region', { name: 'Team contact' })).toContainText('Taylor Captain');
  await expect(review.getByRole('region', { name: 'Team contact' })).toContainText('+1 (555) 555-0123 ext. 4');
  await expect(review.getByRole('region', { name: 'Team contact' })).toContainText('Preferred: Text');
  await expect(review.getByRole('region', { name: 'Team contact' })).toContainText('Please text after 5 PM.');
  await review.getByRole('button', { name: 'Back to edit' }).click();
  await expect(page.locator('#contact-name')).toHaveValue('Taylor Captain');
  await expect(page.locator('#contact-phone')).toHaveValue('+1 (555) 555-0123 ext. 4');
  await expect(page.locator('#contact-method')).toHaveValue('text');
  await expect(page.locator('#contact-notes')).toHaveValue('Please text after 5 PM.');
});

test('individual registration uses registrant contact labeling and accepts phone-only contact', async ({ page }) => {
  const state = await mockPublicRegistration(page, {
    config: publicConfig({
      mode: 'individual',
      allowSubstitutes: false,
      maxSubstitutesPerTeam: 0,
      minActivePlayersPerTeam: 1,
      maxActivePlayersPerTeam: 1,
    }),
  });
  await page.goto(`/register/${TOKEN}`);
  await expect(page.getByRole('region', { name: 'Registrant contact' })).toBeVisible();
  await page.locator('#team-name').fill('Jordan Entry');
  await addPublicPlayer(page, publicPlayers[0]);
  await page.locator('#contact-name').fill('Jordan Rivera');
  await page.locator('#contact-phone').fill('+61 2 5550 1234');
  await page.locator('#contact-method').selectOption('phone');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  const review = page.getByRole('dialog', { name: 'Review registration' });
  await expect(review.getByRole('region', { name: 'Registrant contact' })).toContainText('Jordan Rivera');
  await review.getByRole('button', { name: 'Submit registration' }).click();
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0]).toMatchObject({
    registrationType: 'individual',
    displayName: 'Jordan Entry',
    contact: { name: 'Jordan Rivera', email: '', phone: '+61 2 5550 1234', preferredMethod: 'phone', notes: '' },
  });
});

test('public review replaces native confirm, validates limits, survives retry, and submits exactly once per tap', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const state = await mockPublicRegistration(page, { failFirst: true });
  let nativeDialogs = 0;
  page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
  await page.goto(`/register/${TOKEN}`);

  await page.locator('#team-name').fill('Too Small');
  for (const player of publicPlayers.slice(0, 3)) await addPublicPlayer(page, player);
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await expect(page.getByText('Add at least 4 active players.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await addPublicPlayer(page, publicPlayers[3]);
  await page.locator('#contact-name').fill('Morgan Captain');
  await page.locator('#contact-email').fill('morgan@example.com');
  await page.getByRole('button', { name: 'Review and submit' }).click();
  const review = page.getByRole('dialog', { name: 'Review your team' });
  await expect(review).toContainText('Too Small');
  await expect(review).toContainText('4 active players · 0 substitutes');
  for (const player of publicPlayers.slice(0, 4)) await expect(review).toContainText(player.displayName);
  await expect(review.getByRole('button', { name: 'Submit registration' })).toBeInViewport();

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent === 'Submit registration');
    button.click();
    button.click();
  });
  await expect(review).toContainText('temporarily unavailable');
  expect(state.submissions).toHaveLength(1);
  await review.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByRole('heading', { name: 'Your team is registered' })).toBeVisible();
  expect(state.submissions).toHaveLength(2);
  expect(state.submissions[1].idempotencyKey).toBe(state.submissions[0].idempotencyKey);
  expect(nativeDialogs).toBe(0);
});

test('review separates substitutes, closes with focus restoration, reopens once, and fits 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockPublicRegistration(page);
  await page.goto(`/register/${TOKEN}`);
  await buildPublicRoster(page, { substitutes: 1 });
  const trigger = page.getByRole('button', { name: 'Review and submit' });
  await trigger.click();
  let review = page.getByRole('dialog', { name: 'Review your team' });
  await expect(review.getByRole('region', { name: 'Active roster' })).toContainText('Alex Rivera');
  await expect(review.getByRole('region', { name: 'Substitutes' })).toContainText(publicPlayers[4].displayName);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  review = page.getByRole('dialog', { name: 'Review your team' });
  await expect(review).toHaveCount(1);
  const metrics = await page.evaluate(() => {
    const dialog = document.querySelector('.review-dialog'), button = [...dialog.querySelectorAll('button')].find(node => node.textContent === 'Submit registration'), rect = button.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dialogOverflow: dialog.scrollWidth - dialog.clientWidth,
      buttonTop: rect.top,
      buttonBottom: rect.bottom,
      viewportHeight: innerHeight,
    };
  });
  expect(metrics.documentOverflow).toBeLessThanOrEqual(0);
  expect(metrics.dialogOverflow).toBeLessThanOrEqual(0);
  expect(metrics.buttonTop).toBeGreaterThanOrEqual(0);
  expect(metrics.buttonBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  await review.getByRole('button', { name: 'Back to edit' }).click();
  await page.getByRole('button', { name: `Move ${publicPlayers[4].displayName} to active players` }).click();
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await expect(page.getByText('Active roster cannot exceed 4.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('duplicate-player responses name every conflict safely and preserve the populated roster', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPublicRegistration(page, {
    failFirst: true,
    failureBody: {
      ok: false,
      code: 'PLAYER_ALREADY_REGISTERED',
      message: 'These players conflict.',
      conflicts: [
        { submittedName: 'Alex Rivera' },
        { submittedName: '<img src=x onerror=alert(1)>' },
      ],
    },
  });
  await page.goto(`/register/${TOKEN}`);
  await buildPublicRoster(page);
  await page.getByRole('button', { name: 'Review and submit' }).click();
  const review = page.getByRole('dialog', { name: 'Review your team' });
  await review.getByRole('button', { name: 'Submit registration' }).click();
  await expect(review.getByRole('alert')).toContainText('These players are already listed');
  await expect(review.getByRole('alert')).toContainText('• Alex Rivera');
  await expect(review.getByRole('alert')).toContainText('• <img src=x onerror=alert(1)>');
  await expect(review.locator('img')).toHaveCount(0);
  await expect(review.getByRole('alert')).toContainText('Remove the conflicting players');
  await review.getByRole('button', { name: 'Back to edit' }).click();
  await expect(page.locator('#team-name')).toHaveValue('Mobile Net Results');
  await expect(page.locator('#contact-name')).toHaveValue('Morgan Captain');
  await expect(page.locator('#contact-email')).toHaveValue('morgan@example.com');
  for (const player of publicPlayers.slice(0, 4)) await expect(page.locator('.member-row').filter({ hasText: player.displayName })).toBeVisible();
});

test('legacy duplicate error without structured conflicts remains useful', async ({ page }) => {
  await mockPublicRegistration(page, {
    failFirst: true,
    failureBody: {
      ok: false,
      code: 'PLAYER_ALREADY_REGISTERED',
      message: 'This player is already listed on another registration.',
    },
  });
  await page.goto(`/register/${TOKEN}`);
  await buildPublicRoster(page);
  await page.getByRole('button', { name: 'Review and submit' }).click();
  const review = page.getByRole('dialog', { name: 'Review your team' });
  await review.getByRole('button', { name: 'Submit registration' }).click();
  await expect(review.getByRole('alert')).toContainText('This player is already listed on another registration.');
  await expect(review.getByRole('alert')).toContainText('Your team and roster are still here');
});

test('mobile public submission flows through organizer refresh, accepted import preview, selection, and confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const publicState = await mockPublicRegistration(page);
  const localPlayers = publicPlayers.slice(0, 4).map(player => ({
    id: player.internalPlayerId,
    name: player.displayName,
    seedRating: 50,
    rating: 50,
    gamesPlayed: 0,
    trackedGames: 0,
    wins: 0,
    losses: 0,
    roles: {},
    lifetime: {},
    history: [{ i: 0, r: 50 }],
    notes: '',
    active: true,
    archived: false,
    pickupEligible: true,
    aliases: [],
  }));
  const registration = {
    enabled: true,
    status: 'open',
    mode: 'team',
    opensAt: Date.now() - 1000,
    closesAt: Date.now() + 1000000,
    activePlayerCapacity: 12,
    allowSubstitutes: true,
    maxSubstitutesPerTeam: 2,
    minActivePlayersPerTeam: 4,
    maxActivePlayersPerTeam: 4,
    requireOrganizerApproval: false,
    allowWaitlist: true,
    publicTitle: '',
    publicDescription: '',
    publicToken: TOKEN,
    publicUrl: `http://127.0.0.1:5173/register/${TOKEN}`,
    updatedAt: Date.now(),
  };
  const event = { id: 'event-import', name: 'Import Cup', eventDate: '2026-08-15', created: 1, done: false, format: 'fixedTeams', teams: [], brackets: [], registration };
  await page.addInitScript(({ event, players, workerUrl }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify([event]));
    localStorage.setItem('vb:settings', '{}');
    localStorage.setItem('vb:sync', JSON.stringify({ url: workerUrl, code: 'owner-room', on: true }));
  }, { event, players: localPlayers, workerUrl: WORKER });

  const organizer = { previewGets: 0, marks: [], imported: null };
  await page.route(`${WORKER}/**`, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const submitted = publicState.submissions[0];
    const entry = {
      id: 'Z'.repeat(22),
      eventId: 'event-import',
      registrationType: 'team',
      displayName: submitted?.teamName || 'Mobile Net Results',
      status: 'accepted',
      activePlayerCount: 4,
      substituteCount: 0,
      capacityOverride: false,
      revision: 1,
      createdAt: 100,
      submittedAt: 110,
      updatedAt: 110,
      imported: organizer.imported,
      members: publicPlayers.slice(0, 4).map((player, index) => ({
        id: `member-${index}`,
        rosterRole: 'active',
        displayName: player.displayName,
        matchStatus: 'matched',
        internalPlayerId: player.internalPlayerId,
        duplicateOverride: false,
      })),
    };
    const summary = {
      eventId: 'event-import',
      effectiveStatus: 'open',
      entryCounts: { draft: 0, submitted: 0, needsReview: 0, accepted: 1, waitlisted: 0, declined: 0, withdrawn: 0 },
      playerCounts: { acceptedActive: 4, acceptedSubstitutes: 0, pendingActive: 0, pendingSubstitutes: 0, waitlistedActive: 0, waitlistedSubstitutes: 0, totalSubstitutes: 0 },
      capacity: { activePlayerCapacity: 12, acceptedActivePlayers: 4, remainingActiveSpots: 8, isUnlimited: false },
      integration: { acceptedRegistrations: 1, importedRegistrations: organizer.imported ? 1 : 0, readyToImport: organizer.imported ? 0 : 1, blocked: 0, updatesAvailable: 0 },
      revision: 110,
      updatedAt: 110,
    };
    if (path === '/') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(request.method() === 'GET' ? { ts: 0, data: null } : { ok: true }) });
    if (path.endsWith('/import-preview')) {
      organizer.previewGets++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          eventId: 'event-import',
          config: { eventFormat: 'fixedTeams', mode: 'team', minActivePlayersPerTeam: 4, maxActivePlayersPerTeam: 4, allowSubstitutes: true, maxSubstitutesPerTeam: 2 },
          entries: [entry],
          summary,
          revision: 110,
          serverTime: Date.now(),
        }),
      });
    }
    if (path.endsWith('/import-mark')) {
      const body = request.postDataJSON();
      organizer.marks.push(body);
      organizer.imported = { localEntryId: body.localEntryId, importedRevision: body.importedRevision, importedAt: Date.now(), updatedAt: Date.now() };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, imported: organizer.imported }) });
    }
    if (path === '/api/event-registration/organizer/event-import' || path.endsWith('/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          configured: true,
          config: { ...registration, eventId: 'event-import', eventName: 'Import Cup', eventFormat: 'fixedTeams', effectiveStatus: 'open' },
          summary,
          capacity: { capacity: 12, acceptedEntries: 1, acceptedActivePlayers: 4, pendingEntries: 0, remainingAcceptedCapacity: 8 },
          ...(path.endsWith('/summary') ? {} : { entries: [entry] }),
          serverTime: Date.now(),
        }),
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`/register/${TOKEN}`);
  await buildPublicRoster(page);
  await page.getByRole('button', { name: 'Review and submit' }).click();
  await page.getByRole('button', { name: 'Submit registration' }).click();
  await expect(page.getByRole('heading', { name: 'Your team is registered' })).toBeVisible();

  await page.goto('/');
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.getByRole('button', { name: /Import Cup/ }).click();
  await page.getByRole('button', { name: 'Manage registrations' }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('dialog', { name: /Registration · Import Cup/ }).getByRole('button', { name: 'Review import' }).click();
  const candidate = page.locator('[data-import-registration]');
  await expect(candidate).toContainText('Mobile Net Results');
  await expect(candidate).toContainText('Alex Rivera');
  await expect(candidate).toContainText('Create new event entry');
  await page.getByRole('button', { name: 'Select ready' }).click();
  await page.getByRole('button', { name: /Review import · 1 create · 0 update/ }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('create 1 new event entry');
  await confirmation.getByRole('button', { name: 'Apply 1 import' }).click();
  await expect(candidate).toContainText('No change');
  expect(organizer.previewGets).toBeGreaterThanOrEqual(2);
  expect(organizer.marks).toHaveLength(1);
  const result = await page.evaluate(() => ({
    teams: evById('event-import').teams,
    games: games.length,
    ratings: players.map(player => player.rating),
  }));
  expect(result.teams).toHaveLength(1);
  expect(result.teams[0]).toMatchObject({ name: 'Mobile Net Results', players: ['p1', 'p2', 'p3', 'p4'], substitutePlayerIds: [] });
  expect(result.games).toBe(0);
  expect(result.ratings).toEqual([50, 50, 50, 50]);
});
