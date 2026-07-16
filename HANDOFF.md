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
- Tightened fixed-teams schedule packing and balanced court assignment. buildSchedule now tries 32 deterministic candidate orderings derived from the schedule seed (candidate 0 is the old single-ordering greedy, so packing can never be worse), keeps the fewest-slot result, and reassigns courts within each slot so per-court totals stay within one match. Example: 8 teams in 2 pools of 4 on 3 courts now packs 4 slots of 3 with courts loaded 4/4/4 (was 5 slots loaded 5/4/3).
- Made the fixed-teams schedule plan stable while games are logged. The candidate packer runs only on the full matchup set; the pending view is a filtered copy of the frozen plan, so logging, editing, or deleting a result never moves a remaining match to a different court or reorders it — only time estimates re-anchor and emptied rounds compress in time. A slot left partially empty by a played match keeps its surviving matches on their planned courts (an idle court in a round is correct, not something to optimize away).

## Fixed-teams scheduler baseline

buildSchedule is no longer byte-frozen as of the packing/court-balance change
(July 13, 2026). The round-robin matchup set for a given event is unchanged
(fixedMatchupSetSignature is stable across the engine change and across
revisions), but slot and court assignment intentionally differ from the old
single-ordering greedy engine. New baseline, from the self-test fixture
(12 teams, 2 pools of 6, 4 courts, seed `fixed-self-test`, revision 1):

- hash32(fixedScheduleOrderSignature) = 1100611134 (slots pack 4/4/4/4/4/4/4/2; old greedy used 9 slots)
- hash32(fixedMatchupSetSignature) = 1245902534 (identical to the old engine)

Reason: the old engine packed one seeded ordering greedily and assigned courts
by fill position, which wasted slots and skewed matches onto Court 1. The
rotating-groups generator and all rating math are untouched.

### Stable-plan invariant (do not regress)

plannedSlots is the single source of court/round truth; pending is a filtered
view of it. The plan (slot + court for every match) is a pure function of
(matchup set, seed, revision, court count) and is always computed from the
FULL matchup set — never from the pending subset. Logging, editing, or
deleting a game must not change any pending match's court, opponents,
relative order, or round grouping; only time estimates may re-anchor and
fully-cleared rounds compress remaining rounds earlier in time. Never re-run
assignFixedScheduleSlots or the candidate scorer on a filtered pending list.
Explicit regenerate (new revision) — or changed plan inputs such as court
count or the team list — are the only paths that may re-pack; timing-only
setting changes (start/setMin/matchMin/breakMin) must not replan.
fixedScheduleOrderSignature uses each match's planned slot index (m.slot),
not its array position, so pending-view signatures stay stable as played
matches drop off. The "Stable plan" self-tests cover all of this.

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
