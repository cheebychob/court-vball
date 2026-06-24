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
