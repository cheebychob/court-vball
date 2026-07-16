# Court Issue Backlog

This file tracks current engineering risk and future work. Items were checked against the current `index.html`; do not mark work complete here unless it is present there.

## Current state

- Court is still a single-file HTML/CSS/JavaScript app in `index.html`.
- Storage is local-first: players, games, events, and settings are saved locally, and JSON backup/restore exports that state.
- Ratings replay deterministically from saved games on load and after commits. Derived display fields such as deltas, win probability, and prediction correctness are rebuilt during replay.
- Historical player deletion is archive-first: players with game history remain available to replay and history, while archived players are hidden from normal roster, tracking, and team generation flows.
- Tracking supports full games, partial games with `unkA`/`unkB` untracked slot counts, and solo/scout entries.
- Untracked slots are counts, not fake roster players.
- Tied games can be saved for reference and do not move ratings, records, or games played.
- Stat events are per-player volleyball actions stored in game logs; they are included in backups as part of `games`.
- Court Level labels use Rec, C, B, BB, A, and AA/Open, derived from the 0-100 rating.
- Hide ratings, player insight/stat cards, demo data, and built-in self-test exist.
- Event/tournament support exists with fixed teams, pools, standings, brackets, guest teams, and court/schedule projections.
- Event games carry metadata such as `evId`, `evA`, `evB`, `label`, and `matchId`; rating replay ignores those fields.

## Next focus

### Dynamic format controls / remove UI caps

Current hard caps are UI controls, not rating-engine limits:
- Team generation only exposes 2-6 teams.
- Match setup exposes players-per-side presets for 2s, 3s, 4s, 6s, plus Any.
- Event schedule setup exposes 1-8 courts.
- Event team pool controls expose pools A-H and bulk split presets up to 8 pools.
- Bracket seeding is capped at 32 teams.
- Event match logging exposes Single set and Best of 3 only.
- There are no custom values for unusual formats.

Recommended behavior:
- Keep presets for fast mobile use.
- Add custom values where a user needs unusual team counts, players-per-side formats, courts, pools, bracket sizes, or match formats.
- Preserve validation for impossible states, such as no selected players, empty sides, too many teams for the selected pool, negative untracked slots, or nonsensical side sizes.
- Keep soft warnings for very large event formats and preserve mobile-friendly rendering.
- Keep rating math unchanged unless explicitly requested.
- Add self-test and Playwright coverage with the behavior change.

### Event format follow-up

Event/tournament support exists, but large or unusual formats still need cleanup:
- Current scheduling and bracket rendering should be checked on mobile for very large events.
- Match logging is currently oriented around Single set and Best of 3; custom match formats are future work.
- Event metadata must stay separate from rating math unless a rating behavior change is explicit and tested.

## Completed / implemented

### Data integrity fixes

Implemented in `index.html`:
- Old imported players missing `active` now migrate to `active=true`.
- Players have `archived` state.
- Historical players are archived instead of destructively deleted.
- Archived players remain available for historical replay and game history.
- Archived players are excluded from the normal roster, tracking selections, team pools, and team generation.
- Inactive players are excluded from active pools and team generation.
- Runtime selection state is cleared when players are archived/deleted.
- Historical game display keeps working for archived players because the player record remains available.

### Rating behavior clarity

Implemented in `index.html`:
- Tied games can be saved, show as not rated, and do not affect ratings, records, or games played.
- Editing the seed rating for a player with history shows a warning before replaying that history from the new seed.
- Derived game fields are rebuilt during replay and stored only for recap/history display.
- Solo/scout tracking exists and uses own logged events only; the solo result does not run through team Elo.
- Partial tracking exists and stores untracked slots as `unkA`/`unkB`.
- Partial games with both sides tracked scale the result impact by tracked context.
- One-sided partial games avoid Elo and use logged own events conservatively.
- Score-only one-sided partial games record the result without moving ratings.
- Untracked autofill never creates roster players and does not pollute rating replay.

### UI and data model cleanup

Implemented in `index.html`:
- `teamSize` is not present in current settings.
- Volleyball levels now use Rec/C/B/BB/A/AA-Open style labels and descriptions.
- Player stat cards and insights exist.
- Hide ratings / stealth mode exists.
- Import/export includes players, games, settings, events, and per-game stat logs.
- Built-in self-test includes regression checks for deterministic replay, archive behavior, partial/solo behavior, untracked slots, tied games, confidence rules, event standings, event metadata, brackets, round robin scheduling, and guest teams.

### Event/tournament support

Implemented in `index.html`:
- Events/tournaments have fixed team rosters and optional pools.
- Guest teams are supported; guest-only games drive standings but do not move ratings.
- Event standings derive from linked games and group best-of-3 sets by `matchId`.
- Event games remain in normal game history if event grouping is deleted.
- Brackets exist and derive advancement from saved event games; deleting/fixing games self-corrects bracket state.
- Multiple brackets per event are supported with creation-time guards.
- Non-power-of-2 brackets use byes.
- Courts and schedule projections exist for pool play and playoffs.
- Event metadata is exported/imported and does not affect rating replay.

### Confidence based on informative games

Implemented in `index.html`:
- `trackedGames` is reset and rebuilt during replay.
- Confidence labels, rating volatility, uncertainty banding, and overall insight sample use `trackedGames`, not raw appearances.
- A game increments `trackedGames` only when it informed the player: both sides tracked, or that player's own events were logged.
- `gamesPlayed` still counts appearances, so records, per-game rates, trend, and game-mix counters remain separate.
- Existing saves re-derive `trackedGames` from history on load, so previously inflated confidence can settle back.
- Self-test covers informative vs non-informative games and confidence label thresholds.

## Later visual cleanup

- Player stat cards and readable grouped stats exist, so the old abbreviation-heavy stats issue is resolved.
- A broader modern UI pass can still happen later, but it should be visual-only.
- Preserve rating logic, saved data shape, game replay behavior, and mobile usability during visual work.
- Add smoke or visual checks before large UI changes.

## Do not regress

- Historical rating replay must remain deterministic.
- Archived players must not disappear from historical games or replay.
- Inactive and archived players must not be selected in active generation pools or tracking setup.
- Untracked slots must remain `unkA`/`unkB` counts, not roster players.
- Tied games must not move ratings, records, or games played.
- Event/tournament metadata must not change ratings by itself.
- Rating math should remain unchanged during UI/control cleanup unless explicitly requested.
