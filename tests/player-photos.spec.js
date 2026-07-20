import { test, expect } from '@playwright/test';

const WORKER = 'https://worker.test';
const ROOM = 'photo-room-secret';
const TOKEN = 'A'.repeat(43);
const SECOND_TOKEN = 'B'.repeat(43);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const photo = ({ token = TOKEN, revision = 'revision-1', public: isPublic = false, bytes = 24000 } = {}) => ({
  token,
  revision,
  contentType: 'image/webp',
  width: 512,
  height: 512,
  bytes,
  public: isPublic,
  updatedAt: 1721147120000
});

const player = (overrides = {}) => ({
  id: 'photo-player',
  name: 'Photo Player',
  seedRating: 61,
  rating: 64,
  gamesPlayed: 1,
  trackedGames: 1,
  wins: 1,
  losses: 0,
  history: [{ i: 0, r: 61 }, { i: 1, r: 64 }],
  lifetime: { ace: 1 },
  roles: { passer: true },
  active: true,
  archived: false,
  ...overrides
});

const game = {
  id: 'photo-game', date: 1, teamA: ['photo-player'], teamB: ['opponent'], scoreA: 25, scoreB: 20, winner: 'A', log: {}
};

async function seed(page, { players = [], games = [], sync = true } = {}) {
  await page.addInitScript(({ players, games, sync, worker, room }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
    if (sync) localStorage.setItem('vb:sync', JSON.stringify({ url: worker, code: room, on: false }));
  }, { players, games, sync, worker: WORKER, room: ROOM });
}

async function routes(page, handlers = {}) {
  const calls = { status: 0, uploads: [], gets: [], publicGets: [], patches: [], deletes: [] };
  await page.route(`${WORKER}/**`, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === '/api/player-photos/status') {
      calls.status++;
      if (handlers.available === false) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ available: false, error: 'player photo storage unavailable' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
    }
    if (request.method() === 'PUT' && path.startsWith('/api/player-photos/')) {
      const call = { path, headers: request.headers(), body: request.postDataBuffer() };
      calls.uploads.push(call);
      if (handlers.upload) return handlers.upload(route, call, calls);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, photo: photo() }) });
    }
    if (request.method() === 'GET' && path.startsWith('/api/player-photos/')) {
      calls.gets.push(path);
      if (handlers.get) return handlers.get(route, path, calls);
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'image/webp', ETag: '"photo-etag"' }, body: PNG });
    }
    if (request.method() === 'GET' && path.startsWith('/media/player-photos/')) {
      calls.publicGets.push(request.url());
      if (handlers.media) return handlers.media(route, path, calls);
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'image/webp', 'Access-Control-Allow-Origin': '*' }, body: PNG });
    }
    if (request.method() === 'PATCH' && path.startsWith('/api/player-photos/')) {
      const call = { path, body: request.postDataJSON() };
      calls.patches.push(call);
      if (handlers.patch) return handlers.patch(route, call, calls);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, photo: photo({ revision: 'visibility-2', public: call.body.public }) }) });
    }
    if (request.method() === 'DELETE' && path.startsWith('/api/player-photos/')) {
      calls.deletes.push(path);
      if (handlers.delete) return handlers.delete(route, path, calls);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  return calls;
}

async function openPlayers(page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Players', exact: true }).click();
}

async function openEditor(page, name = 'Photo Player') {
  await openPlayers(page);
  await page.locator('.player-card').filter({ hasText: name }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name, exact: true })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Edit player', exact: true })).toBeVisible();
}

async function preparePhoto(page) {
  await expect(page.locator('.sheet').getByRole('button', { name: /^(Add|Change) photo$/, exact: true })).toBeEnabled();
  await page.locator('#pPhotoInput').setInputFiles({ name: 'player.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('heading', { name: 'Crop player photo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use photo', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: /Add player|Edit player/ })).toBeVisible();
}

async function integrity(page) {
  return page.evaluate(() => ({
    player: (({ seedRating, rating, history, gamesPlayed, wins, losses }) => ({ seedRating, rating, history, gamesPlayed, wins, losses }))(players.find(p => p.id === 'photo-player')),
    games: JSON.parse(JSON.stringify(games))
  }));
}

function participantHtml() {
  const p = players.find(value => value.id === 'photo-player');
  const photos = publicPhotoItems([p.id], players);
  return participantScheduleBodyHtml({
    scope: 'participant', formatKind: 'fixed', eventName: 'Photo Cup', eventDate: 'July 20, 2026', startTime: null,
    exportTitle: 'Team Schedule', subjectLabel: 'Your Team', subjectName: 'Court One', subjectMembers: [p.name], subjectPhotos: photos,
    rows: [{ type: 'match', isBye: false, round: 1, time: null, court: 'Court 1', pool: null, opponent: { name: 'Court Two', players: [p.name], playerPhotos: photos }, result: null, label: null }],
    note: null, hasResults: false
  });
}

test('schedule photo URLs are relative on the Worker and absolute in preview, print, and downloaded HTML', async ({ page }) => {
  await seed(page, { players: [player({ photo: photo({ public: true }) }), player({ id: 'opponent', name: 'Opponent' })] });
  const calls = await routes(page);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const p = players.find(value => value.id === 'photo-player');
    const photos = publicPhotoItems([p.id], players);
    const model = {
      scope: 'participant', formatKind: 'fixed', eventName: 'Photo Cup', eventDate: 'July 20, 2026', startTime: null,
      exportTitle: 'Team Schedule', subjectLabel: 'Your Team', subjectName: 'Court One', subjectMembers: [p.name], subjectPhotos: photos,
      rows: [{ type: 'match', isBye: false, round: 1, time: null, court: 'Court 1', pool: null, opponent: { name: 'Court Two', players: ['Opponent'], playerPhotos: photos }, result: null, label: null }],
      note: null, hasResults: false
    };
    const preview = scheduleExportPreviewHtml(model);
    const worker = renderScheduleDocument(model);
    const print = renderScheduleDocument(model, { photoContext: PUBLIC_PHOTO_CONTEXTS.print });
    const download = await createScheduleHtmlFile(model).text();
    const fixedEvent = {
      id: 'photo-fixed', name: 'Full Photo Cup', teams: [
        { id: 't0', name: 'Team One', pool: 'A', players: [p.id] },
        { id: 't1', name: 'Team Two', pool: 'A', players: ['opponent'] },
        { id: 't2', name: 'Team Three', pool: 'A', players: [] },
        { id: 't3', name: 'Team Four', pool: 'A', players: [] }
      ], brackets: [], sched: { start: '18:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'photo-fixed', revision: 1 }
    };
    const fixed = deriveFullScheduleExportModel(fixedEvent, { gameList: [], playerList: players, now: new Date(2026, 6, 20, 17).getTime() });
    openSheet(preview);
    return { descriptor: publicPlayerPhoto(p), preview, worker, print, download, fixed, fixedPreview: scheduleExportPreviewHtml(fixed), fixedWorker: renderScheduleDocument(fixed) };
  });
  const relative = `/media/player-photos/${TOKEN}?v=revision-1`;
  const absolute = `${WORKER}${relative}`;
  expect(result.descriptor).toEqual({ name: 'Photo Player', photo: photo({ public: true }) });
  expect(result.worker).toContain(`src="${relative}"`);
  expect(result.worker).not.toContain(WORKER);
  const fixedSides = result.fixed.rounds.flatMap(round => round.matches.flatMap(match => [...match.sideA, ...match.sideB]));
  expect(fixedSides.find(side => side.name === 'Team One')).toMatchObject({ players: ['Photo Player'], playerPhotos: [result.descriptor] });
  expect(result.fixedPreview).toContain(`src="${absolute}"`);
  expect(result.fixedWorker).toContain(`src="${relative}"`);
  for (const html of [result.preview, result.print, result.download]) {
    expect(html).toContain(`src="${absolute}"`);
    expect(html).not.toContain('cheebychob.github.io/media/player-photos');
    expect(html).not.toContain(ROOM);
  }
  const image = page.locator('.sheet [data-public-player-photo] img').first();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', absolute);
  await expect.poll(() => calls.publicGets.length).toBeGreaterThan(0);
  expect(calls.publicGets.length).toBeLessThanOrEqual(2);
  expect(calls.publicGets.every(url => url === absolute)).toBe(true);
});

test('private, malformed, and failed shared-page photos stay on initials without broken images', async ({ page }) => {
  const malformed = { ...photo({ public: true }), token: 'not-valid!' };
  await seed(page, { players: [player({ photo: photo({ public: true }) }), player({ id: 'private', name: 'Private Person', photo: photo({ token: SECOND_TOKEN }) }), player({ id: 'bad', name: 'Bad Photo', photo: malformed })] });
  const calls = await routes(page, { media: route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }) });
  await page.goto('/');
  const data = await page.evaluate(() => {
    const publicPlayer = players.find(value => value.id === 'photo-player');
    const privatePlayer = players.find(value => value.id === 'private');
    const badPlayer = players.find(value => value.id === 'bad');
    const model = {
      scope: 'participant', formatKind: 'fixed', eventName: 'Fallback Cup', eventDate: '', startTime: null,
      exportTitle: 'Team Schedule', subjectLabel: 'Your Team', subjectName: 'Fallbacks', subjectMembers: [publicPlayer.name], subjectPhotos: publicPhotoItems([publicPlayer.id, privatePlayer.id, badPlayer.id], players),
      rows: [], note: null, hasResults: false
    };
    const preview = scheduleExportPreviewHtml(model);
    openSheet(preview);
    return { preview, privateDescriptor: publicPlayerPhoto(privatePlayer), badDescriptor: publicPlayerPhoto(badPlayer), storedBadPhoto: badPlayer.photo };
  });
  expect(data.privateDescriptor).toBeNull();
  expect(data.badDescriptor).toBeNull();
  expect(data.storedBadPhoto).toBeUndefined();
  expect(data.preview).not.toContain(SECOND_TOKEN);
  await expect.poll(() => calls.publicGets.length).toBe(1);
  const sharedPhoto = page.locator('.sheet [data-public-player-photo]').first();
  await expect(sharedPhoto.locator('img')).toBeHidden();
  await expect(sharedPhoto.locator('span')).toHaveText('PP');
  expect(await sharedPhoto.evaluate(element => element.querySelector('img').hasAttribute('src'))).toBe(false);
});

test('the large private photo viewer reuses its cached URL and restores focus on Escape', async ({ page }) => {
  await seed(page, { players: [player({ photo: photo() })] });
  const calls = await routes(page);
  await page.goto('/');
  await openPlayers(page);
  await expect.poll(() => calls.gets.length).toBe(1);
  await page.locator('.player-card').filter({ hasText: 'Photo Player' }).click();
  const trigger = page.locator('.sheet').getByRole('button', { name: 'View larger photo of Photo Player', exact: true });
  await trigger.click();
  const viewer = page.getByRole('dialog', { name: 'Photo of Photo Player', exact: true });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('img', { name: 'Large photo of Photo Player', exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Close photo viewer', exact: true })).toBeFocused();
  await viewer.getByRole('img', { name: 'Large photo of Photo Player', exact: true }).click();
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(viewer.getByRole('button', { name: 'Close photo viewer', exact: true })).toBeFocused();
  await viewer.getByRole('button', { name: 'Close photo viewer', exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('[data-player-photo-viewer]').click({ position: { x: 2, y: 2 } });
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(calls.gets).toHaveLength(1);

  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await expect(page.locator('.sheet').getByRole('button', { name: 'View larger photo of Photo Player', exact: true })).toBeVisible();
  await expect(page.locator('.sheet').getByRole('button', { name: 'Change photo', exact: true })).toBeVisible();
  await expect(page.locator('.sheet').getByText('Show this photo on shared pages', { exact: true })).toBeVisible();
});

test('photo capability is optional and legacy no-photo creation and initials remain unchanged', async ({ page }) => {
  await seed(page, { players: [player({ id: 'legacy-player', name: 'Legacy Initials', gamesPlayed: 0, history: undefined, photo: undefined })] });
  const calls = await routes(page, { available: false });
  await page.goto('/');
  await openPlayers(page);
  await expect(page.locator('.player-card').filter({ hasText: 'Legacy Initials' }).locator('.avatar-initials')).toHaveText('LI');
  await page.locator('main').getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add photo', exact: true })).toBeDisabled();
  await expect(page.getByText('Player photo storage is not set up on this sync service.')).toBeVisible();
  await page.getByPlaceholder('Player name').fill('No Photo Player');
  await page.locator('.sheet').getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.locator('.player-card').filter({ hasText: 'No Photo Player' })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:players')));
  expect(stored.find(p => p.name === 'No Photo Player').photo).toBeUndefined();
  expect(calls.status).toBe(1);
});

test('native selection opens a mobile-safe crop and stores only compressed metadata after upload', async ({ page }) => {
  await seed(page);
  const calls = await routes(page);
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL.bind(URL); window.__photoRevokes = [];
    URL.revokeObjectURL = value => { window.__photoRevokes.push(value); revoke(value); };
  });
  await page.goto('/');
  await openPlayers(page);
  await page.locator('main').getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.getByRole('button', { name: /Off$/ })).toBeDisabled();
  await preparePhoto(page);
  const prepared = await page.evaluate(() => ({
    isBlob: photoPrepared.blob instanceof Blob,
    type: photoPrepared.blob.type,
    size: photoPrepared.blob.size,
    square: photoPrepared.width === photoPrepared.height,
    max: photoPrepared.width <= 512,
    serialized: JSON.stringify(photoPrepared)
  }));
  expect(prepared).toMatchObject({ isBlob: true, square: true, max: true });
  expect(['image/webp', 'image/jpeg']).toContain(prepared.type);
  expect(prepared.size).toBeLessThanOrEqual(750 * 1024);
  expect(prepared.serialized).not.toMatch(/data:image|base64/i);
  await expect(page.getByRole('button', { name: /Off$/ })).toBeEnabled();
  await page.getByPlaceholder('Player name').fill('Uploaded Player');
  await page.locator('.sheet').getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Player added');
  expect(calls.uploads).toHaveLength(1);
  expect(calls.uploads[0].headers['content-type']).toMatch(/^image\/(webp|jpeg)$/);
  expect(calls.uploads[0].headers['x-photo-public']).toBe('0');
  expect(calls.uploads[0].body.byteLength).toBeLessThanOrEqual(750 * 1024);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vb:players')).find(p => p.name === 'Uploaded Player'));
  expect(stored.photo).toEqual(photo());
  expect(JSON.stringify(stored)).not.toMatch(/data:image|blob:|base64/i);
  expect(await page.evaluate(() => window.__photoRevokes.length)).toBeGreaterThanOrEqual(2);
});

test('crop controls fit the mobile sheet and cancelling revokes temporary object URLs', async ({ page }) => {
  await seed(page);
  await routes(page);
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL.bind(URL); window.__photoRevokes = [];
    URL.revokeObjectURL = value => { window.__photoRevokes.push(value); revoke(value); };
  });
  await page.goto('/');await openPlayers(page);await page.getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add photo', exact: true })).toBeEnabled();
  await page.locator('#pPhotoInput').setInputFiles({ name: 'player.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('heading', { name: 'Crop player photo' })).toBeVisible();
  const layout = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, sheet: document.querySelector('.sheet').scrollWidth, sheetClient: document.querySelector('.sheet').clientWidth }));
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.sheet).toBeLessThanOrEqual(layout.sheetClient);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add player' })).toBeVisible();
  expect(await page.evaluate(() => ({ crop: photoCrop, revokes: window.__photoRevokes.length }))).toEqual({ crop: null, revokes: 1 });
});

test('failed replacement preserves old metadata and every rating/history/game field', async ({ page }) => {
  await seed(page, { players: [player({ photo: photo() }), player({ id: 'opponent', name: 'Opponent', gamesPlayed: 1 })], games: [game] });
  await routes(page, { upload: route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'temporary photo outage' }) }) });
  await page.goto('/');const before = await integrity(page);await openEditor(page);await preparePhoto(page);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('temporary photo outage');
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Edit player', exact: true })).toBeVisible();
  const after = await integrity(page);
  expect(after).toEqual(before);
  expect(await page.evaluate(() => players.find(p => p.id === 'photo-player').photo)).toEqual(photo());
});

test('successful replacement changes revision, revokes stale cache, and fetches once per revision', async ({ page }) => {
  await seed(page, { players: [player({ photo: photo() })] });
  const calls = await routes(page, { upload: (route, call) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, photo: photo({ revision: 'revision-2' }) }) }) });
  await page.goto('/');await openPlayers(page);
  await expect.poll(() => calls.gets.length).toBe(1);
  await page.evaluate(() => render());
  await expect.poll(() => calls.gets.length).toBe(1);
  await page.locator('.player-card').filter({ hasText: 'Photo Player' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();await preparePhoto(page);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => calls.gets.length).toBe(2);
  expect(calls.uploads[0].headers['x-photo-token']).toBe(TOKEN);
  expect(await page.evaluate(() => players.find(p => p.id === 'photo-player').photo.revision)).toBe('revision-2');
  expect(await page.evaluate(() => PlayerPhotos._debug())).toEqual({ cache: 1, pending: 0 });
});

test('visibility and removal stay draft-only until Save; Worker failures preserve privacy and rating integrity', async ({ page }) => {
  let patchAttempt = 0;
  await seed(page, { players: [player({ photo: photo() }), player({ id: 'opponent', name: 'Opponent', gamesPlayed: 1 })], games: [game] });
  const calls = await routes(page, {
    patch: (route, call) => {
      patchAttempt++;
      if (patchAttempt === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'try later' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, photo: photo({ revision: 'visibility-2', public: call.body.public }) }) });
    }
  });
  await page.goto('/');const before = await integrity(page);await openEditor(page);
  const privateHtml = await page.evaluate(participantHtml);
  expect(privateHtml).not.toContain('/media/player-photos/');
  expect(privateHtml).not.toContain(TOKEN);
  await page.locator('.photo-public-line').getByRole('button', { name: /Off$/ }).click();
  expect(calls.patches).toHaveLength(0);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('try later');
  expect(await page.evaluate(() => players.find(p => p.id === 'photo-player').photo.public)).toBe(false);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Photo Player', exact: true })).toBeVisible();
  const publicHtml = await page.evaluate(participantHtml);
  expect(publicHtml).toContain(`/media/player-photos/${TOKEN}?v=visibility-2`);
  expect(publicHtml).toContain('<span aria-hidden="true">PP</span>');
  expect(publicHtml).not.toContain(ROOM);
  expect(publicHtml).not.toMatch(/roomHash|X-Court-Room|player-photos\/A{43}(?!\?v=)/);
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Remove photo', exact: true }).click();
  expect(await page.evaluate(() => players.find(p => p.id === 'photo-player').photo.public)).toBe(true);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.sheet').getByRole('heading', { name: 'Photo Player', exact: true })).toBeVisible();
  expect(await page.evaluate(() => players.find(p => p.id === 'photo-player').photo)).toBeUndefined();
  expect(await integrity(page)).toEqual(before);
  expect(calls.patches).toHaveLength(2);
  expect(calls.deletes).toEqual([`/api/player-photos/${TOKEN}`]);
});

test('archive/restore retains photos; malformed and missing photos fall back without repeated fetches', async ({ page }) => {
  const malformed = { ...photo({ token: SECOND_TOKEN }), contentType: 'image/svg+xml' };
  await seed(page, { players: [player({ photo: photo() }), player({ id: 'opponent', name: 'Opponent', gamesPlayed: 1 }), player({ id: 'malformed', name: 'Malformed Photo', gamesPlayed: 0, photo: malformed })], games: [game] });
  const calls = await routes(page, { get: route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }) });
  await page.goto('/');await openPlayers(page);
  await expect(page.locator('.player-card').filter({ hasText: 'Photo Player' }).locator('.avatar')).toHaveClass(/photo-unavailable/);
  expect(await page.evaluate(() => players.find(p => p.id === 'malformed').photo)).toBeUndefined();
  await expect(page.locator('.player-card').filter({ hasText: 'Malformed Photo' }).locator('.avatar-initials')).toHaveText('MP');
  await page.evaluate(() => { render(); render(); });
  await expect.poll(() => calls.gets.length).toBe(1);

  await page.locator('.player-card').filter({ hasText: 'Photo Player' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await page.getByRole('button', { name: 'Delete player', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Archive player', exact: true }).click();
  expect(await page.evaluate(() => ({ archived: players.find(p => p.id === 'photo-player').archived, photo: players.find(p => p.id === 'photo-player').photo }))).toEqual({ archived: true, photo: photo() });
  expect(calls.deletes).toHaveLength(0);
  await page.locator('.sheet').getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: /Archived · 1/ }).click();
  await page.locator('.player-card').filter({ hasText: 'Photo Player' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Edit profile', exact: true }).first().click();
  await page.getByRole('button', { name: 'Restore player', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(await page.evaluate(() => ({ archived: players.find(p => p.id === 'photo-player').archived, active: players.find(p => p.id === 'photo-player').active, photo: players.find(p => p.id === 'photo-player').photo }))).toEqual({ archived: false, active: true, photo: photo() });
});
