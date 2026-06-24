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

## Current priorities

Work through issues in this order:

1. Fix team generation so inactive players cannot remain in the generated team pool.
2. Replace hard-delete player behavior with archive/soft-delete for historical integrity.
3. Decide tied-game behavior.
4. Warn before seed-rating edits rewrite history.
5. Clean up unused teamSize setting.

## Working rule

One issue at a time. Small diff. Tests included when practical.
