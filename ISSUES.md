# Court Issue Backlog

## P0 - Data integrity

### 1. Hard-deleting players can distort historical ratings
Old games keep deleted player IDs, but recompute ignores players that no longer exist. This can change old game averages, event averages, win probabilities, and rating movement for everyone else.

Recommended fix:
- Replace hard-delete with archive/soft-delete for players who have game history.
- Keep deleted/archived players available to historical recompute.
- Hide archived players from normal roster/team selection unless requested.

### 2. Older backup migration may leave players inactive
The load migration fills some missing fields but does not force active=true when active is undefined. Track and Teams use players.filter(p => p.active), so old imported players may disappear.

Recommended fix:
- During migration, set active=true when active is undefined.

### 3. Inactive players can remain in the generated team pool
The Teams screen displays active players, but the generated pool can still include IDs left in window._pool from before a player was marked inactive.

Recommended fix:
- In genTeams(), filter by both p.active and window._pool.has(p.id).

## P1 - Rating behavior clarity

### 4. Tied games are saved but ignored by recompute
If a game is saved with tied scores, winner=null. recomputeAll only applies games with a winner or solo=true. That means tied games do not count for rating, games played, lifetime events, or history.

Recommended fix:
Choose one:
- Do not allow tied games to be saved.
- Save tied games as notes/history only and clearly say they do not affect stats.
- Allow event-only rating movement for tied games.

### 5. Editing seed rating rewrites rating history
Changing a player's seedRating causes all historical games to replay from the new seed. This is mathematically consistent but can surprise users.

Recommended fix:
- Add a warning when changing seed for an existing player.
- Consider a separate manual adjustment feature for current rating corrections.

### 6. Derived game fields are stored in game records
Games store derived fields like deltas, winProb, and predCorrect after recompute. This is convenient, but backups include calculated state.

Recommended fix:
- Decide whether game records should store only raw inputs, with derived data rebuilt on load.
- If keeping derived data, document it.

## P2 - Cleanup and UX

### 7. teamSize exists but is unused
DEFAULT_SETTINGS includes teamSize, but team generation does not appear to use it.

Recommended fix:
- Remove it if not needed.
- Or add a future team-size feature intentionally.

### 8. Deleted players show poorly in old game history
Deleted players appear as missing/removed because their names are gone.

Recommended fix:
- Preserve historical display names in game records.
- Or archive players instead of deleting them.

### 9. Need more automated browser tests
The app has a built-in self-test, but we should add external Playwright tests for real browser behavior.

Recommended tests:
- App boots
- Built-in self-test passes
- Add player works
- Player persists after reload
- Generate teams works
- Track game works
- Delete/archive behavior preserves historical recompute
- Import/export round trip works
