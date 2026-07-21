# Court Test Plan

## Current test strategy

- Use the built-in self-test for rating-engine and replay invariants.
- Use Playwright for browser flows, persistence, import/export, and UI behavior.
- Add tests before or alongside behavior changes.
- Keep rating math unchanged unless a task explicitly asks for rating behavior changes.

## Manual smoke test

1. Open the app.
2. Add 6 players.
3. Generate balanced teams.
4. Track a game.
5. Save the game.
6. Confirm ratings change.
7. Open game history.
8. Open a player profile.
9. Export backup.
10. Reload page.
11. Confirm data persists.
12. Run More > Run self-test and confirm all checks pass.

## Automated tests

Use Playwright.

Core automated checks:

- Page loads with correct title.
- Navigation tabs work.
- Built-in self-test passes.
- Add player flow works.
- Data persists after reload.
- More > Run self-test opens passing result.

Regression areas that should stay covered:

- Deterministic rating replay from saved games.
- Archive behavior preserves historical players and hides them from active flows.
- Inactive/archived players do not enter active generation pools.
- Tied games save but do not move ratings, records, or games played.
- Full, partial, and solo tracking keep their separate rating behavior.
- Partial games store untracked slots as `unkA`/`unkB`, not roster players.
- One-sided score-only partial games record the result without moving ratings.
- Stat event logs survive backup/import as part of saved games.
- Event/tournament data survives backup/import.
- Event Rules drafts, immutable revisions, publication state, structured mismatches, and draft-deletion timestamps survive backup/import and sync.
- Public Rules pages expose only published content and keep the existing full-event URL.
- Event metadata does not affect rating replay.
- Event standings, best-of-3 grouping, brackets, round robin scheduling, and guest teams stay covered by self-test.
- Hide ratings mode does not leak numeric rating deltas.

Next test focus:

- Dynamic format controls after hard UI caps are removed.
- Custom team counts, players-per-side values, event courts, pools, bracket sizes, and match formats.
- Validation for impossible states and mobile-friendly preset behavior.

## Event Rules manual checklist

Run on a narrow phone viewport and desktop:

1. Create one fixed-team event and one rotating event (individuals and pairs when practical).
2. Open the prominent Rules action and verify Not created, Draft, Published, Updated, and Needs review states.
3. Build from event settings; verify inherited Quick Rules identify their source.
4. Start from a format-aware template, then use Build Your Rules. Skip a section, mark one Not applicable, and mark another Not decided.
5. Paste a long rules document containing headings, lists, links, a table, and unsupported formatting. Confirm formatting is cleaned and no unsafe content survives.
6. Exercise heading, bold, italic, lists, link, callout, divider, table, undo, redo, and clear-format controls. At desktop, 390×844, and 375×667, confirm no buttons overlap; confirm grouped wrapping/scrolling, touch access, and keyboard focus.
7. Make an unsaved edit and test Cancel, Escape, and the close button; keep editing once and discard once.
8. Save the draft, sync another device, and confirm the draft appears without exposing it on the public link.
9. Create a structured Quick Rules override that differs from Court. Test Update event settings, Update draft language, intentional exception, and Review later.
10. Publish with incomplete sections after explicit confirmation. Verify the immutable revision number and optional summary.
11. Open the public event link and a saved standalone full-event HTML copy. Test navigation, Quick Rules, contents, exact/case-insensitive/synonym search, next/previous/wrap, Enter, Clear, and section chips. Confirm header Print/Share buttons are absent in both copies and the hosted search runs under the Worker Content Security Policy.
12. Advance the event clock/date, publish another revision, and verify the required explanation and public update notice.
13. Open revision history, view an older revision, copy it into a new draft, and publish it as a new revision.
14. Unpublish with confirmation. Confirm the stable public URL remains but no rules body or draft is exposed.
15. Duplicate the event. Confirm Rules are a private draft, public IDs/URLs are absent, and event name/date/venue references are flagged for review.
16. Back up and restore. Confirm draft/revisions/publication metadata survive without an automatic Worker republish.
17. Delete the event, sync both devices, and confirm it does not return. Verify historical games and ratings remain unchanged.

## iPhone player-picker regression checklist

1. Test in iPhone Safari.
2. Test from the Home Screen-installed app if supported.
3. Open Add Pair with a large roster.
4. Scroll near the middle or bottom.
5. Select and deselect several players; confirm the picker does not jump.
6. Repeat after using roster search.
7. Repeat in another team/player selection workflow.
8. Rotate portrait to landscape and back, then retest.
9. Confirm the modal remains open and the selected summary and save validation update.
10. Close the modal and confirm the underlying page returns to the correct scroll position.
