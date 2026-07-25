# Public player self check-in

## Existing Cloudflare architecture

Court's Cloudflare code is the module Worker at `cloudflare/court-sync-worker.js`. The repository now includes example/local Wrangler configuration and additive D1 migrations for event registration. It still has no Durable Object binding. Production resource IDs remain intentionally absent from source.

Existing services remain unchanged:

| Binding | Service | Purpose |
| --- | --- | --- |
| `COURT` | KV | Private device-sync envelopes at `room:{roomCode}` |
| `PUBLIC_SCHEDULES` | KV | Public schedule HTML snapshots and management metadata |
| `PLAYER_PHOTOS` | private R2 | Opaque-token JPEG/WebP objects; public media is gated by explicit object metadata |
| `CHECK_IN_SESSIONS` | KV | Short-lived player check-in sessions and deterministic lookup indexes |
| `EVENT_REGISTRATION_DB` | D1 | Persistent registration configuration, rosters, revisions, and import acknowledgments |

The legacy `GET`/`POST /?room=...` sync route still accepts and returns the existing opaque full-state envelope. Public schedule routes are exact-matched before that handler. Player photos use room-authorized private APIs and an opaque-token public media route. No existing Cloudflare-native rate limiter, WebSocket endpoint, or Worker test runtime was configured; Worker routes are tested with Node's test runner and in-memory binding fakes.

## Selected storage architecture

Add a dedicated KV namespace binding named `CHECK_IN_SESSIONS`.

Court does not store the mutable check-in list as one KV JSON array. Each known player, unknown entry, device mapping, rate bucket, and lookup is a separate key. Concurrent check-ins for different players therefore never overwrite a shared read-modify-write list. A known player's session-scoped public ID also has one deterministic record key, making repeated submissions idempotent.

This is the safest architecture supported by the repository's current deployment model. A Durable Object would provide stronger global ordering, atomic multi-key device limits, alarms, and WebSockets, but the project has no Wrangler configuration, DO migrations, or DO test/deployment path. Introducing those pieces in this feature would create an unverified production migration. KV limitations are documented below.

Key families:

```text
check-in:session:{privateSessionId}
check-in:public:{publicToken}
check-in:short:{shortCode}
check-in:active:{sha256(roomCode)}
check-in:record:{privateSessionId}:known:{publicPlayerId}
check-in:record:{privateSessionId}:unknown:{checkInId}
check-in:id:{privateSessionId}:{checkInId}
check-in:device:{privateSessionId}:{sha256(sessionId + rawDeviceToken)}
check-in:rate:{privateSessionId}:{kind}:{window}:{hashedScope}
```

The deterministic session record stores a bounded directory of its record keys, and each organizer-facing check-in ID has a direct pointer. New sessions never enumerate the namespace. A pre-directory session is enumerated once during organizer review, then immediately gains the directory and ID pointers so later polls use only `get()`.

All keys receive a TTL that covers the session expiry plus 24 hours of organizer review retention. Closing removes active-room and short-code lookups immediately. KV TTL then deletes the session snapshot, check-ins, pending names, device mappings, and lookup metadata. Rate buckets use their own short TTL.

## Session schema

The private KV session record contains only the active snapshot and organizer mapping:

```json
{
  "sessionId": "<256-bit private token>",
  "publicToken": "<256-bit public token>",
  "shortCode": "7KMFQ",
  "roomHash": "<sha-256 room hash>",
  "label": "Pickup volleyball",
  "createdAt": 1721300000000,
  "updatedAt": 1721300000000,
  "expiresAt": 1721321600000,
  "status": "open",
  "rosterSnapshot": [
    {
      "publicPlayerId": "<128-bit session-scoped token>",
      "playerId": "<private stable Court player ID>",
      "displayName": "Lily D",
      "photoUrl": null
    }
  ]
}
```

The stable `playerId` is never serialized by a public route. It is returned only by an authenticated organizer review response so Court can merge into the canonical attendance ID set.

The public roster serializer is an explicit allowlist:

```json
{
  "publicPlayerId": "<opaque session-scoped ID>",
  "displayName": "Lily D",
  "photoUrl": null
}
```

No aliases, ratings, seeds, roles, stats, notes, games, event data, attendance history, crews, sync credentials, backups, deletions, or complete player objects enter a public response.

## Routes and trust boundaries

Organizer routes require an approved Court browser origin, `X-Court-Room`, and a matching existing `room:{roomCode}` record in `COURT`:

```text
GET  /api/check-in/status
GET  /api/check-in/sessions
POST /api/check-in/sessions
GET  /api/check-in/sessions/:privateSessionId/review
POST /api/check-in/sessions/:privateSessionId/close
POST /api/check-in/sessions/:privateSessionId/check-ins/:checkInId
```

The public token cannot substitute for `X-Court-Room`. Organizer responses use `Cache-Control: no-store` and reflected allowlisted CORS.

Anonymous same-origin routes never accept the room code:

```text
GET    /check-in
GET    /check-in/code/:shortCode
GET    /check-in/:publicToken
GET    /api/check-in/public/:publicToken
POST   /api/check-in/public/:publicToken
DELETE /api/check-in/public/:publicToken
```

The standalone `/check-in/:publicToken` HTML contains only the public check-in CSS and script. It does not load `index.html` or the private app state. Its CSP allows same-origin API and public-image requests only. Public API requests with a foreign `Origin` are rejected, cross-origin preflight is not enabled, responses are `no-store`, and errors use stable codes without stack traces.

## Token and returning-player model

- Session, public, and check-in tokens use Web Crypto randomness.
- Public session tokens are 256-bit Base64URL values.
- Public player and check-in IDs are session-scoped 128-bit Base64URL values.
- Five-character short codes use `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, retry collisions, and exclude ambiguous `0`, `1`, `I`, `L`, and `O`.
- The player page creates a 256-bit random device token and stores it only under `court-check-in:{publicToken}`.
- The raw device token is sent only to the tokenized same-origin endpoint. KV stores SHA-256 of `sessionId + deviceToken`, never the raw token.
- A device mapping resolves only that device's own entry. A second device selecting an already checked-in player gets an idempotent response but no cancellation authority.
- “Not you?” uses the same ownership-checked cancel route, then permits a deliberate new selection.
- Device tokens do not cross sessions and are not browser fingerprints.

## Validation and abuse controls

Named Worker limits enforce:

- 64 KiB organizer session body and 2 KiB public write body.
- 250 roster entries and 350 total check-in records.
- 1–12 hour expiry, with a 6-hour default.
- 60-character normalized unknown names with control characters and angle brackets removed.
- Strict JSON content type, object fields, public ID formats, roster membership, methods, paths, and same-origin public writes.
- One deterministic active known-player record per session.
- One active device mapping at a time.
- Known attempts: 30 per device, 60 per hashed IP, and 300 per session per five minutes.
- Unknown attempts: 5 per device, 10 per hashed IP, and 30 per session per ten minutes.

Rate keys store only session-scoped hashes, not full IP addresses. Known idempotent retries return before rate counters are touched.

KV counter increments are bounded but not globally atomic. A coordinated burst at multiple Cloudflare locations could temporarily exceed a limit. Distinct check-in record keys still prevent dropped check-ins; a Durable Object or Cloudflare Rate Limiting binding is the recommended future hardening if deployment infrastructure is added.

## Organizer workflow and offline merge

The Teams attendance picker keeps one canonical `window._pool` selected-ID set.

- Opening a session sends an allowlisted roster input through the authenticated organizer API.
- An existing active room session is resumed instead of silently replaced.
- The compact row shows open/closed state, counts, exact local expiry, and Live/Reconnecting/Offline state.
- Share controls provide the public link, native share, copy fallback, local QR SVG, short code, and a printable QR window.
- Organizer updates use 15-second polling with bounded exponential reconnect backoff because the current Worker has no Durable Object WebSocket host. Polling pauses whenever the organizer sheet is closed or the document is hidden, and only one timer/request may be active.
- Normal public and organizer check-in routes resolve deterministic session, record-directory, and check-in keys with KV `get()`. KV `list()` is prohibited in frequently polled routes because Cloudflare counts every namespace enumeration against the much smaller free-tier LIST allowance. It is reserved for the one-time compatibility migration of a session created before record directories were introduced.
- Active known and organizer-matched entries merge additively into `_pool`; manual additions are never replaced.
- Removing a checked-in player from attendance adds their ID to a local session suppression set. Polling does not re-add them. The review row separately offers “Attendance only” or “Remove check-in.”
- Clear records the suppression set in the existing Undo payload, so Clear remains stable and Undo restores both attendance and suppression state.
- Check-in arrival, close, expiry, matching, and cancellation never call `saveAttendanceSnapshot`. Normal team generation remains the snapshot boundary.
- If the service is offline, search, manual selection, Same as Last Time, crews, Clear/Undo, and team generation remain local and usable. On reconnect the current server list merges additively.

## Unknown-player review

Free text creates a pending check-in only. The organizer can:

- search the private roster by names and aliases, then explicitly match;
- open the existing Add Player editor and match after a successful save;
- dismiss the entry; or
- leave it pending.

Matching and creation add the resolved stable player ID to provisional attendance without creating a game, rating record, or attendance snapshot. Public responses never include the resolved private player ID.

## Photo decision

Check-in enables only an existing normalized photo whose `public` flag is true. That flag currently means the private R2 object metadata is rewritten to `public=1`; only then does `GET /media/player-photos/:opaqueToken` serve bytes without room authentication. The token is 256-bit and object metadata is not returned. Turning the flag off immediately makes the media route return 404, and deleting the R2 object removes access.

The check-in snapshot receives only the root-relative public media URL. Private photo tokens are omitted. If R2 is unavailable, revoked, or offline, the lightweight player page removes the failed image and names remain sufficient.

## Static group URLs

Static group aliases are deferred. Court has a shared room bearer code but no stable account/group record, ownership registry, or safe global alias-management namespace. Treating a human alias as identity would make hijacking and multi-device conflict handling fragile. Short codes and opaque session links provide the complete check-in flow without weakening the trust boundary.

## Local development and verification

```sh
npm ci
npm run dev
node --input-type=module --check < cloudflare/court-sync-worker.js
npm run test:worker
npm run test:version-check
npm run check:version
npx playwright test tests/player-check-in.spec.js --project=chromium
npm test
```

The browser tests mock or locally proxy the Worker. They do not access production bindings.

## Binding and deployment order

1. Create a KV namespace dedicated to ephemeral player check-in.
2. Add it to the existing `court-sync` Worker with variable name `CHECK_IN_SESSIONS`.
3. Keep `COURT`, `PUBLIC_SCHEDULES`, and `PLAYER_PHOTOS` unchanged.
4. Deploy the Worker first.
5. Verify `GET /api/check-in/status` from an approved origin returns `{"available":true}`.
6. Re-test legacy sync, public schedules, and photos.
7. Deploy `index.html` through the existing GitHub Pages `master` root flow.

The repository has no production `wrangler.jsonc`; `cloudflare/wrangler.example.jsonc` must be copied and populated with the existing production resource IDs. After binding verification, the Worker deployment command is:

```sh
cd cloudflare
npx wrangler deploy --config wrangler.jsonc
```

Do not deploy the frontend before the Worker and binding are ready. An older/missing Worker does not block manual attendance, but public check-in controls will report unavailable.

## Production and real-device checklist

Before production use, repeat the disposable-room tests in `TEST_PLAN.md`, then validate on a real iPhone:

Organizer:

1. Open the installed Court app and Teams.
2. Open player check-in, display the QR, and share the link through Messages.
3. Confirm the sheet and sticky attendance footer do not jump or cover the home indicator.
4. Watch a check-in arrive, manually add another player, and confirm both remain.
5. Close the session and confirm attendance remains selected.

Player:

1. Open the shared link in Safari.
2. Search, confirm, reload, and verify returning-player state.
3. Add the public page to the Home Screen if desired.
4. Cancel and submit a pending unknown name.
5. Confirm no private roster fields are visible.
