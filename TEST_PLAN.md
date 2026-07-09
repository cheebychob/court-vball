# Court Test Plan

## Current test strategy

- Use the built-in self-test for rating-engine and replay invariants.
- Use Playwright for browser flows, persistence, import/export, and UI behavior.
- Add tests before or alongside behavior changes.
- Keep rating math unchanged unless a task explicitly asks for rating behavior changes.

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
12. Run More > Run self-test and confirm all checks pass.

## Automated tests

Use Playwright.

Core automated checks:

- Page loads with correct title.
- Navigation tabs work.
- Built-in self-test passes.
- Add player flow works.
- Data persists after reload.
- More > Run self-test opens passing result.

Regression areas that should stay covered:

- Deterministic rating replay from saved games.
- Archive behavior preserves historical players and hides them from active flows.
- Inactive/archived players do not enter active generation pools.
- Tied games save but do not move ratings, records, or games played.
- Full, partial, and solo tracking keep their separate rating behavior.
- Partial games store untracked slots as `unkA`/`unkB`, not roster players.
- One-sided score-only partial games record the result without moving ratings.
- Stat event logs survive backup/import as part of saved games.
- Event/tournament data survives backup/import.
- Event metadata does not affect rating replay.
- Event standings, best-of-3 grouping, brackets, round robin scheduling, and guest teams stay covered by self-test.
- Hide ratings mode does not leak numeric rating deltas.

Next test focus:

- Dynamic format controls after hard UI caps are removed.
- Custom team counts, players-per-side values, event courts, pools, bracket sizes, and match formats.
- Validation for impossible states and mobile-friendly preset behavior.
