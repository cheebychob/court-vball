import { test, expect } from '@playwright/test';

/* EUX-03 — event sheet headers and share-action layout.

   These tests cover the reusable sheet chrome (non-floating header, sticky
   action footer, collapsible neutral preview frame) on the three migrated
   sheets: full schedule sharing, participant schedule sharing, and event
   results/recap sharing. */

function roster(count = 40) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Player ${String(i + 1).padStart(2, '0')}`,
    seedRating: 40 + (i % 35), active: true, archived: false, roles: {}
  }));
}

function fixedEvent(overrides = {}) {
  return {
    id: 'fixed-chrome', name: 'Sheet Chrome Classic', eventDate: '2026-07-16', created: 1, done: false, format: 'fixedTeams',
    teams: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, name: `Team ${String.fromCharCode(65 + i)}`, pool: i < 4 ? 'A' : 'B', players: [`p${i}`] })),
    sched: { start: '10:00', courts: 3, courtStyle: 'num', setMin: 20, matchMin: 45, breakMin: 10, seed: 'fixed-chrome-seed', revision: 3 },
    brackets: [], ...overrides
  };
}

function rotatingEvent(overrides = {}) {
  return {
    id: 'rot-chrome', name: 'Sheet Chrome Rotation', eventDate: '2026-07-17', created: 2, done: false, format: 'rotatingGroups', teams: [], brackets: [],
    entries: Array.from({ length: 10 }, (_, i) => ({ id: `e${i}`, name: `Pair ${i + 1}`, players: [`p${i * 2}`, `p${i * 2 + 1}`], manualSeed: i + 1 })),
    rotation: { entrySize: 2, teamSize: 4, rounds: 5, courts: 2, seedMode: 'manual', start: '09:30', setMin: 25, matchMin: 45, breakMin: 10, winPoints: 1, tiePoints: .5, lossPoints: 0, seed: 'rot-chrome-seed', revision: 2 },
    rotationSchedule: [], ...overrides
  };
}

function finishedEvent() {
  const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name, i) => ({ id: `t${i + 1}`, name, pool: 'A', players: [`p${i}`] }));
  const sets = ({ round, match, a, b, scores, prefix, start }) => scores.map(([scoreA, scoreB], i) => ({
    id: `${prefix}-s${i + 1}`, date: start + i, evId: 'done-chrome', evA: a, evB: b,
    evMatchId: `playoff:champ:r${round}:m${match}`, matchId: `${prefix}-group`, teamA: [], teamB: [], unkA: 1, unkB: 1,
    scoreA, scoreB, winner: scoreA > scoreB ? 'A' : 'B', label: `Championship · Set ${i + 1}`, log: {}
  }));
  return {
    event: {
      id: 'done-chrome', name: 'Sheet Chrome Finals', eventDate: '2026-07-16', created: 3, done: true, format: 'fixedTeams',
      teams, brackets: [{ id: 'champ', name: 'Championship', created: 100, seeds: teams.map(t => t.id) }]
    },
    games: [
      { id: 'pool-a-b', date: 20, evId: 'done-chrome', evA: 't1', evB: 't2', teamA: [], teamB: [], scoreA: 25, scoreB: 21, winner: 'A', log: {} },
      ...sets({ round: 1, match: 1, a: 't1', b: 't4', scores: [[25, 16], [25, 18]], prefix: 'semi-a', start: 200 }),
      ...sets({ round: 1, match: 2, a: 't2', b: 't3', scores: [[25, 19], [25, 12]], prefix: 'semi-b', start: 210 }),
      ...sets({ round: 2, match: 1, a: 't1', b: 't2', scores: [[25, 22], [22, 25], [15, 13]], prefix: 'final', start: 300 })
    ]
  };
}

async function seed(page, { events = [fixedEvent()], games = [], playerCount = 40 } = {}) {
  await page.addInitScript(({ players, events, games }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', JSON.stringify(games));
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { players: roster(playerCount), events, games });
}

/* Geometry of the sheet chrome as the reader sees it. `hit` uses the real hit
   test, so a control counts as reachable only when nothing covers it. */
async function chrome(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('#scrim .sheet');
    const box = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    const hit = el => { if (!el) return false; const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!at && (at === el || el.contains(at)); };
    const close = sheet.querySelector('.sheet-x');
    const foot = sheet.querySelector('[data-sheet-foot]');
    const primary = foot?.querySelector('.btn.primary,[data-download-schedule]') || null;
    const covered = [...sheet.querySelectorAll('[data-sheet-preview],[data-public-schedule-section],[data-results-share-options],.sheet-head-copy h3')]
      .filter(el => el.getBoundingClientRect().height > 0)
      .some(el => { const a = close.getBoundingClientRect(), b = el.getBoundingClientRect(); return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); });
    return {
      headerHosted: !!sheet.querySelector('[data-sheet-head] .sheet-x'),
      floating: getComputedStyle(close).position === 'sticky',
      scrollable: sheet.scrollHeight > sheet.clientHeight + 1,
      atBottom: sheet.scrollTop >= sheet.scrollHeight - sheet.clientHeight - 1,
      closeCoversContent: covered,
      closeVisible: close.getBoundingClientRect().bottom > sheet.getBoundingClientRect().top + 1,
      closeHit: hit(close),
      footCloseHit: hit(foot?.querySelector('.sheet-close')),
      primaryLabel: primary?.textContent.trim() || '',
      primaryHit: hit(primary),
      previewOpen: sheet.querySelector('[data-sheet-preview]')?.open ?? null,
      previewTop: sheet.querySelector('[data-sheet-preview]') ? box(sheet.querySelector('[data-sheet-preview]')).top : null,
      footTop: foot ? box(foot).top : null,
      sheet: box(sheet),
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

const scrollSheet = page => page.evaluate(() => { const s = document.querySelector('#scrim .sheet'); s.scrollTop = s.scrollHeight; });

test('the full schedule share sheet keeps the close control out of the content and the download action above the preview', async ({ page }) => {
  await seed(page); await page.goto('/');
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => openScheduleShare('fixed-chrome'));
    const sheet = page.locator('.sheet');
    await expect(sheet.getByRole('heading', { name: 'Save / Share Schedule', exact: true })).toBeVisible();

    const top = await chrome(page);
    expect(top.headerHosted, `${viewport.width}px header hosts the close control`).toBe(true);
    expect(top.floating, `${viewport.width}px close control is not sticky`).toBe(false);
    expect(top.closeCoversContent, `${viewport.width}px close overlaps content`).toBe(false);
    expect(top.closeHit).toBe(true);
    // The preview is long enough to scroll, yet the download action is already
    // reachable without scrolling past it.
    expect(top.scrollable).toBe(true);
    expect(top.primaryLabel).toBe('Download Schedule');
    expect(top.primaryHit).toBe(true);
    expect(top.footCloseHit).toBe(true);
    expect(top.footTop).toBeLessThan(top.sheet.bottom);
    expect(top.docOverflow).toBeLessThanOrEqual(0);

    await scrollSheet(page);
    const bottom = await chrome(page);
    expect(bottom.atBottom).toBe(true);
    expect(bottom.closeCoversContent, `${viewport.width}px close overlaps content after scrolling`).toBe(false);
    expect(bottom.closeVisible, `${viewport.width}px close scrolls away with the header`).toBe(false);
    expect(bottom.primaryHit, `${viewport.width}px download stays reachable after scrolling`).toBe(true);
    expect(bottom.footCloseHit).toBe(true);
    expect(bottom.docOverflow).toBeLessThanOrEqual(0);

    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
});

test('the rotating participant share sheet frames a collapsible preview and keeps actions reachable when it is collapsed', async ({ page }) => {
  await seed(page, { events: [rotatingEvent()] }); await page.goto('/');
  await page.evaluate(async () => { const ev = evById('rot-chrome'); ev.rotationSchedule = generateRotationScheduleData(ev).matches; await saveEvents(); });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => openParticipantScheduleShare('rot-chrome', 'entry', 'e0'));
  const sheet = page.locator('.sheet');
  await expect(sheet.getByRole('heading', { name: 'Save / Share Group Schedule', exact: true })).toBeVisible();
  await expect(sheet.locator('[data-sheet-head]')).toContainText('A compact, read-only schedule for Pair 1.');
  await expect(sheet.locator('[data-participant-schedule-preview]')).toContainText('Pair 1');

  const open = await chrome(page);
  expect(open).toMatchObject({ headerHosted: true, floating: false, closeCoversContent: false, previewOpen: true, primaryLabel: 'Download Schedule', primaryHit: true });
  expect(open.docOverflow).toBeLessThanOrEqual(0);
  // The public-link panel is above the preview, so sharing never sits behind it.
  expect(await page.locator('.public-schedule-panel').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(open.previewTop);

  await sheet.locator('[data-sheet-preview] > summary').click();
  await expect(sheet.locator('[data-participant-schedule-preview]')).toBeHidden();
  const collapsed = await chrome(page);
  expect(collapsed).toMatchObject({ previewOpen: false, closeCoversContent: false, primaryHit: true, footCloseHit: true, closeHit: true });
  expect(collapsed.docOverflow).toBeLessThanOrEqual(0);

  await sheet.locator('[data-sheet-preview] > summary').click();
  await expect(sheet.locator('[data-participant-schedule-preview]')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toHaveCount(0);
});

test('the event results and recap sharing sheets use the same chrome on mobile and desktop', async ({ page }) => {
  const { event, games } = finishedEvent();
  await seed(page, { events: [event], games }); await page.goto('/');
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => openEventResults('done-chrome'));
    const sheet = page.locator('.sheet');
    await expect(sheet.getByRole('heading', { name: 'Full event results', exact: true })).toBeVisible();
    await expect(sheet.locator('[data-results-view]')).toContainText('Combined event standings');

    const results = await chrome(page);
    expect(results).toMatchObject({ headerHosted: true, floating: false, closeCoversContent: false, previewOpen: true, primaryLabel: 'Save / share event recap', primaryHit: true, footCloseHit: true });
    expect(results.docOverflow).toBeLessThanOrEqual(0);

    await scrollSheet(page);
    const scrolled = await chrome(page);
    expect(scrolled.closeCoversContent, `${viewport.width}px close overlaps results after scrolling`).toBe(false);
    expect(scrolled.primaryHit).toBe(true);

    await sheet.getByRole('button', { name: 'Save / share event recap', exact: true }).click();
    await expect(sheet.getByRole('heading', { name: 'Save / share event recap', exact: true })).toBeVisible();
    const share = await chrome(page);
    expect(share).toMatchObject({ headerHosted: true, floating: false, closeCoversContent: false, footCloseHit: true, closeHit: true });
    await expect(sheet.locator('[data-results-share-options]')).toBeVisible();

    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
});

test('migrated sheets keep focus trapping, Escape, close guards, and leave other sheets on the original chrome', async ({ page }) => {
  await seed(page); await page.goto('/');
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.locator('.ev-row').filter({ hasText: 'Sheet Chrome Classic' }).click();
  /* Mobile event pages show one section at a time (EUX-04). */
  await page.evaluate(() => eventSection('schedule'));
  const trigger = page.getByRole('button', { name: 'Save / Share Schedule', exact: true });
  await trigger.click();
  const sheet = page.locator('.sheet');
  await expect(sheet.getByRole('heading', { name: 'Save / Share Schedule', exact: true })).toBeVisible();

  // Tab from the last focusable control wraps back into the sheet, never out of it.
  const trapped = await page.evaluate(async () => {
    const dialog = document.querySelector('#scrim .sheet');
    const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[contenteditable="true"],[tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden && el.getClientRects().length);
    return { count: focusable.length, first: focusable[0]?.className, last: focusable[focusable.length - 1]?.className };
  });
  expect(trapped.count).toBeGreaterThan(2);
  expect(trapped.last).toContain('sheet-close');
  await page.evaluate(() => { const d = document.querySelector('#scrim .sheet'); d.querySelector('.sheet-foot .sheet-close').focus(); });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.className || '')).toContain('sheet-x');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.className || '')).toContain('sheet-close');

  // The header close button still routes through requestCloseSheet, so a
  // dirty-close guard blocks it exactly as it blocks the footer action.
  await page.evaluate(() => { window.__guardCalls = 0; window._sheetBeforeClose = () => { window.__guardCalls++; return false; }; });
  await page.locator('.sheet .sheet-x').click();
  await expect(sheet).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(1);
  expect(await page.evaluate(() => window.__guardCalls)).toBeGreaterThanOrEqual(2);

  await page.evaluate(() => { window._sheetBeforeClose = null; });
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Sheets outside this roadmap item are untouched: floating close, no footer.
  await page.evaluate(() => openEvSettings('fixed-chrome'));
  expect(await page.evaluate(() => {
    const dialog = document.querySelector('#scrim .sheet');
    return {
      headerHosted: !!dialog.querySelector('[data-sheet-head] .sheet-x'),
      foot: dialog.querySelectorAll('[data-sheet-foot]').length,
      position: getComputedStyle(dialog.querySelector('.sheet-x')).position
    };
  })).toEqual({ headerHosted: false, foot: 0, position: 'sticky' });
});
