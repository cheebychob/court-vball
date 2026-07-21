import { test, expect } from '@playwright/test';

const players = Array.from({ length: 60 }, (_, index) => ({
  id: `p${index}`,
  name: `Player ${String(index + 1).padStart(2, '0')}`,
  seedRating: 40 + (index % 30),
  active: true,
  archived: false,
  roles: {}
}));

const events = [
  { id: 'fixed', name: 'Fixed Team Cup', created: 2, done: false, format: 'fixedTeams', teams: [], brackets: [] },
  { id: 'rotating', name: 'Pair Rotation Cup', created: 1, done: false, format: 'rotatingGroups', teams: [], entries: [], brackets: [], rotation: { entrySize: 2, teamSize: 4, rounds: 3, courts: 2, seedMode: 'rating' }, rotationSchedule: [] }
];

async function seed(page) {
  await page.addInitScript(({ players, events }) => {
    localStorage.setItem('vb:players', JSON.stringify(players));
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify(events));
    localStorage.setItem('vb:settings', JSON.stringify({ hideRatings: false, playerSort: 'az', numTeams: 2 }));
  }, { players, events });
}

async function openEvent(page, name) {
  await page.locator('[data-tab="events"]:visible').first().tap();
  await page.locator('.ev-row').filter({ hasText: name }).tap();
}

async function positionPicker(page, playerName, instance) {
  const sheet = page.locator('.sheet');
  const choice = sheet.getByRole('button', { name: playerName, exact: true });
  await sheet.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await sheet.evaluate((element, marker) => { element.dataset.pickerInstance = marker; }, instance);
  await sheet.evaluate((element, name) => {
    const choice = [...element.querySelectorAll('[data-player-choice]')].find(button => button.textContent.trim() === name);
    const sheetRect = element.getBoundingClientRect();
    const choiceRect = choice.getBoundingClientRect();
    element.scrollTop += choiceRect.top - sheetRect.top - element.clientHeight / 2;
  }, playerName);
  const metrics = await sheet.evaluate(element => ({ top: element.scrollTop, height: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
  expect(metrics.top).toBeGreaterThan(100);
  await expect(choice).toBeInViewport();
  return { sheet, choice, top: metrics.top };
}

async function tapChoice(page, choice) {
  const box = await choice.boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function expectPickerUnmoved(sheet, top, instance) {
  await expect(sheet).toHaveAttribute('data-picker-instance', instance);
  await expect.poll(() => sheet.evaluate(element => element.scrollTop)).toBeGreaterThanOrEqual(top - 2);
  await expect.poll(() => sheet.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(top + 2);
}

test('mobile WebKit keeps shared player pickers open and scrolled during selection', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openEvent(page, 'Fixed Team Cup');
  const initialUrl = page.url();
  await page.getByRole('button', { name: 'Add first team', exact: true }).tap();

  let picker = await positionPicker(page, 'Player 40', 'fixed-team-picker');
  const fixedPageScroll = await page.evaluate(() => window.scrollY);
  await expect(picker.choice).toHaveAttribute('type', 'button');
  await tapChoice(page, picker.choice);
  await expect(picker.choice).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-player-selection-summary]')).toHaveText('1 picked');
  await expectPickerUnmoved(picker.sheet, picker.top, 'fixed-team-picker');
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => window.scrollY)).toBe(fixedPageScroll);

  const selectedTop = await picker.sheet.evaluate(element => element.scrollTop);
  await tapChoice(page, picker.choice);
  await expect(picker.choice).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-player-selection-summary]')).toHaveText('none — guest team');
  await expectPickerUnmoved(picker.sheet, selectedTop, 'fixed-team-picker');
  expect(page.url()).toBe(initialUrl);
  expect(await page.evaluate(() => window.scrollY)).toBe(fixedPageScroll);

  await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
  await page.getByRole('button', { name: 'All events' }).tap();
  await page.locator('.ev-row').filter({ hasText: 'Pair Rotation Cup' }).tap();
  await page.getByRole('navigation', { name: 'Event sections' }).getByRole('button', { name: 'Entries', exact: true }).tap();
  await page.getByRole('button', { name: 'Add entry', exact: true }).tap();

  picker = await positionPicker(page, 'Player 45', 'entry-picker');
  await tapChoice(page, picker.choice);
  await expect(picker.choice).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-player-selection-summary]')).toContainText('1 of 2 selected');
  await expectPickerUnmoved(picker.sheet, picker.top, 'entry-picker');
  expect(new URL(page.url()).hash).toBe('');
});
