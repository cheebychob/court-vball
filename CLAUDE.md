# Court — Volleyball Rating Tracker

Court is a mobile-first volleyball rating tracker, event manager, scheduler,
registration system, and game balancer.

## Source of truth

- The application is currently a single-file HTML/CSS/JavaScript app.
- `index.html` is the primary application file unless the repository shows otherwise.
- Cloudflare Worker code must be treated separately from the frontend.
- Inspect the repository before assuming filenames, architecture, or deployment behavior.

## Priorities

1. Preserve historical rating integrity.
2. Keep the app easy to use on mobile.
3. Avoid rating changes that feel mysterious or unfair.
4. Add tests before or alongside behavior changes.
5. Prefer small, reviewable changes.
6. Keep the UI clean and fast.
7. Do not rewrite or split the application unless explicitly requested.

## Known risks

- Hard-deleting players can distort historical rating recomputation.
- Older backups may not contain `active: true` for players.
- Inactive players can remain in team-selection pools.
- Tied games may be saved but ignored during rating or event replay.
- Editing seed ratings can rewrite historical rating history.
- `teamSize` exists in settings but may not currently control behavior.
- Sync and deletion behavior must work consistently across devices.
- Shared/public HTML may behave differently from the main application.

## UI expectations

- Design mobile-first, then verify desktop.
- Preserve existing visual language unless the task explicitly changes it.
- Reuse existing components, spacing, typography, buttons, inputs, checkboxes,
  dialogs, cards, and tokens where possible.
- Avoid one-off styles that make similar controls look inconsistent.
- Do not add unnecessary dependencies or frameworks.
- Do not replace functioning areas simply to modernize the code.
- Maintain accessibility: labels, focus behavior, keyboard navigation,
  touch targets, contrast, and reduced-motion considerations.
- Test narrow iPhone-sized layouts and common desktop widths.
- Avoid unexpected scrolling, focus loss, layout shifts, text wrapping,
  clipped dialogs, and controls hidden below the viewport.

## Required workflow

Before editing:

1. Inspect the relevant code and identify affected functions and UI sections.
2. Explain the current behavior and proposed behavior.
3. Search for similar components so the implementation remains consistent.
4. Identify regression risks.
5. Propose a small implementation plan.
6. Wait for approval when the prompt requests planning only.

During implementation:

1. Keep the change narrowly scoped.
2. Add or update tests.
3. Preserve stored-data and backup compatibility.
4. Do not modify rating, replay, sync, registration, or persistence behavior
   unless the task requires it.
5. Avoid unrelated cleanup.
6. Update the app version/build number according to the repository convention.

Before finishing:

1. Run all existing automated tests.
2. Add focused tests for the changed behavior.
3. Review the full diff.
4. Check for accidental unrelated changes.
5. Test desktop and mobile behavior.
6. Report:
   - behavior changed
   - files and functions changed
   - tests added or updated
   - commands run
   - remaining risks or manual checks
   - version/build update
7. Do not commit, push, merge, or deploy unless explicitly requested.

## Git safety

- Never work directly on `main`.
- Never force-push.
- Never use destructive reset or cleanup commands without explicit approval.
- Never delete stored data, migrations, backups, or deployment configuration.
- Never modify Cloudflare bindings, secrets, routes, or storage without explicit instruction.
- Leave changes uncommitted for review unless asked to commit.