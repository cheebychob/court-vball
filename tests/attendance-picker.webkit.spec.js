import { test, expect } from '@playwright/test';

const players = Array.from({ length: 60 }, (_, index) => ({
  id: `p${index}`,
  name: `Player ${String(index + 1).padStart(2, '0')}`,
  aliases: index === 44 ? ['Forty Five'] : [],
  seedRating: 40 + (index % 30),
  rating: 40 + (index % 30),
  active: true,
  archived: false,
  pickupEligible: true,
  roles: {},
  lifetime: {},
  history: [{ i: 0, r: 40 + (index % 30) }]
}));

test('iPhone WebKit keeps attendance scroll and search focus through rapid selection', async ({ page }) => {
  await page.addInitScript(roster => {
    localStorage.setItem('vb:players', JSON.stringify(roster));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ numTeams: 2, attendanceScope: 'all', attendanceSort: 'az' }));
  }, players);
  await page.goto('/');
  await page.locator('[data-tab="teams"]:visible').first().tap();
  await page.evaluate(() => {
    window._pool = new Set();
    renderTeams();
    const list = document.querySelector('[data-attendance-results]');
    const choice = document.querySelector('[data-player-choice="p30"]');
    list.scrollTop += choice.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientHeight / 2;
    window.scrollTo(0, 400);
  });

  const list = page.locator('[data-attendance-results]');
  const choice = page.locator('[data-player-choice="p30"]');
  const before = await page.evaluate(() => ({
    list: document.querySelector('[data-attendance-results]').scrollTop,
    page: window.scrollY
  }));
  const box = await choice.boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  const after = await page.evaluate(() => ({
    list: document.querySelector('[data-attendance-results]').scrollTop,
    page: window.scrollY
  }));
  expect(Math.abs(after.list - before.list)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.page - before.page)).toBeLessThanOrEqual(2);

  const search = page.getByRole('searchbox', { name: 'Search attendance' });
  await search.fill('Forty Five');
  await search.press('Enter');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  expect(await page.evaluate(() => window._pool.has('p44'))).toBe(true);

  const footer = await page.locator('[data-attendance-actions]').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewport: innerHeight };
  });
  expect(footer.top).toBeGreaterThanOrEqual(0);
  expect(footer.bottom).toBeLessThanOrEqual(footer.viewport);
  expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
});
