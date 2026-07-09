# Court local handoff

## Current state

Court is running locally as a single-file web app in index.html.

Development setup:
- npm test runs Playwright tests.
- npm run dev starts the local dev server.
- Tests live in tests/.

App behavior verified against current index.html:
- Storage is local-first, with JSON backup/restore for players, games, events, settings, and per-game stat logs.
- Ratings recompute deterministically from saved games.
- Historical player deletion archives instead of removing the player record.
- Active tracking/team pools exclude inactive and archived players.
- Tracking supports full games, partial games with unkA/unkB untracked slot counts, and solo/scout entries.
- Tied games can be saved but do not move ratings, records, or games played.
- Event/tournament support exists with fixed teams, pools, standings, brackets, guest teams, and court/schedule projections.
- Event metadata is stored separately from rating math; event games rate like normal saved games.

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
- Separated player confidence from raw game appearances. Added a trackedGames counter (rebuilt on replay) so new/settling/established, rating volatility, the uncertainty band, and the "overall sample" insight only advance on games that actually informed a player: a both-sides-tracked result (Elo ran) or their own logged events. gamesPlayed still counts every appearance, so record, per-game rates, trend, and game-mix counters are unchanged.
- Added regression tests for the trackedGames confidence rule (informative vs non-informative games, and label thresholds).
- Added full/partial/solo tracking model with untracked slot counts instead of fake players.
- Added explicit tied-game save behavior: saved for reference, not rated.
- Added player insight/stat cards and hide-ratings mode.
- Added event/tournament support: fixed teams, pools, standings, brackets, guest teams, schedule/court projections, and event backup/export.

## Next focus

Work through issues in this order:

1. Dynamic format controls: remove hard UI caps while keeping fast mobile presets.
2. Add custom values for unusual team counts, players-per-side formats, event courts, pools, bracket sizes, and match formats.
3. Preserve validation for impossible states and keep rating math unchanged.
4. Add self-test and Playwright coverage with any behavior change.
5. Later: broader visual cleanup and modern UI pass.

## Working rule

One issue at a time. Small diff. Tests included when practical.
Do not mix visual redesign work with rating/data integrity changes.
