import { test, expect } from '@playwright/test';

function roster(count = 40) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${i + 1}`, seedRating: 80 - i,
    rating: 80 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 80 - i }]
  }));
}

async function seed(page, { events = [], games = [], playerCount = 40 } = {}) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { events, games, players: roster(playerCount) });
}

async function buildRotation(page, { names, pattern = 'adjacent', entrySize = 2, teamSize = 4, played = true }) {
  return page.evaluate(async ({ names, pattern, entrySize, teamSize, played }) => {
    const entries = names.map((name, i) => ({
      id: `e${i}`, name, manualSeed: i + 1, created: i + 1,
      players: Array.from({ length: entrySize }, (_, j) => `p${i * entrySize + j}`)
    }));
    const ev = { id: 'rotation', name: 'Rotation Cup', created: 1, done: false, format: 'rotatingGroups',
      entries, teams: [], brackets: [], rotationSchedule: [],
      rotation: { entrySize, teamSize, rounds: 3, courts: 2, seedMode: 'manual', winPoints: 1, tiePoints: .5,
        lossPoints: 0, tiebreakers: ['winPct', 'standingsPoints', 'wins', 'pointDiff', 'pointsFor'] } };
    evts = [ev]; games = [];
    if (played) names.forEach((_, i) => games.push({
      id: `pool${i}`, matchId: `pool-match${i}`, date: 100 + i, evId: ev.id, evMatchId: `rotation-match${i}`,
      evEntryIdsA: [`e${i}`], evEntryIdsB: [`historical-opponent-${i}`], eventFormat: 'rotatingGroups',
      teamA: entries[i].players.slice(), teamB: [], scoreA: 100 - i, scoreB: 0, winner: 'A', log: {}
    }));
    window._rpDraft = { evId: ev.id, pattern };
    await saveRotationPlayoffTeams();
    const saved = evts[0];
    openBracketSetup(saved.id);
    return {
      teams: saved.teams.map(t => ({ id: t.id, name: t.name, entryIds: t.entryIds, playoffSource: t.playoffSource })),
      seeds: window._brDraft.seeds.slice(), sheet: document.querySelector('.sheet').textContent,
      valid: validGeneratedPlayoffMetadata(saved), basis: rotationPlayoffOrderBasis(saved)
    };
  }, { names, pattern, entrySize, teamSize, played });
}

test('adjacent rotating playoff preview becomes the automatic bracket order and awards the correct byes', async ({ page }) => {
  await seed(page); await page.goto('/');
  const ranked = ['F', 'G', 'I', 'H', 'B', 'D', 'L', 'K', 'E', 'C', 'J', 'A'];
  const result = await buildRotation(page, { names: ranked });
  expect(result.teams.map(t => t.name)).toEqual(['F + G', 'I + H', 'B + D', 'L + K', 'E + C', 'J + A']);
  expect(result.teams.map(t => t.playoffSource.derivedSeed)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(result.teams.every(t => t.playoffSource.sourceOrderBasis === 'standings')).toBe(true);
  expect(result.seeds).toEqual(result.teams.map(t => t.id));
  expect(result.valid).toBe(true);
  expect(result.sheet).toContain('From rotating pool standings · Top seeds together');
  expect(result.sheet).toContain('Entries #1 + #2');
  expect(result.sheet).not.toContain('0-0');

  const bracket = await page.evaluate(async () => {
    brName('Championship'); await createBracketNow();
    const ev = evts[0], br = ev.brackets[0], state = bracketState(ev, br);
    return { seeds: br.seeds, byeWinners: state.rounds[0].filter(m => m.bye).map(m => m.winner), top: br.seeds.slice(0, 2) };
  });
  expect(bracket.byeWinners.sort()).toEqual(bracket.top.sort());
});

test('balanced rotating playoff order is preserved through saved bracket seeds and byes', async ({ page }) => {
  await seed(page); await page.goto('/');
  const ranked = ['F', 'G', 'I', 'H', 'B', 'D', 'L', 'K', 'E', 'C', 'J', 'A'];
  const result = await buildRotation(page, { names: ranked, pattern: 'balanced' });
  expect(result.teams.map(t => t.name)).toEqual(['F + A', 'G + J', 'I + C', 'H + E', 'B + K', 'D + L']);
  expect(result.seeds).toEqual(result.teams.map(t => t.id));
  expect(result.sheet).toContain('From rotating pool standings · Balanced teams');
  const bracket = await page.evaluate(async () => {
    brName('Gold'); await createBracketNow(); const ev = evts[0], br = ev.brackets[0], state = bracketState(ev, br);
    return { names: br.seeds.map(id => evTeamById(ev, id).name), byes: state.rounds[0].filter(m => m.bye).map(m => evTeamById(ev, m.winner).name) };
  });
  expect(bracket.names).toEqual(['F + A', 'G + J', 'I + C', 'H + E', 'B + K', 'D + L']);
  expect(bracket.byes.sort()).toEqual(['F + A', 'G + J'].sort());
});

test('solo entries and groups of three retain every source entry and generalized mobile-safe source text', async ({ page }) => {
  await seed(page, { playerCount: 12 }); await page.goto('/');
  const result = await buildRotation(page, { names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], entrySize: 1, teamSize: 3, played: false });
  expect(result.teams.map(t => t.name)).toEqual(['A + B + C', 'D + E + F', 'G + H + I']);
  expect(result.teams.every(t => t.playoffSource.sourceEntryIds.length === 3 && t.playoffSource.sourceEntrySeeds.length === 3)).toBe(true);
  expect(result.teams.every(t => t.playoffSource.sourceOrderBasis === 'event-seeding')).toBe(true);
  expect(result.sheet).toContain('From event seed order · Top seeds together');
  expect(result.sheet).toContain('Entries #1 + #2 + #3');
  const sizing = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet'), chips = [...sheet.querySelectorAll('.chips .chip')];
    return { sheetOverflow: sheet.scrollWidth - sheet.clientWidth, minHeight: Math.min(...chips.map(c => c.getBoundingClientRect().height)) };
  });
  expect(sizing.sheetOverflow).toBeLessThanOrEqual(1);
  expect(sizing.minHeight).toBeGreaterThanOrEqual(48);
});

test('fixed-team automatic controls use real pool standings or event order without forcing inclusion', async ({ page }) => {
  const teams = ['Falcons', 'Geckos', 'Ibises', 'Herons', 'Bears', 'Dolphins'].map((name, i) => ({ id: `t${i}`, name, pool: 'A', players: [] }));
  const poolGames = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) poolGames.push({
    id: `g${i}-${j}`, date: 10 + poolGames.length, evId: 'fixed', evA: teams[i].id, evB: teams[j].id,
    teamA: [], teamB: [], scoreA: 25, scoreB: 10, winner: 'A', log: {}
  });
  await seed(page, { events: [{ id: 'fixed', name: 'Fixed Cup', created: 1, done: false, teams, brackets: [] }], games: poolGames }); await page.goto('/');
  const withPools = await page.evaluate(() => {
    openBracketSetup('fixed'); const initially = window._brDraft.seeds.slice(), text = document.querySelector('.sheet').textContent;
    brUseAutomatic(); const seeds = window._brDraft.seeds.slice(); brName('Gold'); return { initially, seeds, text, createDisabled: $('#brCreate').disabled };
  });
  expect(withPools.initially).toEqual([]);
  expect(withPools.text).toContain('Use standings order');
  expect(withPools.text).toContain('Pool record 5-0');
  expect(withPools.seeds).toEqual(teams.map(t => t.id));
  expect(withPools.createDisabled).toBe(false);
  const byeNames = await page.evaluate(async () => { await createBracketNow(); const ev=evts[0],s=bracketState(ev,ev.brackets[0]);return s.rounds[0].filter(m=>m.bye).map(m=>evTeamById(ev,m.winner).name); });
  expect(byeNames.sort()).toEqual(['Falcons', 'Geckos'].sort());

  const noPools = await page.evaluate(() => {
    games=[]; evts=[{id:'unplayed',name:'Unplayed',teams:[{id:'z',name:'Zulu',players:[]},{id:'a',name:'Alpha',players:[]},{id:'m',name:'Mike',players:[]}],brackets:[]}];
    openBracketSetup('unplayed'); const text=document.querySelector('.sheet').textContent; brUseAutomatic();
    return { text, seeds:window._brDraft.seeds.slice() };
  });
  expect(noPools.text).toContain('Use event seed order');
  expect(noPools.text).not.toContain('From fixed-team pool standings');
  expect(noPools.seeds).toEqual(['z', 'a', 'm']);
});

test('manual edits persist until the recommendation is explicitly restored', async ({ page }) => {
  await seed(page); await page.goto('/');
  const result = await buildRotation(page, { names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] });
  const changed = await page.evaluate(() => {
    const first=window._brDraft.seeds[0]; brSeedToggle(first); brSeedToggle(first);
    return { seeds:window._brDraft.seeds.slice(), automatic:window._brDraft.automatic, text:document.querySelector('.sheet').textContent };
  });
  expect(changed.automatic).toBe(false);
  expect(changed.seeds).toEqual([...result.seeds.slice(1), result.seeds[0]]);
  expect(changed.text).toContain('Manual order is active');
  const restored = await page.evaluate(() => { brUseAutomatic(); return {seeds:window._brDraft.seeds.slice(),automatic:window._brDraft.automatic}; });
  expect(restored).toEqual({ seeds: result.seeds, automatic: true });
  const incomplete = await page.evaluate(() => {
    evts[0].teams.pop(); openBracketSetup(evts[0].id);
    return { valid:validGeneratedPlayoffMetadata(evts[0]),seeds:window._brDraft.seeds.slice(),text:document.querySelector('.sheet').textContent };
  });
  expect(incomplete.valid).toBe(false);
  expect(incomplete.seeds).toEqual([]);
  expect(incomplete.text).toContain('saved automatic order is no longer complete');
});

test('renames and substitutions preserve metadata; rebuild replaces it, clears brackets, and keeps pool history', async ({ page }) => {
  await seed(page, { playerCount: 30 }); await page.goto('/');
  await buildRotation(page, { names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] });
  const result = await page.evaluate(async () => {
    const ev=evts[0], team=ev.teams[0], original=JSON.stringify(team.playoffSource), poolBefore=JSON.stringify(games),oldTeamIds=ev.teams.map(t=>t.id);
    openEventTeam(ev.id,team.id); $('#evtName').value='Renamed contender'; window._evTeamDraft.players.delete(team.players[0]); window._evTeamDraft.players.add('p29');
    await saveEventTeam();
    const afterEdit=JSON.stringify(evTeamById(ev,team.id).playoffSource);
    ev.brackets=[{id:'old-bracket',name:'Gold',created:500,seeds:ev.teams.map(t=>t.id)}];
    window.askConfirm=async()=>true; window._rpDraft={evId:ev.id,pattern:'balanced'}; await saveRotationPlayoffTeams();
    return { original, afterEdit, brackets:ev.brackets.length, poolSame:JSON.stringify(games)===poolBefore,
      patterns:ev.teams.map(t=>t.playoffSource.pattern), valid:validGeneratedPlayoffMetadata(ev),oldTeamIds,deletions:Sync.deletionState() };
  });
  expect(result.afterEdit).toBe(result.original);
  expect(result.brackets).toBe(0);
  expect(result.poolSame).toBe(true);
  expect(result.patterns.every(p => p === 'balanced')).toBe(true);
  expect(result.valid).toBe(true);
  expect(result.oldTeamIds.every(id => result.deletions.eventTeams[id] > 0)).toBe(true);
  expect(result.deletions.eventBrackets['old-bracket']).toBeGreaterThan(0);
});

test('incomplete and legacy rotating sets fall back to manual while playoff results still block rebuilds', async ({ page }) => {
  const entries = ['A','B','C','D'].map((name,i)=>({id:`e${i}`,name,players:[`p${i}`],manualSeed:i+1}));
  const legacy={id:'legacy',name:'Legacy Rotation',format:'rotatingGroups',entries,rotation:{entrySize:1,teamSize:2,seedMode:'manual'},rotationSchedule:[],
    teams:[{id:'old1',name:'A + B',entryIds:['e0','e1'],players:['p0','p1']},{id:'old2',name:'C + D',entryIds:['e2','e3'],players:['p2','p3']}],brackets:[]};
  await seed(page,{events:[legacy],playerCount:8});await page.goto('/');
  const fallback=await page.evaluate(()=>{openBracketSetup('legacy');return {seeds:window._brDraft.seeds.slice(),text:document.querySelector('.sheet').textContent,valid:validGeneratedPlayoffMetadata(evts[0])};});
  expect(fallback).toMatchObject({seeds:[],valid:false});
  expect(fallback.text).toContain('No saved playoff-team order is available');
  expect(fallback.text).not.toContain('0-0');

  const blocked=await page.evaluate(async()=>{
    const ev=evts[0]; games=[{id:'playoff-result',date:20,evId:ev.id,evA:'old1',evB:'old2',teamA:[],teamB:[],scoreA:25,scoreB:10,winner:'A',log:{}}];
    const before=JSON.stringify(ev.teams);window._rpDraft={evId:ev.id,pattern:'adjacent'};await saveRotationPlayoffTeams();
    return {same:JSON.stringify(ev.teams)===before,toast:document.querySelector('#toast').textContent};
  });
  expect(blocked.same).toBe(true);
  expect(blocked.toast).toContain('Playoff results already exist');
});

test('bracket result correction still un-advances and re-advances from saved seeds', async ({ page }) => {
  await seed(page); await page.goto('/');
  const result=await page.evaluate(()=>{
    const ev={id:'correction',name:'Correction',teams:['a','b','c','d'].map(id=>({id,name:id.toUpperCase(),players:[]})),brackets:[]};
    const br={id:'br',name:'Gold',created:1,seeds:['a','b','c','d']};ev.brackets=[br];evts=[ev];
    games=[{id:'semi',date:2,evId:ev.id,evA:'a',evB:'d',teamA:[],teamB:[],scoreA:25,scoreB:10,winner:'A',log:{}}];
    const advanced=bracketState(ev,br).rounds[0][0].winner;games=[];const removed=bracketState(ev,br).rounds[0][0].winner;
    games=[{id:'semi-fixed',date:3,evId:ev.id,evA:'a',evB:'d',teamA:[],teamB:[],scoreA:10,scoreB:25,winner:'B',log:{}}];
    const corrected=bracketState(ev,br).rounds[0][0].winner;return {advanced,removed,corrected};
  });
  expect(result).toEqual({advanced:'a',removed:null,corrected:'d'});
});
