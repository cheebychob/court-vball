# Player photos with private Cloudflare R2

Court supports optional player photos without storing image bytes in the app, room JSON, browser storage, public-schedule storage, or backups. The browser prepares a small square image and the existing Court Worker stores it in a private R2 bucket through authenticated, room-scoped routes.

## Existing behavior map (before this feature)

- Player creation and editing use `openPlayer`, `renderPlayerSheet`, `captureInputs`, and `savePlayer`. New players receive their permanent `makePlayer` ID when saved. Editing applies draft identity/seed/role fields to the existing record, then `commit` replays ratings and persists players and games.
- Player normalization/import uses `load` or `restoreBackupData`, followed by `migratePlayers`. Remote room data follows `Sync.applyRemote`, then the same migration. `migratePlayers` fills legacy lifetime, role, history, active, archived, and tracked-game fields.
- Local persistence uses `savePlayers`, `saveGames`, `saveEvents`, `saveSettings`, and `commit`. `Sync.payload` serializes those same records into the legacy room payload; `Sync.touch` schedules the existing push. No separate photo sync engine is introduced.
- `deletePlayer` calls `playerHasHistoricalReferences`. Referenced players are archived and retained; unreferenced players are tombstoned with `Sync.markDeleted` and permanently removed. `clearPlayerRuntimeState` only clears current UI/session references.
- Player identity is rendered by `playerCard`, `openPlayerCard`, generated-team markup in `renderTeams`, event/team roster renderers, and the schedule/public export model functions (`deriveFullScheduleExportModel`, `participantEntryData`, `participantTeamData`, `deriveParticipantScheduleExportModel`, `scheduleExportBodyHtml`, and `participantScheduleBodyHtml`). Dense historical rows and selection chips intentionally remain text-only.
- Public event HTML is built by `renderPublicEventDocument`; participant schedule HTML is built by `renderScheduleDocument`; results use `renderResultsDocument`. Public documents are uploaded unchanged through `SchedulePublications`. The Worker serves them with `PUBLIC_HEADERS`, including `default-src 'none'`, the existing script hash, and the pre-feature `img-src data:` directive.
- Worker routing in `cloudflare/court-sync-worker.js` recognizes public-schedule APIs/assets/pages before the legacy root sync handler. Private APIs use `PRIVATE_ORIGINS`, `originAllowed`, and reflected allowlisted CORS headers. Root `GET`/`POST` retains wildcard legacy CORS and the exact `room:<plaintext room>` KV contract.

The photo implementation extends these paths rather than adding parallel persistence or rendering systems. The principal additions are photo metadata normalization, the in-memory `PlayerPhotos` loader/uploader, avatar helpers, photo controls inside the existing player sheet, public-photo fields in existing export models, and Worker photo route handlers before legacy routing.

## Architecture and privacy

- R2 binding name: `PLAYER_PHOTOS`.
- R2 object keys are `player-photos/<opaque 256-bit URL-safe token>`. Names, room codes, event names, and other user text never enter keys.
- R2 custom metadata contains only the SHA-256 room hash, validated permanent player ID, public flag, width, and height. The plaintext room code is never R2 metadata.
- Player records contain only normalized photo metadata: token, revision, content type, dimensions, byte count, public flag, and update time.
- Private photos are fetched by the app through `/api/player-photos/<token>` with `X-Court-Room`, converted to temporary object URLs, and cached only in memory.
- Shared pages receive a relative `/media/player-photos/<token>?v=<revision>` URL only after the player explicitly opts in. Private photo tokens are omitted from shared markup.
- Initials remain the universal fallback. Missing R2 objects, a restored token from another room, offline use, or an unavailable binding never blocks Court data or rating behavior.

## Worker routes

- `GET /api/player-photos/status` reports whether the private R2 binding supports the required methods.
- `PUT /api/player-photos/:playerId` accepts a bounded JPEG/WebP binary body, validates its signature and dimensions, then creates or safely replaces the player's exact object.
- `GET /api/player-photos/:photoToken` streams a room-authorized private image.
- `PATCH /api/player-photos/:photoToken` changes only the explicit public flag by atomically rewriting the validated small object.
- `DELETE /api/player-photos/:photoToken` deletes only an exact, ownership-verified token and is idempotent when the object is already absent.
- `GET` or `HEAD /media/player-photos/:photoToken` serves only opted-in objects and returns 404 for invalid, absent, private, or unauthorized tokens.

All private routes use the existing approved-origin allowlist, require `X-Court-Room`, confirm that the room exists in `COURT`, and compare its SHA-256 hash with R2 metadata. The media route never accepts writes or exposes custom metadata. These routes are ordered before the unchanged legacy root sync handler.

## Cloudflare dashboard setup

1. Create an R2 bucket for Court player photos.
2. Leave both the bucket's `r2.dev` public URL and custom-domain public access **disabled**. The bucket must remain private.
3. Open the existing Court Worker's settings, add an R2 bucket binding named exactly `PLAYER_PHOTOS`, and select the private bucket.
4. Keep the existing `COURT` and `PUBLIC_SCHEDULES` bindings and routes unchanged.

No S3 credentials belong in Court. Do not add browser credentials or direct-to-R2 upload permissions.

## Deployment order

1. Create the private bucket and `PLAYER_PHOTOS` binding.
2. Deploy the updated `cloudflare/court-sync-worker.js`.
3. Confirm `GET /api/player-photos/status` returns `{ "available": true }` from an approved Court origin.
4. Deploy the updated `index.html`.
5. Run the manual checks below in a non-production/test room before broad use.

The app remains usable if steps 1–2 are delayed: photo controls explain that storage is unavailable, while all existing features continue normally.

## Manual smoke-test checklist

- Connect two devices to the same successfully synced Court room.
- Add a player without a photo and verify the old flow and initials still work.
- Add a JPEG or WebP photo, reposition/zoom the square crop, save, and verify it appears on both devices.
- Replace the photo and verify the old image remains until the upload succeeds, then both devices show the new revision.
- Simulate offline/R2 failure and verify player edits, games, ratings, events, sync, and backups still work.
- Toggle “Show this photo on shared pages” on, update a public schedule, and verify its relative media URL loads.
- Toggle the option off and verify the public media URL immediately returns 404 and newly generated HTML omits the token.
- Remove the photo, verify initials return, and confirm rating/history/records are unchanged.
- Archive and restore a player and verify their photo metadata remains.
- Check a phone-sized viewport: crop controls, Save, and Cancel must not overlap or overflow horizontally.

## Backup and restore

JSON backups naturally include valid photo metadata but never image bytes, Base64, blobs, object URLs, room hashes, or R2 keys. Older backups without photo metadata restore normally. Malformed metadata is dropped during migration.

Restoring into another sync room does **not** copy R2 image binaries. A token owned by another room is inaccessible and displays initials. Restore never deletes R2 objects.

## Rollback and cleanup

To roll back the UI, deploy the prior `index.html`; existing metadata is ignored by older builds and image objects remain private. To roll back the Worker, deploy the prior Worker only after accepting that photo controls will report the service unavailable. Do not make the bucket public as a rollback workaround.

Removing the `PLAYER_PHOTOS` binding stops photo access but leaves legacy sync and public schedules working. The Worker never lists or bulk-deletes objects. Normal cleanup happens only through explicit photo removal or a genuine permanent unreferenced-player deletion; archived-player photos remain by design. Orphan cleanup, if ever required, must be an administrator-controlled bucket-retention process, not a user-token prefix deletion route.

## Troubleshooting

- **Status says storage unavailable:** verify the Worker has an R2 binding named exactly `PLAYER_PHOTOS` with `head`, `get`, `put`, and `delete` support, then redeploy.
- **Offline or request failed:** keep working normally and retry the photo action later. Court does not queue binary images into room sync.
- **Unsupported HEIC/HEIF or decode failure:** export/choose a JPEG or WebP the browser can decode. Court never uploads an undecoded original.
- **Photo returns 404:** private/public ownership rules deliberately use 404 for missing, private, malformed, or cross-room tokens. Confirm the device uses the owning room; for public pages, confirm the per-player public option is on and republish stale HTML.
- **Upload rejected:** use JPEG/WebP, crop to at most 512×512, and ensure the processed file is below 750 KB. The Worker checks the actual file signature in addition to `Content-Type`.
