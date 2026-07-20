# Player profiles

## Pre-change implementation map

Court's player UI and schedule-photo behavior were implemented through these existing paths before the profile upgrade:

- `renderPlayers` builds the active, away, and archived roster collections. `playerCard` renders each roster button, including the cached private-photo avatar. Every normal card click called `openPlayer(playerId)`.
- Active and archived player cards therefore used the same direct edit path. Archived cards were selected through the Archived filter and also called `openPlayer(playerId)`.
- Add Player called `openPlayer()` without an ID. `openPlayer`, `renderPlayerSheet`, `captureInputs`, and `savePlayer` owned both add and edit state through `editId` and `draft`.
- The existing read-oriented player details were embedded below the edit controls in `renderPlayerSheet`: current rating/record, `insightCard`, `lifetimeStatsSection`, and `trendChart`. `openPlayerCard`, `profileCardData`, and `drawPlayerCard` provided the separate shareable canvas card.
- `savePlayer` copied the draft into an existing player or created a player with `makePlayer`, then called `commit`. `commit` called `recomputeAll`, `savePlayers`, and `saveGames`; the sync wrapper subsequently called `Sync.touch`.
- `cancelPlayerEdit` discarded the in-memory draft and closed the sheet. `playerEditorCloseGuard` also discarded the draft and pending photo state without comparing saved and draft values. The reusable rules editor demonstrates the app's existing `askConfirm` unsaved-change pattern.
- `normalizePlayerPhoto` validates the small metadata record. `playerAvatarHtml` reserves dimensions and writes private-photo hydration attributes. `PlayerPhotos.hydrate` calls `PlayerPhotos.getUrl`, whose cache and concurrent-request maps are keyed by `token|revision`.
- `PlayerPhotos.getUrl` performs the authenticated private Worker fetch, converts the response Blob with `URL.createObjectURL`, and reuses it. `PlayerPhotos.invalidate`, `prune`, `revokeEntry`, and the `beforeunload` handler revoke cached URLs. `cleanupPreparedPhoto` and `cleanupPhotoCrop` revoke upload/crop URLs.
- `choosePlayerPhoto`, `renderPlayerPhotoCrop`, `encodePlayerPhoto`, and `usePlayerPhotoCrop` own the file-selection and crop flow. Before this upgrade the avatar itself was not a photo-viewer button.
- `togglePlayerPhotoPublic` and `removePlayerPhoto` immediately called the Worker and persisted successful metadata changes, even before the rest of the player draft was saved.
- `deriveFullScheduleExportModel`, `publicPhotoItems`, `participantEntryData`, `participantTeamData`, and `deriveParticipantScheduleExportModel` build the full and team/entry schedule models. `scheduleExportBodyHtml` and `participantScheduleBodyHtml` render both preview and standalone markup; `renderPublicEventDocument` embeds the full schedule renderer.
- `scheduleExportPreviewHtml` injects preview HTML directly into the GitHub Pages app's `.sheet`; it does not use an iframe, `srcdoc`, Blob document, or canvas. `createScheduleHtmlFile` and `downloadScheduleFile` build and download standalone HTML. `SchedulePublications.prepare` hashes and publishes standalone HTML. `writeSchedulePrintWindow` writes the standalone document to a new window for print/PDF. There is no schedule image/canvas export; the only canvas exports are the separate player card and event-results image.
- Before the fix, `publicPlayerPhoto` generated `/media/player-photos/<encoded-token>?v=<encoded-revision>` for all schedule contexts. In the in-app preview that exact path resolved against `https://cheebychob.github.io`, producing a broken request such as `https://cheebychob.github.io/media/player-photos/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?v=revision-1`. On a published Worker page, the same root-relative path resolved against the Worker and succeeded. Downloaded `file://` HTML had the same missing-origin problem. The Worker media response also used `Cross-Origin-Resource-Policy: same-origin`, which was appropriate only for Worker-hosted documents and blocked the intended cross-origin public-media use.
- Rating, level, and history derive from the existing replay path (`recomputeAll`, `applyGame`, `applySolo`, `volleyballLevelOf`, player `history`, and per-game `deltas`). Roster ordering uses `sortPlayers`; profile rank must instead use the same rating-descending/name tie-break order explicitly, independent of the user's current display sort. Record totals come from the replayed player fields. Tracked totals come from `lifetime`, `PLAYER_STAT_GROUPS`, and `PLAYER_STAT_LABELS`. Recent games can be bounded from saved games that reference the player, including explicit ties without treating them as wins or losses.

## Behavior change and affected functions

Existing player taps now open a read-only `profile` mode in the same Court sheet. `Edit profile` transitions that sheet to `edit`; Add Player opens `add` directly. The existing editor controls, validation, seed-warning, crop/upload pipeline, archive protections, and save workflow remain authoritative. Cancel from a normal profile-to-edit transition restores the saved draft and returns to the profile. Closing a dirty editor uses `askConfirm`; viewing a profile or photo never persists or replays data.

The implementation extends the existing player helpers rather than introducing a parallel details modal:

- Player entry/mode state: `playerCard`, `openPlayer`, `renderPlayerSheet`, `captureInputs`, `cancelPlayerEdit`, `savePlayer`, the sheet close guard, and focus/scroll restoration.
- Profile derivation/presentation: `volleyballLevelOf`, `recentRatingTrend`, `trendChart` (through a profile-specific accessible renderer), `lifetimeStatsSection`, existing saved games and `g.deltas`, plus one bounded, non-mutating profile view model.
- Photo UI/lifecycle: `playerAvatarHtml`, `playerPhotoEditorHtml`, crop cleanup helpers, and `PlayerPhotos`; a reusable accessible viewer reuses `PlayerPhotos.getUrl` and never owns or revokes the cache URL.
- Public schedule photos: `publicPlayerPhoto`, `publicPhotoItems`, both schedule body renderers, `scheduleExportPreviewHtml`, `renderScheduleDocument`, `renderPublicEventDocument`, `createScheduleHtmlFile`, `SchedulePublications.prepare`, and print-window image settling.
- Public media headers: only `publicPhotoHeaders` and its Worker tests change. Private photo authorization/CORS, R2 ownership checks, sync routes, and publication CSP remain otherwise unchanged.

## Data and display policy

- The profile view model reads canonical replayed rating/record/history fields and saved games without writing them. It is bounded to recent rows and trend points.
- Ties may appear as `T` in recent form and as a separate record component, but remain excluded from the replayed wins, losses, games played, and rating movement.
- Active rank is shown only for a non-archived active player when at least two active players exist, and is hidden with ratings.
- Rating movement and charting use existing player history only. Too little history produces an intentional empty state.
- Tracked impact shows only non-zero categories already present in `PLAYER_STAT_LABELS`, with tracked-game coverage. No new statistic is inferred.
- Private profile images continue to use authenticated in-memory Blob URLs. Published Worker HTML uses a Worker-relative media path. GitHub Pages preview, downloaded HTML, and print/PDF HTML use an absolute URL based on the configured Worker. Downloaded public photos therefore require network access. Private and malformed photos always fall back to initials.
- Reduced-motion users receive the same content without transform-based sheet/viewer motion.

