# Court local handoff

## Current state

Court is running locally as a single-file web app in index.html.

Development setup:
- npm test runs Playwright tests.
- npm run dev starts the local dev server.
- Tests live in tests/smoke.spec.js.

## Completed

- Added local Codex instructions.
- Added local project handoff.
- Fixed migration so old players with missing active field default to active=true.
- Fixed team generation so inactive players cannot remain in the generated team pool.
- Replaced hard-delete behavior with archive/soft-delete for players who appear in historical games.

## Current priorities

Work through issues in this order:

1. Decide tied-game behavior.
2. Warn before seed-rating edits rewrite history.
3. Clean up unused teamSize setting.
4. Add more Playwright coverage around import/export and rating replay.

## Working rule

One issue at a time. Small diff. Tests included when practical.
