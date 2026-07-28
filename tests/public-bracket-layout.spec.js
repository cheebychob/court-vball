import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const LONG_FIXED_NAME = 'The Extremely Long North Shore Championship Volleyball Collective Alpha';
const LONG_ROTATING_NAME = 'Rotating Champions With An Exceptionally Long Combined Public Team Name';

function players(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Member ${index + 1}`,
    seedRating: 70 - index,
    rating: 70 - index,
    active: true,
    archived: false,
    roles: {},
    lifetime: {},
    history: [{ i: 0, r: 70 - index }]
  }));
}

function fixedEvent({ complete = true, teamCount = 4 } = {}) {
  const names = Array.from({ length: teamCount }, (_, index) => (
    index === 0 ? LONG_FIXED_NAME : `Team ${String(index + 1).padStart(2, '0')}`
  ));
  const teams = names.map((name, index) => ({
    id: `t${index + 1}`,
    name,
    pool: 'A',
    players: [`p${index + 1}`]
  }));
  const event = {
    id: 'public-bracket-fixed',
    name: 'Public Bracket Championship',
    eventDate: '2026-07-27',
    created: 1,
    done: complete,
    format: 'fixedTeams',
    teams,
    brackets: [{ id: 'champ', name: 'Championship', created: 100, seeds: teams.map(team => team.id) }]
  };
  if (!complete || teamCount !== 4) return { event, games: [] };
  return {
    event,
    games: [
      ...matchSets({ round: 1, match: 1, a: 't1', b: 't4', scores: [[25, 15], [25, 17]], start: 200, prefix: 'semi-one' }),
      ...matchSets({ round: 1, match: 2, a: 't2', b: 't3', scores: [[25, 21], [22, 25], [15, 11]], start: 210, prefix: 'semi-two' }),
      ...matchSets({ round: 2, match: 1, a: 't1', b: 't2', scores: [[25, 22], [20, 25], [15, 12]], start: 300, prefix: 'final' })
    ]
  };
}

function rotatingEvent() {
  const teams = [
    { id: 'rt1', name: LONG_ROTATING_NAME, entryIds: ['e1', 'e2'], players: ['p1', 'p2'] },
    { id: 'rt2', name: 'Entry Three + Entry Four', entryIds: ['e3', 'e4'], players: ['p3', 'p4'] },
    { id: 'rt3', name: 'Entry Five + Entry Six', entryIds: ['e5', 'e6'], players: ['p5', 'p6'] }
  ];
  return {
    event: {
      id: 'public-bracket-rotating',
      name: 'Public Rotating Bracket',
      eventDate: '2026-07-27',
      created: 2,
      done: false,
      format: 'rotatingGroups',
      entries: Array.from({ length: 6 }, (_, index) => ({
        id: `e${index + 1}`,
        name: `Entry ${index + 1}`,
        players: [`p${index + 1}`]
      })),
      teams,
      rotation: {
        entrySize: 1,
        teamSize: 2,
        rounds: 1,
        courts: 1,
        seed: 'public-bracket-rotating',
        revision: 1
      },
      rotationSchedule: [],
      brackets: [{ id: 'gold', name: 'Gold', created: 100, seeds: teams.map(team => team.id) }]
    },
    games: []
  };
}

function matchSets({ round, match, a, b, scores, start, prefix }) {
  return scores.map(([scoreA, scoreB], index) => ({
    id: `${prefix}-set-${index + 1}`,
    date: start + index,
    evId: 'public-bracket-fixed',
    evA: a,
    evB: b,
    evMatchId: `playoff:champ:r${round}:m${match}`,
    matchId: `${prefix}-match`,
    teamA: [],
    teamB: [],
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? 'A' : 'B',
    log: {}
  }));
}

async function publicHtml(page, fixture) {
  await page.addInitScript(({ event, games, roster }) => {
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify([event]));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { ...fixture, roster: players() });
  await page.goto('/');
  return page.evaluate(() => renderPublicEventDocument(evts[0]));
}

test('public bracket renders every fixed-team round and match with accurate winners, scores, and champion', async ({ page }) => {
  const html = await publicHtml(page, fixedEvent());
  const result = await page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const match = id => {
      const node = doc.querySelector(`[data-public-bracket-match="${id}"]`);
      return {
        state: node?.dataset.state,
        winner: node?.querySelector('[data-result="winner"] .public-bracket-team-name')?.textContent,
        scores: [...(node?.querySelectorAll('.public-bracket-team-score') || [])].map(score => score.textContent.trim())
      };
    };
    return {
      rounds: [...doc.querySelectorAll('[data-public-bracket-round] > h4')].map(heading => heading.textContent),
      matchCount: doc.querySelectorAll('[data-public-bracket-match]').length,
      firstSemi: match('playoff:champ:r1:m1'),
      secondSemi: match('playoff:champ:r1:m2'),
      final: match('playoff:champ:r2:m1'),
      champion: {
        label: doc.querySelector('[data-public-bracket-champion] > span')?.textContent,
        name: doc.querySelector('[data-public-bracket-champion] > strong')?.textContent,
        outcome: doc.querySelector('[data-public-bracket-champion] > small')?.textContent
      },
      controls: doc.querySelectorAll('[data-public-bracket] button, [data-public-bracket] [onclick]').length
    };
  }, html);

  expect(result.rounds).toEqual(['Semifinals', 'Final']);
  expect(result.matchCount).toBe(3);
  expect(result.firstSemi).toEqual({ state: 'completed', winner: LONG_FIXED_NAME, scores: ['2', '0'] });
  expect(result.secondSemi).toEqual({ state: 'completed', winner: 'Team 02', scores: ['2', '1'] });
  expect(result.final).toEqual({ state: 'championshipCompleted', winner: LONG_FIXED_NAME, scores: ['2', '1'] });
  expect(result.champion).toEqual({
    label: 'Champion',
    name: LONG_FIXED_NAME,
    outcome: 'Final · 2-1 over Team 02'
  });
  expect(result.controls).toBe(0);
});

test('public rotating bracket explains byes, ready matches, pending teams, and a pending championship', async ({ page }) => {
  const html = await publicHtml(page, rotatingEvent());
  const result = await page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    return {
      format: doc.querySelector('[data-public-bracket]')?.dataset.publicBracketFormat,
      states: [...doc.querySelectorAll('[data-public-bracket-match]')].map(match => match.dataset.state),
      statuses: [...doc.querySelectorAll('.public-bracket-match-status')].map(status => status.textContent.trim()),
      text: doc.querySelector('[data-public-bracket]')?.textContent.replace(/\s+/g, ' ').trim(),
      teamNames: [...doc.querySelectorAll('.public-bracket-team-name')].map(name => name.textContent.trim())
    };
  }, html);

  expect(result.format).toBe('rotatingGroups');
  expect(result.states).toEqual(['bye', 'ready', 'waiting']);
  expect(result.statuses).toEqual(['Advances by bye', 'Ready to play', 'Waiting for teams']);
  expect(result.text).toContain('Championship pending');
  expect(result.teamNames).toContain(LONG_ROTATING_NAME);
  expect(result.teamNames.filter(name => name === 'TBD').length).toBeGreaterThan(0);
});

test('public brackets contain long names and every round at 320px and desktop widths', async ({ page }, testInfo) => {
  for (const [kind, fixture, expectedMatches] of [
    ['fixed', fixedEvent({ complete: false, teamCount: 16 }), 15],
    ['rotating', rotatingEvent(), 3]
  ]) {
    const html = await publicHtml(page, fixture);
    const filePath = testInfo.outputPath(`${kind}-public-bracket.html`);
    writeFileSync(filePath, html);
    for (const viewport of [{ width: 320, height: 700 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      await page.goto(pathToFileURL(filePath).href);
      const layout = await page.evaluate(() => {
        const board = document.querySelector('.public-bracket-board');
        const rounds = [...document.querySelectorAll('[data-public-bracket-round]')];
        const matches = [...document.querySelectorAll('[data-public-bracket-match]')];
        const names = [...document.querySelectorAll('.public-bracket-team-name')];
        return {
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          boardOverflow: board.scrollWidth - board.clientWidth,
          visibleRounds: rounds.filter(round => getComputedStyle(round).display !== 'none').length,
          matchCount: matches.length,
          clippedMatches: matches.filter(match => match.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length,
          clippedNames: names.filter(name => name.scrollWidth > name.clientWidth + 1).length
        };
      });
      expect(layout.pageOverflow, `${kind} ${viewport.width}px document overflow`).toBeLessThanOrEqual(0);
      expect(layout.boardOverflow, `${kind} ${viewport.width}px bracket overflow`).toBeLessThanOrEqual(1);
      expect(layout.visibleRounds, `${kind} ${viewport.width}px visible rounds`).toBe(kind === 'fixed' ? 4 : 2);
      expect(layout.matchCount, `${kind} ${viewport.width}px rendered matches`).toBe(expectedMatches);
      expect(layout.clippedMatches, `${kind} ${viewport.width}px clipped matches`).toBe(0);
      expect(layout.clippedNames, `${kind} ${viewport.width}px clipped names`).toBe(0);
    }
  }
});

test('printed public bracket keeps all rounds and matches visible without horizontal clipping', async ({ page }, testInfo) => {
  const html = await publicHtml(page, fixedEvent({ complete: false, teamCount: 16 }));
  const filePath = testInfo.outputPath('printed-public-bracket.html');
  writeFileSync(filePath, html);
  await page.setViewportSize({ width: 816, height: 1056 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(pathToFileURL(filePath).href);

  const printLayout = await page.evaluate(() => {
    const rounds = [...document.querySelectorAll('[data-public-bracket-round]')];
    const matches = [...document.querySelectorAll('[data-public-bracket-match]')];
    return {
      visibleRounds: rounds.filter(round => getComputedStyle(round).display !== 'none').length,
      visibleMatches: matches.filter(match => getComputedStyle(match).display !== 'none').length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      boardOverflow: document.querySelector('.public-bracket-board').scrollWidth - document.querySelector('.public-bracket-board').clientWidth,
      matchBreaks: [...new Set(matches.map(match => getComputedStyle(match).breakInside))]
    };
  });

  expect(printLayout.visibleRounds).toBe(4);
  expect(printLayout.visibleMatches).toBe(15);
  expect(printLayout.pageOverflow).toBeLessThanOrEqual(0);
  expect(printLayout.boardOverflow).toBeLessThanOrEqual(1);
  expect(printLayout.matchBreaks).toEqual(['avoid']);
});
