import { test, expect } from '@playwright/test';

test('app boots and built-in self-test passes', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Court/);
  await expect(page.getByRole('heading', { name: /Roster/i })).toBeVisible();

  await page.getByRole('button', { name: /More/i }).click();
  await page.getByRole('button', { name: /Run self-test/i }).click();

  await expect(page.getByText(/Self-test · 15\/15 passed/i)).toBeVisible();
});

test('can add a player and persist after reload', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '+ Add player', exact: true }).click();
  await page.getByPlaceholder('Player name').fill('Test Player');
  await page.getByRole('button', { name: /Intermediate/i }).click();

  await page
    .locator('.sheet')
    .getByRole('button', { name: 'Add player', exact: true })
    .click();

  await expect(page.getByText('Test Player')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Test Player')).toBeVisible();
});

test('migrates old imported players with missing active to active', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vb:players', JSON.stringify([
      { id: 'old-import', name: 'Old Import', seedRating: 43 },
      { id: 'away-import', name: 'Away Import', seedRating: 43, active: false }
    ]));
    localStorage.setItem('vb:games', '[]');
  });

  await page.goto('/');

  const activeStates = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vb:players')).map(({ name, active }) => ({ name, active }))
  );
  expect(activeStates).toContainEqual({ name: 'Old Import', active: true });
  expect(activeStates).toContainEqual({ name: 'Away Import', active: false });

  await page.getByRole('button', { name: /Teams/i }).click();
  await expect(page.getByRole('button', { name: /Old Import/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Away Import/i })).toHaveCount(0);
});
