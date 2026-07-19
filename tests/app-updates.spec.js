import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const CURRENT_BUILD = '20260719.2';

async function routeBuildChecks(page, getBuild) {
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.headers()['x-court-build-check'] === '1') {
      const build = getBuild();
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta name="court-build" content="${build}"></head></html>`
      });
      return;
    }
    await route.continue();
  });
}

test('machine-readable build marker matches APP_INFO.build', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('meta[name="court-build"]').getAttribute('content')).toBe(CURRENT_BUILD);
  expect(await page.evaluate(() => APP_INFO.build)).toBe(CURRENT_BUILD);
});

test('update checks issue a no-store request and the same build stays quiet', async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.__courtBuildFetches = [];
    window.fetch = (input, options = {}) => {
      if (options.headers && options.headers['X-Court-Build-Check'] === '1') {
        window.__courtBuildFetches.push({ url: String(input), cache: options.cache, method: options.method, headers: options.headers });
      }
      return originalFetch(input, options);
    };
  });
  await routeBuildChecks(page, () => CURRENT_BUILD);
  await page.goto('/');
  expect(await page.evaluate(() => AppUpdates.check({ force: true }))).toBe(CURRENT_BUILD);
  expect(await page.evaluate(() => window.__courtBuildFetches.at(-1))).toMatchObject({
    cache: 'no-store', method: 'GET', headers: { 'X-Court-Build-Check': '1' }
  });
  expect(await page.locator('#appUpdateNotice').isHidden()).toBe(true);
  expect(await page.evaluate(() => AppUpdates.status)).toBe('current');
});

test('different builds prompt, dismissal is build-specific, and a later build prompts again', async ({ page }) => {
  let deployedBuild = '20260719.3';
  await routeBuildChecks(page, () => deployedBuild);
  await page.goto('/');
  await page.evaluate(() => AppUpdates.check({ force: true }));
  await expect(page.locator('#appUpdateNotice')).toBeVisible();
  await expect(page.locator('#appUpdateCopy')).toContainText(`Running build ${CURRENT_BUILD} · available build 20260719.3`);

  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(page.locator('#appUpdateNotice')).toBeHidden();
  await page.evaluate(() => AppUpdates.check({ force: true }));
  await expect(page.locator('#appUpdateNotice')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('court:update-dismissed-build'))).toBe('20260719.3');

  deployedBuild = '20260719.4';
  await page.evaluate(() => AppUpdates.check({ force: true }));
  await expect(page.locator('#appUpdateNotice')).toBeVisible();
  await page.evaluate(() => { tab = 'more'; render(); });
  await expect(page.locator('#updateStatusLine')).toHaveText('Update available · build 20260719.4.');
});

test('Update now is blocked during an in-progress game without navigating', async ({ page }) => {
  await routeBuildChecks(page, () => '20260719.3');
  await page.goto('/');
  await page.evaluate(() => AppUpdates.check({ force: true }));
  const before = page.url();
  const applied = await page.evaluate(async () => {
    live = { scoreA: 1, scoreB: 0, teamA: [], teamB: [], log: {}, undo: [], expanded: {} };
    return AppUpdates.applyUpdate();
  });
  expect(applied).toBe(false);
  expect(page.url()).toBe(before);
  await expect(page.locator('#toast')).toHaveText('Finish or discard the current game before updating.');
});

test('network update reload preserves local data and cleans the cache-busting query', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([{ id: 'kept', name: 'Kept Player', seedRating: 50, active: true, archived: false }]));
    localStorage.setItem('court:unrelated', 'keep-this-too');
  });
  await routeBuildChecks(page, () => '20260719.3');
  await page.goto('/');
  await page.evaluate(() => AppUpdates.check({ force: true }));
  const navigated = page.waitForEvent('framenavigated');
  await page.evaluate(() => { void AppUpdates.applyUpdate(); return true; });
  await navigated;
  await expect.poll(() => new URL(page.url()).searchParams.has('_court_build')).toBe(false);
  expect(await page.evaluate(() => ({
    playerIds: JSON.parse(localStorage.getItem('vb:players')).map(p => p.id),
    unrelated: localStorage.getItem('court:unrelated')
  }))).toEqual({ playerIds: ['kept'], unrelated: 'keep-this-too' });
});

test('temporary update query parameters are cleaned on ordinary boot', async ({ page }) => {
  await routeBuildChecks(page, () => CURRENT_BUILD);
  await page.goto('/?source=home-screen&_court_build=20260719.2');
  await expect.poll(() => page.evaluate(() => location.search)).toBe('?source=home-screen');
});

test('offline update-check failures stay silent and leave the app usable', async ({ page }) => {
  await page.route('**/*', async route => {
    if (route.request().headers()['x-court-build-check'] === '1') await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/');
  await page.evaluate(() => { tab = 'more'; render(); });
  expect(await page.evaluate(() => AppUpdates.check({ force: true }))).toBeNull();
  await expect(page.locator('#updateStatusLine')).toHaveText('Could not check while offline.');
  await expect(page.locator('#settings-about')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#main').textContent.length)).toBeGreaterThan(100);
});

test('Cloudflare Pages headers require HTML shell revalidation', () => {
  const headers = readFileSync('_headers', 'utf8');
  expect(headers).toMatch(/\/\s+Cache-Control: no-cache, must-revalidate/);
  expect(headers).toMatch(/\/index\.html\s+Cache-Control: no-cache, must-revalidate/);
});
