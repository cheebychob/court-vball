# Court-side score reporting

## What this changes

Results were the last manual hole in Court's event pipeline. Registration,
check-in, scheduling, rules, standings, brackets, and recaps are automated or
public; scores still required one organizer to walk to every court and type two
numbers.

Players can now submit scores from the published schedule into an organizer
review queue. **No submission ever writes a game record.** Every accepted score
passes through organizer review, and the organizer device remains the only
writer of `vb:games`.

## The three modes

| Mode | Value | Behavior |
| --- | --- | --- |
| Off | `off` | No submissions accepted. The public page looks exactly as it does today. **Default for every existing and new event.** |
| Trust | `open` | Anyone with the schedule link picks their match from a list and submits. No code. For casual and rec nights. |
| Code | `code` | The submitter enters that court's five-character code before the form appears. The code scopes them to that court's matches. For larger or competitive tournaments. |

The organizer can change modes mid-event. Changing modes never invalidates
already-submitted reports or already-accepted games. Turning reporting off
rejects new submissions with `REPORTING_OFF` while leaving the review queue
readable.

Trust mode lowers the barrier to *submitting*, not to *committing*.

## Selected storage architecture

Add a dedicated KV namespace binding named `SCORE_REPORTS`.

Court does not store reports as one mutable KV JSON array. Each report, per-match
aggregate, court code, device index, and rate bucket is a separate key, so
concurrent submissions for different matches never overwrite a shared
read-modify-write list. This follows `docs/PLAYER_CHECK_IN.md` exactly.

Key families:

```text
score:session:{privateSessionId}
score:public:{publicToken}
score:event:{sha256(roomHash + ':' + eventId)}
score:report:{sessionId}:{matchHash}:{deviceHash}
score:match:{sessionId}:{matchHash}
score:state:{sessionId}
score:code:{sessionId}:{code}
score:device:{sessionId}:{deviceHash}
score:rate:{sessionId}:{kind}:{window}:{hashedScope}
```

`matchHash` is `sha256(matchId)` because playoff ids contain `:`. `deviceHash` is
`sha256(sessionId + ':' + rawDeviceToken)`; the raw token is never stored.

### Deterministic dedup

`score:report:{sessionId}:{matchHash}:{deviceHash}` is derived from
`(event, match, device)`, so a re-submit **updates** the existing report instead
of creating a second one — the same idempotency property a check-in has for a
known player. The report id is `{matchHash}.{deviceHash}`, so the organizer
disposition route rebuilds the key directly with no pointer key.

### The derived cache and its one race

`score:match:*` and `score:state:*` are read-modify-write, retried three times
the same way `addCheckInRecordToDirectory` retries the check-in directory. Two
devices submitting for the **same match** within a few hundred milliseconds can
still drop one aggregate update.

The authoritative `score:report:*` records are independent and are never lost.
The aggregate and the state document are rebuildable caches: the organizer's
review poll recomputes them, and `POST /api/score-reports/sessions/:id/reindex`
rebuilds the state document from the per-match aggregates on demand ("Rescan for
missing reports" in the queue). A dropped update makes one badge briefly stale;
it never loses a submitted score.

`list()` is never called on any polled route. The live-state document doubles as
the index of matches with activity, so a review poll reads it plus only the
matches it names.

### TTLs and bounds

Session expiry defaults to 12 hours, minimum 1, maximum 24. **Every key expires
at `expiresAt + 24h`** of organizer review retention; rate buckets carry their
own short TTL. Closing a session immediately deletes the public-token,
event-lookup, and court-code keys.

Named limits: 400 matches per session, 12 reports per match, 32 courts, 3 sets
per report, scores 0–199, 2 KiB public write body, 128 KiB organizer body.
Nothing can grow unbounded.

Rate limits per `[device, hashed IP, session]`:

- submit — 20 / 60 / 400 per 5 minutes
- court-code attempt — 10 / 30 / 200 per 10 minutes
- state poll — 120 / 300 / 2000 per 5 minutes

Rate keys store only session-scoped hashes, never full IP addresses. As with
check-in, KV counters are bounded but not globally atomic.

## Routes and trust boundaries

Organizer routes require an approved Court browser origin, `X-Court-Room`, and a
matching `room:{roomCode}` record in `COURT`, then verify the session's
`roomHash`. A public token can never substitute for `X-Court-Room`.

```text
GET  /api/score-reports/status
GET  /api/score-reports/sessions?eventId=...
POST /api/score-reports/sessions
POST /api/score-reports/sessions/:sessionId/config
POST /api/score-reports/sessions/:sessionId/matches
GET  /api/score-reports/sessions/:sessionId/review
POST /api/score-reports/sessions/:sessionId/reindex
POST /api/score-reports/sessions/:sessionId/reports/:reportId
POST /api/score-reports/sessions/:sessionId/close
```

Session creation is idempotent per `(room, eventId)`: an existing open session is
resumed, so a second organizer device never forks the queue.

Anonymous same-origin routes never accept a room code:

```text
GET  /report/:publicToken
GET  /report/:publicToken/c/:courtCode
GET  /api/score-reports/public/:publicToken
POST /api/score-reports/public/:publicToken/code
POST /api/score-reports/public/:publicToken/reports
GET  /api/score-reports/public/:publicToken/state
GET  /assets/public-report.js
```

Public requests with a foreign `Origin` are rejected, cross-origin preflight is
not enabled, responses are `no-store`, and errors use stable codes without stack
traces.

**The Worker never sees Court's identity model.** A report carries a match id,
a mode, and a set list — never `evEntryIdsA`/`evEntryIdsB`, `evA`/`evB`, or
player ids. The game record is rebuilt entirely on the organizer device from the
match id, so a submitted payload cannot poison a game record.

## The snapshot problem

Published schedules at `/s/:token` are pre-rendered static HTML stored in
`PUBLIC_SCHEDULES`. They are not live views. That has two consequences.

**A nonce is impossible here.** `/s/:token` serves stored HTML under a static
response CSP; a nonce must be freshly generated per response *and* present in the
body, which is frozen at publish time. The snapshot therefore loads
`/assets/public-report.js`, which the existing `script-src 'self'` already
permits. Keeping it in a served asset also preserves the storage-free guarantee
that `PUBLIC_EVENT_SCRIPT` is tested for.

**`PUBLIC_HEADERS` gained `connect-src 'self'`.** The policy was `default-src
'none'` with no `connect-src`, which blocked every fetch from a published page.
This is a same-origin-only widening and it applies to all existing published
pages the moment the Worker deploys.

**Badges patch in live; the snapshot is not auto-republished.** The injected
script fetches `GET /api/score-reports/public/:publicToken/state` on load, on
`pageshow`, and when the tab becomes visible, then patches
`[data-report-match]` badges. Auto-republishing the whole snapshot on every
accept would be an expensive write per score; republishing stays a manual
organizer action.

Live-state response:

```json
{ "ok": true, "mode": "open", "status": "open", "updatedAt": 1721300000000,
  "matches": { "fixed:t1:t2": "pending", "playoff:br1:r1:m2": "accepted" } }
```

One KV read after the token lookup. Only non-`none` matches are listed. **No
names and no scores** — badges only.

Turning reporting on requires **one manual republish** so the buttons appear in
the snapshot. After that, mode changes, code rotations, and accepts need no
republish. Printed QR codes and shared links survive a republish because the
report token is independent of the publication token.

## Match identity

| Match kind | Reporting id | Saved game identity |
| --- | --- | --- |
| Fixed pool (round robin) | `fixed:{teamA}:{teamB}` (ids sorted; `:{n}` suffix on a repeated pairing) | `evA`/`evB`, **no `evMatchId`** |
| Fixed makeup / custom | the match's own stored id | `evMatchId` |
| Rotating pool / makeup | the match's own stored id | `evMatchId` |
| Playoff (either format) | `playoff:{brId}:r{n}:m{n}` | `evMatchId` |

A fixed-team round-robin match has no stored id — the manual sheet identifies it
by its unordered team pair, which is why `saveEventGame` writes `evA`/`evB` with
no `evMatchId`. The reporting key mirrors that exactly, so it stays stable across
a schedule regeneration and **never leaks into a game record**.

Reports are always oriented to the schedule's own side order, which is what the
player sees on the published page, so two devices on opposite teams cannot
produce a mirrored score.

## Court codes

- Five characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, which excludes
  ambiguous `0`, `1`, `I`, `L`, and `O` and always survives the public page's
  `[^A-Z2-9]` input filter.
- **Unique within the event only.** The code is entered inside an already
  event-scoped page, so global uniqueness would add a key family and a
  collision-retry loop for no security benefit.
- Entering a code scopes the submitter to that court's matches; a single
  candidate is pre-selected automatically.
- The player's device remembers validated codes in `localStorage` under
  `court-score-codes:{publicToken}` and offers them as one-tap chips.
- Rotating codes deletes the old `score:code:*` keys and issues new ones.
  **Already-submitted reports are untouched** — report keys derive from the match
  and the device, not the code.
- The organizer's Court codes card prints one page per court with the court name,
  the code at large size, and a QR deep-linking to
  `/report/:publicToken/c/:code`. It reuses `checkInQrSvg` and
  `writeSchedulePrintWindow`.

## Corroboration and conflict

Two devices submitting the **same** score for a match is signal, not noise.

- Identical scores from distinct devices → `corroborated`.
- Differing scores → both kept, marked `conflicted`, shown side by side.

The review queue sorts conflicted matches first and labels them "they disagree,
walk to this court." That is the single most useful output of the feature.

**Corroboration never auto-commits.** Mandatory review is the answer to a losing
team shading its own score; there are deliberately no scoring heuristics that
pretend otherwise.

## Accepting a report

Accepting builds the record through the **same shared builder the manual sheets
use** — `buildRotationGameRecords` for rotating matches and
`buildFixedEventGameRecords` for fixed and playoff matches. `saveRotationScore`
and `saveEventGame` were refactored to call those builders; their output is
unchanged, verified case by case against the previous implementation.

The accept path also reuses the manual sheets' confirmations. `TIE_CONFIRM` is
one frozen definition of the four tie prompts, shared by both paths so they
cannot drift.

- **Ties.** The submitter cannot answer a confirm dialog, so a submitted tie is
  accepted by the Worker, flagged `tie` in the queue, and the organizer answers
  the same confirm the manual sheet shows — one human confirm, identical copy.
- **Best of 3.** Accepting produces the same set-grouped records the manual path
  does: one shared `matchId` and per-set labels.
- **Replacing.** If a result already exists for the match, the organizer gets the
  manual sheet's "A saved result already exists" confirm, and the old games are
  tombstoned through `markGamesDeleted` before the new ones are pushed.
- **Guest teams and unrated entries** are reportable. Playerless sides save as
  untracked slots, so the existing partial-game model leaves rating math alone.
- **Deleting an accepted game** leaves the row as accepted and detects the
  missing game locally ("the saved game was since deleted. Accept again to
  re-record it."). Nothing is ever resurrected without the organizer acting.
- **A correction after acceptance** is kept and flagged `afterAccept` rather than
  silently dropped.

Accepting creates a game record and nothing else. Standings, bracket
advancement, and schedule state stay derived at render.

## Lifecycle

| Organizer action | Effect on pending reports |
| --- | --- |
| Change mode | Preserved. `off` only stops new submissions. |
| Rotate court codes | Preserved. Old codes stop resolving immediately. |
| Regenerate the schedule | Match ids change; the app re-syncs the directory automatically. Orphaned reports show as `stale` with Accept disabled and keep their submitted court/round/side snapshot so the row stays readable. |
| Delete the event | The session is closed best-effort; if the device is offline the session expires on its TTL. |
| Unpublish the schedule link | Independent by design — the report token is separate, so printed QR cards keep working. |
| End score reporting | Closes the session, deletes the lookup keys, and clears `ev.scoreReporting`. |

## App-side configuration

```js
ev.scoreReporting = {
  mode: 'off' | 'open' | 'code',
  sessionId, publicToken, reportUrl,
  courts: [{ index, label, code, rotatedAt }],
  matchesUpdatedAt, updatedAt
}
```

A missing or unrecognized config means `off`, so existing events and older
backups need no migration. This rides the existing generic event save, backup,
sync, and duplication paths, mirroring `ev.schedulePublications`.

**Pending reports never enter this object, a backup, or the synced payload.**
They live in the Worker until accepted.

## Offline behavior

The organizer half works offline: reports accumulate in KV and appear when the
device reconnects. Review polling is 15 seconds, pauses when the sheet is closed
or the tab is hidden, allows one request at a time, and self-cancels if its sheet
is gone.

A player with no signal **cannot** submit — there is no client-side queue without
a service worker, which would be a significant new surface. Every request on the
report page is bounded by a 15-second `AbortController` so a stalled connection
fails visibly, and a failed submission is kept in `localStorage` and restored on
the confirm screen with "This score did not send last time."

Accepting while the Worker is unreachable saves the game locally and reports that
the queue could not be updated. Accepting the same row again is safe: the
existing result is found and the organizer is asked to replace it, so no
duplicate game is created.

## Threat model

- **A code proves presence at a court, not identity.** Anyone walking past the
  post can read it. That is acceptable; the feature deliberately does not
  over-engineer toward auth.
- **Trust mode has no defense against a losing team shading their own score.**
  Mandatory organizer review is the answer.
- The match directory carries public display names — the same names already on
  the published schedule, so no new leakage. Anyone with the report token sees
  what a schedule-link holder sees.

## Local development and verification

```sh
npm ci
npm run dev
node --input-type=module --check < cloudflare/court-sync-worker.js
npm run test:worker
npm run test:version-check
npm run check:version
npx playwright test tests/score-reporting.spec.js --project=chromium
npm test
```

Browser tests stub the Worker at the network boundary. They do not access
production bindings.

## Binding and deployment order

1. Create a **new** KV namespace dedicated to score reporting.
2. Add it to the existing `court-sync` Worker with variable name `SCORE_REPORTS`.
3. Keep `COURT`, `PUBLIC_SCHEDULES`, `PLAYER_PHOTOS`, `CHECK_IN_SESSIONS`, and
   `EVENT_REGISTRATION_DB` unchanged.
4. Deploy the Worker first.
5. Verify `GET /api/score-reports/status` from an approved origin returns
   `{"available":true}`.
6. Re-test legacy sync, public schedules, photos, check-in, and registration.
7. Deploy `index.html` through the existing GitHub Pages `master` root flow.
8. In each event that wants reporting, choose a mode and **republish the schedule
   once** so the buttons appear.

Deploying the frontend before the binding is safe: the status route reports
unavailable and the organizer UI says so. Nothing about manual score entry
changes.

## Production checklist

Organizer:

1. Open an event, choose a mode, and republish the schedule link.
2. In code mode, print the court cards and confirm one QR opens the report form
   with that court preselected.
3. Watch a report arrive, accept it, and confirm the saved game matches what the
   manual sheet would have produced.
4. Send two conflicting scores from two devices and confirm the queue puts that
   match first.
5. Rotate codes and confirm the old card stops working while the earlier report
   survives.

Player:

1. Open the published schedule and tap "Report score" on a match.
2. Confirm the review screen names both sides, the round, and the court in full.
3. Submit, reload, and confirm the badge shows the reported state.
4. Submit again for the same match and confirm it updates rather than duplicates.
5. Confirm an accepted match reads "Already recorded."
