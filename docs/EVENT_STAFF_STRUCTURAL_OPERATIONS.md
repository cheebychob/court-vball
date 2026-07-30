# Event Staff Structural Operations

This document is the contract for event-structure changes made through the
event-scoped Tournament Operator Desk. It supplements
`EVENT_STAFF_ACCESS.md`; it does not grant access to the organizer application,
the complete Court sync document, or any other event.

## Security and concurrency contract

Every structural request:

- uses the authenticated staff session and its immutable, validated permission
  snapshot;
- names the session's event ID, the operation name, the target ID (when there
  is one), the expected event revision, and a unique idempotency key;
- is rejected if the permission-schema version is unsupported, the stored
  permission JSON is malformed, or it contains a permission outside the frozen
  preset for that role and schema version;
- is rejected if the requested event differs from the grant's event;
- is server-validated and committed atomically with the resulting event
  revision, idempotency result, and before/after audit record; and
- is online-only. The Desk may retain an unsaved form draft, but it never puts
  a structural operation in the offline score queue.

Event revisions are compare-and-swap values. A stale request returns the
current event-scoped state and does not mutate data. Reusing an idempotency key
with the same request returns the original result; reusing it with different
content is rejected.

## Permission schemas

Version 1 grants retain their exact historical permissions. They may continue
to score, check in, move matches, and use the other capabilities originally
issued to them. They do not gain structure-management permissions.

Version 2 adds these Tournament Operator-only permissions:

- `manageEventEntries`
- `configureEventSchedule`
- `generateEventSchedule`
- `manageEventBrackets`

New grants use version 2. Rotating a version 1 Tournament Operator grant
revokes the old link and creates a version 2 replacement only after the owner
explicitly confirms the expanded capability set. View Only and Scorekeeper
presets are unchanged.

## Operation contract

| Operation | Permission | Mutates | Historical-result policy |
| --- | --- | --- | --- |
| `addEventEntry` | `manageEventEntries` | The event's fixed-team or rotating-entry collection | New ID; IDs are never reused |
| `updateEventEntry` | `manageEventEntries` | Name, pool, seed, status, and future participant/substitute assignment | Completed game snapshots remain unchanged; affected games require impact confirmation |
| `moveEventParticipant` | `manageEventEntries` | Atomically transfers one participant between fixed entries or swaps two participants between rotating entries | Both registration sources and completed game snapshots remain unchanged; affected games require impact confirmation |
| `reorderEventEntries` | `manageEventEntries` | Pre-generation seed/order values | Rejected after schedule/bracket generation or play |
| `removeEventEntry` | `manageEventEntries` | Deletes an unplayed, unreferenced entry; otherwise preserves it as withdrawn | Completed games and rating history remain attached to the retained entry |
| `setEventScheduleSettings` | `configureEventSchedule` | Rounds, courts, start time, duration, court style, fairness, makeup, and rotation settings | Existing matches remain until an explicit generate/regenerate/clear operation |
| `generateEventSchedule` | `generateEventSchedule` | Canonical event settings and scheduled matches | Rejected when a schedule or results already exist |
| `regenerateRemainingSchedule` | `generateEventSchedule` | Unplayed future matches and schedule revision | Played matches are immutable; removed match/game IDs are not reused |
| `clearEventSchedule` | `generateEventSchedule` | Entirely unplayed scheduled matches | Rejected when any event result exists |
| `createEventBracket` | `manageEventBrackets` | One division's bracket definition and canonical bracket matches | Seeds must be unique eligible entries; no result is changed |
| `updateEventBracket` | `manageEventBrackets` | Division name and, before play, its seeds/order | Affected played games require exact-game impact confirmation and deterministic replay |
| `resetEventBracket` | `manageEventBrackets` | One division's bracket games/results while retaining its definition | Exact affected games are tombstoned only after impact confirmation |
| `removeEventBracket` | `manageEventBrackets` | One division's definition and matches | Exact affected games are tombstoned only after impact confirmation |

The existing score, correction, check-in, attendance, and match-move
operations keep their existing permission and queue behavior.

## Entry and registration rules

Fixed-team and rotating-entry IDs are scoped to their event. Participant
assignment accepts only IDs from the event's restricted directory projection;
that directory exposes only `id` and `displayName`. Duplicate participants
within an entry, incompatible entry sizes, duplicate registration references,
and registration references belonging to another event are rejected.

Staff entry edits never mutate the global player directory, ratings, contact
records, registration records, or registration state. Original registration
IDs and source metadata remain on an entry through rename, roster, seed, and
status edits. A fixed-team entry with no tracked participants retains Court's
existing guest-side rating behavior.

## Impact review and audit

Before an operation that can affect played structure, the Worker returns an
impact review without mutating. The review identifies:

- completed and scored game IDs;
- unplayed match IDs;
- standings and bracket consequences;
- removed or withdrawn participants/entries;
- whether a static public schedule may now be stale;
- which game snapshots, entry records, and tombstones will be preserved; and
- whether deterministic rating replay is required.

Confirmation is bound to the still-current expected revision. When confirmed,
the audit row stores the acting grant and session, operation, target, timestamp,
reason, prior value, next value, and resulting revision. Existing game
tombstones are retained, newly deleted game IDs receive tombstones, and IDs are
never reused. Owner sync overlays the exact event-scoped structure, merges
tombstones, then runs the organizer's normal deterministic rating replay.

## Static public schedules

The Tournament Operator Desk cannot create, rotate, or publish public links.
Public schedule HTML is a static snapshot. Structural schedule or bracket
changes therefore display a warning that the organizer must explicitly
republish; staff changes never rewrite a published artifact silently.
