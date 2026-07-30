# Event pools and court eligibility

## Data model

Fixed teams store the normalized pool label on `event.teams[].pool`. Rotating
Groups store the same label on `event.entries[].pool`. An empty label means the
participant is unassigned; when at least one labeled pool exists, empty labels
form a visible `No pool` scheduling group.

Both schedule settings objects may store:

```js
poolCourtAssignments: {
  enabled: true,
  courts: {
    "1": "A",
    "2": "*",
    "3": "__NO_POOL__"
  }
}
```

Court keys are stable one-based physical court numbers. `*` means shared by
every scheduling group. `__NO_POOL__` is the private storage key for the
visible `No pool` group and is intentionally distinct from `*`. Display style
(`num` or `letter`) never changes these identifiers.

Missing settings preserve the historical behavior: one open group when there
are no pools and every configured court shared. Restore/migration normalizes
pool labels, removes unknown or out-of-range owners, and makes newly added
courts shared.

## Scheduling flow

`eventPoolParticipants`, `eventSchedulingGroups`,
`normalizePoolCourtAssignments`, `poolCourtAssignmentsFor`, and
`eligibleCourtsForPool` are the shared model boundary in `index.html`.
Fixed and rotating schedule generation both consume those helpers.

For Rotating Groups, `generateRotationScheduleCandidate` allocates real
physical courts to pools for each round before running the existing teammate,
opponent, side, seed, and court-quality search inside each pool. Shared-court
allocation uses prior progress plus deterministic seed hashing so label order
does not starve a pool. Makeup planning is also pool-scoped.

For Fixed Teams, both the standard/legacy packing path and makeup placement
filter candidate courts through the same eligibility model. Capacity previews
report eligible courts per group rather than the event-wide court total.

Hard invariants are:

- Generated pool matches never cross pools.
- A participant and a physical court appear at most once per time slot.
- Dedicated courts serve only their owner; shared courts may serve any group.
- Makeup matches remain in their pool and use an eligible court.
- An undersized group or a group with no eligible court fails with a specific
  group-level error.

## Results, regeneration, and ratings

Pool edits change only participant labels and future schedule grouping.
Existing game records are never rewritten, and rating replay does not read pool
or court-assignment metadata.

Regeneration locks every standard match through the last started round. Played
and organizer-created custom matches remain preserved even if new rules make
them cross-pool or court-ineligible; the schedule audit identifies those as
protected legacy exceptions. Only unplayed future generated matches are rebuilt
under the new constraints.

Rotating standings are grouped by pool with visible ranks restarting at 1.
Pooled playoff order is pool rank first, then the configured standings
tiebreakers and deterministic label/name/ID fallbacks.

## Projection and worker boundary

Pool labels and court assignments flow through backup/restore, sync, public and
participant schedule models, score-report sessions, print/export models, rules
snapshots, and EventStaff snapshots. Cross-pool custom matches are explicit and
retain a `crossPool` marker.

The Cloudflare worker sanitizes entry pools, match pool/cross-pool fields, and
one-based assignment maps. Tournament Operators retain their existing entry
and schedule permissions for these controls. View Only and Scorekeeper grants
receive no new mutation permission. Worker-generated schedules and movable
match placements use the same pool eligibility rules.

The dependency-free shared scheduling implementation in
`event-structure-core.js` mirrors the browser invariants for worker generation.

