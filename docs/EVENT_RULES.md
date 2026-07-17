# Event Rules Hub

Court stores rules inside each event. The model is independent of fixed-team versus rotating-group scheduling and is included anywhere the event record is included: local persistence, sync, backups, restore, duplication, completion/archival, and deletion.

## Data model

`event.rules` uses schema version 1:

- `draft`: the current private working copy, or `null`. It contains a schema-backed document, Quick Rules, Build Your Rules answers, timestamps, and the revision on which it was based.
- `draftDeletedAt`: a deletion timestamp that prevents another device from resurrecting an intentionally deleted draft.
- `publishedRevisionId`: the current public revision, or `null` when rules are unpublished.
- `revisions`: immutable published snapshots. Each has a stable ID and number, full document, Quick Rules, publication timestamp, optional author, change summary, after-start flag, event-settings snapshot, and schema version.
- `settingsAcknowledgements`: intentional-exception or review-later decisions for structured setting mismatches. The acknowledgement includes the mismatch fingerprint so a later setting or rule change is reviewed again.
- `unpublishedAt` and `publicationUpdatedAt`: deterministic publication-state timestamps.
- `conflicts`: detected revision-ID/content conflicts. Conflicting histories are not silently discarded.

Old events without `rules` use a non-mutating empty default. Malformed supported data is normalized. A future schema version is preserved unchanged and shown read-only instead of being downgraded.

## Document and sanitization policy

Rules do not persist unrestricted browser HTML. The version 1 document is an ordered list of sanitized semantic blocks. Supported content is limited to:

- level-two and level-three headings;
- paragraphs, bold, italic, and line breaks;
- bulleted and numbered lists;
- safe `http`, `https`, `mailto`, `tel`, and same-document links;
- horizontal dividers;
- allowlisted callouts (`important`, `format-exception`, `weather`, `penalty`, and `updated-rule`);
- simple tables.

Scripts, event-handler attributes, JavaScript URLs, styles, media, SVG/MathML, frames, forms, inputs, objects, and embeds are removed. Links receive `noopener noreferrer`. Sanitization runs when editor/paste content is ingested, when stored/imported data is normalized, and immediately before organizer or public rendering.

The editor uses the browser editing surface only as a temporary UI. Saving converts its contents into the internal document schema. Undo and redo are browser-session operations and are not persisted as document history.

## Revision and publishing behavior

Editing published rules creates a private draft. Publishing runs the non-blocking completeness and structured-contradiction review, shows a preview, and creates a new immutable revision. Publishing after the stored event start requires an explanation. Court derives the start from the event date plus the fixed or rotating schedule start time; when the time is missing, local midnight on the stored event date is the conservative fallback. Older events first receive the existing date migration fallback.

Unpublishing clears only the current-public pointer and preserves the complete audit trail. Copying or “restoring” an older revision creates a new draft; publishing it creates another revision rather than rewriting history.

## Public route behavior

Rules reuse the existing full-event publication token in `event.schedulePublications.full`. The stable Worker URL remains `/s/:token`; a direct Rules link appends `#rules`. Updating rules replaces the opaque public HTML at the same token. Updating the full schedule after rules exist also renders the unified event document, preventing a schedule update from dropping rules.

The unified public document contains Overview, Schedule, Standings, Bracket, and Rules navigation. It exposes only the current published revision and public revision history—never drafts, acknowledgements, sync state, management tokens, internal notes, ratings, or private IDs. Its fixed search behavior is embedded so a saved standalone copy keeps working without Court, local storage, or the Worker. The Worker Content Security Policy allows only the exact script hash; `/assets/public-event.js` remains available for already-published older documents.

Standalone rendering omits the hosted header’s Print and Share controls, since those controls cannot be guaranteed under `file://`. The hosted public renderer retains them, while both modes retain the print stylesheet and complete five-section event layout.

Public publishing still requires Court Sync because the existing Worker uses a successful sync room as publication authorization. A locally published revision remains saved if the network is unavailable; the organizer can create or refresh the public link later.

## Sync merge rules

- Event scalar fields retain the existing newer-remote preference.
- Known Rules fields are merged even when the other event record came from an older client without a `rules` field.
- Revisions are unioned by stable ID and sorted deterministically.
- The same revision ID with different canonical content records a conflict. Both immutable bodies are retained under deterministic IDs, the public pointer is mapped to the matching body, and the organizer sees a Needs review warning.
- Draft versus draft-deletion uses the newest timestamp.
- Publication state uses publication/unpublication timestamps and the newest valid published revision.
- Setting acknowledgements use the newest acknowledgement timestamp.
- Event and nested tombstones continue to run before the rules-aware event merge.

The sync payload version remains compatible with older rooms because Rules live inside the already-opaque event record.

## Backup, restore, duplication, and deletion

Backups already serialize complete event records, so drafts, revisions, acknowledgements, and publication metadata are included without a parallel export path. Restoring a published revision preserves state but does not itself call the public Worker. Restoring a legacy backup produces the safe empty default without inventing history.

Duplicating an event creates new event/nested IDs, removes public tokens and URLs, clears published history on the copy, and creates a private draft from the source draft or current published revision. Event name, date, and venue references are marked for review. Deleting the event uses the existing event tombstone; historical games remain detached and keep their rating impact.

## Known limitations

- Court detects contradictions only for structured Quick Rules that correspond to real Court settings. It deliberately does not guess whether arbitrary prose contradicts a schedule.
- Fixed-team match score targets, coed composition, ball-handling rules, and many operational policies are not Court behavior settings today; they remain written rules rather than hidden configuration.
- Public revision bodies are included in the self-contained public document instead of lazy-loaded because the current Worker stores one opaque HTML artifact.
- The app does not add live weather, an AI assistant, arbitrary fonts/colors, or collaborative cursor-level rich-text merging.

## Future live-weather integration

The permanent builder key is `weather`, and generated documents use the “Weather and safety policy” heading. A future weather card should link to the published weather-policy heading anchor and must not change the rules schema or write live observations into immutable revisions.
