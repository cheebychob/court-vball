# Court Test Plan

## Manual smoke test

1. Open the app.
2. Add 6 players.
3. Generate balanced teams.
4. Track a game.
5. Save the game.
6. Confirm ratings change.
7. Open game history.
8. Open a player profile.
9. Export backup.
10. Reload page.
11. Confirm data persists.

## Automated tests

Use Playwright.

Core automated checks:

- Page loads with correct title.
- Navigation tabs work.
- Built-in self-test passes.
- Add player flow works.
- Data persists after reload.
- More > Run self-test opens passing result.
