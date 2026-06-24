# Court local handoff

## Current state

Court is running locally as a single-file web app in index.html.

Development setup:
- npm test runs Playwright tests.
- npm run dev starts the local dev server.
- Tests live in tests/.

## Completed

- Added local Codex instructions.
- Added local project handoff.
- Fixed migration so old players with missing active field default to active=true.
- Fixed team generation so inactive players cannot remain in the generated team pool.
- Replaced hard-delete behavior with archive/soft-delete for players who appear in historical games.
- Added future backlog item for player stats visual clarity and broader modern UI polish.
- Warned before seed-rating edits rewrite historical rating history.
- Removed unused teamSize setting.
- Added regression tests for player data integrity.
- Added backup/import/replay regression coverage.
- Added Court Level labels using Rec, C, B, BB, A, and AA/Open.
- Updated player starting-level seeding to use volleyball level labels.
- Added a Starting level guide with skill anchors.
- Added visible Cancel button to the player editor.

## Current priorities

Work through issues in this order:

1. Review Court Level labels after real use.
2. Later: improve player stat display clarity.
3. Later: decide tied-game behavior if it becomes relevant.
4. Later: broader visual cleanup and modern UI pass.

## Working rule

One issue at a time. Small diff. Tests included when practical.
Do not mix visual redesign work with rating/data integrity changes.
