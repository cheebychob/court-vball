# Codex instructions for Court

Court is a volleyball rating tracker and game balancer.

Source of truth:
- Local files in this repo.
- Main app file: index.html.
- Do not use GitHub, ChatGPT connectors, or remote repo context.
- Work only from files available in this local folder.

Current architecture:
- Single-file HTML/CSS/JavaScript app.
- App entry point: index.html.
- Browser tests: Playwright.
- Test command: npm test.

Current behavior:
- Data is local-first and backed up/restored as JSON.
- Ratings recompute deterministically from saved games.
- Players with historical games are archived instead of destructively deleted.
- Inactive and archived players are excluded from active tracking/team-generation pools.
- Tracking supports full games, partial games with `unkA`/`unkB` untracked slot counts, and solo/scout entries.
- Tied games can be saved but do not affect ratings, records, or games played.
- Court Level labels use Rec, C, B, BB, A, and AA/Open.
- Hide ratings / stealth mode and player insight/stat cards exist.
- Event/tournament support exists with fixed teams, pools, standings, brackets, guest teams, and court/schedule projections.
- Event games carry metadata such as `evId`, `evA`, `evB`, `label`, and `matchId`; rating replay ignores those fields.

Priorities:
1. Preserve historical rating integrity.
2. Keep the app easy to use on mobile.
3. Avoid rating changes that feel mysterious or unfair.
4. Add tests before or alongside behavior changes.
5. Prefer small, reviewable changes.
6. Keep the UI clean and fast.
7. Do not rewrite the whole app unless explicitly requested.

Next focus:
- Remove hard UI caps for team generation, players-per-side formats, event courts, pools, bracket seeds, and match formats.
- Keep mobile-friendly presets while adding custom values for unusual formats.
- Preserve validation for impossible states.
- Keep rating math unchanged unless explicitly requested.
- Add self-test and Playwright coverage with behavior changes.

Do not regress:
- Historical rating replay must remain deterministic.
- Archived players must remain available to historical games and replay.
- Inactive and archived players must not enter active generation pools or tracking setup.
- Untracked slots must remain counts, not roster players.
- Tied games must not move ratings.
- Event/tournament metadata must not change ratings by itself.

When changing code:
- Explain the behavior change first.
- Identify affected functions.
- Make the smallest safe change.
- Add or update tests when practical.
- Preserve the single-file app unless intentionally splitting.
- Do not add unnecessary dependencies.
- Run npm test before reporting done.
- Do not commit unless explicitly told.
