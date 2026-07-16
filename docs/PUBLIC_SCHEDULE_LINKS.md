# Public schedule links

## Production facts

- App URL: `https://cheebychob.github.io/court-vball/`
- Browser origin allowed to use the private publication API: `https://cheebychob.github.io`
- Cloudflare Worker: `court-sync`
- Private binding: `COURT` → `court-data`
- Public binding: `PUBLIC_SCHEDULES` → `court-public-schedules`
- GitHub Pages source remains `master` from `/(root)`.

The Worker URL is not duplicated in Court. Publication requests reuse the server URL already configured under **Settings → Sync across devices**.

## Architecture and privacy boundary

Court continues to derive schedule data locally with `deriveFullScheduleExportModel` or `deriveParticipantScheduleExportModel`, then creates the self-contained document with `renderScheduleDocument`. Download, native HTML-file sharing, printing, and public publishing all use that same renderer. The Worker does not contain schedule markup or reconstruct a schedule from event data.

Publishing is a snapshot operation:

1. Court derives the selected full, team, or rotating-entry export model.
2. Court renders the exact standalone HTML used by the existing download feature.
3. Court calculates a SHA-256 hash of that exact HTML.
4. Court sends only `html`, `title`, `contentHash`, and `scope` to the Worker.
5. The Worker stores the document in `PUBLIC_SCHEDULES` and returns a public token, a one-time raw management token, the public URL, and server timestamps.
6. Court stores only publication-management metadata under the event’s `schedulePublications` property. That metadata follows normal event save, backup, import, and device-sync behavior.

The publication request never includes a complete event, arrays of players or games, ratings, seed ratings, rating history, notes, settings, backups, deletions, tombstones, unrelated events, or the room code in JSON. Participant names may appear only because they are already part of the selected schedule document.

Private synchronized state and public documents remain separated:

| Binding | Purpose | Key format |
| --- | --- | --- |
| `COURT` | Existing private device-sync envelopes | `room:{roomCode}` |
| `PUBLIC_SCHEDULES` | Rendered public schedule documents and their management metadata | `schedule:{publicToken}` |

Public schedule reads never access `COURT`. Legacy sync never accesses `PUBLIC_SCHEDULES`.

## Existing sync compatibility

The legacy sync contract is unchanged:

- `GET /?room={roomCode}` reads the raw value from `COURT` at `room:{roomCode}` and returns `{"ts":0,"data":null}` when absent.
- `POST /?room={roomCode}` writes the raw request body to the same key and returns `{"ok":true}`.
- An ordinary legacy request without `room` returns the existing `{"ok":false,"error":"missing room"}` response.
- Legacy routes retain wildcard CORS and the existing sync payload, deletion registry, and tombstone behavior.

The room code remains the existing private bearer secret. This feature does not redesign device-sync security.

## Route ordering and API

The Worker handles routes in this order so new routes cannot fall through to the legacy missing-room check:

1. Route-specific `OPTIONS`
2. `GET /api/public-schedules/status`
3. `POST /api/public-schedules`
4. `PUT /api/public-schedules/{publicToken}`
5. `DELETE /api/public-schedules/{publicToken}`
6. `GET /s/{publicToken}`
7. Legacy `GET` and `POST` at `/?room=...`
8. `404` or `405`

### Capability status

`GET /api/public-schedules/status` requires no room code. It returns `{"available":true}` when `PUBLIC_SCHEDULES` is bound. A missing binding returns HTTP 503 with `{"available":false,"error":"public schedule storage unavailable"}` without exposing private configuration.

Court uses this endpoint to distinguish an offline/network failure, an older Worker that still applies the legacy missing-room behavior, a missing public binding, and a ready service.

### Create

`POST /api/public-schedules` requires:

- `Content-Type: application/json`
- `X-Court-Room: {roomCode}`
- Body fields: `html`, `title`, `contentHash`, and `scope`

The Worker verifies that `COURT` contains `room:{roomCode}` before creating a publication. The room code is used only from the request header and is not placed in the request JSON, public URL, public HTML, public KV record, response, or errors.

### Update

`PUT /api/public-schedules/{publicToken}` requires:

- `Content-Type: application/json`
- `X-Management-Token: {managementToken}`
- Body fields: `html`, `title`, and `contentHash`

An update replaces the stored document and hash while preserving the public token, URL, management-token hash, and original creation timestamp.

### Disable

`DELETE /api/public-schedules/{publicToken}` requires `X-Management-Token`. The Worker retains the KV record and sets `disabledAt` and `updatedAt`. A disabled public URL returns HTTP 410 with a participant-friendly message and never returns the old schedule HTML. A disabled Court publication can be replaced by creating a new link, which receives new tokens and a new URL.

### Public read

`GET /s/{publicToken}` requires no authentication and reads only `schedule:{publicToken}` from `PUBLIC_SCHEDULES`. Active records return the exact stored HTML with:

- `Content-Type: text/html; charset=utf-8`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: public, max-age=60`
- `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Missing records return 404. Disabled retained records return 410.

## Authorization, tokens, and validation

Creation is authorized by the configured room code only after the corresponding private room exists. Updates and deletes are authorized only by that publication’s management token; a room code cannot substitute for it.

On creation the Worker uses Web Crypto to generate separate 256-bit public and management tokens, encoded with base64url. It stores only the SHA-256 hash of the management token. The raw management token is returned once, then retained only in Court’s private event metadata so another organizer device can manage the link after normal device sync.

The content hash is SHA-256 of the exact rendered HTML and is used for deterministic stale-state detection, not authorization. The Worker verifies that the supplied hash matches the supplied document.

The Worker rejects malformed JSON, unsupported fields, non-HTML payloads, invalid tokens/scopes/hashes, wrong content types, unsupported methods, and documents over 10 MiB. Ten MiB leaves substantial room below Cloudflare KV’s per-value limit while supporting large tournament schedules.

## KV record format

`PUBLIC_SCHEDULES` stores JSON at `schedule:{publicToken}`:

```json
{
  "html": "<!DOCTYPE html>...",
  "title": "Event name · Court schedule",
  "contentHash": "<sha-256 hex>",
  "scope": "full",
  "managementTokenHash": "<sha-256 hex>",
  "createdAt": 1721147520000,
  "updatedAt": 1721147520000,
  "disabledAt": null
}
```

This record does not contain the room code, raw management token, complete event, player/game arrays, ratings, settings, notes, sync envelopes, backups, or deletion data.

## Court publication metadata

Court stores one event-root map keyed independently by scope:

```json
{
  "schedulePublications": {
    "full": {
      "scope": "full",
      "publicToken": "<public token>",
      "publicUrl": "https://<worker-origin>/s/<public token>",
      "managementToken": "<private management token>",
      "contentHash": "<sha-256 hex>",
      "createdAt": 1721147520000,
      "updatedAt": 1721147520000,
      "disabledAt": null,
      "status": "active",
      "subjectType": "full",
      "subjectId": null,
      "title": "Event name · Court schedule"
    }
  }
}
```

Supported keys are `full`, `team:{teamId}`, and `entry:{entryId}`. A rotating one-person entry uses the existing participant renderer and remains keyed by its entry ID. Each scope has independent tokens, timestamps, hash, state, and management permission.

Rendered HTML is never stored in this event property or normal sync payload. Older events without `schedulePublications` continue to load unchanged.

## Stale-state and concurrency behavior

Publishing is explicit. Editing an event does not update its public snapshot. Each time the share sheet opens, Court hashes the current output of `renderScheduleDocument` for the selected scope:

- Active with the same hash: **Up to date**
- Active with a different hash: **Schedule changed since publication**
- Disabled: the old URL is no longer presented as active
- Missing server record: Court preserves identifying metadata, explains the missing record, and offers a new link

**Update Published Link** replaces the document at the same URL. **Disable Link** requires confirmation and does not affect downloaded HTML or PDFs.

Async responses use operation IDs and compare the current scope metadata with the metadata present when the request began. When a response arrives, Court re-finds the event by ID and merges only that scope. A delayed response is discarded if a newer local or synced publication has already replaced it. Failed requests do not erase the last successful publication metadata.

## CORS

Legacy sync routes retain `Access-Control-Allow-Origin: *`.

The capability and private publication-management API reflect only these approved browser origins and include `Vary: Origin`:

- `https://cheebychob.github.io`
- `http://localhost:8000`
- `http://127.0.0.1:8000`
- `http://localhost:3000`
- `http://127.0.0.1:3000`
- The repository’s Vite development origins: `http://localhost:5173` and `http://127.0.0.1:5173`

Origins never include `/court-vball/`; an origin consists only of scheme, host, and optional port. Private preflight permits `Content-Type`, `X-Court-Room`, and `X-Management-Token`, with `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS` as needed by status and management routes. Public browser navigation at `/s/{token}` does not depend on private API CORS.

## Local testing

From the repository root:

```sh
node --input-type=module --check < cloudflare/court-sync-worker.js
npm run test:worker
npm run test:version-check
npm run check:version
npm test
```

`npm run verify` runs the Worker tests, version checks, and Playwright suite. The Playwright tests mock the Worker and KV lifecycle; they do not change live Cloudflare or GitHub Pages state.

For manual local UI testing, run `npm run dev`, configure the existing Worker URL and a non-production test room in Settings, then verify full and participant share sheets at a narrow phone viewport. Do not use production secrets in fixtures, screenshots, documentation, or logs.

## Manual Cloudflare dashboard deployment

The Worker is deployed manually. Deployment is not performed by repository tests or by changing this file.

1. Save a copy of the current live Worker code.
2. Review the local `cloudflare/court-sync-worker.js` diff.
3. Open Cloudflare Workers & Pages.
4. Open `court-sync`.
5. Confirm both bindings:
   - `COURT` → `court-data`
   - `PUBLIC_SCHEDULES` → `court-public-schedules`
6. Click **Edit code**.
7. Replace the live source with the reviewed local source.
8. Deploy.
9. Test the existing legacy sync route first.
10. Test `/api/public-schedules/status`.
11. Publish one schedule.
12. Open the public link in an incognito/private browser.
13. Update the same link.
14. Disable it.
15. Roll back using the saved old Worker source immediately if private sync fails.

## Post-deployment validation

1. Use a disposable test room that has completed one successful device sync.
2. POST and GET an ordinary legacy sync envelope and confirm the raw payload and response shapes are unchanged.
3. Open `https://<worker-domain>/api/public-schedules/status` and confirm `{"available":true}`.
4. In Court, publish a full fixed-event schedule and confirm the browser URL opens without organizer credentials.
5. Compare the public document with the downloaded HTML for title, timing, rounds, courts, byes, matchups, makeup/custom matches, responsive layout, and print output.
6. Change a rendered schedule field, confirm Court reports it stale, update it, and confirm the same URL shows the new snapshot after cache revalidation.
7. Publish a team or rotating-entry schedule and confirm it contains only that participant-facing document while the full link remains unchanged.
8. Capture the create request and confirm its JSON has only `html`, `title`, `contentHash`, and `scope`; confirm the room code appears only in `X-Court-Room`.
9. Disable one participant link and confirm it returns 410 while other scopes remain active.
10. Confirm download, native HTML-file sharing, and Print / Save as PDF still work offline.

## Troubleshooting

- **Set up device sync first:** configure the existing sync URL and room in Settings.
- **Device needs to successfully sync:** the Worker could not find the room in `COURT`; complete a sync, then retry.
- **Links are not available on the configured service yet:** the configured Worker is still running the old routes.
- **Public storage unavailable:** confirm the `PUBLIC_SCHEDULES` binding and KV namespace.
- **Offline:** confirm connectivity and the configured Worker URL. Existing download and print features do not require the Worker.
- **No longer permitted to manage the link:** the event metadata on this device does not contain the correct management token. Sync from a device that does; do not substitute the room code.
- **Public record missing or disabled:** create a new link. Updating a normal active publication should keep the existing URL.
- **Stale status after an unrelated edit:** inspect whether that edit changes the rendered standalone document. Only exact rendered HTML differences should change the hash.

## Rollback

If private sync regresses, immediately restore the saved pre-deployment Worker source in the Cloudflare dashboard and deploy it. That restores the legacy `?room=` behavior. The app’s local data, existing backup format, and rating history do not depend on public publication routes. Public records in `PUBLIC_SCHEDULES` can remain untouched during a Worker rollback; the old Worker will not access them.

After rollback, retest legacy `POST /?room=...` and `GET /?room=...` before resuming normal use. Court will report that public schedule links are unavailable on the older configured service while download and print remain usable.
