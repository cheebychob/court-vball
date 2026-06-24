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
- Added future backlog item for player stats visual clarity and broader modern UI polish.

## Current priorities

Work through issues in this order:

1. Warn before seed-rating edits rewrite history.
2. Clean up unused teamSize setting.
3. Add more Playwright coverage around import/export and rating replay.
4. Later: decide tied-game behavior if it becomes relevant.
5. Later: visual cleanup and modern UI pass.

## Working rule

One issue at a time. Small diff. Tests included when practical.
Do not mix visual redesign work with rating/data integrity changes.
