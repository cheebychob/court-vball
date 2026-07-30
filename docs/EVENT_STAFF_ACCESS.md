# Event staff access

## Intended data flow and security boundary

Event staff access is a restricted, event-only capability. It is deliberately
separate from Court's public schedule links, public score-report queue, and the
owner's normal sync credential.

1. The owner app authenticates to the configured Worker with its existing
   `X-Court-Room` credential and sends one bounded event snapshot: the event,
   that event's game records, the event participants' public display names, the
   canonical scheduled-match projection, the explicit event-day check-in
   enablement, and (when one exists) a structural projection of the current
   published rules revision. Draft, deleted, old, and unpublished rules are
   not projected. It never sends a backup or an unrelated event to a staff
   endpoint.
2. The Worker stores the event authority, its revision, access epoch, grants,
   sessions, idempotency records, and bounded audit history in D1. A grant stores
   only a SHA-256 token hash. An optional PIN is derived with a versioned,
   PBKDF2-SHA-256 verifier and a random 16-byte salt. Raw tokens and PINs are
   never stored.
3. A newly issued link puts the raw capability in the URL fragment
   (`/staff#token=...`). Fragments are not sent in the initial HTTP request. The
   Tournament Desk removes the fragment immediately and exchanges the token
   plus optional PIN for a short-lived, event-scoped bearer session.
4. Every authenticated request rechecks the session, grant, expiry, revocation
   state, owner scope, event ID, and event access epoch. The request's event ID
   must equal the grant's event ID. UI visibility is not an authorization
   control.
5. Staff reads use an explicit event-only serializer. View Only and Scorekeeper
   responses omit registration contacts. Tournament Operator contact reads are
   limited to registrations for the authorized event. Check-in state is
   returned only when the event has event-day check-in enabled and the
   Tournament Operator grant's stored permission array includes
   `setEntryCheckIn`. Current published rules are readable by all three roles,
   but rule drafts and rule-editing capabilities are never returned. No staff
   response can contain the owner room code, sync URL, settings, backups,
   unrelated players, or unrelated events.
6. Staff writes are narrow operations. Each carries an idempotency key and an
   expected event revision. D1 applies the idempotency reservation, conditional
   revision update, and audit insert in one batch transaction. A stale revision
   returns a conflict; it is never silently overwritten.
7. Staff score operations create or correct the same stable event game-record
   shape used by Court. Corrections preserve game IDs where possible and retain
   removed IDs as sync tombstones. The owner app receives those records through
   its existing sync GET, then runs Court's canonical deterministic rating
   replay. The Tournament Desk does not implement a second rating algorithm.
8. Owner sync POSTs include the event revisions actually applied through a
   compatible root sync response. D1 accepts a matching revision and rejects a
   stale revision. A staffed event that is still present but has no revision is
   rejected instead of silently replacing a staff score. If an older client
   omits a staffed event entirely, the Worker treats that omission as an event
   deletion: it revokes access, retains the D1-authoritative game history, and
   detaches those games from the deleted event. Staff devices never upload or
   replace a complete Court dataset.

The D1 database is the strongly consistent serialization boundary for a staffed
event. The existing `COURT` KV value remains the normal full-dataset transport,
but it is not used for staff read-modify-write operations.

## Optional PIN derivation and compatibility

The PIN field is optional. Omitting it or sending an empty string creates the
same no-PIN grant as before and stores `NULL` for all PIN fields. A supplied PIN
must be a JSON string containing exactly 4–12 ASCII digits. It is never
converted to a number, so leading zeroes such as `012345` are preserved.

KDF version 2 stores:

- a unique random 16-byte base salt encoded as unpadded base64url;
- a 32-byte verifier encoded as unpadded base64url;
- `pin_iterations = 210000`, the total PBKDF2 work factor; and
- `pin_kdf_version = 2`, which identifies the derivation and encoding.

Cloudflare's production Web Crypto runtime rejects an individual PBKDF2 call
above 100,000 iterations. The previous implementation made one 210,000-
iteration call, so PIN-protected creation failed during `derive_pin_hash`
before the D1 grant/audit batch. No-PIN creation never entered that crypto path,
which is why it continued to succeed. Version 2 retains the 210,000 total work
factor as domain-separated 100,000, 100,000, and 10,000 iteration blocks, then
SHA-256 hashes their concatenated 32-byte outputs into the stored verifier.
Each platform call remains within the proven limit.

Migration `0006_event_staff_pin_kdf_version.sql` adds the explicit version
column. It marks any existing protected row as version 1 and leaves no-PIN rows
unversioned. Redemption selects the algorithm from that stored version:
version 1 continues to use the exact original single-call PBKDF2 encoding on a
runtime that supports it, while all new and dummy verification uses version 2.
The affected Cloudflare deployment could not successfully create a version-1
protected grant because the failure occurred before insert; therefore this
change does not invalidate a successfully issued production PIN link. Do not
rewrite a version-1 verifier as version 2: rotate the grant with a new PIN
instead.

## Initial permission presets

The stored grant format contains both a preset role and a versioned permission
array. This leaves room for custom permission sets later without changing or
replacing existing grants. Authorization and response projection use the
permission array frozen on that grant at creation time, intersected with the
role's supported permissions; changing a role preset later does not expand an
existing link.

| Role | Initial permissions |
| --- | --- |
| View Only | Event, entries/teams, current matches, schedule, standings, bracket, and result reads |
| Scorekeeper | View permissions plus scheduled score entry and correction of results previously entered through staff access |
| Tournament Operator | Scorekeeper permissions plus event check-in/attendance, event-specific registration contacts, valid match moves, playoff result operation, and event activity |

Owner grant management, event setup, player/rating edits, destructive deletes,
schedule regeneration, sync/settings/backups, public-link management, and
unrelated registration access are never staff permissions.

## Contextual Tournament Desk navigation

The Desk always opens on **Current Matches** and retains the event name, date,
and location in its header. Its base sections are Current Matches, Schedule,
Standings, and Bracket. It does not include a generic Event Information
section.

- **Check-In** appears only for a Tournament Operator when the owner has
  enabled **Enable event-day check-in** for that event and the grant's frozen
  permissions include `setEntryCheckIn`. View Only and Scorekeeper never see
  the section.
- Registration setup and registration import do not enable event-day check-in.
  The owner setting describes arrival as separate from registration. Turning
  it off removes the staff projection and blocks check-in writes while
  preserving check-in history, entries, rosters, players, games, and attendance
  records. Legacy events with meaningful existing check-in history migrate to
  enabled; other events default to disabled.
- **Rules** appears only while a current published rules revision exists. It
  shows Quick Rules plus the published document to every staff role. The owner
  app applies its canonical rules sanitizer before creating a structural
  projection; the Worker validates allowed tags, attributes, link schemes,
  depth, and size; the Desk creates DOM nodes from that projection without
  parsing rich-text HTML. Drafts, old revisions, unpublished rules, and owner
  edit/publish controls remain absent.
- If Refresh removes the active Check-In or Rules section, the Desk immediately
  falls back to Current Matches. Existing invite URLs, PINs, grant scopes,
  revocation, and expiry behavior do not change.

## Storage model

Migration `0005_event_staff_access.sql` adds:

- `event_staff_events`: one owner/event authority with revision, access epoch,
  event JSON, event-game JSON, safe participant/match projection, game
  tombstones, the bounded IDs of matches first scored through staff access, and
  update/deletion timestamps. The staff-scored IDs are durable authorization
  provenance for the Scorekeeper correction rule; audit retention is not used
  as an authorization source.
- `event_staff_grants`: owner/event/epoch-bound grants with token hash, optional
  PIN derivation, role, permission JSON, expiry, revocation, and last use.
- `event_staff_sessions`: short-lived hashed session credentials bound to one
  grant and epoch. Sessions last no more than eight hours and each grant is
  limited to 12 active sessions.
- `event_staff_idempotency`: bounded operation results keyed by
  owner/event/grant/idempotency key.
- `event_staff_audit`: bounded grant-management and staff-operation history.
- `event_staff_rate_limits`: fixed-window token/PIN attempt counters.

No new binding is required. The additive tables use the existing
`EVENT_REGISTRATION_DB` D1 binding. An older Worker or a database without the
migrations makes `/api/event-staff/status` report unavailable, and the owner UI
does not offer grant creation. Migration `0006_event_staff_pin_kdf_version.sql`
adds `event_staff_grants.pin_kdf_version`; schema version 2 requires that
column.

## API contract

Owner routes require the same allowlisted origin and `X-Court-Room` credential
as Court's other private organizer APIs. The room credential is never included
in a URL or returned by a response.

| Method and route | Purpose |
| --- | --- |
| `GET /api/event-staff/status` | Confirm the Worker binding and migration are ready |
| `PUT /api/event-staff/owner/events/:eventId/snapshot` | Create or conditionally refresh the bounded event authority |
| `GET /api/event-staff/owner/events/:eventId/grants` | List active, revoked, and expired grants without token material |
| `POST /api/event-staff/owner/events/:eventId/grants` | Create one grant and return its fragment-based invite URL once |
| `POST /api/event-staff/owner/events/:eventId/grants/:grantId/revoke` | Revoke one grant and all of its sessions |
| `POST /api/event-staff/owner/events/:eventId/grants/:grantId/rotate` | Revoke one grant and return a replacement invite once |
| `POST /api/event-staff/owner/events/:eventId/revoke-all` | Increment that event's access epoch and revoke its grants/sessions |
| `POST /api/event-staff/owner/revoke-all` | Invalidate every event epoch for the owner before restore or identity change |
| `GET /api/event-staff/owner/events/:eventId/audit` | Read bounded owner-visible event staff activity |

An unexpected grant-creation failure returns HTTP 500 with stable code
`EVENT_STAFF_GRANT_CREATION_FAILED`, a safe message, a random `requestId`, and
`retryable: true`. Court leaves the form open, clears only the PIN, and shows
that request ID. It also suppresses duplicate submissions while the first
request is running. The raw invite is returned only after the atomic grant and
audit writes have succeeded and the new grant has been read back.

The snapshot body is
`{ event, games, participants, matches, gameMeta, deletedGameIds,
historicalGameIds, expectedRevision, deleted, resetAccess }`. The projection
contains only the authorized event and the minimum historical participant and
scheduled-match metadata needed for validation and canonical Court game
records. `historicalGameIds` is a bounded, explicit marker for saved games
whose original participants no longer match the event's current roster; it
does not permit an arbitrary new game with unrelated participants. The event
projection includes `eventDayCheckInEnabled`, preserves canonical check-in
history in D1 even while disabled, and optionally includes only the sanitized
current `publishedRules` structural projection. Raw `rules` data is discarded.

The standalone Desk uses same-origin routes. `POST /api/event-staff/redeem`
accepts the one-time link credential and optional PIN and returns
`{ sessionToken, sessionExpiresAt, queueScope, state }`. Later requests use
`Authorization: Bearer <sessionToken>`:

| Method and route | Purpose |
| --- | --- |
| `GET /api/event-staff/state` | Refresh the explicitly allowlisted event state |
| `POST /api/event-staff/operations` | Submit one narrow, revisioned, idempotent event operation |
| `POST /api/event-staff/logout` | Revoke the current session |

An operation body is
`{ eventId, action, targetId, expectedRevision, idempotencyKey, payload,
replayed }`. A success includes the resulting revision, server timestamp,
warnings, and refreshed state. A stale write returns HTTP 409 with the current
revision and state plus a safe rendering of the attempted change.

## Conflict and offline contract

- Every accepted operation increments the event revision.
- Repeating an acknowledged idempotency key returns its original response and
  cannot duplicate a game, correction, bracket advancement, or audit entry.
- A stale operation receives HTTP 409 with the current server revision and safe
  current event state.
- When a root response carries a changed D1 revision, Court replaces that
  managed event's local game projection before the ordinary ID merge. This
  prevents an owner game and a staff game with different IDs for the same
  logical match from both affecting ratings. A same-revision pull preserves an
  unuploaded owner result until its snapshot compare-and-swap is attempted.
- The Tournament Desk saves event-scoped drafts and permitted narrow operations
  locally, labels them Pending, and retries them in order after connectivity
  returns. It never labels a write Saved before server acknowledgement.
- Queue replay stops on authentication failure or revision conflict. Retry and
  discard are explicit. Logout clears the restricted session, cached event
  state, drafts, and queued actions where browser storage permits.
- A tied score is retained for standings/reference but has no rating replay
  impact, matching existing Court behavior.
- Owner management requires an active, adopted device-sync configuration. A
  compatible owner receives the D1 event revision through the normal root GET
  before it may project another snapshot. This may require a manual retry on a
  weak connection, but it prevents a stale local event from being blessed as
  authoritative.

## Revocation and lifecycle

- Revoking one grant invalidates all of its sessions on the next request.
- Revoke all increments the event access epoch and invalidates every existing
  grant and session for the event.
- Token rotation revokes the old grant and issues a new raw token once.
- Event deletion advances the access epoch, revokes every grant and session,
  and makes the next normal root sync carry an event tombstone. An explicit
  owner reset snapshot may later reuse the same local event ID, but it starts
  from another epoch and cannot revive an old credential.
- Backup restore runs behind a replacement barrier: Court pauses sync timers
  and new root pushes, waits for in-flight sync, reconciles and revokes the old
  staff scope, then replaces local state. Former staff-only games omitted by
  the backup are sent as tombstones. A failed reset retry remains a trusted
  no-pull replacement so stale pre-restore D1 state cannot overwrite the
  restored local dataset.
- Duplicated events do not copy server-side grants or credentials.
- Normal backups contain no grant, session, token hash, PIN hash, or staff audit
  data.
- Changing the owner sync identity first revokes grants for the old identity.

## Local manual verification

Use only disposable local data and credentials.

1. Install dependencies at the repository root, apply the local D1 migrations,
   and start the local Worker:

   ```sh
   npm install
   cd cloudflare
   npx wrangler d1 migrations apply EVENT_REGISTRATION_DB --local --config wrangler.local.jsonc
   npx wrangler dev --config wrangler.local.jsonc --port 8787
   ```

2. In a second terminal, start Court:

   ```sh
   npm run dev
   ```

   Run that command from the repository root.

3. Open `http://127.0.0.1:5173`. In **Settings → Device Sync**, set
   **Server URL** to `http://127.0.0.1:8787`, enter a disposable sync code, and
   select **Connect**. Create one fixed-team event and one rotating-group event,
   add entries, and generate schedules.
4. Open each event's **Event Staff Access** area. Create View Only,
   Scorekeeper, and Tournament Operator grants, covering a PIN-protected link
   and the 24-hour, 3-day, and 7-day expiration choices. Confirm the create
   sheet shows each raw link once, then shows only grant metadata after closing
   it. Rotate one link and verify the former link no longer redeems.
   Also create PINs `0123`, `012345`, and `012345678901`; confirm leading
   zeroes redeem correctly. Reject 3 digits, 13 digits, letters, whitespace,
   Unicode digits, and a numeric JSON value. Submit a PIN-protected form twice
   quickly and confirm only one grant is created.
5. Leave **Enable event-day check-in** off. Open each link in a separate private
   browser profile or phone-sized context. Confirm the fragment disappears
   immediately, the page identifies itself as restricted access, Current
   Matches is the default, Event Information is absent, there is no full-app
   navigation, and Check-In is absent for every role. Confirm View Only cannot
   mutate or see contacts/activity and Scorekeeper can score but not check in,
   move matches, or see contacts. Enable event-day check-in in the owner app
   and Refresh each Desk. Confirm only Tournament Operator gains Check-In and
   can use the permitted attendance and contact controls. Disable it again and
   confirm the section disappears, the Desk falls back to Current Matches if
   needed, and the saved arrival history remains after re-enabling.
6. Create a private rules draft and confirm no Desk shows Rules. Publish it
   with Quick Rules, headings, a list, a callout, a table, and a safe link;
   Refresh View Only, Scorekeeper, and Tournament Operator and confirm all
   render the current publication without edit controls or mobile overflow.
   Change the draft without publishing and confirm staff still see only the
   prior publication. Unpublish it and confirm Rules disappears and an active
   Rules view falls back to Current Matches.
7. Record one fixed score, one rotating score, and one tie. Refresh the owner
   app with **Sync now** and verify there is one stable game per match,
   standings/bracket results match the saved score, and the tie warning says
   the saved tie has no rating impact. Correct a staff-entered score and verify
   the game ID stays stable and the owner activity log shows previous and new
   values.
8. Open the same match in two staff profiles. Submit different scores from the
   same revision. Confirm the first succeeds, the second shows HTTP-conflict
   behavior with both current and attempted results, and an explicit retry
   creates an intentional correction. Repeat with the owner editing while a
   stale staff dialog is open; after sync, confirm only one logical game exists
   and unrelated games and ratings are unchanged.
9. Disable the network in browser developer tools, enter a score, and reload.
   Confirm the scoped draft remains Pending rather than Saved. Reconnect and
   verify ordered replay. Repeat after revoking a grant. For expiration, create
   a separate grant with a custom expiration a few minutes ahead, redeem it,
   queue a write while offline, wait until its displayed expiration passes, and
   reconnect. Queued writes must stop and restricted cached data must be
   cleared.
10. Exercise **Revoke**, **Revoke all access**, and **Logout** and verify open
   sessions stop on their next request. Delete an event, duplicate an event,
   restore an older backup, and reconnect under a different disposable sync
   code. Confirm old links remain unusable, the duplicate has no grants, and a
   reused event ID does not revive access.
11. Run the automated verification from the repository root:

    ```sh
    npm run verify
    ```

## Failure diagnostics

Application error logs are one-line JSON records containing only `requestId`,
route pathname, HTTP method, opaque event reference, `operationStage`,
`errorClass`, and a mapped safe message. Useful creation stages include
`generate_pin_salt`, `decode_pin_salt`, `import_pin_key`, `derive_pin_hash`,
`encode_pin_hash`, `insert_grant_and_audit`, and `read_created_grant`. The logs
must never include request headers or bodies, owner room credentials, raw
tokens, PINs, salts, hashes, or invite URLs.

When an owner reports a failure, collect the displayed request ID and search
for that exact value in Cloudflare Workers Logs. If a live `wrangler tail` is
temporarily required, remember that the platform invocation envelope can
include request headers even though Court's structured log does not. Retain
only the matching Court JSON record, never paste the complete invocation
envelope, and stop the tail immediately after the check.

## Deployment and rollback

Deployment order and exact commands are recorded here so the UI cannot be
released ahead of its authorization boundary. The production
`cloudflare/wrangler.jsonc` already binds `EVENT_REGISTRATION_DB` to
`court-event-registration`; no binding, namespace, variable, or secret is
added by this feature.

1. Save the current live Worker source and configuration, then verify the
   existing resource names and record the currently active Worker version as
   `PRE_RELEASE_VERSION_ID` in the release record:

   ```sh
   cd cloudflare
   npx wrangler d1 list
   npx wrangler d1 migrations list court-event-registration --remote --config wrangler.jsonc
   npx wrangler deployments list --config wrangler.jsonc
   ```

2. Apply and inspect the additive migration locally:

   ```sh
   npx wrangler d1 migrations apply EVENT_REGISTRATION_DB --local --config wrangler.local.jsonc
   npx wrangler d1 execute EVENT_REGISTRATION_DB --local --config wrangler.local.jsonc --command "SELECT name FROM sqlite_master WHERE name LIKE 'event_staff_%' ORDER BY name"
   ```

3. Return to the repository root, run the full verification, then return to
   `cloudflare`. Confirm `0006_event_staff_pin_kdf_version.sql` is pending and
   apply the production migrations before deploying the Worker:

   ```sh
   cd ..
   npm run verify
   cd cloudflare
   npx wrangler d1 migrations list court-event-registration --remote --config wrangler.jsonc
   npx wrangler d1 migrations apply court-event-registration --remote --config wrangler.jsonc
   npx wrangler d1 execute court-event-registration --remote --config wrangler.jsonc --command "SELECT name, type FROM pragma_table_info('event_staff_grants') WHERE name = 'pin_kdf_version'"
   ```

4. Deploy and smoke-test the Worker before the frontend:

   ```sh
   npx wrangler deploy --config wrangler.jsonc
   ```

   Verify legacy owner sync, public schedules, public registration, and
   `GET /api/event-staff/status` from the Court origin. The status response
   must report `available: true` and `schemaVersion: 2`. Create and redeem one
   disposable no-PIN grant and one PIN-protected grant with leading zeroes,
   then revoke both.

5. Deploy the versioned root `index.html` through the repository's existing
   GitHub Pages `master`-root release flow. The owner UI remains unavailable
   when the capability endpoint is missing or reports an incompatible schema.

Rolling back the frontend hides staff management but does not revoke grants.
For a security rollback, use the owner UI to revoke all event grants while the
new Worker is still live. Then roll the Worker back to the exact version ID
recorded before deployment and verify the active deployment:

```sh
cd cloudflare
npx wrangler rollback <PRE_RELEASE_VERSION_ID> --config wrangler.jsonc --message "Rollback Court event staff access"
npx wrangler deployments status --config wrangler.jsonc
```

Restore the immediately preceding Court `0.40.2`, build `20260729.3` root
`index.html` artifact through the GitHub Pages `master`-root release flow.
Leave the additive D1 tables and `pin_kdf_version` column in place; Worker
rollbacks do not roll back D1 data, and older Court code ignores the added
column. Do not drop the tables or column as an application rollback.
