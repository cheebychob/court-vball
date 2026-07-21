import { test, expect } from '@playwright/test';

const fixturePlayers = [
  { id: 'alpha', name: 'Alpha Setter', seedRating: 62, active: true, archived: false, roles: {} },
  { id: 'bravo', name: 'Bravo Away', seedRating: 52, active: false, archived: false, roles: {} },
  { id: 'charlie', name: 'Charlie Passer', seedRating: 58, active: true, archived: false, roles: {} },
  { id: 'delta', name: 'Delta Hitter', seedRating: 80, active: true, archived: false, roles: {} },
  { id: 'archive', name: 'Archived Blocker', seedRating: 70, active: false, archived: true, roles: {} }
];

async function seedRoster(page) {
  await page.addInitScript(players => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', '[]');
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, fixturePlayers);
}

async function nav(page, name) {
  await page.locator(`[data-tab="${name.toLowerCase()}"]:visible`).first().click();
}

async function visiblePlayerNames(page) {
  return page.locator('.player-card:visible').evaluateAll(cards => cards.map(card => card.dataset.name));
}

test('clearing Players search after tab navigation restores the roster and preserves sort', async ({ page }) => {
  await seedRoster(page);
  await page.goto('/');
  await nav(page, 'Players');

  let search = page.getByRole('searchbox', { name: 'Search players', exact: true });
  await search.fill('pHa');
  await expect(page.locator('.player-card')).toHaveCount(1);
  await expect(page.getByText('Alpha Setter', { exact: true })).toBeVisible();

  await nav(page, 'Home');
  await nav(page, 'Players');
  search = page.getByRole('searchbox', { name: 'Search players', exact: true });
  await expect(search).toHaveValue('pHa');
  await search.fill('');
  await expect(page.locator('.player-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: '4 current players', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'A–Z', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rating ↓', exact: true })).toBeVisible();
  search = page.getByRole('searchbox', { name: 'Search players', exact: true });
  await search.fill('Charlie');
  await nav(page, 'Events');
  await nav(page, 'Players');
  search = page.getByRole('searchbox', { name: 'Search players', exact: true });
  await search.fill('');

  await expect(page.locator('.player-card')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Rating ↓', exact: true })).toBeVisible();
  expect(await visiblePlayerNames(page)).toEqual(['delta hitter', 'alpha setter', 'charlie passer', 'bravo away']);
});

test('empty and whitespace Players searches follow the active status filter', async ({ page }) => {
  await seedRoster(page);
  await page.goto('/');
  await nav(page, 'Players');

  const search = page.getByRole('searchbox', { name: 'Search players', exact: true });
  await search.fill('   ');
  await expect(page.locator('.player-card')).toHaveCount(4);

  await page.getByRole('button', { name: 'Active · 3', exact: true }).click();
  await expect(page.locator('.player-card')).toHaveCount(3);
  await page.getByRole('searchbox', { name: 'Search players', exact: true }).fill('  ');
  await expect(page.locator('.player-card')).toHaveCount(3);

  await page.getByRole('button', { name: 'Away · 1', exact: true }).click();
  await expect(page.locator('.player-card')).toHaveCount(1);
  await expect(page.getByText('Bravo Away', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Archived · 1', exact: true }).click();
  await expect(page.locator('.player-card')).toHaveCount(1);
  await expect(page.getByText('Archived Blocker', { exact: true })).toBeVisible();
});
