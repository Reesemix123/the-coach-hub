# Testing Guide: Analytics & Reporting System

## Quick Start Testing Workflow

### 1. See Your Current Data
```bash
node scripts/show-ids.js
```
This shows:
- All your team IDs
- All game IDs
- Current count of tagged plays per team/game

### 2. Reset Tagging Data (Recommended for Testing)
```bash
# Reset all tagging data for a team
node scripts/reset-tagging-data.js [TEAM_ID]

# Reset only a specific game
node scripts/reset-tagging-data.js [TEAM_ID] [GAME_ID]
```

**What this does:**
- ✅ Deletes: play_instances, player_participation, drives
- ✅ Keeps: teams, players, games, videos, playbook

**Why this is best:** You can re-tag the same video multiple times to test each attribute flows correctly to analytics.

### 3. Tag Test Plays
Go to: `/teams/[teamId]/film/[gameId]`

**Incremental Testing Strategy:**
1. Tag 1 play with ONLY basic fields (down, distance, yards)
   - Check: Drive Analytics shows the play
   - Check: Overall stats update
2. Add QB stats (set qb_id)
   - Check: QB Stats Section appears
3. Add ball carrier (RB/WR)
   - Check: RB/WR Stats Section updates
4. Add OL blocking results
   - Check: OL Performance Section shows block win rates
5. Add defensive players (player_participation)
   - Check: DL/LB/DB Stats Sections populate
6. Add coverage tracking
   - Check: Coverage success rates calculate correctly

### 4. Verify Analytics
Go to: `/teams/[teamId]/analytics-reporting`

**Check each report type:**
- Offensive Report: QB, RB, WR/TE, OL sections
- Defensive Report: DL, LB, DB sections
- Drive Analytics: Drive efficiency metrics

## Testing Strategies

### Strategy A: Incremental Attribute Testing (Recommended)
**Best for:** Testing each data field → analytics flow

1. Reset data: `node scripts/reset-tagging-data.js [TEAM_ID] [GAME_ID]`
2. Tag 1 play with minimal data
3. Check analytics
4. Reset again
5. Tag same play with more attributes
6. Check analytics again
7. Repeat

**Pros:** See exactly what each field does
**Cons:** Repetitive

### Strategy B: Small Sample Testing
**Best for:** Testing calculations and formulas

1. Reset data
2. Tag 5-10 plays with varied scenarios:
   - 1st and 10 gain 4 yards (success)
   - 2nd and 6 gain 3 yards (success)
   - 3rd and 7 gain 5 yards (failure)
   - Explosive plays (10+ rushing, 15+ receiving)
   - Different players, positions
3. Verify calculations match expectations

**Pros:** Tests aggregation logic
**Cons:** More manual work upfront

### Strategy C: Full Game Simulation
**Best for:** End-to-end testing, performance testing

1. Tag a complete game (60+ plays)
2. Verify all sections populate
3. Check performance (page load times)
4. Test filters (game filter, date ranges)

**Pros:** Real-world usage test
**Cons:** Time-consuming, hard to debug specific issues

### Strategy D: Isolated Test Game
**Best for:** Testing while preserving production data

1. Create a "TEST - Game Name" in your schedule
2. Upload a short test video (or use existing)
3. Tag test plays there
4. Keep your real games untouched

**Pros:** Safe, no data loss
**Cons:** Need to create test game structure

## Common Test Cases

### Test Case 1: OL Block Win Rate
```
Setup:
- Tag 4 plays with OL assignments
- Play 1: All 5 OL = win
- Play 2: All 5 OL = win
- Play 3: LT = loss, others = win
- Play 4: LT = win, others = win

Expected:
- LT block win rate: 75% (3/4)
- Other positions: 100% (4/4)
```

### Test Case 2: QB Success Rate
```
Setup:
- Play 1: 1st & 10, gain 5 yards (success if >= 4)
- Play 2: 2nd & 6, gain 4 yards (success if >= 3.6)
- Play 3: 3rd & 7, gain 6 yards (failure, need 7+)

Expected:
- Success rate: 66.7% (2/3)
```

### Test Case 3: Explosive Plays
```
Setup:
- Play 1: Rush for 12 yards (explosive: 10+)
- Play 2: Rush for 8 yards (not explosive)
- Play 3: Reception for 18 yards (explosive: 15+)
- Play 4: Reception for 12 yards (not explosive)

Expected:
- Explosive rushes: 1
- Explosive receptions: 1
- Total explosive plays: 2
```

### Test Case 4: Defensive Havoc Rate
```
Setup:
- 10 defensive plays total
- Play 1: TFL (havoc)
- Play 2: Sack (havoc)
- Play 3: INT (havoc)
- Play 4: PBU (havoc)
- Play 5-10: Regular tackles (not havoc)

Expected:
- Havoc rate: 40% (4/10)
```

### Test Case 5: Coverage Success
```
Setup:
- CB covers 5 targets
- Result 1: incompletion (win)
- Result 2: completion_allowed (loss)
- Result 3: pass_breakup (win)
- Result 4: interception (win)
- Result 5: completion_allowed (loss)

Expected:
- Coverage success rate: 60% (3/5)
- Targets allowed: 5
- INTs: 1
- PBUs: 1
```

## Debugging Failed Tests

### Issue: Stats section not showing
**Checks:**
1. Is there data for that position? (Check play_instances.qb_id, ball_carrier_id, etc.)
2. Is the player's primary_position set correctly?
3. Check browser console for errors
4. Verify RLS policies allow access

### Issue: Wrong calculation
**Checks:**
1. Review the calculation in the component
2. Query raw data manually:
   ```sql
   SELECT * FROM play_instances WHERE team_id = 'X' AND qb_id = 'Y';
   ```
3. Check for NULL handling in aggregations
4. Verify success rate formula (40% on 1st, 60% on 2nd, 100% on 3rd/4th)

### Issue: Data not appearing after tagging
**Checks:**
1. Refresh the analytics page (Cmd+R)
2. Check that teamId/gameId matches
3. Verify data was saved (check Supabase directly)
4. Check browser console for fetch errors

## SQL Queries for Manual Verification

### Check play counts
```sql
SELECT
  COUNT(*) as total_plays,
  COUNT(qb_id) as plays_with_qb,
  COUNT(ball_carrier_id) as plays_with_carrier,
  COUNT(target_id) as plays_with_target
FROM play_instances
WHERE team_id = 'YOUR_TEAM_ID';
```

### Check player participation
```sql
SELECT
  p.first_name || ' ' || p.last_name as player_name,
  p.primary_position,
  pp.participation_type,
  COUNT(*) as count
FROM player_participation pp
JOIN players p ON pp.player_id = p.id
WHERE pp.team_id = 'YOUR_TEAM_ID'
GROUP BY p.id, p.first_name, p.last_name, p.primary_position, pp.participation_type
ORDER BY p.primary_position, count DESC;
```

### Check OL block results
```sql
SELECT
  pi.lt_block_result,
  pi.lg_block_result,
  pi.c_block_result,
  pi.rg_block_result,
  pi.rt_block_result,
  pi.yards_gained,
  pi.down,
  pi.distance
FROM play_instances pi
WHERE pi.team_id = 'YOUR_TEAM_ID'
  AND pi.lt_id IS NOT NULL;
```

## Performance Benchmarks

### Expected Load Times (with 100+ tagged plays)
- Offensive Report: < 500ms
- Defensive Report: < 500ms
- Drive Analytics: < 300ms

If slower:
- Check for N+1 queries
- Consider materialized views
- Add indexes on frequently queried columns

## Automated Testing (Future)

### Unit Tests (Recommended)
```typescript
// Example: Test success rate calculation
describe('calculateSuccessRate', () => {
  it('should return 100% for 3/3 successful plays', () => {
    const plays = [
      { down: 1, distance: 10, yards_gained: 5 }, // 5 >= 4 ✓
      { down: 2, distance: 6, yards_gained: 4 },  // 4 >= 3.6 ✓
      { down: 3, distance: 3, yards_gained: 3 },  // 3 >= 3 ✓
    ];
    expect(calculateSuccessRate(plays)).toBe(100);
  });
});
```

### Integration Tests (Advanced)
```typescript
// Example: Test full tagging → analytics flow
describe('Analytics Pipeline', () => {
  it('should show QB stats after tagging plays', async () => {
    await tagPlay({ qb_id: 'qb-1', is_complete: true, yards_gained: 10 });
    const stats = await fetchQBStats('team-1');
    expect(stats[0].completions).toBe(1);
    expect(stats[0].yards).toBe(10);
  });
});
```

## Recommended Testing Order

1. ✅ **Start here:** Reset data, tag 1 play, verify it shows in analytics
2. ✅ Test QB stats (set qb_id on passing plays)
3. ✅ Test RB stats (set ball_carrier_id on runs)
4. ✅ Test WR/TE stats (set target_id on passes)
5. ✅ Test OL stats (set OL positions + block results)
6. ✅ Test DL stats (add player_participation with participation_type)
7. ✅ Test LB stats (tackles + coverage)
8. ✅ Test DB stats (coverage + havoc plays)
9. ✅ Test drive analytics (create drives, link plays)
10. ✅ Test filters (game filter, date ranges)

## Need Help?

**Common Commands:**
```bash
# See your data
node scripts/show-ids.js

# Reset for testing
node scripts/reset-tagging-data.js [TEAM_ID]

# Reset specific game
node scripts/reset-tagging-data.js [TEAM_ID] [GAME_ID]

# Check dev server logs
# (Claude Code can check this with BashOutput tool)
```

**Quick SQL Reset (Supabase SQL Editor):**
```sql
-- Replace YOUR_TEAM_ID with actual ID
DELETE FROM player_participation WHERE team_id = 'YOUR_TEAM_ID';
DELETE FROM play_instances WHERE team_id = 'YOUR_TEAM_ID';
DELETE FROM drives WHERE team_id = 'YOUR_TEAM_ID';
```
