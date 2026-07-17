# Court - Volleyball Rating Tracker

Court is a single-file mobile-first volleyball rating tracker and game balancer.

Current app entry point:

- index.html

## Current state

- Single-file HTML/CSS/JavaScript app.
- Local-first storage for players, games, events, and settings, with JSON backup/restore.
- Complete event Rules Hub with guided or free-form drafting, safe rich text, Quick Rules, immutable publication history, sync-aware conflicts, and unified public event pages.
- Ratings replay deterministically from saved games on load and after each save.
- Players with game history are archived instead of destructively deleted, so historical games can still replay with their players intact.
- Tracking supports full games, partial games with untracked slot counts, and solo/scout entries.
- Per-player stat event logs are stored in game history and included in backups.
- Event/tournament support exists with fixed teams, standings, brackets, guest teams, and court/schedule projections.
- Event Rules architecture: [data model, publishing, sync, and sanitization](docs/EVENT_RULES.md).
- Event metadata is separate from rating math; event games rate like normal saved games.

Core features:

- Player roster
- Archived players
- 0-100 player ratings
- Rec/C/B/BB/A/AA-Open Court Level labels
- Full, partial, and solo game tracking
- Per-player stat event logging
- Elo-style team result adjustments
- Balanced team generation
- Game history
- Events/tournaments with fixed teams, pools, standings, brackets, and scheduling
- Player stat cards and insights
- Hide ratings / stealth mode
- Backup and restore
- Demo data
- Built-in self-test

Development goals:

- Preserve rating history integrity
- Improve testing coverage
- Keep the app fast and mobile-friendly
- Make behavior predictable and explainable
- Avoid unnecessary dependencies
