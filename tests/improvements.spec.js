import { test, expect } from '@playwright/test';

function roster(count = 24) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`,
    seedRating: 40 + (i % 30), active: true, archived: false, roles: {}
  }));
}

async function seed(page, { playerCount = 24, events = [], games = [] } = {}) {
  await page.addInitScript(({ ps, events, games }) => {
    localStorage.setItem('vb:players', JSON.stringify(ps));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { ps: roster(playerCount), events, games });
}

async function nav(page, name) {
  await page.locator(`[data-tab="${name.toLowerCase()}"]:visible`).first().click();
}

test('local roster interactions preserve scroll and search focus while destination navigation starts at top', async ({ page }) => {
  await seed(page, { playerCount: 40 });
  await page.goto('/');
  await nav(page, 'Track');
  const list = page.locator('[data-preserve-scroll="track-roster"]');
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const before = await list.evaluate(el => el.scrollTop);
  const last = list.locator('.track-pick-row').last().getByRole('button');
  await last.click();
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(before - 8);

  const search = page.getByRole('searchbox', { name: 'Search available players', exact: true });
  await search.fill('Player 40');
  await last.click();
  await expect(search).toHaveValue('Player 40');
  await expect(last).toBeFocused();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await nav(page, 'Teams');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
});

test('Scout Solo and Teams share searchable selectors with filtered select-all behavior', async ({ page }) => {
  await seed(page, { playerCount: 16 });
  await page.goto('/');
  await nav(page, 'Track');
  await page.locator('.mode-btn').filter({ hasText: 'Scout / Solo' }).click();
  const soloSearch = page.getByRole('searchbox', { name: 'Search roster', exact: true });
  await soloSearch.fill('Player 16');
  await page.locator('[data-selector="solo"] .chip').filter({ hasText: 'Player 16' }).click();
  await expect(soloSearch).toHaveValue('Player 16');
  await expect(page.locator('[data-selector="solo"] .chip').filter({ hasText: 'Player 16' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Start solo tracking', exact: true })).toBeEnabled();

  await nav(page, 'Teams');
  const teamSearch = page.getByRole('searchbox', { name: 'Search attendance', exact: true });
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await teamSearch.fill('Player 01');
  await expect(page.getByRole('button', { name: 'Select filtered', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select filtered', exact: true }).click();
  expect(await page.evaluate(() => [...window._pool])).toEqual(['p0']);
});

test('event subtabs place section starts below sticky navigation without vertical movement from horizontal reveal', async ({ page }) => {
  const ps = roster(4);
  const event = { id: 'fixed', name: 'Fixed Cup', created: 1, done: false, teams: [
    { id: 'a', name: 'A', players: [ps[0].id] }, { id: 'b', name: 'B', players: [ps[1].id] }
  ], brackets: [] };
  await seed(page, { playerCount: 4, events: [event] });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport); await page.goto('/'); await nav(page, 'Events');
    await page.locator('.ev-row').click();
    for (const label of ['Schedule', 'Standings', 'Playoffs', 'Teams']) {
      await page.getByRole('navigation', { name: 'Event sections' }).getByRole('button', { name: label, exact: true }).click();
      const top = await page.locator(`#event-${label.toLowerCase()}`).evaluate(el => el.getBoundingClientRect().top);
      expect(top).toBeGreaterThan(95); expect(top).toBeLessThan(150);
    }
    const y = await page.evaluate(() => window.scrollY);
    await page.getByRole('navigation', { name: 'Event sections' }).getByRole('button', { name: 'Teams', exact: true }).click();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThan(2);
  }
});

test('rotating configuration validates general divisible formats and rejects fixed or uneven groups', async ({ page }) => {
  await seed(page); await page.goto('/');
  const values = await page.evaluate(() => [[1,2],[1,4],[2,4],[2,6],[3,6],[4,6],[3,4],[4,4],[0,4],[-1,6],[2,8]].map(([e,t]) => validateRotationConfig(e,t)));
  expect(values.slice(0,5).every(v => v.valid)).toBe(true);
  expect(values.slice(5,10).every(v => !v.valid)).toBe(true);
  expect(values[10]).toMatchObject({ valid: true, entriesPerSide: 4, entriesPerMatch: 8, playersPerMatch: 16 });
  expect(values[7].error).toContain('Fixed Teams');
});

test('rotating schedules support individuals, pairs, trios, custom sides, and fair deterministic rounds', async ({ page }) => {
  await seed(page, { playerCount: 40 }); await page.goto('/');
  const cases = [[1,2,4,1],[1,2,5,2],[1,4,8,1],[1,4,12,2],[2,4,5,1],[2,4,12,4],[2,6,7,1],[2,6,18,4],[3,6,5,1],[3,6,10,3],[2,8,12,2]];
  const results = await page.evaluate(cases => cases.map(([entrySize,teamSize,n,courts],ci) => {
    const entries = Array.from({ length: n }, (_, i) => ({ id: `e${ci}-${i}`, name: `Entry ${i}`, players: Array.from({ length: entrySize }, (_, j) => `p${i * entrySize + j}`) }));
    const ev = { id: `ev${ci}`, format: 'rotatingGroups', rotation: { entrySize, teamSize, rounds: 5, courts }, entries };
    const one = generateRotationScheduleData(ev), two = generateRotationScheduleData(ev), per = teamSize / entrySize;
    const valid = one.matches.every(m => m.sideAEntryIds.length === per && m.sideBEntryIds.length === per && new Set([...m.sideAEntryIds, ...m.sideBEntryIds]).size === per * 2 && rotationMatchPlayers(ev,m.sideAEntryIds).length === teamSize && rotationMatchPlayers(ev,m.sideBEntryIds).length === teamSize);
    const rounds = Object.values(Object.groupBy(one.matches, m => m.round));
    const noRoundOverlap = rounds.every(ms => { const ids=ms.flatMap(m => [...m.sideAEntryIds, ...m.sideBEntryIds]); return ids.length === new Set(ids).size; });
    return { entrySize, teamSize, n, deterministic: JSON.stringify(one) === JSON.stringify(two), valid, noRoundOverlap, quality: one.quality };
  }), cases);
  for (const result of results) {
    expect(result.deterministic, JSON.stringify(result)).toBe(true);
    expect(result.valid, JSON.stringify(result)).toBe(true);
    expect(result.noRoundOverlap, JSON.stringify(result)).toBe(true);
    expect(result.quality.gamesMax - result.quality.gamesMin).toBeLessThanOrEqual(1);
    expect(result.quality.byesMax - result.quality.byesMin).toBeLessThanOrEqual(1);
    expect(result.quality.repeatedTeammates).toBeGreaterThanOrEqual(0);
    expect(result.quality.repeatedOpponents).toBeGreaterThanOrEqual(0);
  }
});

test('legacy Rotating Pairs 4s remains linked without view-time storage mutation', async ({ page }) => {
  const pairs = Array.from({ length: 4 }, (_, i) => ({ id: `q${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], created: i }));
  const event = { id: 'pairs', name: 'Pairs Night', created: 1, done: false, format: 'rotatingPairs4s', teams: [], pairs,
    pairSettings: { rounds: 1, courts: 1, seedMode: 'rating', winPoints: 1, tiePoints: .5, lossPoints: 0, tiebreakers: ['winPct', 'standingsPoints', 'pointDiff', 'pointsFor'] },
    pairSchedule: [{ id: 'pairs-r1-c1', round: 1, court: 1, pairIdsA: ['q0', 'q1'], pairIdsB: ['q2', 'q3'], status: 'pending' }] };
  const legacyGame={id:'legacy-result',date:2,teamA:['p0','p1','p2','p3'],teamB:['p4','p5','p6','p7'],scoreA:25,scoreB:20,winner:'A',log:{},evId:'pairs',evMatchId:'pairs-r1-c1',evPairIdsA:['q0','q1'],evPairIdsB:['q2','q3'],eventFormat:'rotatingPairs4s'};
  await seed(page, { playerCount: 8, events: [event], games:[legacyGame] }); await page.goto('/');
  const legacy = await page.evaluate(() => ({ raw:localStorage.getItem('vb:events'), format:eventFormat(evts[0]), rotation:rotationSettings(evts[0]), entries:rotatingEntries(evts[0]), schedule:rotationSchedule(evts[0]), standings:entryStandings(evts[0]).map(r=>({id:r.entry.id,w:r.wins,l:r.losses})), gameCount:games.length }));
  expect(legacy.format).toBe('rotatingGroups'); expect(legacy.rotation).toMatchObject({entrySize:2,teamSize:4});
  expect(legacy.entries).toHaveLength(4); expect(legacy.schedule[0]).toMatchObject({sideAEntryIds:['q0','q1'],sideBEntryIds:['q2','q3']});
  expect(legacy.standings.filter(r=>r.w===1)).toHaveLength(2); expect(legacy.standings.filter(r=>r.l===1)).toHaveLength(2); expect(legacy.gameCount).toBe(1);
  expect(JSON.parse(legacy.raw)[0]).toEqual(event);
  await nav(page, 'Events'); await page.locator('.ev-row').click();
  await expect(page.getByRole('heading',{name:'Pairs Night',exact:true})).toBeVisible();
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('vb:events')))[0]).toEqual(event);
  const generalized=await page.evaluate(()=>{const before=entryStandings(evts[0]).map(r=>[r.entry.id,r.wins,r.losses]);materializeRotation(evts[0]);const json=JSON.parse(JSON.stringify(evts[0]));return {json,before,after:entryStandings(json).map(r=>[r.entry.id,r.wins,r.losses])};});
  expect(generalized.json).toMatchObject({format:'rotatingGroups',rotation:{entrySize:2,teamSize:4},entries:expect.any(Array),rotationSchedule:expect.any(Array)});
  expect(generalized.json.pairs).toBeUndefined();expect(generalized.json.pairSchedule).toBeUndefined();expect(generalized.after).toEqual(generalized.before);
});

test('generalized rotating score saves a normal 6v6 game, derives entry standings, and deletion removes the result', async ({ page }) => {
  const entries = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], created: i }));
  const event = { id: 'groups', name: 'Pairs 6s', created: 1, done: false, format: 'rotatingGroups', teams: [], entries,
    rotation: { entrySize:2,teamSize:6,rounds:1,courts:1,seedMode:'rating',winPoints:1,tiePoints:.5,lossPoints:0,tiebreakers:['winPct','standingsPoints','pointDiff','pointsFor'] },
    rotationSchedule: [{ id:'groups-r1-c1',round:1,court:1,sideAEntryIds:['e0','e1','e2'],sideBEntryIds:['e3','e4','e5'],status:'pending' }] };
  await seed(page, { playerCount: 12, events: [event] }); await page.goto('/'); await nav(page, 'Events');
  await page.locator('.ev-row').click();
  await page.getByRole('button', { name: 'Log final score', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Side A score' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Side B score' }).fill('20');
  await page.getByRole('button', { name: 'Save result', exact: true }).click();
  const state = await page.evaluate(() => ({ game: games[0], standings: entryStandings(evts[0]).map(r => ({ id: r.entry.id, w: r.wins, l: r.losses, diff: r.diff, teammates:r.teammates.size, opponents:r.opponents.size })) }));
  expect(state.game.teamA).toHaveLength(6); expect(state.game.teamB).toHaveLength(6);
  expect(state.game).toMatchObject({eventFormat:'rotatingGroups',evEntryIdsA:['e0','e1','e2'],evEntryIdsB:['e3','e4','e5']});
  expect(state.standings.filter(r => r.w === 1)).toHaveLength(3); expect(state.standings.filter(r => r.l === 1)).toHaveLength(3);
  expect(state.standings.every(r=>r.teammates===2&&r.opponents===3)).toBe(true);
  await page.getByRole('button', { name: /Final · 25–20/ }).click();
  await page.getByRole('button', { name: 'Delete game', exact: true }).click();
  await page.locator('.scrim').last().getByRole('button', { name: 'Delete game', exact: true }).click();
  expect(await page.evaluate(() => games.length)).toBe(0);
  expect(await page.evaluate(() => entryStandings(evts[0]).every(r => r.played === 0))).toBe(true);
});

test('event creation explains and validates Rotating Groups live', async ({ page }) => {
  await seed(page); await page.goto('/'); await nav(page,'Events'); await page.getByRole('button',{name:'New event',exact:true}).click();
  await page.getByRole('button',{name:'Rotating Groups',exact:true}).click();
  await expect(page.getByText('Players register alone or in fixed groups. Each round, multiple groups combine into temporary teams. Standings belong to each registered group.',{exact:true})).toBeVisible();
  const individualPreset=page.getByRole('button',{name:'1 · Individual',exact:true}),pairPreset=page.getByRole('button',{name:'2 · Pair',exact:true}),twoSidePreset=page.getByRole('button',{name:'2s',exact:true}),fourSidePreset=page.getByRole('button',{name:'4s',exact:true});
  await expect(pairPreset).toHaveClass(/on/);await expect(pairPreset).toHaveAttribute('aria-pressed','true');await expect(fourSidePreset).toHaveClass(/on/);
  await individualPreset.click();await expect(individualPreset).toHaveClass(/on/);await expect(pairPreset).not.toHaveClass(/on/);await expect(pairPreset).toHaveAttribute('aria-pressed','false');
  await twoSidePreset.click();await expect(twoSidePreset).toHaveClass(/on/);await expect(fourSidePreset).not.toHaveClass(/on/);
  await page.getByRole('spinbutton',{name:'Custom players who stay together'}).fill('5');await expect(individualPreset).not.toHaveClass(/on/);await expect(pairPreset).not.toHaveClass(/on/);
  await page.getByRole('spinbutton',{name:'Custom players per side'}).fill('8');await expect(twoSidePreset).not.toHaveClass(/on/);await expect(fourSidePreset).not.toHaveClass(/on/);
  await page.getByRole('spinbutton',{name:'Custom players who stay together'}).fill('3');
  await page.getByRole('spinbutton',{name:'Custom players per side'}).fill('6');
  await expect(page.getByText('Each side will contain 2 trios. 4 entries and 12 players are needed per match.',{exact:true})).toBeVisible();
  await page.getByRole('spinbutton',{name:'Custom players who stay together'}).fill('4');
  await expect(page.getByText('6 players per side cannot be formed evenly from groups of 4.',{exact:true})).toBeVisible();
});

test('entry editor enforces configured size, creates a trio name, and prevents duplicate assignment', async ({ page }) => {
  const event={id:'trios',name:'Trio Night',created:1,done:false,format:'rotatingGroups',teams:[],entries:[],rotation:{entrySize:3,teamSize:6,rounds:2,courts:1,seedMode:'rating'},rotationSchedule:[]};
  await seed(page,{playerCount:8,events:[event]});await page.goto('/');await nav(page,'Events');await page.locator('.ev-row').click();
  await page.getByRole('button',{name:'Entries',exact:true}).click();await page.getByRole('button',{name:'Add entry',exact:true}).click();
  const saveEntry=page.getByRole('button',{name:'Save entry',exact:true});await expect(saveEntry).toBeDisabled();
  for(const name of ['Player 01','Player 02'])await page.getByRole('button',{name}).click();
  await expect(saveEntry).toBeDisabled();await page.getByRole('button',{name:'Player 03'}).click();await expect(saveEntry).toBeEnabled();await saveEntry.click();
  expect(await page.evaluate(()=>evts[0].entries[0])).toMatchObject({name:'Player 01 + Player 02 + Player 03',players:['p0','p1','p2']});
  await page.getByRole('button',{name:'Add entry',exact:true}).click();await expect(page.getByRole('button',{name:'Player 01 · assigned'})).toBeDisabled();
});

test('rotating match validation and Track handoff flatten individual, pair, and trio entries correctly', async ({ page }) => {
  const build=(id,entrySize,teamSize)=>{const per=teamSize/entrySize,entries=Array.from({length:per*2},(_,i)=>({id:`${id}-e${i}`,name:`Entry ${i}`,players:Array.from({length:entrySize},(_,j)=>`p${i*entrySize+j}`)}));return {id,name:id,created:1,done:false,format:'rotatingGroups',teams:[],entries,rotation:{entrySize,teamSize,rounds:1,courts:1},rotationSchedule:[{id:`${id}-m`,round:1,court:1,sideAEntryIds:entries.slice(0,per).map(e=>e.id),sideBEntryIds:entries.slice(per).map(e=>e.id)}]};};
  const events=[build('Individuals 2s',1,2),build('Pairs 4s',2,4),build('Pairs 6s',2,6),build('Trios 6s',3,6)];
  await seed(page,{playerCount:16,events});await page.goto('/');
  const checks=await page.evaluate(()=>evts.map(ev=>{const m=rotationSchedule(ev)[0],v=validateRotationMatch(ev,m);return {name:ev.name,a:v.A.length,b:v.B.length,unique:new Set([...v.A,...v.B]).size,entryIds:m.sideAEntryIds.length};}));
  expect(checks).toEqual([{name:'Individuals 2s',a:2,b:2,unique:4,entryIds:2},{name:'Pairs 4s',a:4,b:4,unique:8,entryIds:2},{name:'Pairs 6s',a:6,b:6,unique:12,entryIds:3},{name:'Trios 6s',a:6,b:6,unique:12,entryIds:2}]);
  await page.evaluate(()=>trackRotationMatch('Trios 6s','Trios 6s-m'));
  await page.getByRole('button',{name:'Start tracking',exact:true}).click();
  expect(await page.evaluate(()=>({a:live.teamA.length,b:live.teamB.length,meta:live.evt}))).toMatchObject({a:6,b:6,meta:{eventFormat:'rotatingGroups',evEntryIdsA:['Trios 6s-e0','Trios 6s-e1'],evEntryIdsB:['Trios 6s-e2','Trios 6s-e3']}});
});
