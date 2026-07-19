import { test, expect } from '@playwright/test';

async function openSettings(page) {
  await page.goto('/');
  if ((await page.viewportSize()).width >= 1060) {
    await page.getByRole('navigation', { name: 'Desktop navigation' }).getByRole('button', { name: 'Settings', exact: true }).click();
    return;
  }
  await page.getByRole('button', { name: 'Open more menu', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Settings', exact: true }).click();
}

test('Settings renders the centralized Court version and stays readable on mobile and desktop', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openSettings(page);

    const info = await page.evaluate(() => ({
      ...APP_INFO,
      frozen: Object.isFrozen(APP_INFO),
      label: appVersionLabel(),
      renderSource: renderMore.toString()
    }));
    expect(info).toMatchObject({
      name: 'Court',
      version: '0.11.0',
      build: '20260719.2',
      releaseNotes: 'Event chips now support independent corrections, clearer count badges, and more explicit tracking guidance.',
      frozen: true,
      label: 'Court v0.11.0 · Build 20260719.2'
    });
    expect(info.renderSource).not.toContain('0.8.0');
    expect(info.renderSource).not.toContain('20260716.9');

    const about = page.locator('#settings-about');
    await expect(about.getByRole('heading', { name: 'About Court', exact: true })).toBeVisible();
    await expect(about.getByText(info.label, { exact: true })).toBeVisible();
    await expect(about.getByText(info.releaseNotes, { exact: true })).toBeVisible();
    await expect(about.getByRole('button', { name: 'Copy version', exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${viewport.width}px Settings overflow`).toBeLessThanOrEqual(0);

    const nav = page.getByRole('navigation', { name: viewport.width >= 1060 ? 'Desktop navigation' : 'Main navigation' });
    await nav.getByRole('button', { name: 'Home', exact: true }).click();
    if (viewport.width >= 1060) {
      await nav.getByRole('button', { name: 'Settings', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Open more menu', exact: true }).click();
      await page.locator('.sheet').getByRole('button', { name: 'Settings', exact: true }).click();
    }
    await expect(page.locator('#settings-about').getByText(info.label, { exact: true })).toBeVisible();
  }
});

test('restoring old or foreign backup metadata cannot replace APP_INFO', async ({ page }) => {
  await openSettings(page);
  const original = await page.evaluate(() => ({ ...APP_INFO, label: appVersionLabel() }));
  const oldBackup = { players: [{ id: 'old', name: 'Old Player', seedRating: 50 }], games: [], settings: { hideRatings: false }, events: [], v: 1 };

  await page.getByRole('button', { name: 'Restore from backup', exact: true }).click();
  await page.locator('#impTxt').fill(JSON.stringify(oldBackup));
  await page.locator('.sheet').getByRole('button', { name: 'Restore from paste', exact: true }).click();
  await expect(page.getByText('Restored', { exact: true })).toBeVisible();
  await expect(page.locator('#settings-about').getByText(original.label, { exact: true })).toBeVisible();

  const foreignMetadata = { ...oldBackup, appVersion: '99.0.0', appBuild: 'foreign', APP_INFO: { name: 'Other', version: '99.0.0', build: 'foreign' } };
  await page.getByRole('button', { name: 'Restore from backup', exact: true }).click();
  await page.locator('#impTxt').fill(JSON.stringify(foreignMetadata));
  await page.locator('.sheet').getByRole('button', { name: 'Restore from paste', exact: true }).click();

  expect(await page.evaluate(() => ({ ...APP_INFO, label: appVersionLabel() }))).toEqual(original);
  await expect(page.locator('#settings-about').getByText(original.label, { exact: true })).toBeVisible();
});

test('Copy version uses the complete formatter label and shows success', async ({ page }) => {
  await page.addInitScript(() => {
    window.__copiedVersion = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__copiedVersion = text; } }
    });
  });
  await openSettings(page);
  await page.getByRole('button', { name: 'Copy version', exact: true }).click();

  expect(await page.evaluate(() => window.__copiedVersion)).toBe('Court v0.11.0 · Build 20260719.2');
  await expect(page.locator('#toast')).toHaveText('Version copied');
  await expect(page.locator('#toast')).toHaveClass(/show/);
});

test('Copy version safely falls back when the Clipboard API is unavailable or rejected', async ({ page }) => {
  await page.addInitScript(() => {
    window.__fallbackCopies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    document.execCommand = command => {
      window.__fallbackCopies.push({ command, text: document.activeElement?.value });
      return true;
    };
  });
  await openSettings(page);
  await page.getByRole('button', { name: 'Copy version', exact: true }).click();

  expect(await page.evaluate(() => window.__fallbackCopies)).toEqual([
    { command: 'copy', text: 'Court v0.11.0 · Build 20260719.2' }
  ]);
  await expect(page.locator('#toast')).toHaveText('Version copied');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('denied'); } }
    });
    document.execCommand = () => false;
  });
  await page.getByRole('button', { name: 'Copy version', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Could not copy version');
});
