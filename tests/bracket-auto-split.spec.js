import { test, expect } from '@playwright/test';

function roster(count = 30) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${i + 1}`, seedRating: 80 - i,
    rating: 80 - i, active: true, archived: false, roles: {}, lifetime: {}, history: [{ i: 0, r: 80 - i }]
  }));
}

async function seed(page, { events = [], games = [] } = {}) {
  await page.addInitScript(({ events, games, players }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { events, games, players: roster() });
}

function fixedEvent({ teamCount = 9, courts = 3, pools = null } = {}) {
  return {
    id: 'fixed', name: 'Split Cup', created: 1, done: false, brackets: [],
    sched: { start: '10:00', courts, courtStyle: 'num', setMin: 25, matchMin: 45, breakMin: 15 },
    teams: Array.from({ length: teamCount }, (_, i) => ({
      id: `t${i + 1}`, name: `Team ${i + 1}`, pool: pools ? pools[i % pools.length] : '', players: []
    }))
  };
}

test('split builder turns the seed order into balanced tiers and creates them all at once', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await page.goto('/');
  await page.evaluate(() => openEvent('fixed'));

  const opened = await page.evaluate(() => {
    openBracketSplit('fixed');
    const counts = [...document.querySelectorAll('.sheet [data-split-count]')].map(b => b.dataset.splitCount);
    return {
      counts,
      active: document.querySelector('.sheet [data-split-count].on')?.dataset.splitCount,
      tiers: [...document.querySelectorAll('.sheet .split-bracket')].map(el => el.textContent.replace(/\s+/g, ' ').trim()),
      hint: document.querySelector('.sheet [data-split-hint]').textContent,
      createLabel: document.querySelector('#bsCreate').textContent
    };
  });

  // 9 teams → counts 1..floor(9/2) capped at 6; suggestion is advisory only
  expect(opened.counts).toEqual(['1', '2', '3', '4']);
  expect(opened.active).toBe('2');
  expect(opened.tiers[0]).toContain('Gold');
  expect(opened.tiers[0]).toContain('Seeds 1–4');
  expect(opened.tiers[0]).toContain('4 teams · 3 matches · 2 rounds · no byes');
  expect(opened.tiers[1]).toContain('Silver');
  expect(opened.tiers[1]).toContain('Seeds 5–9');
  expect(opened.tiers[1]).toContain('5 teams · 4 matches · 3 rounds · 3 first-round byes');
  expect(opened.hint).toContain('Gold 4 / Silver 5');
  expect(opened.createLabel).toContain('Create 2 brackets');

  const offSuggestion = await page.evaluate(() => {
    bsCount(3);
    return {
      disabled: document.querySelector('#bsCreate').disabled,
      blockedSteps: document.querySelectorAll('.sheet [data-split-count][disabled]').length,
      hint: document.querySelector('.sheet [data-split-hint]').textContent,
      tiers: [...document.querySelectorAll('.sheet .split-bracket')].length,
      createLabel: document.querySelector('#bsCreate').textContent
    };
  });

  // a non-recommended count stays fully selectable and creatable
  expect(offSuggestion.disabled).toBe(false);
  expect(offSuggestion.blockedSteps).toBe(0);
  expect(offSuggestion.tiers).toBe(3);
  expect(offSuggestion.createLabel).toContain('Create 3 brackets');
  expect(offSuggestion.hint).toContain('2 brackets would split 4/5');

  const created = await page.evaluate(async () => {
    bsCount(2);
    await createBracketSplit();
    const ev = evts[0];
    return {
      names: ev.brackets.map(b => b.name),
      seeds: ev.brackets.map(b => b.seeds),
      keys: ev.brackets.map(b => Object.keys(b).sort().join(',')),
      sameCreated: new Set(ev.brackets.map(b => b.created)).size,
      champs: ev.brackets.map(b => bracketState(ev, b).rounds.length)
    };
  });

  expect(created.names).toEqual(['Gold', 'Silver']);
  expect(created.seeds).toEqual([['t1', 't2', 't3', 't4'], ['t5', 't6', 't7', 't8', 't9']]);
  expect(created.keys).toEqual(['created,id,name,seeds', 'created,id,name,seeds']);
  expect(created.sameCreated).toBe(1);
  expect(created.champs).toEqual([2, 3]);

  await expect(page.locator('.bracket-card')).toHaveCount(2);
  await expect(page.locator('.bracket-card .bracket-summary h3')).toHaveText(['Gold', 'Silver']);
  await expect(page.locator('.bracket-card').first().locator('.bracket-summary-line')).toContainText('4 teams');
});

test('split rebuild confirms replacement and refuses once playoff results exist', async ({ page }) => {
  await seed(page, { events: [fixedEvent()] });
  await page.goto('/');
  await page.evaluate(() => openEvent('fixed'));
  await page.evaluate(async () => { openBracketSplit('fixed'); bsCount(2); await createBracketSplit(); });

  await page.evaluate(() => { openBracketSplit('fixed'); bsCount(3); createBracketSplit(); });
  await expect(page.getByText('Replace the existing brackets?')).toBeVisible();
  await page.locator('.scrim [data-action="confirm"]').click();
  await expect(page.locator('.bracket-card')).toHaveCount(3);

  const afterPlayoffGame = await page.evaluate(() => {
    const ev = evts[0], br = ev.brackets[0], state = bracketState(ev, br), match = state.rounds[0][0];
    games.push({
      id: 'playoff-1', date: Date.now() + 1000, teamA: [], teamB: [], scoreA: 25, scoreB: 18, winner: 'A', log: {},
      evId: ev.id, evA: match.a, evB: match.b, evMatchId: match.id
    });
    return { playoffGames: eventPlayoffGames(ev).length, available: bracketSplitAvailable(ev) };
  });
  expect(afterPlayoffGame.playoffGames).toBe(1);
  expect(afterPlayoffGame.available).toBe(false);

  await page.evaluate(() => { openBracketSplit('fixed'); });
  await expect(page.getByText('Playoff results already exist. Delete those games before rebuilding brackets.')).toBeVisible();
  await expect(page.locator('#bsCreate')).toBeDisabled();
});

test('fixed-team seeding follows cross-pool finish with overall standings still reachable', async ({ page }) => {
  const ev = fixedEvent({ teamCount: 9, courts: 3 });
  ['A', 'B', 'C'].forEach((pool, group) => {
    for (let i = 0; i < 3; i++) ev.teams[group * 3 + i].pool = pool;
  });
  // each pool is a 1-1-1 loop, so pool rank is decided inside the pool
  const scores = [
    ['t1', 't2', 25, 5], ['t2', 't3', 25, 2], ['t3', 't1', 25, 24],
    ['t4', 't5', 25, 10], ['t5', 't6', 25, 10], ['t6', 't4', 25, 23],
    ['t7', 't8', 25, 24], ['t8', 't9', 25, 24], ['t9', 't7', 25, 24]
  ];
  const poolGames = scores.map(([a, b, sa, sb], i) => ({
    id: `pg${i}`, date: 10 + i, evId: 'fixed', evA: a, evB: b,
    teamA: [], teamB: [], scoreA: sa, scoreB: sb, winner: 'A', log: {}
  }));
  await seed(page, { events: [ev], games: poolGames });
  await page.goto('/');

  const seeding = await page.evaluate(() => {
    const event = evts[0];
    const cross = fixedEventAutomaticSeedOrder(event, 'pool-finish');
    const overall = fixedEventAutomaticSeedOrder(event, 'standings');
    return {
      basis: fixedEventSeedBasisDefault(event),
      crossIds: cross.teamIds,
      ranks: cross.teamIds.map(id => cross.poolRanks[id].poolRank),
      pools: cross.teamIds.map(id => cross.poolRanks[id].pool),
      overallIds: overall.teamIds,
      detail: bracketAutomaticSeedInfo(event).detail
    };
  });

  expect(seeding.basis).toBe('pool-finish');
  expect(seeding.ranks).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  expect(seeding.pools.slice(0, 3).sort()).toEqual(['A', 'B', 'C']);
  expect(seeding.crossIds.slice(0, 4)).toEqual(['t1', 't4', 't7', 't2']);
  expect(seeding.overallIds).not.toEqual(seeding.crossIds);
  expect(seeding.detail).toContain('Cross-pool');

  await page.evaluate(() => openBracketSetup('fixed'));
  await expect(page.locator('.sheet [data-seed-basis] button.on')).toHaveText('Cross-pool order');

  const switched = await page.evaluate(() => {
    brSeedBasis('standings');
    return {
      active: document.querySelector('.sheet [data-seed-basis] button.on').textContent.trim(),
      seeds: window._brDraft.seeds.slice(),
      detail: document.querySelector('.sheet .unkline').textContent
    };
  });
  expect(switched.active).toBe('Overall standings');
  expect(switched.seeds).toEqual(seeding.overallIds);
  expect(switched.detail).toContain('overall');

  const restored = await page.evaluate(() => { brSeedBasis('pool-finish'); return window._brDraft.seeds.slice(); });
  expect(restored).toEqual(seeding.crossIds);
});

test('split sheet and its entry points stay usable on phone and desktop widths', async ({ page }) => {
  await seed(page, { events: [fixedEvent({ teamCount: 12, courts: 4 })] });
  await page.goto('/');
  await page.evaluate(() => openEvent('fixed'));

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { closeSheet(); openBracketSplit('fixed'); });

    const layout = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet');
      const steps = [...sheet.querySelectorAll('[data-split-count]')];
      return {
        sheetOverflow: sheet.scrollWidth - sheet.clientWidth,
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        minStepHeight: Math.min(...steps.map(b => b.getBoundingClientRect().height)),
        stepCount: steps.length,
        createVisible: document.querySelector('#bsCreate').getBoundingClientRect().width > 0
      };
    });

    expect(layout.stepCount).toBe(6);
    expect(layout.sheetOverflow).toBeLessThanOrEqual(1);
    expect(layout.bodyOverflow).toBeLessThanOrEqual(1);
    expect(layout.minStepHeight).toBeGreaterThanOrEqual(42);
    expect(layout.createVisible).toBe(true);
  }

  await page.evaluate(() => closeSheet());
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Split into brackets' })).toBeVisible();
});
