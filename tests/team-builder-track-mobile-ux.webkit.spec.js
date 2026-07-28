import { test, expect } from '@playwright/test';

const players = Array.from({ length: 60 }, (_, index) => ({
  id: `p${index}`, name: `Player ${String(index + 1).padStart(2, '0')}`,
  seedRating: 45 + (index % 15), rating: 45 + (index % 15),
  active: true, archived: false, pickupEligible: true, aliases: [], roles: {},
  lifetime: {}, history: [{ i: 0, r: 45 + (index % 15) }]
}));

async function seed(page) {
  await page.addInitScript(roster => {
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', '[]');
    localStorage.setItem('vb:attendanceSessions', '[]');
    localStorage.setItem('vb:savedCrews', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ numTeams: 2, attendanceScope: 'all', attendanceSort: 'az' }));
  }, players);
}

test('mobile WebKit keeps Track assignment cycles and removal stable without nested roster scrolling', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('[data-tab="track"]:visible').tap();
  const row = page.locator('[data-track-player-id="p30"]');
  await row.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));

  for (const team of ['A', 'B', '']) {
    const before = await row.evaluate(element => ({ y: window.scrollY, top: element.getBoundingClientRect().top }));
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const after = await row.evaluate(element => ({ y: window.scrollY, top: element.getBoundingClientRect().top, team: element.dataset.team, activeKey: document.activeElement?.dataset?.focusKey || null }));
    expect(after.team).toBe(team);
    expect([null, 'track-p30']).toContain(after.activeKey);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(2);
  }

  const first = page.locator('[data-track-player-id="p0"]');
  await first.tap();
  const remove = page.locator('[data-track-remove="p0"]');
  await remove.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const removeY = await page.evaluate(() => window.scrollY);
  await remove.tap();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - removeY)).toBeLessThanOrEqual(2);

  const layout = await page.evaluate(() => {
    const list = document.querySelector('[data-preserve-scroll="track-roster"]');
    return {
      overflowY: getComputedStyle(list).overflowY,
      clipped: list.scrollHeight > list.clientHeight,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(layout).toEqual({ overflowY: 'visible', clipped: false, horizontal: 0 });
});

test('mobile WebKit direct navigation clears stale Teams and Track selections', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('[data-tab="teams"]:visible').tap();
  expect(await page.evaluate(() => window._pool.size)).toBe(0);
  await page.locator('[data-player-choice="p0"]').tap();
  await page.locator('[data-tab="home"]:visible').tap();
  await page.locator('[data-tab="teams"]:visible').tap();
  expect(await page.evaluate(() => window._pool.size)).toBe(0);

  await page.locator('[data-tab="track"]:visible').tap();
  await page.locator('[data-track-player-id="p0"]').tap();
  await page.locator('[data-tab="home"]:visible').tap();
  await page.locator('[data-tab="track"]:visible').tap();
  expect(await page.evaluate(() => ({ A: window._sel.A.size, B: window._sel.B.size }))).toEqual({ A: 0, B: 0 });
});
