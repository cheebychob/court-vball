import { test, expect } from '@playwright/test';

const WORKER_URL = 'https://court-sync.joshsven92.workers.dev';
const WORKER_ROUTE = /^https:\/\/court-sync\.joshsven92\.workers\.dev\/.*/;

function players(count = 16) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}`, seedRating: 50, active: true, archived: false, roles: {} }));
}

function fixedEvent(id = 'fixed-public', extra = {}) {
  return {
    id, name: 'Public Link Cup', eventDate: '2026-07-16', created: 1, done: false, format: 'fixedTeams',
    teams: Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, name: `Team ${i + 1}`, pool: 'A', players: [`p${i}`] })),
    sched: { start: '10:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'public-seed', revision: 1 },
    brackets: [], ...extra
  };
}

function rotatingEvent() {
  return {
    id: 'rotating-public', name: 'Public Rotation', eventDate: '2026-07-17', created: 2, done: false, format: 'rotatingGroups', teams: [], brackets: [],
    entries: Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Entry ${i + 1}`, players: [`p${i}`], manualSeed: i + 1 })),
    rotation: { entrySize: 1, teamSize: 2, rounds: 3, courts: 2, seedMode: 'manual', start: '09:00', setMin: 20, matchMin: 45, breakMin: 10, winPoints: 1, tiePoints: .5, lossPoints: 0, seed: 'public-rotation-seed', revision: 1 },
    rotationSchedule: []
  };
}

async function seed(page, { events = [fixedEvent()], sync = true } = {}) {
  await page.addInitScript(({ roster, events, sync, workerUrl }) => {
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false }));
    if (sync) localStorage.setItem('vb:sync', JSON.stringify({ url: workerUrl, code: 'private-room-secret', on: false }));
  }, { roster: players(), events, sync, workerUrl: WORKER_URL });
}

function publicWorkerState() {
  return { mode: 'ready', counter: 0, requests: [], records: new Map(), deletes: 0 };
}

async function mockPublicWorker(page, state, hooks = {}) {
  await page.route(WORKER_ROUTE, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === '/api/public-schedules/status') {
      if (state.mode === 'offline') { await route.abort('failed'); return; }
      if (state.mode === 'old') { await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'missing room' }) }); return; }
      if (state.mode === 'missing') { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ available: false, error: 'public schedule storage unavailable' }) }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) }); return;
    }
    if (path === '/api/public-schedules' && request.method() === 'POST') {
      if (hooks.beforeCreate) await hooks.beforeCreate(request);
      const body = JSON.parse(request.postData() || '{}'), index = ++state.counter;
      const token = `${String.fromCharCode(64 + ((index - 1) % 26) + 1).repeat(42)}${index % 10}`;
      const managementToken = `${String.fromCharCode(90 - ((index - 1) % 20)).repeat(42)}${index % 10}`;
      const now = 1_721_147_120_000 + index;
      const record = { token, managementToken, url: `${WORKER_URL}/s/${token}`, html: body.html, title: body.title, contentHash: body.contentHash, scope: body.scope, createdAt: now, updatedAt: now, disabledAt: null };
      state.records.set(token, record);state.requests.push({ method: 'POST', path, headers: request.headers(), body });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ token, managementToken, url: record.url, publishedAt: now, updatedAt: now }) });return;
    }
    const management = path.match(/^\/api\/public-schedules\/([^/]+)$/);
    if (management && request.method() === 'PUT') {
      if (hooks.beforeUpdate) await hooks.beforeUpdate(request);
      const record = state.records.get(management[1]);
      if (!record) { await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'publication not found' }) }); return; }
      if (request.headers()['x-management-token'] !== record.managementToken) { await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'management authorization failed' }) }); return; }
      const body = JSON.parse(request.postData() || '{}'), updatedAt = record.updatedAt + 100;
      Object.assign(record, body, { updatedAt });state.requests.push({ method: 'PUT', path, headers: request.headers(), body });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: record.token, url: record.url, publishedAt: record.createdAt, updatedAt }) });return;
    }
    if (management && request.method() === 'DELETE') {
      const record = state.records.get(management[1]);
      if (!record) { await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'publication not found' }) }); return; }
      if (request.headers()['x-management-token'] !== record.managementToken) { await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'management authorization failed' }) }); return; }
      const disabledAt = record.updatedAt + 100;Object.assign(record, { disabledAt, updatedAt: disabledAt });state.deletes++;state.requests.push({ method: 'DELETE', path, headers: request.headers(), body: null });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, disabledAt, updatedAt: disabledAt }) });return;
    }
    if (path.startsWith('/s/')) {
      const record = state.records.get(path.slice(3));
      await route.fulfill({ status: record?.disabledAt ? 410 : record ? 200 : 404, contentType: 'text/html', body: record?.disabledAt ? '<h1>Disabled</h1>' : record?.html || '<h1>Missing</h1>' });return;
    }
    if (request.method() === 'GET' && url.searchParams.has('room')) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ts: 0, data: null }) });return; }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

async function openFullShare(page, eventId = 'fixed-public') {
  await page.evaluate(id => openScheduleShare(id), eventId);
  await expect(page.locator('.public-schedule-panel')).toBeVisible();
}

test('full publication lifecycle reuses exact renderer output, detects staleness, keeps its URL, and disables safely', async ({ page }) => {
  const state = publicWorkerState();await seed(page);await mockPublicWorker(page, state);await page.goto('/');
  await openFullShare(page);
  const panel = page.locator('.public-schedule-panel');
  await expect(panel).toContainText('No public link has been created yet');
  const expectedHtml = await page.evaluate(() => renderScheduleDocument(deriveFullScheduleExportModel(evById('fixed-public'))));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await panel.getByRole('button', { name: 'Create Share Link', exact: true }).click();
  await expect(panel).toContainText('Up to date');
  const first = state.requests.find(request => request.method === 'POST');
  expect(Object.keys(first.body).sort()).toEqual(['contentHash', 'html', 'scope', 'title']);
  expect(first.body.html).toBe(expectedHtml);
  expect(first.body.title).toBe('Public Link Cup · Full schedule');
  expect(first.body.html).toContain(`<title>${first.body.title}</title>`);
  expect(first.body.scope).toBe('full');
  expect(first.headers['x-court-room']).toBe('private-room-secret');
  expect(JSON.stringify(first.body)).not.toContain('private-room-secret');
  for (const forbidden of ['players', 'games', 'events', 'ratings', 'seedRating', 'history', 'notes', 'settings', 'deletions']) expect(first.body).not.toHaveProperty(forbidden);
  const firstUrl = await panel.getByLabel('Public schedule URL').inputValue();
  const stored = await page.evaluate(() => evById('fixed-public').schedulePublications.full);
  expect(stored).toMatchObject({ scope: 'full', publicUrl: firstUrl, status: 'active', subjectType: 'full' });
  expect(stored).not.toHaveProperty('html');
  expect(JSON.stringify(stored)).not.toContain('<!DOCTYPE html>');
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(3);

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => { evById('fixed-public').name = 'Public Link Cup Updated'; await saveEvents(); });
  await openFullShare(page);
  await expect(panel).toContainText('Schedule changed since publication');
  await panel.getByRole('button', { name: 'Update Published Link', exact: true }).click();
  await expect(panel).toContainText('Up to date');
  expect(await panel.getByLabel('Public schedule URL').inputValue()).toBe(firstUrl);
  const update = state.requests.find(request => request.method === 'PUT');
  expect(Object.keys(update.body).sort()).toEqual(['contentHash', 'html', 'title']);
  expect(update.body.html).toContain('Public Link Cup Updated');
  expect(update.body.title).toBe('Public Link Cup Updated · Full schedule');
  expect(update.body.html).toContain(`<title>${update.body.title}</title>`);
  expect(update.headers).not.toHaveProperty('x-court-room');

  await panel.getByRole('button', { name: 'Disable Link', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('downloaded HTML and PDFs are unaffected');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel.getByLabel('Public schedule URL')).toHaveValue(firstUrl);
  expect(state.deletes).toBe(0);
  await panel.getByRole('button', { name: 'Disable Link', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disable Link', exact: true }).click();
  await expect(panel).toContainText('This link is disabled');
  await expect(panel.getByLabel('Public schedule URL')).toHaveCount(0);
  expect(state.deletes).toBe(1);
  await panel.getByRole('button', { name: 'Create New Link', exact: true }).click();
  await expect(panel).toContainText('Up to date');
  expect(await panel.getByLabel('Public schedule URL').inputValue()).not.toBe(firstUrl);
  expect(state.records.get(firstUrl.split('/').pop()).disabledAt).toBeTruthy();
});

test('full, team, and rotating participant publications are independent and contain only their existing export scope', async ({ page }) => {
  const state = publicWorkerState();await seed(page, { events: [fixedEvent(), rotatingEvent()] });await mockPublicWorker(page, state);await page.goto('/');
  await page.evaluate(async () => { const ev=evById('rotating-public');ev.rotationSchedule=generateRotationScheduleData(ev).matches;await saveEvents(); });

  await openFullShare(page);await page.getByRole('button', { name: 'Create Share Link', exact: true }).click();await expect(page.locator('.public-schedule-panel')).toContainText('Up to date');await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => openParticipantScheduleShare('fixed-public','team','t0'));
  await page.locator('.public-schedule-panel').getByRole('button', { name: 'Create Share Link', exact: true }).click();await expect(page.locator('.public-schedule-panel')).toContainText('Up to date');await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => openParticipantScheduleShare('rotating-public','entry','e0'));
  await page.locator('.public-schedule-panel').getByRole('button', { name: 'Create Share Link', exact: true }).click();await expect(page.locator('.public-schedule-panel')).toContainText('Up to date');

  const creates = state.requests.filter(request => request.method === 'POST');
  expect(creates.map(request => request.body.scope)).toEqual(['full', 'team:t0', 'entry:e0']);
  expect(creates.map(request => request.body.title)).toEqual(['Public Link Cup · Full schedule', 'Public Link Cup · Team 1 schedule', 'Public Rotation · Player 1 schedule']);
  for (const request of creates) expect(request.body.html).toContain(`<title>${request.body.title}</title>`);
  expect(creates[0].body.html).toContain('<body><article class="schedule-document">');expect(creates[0].body.html).not.toContain('<body><article class="schedule-document participant-document">');
  expect(creates[1].body.html).toContain('<body><article class="schedule-document participant-document">');expect(creates[1].body.html).toContain('Your Team');expect(creates[1].body.html).not.toContain('<section class="schedule-round"');
  expect(creates[2].body.html).toContain('<body><article class="schedule-document participant-document">');expect(creates[2].body.html).toContain('Participant Schedule');expect(creates[2].body.html).toContain('Your Entry');
  const metadata = await page.evaluate(() => ({ fixed: evById('fixed-public').schedulePublications, rotating: evById('rotating-public').schedulePublications }));
  expect(Object.keys(metadata.fixed).sort()).toEqual(['full', 'team:t0']);
  expect(Object.keys(metadata.rotating)).toEqual(['entry:e0']);

  const fullBefore = JSON.stringify(metadata.fixed.full);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => { evById('fixed-public').teams[0].name='Team 1 Renamed';await saveEvents();openParticipantScheduleShare('fixed-public','team','t0'); });
  await expect(page.locator('.public-schedule-panel')).toContainText('Schedule changed since publication');
  await page.locator('.public-schedule-panel').getByRole('button', { name: 'Update Published Link', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(evById('fixed-public').schedulePublications.full))).toBe(fullBefore);
});

test('capability errors distinguish missing setup, old Worker, missing binding, and offline service', async ({ page }) => {
  const state = publicWorkerState();await seed(page, { sync: false });await mockPublicWorker(page, state);await page.goto('/');await openFullShare(page);
  const create = page.locator('.public-schedule-panel').getByRole('button', { name: 'Create Share Link', exact: true });
  await create.click();await expect(page.locator('#toast')).toHaveText('Set up device sync in Settings before creating a public schedule link.');
  await page.evaluate(async url => { await Store.set('vb:sync',JSON.stringify({url,code:'private-room-secret',on:false}));await Sync.init(); }, WORKER_URL);
  for (const [mode, message] of [
    ['old','Public schedule links are not available on the configured sync service yet.'],
    ['missing','Public schedule storage is unavailable on the configured sync service. Confirm the PUBLIC_SCHEDULES binding.'],
    ['offline','Could not reach the sync service. Check your connection and try again.']
  ]) {
    state.mode=mode;await create.click();await expect(page.locator('#toast')).toHaveText(message);
    await expect(create).toBeEnabled();
  }
});

test('Share Link sends a URL, cancellation is silent, clipboard fallback works, and manual copy stays selectable on iPhone width', async ({ page }) => {
  const state = publicWorkerState();await seed(page);await mockPublicWorker(page, state);await page.goto('/');await openFullShare(page);
  const panel=page.locator('.public-schedule-panel');await panel.getByRole('button', { name: 'Create Share Link', exact: true }).click();await expect(panel).toContainText('Up to date');
  await page.evaluate(() => {
    window.__urlShares=[];window.__copied=[];window.__openedLinks=[];
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.__urlShares.push(data)});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__copied.push(value)}});
    HTMLAnchorElement.prototype.click=function(){window.__openedLinks.push({href:this.href,target:this.target,rel:this.rel});};
  });
  await panel.getByRole('button', { name: 'Share Link', exact: true }).click();
  const shared=await page.evaluate(() => window.__urlShares[0]);
  expect(shared.url).toMatch(/\/s\//);expect(shared).not.toHaveProperty('files');expect(shared.title).toBe('Public Link Cup · Full schedule');
  await page.evaluate(() => {document.querySelector('#toast').classList.remove('show');Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancel','AbortError');}});});
  await panel.getByRole('button', { name: 'Share Link', exact: true }).click();await page.waitForTimeout(100);await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await page.evaluate(() => Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
  await panel.getByRole('button', { name: 'Share Link', exact: true }).click();await expect(page.locator('#toast')).toHaveText('Public schedule link copied');
  expect((await page.evaluate(() => window.__copied.at(-1)))).toMatch(/\/s\//);
  await panel.getByRole('button', { name: 'Open Link', exact: true }).click();
  expect(await page.evaluate(() => window.__openedLinks.at(-1))).toMatchObject({target:'_blank',rel:'noopener noreferrer'});
  expect((await page.evaluate(() => window.__openedLinks.at(-1).href))).toMatch(/\/s\//);
  await page.setViewportSize({width:320,height:700});
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await panel.getByRole('button', { name: 'Copy Link', exact: true }).click();
  await expect(panel).toContainText('Select the URL above and copy it manually');
  const url=panel.getByLabel('Public schedule URL');await expect(url).toBeFocused();
  expect(await url.evaluate(el => ({ selected: el.selectionStart===0&&el.selectionEnd===el.value.length, fits: el.scrollWidth<=el.clientWidth+1 }))).toEqual({selected:true,fits:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('busy operations reject duplicates and a delayed response cannot overwrite newer synced metadata', async ({ page }) => {
  const state=publicWorkerState();let releaseCreate,releaseUpdate,createStarted,updateStarted;
  const createGate=new Promise(resolve=>{releaseCreate=resolve;}),updateGate=new Promise(resolve=>{releaseUpdate=resolve;});
  const createSeen=new Promise(resolve=>{createStarted=resolve;}),updateSeen=new Promise(resolve=>{updateStarted=resolve;});
  await seed(page);await mockPublicWorker(page,state,{beforeCreate:async()=>{createStarted();await createGate;},beforeUpdate:async()=>{updateStarted();await updateGate;}});await page.goto('/');await openFullShare(page);
  await page.evaluate(() => {const button=document.querySelector('.public-schedule-panel button');button.click();button.click();});await createSeen;
  await expect(page.locator('.public-schedule-panel').getByRole('button',{name:'Creating link…',exact:true})).toBeDisabled();
  expect(state.requests.filter(request=>request.method==='POST')).toHaveLength(0);releaseCreate();await expect(page.locator('.public-schedule-panel')).toContainText('Up to date');
  expect(state.requests.filter(request=>request.method==='POST')).toHaveLength(1);

  await page.getByRole('button',{name:'Close',exact:true}).click();await page.evaluate(async()=>{evById('fixed-public').name='Changed During Race';await saveEvents();openScheduleShare('fixed-public');});
  await expect(page.locator('.public-schedule-panel')).toContainText('Schedule changed since publication');
  await page.locator('.public-schedule-panel').getByRole('button',{name:'Update Published Link',exact:true}).click();await updateSeen;
  const newer=9_999_999_999_999;
  await page.evaluate(async value=>{const pub=evById('fixed-public').schedulePublications.full;pub.updatedAt=value;pub.contentHash='f'.repeat(64);await saveEvents();},newer);
  releaseUpdate();await expect.poll(()=>page.evaluate(()=>evById('fixed-public').schedulePublications.full.updatedAt)).toBe(newer);
  expect(await page.evaluate(()=>evById('fixed-public').schedulePublications.full.contentHash)).toBe('f'.repeat(64));
});

test('management authorization failures preserve metadata and missing records offer a new link', async ({ page }) => {
  const state=publicWorkerState();await seed(page);await mockPublicWorker(page,state);await page.goto('/');await openFullShare(page);
  const panel=page.locator('.public-schedule-panel');await panel.getByRole('button',{name:'Create Share Link',exact:true}).click();await expect(panel).toContainText('Up to date');
  const before=await page.evaluate(()=>JSON.stringify(evById('fixed-public').schedulePublications.full));
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.evaluate(async()=>{evById('fixed-public').name='Management Error Cup';await saveEvents();openScheduleShare('fixed-public');});await expect(panel).toContainText('Schedule changed since publication');
  const token=JSON.parse(before).publicToken,record=state.records.get(token),originalManagement=record.managementToken;record.managementToken='Q'.repeat(43);
  await panel.getByRole('button',{name:'Update Published Link',exact:true}).click();await expect(page.locator('#toast')).toHaveText('This device no longer has valid permission to manage that link.');
  expect(await page.evaluate(()=>JSON.stringify(evById('fixed-public').schedulePublications.full))).toBe(before);
  record.managementToken=originalManagement;state.records.delete(token);
  await panel.getByRole('button',{name:'Update Published Link',exact:true}).click();await expect(panel).toContainText('The public record no longer exists');await expect(panel.getByRole('button',{name:'Create New Link',exact:true})).toBeVisible();
  const missing=await page.evaluate(()=>evById('fixed-public').schedulePublications.full);
  expect(missing).toMatchObject({publicToken:token,status:'unavailable'});expect(missing.contentHash).toBe(JSON.parse(before).contentHash);
});

test('publication metadata survives backup/restore and public HTML never enters event persistence', async ({ page }) => {
  const state=publicWorkerState();await seed(page);await mockPublicWorker(page,state);await page.addInitScript(()=>{window.__backup='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__backup=value;}}});HTMLAnchorElement.prototype.click=function(){};});await page.goto('/');await openFullShare(page);
  await page.locator('.public-schedule-panel').getByRole('button',{name:'Create Share Link',exact:true}).click();await expect(page.locator('.public-schedule-panel')).toContainText('Up to date');
  await page.evaluate(()=>exportData());await expect.poll(()=>page.evaluate(()=>window.__backup.length)).toBeGreaterThan(100);
  const backup=JSON.parse(await page.evaluate(()=>window.__backup));
  expect(backup.events[0].schedulePublications.full.publicUrl).toMatch(/\/s\//);
  expect(JSON.stringify(backup.events[0].schedulePublications)).not.toContain('<!DOCTYPE html>');
  await page.evaluate(async data=>{evts=[];await saveEvents();await restoreBackupData(data);},backup);
  expect(await page.evaluate(()=>evById('fixed-public').schedulePublications.full.publicUrl)).toBe(backup.events[0].schedulePublications.full.publicUrl);
});
