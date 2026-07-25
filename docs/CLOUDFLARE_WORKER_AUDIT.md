# Cloudflare Worker route and KV audit

Audit date: 2026-07-25  
Worker: `cloudflare/court-sync-worker.js`  
Compared history: `b117809` registration foundation, `13d1954` team portal, and `a06418c` check-in KV quota fix.

## Reconciliation result

The current source contains the registration foundation/team portal and the newer check-in deterministic-directory changes. No registration commit replaced the quota fix. There is one Worker source file, two Wrangler examples, three ordered D1 migrations, and no generated Worker copy or deployment script. Route regexes are unique. Specific public/private route families execute before the legacy root sync handler; unknown non-root paths return 404 and cannot fall through to sync.

The import feature adds three organizer-only D1 routes. It does not add a KV binding, KV scan, general sync poll, public mutation path, or Worker-side local-event mutation.

## Route inventory

| Family | Methods and paths | Storage/auth |
| --- | --- | --- |
| Public event asset | `GET /assets/public-event.js` | Static Worker source; no binding |
| Player photos | `GET /api/player-photos/status`; `PUT/GET/PATCH/DELETE /api/player-photos/:idOrToken` | `COURT` direct room lookup + `PLAYER_PHOTOS` R2; approved origin |
| Public player photo | `GET/HEAD /media/player-photos/:token` | `PLAYER_PHOTOS` direct object lookup; explicit public metadata |
| Registration organizer | `GET /api/event-registration/organizer/:eventId`; `POST .../config`; `POST .../players`; `POST .../status`; `POST .../token/rotate`; `POST .../entries/:entryId/status`; `POST .../entries/:entryId/management`; `POST .../entries/:entryId/members/:memberId` | `COURT.get(room)` authorization + owner-scoped parameterized D1 |
| Registration integration | `GET .../:eventId/import-preview`; `POST .../:eventId/import-mark`; `POST .../:eventId/import-reset` | Same organizer authorization; D1 only |
| Registration public | `GET /register/:token`; `GET /api/event-registration/public/:token`; `GET .../:token/players`; `POST .../:token/submissions` | Same-origin; hashed token + indexed D1 |
| Team management | `GET /event-registration/manage/:token`; `GET/PATCH /api/event-registration/manage/:token`; `GET .../:token/players`; `POST .../:token/withdraw` | Same-origin; hashed management token + indexed D1 |
| Check-in organizer | `GET /api/check-in/status`; `GET/POST /api/check-in/sessions`; `GET .../:sessionId/review`; `POST .../:sessionId/close`; `POST .../:sessionId/check-ins/:checkInId` | `COURT.get(room)` + deterministic `CHECK_IN_SESSIONS` keys |
| Check-in public | `GET /check-in`; `GET /check-in/code/:code`; `GET /check-in/:token`; `GET/POST/DELETE /api/check-in/public/:token` | Same-origin; deterministic token/code/session/device keys |
| Public schedules | `GET /api/public-schedules/status`; `POST /api/public-schedules`; `PUT/DELETE /api/public-schedules/:token`; `GET /s/:token` | Organizer routes use `COURT.get(room)`; documents use `PUBLIC_SCHEDULES.get/put` by token |
| Device sync | `GET/POST /?room=:room` | Direct `COURT.get/put("room:"+room)` |

Private preflight reflects only allowlisted origins and methods/headers. Public check-in and registration preflights are rejected. Public serializers are explicit allowlists. The top-level catch returns stable errors without raw exceptions or stack traces.

## KV list inventory

There is exactly one `.list()` call:

| Helper / route | Prefix | Bound | Frequency | Safety |
| --- | --- | --- | --- | --- |
| `listLegacyCheckInRecords`, reachable from authenticated `GET /api/check-in/sessions/:sessionId/review` only when the stored legacy session lacks a valid record directory | `check-in:record:{sessionId}:` | One page, `MAX_CHECK_INS_PER_SESSION + 1` (351); fails closed if incomplete/over bound | At most once for each pre-directory session; successful migration immediately stores `recordKeys`, directory version, and ID pointers | Not public, not recursive, never used by routine polling for current sessions |

Removed quota-risk behavior from the prior fix remains removed:

- Organizer review no longer lists on each poll.
- Check-in disposition resolves `check-in:id:{sessionId}:{checkInId}` directly.
- Unknown submission capacity uses the bounded session directory.
- Active session discovery uses `check-in:active:{roomHash}`.
- Public session lookup uses `check-in:public:{publicToken}`.
- Short code resolution uses `check-in:short:{shortCode}`.
- Public schedules use `schedule:{publicToken}`.
- Device sync uses `room:{roomCode}` and never lists all rooms.
- Registration dashboards/imports/counts use D1 and never KV list.

Remaining KV risk: KV counter increments and multi-key directory updates are not globally atomic across Cloudflare locations. The directory helper retries current state and the session has a hard 350-record cap, but a Durable Object would be stronger under coordinated bursts. The one-time legacy migration costs one LIST plus up to 350 direct GETs for an old session; current sessions cost zero LIST operations.

## D1 list/count/import queries

Dashboard counts use one indexed aggregate over `event_registrations WHERE event_id = ?`, with conditional sums for each status and active/substitute totals. Dashboard rows use `WHERE event_id = ? ORDER BY COALESCE(submitted_at, created_at) DESC, id LIMIT 200`; members use an event-scoped join limited to 3,000.

Import preview uses:

```sql
SELECT ... FROM event_registrations
WHERE event_id = ?
ORDER BY COALESCE(submitted_at, created_at), id
LIMIT 500;

SELECT m.* FROM event_registration_members m
JOIN event_registrations r ON r.id = m.registration_id
WHERE r.event_id = ?
ORDER BY m.registration_id, ..., m.created_at, m.id
LIMIT 10000;

SELECT ... FROM event_registration_imports
WHERE owner_scope = ? AND event_id = ?
ORDER BY updated_at DESC
LIMIT 500;
```

Import acknowledgment verifies the owner-scoped config and exact registration/revision, then uses `INSERT ... ON CONFLICT(event_id, registration_id) DO UPDATE`. Reset uses an owner/event/registration-scoped `DELETE`. All values are bound parameters.

## Binding audit

| Binding | Type | Required by | Wrangler example/local |
| --- | --- | --- | --- |
| `COURT` | KV | sync, organizer authorization for schedules/photos/check-in/registration | yes / yes |
| `PUBLIC_SCHEDULES` | KV | schedule publish/manage/public read | yes / yes |
| `CHECK_IN_SESSIONS` | KV | all short-lived check-in routes | yes / yes |
| `PLAYER_PHOTOS` | private R2 | private photo API and opted-in public media | yes / yes |
| `EVENT_REGISTRATION_DB` | D1 | registration public/management/organizer/import routes | yes / yes |

No Worker binding is missing from either Wrangler file and no Wrangler binding is unused. Production IDs are intentionally placeholders and must be reconciled in the Cloudflare dashboard before deployment.

## Estimated steady-state reads

- Idle app: no registration or check-in reads; device sync retains its existing 15-second direct room GET only when sync is enabled.
- Registration dashboard open: one organizer D1 dashboard request every 5 seconds visible or 15 seconds hidden; no KV list. Requests are serialized and unchanged DOM rows are patched.
- Import preview open: one D1 preview on open and on explicit refresh/apply validation; no automatic polling and no KV list.
- Event-day check-in open: local event state only; no Worker polling and no KV reads.
- Pickup check-in organizer sheet: one deterministic session/review cycle every 15–60 seconds while visible; pauses hidden/closed; current sessions use no KV list.

Monitor Workers requests/errors/CPU, KV read and LIST operations by namespace, D1 query count/latency/errors, R2 operations, and 429/5xx route rates after deployment.
