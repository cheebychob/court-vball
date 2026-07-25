# Persistent event registration foundation

## Architecture and lifecycle decision

Court registration is a D1-backed product for pre-event intent. It is not an extension of the KV-backed six-hour player check-in session.

The local event stores backward-compatible organizer settings plus the current public-token reference. D1 remains authoritative for public configuration, registrations, status counts, capacity, roster revisions, and organizer actions. Public submissions never mutate local teams, rotating entries, schedules, games, players, ratings, backups, sync payloads, or deletion maps. An authenticated organizer may now preview and explicitly import an accepted registration. The browser applies that reviewed change through Court's normal local save and device-sync path; the Worker never mutates local event state.

Legacy events without `registration` remain valid and behave as disabled/closed when read. Loading a legacy event does not call the Worker and does not create a D1 row. Newly created events store disabled recommended defaults. Duplicating an event clears the source registration token and starts disabled so two event IDs cannot accidentally share one public capability.

Disabling registration sets the server configuration to disabled/closed and preserves every entry. Marking an event complete or deleting it sets `event_available = 0`, closes public access, records `archived_at`, and retains the configuration and entries. Reopening/restoring the local event does not reopen registration. A deliberate registration settings save can reactivate the D1 configuration. Public-token rotation replaces the stored hash immediately; the old URL stops resolving while entries remain.

No automatic purge runs in this branch. Registration rows are retained for organizer review until a future explicit retention/purge policy is implemented. The rate-limit table stores only SHA-256 scopes derived from the relevant public/management capability and request address. Submission, lookup, management-read, management-write, withdrawal, and address-wide token-guess buckets are named separately. Buckets older than 24 hours are deleted during later protected actions. Raw IP addresses and device fingerprints are not stored.

Backups and device sync include the event’s safe registration settings/reference, including the public token needed to share the link from another organizer device. They do not contain D1 entries. Restoring onto the same owner scope reconnects to the existing D1 row by event ID. Restoring onto another sync room cannot read or mutate the original owner’s row; the organizer must create a distinct event ID or resolve the ownership conflict with the original dataset. Restore never duplicates D1 registrations and never reopens a closed/deleted event automatically.

Imported local entries carry a stable `registrationSource` mapping with the D1 registration ID, source revision, first import time, last synchronization time, and the exact imported name/active/substitute snapshot. D1 also stores a small owner-scoped acknowledgment containing the local entry ID and imported revision. The local mapping is authoritative for event gameplay; the acknowledgment prevents a second organizer device from creating a duplicate before the synced event arrives. If an acknowledged entry is genuinely removed, the organizer must sync, review the warning, and explicitly clear the acknowledgment before reimporting.

## Registration-to-event integration

Supported mappings:

- Fixed-team events with team registration import to `event.teams`.
- A fixed event constrained to exactly two active players is labeled and imported as a fixed pair.
- Rotating events with `entrySize === 1` and individual registration import to `event.entries`.
- Rotating events with `entrySize === teamSize` and team registration import to one complete rotating entry.

Rotating pairs or groups that combine into a larger temporary side remain unsupported. Preview explains the incompatibility and preserves every registration.

Preview is read-only. It reports create, update, no-change, blocked, and non-accepted states; matched/pending/rejected counts; D1 and local mapping state; source revision; name/active/substitute diffs; manual local edits; schedule/game warnings; and stable-player conflicts. It blocks unresolved members, roster-size violations, duplicate stable IDs, another event's registrations, non-accepted status, unsupported formats, missing local players, cross-registration conflicts without an explicit D1 override, conflicts with an existing local entry, ambiguous mappings, and unsafe reconciliation of a manually edited entry.

Imports are per-registration atomic. A create/update preserves the local entry ID, keeps substitutes in `substitutePlayerIds`, writes `registrationSource`, saves through the normal event path, and then records the D1 acknowledgment. A repeated import with the same revision and snapshot performs no write. An acknowledgment failure does not roll back a successfully saved local entry; the next reviewed action can retry the acknowledgment without creating a duplicate.

Schedules are never generated or regenerated by import. Existing draft/published schedules are retained and marked for review through the existing event helper. Saved games keep their captured player IDs, event-entry IDs, scores, logs, results, standings inputs, and rating effects. A reviewed update changes only the future roster/name on the same event-entry ID. Withdrawn or declined registrations never delete an imported entry automatically.

Event-day arrival is stored separately in `event.registrationCheckIn`. It begins from imported active players and substitutes, tracks team/player arrival text states, supports an explicit event-day substitute promotion and replacement, and never rewrites the D1 registration, original import snapshot, event entry roster, games, or ratings. It is included automatically in backup and device sync. Public event self check-in is deliberately deferred; the existing public pickup check-in remains separate.

## Event registration schema

`event.registration` normalizes to:

```js
{
  enabled: false,
  status: "closed",
  mode: "disabled",
  opensAt: null,
  closesAt: null,
  activePlayerCapacity: null,
  allowSubstitutes: true,
  maxSubstitutesPerTeam: null,
  minActivePlayersPerTeam: null,
  maxActivePlayersPerTeam: null,
  requireOrganizerApproval: true,
  allowWaitlist: true,
  publicTitle: "",
  publicDescription: "",
  publicToken: null,
  publicUrl: null,
  updatedAt: null
}
```

Supported modes:

- Fixed-team event: `team`.
- Rotating event with `entrySize === 1`: `individual`.
- Rotating event with `entrySize === teamSize`: `team`.
- Rotating pair/group entries that combine into a larger side: disabled for now with an organizer explanation.

For fixed events, Court derives minimum/maximum active roster defaults only when every existing rostered team has the same nonzero size. The fixed-event schema has no global team-size field, so Court leaves both blank when that inference is not safe. Solo rotating entries derive 1/1 with no substitutes. Complete-side rotating entries derive the entry size.

## Status and capacity rules

Registration-system statuses are `draft`, `scheduled`, `open`, `closed`, and `cancelled`. Stored status is not enough: the Worker derives the effective state from `enabled`, `opens_at`, `closes_at`, and the current server time. Draft is not publicly discoverable. Scheduled becomes open only after `opens_at`; open becomes closed at `closes_at`; cancelled always remains cancelled.

Entry statuses are `draft`, `submitted`, `needs_review`, `accepted`, `waitlisted`, `declined`, and `withdrawn`. Transitions are explicit in both frontend and Worker code. Restoring a declined, withdrawn, or waitlisted entry to accepted rechecks authoritative capacity. Accepted entries can be waitlisted, declined, or withdrawn to release capacity.

Only `accepted.active_player_count` consumes committed capacity. Submitted/needs-review demand is reported separately. Waitlisted, declined, and withdrawn entries consume no active capacity. Substitutes never consume active capacity. Auto-accept and organizer acceptance are whole-entry operations; Court never partially accepts a team. Organizer over-cap acceptance requires `overrideCapacity: true`, returns before/after counts, and stores `capacity_override = 1`.

Submitted entries do not reserve capacity. Auto-accept and organizer acceptance use a single conditional SQLite statement that recomputes accepted active players inside the write. Concurrent non-override acceptances cannot both pass a stale browser count. An accepted captain edit that would exceed active capacity fails atomically with `CAPACITY_EXCEEDED`; it never silently moves the whole team to the waitlist. Unlimited capacity is represented by `NULL`.

## Routes and privacy boundary

Organizer routes require an allowlisted Court origin, `X-Court-Room`, a matching `room:{code}` record in `COURT`, and an owner hash matching `event_registration_configs.owner_scope`:

```text
GET  /api/event-registration/organizer/:eventId
POST /api/event-registration/organizer/:eventId/config
POST /api/event-registration/organizer/:eventId/players
POST /api/event-registration/organizer/:eventId/status
POST /api/event-registration/organizer/:eventId/token/rotate
POST /api/event-registration/organizer/:eventId/entries/:entryId/status
POST /api/event-registration/organizer/:eventId/entries/:entryId/management
POST /api/event-registration/organizer/:eventId/entries/:entryId/members/:memberId
GET  /api/event-registration/organizer/:eventId/import-preview
POST /api/event-registration/organizer/:eventId/import-mark
POST /api/event-registration/organizer/:eventId/import-reset
```

Organizer responses use `Cache-Control: no-store`. Changing the event ID cannot cross owner scope. Public tokens are not accepted as organizer credentials.

Anonymous same-origin routes are exact-matched separately:

```text
GET  /register/:publicToken
GET  /api/event-registration/public/:publicToken
GET  /api/event-registration/public/:publicToken/players?q=:query
POST /api/event-registration/public/:publicToken/submissions

GET   /event-registration/manage/:managementToken
GET   /api/event-registration/manage/:managementToken
PATCH /api/event-registration/manage/:managementToken
GET   /api/event-registration/manage/:managementToken/players?q=:query
POST  /api/event-registration/manage/:managementToken/withdraw
```

The public page provides a mobile-first team form with separate active and substitute rosters. Matched players are selected through a bounded event-scoped search; aliases influence private server ranking but are never returned. Unknown names stay pending for organizer review and never create a Court player. Successful submission returns a one-registration management capability, offers native sharing with copy fallback, and may retain only that management URL in local browser storage so the confirmation survives reload. The management page can edit the team/roster with optimistic concurrency while registration is open, move players between roster roles, and withdraw without deleting the record.

The management capability is separate from the event public token and organizer room. D1 stores only its SHA-256 hash. Organizer rotation invalidates the old link immediately and returns the replacement once for copying; the current raw URL cannot be recovered later from D1. Revocation removes public access, and locking retains a view-only page. A withdrawn registration remains viewable but cannot be edited.

The public serializer allowlists only title, description, event date, registration mode/effective status/window, active-capacity summary, waitlist/substitute rules, active roster limits, submission availability, and server time. It never serializes event IDs, owner scope, token hashes, ratings, seeds, player IDs, names/aliases from Court’s roster, notes, roles, games, schedules, sync credentials, backups, attendance, crews, or check-in capabilities.

Public tokens are random 256-bit Base64URL values. D1 stores only SHA-256. Rotation is an authenticated action and immediately invalidates the old hash. The token is unrelated to event ID, owner code, schedule tokens, and check-in tokens.

## D1 objects

Migration `cloudflare/migrations/0001_event_registration_foundation.sql` creates:

- `event_registration_configs`
- `event_registrations`
- `event_registration_rate_limits`
- `idx_event_registration_configs_owner`
- `idx_event_registration_configs_public`
- `idx_event_registrations_event_status`
- `idx_event_registrations_event_submitted`
- `idx_event_registration_rate_limits_updated`

Foreign-key deletion is `RESTRICT`; UI lifecycle operations archive rather than delete. Status, mode, boolean, capacity, roster-count, and window constraints are enforced in SQL in addition to Worker validation.

Migration `cloudflare/migrations/0002_team_registration_portal.sql` additively extends the foundation:

- `event_registrations` gains normalized team-name, hashed management-token, rotation/revocation, edit-lock/override, last-edit, revision, and edit-key fields.
- `event_registration_members` stores stable active/substitute member rows, optional internal matches, public display names, centralized match statuses, duplicate overrides, and timestamps.
- `event_registration_players` is an event-scoped private search index populated by the authenticated organizer. It stores only internal identity, an opaque public token, the unique public label, normalized primary/alias search terms, eligibility, and update time.
- Indexed paths cover registration-member loading, player conflicts, management-token lookup, active team-name uniqueness for new portal registrations, dashboard update sorting, and bounded player lookup.

Existing foundation rows are preserved. They retain revision `1`, receive no management capability automatically, and remain compatible with the organizer status/capacity workflow. The additive tables and columns should not be rolled back by dropping them.

Migration `cloudflare/migrations/0003_registration_event_imports.sql` adds `event_registration_imports`, indexed by owner/event/update time and uniquely by owner/event/local entry ID. It stores no management token, ratings, games, notes, or full event state. Foreign keys are restrictive so registration history is not silently deleted.

## Local development

From the repository root:

```sh
npm install
cd cloudflare
npx wrangler d1 migrations apply EVENT_REGISTRATION_DB --local --config wrangler.local.jsonc
npx wrangler dev --config wrangler.local.jsonc
```

`wrangler.local.jsonc` contains only draft local bindings. Do not deploy it.

To verify the local binding and schema:

```sh
cd cloudflare
npx wrangler d1 execute EVENT_REGISTRATION_DB --local --config wrangler.local.jsonc --command "SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name"
```

Repository tests do not contact Cloudflare:

```sh
npm run test:worker
npx playwright test tests/event-registration.spec.js --project=chromium
npx playwright test tests/registration-event-integration.spec.js --project=chromium
npm run verify
```

## Production creation, migration, and deployment order

Do not run these commands until the existing production KV namespace IDs and private R2 bucket name have been copied into a production `cloudflare/wrangler.jsonc`.

1. Create D1 and let Wrangler print the database UUID:

   ```sh
   cd cloudflare
   npx wrangler d1 create court-event-registration
   ```

2. Copy `wrangler.example.jsonc` to `wrangler.jsonc`. Replace every required existing-resource marker with the current `COURT`, `PUBLIC_SCHEDULES`, `CHECK_IN_SESSIONS`, and `PLAYER_PHOTOS` production resources. Copy the new D1 UUID into `EVENT_REGISTRATION_DB`. Never allow Wrangler to auto-provision replacements for existing production storage.

3. Confirm bindings without changing data:

   ```sh
   npx wrangler d1 list
   npx wrangler kv namespace list
   npx wrangler r2 bucket list
   ```

4. Review pending migrations, then apply them remotely:

   ```sh
   npx wrangler d1 migrations list court-event-registration --remote --config wrangler.jsonc
   npx wrangler d1 migrations apply court-event-registration --remote --config wrangler.jsonc
   ```

5. Verify the remote schema:

   ```sh
   npx wrangler d1 execute court-event-registration --remote --config wrangler.jsonc --command "SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name"
   ```

6. Save the current live Worker source/config, review the complete binding list, then deploy the Worker before the frontend:

   ```sh
   npx wrangler deploy --config wrangler.jsonc
   ```

7. Re-test legacy sync, public schedules, photos, player check-in, organizer registration, invalid public tokens, and one disposable public registration before deploying `index.html`.

Wrangler migrations take a database backup and roll back the failing migration while leaving earlier successful migrations applied. For an application rollback, deploy the saved prior Worker/frontend while leaving D1 and its binding intact; older code ignores the D1 tables. Do not reverse this additive migration by dropping tables. Restore D1 through Cloudflare Time Travel/backups only for a verified data incident.
