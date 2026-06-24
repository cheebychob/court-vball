# Court local handoff

## Current state

Court is running locally as a single-file web app in index.html.

Development setup:
- npm test runs Playwright tests.
- npm run dev starts the local dev server.
- Tests live in tests/smoke.spec.js.

## Current priorities

Work through issues in this order:

1. Fix migration so old players with missing active field default to active=true.
2. Fix team generation so inactive players cannot remain in the generated team pool.
3. Replace hard-delete player behavior with archive/soft-delete for historical integrity.
4. Decide tied-game behavior.
5. Warn before seed-rating edits rewrite history.
6. Clean up unused teamSize setting.

## Working rule

One issue at a time. Small diff. Tests included when practical.
