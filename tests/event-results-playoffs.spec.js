import { test, expect } from '@playwright/test';

function players(count = 32) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Member ${i + 1}`, seedRating: 70 - i,
    rating: 70 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 70 - i }]
  }));
}

function teams(names) {
  return names.map((name, i) => ({ id: `t${i + 1}`, name, pool: 'A', players: [`p${i}`] }));
}

function matchSets({ evId = 'cup', brId = 'champ', round = 1, match = 1, a, b, scores, start = 200, prefix }) {
  const matchId = `${prefix || `${brId}-${round}-${match}`}-group`;
  return scores.map(([scoreA, scoreB], i) => ({
    id: `${prefix || `${brId}-${round}-${match}`}-s${i + 1}`, date: start + i,
    evId, evA: a, evB: b, evMatchId: `playoff:${brId}:r${round}:m${match}`,
    matchId, teamA: [], teamB: [], unkA: 1, unkB: 1,
    scoreA, scoreB, winner: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null,
    label: `Championship · ${round === 2 ? 'Final' : 'Semifinal'} · Set ${i + 1}`, log: {}
  }));
}

function completeFourTeamEvent({ done = false, includeFinal = true, longName = false } = {}) {
  const roster = teams([
    longName ? 'The Extremely Long Alpha Volleyball Collective That Never Stops Digging' : 'Alpha',
    'Bravo', 'Charlie', 'Delta'
  ]);
  const event = {
    id: 'cup', name: 'Summer Night Championship', eventDate: '2026-07-16', created: 10, done,
    teams: roster, brackets: [{ id: 'champ', name: 'Championship', created: 100, seeds: roster.map(t => t.id) }]
  };
  const games = [
    { id: 'pool-a-b', date: 20, evId: 'cup', evA: 't1', evB: 't2', teamA: [], teamB: [], scoreA: 25, scoreB: 21, winner: 'A', log: {} },
    ...matchSets({ a: 't1', b: 't4', scores: [[25, 16], [25, 18]], start: 200, prefix: 'semi-a' }),
    ...matchSets({ round: 1, match: 2, a: 't2', b: 't3', scores: [[23, 25], [25, 19], [15, 12]], start: 210, prefix: 'semi-b' })
  ];
  if (includeFinal) games.push(...matchSets({ round: 2, match: 1, a: 't1', b: 't2', scores: [[25, 22], [22, 25], [15, 13]], start: 300, prefix: 'final' }));
  return { event, games };
}

async function seed(page, { events, games = [], playerCount = 32 }) {
  await page.addInitScript(({ events, games, roster }) => {
    if (sessionStorage.getItem('court:event-results-test-seeded') === '1') return;
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
    sessionStorage.setItem('court:event-results-test-seeded', '1');
  }, { events, games, roster: players(playerCount) });
}

async function openEvent(page) {
  await page.goto('/');
  await page.locator('[data-tab="events"]:visible').click();
  await page.locator('.ev-row').first().click();
}

test('completed fixed event finale and full recap derive champion, runner-up, score, journey, standings, and supported highlights', async ({ page }) => {
  const { event, games } = completeFourTeamEvent({ done: true, longName: true });
  await seed(page, { events: [event], games }); await openEvent(page);

  const model = await page.evaluate(() => {
    const ev = evts[0], summary = getEventResultSummary(ev), data = eventResultsData(ev);
    return { summary: { status: summary.status, champion: summary.champion, runner: summary.runner, score: summary.score, seed: summary.championSeed, matches: summary.matchCount }, data };
  });
  expect(model.summary).toMatchObject({ status: 'CHAMPION CROWNED', champion: event.teams[0].name, runner: 'Bravo', score: '2-1', seed: 1, matches: 4 });
  expect(model.data.podiums[0].journey.map(step => [step.round, step.opponent, step.score])).toEqual([
    ['Semifinal', 'Delta', '2-0'], ['Final', 'Bravo', '2-1']
  ]);
  expect(model.data.standings[0].name).toBe(event.teams[0].name);
  expect(model.data.highlights.some(h => h.kind === 'finalSet')).toBe(true);
  expect(model.data.highlights).toEqual((await page.evaluate(() => getEventResultHighlights(evts[0]))));

  const hero = page.locator('[data-event-finale]');
  await expect(hero).toContainText('CHAMPION CROWNED');
  await expect(hero).toContainText(event.teams[0].name);
  await expect(hero).toContainText('Bravo');
  expect(await hero.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

  await hero.getByRole('button', { name: 'View championship match' }).click();
  await expect(page.locator('.sheet').getByRole('button', { name: 'Edit result' })).toBeVisible();
  await expect(page.locator('.sheet').getByRole('button', { name: 'Delete result' })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click();
  await hero.getByRole('button', { name: 'View full results' }).click();
  const sheet = page.locator('.sheet');
  await expect(sheet.getByRole('heading', { name: 'Full event results' })).toBeVisible();
  await expect(sheet).toContainText(/champion journey/i);
  await expect(sheet).toContainText('Combined event standings');
  await expect(sheet).toContainText('Event highlights');
  await expect(sheet).not.toContainText('v0.');
  const exportInfo = await page.evaluate(async () => {
    const canvas = document.querySelector('#resultsCanvas');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return { width: canvas.width, height: canvas.height, bytes: blob?.size || 0 };
  });
  expect(exportInfo.width).toBe(1080); expect(exportInfo.height).toBeGreaterThan(1100); expect(exportInfo.bytes).toBeGreaterThan(1000);
});

test('an unfinished final never declares a champion and older optional fields remain safe', async ({ page }) => {
  const { event, games } = completeFourTeamEvent({ includeFinal: false });
  delete event.eventDate; delete event.done;
  await seed(page, { events: [event], games }); await openEvent(page);
  const result = await page.evaluate(() => {
    const summary = getEventResultSummary(evts[0]), html = championsStripHtml(evts[0]);
    return { status: summary.status, champion: summary.champion, runner: summary.runner, html, data: eventResultsData(evts[0]) };
  });
  expect(result).toMatchObject({ status: 'PLAYOFFS IN PROGRESS', champion: null, runner: null });
  expect(result.html).toContain('Championship pending');
  await expect(page.locator('[data-event-finale]')).not.toContainText('CHAMPION CROWNED');
  await page.getByRole('button', { name: 'View full results' }).click();
  await expect(page.locator('.sheet')).toContainText('No champion is declared until a final result is saved');
});

test('ready and completed matchup cards stay interactive, expose details, set scores, close, and keyboard focus return', async ({ page }) => {
  const { event, games } = completeFourTeamEvent({ includeFinal: false });
  await seed(page, { events: [event], games }); await openEvent(page);
  const completed = page.getByRole('button', { name: /Open completed semifinal: Alpha defeated Delta/i });
  await completed.focus(); await page.keyboard.press('Enter');
  const sheet = page.locator('.sheet');
  await expect(sheet.getByRole('heading', { name: 'Match details' })).toBeVisible();
  await expect(sheet).toContainText('25'); await expect(sheet).toContainText('16'); await expect(sheet).toContainText('Set 2');
  await expect(sheet.getByRole('button', { name: 'View canonical saved game' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(completed).toBeFocused();

  const final = page.getByRole('button', { name: /Open Championship Final: seed 1 Alpha versus seed 2 Bravo/i });
  await final.click();
  await expect(page.locator('.sheet').getByRole('heading', { name: /Log a game/ })).toBeVisible();
  expect(await page.evaluate(() => window._evGameDraft.evMatchId)).toBe('playoff:champ:r2:m1');
  await expect(page.locator('.sheet').getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('editing an upstream winner reuses saved game IDs and tombstones impossible downstream results without duplicates', async ({ page }) => {
  const { event, games } = completeFourTeamEvent();
  const originalSemiIds = games.filter(g => g.id.startsWith('semi-a')).map(g => g.id);
  const finalIds = games.filter(g => g.id.startsWith('final')).map(g => g.id);
  await seed(page, { events: [event], games }); await openEvent(page);
  await page.getByRole('button', { name: /Open completed semifinal: Alpha defeated Delta/i }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Edit result' }).click();
  await page.locator('#evs1A').fill('14'); await page.locator('#evs1B').fill('25');
  await page.locator('#evs2A').fill('18'); await page.locator('#evs2B').fill('25');
  await page.locator('#evs3A').fill(''); await page.locator('#evs3B').fill('');
  await page.getByRole('button', { name: 'Update result' }).click();
  const confirm = page.locator('[role="alertdialog"]');
  await expect(confirm).toContainText('later playoff result');
  await confirm.getByRole('button', { name: 'Update bracket' }).click();

  const state = await page.evaluate(() => {
    const ev = evts[0], br = ev.brackets[0], bs = bracketState(ev, br), deletions = Sync.deletionState();
    return { semiWinner: bs.rounds[0][0].winner, finalA: bs.rounds[1][0].a, finalB: bs.rounds[1][0].b, finalWinner: bs.rounds[1][0].winner,
      ids: games.map(g => g.id), tomb: deletions.games, exactGroups: games.filter(g => g.evMatchId === 'playoff:champ:r1:m1').length };
  });
  expect(state).toMatchObject({ semiWinner: 't4', finalA: 't4', finalB: 't2', finalWinner: null, exactGroups: 2 });
  expect(originalSemiIds.every(id => state.ids.includes(id))).toBe(true);
  expect(finalIds.every(id => !state.ids.includes(id) && state.tomb[id] > 0)).toBe(true);
  expect(new Set(state.ids).size).toBe(state.ids.length);
  await page.reload();
  expect(await page.evaluate(() => {
    const ev = evts[0], state = bracketState(ev, ev.brackets[0]);
    return { semi: state.rounds[0][0].winner, final: state.rounds[1][0].winner, games: games.filter(g => g.evMatchId === 'playoff:champ:r1:m1').length };
  })).toEqual({ semi: 't4', final: null, games: 2 });
});

test('deleting an upstream result un-advances it, removes dependent games, and leaves another division untouched', async ({ page }) => {
  const first = completeFourTeamEvent();
  const extraTeams = teams(['Echo', 'Foxtrot']).map((t, i) => ({ ...t, id: `s${i + 1}`, players: [`p${i + 10}`] }));
  first.event.teams.push(...extraTeams);
  first.event.brackets.push({ id: 'silver', name: 'Silver', created: 150, seeds: extraTeams.map(t => t.id) });
  first.games.push(...matchSets({ brId: 'silver', round: 1, match: 1, a: 's1', b: 's2', scores: [[25, 20], [25, 21]], start: 400, prefix: 'silver-final' }));
  await seed(page, { events: [first.event], games: first.games }); await page.goto('/');
  const result = await page.evaluate(async () => {
    window.askConfirm = async () => true;
    await deletePlayoffMatchResult('cup', 'champ', 0, 0);
    const ev = evts[0], championship = bracketState(ev, ev.brackets[0]), silver = bracketState(ev, ev.brackets[1]);
    return { championshipSemi: championship.rounds[0][0].winner, championshipFinal: championship.rounds[1][0].winner,
      silverChampion: silver.rounds[0][0].winner, ids: games.map(g => g.id), tomb: Sync.deletionState().games };
  });
  expect(result).toMatchObject({ championshipSemi: null, championshipFinal: null, silverChampion: 's1' });
  expect(result.ids.some(id => id.startsWith('silver-final'))).toBe(true);
  expect(result.ids.some(id => id.startsWith('final'))).toBe(false);
  expect(result.tomb['semi-a-s1']).toBeGreaterThan(0);
});

test('byes advance without fake games and a rotating champion recap shows playoff members and pool-entry standings', async ({ page }) => {
  const entryList = Array.from({ length: 6 }, (_, i) => ({ id: `e${i + 1}`, name: `Entry ${i + 1}`, players: [`p${i}`], manualSeed: i + 1 }));
  const playoffTeams = [
    { id: 'rt1', name: 'Entry 1 + Entry 2', players: ['p0', 'p1'], entryIds: ['e1', 'e2'] },
    { id: 'rt2', name: 'Entry 3 + Entry 4', players: ['p2', 'p3'], entryIds: ['e3', 'e4'] },
    { id: 'rt3', name: 'Entry 5 + Entry 6', players: ['p4', 'p5'], entryIds: ['e5', 'e6'] }
  ];
  const event = { id: 'rot', name: 'Rotating Finale', eventDate: '2026-07-16', created: 1, done: true, format: 'rotatingGroups', entries: entryList, teams: playoffTeams,
    rotation: { entrySize: 1, teamSize: 2, rounds: 1, courts: 1, seedMode: 'manual', winPoints: 1, tiePoints: .5, lossPoints: 0 }, rotationSchedule: [],
    brackets: [{ id: 'gold', name: 'Gold', created: 100, seeds: playoffTeams.map(t => t.id) }] };
  const pool = { id: 'pool', date: 20, evId: 'rot', evMatchId: 'pool-1', eventFormat: 'rotatingGroups', evEntryIdsA: ['e1', 'e2'], evEntryIdsB: ['e3', 'e4'], teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], scoreA: 25, scoreB: 20, winner: 'A', log: {} };
  const games = [pool,
    ...matchSets({ evId: 'rot', brId: 'gold', round: 1, match: 2, a: 'rt2', b: 'rt3', scores: [[25, 20], [25, 21]], start: 200, prefix: 'rot-semi' }),
    ...matchSets({ evId: 'rot', brId: 'gold', round: 2, match: 1, a: 'rt1', b: 'rt2', scores: [[25, 18], [25, 19]], start: 300, prefix: 'rot-final' })];
  await seed(page, { events: [event], games }); await openEvent(page);
  const model = await page.evaluate(() => ({ state: bracketState(evts[0], evts[0].brackets[0]), data: eventResultsData(evts[0]) }));
  expect(model.state.rounds[0][0]).toMatchObject({ bye: true, winner: 'rt1', res: null });
  expect(model.data.podiums[0].journey[0]).toMatchObject({ round: 'Semifinal', bye: true, score: null });
  expect(model.data.standings.map(r => r.name)).toContain('Entry 1');
  await expect(page.locator('[data-event-finale]')).toContainText('Member 1, Member 2');
  await expect(page.locator('.br-match').filter({ hasText: 'Bye · advances' })).toHaveCount(1);
});

test('large recap and compact exports stay readable, bounded, and free of internal version controls', async ({ page }) => {
  const roster = teams(Array.from({ length: 20 }, (_, i) => `Team ${String(i + 1).padStart(2, '0')} With A Readable Name`));
  const games = Array.from({ length: 19 }, (_, i) => ({ id: `large-${i}`, date: 10 + i, evId: 'large', evA: roster[i].id, evB: roster[i + 1].id, teamA: [], teamB: [], scoreA: 25, scoreB: 20, winner: 'A', log: {} }));
  const event = { id: 'large', name: 'Twenty Team Results Showcase', eventDate: '2026-07-16', created: 1, done: true, teams: roster, brackets: [] };
  await seed(page, { events: [event], games }); await page.goto('/');
  const exports = await page.evaluate(async () => {
    const ev = evts[0], render = async mode => { const canvas = document.createElement('canvas'); drawEventResultsCard(canvas, eventResultsData(ev, mode)); const blob = await new Promise(resolve => canvas.toBlob(resolve)); return { width: canvas.width, height: canvas.height, bytes: blob?.size || 0 }; };
    return { recap: await render('recap'), compact: await render('compact'), html: eventResultsHtml(ev, eventResultsData(ev)) };
  });
  expect(exports.recap).toMatchObject({ width: 1080 }); expect(exports.recap.height).toBeGreaterThan(1800); expect(exports.recap.height).toBeLessThanOrEqual(7800); expect(exports.recap.bytes).toBeGreaterThan(1000);
  expect(exports.compact).toMatchObject({ width: 1080 }); expect(exports.compact.height).toBeLessThan(exports.recap.height); expect(exports.compact.bytes).toBeGreaterThan(1000);
  expect(exports.html).not.toContain('APP_INFO'); expect(exports.html).not.toMatch(/Build \d{8}/); expect(exports.html).not.toContain('Edit result');
  expect(await page.evaluate(() => getEventResultHighlights(evts[0]).every(h => !/\b0\b/.test(h.text)))).toBe(true);
});

test('a 16-team bracket contains horizontal overflow without clipping the page or shrinking tap targets', async ({ page }) => {
  const roster = teams(Array.from({ length: 16 }, (_, i) => `Seed ${i + 1}`));
  const event = { id: 'wide', name: 'Wide Bracket', eventDate: '2026-07-16', created: 1, done: false, teams: roster,
    brackets: [{ id: 'wide-bracket', name: 'Championship', created: 100, seeds: roster.map(t => t.id) }] };
  await seed(page, { events: [event] }); await openEvent(page);
  const mobile = await page.evaluate(() => {
    const scroll = document.querySelector('.bracket-scroll'), card = document.querySelector('.br-match');
    return { inner: innerWidth, pageWidth: document.documentElement.scrollWidth, scrollClient: scroll.clientWidth, scrollWidth: scroll.scrollWidth, cardWidth: card.getBoundingClientRect().width, cardHeight: card.getBoundingClientRect().height };
  });
  expect(mobile.pageWidth).toBeLessThanOrEqual(mobile.inner + 1);
  expect(mobile.scrollWidth).toBeGreaterThan(mobile.scrollClient);
  expect(mobile.cardWidth).toBeGreaterThanOrEqual(170); expect(mobile.cardHeight).toBeGreaterThanOrEqual(80);
  await expect(page.locator('.br-match.ready')).toHaveCount(8);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.locator('.bracket-scroll').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(800);
});
