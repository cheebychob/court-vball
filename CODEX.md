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

Priorities:
1. Preserve historical rating integrity.
2. Keep the app easy to use on mobile.
3. Avoid rating changes that feel mysterious or unfair.
4. Add tests before or alongside behavior changes.
5. Prefer small, reviewable changes.
6. Keep the UI clean and fast.
7. Do not rewrite the whole app unless explicitly requested.

Known issues:
- Hard-deleting players can distort historical rating recomputation.
- Older backups may not set active=true for players.
- Inactive players can remain in the team pool.
- Tied games are saved but ignored by rating/event replay.
- Editing seed ratings rewrites historical rating history.
- teamSize exists in settings but is not currently used.

When changing code:
- Explain the behavior change first.
- Identify affected functions.
- Make the smallest safe change.
- Add or update tests when practical.
- Preserve the single-file app unless intentionally splitting.
- Do not add unnecessary dependencies.
- Run npm test before reporting done.
- Do not commit unless explicitly told.
