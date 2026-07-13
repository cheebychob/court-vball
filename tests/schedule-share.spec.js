import { test, expect } from '@playwright/test';

function roster(count = 40) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`,
    seedRating: 40 + (i % 35), active: true, archived: false, roles: {}
  }));
}

async function seed(page, { events = [], games = [], playerCount = 40 } = {}) {
  await page.addInitScript(({ players, events, games }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { players: roster(playerCount), events, games });
}

async function openEvent(page, name) {
  await page.goto('/');
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.locator('.ev-row').filter({ hasText: name }).click();
}

function fixedEvent(overrides = {}) {
  return {
    id: 'fixed-share', name: 'Summer Smash: 2026 / Finals?', created: 1, done: false,
    teams: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Team ${String.fromCharCode(65 + i)}`, pool: i < 4 ? 'A' : 'B', players: [] })),
    sched: { start: '10:00', courts: 3, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'fixed-share-seed', revision: 3 },
    brackets: [], ...overrides
  };
}

function rotatingEvent({ entries = 10, rounds = 5, courts = 2, name = 'Rotating Share Night' } = {}) {
  return {
    id: 'rot-share', name, created: 1, done: false, format: 'rotatingGroups', teams: [], brackets: [],
    entries: Array.from({ length: entries }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1 })),
    rotation: { entrySize: 2, teamSize: 4, rounds, courts, seedMode: 'manual', start: '09:30', setMin: 25, matchMin: 45, breakMin: 10, winPoints: 1, tiePoints: .5, lossPoints: 0, tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor'], seed: 'rot-share-seed', revision: 2 },
    rotationSchedule: []
  };
}

test('fixed export model is complete, timed, scored, participant-safe, deterministic, and immutable', async ({ page }) => {
  await seed(page); await page.goto('/');
  const result = await page.evaluate(() => {
    const ev = {
      id: 'fixed-model', name: 'Model Cup', teams: Array.from({ length: 8 }, (_, i) => ({ id: `tm${i}`, name: `Model Team ${i + 1}`, pool: i < 4 ? 'A' : 'B', players: [] })),
      sched: { start: '10:00', courts: 3, courtStyle: 'letter', setMin: 20, matchMin: 45, breakMin: 10, seed: 'model-seed', revision: 4 }, brackets: []
    };
    const planned = buildSchedule(ev, []).plannedSlots.flat();
    const first = planned[0];
    const eventGames = [{ id: 'internal-game-id', date: 1, teamA: [], teamB: [], scoreA: 25, scoreB: 19, winner: 'A', log: {}, evId: ev.id, evA: first.a, evB: first.b, label: `Pool ${first.pool}` }];
    const before = JSON.stringify({ ev, eventGames });
    const one = deriveScheduleExportModel(ev, { gameList: eventGames, playerList: players, now: new Date(2026, 6, 12, 9).getTime() });
    const two = deriveScheduleExportModel(ev, { gameList: eventGames, playerList: players, now: new Date(2026, 6, 12, 9).getTime() });
    const pairs = one.rounds.flatMap(r => r.matches.map(m => [m.sideA[0].name, m.sideB[0].name].sort().join('|')));
    return {
      model: one, stable: JSON.stringify(one) === JSON.stringify(two), same: before === JSON.stringify({ ev, eventGames }),
      pairs, expected: planned.length, expectedRounds: buildSchedule(ev, []).plannedSlots.length, serialized: JSON.stringify(one)
    };
  });
  expect(result.model).toMatchObject({ scope: 'full', formatKind: 'fixed', eventName: 'Model Cup', startTime: '10:00 AM', intervalMinutes: 20, courts: 3 });
  expect(result.model.rounds).toHaveLength(result.expectedRounds);
  expect(result.pairs).toHaveLength(result.expected);
  expect(new Set(result.pairs).size).toBe(result.expected);
  expect(result.model.rounds.flatMap(r => r.matches).every(m => /^Court [A-Z]+$/.test(m.court) && m.pool)).toBe(true);
  expect(result.model.rounds.every(r => r.time && Array.isArray(r.byes))).toBe(true);
  expect(result.model.rounds.flatMap(r => r.matches).filter(m => m.score)).toEqual([expect.objectContaining({ status: 'Completed', score: '25–19' })]);
  expect(result.model.rounds.flatMap(r => r.matches).filter(m => !m.score).every(m => m.status === 'Pending')).toBe(true);
  expect(result.stable && result.same).toBe(true);
  expect(result.serialized).not.toContain('internal-game-id');
  expect(result.serialized).not.toMatch(/rating|seedRating|model-seed/i);
});

test('rotating export preserves saved temporary groups, opponents, players, byes, scores, and regeneration revisions', async ({ page }) => {
  await seed(page); await page.goto('/');
  const result = await page.evaluate(async () => {
    const ev = {
      id: 'rot-model', name: 'Rotation Model', format: 'rotatingGroups', teams: [], brackets: [],
      entries: Array.from({ length: 10 }, (_, i) => ({ id: `re${i}`, name: `Registered Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1 })),
      rotation: { entrySize: 2, teamSize: 4, rounds: 5, courts: 2, seedMode: 'manual', start: '09:30', setMin: 25, seed: 'rotation-model', revision: 7 }
    };
    const generated = generateRotationScheduleData(ev); ev.rotationSchedule = generated.matches;
    const first = generated.matches[0];
    const eventGames = [{ id: 'hidden-result-id', date: 1, teamA: [], teamB: [], scoreA: 21, scoreB: 18, winner: 'A', log: {}, evId: ev.id, evMatchId: first.id, evEntryIdsA: first.sideAEntryIds, evEntryIdsB: first.sideBEntryIds, eventFormat: 'rotatingGroups' }];
    const before = JSON.stringify({ ev, eventGames });
    const model = deriveScheduleExportModel(ev, { gameList: eventGames, playerList: players, now: new Date(2026, 6, 12, 9).getTime() });
    const firstFileText = await createScheduleHtmlFile(model).text();
    const afterFirstExport = JSON.stringify({ ev, eventGames });
    const next = JSON.parse(JSON.stringify(ev)); next.rotation.revision = 8; next.rotationSchedule = generateRotationScheduleData(next).matches;
    const nextModel = deriveScheduleExportModel(next, { gameList: [], playerList: players, now: new Date(2026, 6, 12, 9).getTime() });
    const secondFileText = await createScheduleHtmlFile(nextModel).text();
    const source = generated.matches.map(m => `${m.round}:${m.court}:${m.sideAEntryIds.join('+')}:${m.sideBEntryIds.join('+')}`);
    const normalized = model.rounds.flatMap(r => r.matches.map(m => `${r.number}:${Number(m.court.split(' ')[1])}:${m.sideA.map(e => Number(e.name.split(' ').pop()) - 1).map(i => `re${i}`).join('+')}:${m.sideB.map(e => Number(e.name.split(' ').pop()) - 1).map(i => `re${i}`).join('+')}`));
    return { model, source, normalized, same: before === afterFirstExport, serialized: JSON.stringify(model), nextRevision: next.rotation.revision, regeneratedChanged: secondFileText !== firstFileText, firstFileText, secondFileText };
  });
  expect(result.model).toMatchObject({ scope: 'full', formatKind: 'rotating', eventName: 'Rotation Model', intervalMinutes: 25, courts: 2, roundCount: 5 });
  expect(result.normalized).toEqual(result.source);
  expect(result.model.rounds.every(r => r.matches.length === 2 && r.byes.length === 2)).toBe(true);
  expect(result.model.rounds.flatMap(r => r.matches).every(m => new Set([...m.sideA, ...m.sideB].map(e => e.name)).size === 4)).toBe(true);
  expect(result.model.rounds[0].matches[0]).toMatchObject({ status: 'Completed', score: '21–18' });
  expect(result.model.rounds[0].matches[0].sideA.every(e => e.players.length === 2)).toBe(true);
  expect(result.same).toBe(true);
  expect(result.nextRevision).toBe(8);
  expect(result.regeneratedChanged).toBe(true);
  expect(result.firstFileText).not.toMatch(/Version\s+7|Rotating Groups/i);
  expect(result.secondFileText).not.toMatch(/Version\s+8|Rotating Groups/i);
  expect(result.serialized).not.toContain('hidden-result-id');
  expect(result.serialized).not.toMatch(/seedRating|rotation-model/i);
});

test('fixed participant export is compact, scored, works without assignments, and stays read-only', async ({ page }) => {
  await seed(page); await page.goto('/');
  const result = await page.evaluate(async () => {
    const ev = {
      id: 'fixed-person', name: 'Participant Cup', eventDate: '2026-07-18', done: false,
      teams: Array.from({ length: 4 }, (_, i) => ({ id: `pt${i}`, name: `Participant Team ${i + 1}`, pool: 'A', players: [`p${i}`] })),
      sched: { start: '10:00', courts: 2, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'participant-fixed', revision: 2 }, brackets: []
    };
    const first = buildSchedule(ev, []).plannedSlots.flat().find(m => m.a === 'pt0' || m.b === 'pt0');
    const game = { id: 'private-game', date: 1, teamA: [], teamB: [], scoreA: 25, scoreB: 17, winner: 'A', log: {}, evId: ev.id, evA: first.a, evB: first.b, label: `Round 1 · ${first.pool ? `Pool ${first.pool}` : 'Scheduled match'}` };
    const before = JSON.stringify({ ev, game });
    const model = deriveParticipantScheduleExportModel(ev, 'team', 'pt0', { gameList: [game], playerList: players, now: new Date(2026, 6, 18, 9).getTime() });
    const html = renderScheduleDocument(model), file = createScheduleHtmlFile(model);
    const noSchedule = { ...ev, id: 'fixed-no-times', sched: undefined };
    const fallback = deriveParticipantScheduleExportModel(noSchedule, 'team', 'pt0', { gameList: [], playerList: players, now: new Date(2026, 6, 18, 9).getTime() });
    const complete = deriveParticipantScheduleExportModel({ ...ev, done: true }, 'team', 'pt0', { gameList: [game], playerList: players, now: new Date(2026, 6, 18, 9).getTime() });
    return { model, html, filename: file.name, fallback, completeRows: complete.rows.length, same: before === JSON.stringify({ ev, game }) };
  });
  expect(result.model).toMatchObject({ scope: 'participant', formatKind: 'fixed', exportTitle: 'Team Schedule', subjectName: 'Participant Team 1', eventDate: 'July 18, 2026' });
  expect(result.model.rows).toHaveLength(3);
  expect(result.model.rows.every(r => r.opponent && r.round && r.time && r.court && r.pool === 'A')).toBe(true);
  expect(result.model.rows.filter(r => r.result)).toHaveLength(1);
  expect(result.html).toContain('Opponent'); expect(result.html).toContain('Round 1'); expect(result.html).toContain('Court');
  expect(result.html).not.toMatch(/standings|rank|record|points|diff|edit/i);
  expect(result.filename).toBe('Participant_Cup_Participant_Team_1_schedule.html');
  expect(result.fallback.rows).toHaveLength(3);
  expect(result.fallback.rows.every(r => r.time === null && r.court === null)).toBe(true);
  expect(result.fallback.note).toContain('not been assigned');
  expect(result.completeRows).toBe(3);
  expect(result.same).toBe(true);
});

test('rotating participant export handles different entry/team sizes, names, results, sit-outs, and solo wording', async ({ page }) => {
  await seed(page, { playerCount: 24 }); await page.goto('/');
  const result = await page.evaluate(() => {
    const ev = {
      id: 'rot-person', name: 'Mixing Night', format: 'rotatingGroups', teams: [], brackets: [],
      entries: Array.from({ length: 8 }, (_, i) => ({ id: `pe${i}`, name: `Entry ${i + 1}`, players: [`p${i}`], manualSeed: i + 1 })),
      rotation: { entrySize: 1, teamSize: 3, rounds: 4, courts: 1, seedMode: 'manual', start: '18:00', setMin: 22, seed: 'person-rotation', revision: 1 }
    };
    ev.rotationSchedule = generateRotationScheduleData(ev).matches;
    const first = ev.rotationSchedule[0], subjectId = first.sideAEntryIds[0];
    const game = { id: 'private-rot-result', date: 1, teamA: [], teamB: [], scoreA: 21, scoreB: 15, winner: 'A', log: {}, evId: ev.id, evMatchId: first.id, evEntryIdsA: first.sideAEntryIds, evEntryIdsB: first.sideBEntryIds, eventFormat: 'rotatingGroups' };
    const before = JSON.stringify({ ev, game });
    const model = deriveParticipantScheduleExportModel(ev, 'entry', subjectId, { gameList: [game], playerList: players, now: new Date(2026, 6, 18, 17).getTime() });
    const html = renderScheduleDocument(model);
    const solo = {
      id: 'solo-person', name: 'Solo Round', format: 'rotatingGroups', teams: [], brackets: [],
      entries: [{ id: 'solo-a', name: 'Alex', players: ['p0'] }, { id: 'solo-b', name: 'Blair', players: ['p1'] }],
      rotation: { entrySize: 1, teamSize: 2, rounds: 1, courts: 1, start: '', setMin: 20 },
      rotationSchedule: [{ id: 'solo-match', round: 1, court: 1, sideAEntryIds: ['solo-a'], sideBEntryIds: ['solo-b'] }]
    };
    const soloModel = deriveParticipantScheduleExportModel(solo, 'entry', 'solo-a', { gameList: [], playerList: players });
    const soloHtml = renderScheduleDocument(soloModel);
    return { model, html, soloModel, soloHtml, same: before === JSON.stringify({ ev, game }) };
  });
  expect(result.model).toMatchObject({ scope: 'participant', formatKind: 'rotating', exportTitle: 'Participant Schedule' });
  const played = result.model.rows.find(r => r.result);
  expect(played.with).toHaveLength(2); expect(played.against).toHaveLength(3);
  expect(played.result).toEqual({ outcome: 'W', score: '21–15' });
  expect(result.model.rows.some(r => r.type === 'bye')).toBe(true);
  expect(result.html).toContain('Playing with'); expect(result.html).toContain('Against'); expect(result.html).toContain('Player');
  expect(result.soloModel.rows[0].with).toEqual([]);
  expect(result.soloHtml).not.toContain('Playing with'); expect(result.soloHtml).toContain('Against');
  expect(result.same).toBe(true);
});

test('team and entry modals expose participant sharing and unavailable exports show a clear toast', async ({ page }) => {
  const fixed = fixedEvent({ name: 'Modal Fixed' }), rotating = rotatingEvent({ entries: 8, rounds: 3, courts: 2, name: 'Modal Rotating' });
  await seed(page, { events: [fixed, rotating], playerCount: 24 }); await page.goto('/');
  await page.evaluate(async () => { const ev = evts[1], made = generateRotationScheduleData(ev); ev.rotationSchedule = made.matches; await saveEvents(); });

  await page.evaluate(() => openTeamSchedule('fixed-share', 't0'));
  await expect(page.locator('.sheet').getByRole('button', { name: 'Save / Share Schedule', exact: true })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Save / Share Schedule', exact: true }).click();
  await expect(page.locator('[data-participant-schedule-preview]')).toContainText('Team Schedule');
  await expect(page.locator('[data-participant-schedule-preview]')).toContainText('Opponent');
  await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click();

  await page.evaluate(() => openEntrySchedule('rot-share', 'e0'));
  await expect(page.locator('.sheet').getByRole('button', { name: 'Save / Share Schedule', exact: true })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Save / Share Schedule', exact: true }).click();
  await expect(page.locator('[data-participant-schedule-preview]')).toContainText('Group Schedule');
  await expect(page.locator('[data-participant-schedule-preview]')).toContainText('Against');
  await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click();

  await page.evaluate(() => { evts[1].rotationSchedule = []; openParticipantScheduleShare('rot-share', 'entry', 'e0'); });
  await expect(page.locator('.toast')).toContainText('No participant schedule is available');
  await expect(page.locator('[data-participant-schedule-preview]')).toHaveCount(0);
});

test('a large five-round schedule creates one deterministic self-contained HTML artifact with every round and match', async ({ page }) => {
  await seed(page, { playerCount: 40 }); await page.goto('/');
  const result = await page.evaluate(async () => {
    const ev = {
      id: 'large-html', name: 'Five Round Summer Championship', format: 'rotatingGroups', teams: [], brackets: [],
      entries: Array.from({ length: 20 }, (_, i) => ({ id: `le${i}`, name: `Very Long Pair Name ${i + 1} With Extra Words`, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1 })),
      rotation: { entrySize: 2, teamSize: 4, rounds: 5, courts: 5, seedMode: 'manual', start: '08:00', setMin: 22, seed: 'large-html-seed', revision: 4 }
    };
    ev.rotationSchedule = generateRotationScheduleData(ev).matches;
    const model = deriveScheduleExportModel(ev, { gameList: [], playerList: players, now: new Date(2026, 6, 12, 7).getTime() });
    const html = renderScheduleDocument(model), again = renderScheduleDocument(model), file = createScheduleHtmlFile(model), text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return {
      artifacts: [file].length, name: file.name, type: file.type, size: file.size, deterministic: html === again && html === text,
      rounds: [...doc.querySelectorAll('.schedule-round-head b')].map(n => n.textContent),
      matches: doc.querySelectorAll('.schedule-match').length, expectedMatches: model.rounds.flatMap(r => r.matches).length,
      courts: [...new Set(model.rounds.flatMap(r => r.matches.map(m => m.court)))],
      entryNamesPresent: ev.entries.every(entry => text.includes(entry.name)), bodyText: doc.body.textContent, text
    };
  });
  expect(result.artifacts).toBe(1);
  expect(result.name).toBe('Five_Round_Summer_Championship_schedule.html');
  expect(result.type).toBe('text/html');
  expect(result.size).toBeGreaterThan(10_000);
  expect(result.size).toBeLessThan(1_000_000);
  expect(result.deterministic).toBe(true);
  expect(result.rounds).toEqual(['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5']);
  expect(result.matches).toBe(result.expectedMatches);
  expect(result.courts).toEqual(['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5']);
  expect(result.entryNamesPresent).toBe(true);
  expect(result.bodyText).not.toMatch(/Pending|Version\s+\d+|Rotating Groups|Fixed Teams/i);
  expect(result.text).toMatch(/<style>[\s\S]*@media print/);
  expect(result.text).toContain('@media (max-width:560px)');
  expect(result.text).not.toMatch(/<link\b|<script\b|https?:\/\/|<canvas\b/i);
});

test('standalone HTML escapes participant values and filenames are safe and readable', async ({ page }) => {
  await seed(page); await page.goto('/');
  const result = await page.evaluate(async () => {
    const dangerous = `<img src=x onerror="alert('x')"> & "quoted"`;
    const model = {
      scope: 'full', formatKind: 'fixed', eventName: `Friday 4s / Finals <script>alert('event')</script>`, hasResults: false,
      startTime: '10:00 AM', intervalMinutes: 20, courts: 1, roundCount: 1,
      rounds: [{ number: 1, time: '10:00 AM', byes: [`Zoë's <bye> 🏐`], matches: [{ court: 'Court 1', pool: 'A&B', label: dangerous, status: 'Pending', score: null, sideA: [{ name: dangerous, players: [] }], sideB: [{ name: `Café's “Aces” 🏐`, players: [] }] }] }]
    };
    const html = renderScheduleDocument(model), doc = new DOMParser().parseFromString(html, 'text/html'), file = createScheduleHtmlFile(model);
    return {
      html, text: doc.body.textContent, scripts: doc.querySelectorAll('script').length, images: doc.querySelectorAll('img').length,
      filename: file.name,
      filenames: [scheduleExportFilename('Summer Smash'), scheduleExportFilename('Friday 4s / Finals'), scheduleExportFilename('... / \\ : * ? " < > | ...'), scheduleExportFilename('')]
    };
  });
  expect(result.scripts).toBe(0);
  expect(result.images).toBe(0);
  expect(result.text).toContain(`<img src=x onerror="alert('x')">`);
  expect(result.text).toContain(`Zoë's <bye> 🏐`);
  expect(result.text).toContain(`Café's “Aces” 🏐`);
  expect(result.html).toContain('&lt;script&gt;');
  expect(result.html).toContain('&#39;');
  expect(result.filename).toBe('Friday_4s_Finals_script_alert_event_script_schedule.html');
  expect(result.filenames).toEqual(['Summer_Smash_schedule.html', 'Friday_4s_Finals_schedule.html', 'court_event_schedule.html', 'court_event_schedule.html']);
});

test('fixed preview shares or downloads exactly one HTML file and preserves all state, scroll, and focus', async ({ page }) => {
  const event = fixedEvent(); await seed(page, { events: [event] }); await openEvent(page, event.name);
  const trigger = page.getByRole('button', { name: 'Save / Share Schedule', exact: true });
  const before = await page.evaluate(() => JSON.stringify({ evts, games, players }));
  await trigger.scrollIntoViewIfNeeded(); const scrollBefore = await page.evaluate(() => window.scrollY); await trigger.click();
  const sheet = page.locator('.sheet'), preview = sheet.locator('[data-schedule-preview]');
  await expect(sheet.getByRole('heading', { name: 'Save / Share Schedule', exact: true })).toBeVisible();
  await expect(preview).toContainText(event.name);
  for (const name of event.teams.map(t => t.name)) await expect(preview).toContainText(name);
  await expect(sheet.getByText('one self-contained document', { exact: false })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Share Schedule', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Download Schedule', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Print / Save as PDF', exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.__shares = []; window.__canShare = []; window.__downloads = []; window.__urls = []; window.__revoked = [];
    URL.createObjectURL = blob => { const url = `blob:schedule-${window.__urls.length + 1}`; window.__urls.push({ url, type: blob.type }); return url; };
    URL.revokeObjectURL = url => window.__revoked.push(url);
    HTMLAnchorElement.prototype.click = function () { window.__downloads.push({ name: this.download, href: this.href }); };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => { window.__canShare.push(data.files.map(f => ({ name: f.name, type: f.type }))); return true; } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { const file = data.files[0]; window.__shares.push({ count: data.files.length, name: file.name, type: file.type, text: await file.text() }); } });
  });
  await sheet.getByRole('button', { name: 'Share Schedule', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1);
  const native = await page.evaluate(() => ({ share: window.__shares[0], canShare: window.__canShare[0], downloads: window.__downloads }));
  expect(native.share).toMatchObject({ count: 1, name: 'Summer_Smash_2026_Finals_schedule.html', type: 'text/html' });
  expect(native.share.text).toContain(event.name);
  expect(native.canShare).toEqual([{ name: 'Summer_Smash_2026_Finals_schedule.html', type: 'text/html' }]);
  expect(native.downloads).toEqual([]);

  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await sheet.getByRole('button', { name: 'Share Schedule', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__downloads.length)).toBe(1);
  await sheet.getByRole('button', { name: 'Download Schedule', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__downloads.length)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__revoked.length)).toBe(2);
  expect(await page.evaluate(() => window.__downloads.map(d => d.name))).toEqual(['Summer_Smash_2026_Finals_schedule.html', 'Summer_Smash_2026_Finals_schedule.html']);
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);

  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(3);
});

test('Print / Save as PDF writes one complete print document and reports blocked popups without mutation', async ({ page }) => {
  const event = fixedEvent({ name: 'Printable Cup' }); await seed(page, { events: [event] }); await openEvent(page, event.name);
  await page.getByRole('button', { name: 'Save / Share Schedule', exact: true }).click();
  const before = await page.evaluate(() => JSON.stringify({ evts, games, players }));
  await page.evaluate(() => {
    window.__printState = { html: '', prints: 0, focuses: 0 };
    window.open = () => ({
      opener: window,
      document: { fonts: { ready: Promise.resolve() }, open() {}, write(html) { window.__printState.html = html; }, close() {} },
      addEventListener() {}, focus() { window.__printState.focuses++; }, print() { window.__printState.prints++; }
    });
  });
  await page.locator('.sheet').getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__printState.prints)).toBe(1);
  const printed = await page.evaluate(() => window.__printState);
  expect(printed.focuses).toBe(1);
  expect(printed.html).toContain('Printable Cup');
  expect(printed.html).toContain('@media print');
  expect(printed.html).toContain('@page{size:portrait');
  expect(printed.html).not.toMatch(/<button\b|Share Schedule|Download Schedule/i);
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);

  await page.evaluate(() => { window.open = () => null; });
  await page.locator('.sheet').getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Print view was blocked');
  expect(await page.evaluate(() => JSON.stringify({ evts, games, players }))).toBe(before);
});

test('rotating preview shows the complete schedule responsively and shares one consolidated file', async ({ page }) => {
  const event = rotatingEvent(); await seed(page, { events: [event], playerCount: 24 }); await page.goto('/');
  await page.evaluate(async () => { const ev = evts[0], made = generateRotationScheduleData(ev); ev.rotationSchedule = made.matches; ev.rotationScheduleQuality = made.quality; await saveEvents(); });
  await page.locator('[data-tab="events"]:visible').first().click(); await page.locator('.ev-row').click();
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1100, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Save / Share Schedule', exact: true }).click();
    const preview = page.locator('[data-schedule-preview]');
    await expect(preview).not.toContainText('Rotating Groups'); await expect(preview).toContainText('Pair 1'); await expect(preview).toContainText('Player 01');
    await expect(preview).toContainText('Team 1'); await expect(preview).toContainText('Team 2'); await expect(preview).toContainText('Byes / sit-outs');
    for (let round = 1; round <= 5; round++) await expect(preview).toContainText(`Round ${round}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${viewport.width}px preview overflow`).toBeLessThanOrEqual(0);
    await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Save / Share Schedule', exact: true }).click();
  await page.evaluate(() => {
    window.__rotShare = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => data.files.length === 1 });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__rotShare = { count: data.files.length, name: data.files[0].name, type: data.files[0].type, text: await data.files[0].text() }; } });
  });
  await page.locator('.sheet').getByRole('button', { name: 'Share Schedule', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__rotShare?.count)).toBe(1);
  const shared = await page.evaluate(() => window.__rotShare);
  expect(shared).toMatchObject({ count: 1, name: 'Rotating_Share_Night_schedule.html', type: 'text/html' });
  expect(shared.text).toContain('Pair 1'); expect(shared.text).toContain('Byes / sit-outs');
});

test('share cancellation is silent, real failures are useful, unsupported sharing downloads once, and empty schedules stay unavailable', async ({ page }) => {
  const event = fixedEvent({ name: 'Error Paths' }); const empty = rotatingEvent({ name: 'No Rotation Yet' });
  await seed(page, { events: [event, empty] }); await openEvent(page, event.name);
  await page.getByRole('button', { name: 'Save / Share Schedule', exact: true }).click();
  await page.evaluate(() => {
    window.__downloads = []; window.__revoked = [];
    URL.createObjectURL = () => 'blob:error-path'; URL.revokeObjectURL = url => window.__revoked.push(url);
    HTMLAnchorElement.prototype.click = function () { window.__downloads.push(this.download); };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancelled', 'AbortError'); } });
  });
  const share = page.locator('.sheet').getByRole('button', { name: 'Share Schedule', exact: true });
  await share.click(); await expect.poll(() => share.isEnabled()).toBe(true); await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__downloads)).toEqual([]);
  await expect(page.locator('.toast')).not.toHaveClass(/show/);

  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('share broke'); } }));
  await share.click(); await expect.poll(() => share.isEnabled()).toBe(true);
  await expect(page.locator('.toast')).toContainText('Could not share the schedule');
  expect(await page.evaluate(() => window.__downloads)).toEqual([]);

  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await share.click(); await expect.poll(() => page.evaluate(() => window.__downloads.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__revoked.length)).toBe(1);
  expect(await page.evaluate(() => window.__downloads)).toEqual(['Error_Paths_schedule.html']);
  await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: '‹ All events', exact: true }).click();
  await page.locator('.ev-row').filter({ hasText: empty.name }).click();
  await expect(page.getByRole('button', { name: 'Save / Share Schedule', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => deriveScheduleExportModel(evts.find(e => e.name === 'No Rotation Yet')))).toBeNull();
});
