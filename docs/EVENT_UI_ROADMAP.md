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

**Current item:** EUX-02
**Expected branch:** `fix/event-navigation-and-touch`
**Next item after completion:** EUX-03

EUX-01 is implemented on `feat/event-lifecycle-ui` and is awaiting merge of
https://github.com/cheebychob/court-vball/pull/40. Its merge-commit field stays
`Pending` until that value exists.

The agent performing work must update this section when the implementation PR
is completed. Only one item should normally be In Progress.

## Roadmap summary

| Done | ID     | Work item                                           | Branch                                     | Depends on     | Status  |
| ---- | ------ | --------------------------------------------------- | ------------------------------------------ | -------------- | ------- |
| [x]  | EUX-01 | Event lifecycle and state-appropriate UI            | `feat/event-lifecycle-ui`                  | None           | Done    |
| [ ]  | EUX-02 | Event navigation, anchors, touch targets, and names | `fix/event-navigation-and-touch`           | EUX-01         | Ready   |
| [ ]  | EUX-03 | Event sheet headers and share-action layout         | `fix/event-sheet-share-layout`             | None           | Planned |
| [ ]  | EUX-04 | Mobile event section views                          | `feat/event-mobile-section-views`          | EUX-01, EUX-02 | Planned |
| [ ]  | EUX-05 | Responsive rotating standings and brackets          | `fix/event-responsive-standings-brackets`  | EUX-02         | Planned |
| [ ]  | EUX-06 | Registration dashboard single-scroll layout         | `fix/registration-dashboard-single-scroll` | EUX-03         | Planned |
| [ ]  | EUX-07 | Event venue field                                   | `feat/event-venue`                         | None           | Planned |
| [ ]  | EUX-08 | Public event-page shell polish                      | `fix/public-event-shell`                   | EUX-02, EUX-07 | Planned |
| [ ]  | EUX-09 | Public bracket presentation                         | `feat/public-bracket-layout`               | EUX-05, EUX-08 | Planned |
| [ ]  | EUX-10 | Events-list grouping and lifecycle status           | `feat/events-list-lifecycle-groups`        | EUX-01         | Planned |

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
* **Merge commit:** Pending
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
**Status:** Ready
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**
* **Remaining follow-up:**

---

# EUX-03 — Event sheet headers and share-action layout

**Branch:** `fix/event-sheet-share-layout`
**Risk:** Low–Medium
**Status:** Planned

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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**
* **Remaining sheets requiring migration:**

---

# EUX-04 — Mobile event section views

**Branch:** `feat/event-mobile-section-views`
**Risk:** Medium–High
**Status:** Planned
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Physical-device checks:**
* **Important implementation notes:**

---

# EUX-05 — Responsive rotating standings and brackets

**Branch:** `fix/event-responsive-standings-brackets`
**Risk:** Medium
**Status:** Planned
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**

---

# EUX-06 — Registration dashboard single-scroll layout

**Branch:** `fix/registration-dashboard-single-scroll`
**Risk:** Medium
**Status:** Planned
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**

---

# EUX-07 — Event venue field

**Branch:** `feat/event-venue`
**Risk:** Low
**Status:** Planned

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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**

---

# EUX-08 — Public event-page shell polish

**Branch:** `fix/public-event-shell`
**Risk:** Low–Medium
**Status:** Planned
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**

---

# EUX-09 — Public bracket presentation

**Branch:** `feat/public-bracket-layout`
**Risk:** Medium
**Status:** Planned
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**

---

# EUX-10 — Events-list grouping and lifecycle status

**Branch:** `feat/events-list-lifecycle-groups`
**Risk:** Low–Medium
**Status:** Planned
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

* **Completed date:**
* **Pull request:**
* **Merge commit:**
* **Version/build:**
* **Tests run:**
* **Important implementation notes:**

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
