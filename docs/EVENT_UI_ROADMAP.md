# Court Event UI Roadmap

**Project:** Court — Volleyball Rating Tracker
**Roadmap created:** July 25, 2026
**Source:** Event UI/UX inspection performed on `audit/event-ui-ux`
**Architecture:** Single-file HTML/CSS/JavaScript application
**Primary application file:** `index.html`

## Purpose

This document is the source of truth for the staged event UI overhaul.

The goal is to improve event setup, live-event operation, completed-event
presentation, registration management, schedules, standings, brackets, and
publicly shared event content without rewriting the application or changing
rating, scheduling, synchronization, registration, or persistence behavior.

## Core product goals

1. Make event pages easier to understand.
2. Reveal complexity gradually.
3. Make the next appropriate action obvious.
4. Use one primary vertical scrolling surface on mobile.
5. Eliminate unnecessary nested and hidden scrolling.
6. Make draft, scheduled, live, and completed events feel distinct.
7. Preserve all existing event formats and functionality.
8. Improve touch targets and long-name handling.
9. Make public event content polished enough to send directly to players.
10. Keep changes small, tested, reviewable, and independently revertible.

## Working rules

* Work on one roadmap item at a time.
* Start every implementation branch from an updated `main`.
* Do not implement roadmap items on the audit branch.
* Do not start a dependent item until its dependencies are marked Done.
* Each implementation PR must update this document.
* Keep incomplete work marked In Progress or Blocked. Never mark partial work Done.
* Do not combine later roadmap items because they are nearby in the code.
* Do not perform unrelated cleanup.
* Add tests before or alongside behavior changes.
* Run the full applicable test suite before marking an item Done.
* Update the Court version/build number according to repository conventions.
* Do not change stored-data formats unless the roadmap item explicitly allows it.
* Do not commit, push, merge, or deploy unless specifically instructed.

## Status values

* **Ready** — dependencies are complete and work may begin.
* **Planned** — waiting for an earlier roadmap item.
* **In Progress** — implementation has started on its designated branch.
* **Blocked** — work cannot continue; the blocker must be documented.
* **Done** — implementation and tests have been merged into `main`.
* **Deferred** — intentionally postponed and not required for the current overhaul.

## Current work

**Current item:** EUX-13
**Expected branch:** `feat/event-entries-standings-ux`
**Next item after completion:** Core event UI roadmap complete

EUX-10 is implemented and verified on `feat/events-list-lifecycle-groups`.
Its focused and full applicable test suites pass, and fixed-team, rotating,
mobile, and desktop layouts were checked. It remains `In Progress` until a pull
request is created and merged; those fields stay `Pending`.

EUX-11 is implemented and verified on `feat/court-side-score-reporting`. It
closes the last manual hole in the event pipeline by letting players submit
scores from the published schedule into an organizer review queue. It requires a
new Cloudflare KV binding (`SCORE_REPORTS`) before it works in production, and
remains `In Progress` until that binding exists and a pull request is merged.

EUX-12 is implemented and verified on
`feat/registration-entry-card-cleanup`. It is a focused follow-up to EUX-06:
organizer registration cards now lead with participant identity, keep team
hierarchy intact, and progressively disclose advanced management controls
without changing registration data or public registration.

EUX-13 is in progress on `feat/event-entries-standings-ux`. It separates
participant management from rankings, replaces the mobile standings statistic
grid with compact ranked rows, stabilizes selection and refresh interactions,
and adds status-aware organizer review actions.

## Roadmap summary

| Done | ID     | Work item                                           | Branch                                     | Depends on     | Status  |
| ---- | ------ | --------------------------------------------------- | ------------------------------------------ | -------------- | ------- |
| [x]  | EUX-01 | Event lifecycle and state-appropriate UI            | `feat/event-lifecycle-ui`                  | None           | Done    |
| [x]  | EUX-02 | Event navigation, anchors, touch targets, and names | `fix/event-navigation-and-touch`           | EUX-01         | Done    |
| [x]  | EUX-03 | Event sheet headers and share-action layout         | `fix/event-sheet-share-layout`             | None           | Done    |
| [x]  | EUX-04 | Mobile event section views                          | `feat/event-mobile-section-views`          | EUX-01, EUX-02 | Done    |
| [x]  | EUX-05 | Responsive rotating standings and brackets          | `fix/event-responsive-standings-brackets`  | EUX-02         | Done    |
| [x]  | EUX-06 | Registration dashboard single-scroll layout         | `fix/registration-dashboard-single-scroll` | EUX-03         | Done    |
| [x]  | EUX-07 | Event venue field                                   | `feat/event-venue`                         | None           | Done    |
| [x]  | EUX-08 | Public event-page shell polish                      | `fix/public-event-shell`                   | EUX-02, EUX-07 | Done    |
| [x]  | EUX-09 | Public bracket presentation                         | `feat/public-bracket-layout`               | EUX-05, EUX-08 | Done    |
| [ ]  | EUX-10 | Events-list grouping and lifecycle status           | `feat/events-list-lifecycle-groups`        | EUX-01         | In Progress |
| [ ]  | EUX-11 | Court-side score reporting                          | `feat/court-side-score-reporting`          | EUX-08, EUX-09 | In Progress |
| [ ]  | EUX-12 | Registration entry card cleanup                     | `feat/registration-entry-card-cleanup`     | EUX-06         | In Progress |
| [ ]  | EUX-13 | Entries/standings separation and interaction stability | `feat/event-entries-standings-ux`        | EUX-05, EUX-06, EUX-12 | In Progress |

---

# EUX-01 — Event lifecycle and state-appropriate UI

**Branch:** `feat/event-lifecycle-ui`
**Risk:** Medium
**Status:** Done

## Objective

Make draft, scheduled, live, playoff, and completed events present the correct
information and actions without adding a stored lifecycle field.

## In scope

* Add a pure derived `eventLifecycleState(ev)` helper.
* Derive lifecycle from existing event data and helpers.
* Support at least:

  * `draft`
  * `scheduled`
  * `live`
  * `poolsComplete`
  * `playoffs`
  * `complete`
* Move the overview and next-action area above secondary content.
* Hide the finale card when no games have been played.
* Use a compact progress treatment while an event is active.
* Show the complete trophy/finale treatment only when a champion exists or the
  event is complete.
* Collapse disabled registration into a small secondary row when appropriate.
* Hide registration setup from completed events.
* Demote setup actions after play starts.
* Remove duplicate controls that launch the same game-logging action.
* Preserve all fixed and rotating event formats.

## Out of scope

* Mobile section switching.
* Bracket layout changes.
* Sheet or modal restructuring.
* Public-page redesign.
* New persisted lifecycle/status properties.
* Rating, schedule, seeding, sync, or registration-rule changes.

## Required tests

* Lifecycle derivation for each supported event state.
* Fixed and rotating event coverage.
* Empty event does not display results or championship actions.
* Active event displays the live progress treatment.
* Completed event displays the finale treatment.
* Completed event does not display registration setup.
* Setup actions are available before play and demoted after play starts.
* Existing event-results and playoff tests remain passing.

## Acceptance criteria

* A draft event clearly behaves like setup.
* A live event prioritizes recording and viewing ongoing play.
* A completed event prioritizes results.
* Lifecycle is derived and does not alter stored event records.
* No event format loses functionality.

## Completion record

* **Completed date:** 2026-07-25
* **Pull request:** https://github.com/cheebychob/court-vball/pull/40
* **Merge commit:** 78282cbb89549a6f7bf756dcbe642656d119138f
* **Version/build:** 0.26.0 / 20260725.7 (from 0.25.0 / 20260725.6)
* **Tests run:** `npm test` (275 passed, chromium + mobile-webkit),
  `npm run test:worker` (65 passed), `npm run test:version-check` (10 passed),
  `npm run check:version`
* **Important implementation notes:**
  * `eventLifecycleState(ev, {gameList, sc})` is pure and derived from teams,
    entries, schedules, saved games, and bracket state. Supporting helpers:
    `eventLifecycleFacts`, `eventLifecycleMeta`, `eventBracketProgress`,
    `eventIsComplete` (a cheap `done`/all-brackets-complete check used by the
    registration card and its background patcher), and `eventLifecycleStarted`.
    Nothing is persisted, so stored events and older backups are unchanged.
  * `complete` is `ev.done` or every bracket having a champion; `playoffs`
    requires a bracket plus a started bracket or completed pool play;
    `poolsComplete` requires a schedule with every match resulted; `scheduled`
    requires a schedule or a bracket; otherwise `draft`.
  * `championsStripHtml(ev, state)` now returns nothing before any game is
    played, a compact `[data-event-progress]` "Results so far" card while play
    is under way, and the trophy finale (`eventFinaleHtml`) only for a saved
    champion or a completed event. `[data-event-finale]` still marks both
    in-play and final cards so existing selectors keep working.
  * Overview and next action moved above the finale, rules, and registration on
    both fixed and rotating event pages. Fixed events keep one game-logging
    control (`[data-event-next-action]` "Log next result"); the duplicate
    bottom "Log a game" button is gone. Rotating events gained a lifecycle next
    action ("Log next match" / "Set up schedule").
  * Fixed-team setup controls moved into `fixedEventSetupActionsHtml`
    (`[data-event-setup-actions]`, `data-demoted`): promoted directly under the
    overview before play, demoted below standings under an "Event setup"
    heading once results exist. Every control stays present and enabled.
  * Disabled registration collapses to a compact row
    (`[data-registration-display="compact"]`); completed events hide
    registration setup (`"final"`) and drop the section plus its navigation
    destination entirely when registration was never used.
* **Remaining follow-up:**
  * The overview's primary logging action hides once every bracket has a
    champion even if `ev.done` is false; per-match logging in the schedule
    section is unaffected.
  * Rotating setup controls still live in the schedule and entries sections;
    only fixed-team setup actions are demoted. EUX-02's shared section
    definition is the right place to revisit this.

---

# EUX-02 — Event navigation, anchors, touch targets, and names

**Branch:** `fix/event-navigation-and-touch`
**Risk:** Medium
**Status:** Done
**Depends on:** EUX-01

## Objective

Make event navigation understandable and make event controls reliable on touch
screens without yet changing the page into mobile section views.

## In scope

* Create one shared section definition for:

  * section order
  * navigation labels
  * section visibility
  * default section
* Fix zero-height Teams and Entries destinations.
* Ensure navigation order and rendered section order match.
* Add a visible active navigation state.
* Add `aria-current` to the current destination.
* Correct repeated-tab behavior after the user manually scrolls away.
* Add an obvious horizontal-overflow cue to the event navigation.
* Raise event navigation controls and frequently used event actions to at least
  44 px.
* Scope small-button changes to event-related contexts.
* Allow long team and participant names to wrap.
* Avoid ellipsizing the opponent out of schedule rows.
* Increase the per-match result-logging target.
* Add mobile dock and safe-area bottom padding.
* Reduce unnecessary trailing event-page space.
* Preserve existing event-section scroll-offset tests.

## Required tests

* Active navigation state after click.
* Active state updates after manual scrolling.
* Re-selecting a destination after scrolling away returns to it.
* No zero-height event destinations.
* Navigation and DOM section order match.
* Relevant interactive controls meet minimum touch-target dimensions.
* Long names remain readable at 320 px and 375 px.
* No document-level horizontal overflow.
* Existing scroll-position tests remain passing.

## Completion record

* **Completed date:** 2026-07-25
* **Pull request:** https://github.com/cheebychob/court-vball/pull/41
* **Merge commit:** dc98a382f192fe7fa56d1f460c869565bd95fcef
* **Version/build:** 0.27.0 / 20260725.8 (from 0.26.0 / 20260725.7)
* **Tests run:** `npm test` (285 passed, chromium + mobile-webkit, including the
  new `tests/event-navigation.spec.js`), `npm run test:worker` (65 passed),
  `npm run test:version-check` (10 passed), `npm run check:version`
* **Important implementation notes:**
  * `eventSectionModel(ev,{state,showRegistration})` is the single definition of
    destination order, labels, visibility, and the default section. Both
    renderers build their navigation from `eventSubnavHtml(model)`, so the strip
    can no longer list a destination the page does not render or order them
    differently. `defaultId` is `standings` for a complete event, `schedule`
    while play is under way, otherwise `overview`; EUX-04 should reuse it for
    mobile section defaults.
  * The zero-height `#event-teams` / `#event-entries` anchors are gone. The
    "Teams &amp; standings" / "Entries &amp; standings" card now carries that id and
    the standings table inside it carries `#event-standings`, so every
    destination has real content and navigation order matches document order
    (Overview → Registration → Schedule → Playoffs → Teams/Entries → Standings).
  * `syncEventNav()` marks the active destination with `.on` plus
    `aria-current="location"`, derived from scroll position on a passive,
    rAF-throttled `scroll`/`resize` listener and re-applied by `mountEventNav()`
    after every event render. A tapped destination is pinned at the position it
    landed on (`window._eventSectionPin`), so it stays highlighted even when the
    page cannot scroll far enough, and releases as soon as the reader scrolls
    more than 3 px away.
  * `eventSection(id)` no longer returns early when the requested destination is
    already active, so re-selecting it after scrolling away returns to it. An id
    with no rendered section falls back to the model's default destination.
  * The subnav sets `data-overflow="none|start|end|both"` and fades the edge that
    still hides destinations.
  * Touch targets: subnav buttons and every `.btn.sm` inside `main.event-detail`
    are at least 44 px; per-match logging controls carry `.log-match`
    (46 px tall, 96 px minimum width). The change is scoped to event contexts, so
    small buttons elsewhere are untouched. `--event-sticky-offset` moved
    126 → 132 px (900 px and up: 118 → 124 px) to match the taller strip.
  * Long names wrap through the new `.match-teams` class (fixed schedule rows,
    makeup rows, rotating playoff teams) plus `overflow-wrap:anywhere` on
    `.name-link` and event standings cells; no schedule row ellipsizes its
    opponent any more.
  * Trailing space shrank from `100vh - offset + dock` to `min(34vh,280px)`, and
    `main.event-detail` gained explicit dock and safe-area bottom padding
    (44 px at 760 px and up, 52 px at 1060 px and up where the dock is hidden).
  * No stored event data, backup, sync, rating, scheduling, seeding, or
    registration behavior changed.
* **Remaining follow-up:**
  * The Teams/Entries and Standings destinations sit in the same card, roughly
    one header apart. EUX-04's mobile section views are the right place to decide
    whether they should become separate views.
  * The rotating standings table still scrolls horizontally inside
    `.entry-table`; that is EUX-05's scope.
  * Rotating setup controls still live in the schedule and entries sections
    (carried over from EUX-01); demoting them was not part of this item.

---

# EUX-03 — Event sheet headers and share-action layout

**Branch:** `fix/event-sheet-share-layout`
**Risk:** Low–Medium
**Status:** Done

## Objective

Prevent close controls from covering sheet content and make share/export
actions immediately reachable.

## In scope

* Add a reusable non-floating sheet header.
* Preserve the existing sheet focus trap and close handling.
* Initially migrate:

  * full schedule sharing
  * participant schedule sharing
  * event-results sharing
* Place primary share actions above the preview or inside a sticky footer.
* Make long previews collapsible.
* Add a neutral preview frame.
* Verify close controls never overlap preview or form content.
* Do not automatically migrate every application sheet in this branch.

## Required tests

* Close control does not overlap content at the top or after scrolling.
* Share actions are reachable without scrolling through the entire preview.
* Existing publication, schedule-share, and results-share tests pass.
* Focus trapping and Escape/close behavior remain correct.
* Dirty-close behavior remains unchanged where applicable.

## Completion record

* **Completed date:** 2026-07-27
* **Pull request:** https://github.com/cheebychob/court-vball/pull/42
* **Merge commit:** 2917c62
* **Version/build:** 0.28.0 / 20260727.1 (from 0.27.0 / 20260725.8)
* **Tests run:** `npm test` (289 passed, chromium + mobile-webkit, including the
  new `tests/event-sheet-share-layout.spec.js`), `npm run test:worker`
  (65 passed), `npm run test:version-check` (10 passed), `npm run check:version`
* **Important implementation notes:**
  * Three opt-in helpers define the reusable chrome: `sheetHeadHtml(title,
    {subtitle})` renders `header.sheet-head[data-sheet-head]`,
    `sheetFootHtml(actionsHtml,{closeLabel})` renders
    `div.sheet-foot[data-sheet-foot]`, and `sheetPreviewHtml(bodyHtml,
    {label,note,open})` renders `details.sheet-preview[data-sheet-preview]`.
    Sheets that do not call them are byte-for-byte unchanged.
  * `openSheet` still creates the one `.sheet-x` button itself and only *moves*
    that same node into `[data-sheet-head-actions]` when the sheet supplies a
    header. Because it is the same element with the same
    `requestCloseSheet()` handler, `trapDialogTab`, Escape, scrim behavior, the
    `.sheet-x` focus fallback, and `window._sheetBeforeClose` dirty-close guards
    all behave exactly as before. `.sheet-head .sheet-x` drops
    `position:sticky` and `float:right`, so the close control sits in normal
    flow and cannot cover content at the top or after scrolling.
  * `.sheet-foot` is `position:sticky;bottom:0` and bleeds to the sheet edges
    through `--sheet-pad-x` (16 px, 20 px at 760 px and up) with
    `.sheet:has(.sheet-foot){padding-bottom:0}`, so its border box exactly
    matches the sheet's padding box and adds no horizontal overflow. It carries
    the safe-area bottom inset. `.sheet-foot .schedule-actions` is forced to one
    column so the footer's primary action spans the sheet at every width; the
    event-page `.schedule-actions` rows are untouched.
  * Migrated sheets: `openScheduleShare`, `openParticipantScheduleShare`,
    `openEventResults`, and `shareEventResults`. For the two schedule sheets the
    public-link panel now sits *above* the preview and the Download action sits
    in the footer, so neither sharing path requires scrolling the preview.
    `openEventResults` moves "Save / share …" into the footer.
  * `sheetCloseBtn` gained an optional `{flush:true}` that omits its inline
    `margin-top`; the default call signature and output are unchanged.
  * `.schedule-file-note` was replaced by the generic `.sheet-preview-note`
    (same visual token) and its now-unused rule was removed. `#resultsCanvas`
    stays outside the collapsible frame so recap image export is unaffected.
  * Headings, the single "Close" button name, `[data-schedule-preview]`,
    `[data-participant-schedule-preview]`, `[data-public-schedule-section]`,
    `[data-results-share-options]`, and `[data-download-schedule]` are all
    preserved, so every existing publication, schedule-share, and results-share
    test passes unchanged.
  * No stored-data, backup, sync, rating, scheduling, seeding, or registration
    behavior changed. `esc()` was added to the participant sheet's
    `model.exportTitle` heading, which was previously interpolated raw.
* **Remaining sheets requiring migration:**
  * Every other sheet still uses the original floating `.sheet-x`, deliberately.
    The highest-value follow-ups are the registration dashboard (EUX-06 already
    covers its layout and should adopt `sheetHeadHtml`/`sheetFootHtml`), the
    rules hub/editor/publish sheets (long previews with a bottom action), the
    player profile and player editor sheets (which position their own controls
    against the floating close button), and the courts/schedule settings and
    rotation settings sheets (long forms with a bottom Save).

---

# EUX-04 — Mobile event section views

**Branch:** `feat/event-mobile-section-views`
**Risk:** Medium–High
**Status:** Done
**Depends on:** EUX-01, EUX-02

## Objective

Replace the extremely long mobile event page with one primary event section at
a time while retaining the desktop long-page workflow.

## In scope

* Below the approved mobile breakpoint, display one event section at a time.
* Keep the status summary and lifecycle-aware primary action visible.
* Use the shared section definition introduced in EUX-02.
* Preserve section selection through ordinary application rerenders.
* Restore the correct section after closing an event sheet.
* Default draft events to Overview/Setup.
* Default active events to Schedule or the lifecycle-appropriate working view.
* Default completed events to Results.
* At larger widths, retain the long page with active scroll-aware navigation.
* Preserve existing section IDs where practical.

## Required tests

* Only the selected primary section is visible on mobile.
* Every available section remains reachable.
* Section selection survives rerendering.
* Closing a sheet returns to the prior section.
* Draft, live, and completed events receive the correct default section.
* Desktop retains the intended long-page behavior.
* Existing scroll, focus, WebKit, and event-navigation tests pass.

## Manual checks

* Physical iPhone Safari.
* Narrow Chrome/Android viewport.
* Tablet portrait and landscape.
* Desktop.
* Mobile keyboard open during score and event editing.

## Completion record

* **Completed date:** 2026-07-27
* **Pull request:** https://github.com/cheebychob/court-vball/pull/43
* **Merge commit:** 355fb2fab4d79ff32260bfca9379b0dacd2bc240
* **Version/build:** 0.29.0 / 20260727.2 (from 0.28.0 / 20260727.1)
* **Tests run:** `npm test` (295 passed, chromium + mobile-webkit, including the
  new `tests/event-mobile-section-views.spec.js`), `npm run test:worker`
  (65 passed), `npm run test:version-check` (10 passed), `npm run check:version`
* **Physical-device checks:** Not yet performed. See "Manual checks still
  required" below — physical iPhone Safari, tablet portrait/landscape, and the
  mobile keyboard during score and event editing are outstanding.
* **Important implementation notes:**
  * The breakpoint is declared once, in CSS: `--event-view-mode` is `sections`
    by default and `page` from 760 px up (the width the rest of the event page
    already uses). `eventViewMode()` reads that custom property, so the layout
    and the script can never disagree and a resize across the breakpoint simply
    re-runs the existing rAF-throttled `syncEventNav()`.
  * `applyEventSectionViews(view)` toggles `.event-view-hidden`
    (`display:none!important`) plus the `hidden` attribute on the top-level
    blocks of `main.event-detail`. Membership comes from `eventViewGroups()`:
    a block belongs to the destination section it follows, unless it carries an
    explicit `data-event-view` (space-separated, so a block may appear in more
    than one view). Everything above the first destination — the back button,
    `screenHead`, the subnav, and the status strip — is chrome and stays
    visible. `main` carries `data-event-view-mode` and `data-event-view`.
  * Explicit memberships: `data-event-view="overview"` on the fixed-team setup
    actions (so the demoted position below standings still belongs to
    Overview) and on the four event-management buttons (mark complete, details,
    duplicate, delete). `championsStripHtml`'s progress and finale cards use
    `eventResultsViewIds(ev)` — `overview` plus `teams`/`entries` — so a
    completed event opening on Results leads with the trophy above its
    standings table.
  * `eventSectionModel` now returns a `viewId` per destination. Standings live
    inside the participants card, so `standings` maps to the `teams`/`entries`
    view and the subnav button carries `data-event-view`; both destinations
    reveal the same card. Section ids, labels, order, and `defaultId` are
    unchanged, so EUX-02's shared definition is still the only source.
  * In section views `syncEventNav()` no longer derives the active destination
    from scroll position; it keeps the explicit selection in
    `window._eventSection`, falling back to the model's `defaultId`. Because
    that variable already survives `render()`, section selection survives
    ordinary rerenders and a sheet closing without any new state. Above the
    breakpoint the original pin/scroll logic is untouched.
  * `eventStatusStripHtml(meta,actionHtml)` renders
    `[data-event-status]` — the lifecycle title, the state pill, and a second
    copy of the primary action marked `data-event-status-action`. It is hidden
    on desktop and on the Overview view, where the full card already carries
    both, so exactly one logging control is ever on screen. Both renderers now
    build their next action through a `nextActionHtml(marker)` helper so the two
    copies can never drift.
  * `scrollToEventSection` anchors on the visible status strip in section views
    so selecting a destination cannot scroll the status and primary action out
    from under the sticky navigation.
  * `EventRegistration.patchSummaryCard` re-applies the active view after it
    replaces the summary node, so a background registration refresh cannot leak
    the registration card into another section.
  * No stored event data, backup, sync, rating, scheduling, seeding, or
    registration behavior changed; nothing about the section view is persisted.
* **Test updates in this branch:** twelve existing specs now select the section
  they exercise (`eventSection(id)`) after opening an event, because the default
  Playwright viewport is 390 px and therefore in section views. EUX-02's
  long-page assertions (destination heights and order, scroll-driven active
  state) moved to a desktop viewport, where that behavior now lives;
  `tests/improvements.spec.js`'s sticky-clearance check measures against the
  navigation strip instead of an absolute pixel window, since a short mobile
  section cannot always scroll up to it.
* **Remaining follow-up:**
  * Crossing the breakpoint to desktop and back re-derives the mobile
    destination from the desktop reading position rather than restoring the
    previously tapped one. That is coherent, but a dedicated remembered mobile
    selection would be friendlier.
  * The trailing `main.event-detail::after` spacer is still sized for the long
    page, so a short mobile section carries more empty space below it than it
    needs.
  * Teams/Entries and Standings still resolve to one view because they are one
    card. Splitting them is only worth revisiting if EUX-05's responsive
    standings work makes the standings table a separate block.

---

# EUX-05 — Responsive rotating standings and brackets

**Branch:** `fix/event-responsive-standings-brackets`
**Risk:** Medium
**Status:** Done
**Depends on:** EUX-02

## Objective

Remove the two major hidden horizontal-scroll areas from mobile event pages.

## In scope

### Rotating standings

* Replace the wide rotating standings table with stacked mobile rows below the
  approved breakpoint.
* Keep the table layout at larger widths.
* Show rank, entry name, record, points, differential, and points for/against
  without requiring horizontal scrolling.
* Preserve row activation and participant schedule behavior.

### Brackets

* Show one bracket round at a time on narrow screens.
* Reuse the existing segmented-control visual pattern.
* Keep multi-column bracket presentation on larger screens.
* Preserve playoff match opening, logging, editing, keyboard use, and seeding.
* Warn when pool play is incomplete; do not block organizers.

## Required tests

* No rotating standings horizontal scroller at 320 px or 375 px.
* Every standings value is readable.
* Every bracket round is reachable.
* Bracket match interaction works with touch and keyboard.
* Existing playoff, bracket, and seeding tests pass.
* No schedule or rating calculations change.

## Completion record

* **Completed date:** 2026-07-27
* **Pull request:** https://github.com/cheebychob/court-vball/pull/44
* **Merge commit:** Pending
* **Version/build:** 0.30.0 / 20260727.3 (from 0.29.0 / 20260727.2)
* **Tests run:** `npm test` (302 passed, chromium + mobile-webkit, including the
  new `tests/event-responsive-standings-brackets.spec.js`), `npm run test:worker`
  (65 passed), `npm run test:version-check` (10 passed), `npm run check:version`
* **Physical-device checks:** Not yet performed. See "Manual checks still
  required" below.
* **Important implementation notes:**
  * Both halves reuse EUX-04's single breakpoint. The base (mobile-first) rules
    are now the stacked/one-round presentation and the existing
    `@media (min-width:760px)` block restores the table and the multi-column
    bracket, so there is still exactly one declaration of where the event page
    changes shape.
  * **Rotating standings.** `ENTRY_STANDING_STATS` is the single definition of
    the five stat columns (`played`, `record`, `points`, `diff`, `pfpa`) with
    their labels and value functions; `entryStandingsHeadHtml()` and
    `entryStandingStatsHtml(r)` build the header and the row cells from it, so
    the header and the rows can no longer drift apart. Each value carries its
    own `.entry-stat-label`, hidden from 760 px up where the header row returns.
  * On phones `.entry-table .stand-row` becomes `display:flex;flex-wrap:wrap`:
    `.entry-rank` (22 px) and `.entry-name` share the first line and each
    `.entry-stat` takes `calc((100% - 20px)/3)`, so the five values land in a
    tidy 3 + 2 grid whose columns line up. `.entry-table`'s `overflow-x:auto`
    and the `min-width:570px` row moved into the 760 px block, so there is no
    scroller below the breakpoint. Row markup, `data-scroll-key`, the
    `openEntrySchedule` handler, and the `<b>` entry name are unchanged, so row
    activation and the participant schedule sheet behave exactly as before.
  * **Brackets.** `bracketCardsHtml` now emits a `.seg.bracket-rounds` switcher
    (the app's existing segmented-control pattern, `role="group"` +
    `aria-pressed`) listing each round name plus `Champion`, and tags every
    `.br-col` with `data-round-index` / `data-round-active`. CSS hides
    `[data-round-active="false"]` below 760 px and reveals every column above
    it, where the switcher is `display:none` — so the selection is inert on
    desktop and the horizontal scroller is unchanged there.
  * `bracketDefaultRoundIndex` opens the card on the first round with an
    unresolved match, or the champion column once every match is resolved.
    `setBracketRound(brId,index)` stores the choice in `window._bracketRound`
    (keyed by bracket id, never persisted) and patches the card in place rather
    than rerendering, so switching rounds cannot move the reader's scroll
    position. Because the generator reads that same store, the selection also
    survives the `render()` that follows logging or editing a result.
  * Every match control is still the same `<button class="br-match">` with the
    same `openPlayoffMatch` handler and `aria-label`, so touch, keyboard, and
    focus-return behaviour are untouched; hidden rounds are `display:none` and
    therefore stay out of the tab order. Seeding, `bracketState`, and
    `getPlayoffMatchState` were not modified.
  * `poolPlayIncompleteNote(ev)` adds a `[data-pool-incomplete]` warning to the
    bracket setup sheet when a schedule exists and some matches have no result.
    It is derived from `eventLifecycleFacts` and is purely advisory — the
    Create bracket button, seeding controls, and every other action stay
    enabled. The `N>32` note no longer claims phones scroll the bracket
    sideways.
  * No stored event data, backup, sync, rating, scheduling, seeding, or
    registration behaviour changed, and no public/shared output was touched
    (`publicBracketHtml` remains EUX-09's scope).
* **Test updates in this branch:** `tests/event-results-playoffs.spec.js`'s
  16-team bracket test previously asserted the mobile scroller overflowed —
  the behaviour EUX-05 removes — and now asserts one round on phones plus the
  multi-column scroller on desktop; two tests that reach into an earlier round
  select it first through a new `bracketRound()` helper. The EUX-02 touch-target
  test compared a control sized at exactly 44 px against `>= 44`, which measures
  `44 ± 1.5e-5` depending on the fractional scroll offset and failed
  intermittently on `master` as well; it now allows sub-pixel noise.
* **Manual checks still required:**
  * Physical iPhone Safari for both the stacked standings and the round
    switcher.
  * Tablet portrait and landscape around the 760 px breakpoint.
  * A bracket with more than 16 teams, where the switcher wraps to several rows.

---

# EUX-06 — Registration dashboard single-scroll layout

**Branch:** `fix/registration-dashboard-single-scroll`
**Risk:** Medium
**Status:** In Progress
**Depends on:** EUX-03

## Objective

Make registration management use one vertical scrolling surface and put entries
before secondary metrics.

## In scope

* Remove the independently scrolling registration entry list.
* Make the dashboard sheet the only vertical scrolling surface.
* Place filters and registration entries near the top.
* Show two important headline counts initially.
* Move secondary counts into an expandable summary.
* Keep actions in a sticky footer.
* Update refresh and polling restoration to preserve:

  * sheet scroll position
  * active filter
  * focused entry
  * currently open review context
* Preserve import, review, accept, reject, and check-in functionality.

## Required tests

* No nested vertical scroller in the registration dashboard.
* Entries appear in the first useful mobile viewport.
* Poll refresh preserves position and focus.
* Filtering still works after refresh.
* Import/review actions remain reachable.
* Existing registration and public-registration tests pass.
* Add or extend physical/WebKit-style scroll regression coverage.

## Completion record

* **Completed date:** Pending
* **Pull request:** Pending
* **Merge commit:** Pending
* **Version/build:** 0.31.0 / 20260727.4 (from 0.30.0 / 20260727.3)
* **Tests run:**
  * `npx playwright test tests/event-registration.spec.js --project=chromium`
    (10 passed)
  * `npx playwright test tests/public-registration-flow.spec.js:306`
    (2 passed: chromium + mobile-webkit)
  * `npx playwright test tests/registration-event-integration.spec.js
    tests/event-sheet-share-layout.spec.js tests/version.spec.js
    tests/app-updates.spec.js --project=chromium` (22 passed)
  * `npm run test:version-check` (10 passed), `npm run test:worker` (65
    passed), and `npm run check:version` passed as part of `npm run verify`.
  * The full `npm test` run completed 302 of 303 tests. Its only failure was the
    existing first test in `tests/public-registration-flow.spec.js`, which
    intermittently loses/truncates typed public contact data under parallel
    load. The test passed in both Chromium and mobile WebKit when rerun
    directly, but a five-repeat stress run reproduced the unrelated flake
    (7 passed, 3 failed). EUX-06 does not change the public registration form.
* **Important implementation notes:**
  * `.registration-entry-list` no longer has a height cap or overflow, so the
    dashboard `.sheet` is the only vertical scrolling surface.
  * `registrationDashboardHtml` now uses EUX-03's `sheetHeadHtml` and
    `sheetFootHtml`. Accepted entries and pending review are the two headline
    counts; the filter and entries follow immediately; six secondary counts,
    the registration window, and the public link live in a collapsed
    `[data-registration-secondary-summary]`.
  * Review import and event-day check-in remain visible in the sticky footer.
    Settings, share, and copy stay in the same footer behind a compact
    "More actions" control so entries remain visible at 320 px.
  * `EventRegistration.dashboardInteraction` /
    `restoreDashboardInteraction` preserve the sheet scroll position, active
    filter, focus key, and focused entry while keyed rows patch in place.
    `[data-registration-modal]` keeps polling active across member-review
    rerenders, and the review query, focus, and dashboard return context
    survive refreshes without persistence.
  * Fixed-team and rotating dashboards are covered at 320 px, 375 px, and
    1280 px. The public submission-to-dashboard path supplies mobile WebKit
    scroll regression coverage.
  * No stored event/registration shape, backup, sync, rating, scheduling,
    seeding, import, check-in, or public registration behavior changed.
* **Remaining before Done:**
  * Resolve or formally accept the unrelated parallel public-registration test
    flake, then record a fully passing `npm test` run.
  * Complete physical iPhone Safari and Android/Chrome checks; automated
    Chromium and mobile WebKit coverage is complete.
  * Create and merge the pull request, then fill the PR and merge-commit fields.
    Only then mark the item `Done`, change its summary checkbox to `[x]`, add
    the completed Progress-log entry, move EUX-07 to `Ready`, and update Current
    work to EUX-07.

---

# EUX-07 — Event venue field

**Branch:** `feat/event-venue`
**Risk:** Low
**Status:** Done

## Objective

Add an optional event venue/location field and surface it consistently.

## In scope

* Add an optional venue field to new-event creation.
* Add venue editing to Event details.
* Show venue in the internal event summary where appropriate.
* Show venue in public event headers.
* Include venue in results, recap, print, and exported content where relevant.
* Preserve compatibility with events that have no venue.
* Use the existing `venue` or `location` read paths where appropriate.

## Required tests

* New events save venue.
* Existing events without venue remain valid.
* Venue survives backup and restore.
* Venue survives synchronization and merge.
* Venue survives event duplication.
* Venue renders safely with long text and special characters.
* Public and printed content omit the venue row cleanly when empty.

## Completion record

* **Completed date:** 2026-07-27
* **Pull request:** https://github.com/cheebychob/court-vball/pull/46
* **Merge commit:** ae4052823e3e9539ec6a80fccbc88c9156a191d0
* **Version/build:** 0.32.0 / 20260727.5 (from 0.31.0 / 20260727.4)
* **Tests run:**
  * `npx playwright test tests/event-venue.spec.js --project=chromium`
    (4 passed).
  * Focused Chromium regression run covering event venue, date, schedule
    sharing, public schedule links, results/playoffs, rules, sync, mobile
    event sections, event navigation, version, and app updates (110 passed).
  * `npm test` (307 passed, including Chromium and mobile WebKit),
    `npm run test:worker` (65 passed), `npm run test:version-check` (10
    passed), and `npm run check:version` passed.
  * `git diff --check` passed.
* **Physical-device checks:** Completed for iPhone Safari and Android/Chrome,
  as confirmed after merge.
* **Important implementation notes:**
  * New-event creation and Event details now accept an optional
    `#evVenue`. Values are trimmed, empty values are omitted, and clearing
    the field also clears the legacy `location` alias.
  * `eventVenue`, `eventSummaryText`, and `eventSummaryHtml` provide one
    escaped read path with `venue` first and legacy `location` fallback.
    Venue appears in fixed and rotating organizer summaries and event-list
    rows through `[data-event-venue]`.
  * Full and participant schedule models carry venue into previews, print
    documents, and exports. Public event and draft-rules headers, event
    results documents, and recap images include it only when populated.
  * Focused coverage verifies new-event creation and editing, legacy events
    without venue, backup/restore, worker synchronization and merge,
    duplication, long and special-character values, clean empty output,
    both event formats, and 320 px / 1280 px layouts.
  * Stored event compatibility is preserved: no schema migration or new
    dependency was added, and existing generic backup, restore, sync, and
    duplication paths carry the optional property unchanged.
* **Remaining follow-up:** None.

---

# EUX-08 — Public event-page shell polish

**Branch:** `fix/public-event-shell`
**Risk:** Low–Medium
**Status:** In Progress
**Depends on:** EUX-02, EUX-07

## Objective

Improve the shared public event page without changing publication behavior or
redesigning the public bracket yet.

## In scope

* Ensure the page has exactly one primary `<h1>`.
* Prevent the embedded schedule from duplicating the event heading.
* Make public navigation opaque.
* Add a visible active-navigation state.
* Add a visible cue when navigation overflows horizontally.
* Correct sticky navigation and rules-search offsets.
* Standardize section scroll margins.
* Improve long-name wrapping.
* Display event venue.
* Add a last-updated indicator when reliable update data exists.
* Verify no organizer actions or private registration information appear.
* Standardize public schedule and event-page visual tokens.

## Out of scope

* Dynamic social-preview image generation.
* Public bracket redesign.
* Registration privacy toggle.
* Authentication or access-control changes.

## Required tests

* Exactly one `<h1>`.
* Public navigation remains understandable at 320 px.
* Sticky elements do not overlap section headings.
* Venue appears only when populated.
* No private or administrative data leaks.
* Existing public publication and schedule-link tests pass.

## Completion record

* **Completed date:** Pending
* **Pull request:** Pending
* **Merge commit:** Pending
* **Version/build:** 0.33.0 / 20260727.6 (from 0.32.0 / 20260727.5)
* **Tests run:**
  * `npx playwright test tests/public-event-shell.spec.js
    --project=chromium` (4 passed).
  * Focused Chromium regression run covering the public shell, event rules,
    venue, public schedule links, schedule sharing, results/playoffs, version,
    and app updates (70 passed).
  * `npm test` (311 passed, including Chromium and applicable mobile WebKit),
    `npm run test:worker` (65 passed), `npm run test:version-check` (10
    passed), and `npm run check:version` passed.
  * `git diff --check` passed.
* **Layout checks:** Fixed-team and rotating public pages were visually checked
  at 320 px and 1280 px. Navigation overflow/active cues, sticky schedule and
  rules offsets, long-name wrapping, and document overflow were checked.
* **Important implementation notes:**
  * `scheduleExportBodyHtml` gained an opt-in `embedded` mode used only by
    `renderPublicEventDocument`. The embedded schedule keeps its public
    timing/round content but omits its document header, so the unified page has
    exactly one `<h1>`. Standalone schedule previews, downloads, participant
    schedules, and published schedule-only documents retain their headers.
  * `publicEventBehaviorScript` now measures the sticky navigation and rules
    search bar, synchronizes shared CSS offset variables, marks the active
    destination with `.on` and `aria-current="location"`, and maintains
    `[data-overflow]` as the public navigation scrolls or resizes.
  * The Worker copy of that storage-free public script and its strict CSP hash
    were synchronized. No Cloudflare bindings, routes, deployment settings, or
    other configuration changed.
  * `publicEventStyles` makes navigation opaque, adds gold active and overflow
    cues, standardizes scroll margins and schedule/public surface tokens, and
    lets public table, bracket, fixed-team, and rotating-entry names wrap.
  * `[data-public-last-updated]` appears only when the published rules revision
    supplies a valid timestamp. Venue remains escaped and conditional through
    `eventVenue`.
  * Focused privacy coverage verifies that organizer controls, registration
    contacts and notes, management tokens, public registration tokens, and
    publication-management metadata do not enter the public document.
  * No stored event shape, backup, sync, rating, scheduling, seeding,
    registration, bracket derivation, or publication identity behavior changed.
* **Remaining before Done:**
  * Complete physical iPhone Safari and Android/Chrome checks.
  * Create and merge the pull request, then fill the completed-date,
    pull-request, and merge-commit fields.
  * Only after those gates are complete, mark EUX-08 `Done`, change its summary
    checkbox to `[x]`, add its dated Progress-log entry, and move EUX-09 from
    `Planned` to `Ready`.

---

# EUX-09 — Public bracket presentation

**Branch:** `feat/public-bracket-layout`
**Risk:** Medium
**Status:** Done
**Depends on:** EUX-05, EUX-08

## Objective

Replace the plain public bracket output with a readable, polished,
player-facing bracket.

## In scope

* Reuse existing bracket data derivation.
* Build public-only bracket presentation.
* Prioritize readability over administrative interaction.
* Support narrow phones without silent horizontal clipping.
* Clearly distinguish rounds, teams, scores, winners, pending matches, and
  championship outcome.
* Ensure print output remains usable.
* Do not add organizer logging controls to public pages.

## Required tests

* All rounds and matches render.
* Winners and final scores are accurate.
* Pending matches remain understandable.
* Long names remain readable.
* Mobile and printed layouts remain usable.
* Existing playoff and public-page tests pass.

## Completion record

* **Completed date:** 2026-07-27
* **Pull request:** Pending
* **Merge commit:** Pending
* **Version/build:** 0.34.0 / 20260727.7 (from 0.33.0 / 20260727.6)
* **Tests run:**
  * `npx playwright test tests/public-bracket-layout.spec.js` (4 passed).
  * Focused Chromium regression run covering the public bracket, public shell,
    rules/publication, results/playoffs, public schedule links, version, and app
    updates (57 passed).
  * `npm test` (315 passed, including Chromium and applicable mobile WebKit),
    `npm run test:worker` (65 passed), `npm run test:version-check` (10
    passed), and `npm run check:version` passed.
  * `git diff --check` passed.
* **Layout checks:** Fixed-team and rotating public brackets were visually
  checked at 320 px and 1280 px. A 16-team fixed bracket and a three-team
  rotating bracket with a bye were checked for long-name wrapping, complete
  round visibility, match-card containment, and document overflow. Print media
  was checked at 816 px with all four rounds and 15 matches visible.
* **Important implementation notes:**
  * `publicBracketHtml` now reuses `bracketState`,
    `getPlayoffMatchState`, and `getDivisionProgress` to render every public
    round and match. The organizer-only `bracketCardsHtml` and bracket
    derivation are unchanged.
  * `publicBracketStatusLabel`, `publicBracketTeamScore`, and
    `publicBracketTeamHtml` provide player-facing labels and accurate,
    side-oriented scores for completed matches while keeping byes, ready
    matches, in-progress results, pending teams, and results under review
    understandable.
  * `[data-public-bracket]` contains read-only round, match, team, score,
    winner, and championship output with no buttons, `onclick` handlers, or
    organizer logging controls.
  * The public-only CSS uses a single-column round flow on narrow screens,
    contained multi-column rounds from 720 px, long-name wrapping, distinct
    winner and pending treatments, and print rules that keep match cards
    together without a horizontal bracket canvas.
  * No event, bracket, game, backup, sync, rating, scheduling, seeding,
    registration, or publication metadata shape changed.

---

# EUX-10 — Events-list grouping and lifecycle status

**Branch:** `feat/events-list-lifecycle-groups`
**Risk:** Low–Medium
**Status:** In Progress
**Depends on:** EUX-01

## Objective

Make the event list easier to scan as the number of historical events grows.

## In scope

* Reuse `eventLifecycleState(ev)`.
* Group events into useful date/status sections such as:

  * Today
  * Upcoming
  * In progress
  * Past
* Avoid adding a new persisted archive field.
* Show a compact lifecycle/status indicator.
* Show useful event progress, such as completed matches out of scheduled
  matches, when available.
* Keep event rows compact and mobile friendly.
* Preserve existing event sorting behavior where it remains meaningful.
* Keep completed events accessible without dominating the current-event list.

## Required tests

* Events appear in the correct group.
* Events with missing dates receive a sensible fallback.
* Live and completed states are represented correctly.
* Group order is stable.
* Event opening and navigation remain unchanged.
* Existing events-list and event-date tests pass.

## Completion record

* **Completed date:** Pending
* **Pull request:** Pending
* **Merge commit:** Pending
* **Version/build:** 0.35.0 / 20260727.8 (from 0.34.0 / 20260727.7)
* **Tests run:**
  * `npx playwright test tests/events-list-lifecycle-groups.spec.js
    --project=chromium` (3 passed).
  * Focused Chromium regression run covering event-list grouping, event dates,
    lifecycle, event navigation, frontend layout, improvements, smoke,
    version, and app updates (86 passed).
  * `npm test` (318 passed, including Chromium and applicable mobile WebKit),
    `npm run test:worker` (65 passed), `npm run test:version-check` (10
    passed), and `npm run check:version` passed.
  * `git diff --check` passed.
* **Layout checks:** Fixed-team and rotating event lists were visually checked
  at 320 px and 1280 px. Group order, lifecycle pills, progress, long-name
  wrapping, completed-event access, row containment, and document overflow
  were checked.
* **Important implementation notes:**
  * `EVENT_LIST_GROUPS`, `eventListGroupKey`, `eventListItemModel`, and
    `eventListSections` derive the stable Today → Upcoming → In progress → Past
    presentation from `eventLocalDate`, `eventLifecycleState`, and
    `eventLifecycleFacts`. Complete events always appear in Past; active
    `live`, `poolsComplete`, and `playoffs` events appear In progress regardless
    of date; remaining events use their local date.
  * Events keep the previous unfinished-first, newest-created-first ordering
    within their derived groups. Missing dates retain the existing
    `eventLocalDate` created-date/today fallback.
  * Rows expose `[data-event-lifecycle]` and `[data-event-progress]`, retain the
    same `openEvent` action, and show completed out of scheduled matches when a
    schedule exists. Titles and pills stack below 600 px so long fixed and
    rotating names remain readable.
  * Grouping and status are render-time only. No event, backup, sync,
    registration, rating, schedule, seeding, or persistence shape changed.
* **Remaining before Done:**
  * Create and merge the pull request, then replace the pull-request,
    merge-commit, and completed-date `Pending` values.
  * Only after the merge gate is satisfied, mark EUX-10 `Done`, change its
    summary checkbox to `[x]`, add the dated Progress-log entry, and update
    Current work to show the core event UI roadmap complete.

---

# EUX-11 — Court-side score reporting

**Branch:** `feat/court-side-score-reporting`
**Risk:** High
**Status:** In Progress
**Depends on:** EUX-08, EUX-09

## Objective

Let players submit scores from the public schedule into an organizer review
queue, so results stop being the only manual step in the event pipeline, without
weakening rating integrity or the organizer's authority over what counts.

## In scope

* Three per-event modes: `off` (default), `open` (trust), `code` (court codes).
* A dedicated `SCORE_REPORTS` KV namespace with per-record keys and TTLs.
* Worker routes for organizer session management and anonymous public reporting.
* A Worker-hosted report page plus a served snapshot script that patches live
  per-match badges into a published schedule.
* Five-character per-court codes with a printable QR card per court.
* Deterministic per-(event, match, device) dedup, corroboration, and conflict.
* An organizer review queue with accept and reject.
* One shared game-record builder per event format, used by the manual sheets and
  the review queue.

## Out of scope

* Auto-committing a corroborated score.
* Auto-republishing a schedule snapshot on every accept.
* Any client-side offline submission queue for players.
* Scoring heuristics that try to detect a shaded score.
* Changes to registration, rules, player photos, or check-in behavior.

## Required tests

* `off` is the default and an existing event's published output is unchanged.
* All three modes end to end, including mode changes mid-event.
* Deterministic dedup: a re-submit updates rather than duplicates.
* Corroboration and conflict both demonstrated.
* Accepting produces a record identical to the manual sheet for both formats,
  single set, best of 3, ties, guest teams, and playoff matches.
* Court codes scope to their court and survive rotation.
* Rate limits, body caps, TTLs, origin rejection, and no `list()` on polled
  routes.
* Mobile (320 px, 375 px) and desktop (1280 px) review queue and court codes.
* Backup, restore, and the sync payload are unaffected by pending reports.

## Acceptance criteria

* No submission ever writes a game record directly.
* The nine frozen rating/schedule/bracket functions remain byte-identical.
* An event with no score-reporting config behaves exactly as before.
* Standings, bracket advancement, and schedule state stay derived at render.

## Completion record

* **Completed date:** Pending
* **Pull request:** https://github.com/cheebychob/court-vball/pull/51
* **Merge commit:** Pending
* **Version/build:** 0.37.0 / 20260727.10 (from 0.36.0 / 20260727.9)
* **Tests run:**
  * `npx playwright test tests/score-reporting.spec.js --project=chromium`
    (10 passed).
  * `npm test` (335 passed, chromium + mobile WebKit),
    `npm run test:worker` (82 passed, 17 new),
    `npm run test:version-check` (10 passed), `npm run check:version`.
  * In-app `runSelfTest()` — 303 passed, including 20 new score-reporting
    checks.
* **Layout checks:** Review queue and court codes were checked at 320 px,
  375 px, and 1280 px for both event formats. Conflicting reports group first,
  long team names wrap, touch targets are at least 44 px, and neither the
  document nor the sheet scrolls horizontally.
* **Important implementation notes:**
  * See `docs/SCORE_REPORTING.md` for the full architecture.
  * `scoreReportingMode(ev)` returns `off` for any missing or unrecognized
    config, so no stored event or backup needs migration.
  * `buildRotationGameRecords` and `buildFixedEventGameRecords` are the single
    definition of each format's record shape. `saveRotationScore` and
    `saveEventGame` now call them; their output was verified case by case
    against the previous implementation across single set, best of 3, sweeps,
    ties, even sets, guest teams, unlabeled games, and playoff edits.
  * `TIE_CONFIRM` is one frozen definition of the four tie prompts, shared by
    the manual sheets and the review queue.
  * A fixed-team pool match has no stored id, so its reporting key is
    `fixed:{teamA}:{teamB}` and the accepted record still carries `evA`/`evB`
    with no `evMatchId`, exactly like the manual sheet.
  * `PUBLIC_HEADERS` gained `connect-src 'self'`; without it `default-src
    'none'` blocked every fetch from a published page. The snapshot loads
    `/assets/public-report.js` rather than an inline script, because a stored
    snapshot can never carry a per-response nonce, and because
    `PUBLIC_EVENT_SCRIPT` is deliberately storage-free.
  * Turning reporting on requires one manual republish so the buttons appear.
    Mode changes, code rotations, and accepts afterwards need none.
* **Remaining before Done:**
  * Deploy the Worker. The `SCORE_REPORTS` KV namespace was created and bound
    in `cloudflare/wrangler.jsonc` on 2026-07-27.
  * Physical iPhone Safari and Android/Chrome checks of the player report form
    and the printed court cards.
  * Create and merge the pull request, then fill the completed-date,
    pull-request, and merge-commit fields.

---

# EUX-12 — Registration entry card cleanup

**Branch:** `feat/registration-entry-card-cleanup`
**Risk:** Medium
**Status:** In Progress
**Depends on:** EUX-06

## Objective

Make organizer-facing registration entries easy to scan by leading individual
cards with the public participant identity, preserving team hierarchy, and
progressively disclosing advanced management controls.

## In scope

* Use the submitted public participant label as the individual card heading and
  show a genuinely different custom entry name only as secondary context.
* Keep the team name, captain/contact, and roster structure for team entries.
* Replace stacked metadata and boxed contact content with compact, wrapping
  summaries.
* Omit redundant individual active-roster and empty substitute sections.
* Keep profile and match-review actions visible while moving status, roster
  movement, unmatch, editing-lock, management-link, and revoke controls into an
  accessible per-entry disclosure.
* Preserve open disclosures, filter, focus, order, and sheet scroll position
  across polling refreshes by stable registration ID.
* Consolidate event-day check-in and secondary dashboard commands under the
  sticky footer's Actions disclosure.
* Preserve all registration, import, check-in, matching, contact, access,
  synchronization, and stored-data behavior.

## Required tests

* Individual matching, custom-name, unmatched, organizer-created, and event-only
  identity states use public labels and deliberate fallbacks.
* Team name, captain/contact, active roster, and substitutes remain visible.
* Empty substitutes are omitted and non-empty substitutes remain complete.
* Contact links, preference, and editing remain functional.
* Management starts collapsed, exposes every existing control, has correct
  disclosure semantics, and survives a refresh without scroll or focus loss.
* Destructive actions retain confirmation.
* Footer actions remain reachable.
* Entry cards have no horizontal overflow and management controls stack at
  narrow widths.
* Existing registration, polling, import, and event-day check-in tests pass.

## Completion record

* **Completed date:** Pending
* **Pull request:** Pending
* **Merge commit:** Pending
* **Version/build:** 0.38.0 / 20260728.2 (from 0.37.1 / 20260728.1)
* **Tests run:**
  * `npx playwright test tests/event-registration.spec.js` — 13 passed.
  * The new organizer-card scenario in a temporary iPhone WebKit project —
    1 passed.
  * `npm run test:version-check` — 10 passed.
  * `npm run check:version` — passed.
  * `npm test` — 346 passed, including registration polling, import,
    event-day check-in, public registration, and mobile-WebKit coverage.
  * `npm run test:worker` — 81 passed and 1 pre-existing assertion failed in
    `tests/court-sync-worker.test.mjs:1399`; its forbidden score-value regex
    also matches the current fixed timestamp digits in `updatedAt`. EUX-12
    does not change Worker code or that test.
  * `git diff --check` — passed.
* **Important implementation notes:**
  * `registrationEntryDisplayModel`, `registrationEntryMetadata`,
    `registrationMemberSourceState`, and the focused contact, roster, and
    management render helpers keep the card template presentation-only.
  * Individual headings and source states use registration-member public display
    labels; linked private player names are never rendered into the card.
  * `dashboardInteraction` restores both native details and button-driven
    management disclosures using the stable entry ID plus disclosure key.
  * No public form, registration schema, Worker route, rating, scheduling,
    result, backup, or synchronization behavior changed.
* **Manual checks:** Captured organizer-card layouts were reviewed at 1440,
  1024, 768, 430, and 390 px for individual and team hierarchy, collapsed and
  expanded management, wrapping, footer clearance, and scroll stability. The
  cards and contact rows stayed within the sheet, narrow management actions
  stacked, and the final card remained clear of the sticky footer.
* **Remaining follow-up:** Physical iPhone Safari verification remains useful
  release confidence work after automated iPhone-WebKit coverage. The
  timestamp-sensitive Worker assertion above should be made field-aware in a
  separate score-reporting change.

---

# EUX-13 — Entries/standings separation and interaction stability

**Branch:** `feat/event-entries-standings-ux`
**Risk:** Medium
**Status:** In Progress
**Depends on:** EUX-05, EUX-06, EUX-12

## Objective

Give event participant management and competition rankings distinct views,
make standings compact and scan-friendly across viewport sizes, eliminate
ordinary selection/refresh scroll jumps, and surface the most common organizer
registration decisions directly on review cards.

## In scope

* Keep Entries/Teams as management views with rosters, registration linkage,
  seeding context, and add/edit actions.
* Render Standings as an independent ranked view with public participant/team
  identity, current ranking statistics, compact imported source, and a useful
  pre-play state.
* Preserve the existing `entryStandings` and `eventStandings` calculation
  paths, stored event data, schedules, games, ratings, and row-to-schedule
  behavior.
* Preserve the selected mobile event destination through ordinary renders.
* Use targeted registration-import selection updates and shared interaction
  capture/restore helpers for page position, sheet position, stable focus, and
  disclosures when replacement is necessary.
* Add status-aware Accept/Decline/More options controls using the existing
  organizer status endpoint, capacity override flow, status transitions, and
  registration records.

## Required tests

* Entries/Teams and Standings have distinct mobile views and management actions
  never leak into standings.
* Individual public labels, redundant/custom entry labels, imported source,
  no-game state, ties, fixed pairs, fixed teams, canonical ordering/statistics,
  and schedule-row activation are covered.
* Compact mobile and aligned desktop structures remain free of horizontal
  overflow at 1440, 1024, 768, 430, and 390 px.
* Registration-import selections preserve stable-ID state, sheet/page
  positions, focus, and button semantics through targeted changes and refresh.
* Quick registration actions cover submitted, needs-review, waitlisted,
  accepted, declined, duplicate-request, capacity-override, success, failure,
  retained record, modal-open, scroll, disclosure, and responsive states.
* Existing registration Worker, synchronization, version, event navigation,
  standings, and full application suites continue to pass.

## Completion record

* **Completed date:** Pending
* **Pull request:** Pending
* **Merge commit:** Pending
* **Version/build:** 0.39.0 / 20260728.3 (from 0.38.0 / 20260728.2)
* **Tests run:**
  * `npx playwright test tests/event-entries-standings-ux.spec.js` — 4
    passed.
  * Focused mobile-section, responsive standings, registration dashboard,
    registration import, rotation seeding, and mobile-WebKit suites — passed.
  * Contact-editor polling and Track scroll-stability regressions repeated five
    times each after the final race fix — 10 passed.
  * `npm run test:version-check` — 10 passed.
  * `npm run check:version` — passed.
  * `npm test` — 351 passed, including registration polling, import,
    synchronization, public registration, event formats, standings, and
    mobile-WebKit coverage.
  * `npm run test:worker` — 81 passed and 1 pre-existing assertion failed in
    `tests/court-sync-worker.test.mjs:1399`; its forbidden score-value regex
    also matches the current fixed timestamp digits in `updatedAt`. EUX-13
    does not change Worker code or that test.
  * `git diff --check` — passed.
* **Important implementation notes:**
  * `renderRotatingEventDetail` and `renderEventDetail` now assign independent
    management and ranking sections while preserving `entryStandings`,
    `eventStandings`, stored entries, games, schedules, ratings, and row
    activation.
  * `captureInteractionViewportState`,
    `restoreInteractionViewportState`, and `updateWithoutScrollJump` preserve
    page/sheet positions and stable focus without overriding a later deliberate
    user scroll.
  * Registration import selection updates only keyed checkbox/count/action
    nodes. Organizer quick actions reuse the existing status endpoint,
    capacity-override confirmation, cached entry application, and refresh
    sequence.
  * Polling leaves an open contact draft in place, and status actions preserve
    stable-ID disclosures, filter, focus, sheet position, registration records,
    roster membership, substitutes, and linkage.
* **Manual checks:** The in-app browser was reviewed at 1440, 1024, 768, 430,
  and 390 px. Rotating-entry and fixed-team management/standings views were
  checked with not-started and played rows, long team names, row-to-schedule
  activation, mobile one-section navigation, desktop aligned columns, compact
  mobile statistics, management-only Add entry, and document overflow. No
  horizontal page overflow or clipped standing names appeared. Individual,
  fixed-pair, tie, imported-source, quick-action, import-selection, polling,
  player-picker, and Track stability states are additionally covered by the
  automated browser suites.
* **Remaining follow-up:** Physical iPhone Safari verification remains useful
  release confidence work after automated iPhone-WebKit coverage. A future
  manual fixture can make the individual/fixed-pair/tie/import combinations
  easier to exercise without replacing local organizer data. The
  timestamp-sensitive Worker assertion above should be made field-aware in a
  separate score-reporting change.

---

# Deferred follow-up backlog

These ideas were identified during the inspection but are not required to
complete the core event UI overhaul.

| ID        | Possible branch                   | Description                                                        | Reason deferred                                                        |
| --------- | --------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| FUTURE-01 | `feat/sheet-one-level-back`       | Add a shallow back path such as Manage pools → Seed pools → Back   | Requires careful dirty-draft and modal-state handling                  |
| FUTURE-02 | `feat/public-event-social-card`   | Add hosted Open Graph and social-preview imagery                   | Requires a real public image URL and likely Worker/storage involvement |
| FUTURE-03 | `feat/public-player-name-privacy` | Organizer toggle for team-name-only public output                  | Requires a product/privacy decision                                    |
| FUTURE-04 | `fix/attendance-single-scroll`    | Remove similar nested scrolling from attendance and check-in flows | Adjacent but outside this event UI project                             |
| FUTURE-05 | `feat/event-weather`              | Add weather or event-day conditions                                | External API, privacy, cost, and reliability decisions required        |
| FUTURE-06 | `fix/rules-editor-mobile-toolbar` | Replace the rules toolbar's nested horizontal scrolling            | Better handled as a focused rules-editor task                          |

# Completion gate for every roadmap item

An item may be marked Done only after all applicable boxes are satisfied:

* [ ] Approved scope implemented.
* [ ] No unrelated refactoring included.
* [ ] Focused regression tests added or updated.
* [ ] Existing applicable tests pass.
* [ ] Mobile layout checked.
* [ ] Desktop layout checked.
* [ ] Fixed-team event checked.
* [ ] Rotating event checked.
* [ ] Shared/public output checked when affected.
* [ ] Backup, sync, or stored-data compatibility checked when affected.
* [ ] Version/build number updated.
* [ ] Final diff reviewed.
* [ ] Completion record filled out.
* [ ] Pull request merged into `main`.
* [ ] Roadmap summary checkbox changed to `[x]`.
* [ ] Next eligible item changed from Planned to Ready.
* [ ] Current work section updated.

# Progress log

Add one entry after each completed roadmap item.

### 2026-07-25 — EUX-01 completed

* **Branch:** `feat/event-lifecycle-ui`
* **Pull request:** https://github.com/cheebychob/court-vball/pull/40
* **Version/build:** 0.26.0 / 20260725.7
* **Summary:** Added the derived `eventLifecycleState(ev)` helper and made the
  fixed and rotating event pages state-appropriate: overview and next action
  lead the page, the finale card is hidden before any game is played, an active
  event gets a compact progress card, the trophy treatment is reserved for a
  champion or a completed event, disabled registration collapses, completed
  events hide registration setup, setup actions are demoted after play starts,
  and the duplicate "Log a game" control was removed.
* **Tests:** New `tests/event-lifecycle.spec.js` (8 tests: state derivation for
  every state across both formats, draft/live/complete presentation, compact and
  final registration, rotating coverage, 320 px and 1280 px layout). Full suite:
  `npm test` 275 passed, `npm run test:worker` 65 passed,
  `npm run test:version-check` 10 passed, `npm run check:version` passed.
* **Manual checks:** Mobile (375 px) and desktop (1280 px) event pages in
  draft, live, and completed states, plus a scheduled rotating event; no console
  errors and no horizontal overflow.
* **Known follow-up:** See the EUX-01 completion record.
* **Next item:** EUX-02

### 2026-07-25 — EUX-02 completed

* **Branch:** `fix/event-navigation-and-touch`
* **Pull request:** https://github.com/cheebychob/court-vball/pull/41
* **Version/build:** 0.27.0 / 20260725.8
* **Summary:** Added `eventSectionModel`/`eventSubnavHtml` as the one shared
  event section definition (order, labels, visibility, default destination) used
  by both event formats; replaced the zero-height Teams and Entries anchors with
  the real participants card and moved `#event-standings` onto the standings
  table inside it so navigation order matches document order; added a visible
  active state with `aria-current="location"` that follows manual scrolling,
  pins a tapped destination, and returns to it when re-selected; added a
  horizontal-overflow cue to the strip; raised event navigation, event `.btn.sm`
  controls, and per-match logging targets to at least 44 px within event
  contexts only; let long team and entry names wrap instead of ellipsizing the
  opponent away; and added dock/safe-area bottom padding while cutting the
  trailing event-page spacer.
* **Tests:** New `tests/event-navigation.spec.js` (10 tests: destination
  content and order for fixed and rotating events, completed-event destination
  set, active state and sticky clearance after selection, scroll-driven active
  state and repeated selection, default-section fallback, overflow cue, touch
  targets, long-name wrapping at 320 px and 375 px with no document overflow,
  dock clearance and trailing space, desktop behavior). Full suite: `npm test`
  285 passed, `npm run test:worker` 65 passed, `npm run test:version-check`
  10 passed, `npm run check:version` passed. `tests/version.spec.js` and
  `tests/app-updates.spec.js` updated for the new version and build.
* **Manual checks:** Fixed and rotating event pages at 375 px and 1280 px —
  active navigation state, overflow fade, sticky clearance, wrapped long names,
  dock clearance at the bottom of the page, no console errors, no horizontal
  overflow.
* **Known follow-up:** See the EUX-02 completion record.
* **Next item:** EUX-03

### 2026-07-27 — EUX-03 completed

* **Branch:** `fix/event-sheet-share-layout`
* **Pull request:** https://github.com/cheebychob/court-vball/pull/42
* **Version/build:** 0.28.0 / 20260727.1
* **Summary:** Added reusable, opt-in sheet chrome — `sheetHeadHtml` (a
  non-floating header that hosts openSheet's own close button),
  `sheetFootHtml` (a sticky action footer that bleeds to the sheet edges and
  carries the safe-area inset), and `sheetPreviewHtml` (a neutral, collapsible
  preview frame) — and migrated the full schedule share, participant schedule
  share, full event results, and event recap share sheets to it. The close
  control now sits in normal flow instead of floating over the content, the
  public-link panel moved above the schedule preview, and the Download /
  Save-and-share actions moved into the sticky footer, so sharing no longer
  requires scrolling through the whole preview. Every other sheet keeps the
  original floating close button.
* **Tests:** New `tests/event-sheet-share-layout.spec.js` (4 tests: full
  schedule share at 320/390/1280 px with hit-tested close and download controls
  before and after scrolling, rotating participant share with a collapsible
  framed preview and the public-link panel above it, fixed completed-event
  results and recap sharing on mobile and desktop, and focus trapping, Escape,
  header dirty-close guard, focus return, plus a guard that unmigrated sheets
  still use the floating chrome). Full suite: `npm test` 289 passed,
  `npm run test:worker` 65 passed, `npm run test:version-check` 10 passed,
  `npm run check:version` passed. `tests/version.spec.js` and
  `tests/app-updates.spec.js` updated for the new version and build.
* **Manual checks:** Fixed-team schedule share and completed-event results
  sheets at 375 px and 1280 px — header close clear of the content at the top
  and after scrolling to the bottom, sticky footer pinned with the primary
  action full width, preview collapse and expand, no console errors, no
  horizontal overflow.
* **Known follow-up:** See the EUX-03 completion record.
* **Next item:** EUX-04

### 2026-07-27 — EUX-04 completed

* **Branch:** `feat/event-mobile-section-views`
* **Pull request:** https://github.com/cheebychob/court-vball/pull/43
* **Version/build:** 0.29.0 / 20260727.2
* **Summary:** Below 760 px the event page now shows one destination at a time
  instead of a single very long scroll. The breakpoint is declared once in CSS
  (`--event-view-mode`) and read by `eventViewMode()`; `applyEventSectionViews`
  hides every top-level block that does not belong to the active view, deriving
  membership from the destination each block follows plus explicit
  `data-event-view` overrides for the setup actions, the event-management
  buttons, and the progress/finale cards. A compact `[data-event-status]` strip
  above the sections keeps the lifecycle state and the primary action in reach
  from every view and stands down on Overview, so only one logging control is
  ever on screen. Selection is explicit in section views, so it survives
  rerenders and returns after a sheet closes; a draft event opens on Overview,
  an event under way on Schedule, and a completed event on Results, reusing
  EUX-02's `defaultId`. At 760 px and up the scroll-aware long page is
  unchanged.
* **Tests:** New `tests/event-mobile-section-views.spec.js` (6 tests: one
  destination at a time with every destination reachable for fixed and rotating
  events, lifecycle-appropriate defaults for draft/live/complete, selection
  surviving a rerender and a sheet round trip, the status strip and single
  visible primary action at 320 px, the desktop long page with scroll-aware
  navigation, and a mobile/desktop/mobile resize round trip). Full suite:
  `npm test` 295 passed, `npm run test:worker` 65 passed,
  `npm run test:version-check` 10 passed, `npm run check:version` passed.
  Twelve existing specs now select the section they exercise; EUX-02's
  long-page assertions moved to a desktop viewport. `tests/version.spec.js` and
  `tests/app-updates.spec.js` updated for the new version, build, and release
  notes.
* **Manual checks:** Fixed-team and rotating event pages at 390 px — every
  destination shows only its own section with no document overflow, the status
  strip sits under the sticky navigation after each switch, Overview carries the
  setup actions and event-management buttons, and Teams/Standings leads with the
  results card. Desktop at 1280 px keeps every section rendered with
  scroll-driven active navigation. No console errors.
* **Known follow-up:** See the EUX-04 completion record. Physical iPhone Safari,
  tablet portrait/landscape, and mobile-keyboard checks are still outstanding.
* **Next item:** EUX-05

### 2026-07-27 — EUX-05 completed

* **Branch:** `fix/event-responsive-standings-brackets`
* **Pull request:** https://github.com/cheebychob/court-vball/pull/44
* **Version/build:** 0.30.0 / 20260727.3
* **Summary:** Removed the two hidden horizontal scrollers from mobile event
  pages. Below 760 px the rotating standings table becomes stacked rows —
  rank and entry on the first line, then the five stat values in a labelled
  3 + 2 grid built from the new single `ENTRY_STANDING_STATS` definition — and
  a bracket shows one round at a time behind a `.seg` round switcher listing
  each round plus Champion. The card opens on the first round with an
  unresolved match, or the champion column once everything is decided; the
  choice is patched in place, kept in memory per bracket id, and survives the
  rerender after logging a result. At 760 px and up the wide table and the
  multi-column bracket scroller are unchanged. The bracket setup sheet now
  warns when pool play is unfinished without disabling anything.
* **Tests:** New `tests/event-responsive-standings-brackets.spec.js` (7 tests:
  no standings scroller and no clipped values at 320 px and 375 px, row
  activation still opening the participant schedule, every bracket round
  reachable one at a time with no overflow, match opening by touch and by
  keyboard with focus return plus round selection surviving a rerender, the
  desktop table and side-by-side rounds, and the non-blocking pool-play warning
  appearing and standing down). Full suite: `npm test` 302 passed,
  `npm run test:worker` 65 passed, `npm run test:version-check` 10 passed,
  `npm run check:version` passed. `tests/event-results-playoffs.spec.js`,
  `tests/event-navigation.spec.js`, `tests/version.spec.js`, and
  `tests/app-updates.spec.js` updated.
* **Manual checks:** Rotating and fixed-team event pages at 375 px — standings
  values readable in aligned columns with no horizontal scroll, round switcher
  labels unclipped, tapping Champion revealing only that column, selection
  surviving `render()`, no document overflow. Desktop at 1280 px — round
  switcher hidden, four 190 px bracket columns side by side, standings back to
  the grid table with labels hidden.
* **Known follow-up:** See the EUX-05 completion record. Physical iPhone Safari,
  tablet widths around the breakpoint, and a >16-team bracket are outstanding.
* **Next item:** EUX-06

### 2026-07-27 — EUX-07 completed

* **Branch:** `feat/event-venue`
* **Pull request:** https://github.com/cheebychob/court-vball/pull/46
* **Version/build:** 0.32.0 / 20260727.5
* **Summary:** Added an optional event venue to creation and Event details,
  preserved legacy `location` reads, and surfaced the escaped venue in fixed
  and rotating organizer summaries, event lists, public headers, schedule
  previews and exports, print output, results documents, and recap images.
  Empty venue values remain omitted and existing events require no migration.
* **Tests:** New `tests/event-venue.spec.js` (4 tests covering creation,
  editing, legacy and empty events, backup/restore, sync merge, duplication,
  safe output, fixed and rotating formats, and mobile/desktop layout).
  `npm test` 307 passed, `npm run test:worker` 65 passed,
  `npm run test:version-check` 10 passed, `npm run check:version` and
  `git diff --check` passed.
* **Manual checks:** Physical iPhone Safari and Android/Chrome checks completed
  as confirmed after merge.
* **Known follow-up:** None.
* **Next item:** EUX-08

### 2026-07-27 — EUX-09 completed

* **Branch:** `feat/public-bracket-layout`
* **Pull request:** Pending
* **Version/build:** 0.34.0 / 20260727.7
* **Summary:** Replaced the public bracket's seed-name paragraph with a
  player-facing presentation derived from the existing bracket state. Public
  pages now show every round and matchup, seeds, teams, accurate final scores,
  winners, byes, ready and pending states, progress, and the championship
  outcome. Phones use a full-width vertical round flow; desktop and print use
  contained multi-column rounds. No organizer controls or data behavior
  changed.
* **Tests:** New `tests/public-bracket-layout.spec.js` (4 tests covering every
  round and match, fixed-team winners/scores/champion, rotating byes and
  pending matches, long names and overflow at 320 px and 1280 px, and print
  media). Focused regression run: 57 passed. Full suite: `npm test` 315 passed,
  `npm run test:worker` 65 passed, `npm run test:version-check` 10 passed,
  `npm run check:version` and `git diff --check` passed.
* **Manual checks:** Fixed and rotating public bracket sections at 320 px and
  1280 px, including a 16-team field and a rotating bye; no clipped matches,
  names, or document overflow. Print media at 816 px retained all four rounds
  and 15 match cards.
* **Known follow-up:** Physical-device and paper/PDF-printer checks remain
  useful release confidence checks but are not required by the EUX-09 roadmap
  item.
* **Next item:** EUX-10

## Entry template

### YYYY-MM-DD — EUX-XX completed

* **Branch:**
* **Pull request:**
* **Version/build:**
* **Summary:**
* **Tests:**
* **Manual checks:**
* **Known follow-up:**
* **Next item:**
