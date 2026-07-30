import { test, expect } from '@playwright/test';

/* Court-side score reporting: the organizer half. The Worker is stubbed at the
   network boundary so these specs exercise the real app code paths — mode
   switching, court codes, the review queue, and accept/reject — without a
   live binding. */

function roster(count = 8) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`, seedRating: 60 - i * 3,
    rating: 60 - i * 3, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 60 - i * 3 }]
  }));
}

const SCHED = { start: '10:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'spec-seed', revision: 1 };

function fixedEvent(overrides = {}) {
  return {
    id: 'fixed', name: 'Report Cup', eventDate: '2026-07-27', created: 1, done: false, format: 'fixedTeams',
    teams: [
      { id: 't1', name: 'Ospreys', pool: 'A', players: ['p0', 'p1'] },
      { id: 't2', name: 'Anchors', pool: 'A', players: ['p2', 'p3'] },
      { id: 't3', name: 'Reef', pool: 'A', players: ['p4', 'p5'] }
    ],
    brackets: [], sched: SCHED, ...overrides
  };
}

function rotatingEvent(overrides = {}) {
  return {
    id: 'rot', name: 'Report Night', eventDate: '2026-07-27', created: 2, done: false, format: 'rotatingGroups',
    teams: [], brackets: [],
    entries: Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], created: i })),
    rotation: { entrySize: 2, teamSize: 4, rounds: 1, courts: 1, seedMode: 'manual', winPoints: 1, tiePoints: .5, lossPoints: 0, seed: 'spec-seed', revision: 1 },
    rotationSchedule: [{ id: 'rot-r1-c1', round: 1, court: 1, sideAEntryIds: ['e0', 'e1'], sideBEntryIds: ['e2', 'e3'], status: 'pending' }],
    ...overrides
  };
}

const SESSION_TOKEN = 'T'.repeat(43);
const SESSION_ID = 'S'.repeat(43);
const REPORT_URL = `https://sync.example/report/${SESSION_TOKEN}`;

function reportingConfig(mode = 'code') {
  return {
    mode, sessionId: SESSION_ID, publicToken: SESSION_TOKEN, reportUrl: REPORT_URL,
    courts: [{ index: 0, label: 'Court 1', code: 'KM7QF' }, { index: 1, label: 'Court 2', code: 'RB4XJ' }]
  };
}

async function seed(page, { events, games = [] }) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
    localStorage.setItem('vb:sync', JSON.stringify({ url: 'https://sync.example', code: 'spec-room', on: true }));
  }, { events, games, players: roster() });
}

/* Stub the Worker at the network boundary. `calls` records what the app sent
   so the specs can assert the request shapes too. */
async function stubWorker(page, { reports = [], pendingCount = 0 } = {}) {
  const state = { reports, pendingCount, disposed: [], rotated: 0 };
  await page.exposeFunction('__specState', () => state);
  await page.route('**/api/score-reports/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    if (url.pathname.endsWith('/config') && body.rotateCodes) state.rotated += 1;
    const session = {
      sessionId: SESSION_ID, eventId: 'fixed', mode: body.mode || 'code', status: 'open',
      createdAt: 1, updatedAt: 2, expiresAt: Date.now() + 3600000, label: 'Report Cup',
      reportUrl: REPORT_URL, publicToken: SESSION_TOKEN,
      courts: state.rotated
        ? [{ index: 0, label: 'Court 1', code: 'ZZ4NP' }, { index: 1, label: 'Court 2', code: 'QW8HK' }]
        : reportingConfig().courts,
      matchCount: 3, matchesUpdatedAt: 3
    };
    if (url.pathname.endsWith('/status')) return route.fulfill({ json: { available: true } });
    if (url.pathname.endsWith('/review')) {
      return route.fulfill({ json: { ok: true, session, reports: state.reports, matchStates: {}, pendingCount: state.pendingCount } });
    }
    if (url.pathname.endsWith('/reindex')) return route.fulfill({ json: { ok: true, session, matchStates: {}, rescanned: 3 } });
    if (/\/reports\//.test(url.pathname)) {
      state.disposed.push({ reportId: decodeURIComponent(url.pathname.split('/reports/')[1]), disposition: body.disposition, gameIds: body.gameIds || [] });
      const target = state.reports.find(row => row.reportId === decodeURIComponent(url.pathname.split('/reports/')[1]));
      if (target) target.disposition = body.disposition === 'accept' ? 'accepted' : body.disposition === 'reject' ? 'rejected' : null;
      state.pendingCount = state.reports.filter(row => !row.disposition).length;
      return route.fulfill({ json: { ok: true, report: target || {}, matchState: body.disposition === 'accept' ? 'accepted' : 'pending' } });
    }
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { ok: true, session } });
    if (url.pathname.endsWith('/close')) return route.fulfill({ json: { ok: true, session: { ...session, status: 'closed' } } });
    if (url.pathname.endsWith('/matches')) return route.fulfill({ json: { ok: true, session } });
    if (method === 'POST') return route.fulfill({ status: 201, json: { ok: true, resumed: false, session } });
    return route.fulfill({ json: { ok: true, session: null } });
  });
  return state;
}

async function openEvent(page, id) {
  await page.goto('/');
  await page.evaluate(eventId => { tab = 'events'; openEvent(eventId); }, id);
}

function reportRow(page, overrides = {}) {
  return page.evaluate(async row => {
    const ev = evById('fixed');
    const matches = scoreReportSessionMatches(ev);
    const match = matches[row.matchIndex || 0];
    const built = {
      reportId: row.reportId, matchId: match.matchId, mode: row.mode || 'set', sets: row.sets || [[25, 21]],
      tie: !!row.tie, afterAccept: !!row.afterAccept, submittedAt: 1753600000000, updatedAt: 1753600000000,
      disposition: null, deviceLabel: 'device-' + row.reportId.slice(0, 6),
      courtLabel: match.courtLabel, roundLabel: match.roundLabel,
      sideAName: match.sideAName, sideBName: match.sideBName, phase: 'pool',
      stale: !!row.stale, matchState: row.matchState || 'pending', acceptedAt: null
    };
    return built;
  }, overrides);
}

test('score reporting is off by default and adds nothing to an existing event or its published schedule', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  const card = page.locator('[data-score-report-card]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-score-report-mode]')).toHaveText('Off');
  await expect(card.getByRole('button', { name: 'Set up score reporting' })).toBeVisible();
  await expect(card.getByRole('button', { name: /Review queue/ })).toHaveCount(0);

  const result = await page.evaluate(() => {
    const ev = evById('fixed');
    const off = renderScheduleDocument(deriveFullScheduleExportModel(ev), { photoContext: PUBLIC_PHOTO_CONTEXTS.worker, scoreReport: scoreReportPublicationContext(ev) });
    return {
      mode: scoreReportingMode(ev),
      context: scoreReportPublicationContext(ev),
      hasMarkers: off.includes('data-report-match'),
      hasScript: off.includes('public-report.js'),
      storedKeys: Object.keys(ev).filter(key => /score/i.test(key))
    };
  });
  expect(result.mode).toBe('off');
  expect(result.context).toBeNull();
  expect(result.hasMarkers).toBe(false);
  expect(result.hasScript).toBe(false);
  expect(result.storedKeys).toEqual([]);
});

test('switching modes updates the card, exposes the player link, and never rewrites reports', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  await page.getByRole('button', { name: 'Set up score reporting' }).click();
  await expect(page.getByRole('heading', { name: 'Court-side score reporting' })).toBeVisible();
  await page.locator('[data-score-mode-option="open"]').click();
  await expect(page.locator('[data-score-mode-option="open"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('textarea[aria-label="Score report URL"]')).toHaveValue(REPORT_URL);

  await page.locator('[data-score-mode-option="code"]').click();
  await expect(page.locator('[data-score-mode-option="code"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => closeSheet());

  await expect(page.locator('[data-score-report-card] [data-score-report-mode]')).toHaveText('Court codes');
  await expect(page.locator('[data-score-report-card]').getByRole('button', { name: /Review queue/ })).toBeVisible();

  const published = await page.evaluate(() => {
    const ev = evById('fixed');
    const doc = renderScheduleDocument(deriveFullScheduleExportModel(ev), { photoContext: PUBLIC_PHOTO_CONTEXTS.worker, scoreReport: scoreReportPublicationContext(ev) });
    return { markers: (doc.match(/data-report-match/g) || []).length, script: doc.includes('/assets/public-report.js'), mode: scoreReportingMode(ev) };
  });
  expect(published.mode).toBe('code');
  expect(published.markers).toBe(3);
  expect(published.script).toBe(true);
});

test('court codes render one card per court with a scannable QR and rotate without touching reports', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('code') })] });
  const state = await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  await page.locator('[data-score-report-card]').getByRole('button', { name: 'Court codes' }).click();
  await expect(page.getByRole('heading', { name: 'Court codes' })).toBeVisible();
  await expect(page.locator('.court-code-cell')).toHaveCount(2);
  await expect(page.locator('.court-code-cell svg')).toHaveCount(2);
  await expect(page.locator('.court-code-value').first()).toHaveText('KM7QF');

  const codes = await page.locator('.court-code-value').allTextContents();
  codes.forEach(code => expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/));

  await page.evaluate(() => { window.askConfirm = async () => true; });
  await page.getByRole('button', { name: 'Rotate all codes' }).click();
  await expect(page.locator('.court-code-value').first()).toHaveText('ZZ4NP');
  expect(await page.evaluate(() => scoreReportCourtCodes(evById('fixed')).map(c => c.code))).toEqual(['ZZ4NP', 'QW8HK']);
});

test('the review queue groups conflicting reports first and names both sides in full', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('open') })] });
  await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  const rows = [
    await reportRow(page, { reportId: 'a'.repeat(64) + '.' + '1'.repeat(64), matchIndex: 1, sets: [[25, 18]], matchState: 'corroborated' }),
    await reportRow(page, { reportId: 'a'.repeat(64) + '.' + '2'.repeat(64), matchIndex: 1, sets: [[25, 18]], matchState: 'corroborated' }),
    await reportRow(page, { reportId: 'b'.repeat(64) + '.' + '3'.repeat(64), matchIndex: 0, sets: [[25, 21]], matchState: 'conflicted' }),
    await reportRow(page, { reportId: 'b'.repeat(64) + '.' + '4'.repeat(64), matchIndex: 0, sets: [[25, 23]], matchState: 'conflicted' })
  ];
  await page.evaluate(reports => ScoreReports.setCached('fixed', { data: { reports, matchStates: {}, pendingCount: 4 }, error: null, fetchedAt: Date.now() }), rows);
  await page.evaluate(() => renderScoreReview('fixed'));

  await expect(page.getByRole('heading', { name: 'Reported scores' })).toBeVisible();
  await expect(page.locator('[data-score-report-row]')).toHaveCount(4);
  await expect(page.locator('[data-score-review-conflict]')).toHaveCount(2);

  const firstGroup = page.locator('.score-review-group').first();
  await expect(firstGroup).toHaveAttribute('data-score-review-conflict', '');
  await expect(firstGroup).toContainText('they disagree, walk to this court');
  await expect(firstGroup.locator('[data-score-report-row]').first()).toContainText('Ospreys');
  await expect(firstGroup.locator('[data-score-report-row]').first()).toContainText('Anchors');
  await expect(page.locator('.score-review-group').nth(1)).toContainText('they agree');
});

test('accepting a report saves the same game the manual sheet would and tells the queue', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('open') })] });
  const state = await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  const reportId = 'c'.repeat(64) + '.' + '9'.repeat(64);
  const row = await reportRow(page, { reportId, matchIndex: 0, sets: [[25, 21]], matchState: 'pending' });
  await page.evaluate(reports => ScoreReports.setCached('fixed', { data: { reports, matchStates: {}, pendingCount: 1 }, error: null, fetchedAt: Date.now() }), [row]);
  await page.evaluate(() => { window.askConfirm = async () => true; });
  await page.evaluate(() => renderScoreReview('fixed'));

  await page.locator('[data-score-report-row]').first().getByRole('button', { name: 'Accept' }).click();
  await expect.poll(() => page.evaluate(() => games.length)).toBe(1);

  const saved = await page.evaluate(() => {
    const g = games[0];
    return { evId: g.evId, evA: g.evA, evB: g.evB, scoreA: g.scoreA, scoreB: g.scoreB, winner: g.winner, hasEvMatchId: 'evMatchId' in g, label: g.label };
  });
  expect(saved.evId).toBe('fixed');
  expect(saved.scoreA).toBe(25);
  expect(saved.scoreB).toBe(21);
  expect(saved.winner).toBe('A');
  /* A fixed-team pool match is identified by evA/evB, exactly like the manual
     sheet — the reporting key never leaks into the game record. */
  expect(saved.hasEvMatchId).toBe(false);
  expect(saved.evA).toBeTruthy();
  expect(saved.evB).toBeTruthy();

  await expect.poll(async () => (await page.evaluate(async () => (await window.__specState()).disposed)).length).toBe(1);
  const record = (await page.evaluate(async () => (await window.__specState()).disposed))[0];
  expect(record.disposition).toBe('accept');
  expect(record.gameIds).toHaveLength(1);
  expect(await page.evaluate(() => games[0].id)).toBe(record.gameIds[0]);
});

test('rejecting is non-destructive and the row stays visible as rejected', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('open') })] });
  const state = await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  const reportId = 'd'.repeat(64) + '.' + '8'.repeat(64);
  const row = await reportRow(page, { reportId, matchIndex: 0, sets: [[25, 21]], matchState: 'pending' });
  /* Seed the stub, not just the cache, so the refetch after rejecting returns
     the row with its new disposition — the real reconnect path. */
  state.reports.push(row);
  state.pendingCount = 1;
  await page.evaluate(reports => ScoreReports.setCached('fixed', { data: { reports, matchStates: {}, pendingCount: 1 }, error: null, fetchedAt: Date.now() }), [row]);
  await page.evaluate(() => renderScoreReview('fixed'));

  await page.locator('[data-score-report-row]').first().getByRole('button', { name: 'Reject' }).click();
  await expect(page.locator('[data-score-report-row]')).toHaveCount(1);
  await expect(page.locator('[data-score-report-row]').first()).toContainText('Rejected');
  await expect(page.locator('[data-score-report-row]').first().getByRole('button', { name: 'Undo reject' })).toBeVisible();
  expect(await page.evaluate(() => games.length)).toBe(0);
});

test('a stale report cannot be accepted and a submitted tie is flagged for the organizer', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('open') })] });
  await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  const stale = await reportRow(page, { reportId: 'e'.repeat(64) + '.' + '7'.repeat(64), matchIndex: 0, sets: [[25, 21]], stale: true, matchState: 'pending' });
  const tie = await reportRow(page, { reportId: 'f'.repeat(64) + '.' + '6'.repeat(64), matchIndex: 1, sets: [[21, 21]], tie: true, matchState: 'pending' });
  await page.evaluate(reports => ScoreReports.setCached('fixed', { data: { reports, matchStates: {}, pendingCount: 2 }, error: null, fetchedAt: Date.now() }), [stale, tie]);
  await page.evaluate(() => renderScoreReview('fixed'));

  const staleRow = page.locator(`[data-score-report-row="${'e'.repeat(64)}.${'7'.repeat(64)}"]`);
  await expect(staleRow).toContainText('no longer on the schedule');
  await expect(staleRow.getByRole('button', { name: 'Accept' })).toHaveCount(0);
  await expect(staleRow.getByRole('button', { name: 'Reject' })).toBeVisible();

  const tieRow = page.locator(`[data-score-report-row="${'f'.repeat(64)}.${'6'.repeat(64)}"]`);
  await expect(tieRow).toContainText('Submitted as a tie');
  await expect(tieRow).toContainText('confirm');
});

test('a rotating event reports and accepts through the rotating record path', async ({ page }) => {
  await seed(page, { events: [rotatingEvent({ scoreReporting: { ...reportingConfig('open'), courts: [{ index: 0, label: 'Court 1', code: 'KM7QF' }] } })] });
  await stubWorker(page);
  await openEvent(page, 'rot');
  await page.evaluate(() => eventSection('schedule'));

  const built = await page.evaluate(() => {
    const ev = evById('rot');
    const matches = scoreReportSessionMatches(ev);
    const resolved = resolveScoreReportMatch(ev, 'rot-r1-c1');
    return { matches, kind: resolved?.kind, valid: resolved?.valid?.valid };
  });
  expect(built.kind).toBe('rotating');
  expect(built.valid).toBe(true);
  expect(built.matches[0].sideAName).toContain('Pair');

  const reportId = 'a'.repeat(64) + '.' + 'b'.repeat(64);
  await page.evaluate(({ reportId, match }) => {
    const row = {
      reportId, matchId: 'rot-r1-c1', mode: 'set', sets: [[25, 20]], tie: false, afterAccept: false,
      submittedAt: 1753600000000, updatedAt: 1753600000000, disposition: null, deviceLabel: 'device-abc',
      courtLabel: match.courtLabel, roundLabel: match.roundLabel, sideAName: match.sideAName, sideBName: match.sideBName,
      phase: 'pool', stale: false, matchState: 'pending', acceptedAt: null
    };
    ScoreReports.setCached('rot', { data: { reports: [row], matchStates: {}, pendingCount: 1 }, error: null, fetchedAt: Date.now() });
    window.askConfirm = async () => true;
  }, { reportId, match: built.matches[0] });
  await page.evaluate(() => renderScoreReview('rot'));

  await page.locator('[data-score-report-row]').first().getByRole('button', { name: 'Accept' }).click();
  await expect.poll(() => page.evaluate(() => games.length)).toBe(1);
  const saved = await page.evaluate(() => {
    const g = games[0];
    return { evMatchId: g.evMatchId, format: g.eventFormat, a: g.evEntryIdsA, b: g.evEntryIdsB, scoreA: g.scoreA, winner: g.winner };
  });
  expect(saved.evMatchId).toBe('rot-r1-c1');
  expect(saved.format).toBe('rotatingGroups');
  expect(saved.a).toEqual(['e0', 'e1']);
  expect(saved.b).toEqual(['e2', 'e3']);
  expect(saved.winner).toBe('A');
});

test('the review queue and court codes stay usable at 320px, 375px, and 1280px', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('code') })] });
  await stubWorker(page);
  await openEvent(page, 'fixed');
  await page.evaluate(() => eventSection('schedule'));

  const rows = [
    await reportRow(page, { reportId: 'a'.repeat(64) + '.' + '1'.repeat(64), matchIndex: 0, sets: [[25, 21]], matchState: 'conflicted' }),
    await reportRow(page, { reportId: 'a'.repeat(64) + '.' + '2'.repeat(64), matchIndex: 0, sets: [[25, 23]], matchState: 'conflicted' })
  ];
  await page.evaluate(reports => ScoreReports.setCached('fixed', { data: { reports, matchStates: {}, pendingCount: 2 }, error: null, fetchedAt: Date.now() }), rows);

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 860 });
    await page.evaluate(() => renderScoreReview('fixed'));
    await expect(page.locator('[data-score-report-row]')).toHaveCount(2);

    const metrics = await page.evaluate(() => {
      const sheet = document.querySelector('#scrim .sheet');
      const buttons = [...sheet.querySelectorAll('button')].map(b => b.getBoundingClientRect().height).filter(h => h > 0);
      return {
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        sheetOverflow: sheet.scrollWidth > sheet.clientWidth,
        smallestTouchTarget: Math.min(...buttons)
      };
    });
    expect(metrics.docOverflow, `document overflows at ${width}px`).toBe(false);
    expect(metrics.sheetOverflow, `sheet overflows at ${width}px`).toBe(false);
    expect(metrics.smallestTouchTarget, `touch target too small at ${width}px`).toBeGreaterThanOrEqual(43.5);

    await page.evaluate(() => closeSheet());
    await page.evaluate(() => openCourtCodes('fixed'));
    await expect(page.locator('.court-code-cell')).toHaveCount(2);
    const codeMetrics = await page.evaluate(() => {
      const sheet = document.querySelector('#scrim .sheet');
      return { docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, sheetOverflow: sheet.scrollWidth > sheet.clientWidth };
    });
    expect(codeMetrics.docOverflow, `court codes overflow the document at ${width}px`).toBe(false);
    expect(codeMetrics.sheetOverflow, `court codes overflow the sheet at ${width}px`).toBe(false);
    await page.evaluate(() => closeSheet());
  }
});

test('pending reports never enter a backup or the synced payload', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ scoreReporting: reportingConfig('code') })] });
  await stubWorker(page);
  await openEvent(page, 'fixed');

  const rows = [await reportRow(page, { reportId: 'a'.repeat(64) + '.' + '1'.repeat(64), matchIndex: 0, sets: [[25, 21]], matchState: 'pending' })];
  await page.evaluate(reports => ScoreReports.setCached('fixed', { data: { reports, matchStates: {}, pendingCount: 1 }, error: null, fetchedAt: Date.now() }), rows);

  const result = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('vb:events') || '[]');
    const ev = stored.find(e => e.id === 'fixed');
    return {
      storedKeys: Object.keys(ev.scoreReporting || {}).sort(),
      serialized: JSON.stringify(stored),
      gamesStored: localStorage.getItem('vb:games')
    };
  });
  expect(result.storedKeys).toEqual(['courts', 'mode', 'publicToken', 'reportUrl', 'sessionId']);
  expect(result.serialized).not.toContain('reportId');
  expect(result.serialized).not.toContain('pendingCount');
  expect(result.serialized).not.toContain('deviceLabel');
  expect(result.gamesStored).toBe('[]');
});

/* ============================================================
   The player half. The Worker's own report page is rendered by importing the
   Worker module, so these specs drive the real page script rather than a copy.
   ============================================================ */

let workerModulePromise = null;
async function workerModule() {
  if (!workerModulePromise) {
    workerModulePromise = (async () => {
      const { readFile } = await import('node:fs/promises');
      const { webcrypto } = await import('node:crypto');
      const { pathToFileURL } = await import('node:url');
      const { resolve } = await import('node:path');
      if (!globalThis.crypto) globalThis.crypto = webcrypto;
      if (!globalThis.btoa) globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
      const file = resolve(process.cwd(), 'cloudflare/court-sync-worker.js');
      const coreSource = await readFile(resolve(process.cwd(), 'event-structure-core.js'), 'utf8');
      const source = (await readFile(file, 'utf8')).replace('import "../event-structure-core.js";', '');
      void pathToFileURL(file);
      const mod = await import(`data:text/javascript;base64,${Buffer.from(`${coreSource}\n${source}`).toString('base64')}`);
      return mod.default;
    })();
  }
  return workerModulePromise;
}

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list() { return { keys: [], list_complete: true }; }
}

/* Render the real /report/:token page and put it on the dev-server origin so
   its relative fetches can be routed. */
async function openReportPage(page, { code = '', query = '' } = {}) {
  const worker = await workerModule();
  const env = { COURT: new MemoryKV(), SCORE_REPORTS: new MemoryKV() };
  const path = code ? `/report/${SESSION_TOKEN}/c/${code}` : `/report/${SESSION_TOKEN}`;
  const response = await worker.fetch(new Request(`https://sync.example${path}`), env);
  const html = await response.text();
  await page.goto(`/${query}`);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  return html;
}

function playerApi(page, { mode = 'open', matches = null, ownReports = [], matchStates = {}, onSubmit = null } = {}) {
  const calls = [];
  const list = matches || [
    { matchId: 'fixed:t1:t2', courtIndex: 0, courtLabel: 'Court 1', roundLabel: 'Round 1', sideAName: 'Ospreys', sideBName: 'Anchors', phase: 'pool' },
    { matchId: 'fixed:t1:t3', courtIndex: 1, courtLabel: 'Court 2', roundLabel: 'Round 2', sideAName: 'Ospreys', sideBName: 'Reef Runners United', phase: 'pool' }
  ];
  return page.route('**/api/score-reports/public/**', async route => {
    const url = new URL(route.request().url());
    const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    calls.push({ path: url.pathname, method: route.request().method(), body, device: route.request().headers()['x-score-device-token'] });
    if (url.pathname.endsWith('/code')) {
      if (body.code !== 'KM7QF') return route.fulfill({ status: 403, json: { ok: false, code: 'CODE_NOT_RECOGNIZED', message: 'That code is not valid for this event. Check the card at your court.' } });
      return route.fulfill({ json: { ok: true, court: { index: 0, label: 'Court 1' }, matches: list.filter(m => m.courtIndex === 0), matchStates, ownReports } });
    }
    if (url.pathname.endsWith('/reports')) {
      const result = onSubmit ? onSubmit(body) : { ok: true, reportId: 'r1', matchId: body.matchId, state: 'pending', updated: false, alreadyAccepted: false };
      if (result.status && result.status >= 400) return route.fulfill({ status: result.status, json: result });
      return route.fulfill({ status: 201, json: result });
    }
    if (url.pathname.endsWith('/state')) return route.fulfill({ json: { ok: true, mode, status: 'open', updatedAt: 1, matches: matchStates } });
    return route.fulfill({ json: { ok: true, status: 'open', mode, label: 'Report Cup', expiresAt: Date.now() + 3600000, matches: mode === 'open' ? list : [], matchStates, ownReports } });
  }).then(() => calls);
}

test('the player report page lists matches, names both sides in the confirm step, and submits once', async ({ page }) => {
  const calls = await playerApi(page, { mode: 'open' });
  await openReportPage(page);

  await expect(page.locator('.score-card')).toContainText('Report Cup');
  await expect(page.locator('button.match')).toHaveCount(2);

  await page.locator('button.match').first().click();
  await expect(page.getByRole('heading', { name: 'Enter the score' })).toBeVisible();
  await page.locator('[data-score="a0"]').fill('25');
  await page.locator('[data-score="b0"]').fill('21');
  await page.getByRole('button', { name: 'Review and send' }).click();

  /* Trust mode has no proof of presence, so the confirm step must name both
     sides, the round, and the court in full before the send button. */
  const confirm = page.locator('.confirm');
  await expect(confirm).toContainText('Ospreys');
  await expect(confirm).toContainText('Anchors');
  await expect(confirm).toContainText('Round 1');
  await expect(confirm).toContainText('Court 1');
  await expect(confirm).toContainText('25–21');
  await expect(page.locator('.score-card')).toContainText('reviews every score before it counts');

  await page.getByRole('button', { name: 'Send to organizer' }).click();
  await expect(page.getByRole('heading', { name: 'Thanks — sent' })).toBeVisible();

  const submits = calls.filter(c => c.path.endsWith('/reports'));
  expect(submits).toHaveLength(1);
  expect(submits[0].body).toMatchObject({ matchId: 'fixed:t1:t2', mode: 'set', sets: [[25, 21]] });
  expect(submits[0].device).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test('code mode hides matches until a court code is accepted and remembers it for next time', async ({ page }) => {
  const calls = await playerApi(page, { mode: 'code' });
  await openReportPage(page);

  await expect(page.getByRole('heading', { name: 'Enter your court code' })).toBeVisible();
  await expect(page.locator('button.match')).toHaveCount(0);

  await page.locator('input[aria-label="Court code"]').fill('zzzzz');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-message]')).toContainText('not valid for this event');

  await page.locator('input[aria-label="Court code"]').fill('km7qf');
  await page.getByRole('button', { name: 'Continue' }).click();
  /* One match on that court resolves straight to the score form. */
  await expect(page.getByRole('heading', { name: 'Enter the score' })).toBeVisible();
  await expect(page.locator('.score-card')).toContainText('Ospreys');

  const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem(`court-score-codes:${'T'.repeat(43)}`) || '[]'));
  expect(remembered[0]).toMatchObject({ code: 'KM7QF', label: 'Court 1' });

  /* Typed input is normalized to the code alphabet before it leaves the device. */
  const codeCalls = calls.filter(c => c.path.endsWith('/code'));
  expect(codeCalls.map(c => c.body.code)).toEqual(['ZZZZZ', 'KM7QF']);
});

test('a printed QR deep-link applies its court code without typing', async ({ page }) => {
  const calls = await playerApi(page, { mode: 'code' });
  const html = await openReportPage(page, { code: 'KM7QF' });
  expect(html).toContain('data-code="KM7QF"');
  await expect(page.getByRole('heading', { name: 'Enter the score' })).toBeVisible();
  expect(calls.filter(c => c.path.endsWith('/code')).map(c => c.body.code)).toEqual(['KM7QF']);
});

test('a match already recorded is separated out and a correction is labeled as one', async ({ page }) => {
  await playerApi(page, {
    mode: 'open',
    matchStates: { 'fixed:t1:t2': 'accepted' },
    onSubmit: () => ({ ok: true, reportId: 'r2', matchId: 'fixed:t1:t2', state: 'conflicted', updated: false, alreadyAccepted: true })
  });
  await openReportPage(page);

  /* An accepted match drops out of the live list into a collapsed section, so
     a player is not invited to re-report something already settled. */
  await expect(page.locator('.match-list button.match')).toHaveCount(1);
  await expect(page.locator('details.done-list')).toContainText('Already recorded · 1');

  await page.locator('details.done-list').click();
  await page.locator('details.done-list button.match').first().click();
  await expect(page.locator('.locked')).toContainText('already recorded a result');

  await page.locator('[data-score="a0"]').fill('25');
  await page.locator('[data-score="b0"]').fill('23');
  await page.getByRole('button', { name: 'Review and send' }).click();
  await page.getByRole('button', { name: 'Send to organizer' }).click();
  await expect(page.locator('.success')).toContainText('sent as a correction');
});

test('a failed submission keeps the typed score on the device and offers a retry', async ({ page }) => {
  await playerApi(page, { mode: 'open', onSubmit: () => ({ status: 503, ok: false, code: 'UNEXPECTED_ERROR', message: 'Score reporting is temporarily unavailable.' }) });
  await openReportPage(page);

  await page.locator('button.match').first().click();
  await page.locator('[data-score="a0"]').fill('25');
  await page.locator('[data-score="b0"]').fill('19');
  await page.getByRole('button', { name: 'Review and send' }).click();
  await page.getByRole('button', { name: 'Send to organizer' }).click();

  await expect(page.locator('[data-message]')).toContainText('saved on this device');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem(`court-score-draft:${'T'.repeat(43)}`) || 'null'));
  expect(draft).toMatchObject({ matchId: 'fixed:t1:t2', mode: 'set', sets: [[25, 19]] });

  /* Reloading must bring the unsent score back rather than losing it. */
  await openReportPage(page);
  await expect(page.locator('[data-message]')).toContainText('did not send last time');
  await expect(page.locator('.confirm-score')).toContainText('25–19');
});

test('the player page is usable at 320px and stays free of horizontal overflow', async ({ page }) => {
  await playerApi(page, { mode: 'open' });
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 780 });
    await openReportPage(page);
    await page.locator('button.match').first().click();
    await expect(page.getByRole('heading', { name: 'Enter the score' })).toBeVisible();
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      smallestTarget: Math.min(...[...document.querySelectorAll('button,input')].map(n => n.getBoundingClientRect().height).filter(h => h > 0))
    }));
    expect(metrics.overflow, `player page overflows at ${width}px`).toBe(false);
    expect(metrics.smallestTarget, `player touch target too small at ${width}px`).toBeGreaterThanOrEqual(44);
  }
});

test('the snapshot badge script patches per-match state without touching the static schedule', async ({ page }) => {
  const worker = await workerModule();
  const script = await (await worker.fetch(new Request('https://sync.example/assets/public-report.js'), {})).text();

  await page.route('**/api/score-reports/public/**/state', route => route.fulfill({
    json: { ok: true, mode: 'open', status: 'open', updatedAt: 1, matches: { 'm-1': 'conflicted', 'm-2': 'accepted' } }
  }));
  await page.goto('/');
  await page.setContent(`
    <div data-score-report-root data-report-token="${SESSION_TOKEN}" hidden></div>
    <article data-report-match="m-1"><span>Match one</span><div class="schedule-report"><a data-report-link href="/report/x?m=m-1">Report score</a><span class="report-badge" data-report-badge hidden></span></div></article>
    <article data-report-match="m-2"><span>Match two</span><div class="schedule-report"><a data-report-link href="/report/x?m=m-2">Report score</a><span class="report-badge" data-report-badge hidden></span></div></article>
    <article data-report-match="m-3"><span>Match three</span><div class="schedule-report"><a data-report-link href="/report/x?m=m-3">Report score</a><span class="report-badge" data-report-badge hidden></span></div></article>
    <script>${script}</script>`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-report-match="m-1"]')).toHaveAttribute('data-report-state', 'conflicted');
  await expect(page.locator('[data-report-match="m-1"] [data-report-badge]')).toContainText('Reports disagree');
  await expect(page.locator('[data-report-match="m-2"]')).toHaveAttribute('data-report-state', 'accepted');
  await expect(page.locator('[data-report-match="m-2"] [data-report-badge]')).toContainText('Result confirmed');
  await expect(page.locator('[data-report-match="m-2"] [data-report-link]')).toHaveText('View result status');
  await expect(page.locator('[data-report-match="m-3"]')).toHaveAttribute('data-report-state', 'none');
  await expect(page.locator('[data-report-match="m-3"] [data-report-badge]')).toBeHidden();
  await expect(page.locator('[data-report-match="m-3"] [data-report-link]')).toHaveText('Report score');

  /* The static schedule text is never rewritten — only badges and link labels. */
  await expect(page.locator('[data-report-match="m-1"] > span')).toHaveText('Match one');
});

test('a published schedule still reads correctly when the live-state endpoint is unreachable', async ({ page }) => {
  const worker = await workerModule();
  const script = await (await worker.fetch(new Request('https://sync.example/assets/public-report.js'), {})).text();
  await page.route('**/api/score-reports/public/**/state', route => route.abort('failed'));
  await page.goto('/');
  await page.setContent(`
    <div data-score-report-root data-report-token="${SESSION_TOKEN}" hidden></div>
    <article data-report-match="m-1"><span>Ospreys vs Anchors</span><div class="schedule-report"><a data-report-link href="/report/x?m=m-1">Report score</a><span class="report-badge" data-report-badge hidden></span></div></article>
    <script>${script}</script>`, { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(300);
  await expect(page.locator('[data-report-match="m-1"] > span')).toHaveText('Ospreys vs Anchors');
  await expect(page.locator('[data-report-match="m-1"] [data-report-link]')).toBeVisible();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  expect(errors).toEqual([]);
});
