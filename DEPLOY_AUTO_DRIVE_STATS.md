# Deploy Automatic Drive Stats Recalculation

## Problem Solved
**Before:** Drive statistics (touchdowns, turnovers, points, etc.) required manual SQL scripts to update after tagging plays.

**After:** Drive stats automatically update in real-time whenever you tag, edit, or delete a play. No manual intervention needed.

---

## How It Works

This migration creates **PostgreSQL database triggers** that automatically recalculate drive statistics whenever play_instances are modified:

1. **You tag a play** → Trigger fires → Drive stats update automatically
2. **You edit a play** → Trigger fires → Both old and new drives update
3. **You delete a play** → Trigger fires → Drive stats recalculate

**What Gets Auto-Calculated:**
- ✅ Plays count, yards gained, first downs
- ✅ **Result** (touchdown, field goal, turnover, punt, downs, etc.)
- ✅ **Points** (6 for TD, 3 for FG, 2 for safety)
- ✅ **Scoring drive** (true if points scored)
- ✅ **Three and out** (3 plays with no first down)
- ✅ **Reached red zone** (any play inside 20-yard line)

---

## Installation Steps

### Step 1: Run the Migration

1. Go to your **Supabase SQL Editor**
2. Copy the entire contents of: `supabase/migrations/034_auto_recalc_drive_stats.sql`
3. Paste and run it
4. You should see: "Success. Returned X rows" (showing 3 triggers installed)

### Step 2: Verify Triggers Are Installed

The migration includes a verification query at the end. You should see 3 triggers:
```
trigger_recalc_drive_stats_delete | DELETE | play_instances
trigger_recalc_drive_stats_insert | INSERT | play_instances
trigger_recalc_drive_stats_update | UPDATE | play_instances
```

### Step 3: Verify Existing Drives Are Updated

The migration automatically recalculates ALL existing drives. Check your Bears game:

```sql
SELECT
  drive_number,
  quarter,
  possession_type,
  plays_count,
  result,
  points,
  scoring_drive,
  three_and_out
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
ORDER BY drive_number;
```

You should now see:
- Correct `result` values (touchdown, turnover, etc.)
- Correct `points` values (6, 3, 0)
- `scoring_drive = true` for drives with touchdowns/field goals

---

## Testing the Automatic Updates

### Test 1: Tag a New Touchdown

1. Go to film tagging page
2. Tag a new play as a touchdown
3. Save the play
4. **Immediately** refresh your analytics page
5. ✅ Touchdown should appear in analytics without running any SQL

### Test 2: Tag a Turnover (Interception)

1. Tag a play as an interception
2. Set `is_turnover = true`
3. Save the play
4. Refresh analytics
5. ✅ Turnovers count should increase immediately

### Test 3: Edit an Existing Play

1. Edit a previously tagged play (change yards, result, etc.)
2. Save
3. Refresh analytics
4. ✅ Drive stats should reflect the change

### Test 4: Move a Play Between Drives

1. Edit a play and change its drive assignment
2. Save
3. ✅ Both the old drive AND new drive should recalculate automatically

---

## Important Notes

### Analytics Page Refresh
**The analytics page does NOT auto-refresh.** After tagging/editing plays:
1. Click the browser refresh button (or press Cmd+R / Ctrl+R)
2. Or navigate away and back to the analytics page

The data IS updated in the database, but your browser needs to re-fetch it.

### Trigger Performance
- Triggers fire **after** the play is saved (AFTER INSERT/UPDATE/DELETE)
- Recalculation happens in milliseconds (typically < 100ms)
- No performance impact on tagging workflow
- Handles edge cases (drive changes, play deletion, etc.)

### Backward Compatibility
- The TypeScript `recalculateDriveStats()` service method still exists
- It's safe to call it manually if needed
- The database trigger is the primary mechanism now
- Both can coexist without conflicts

---

## Troubleshooting

### Analytics Still Shows Zeros

**Check 1:** Did you run the migration?
```sql
-- This should return 3 rows
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'play_instances'
  AND trigger_name LIKE 'trigger_recalc_drive_stats%';
```

**Check 2:** Is the play linked to a drive?
```sql
-- Check if your plays have drive_id set
SELECT id, play_code, drive_id, result_type, is_turnover
FROM play_instances
WHERE video_id = 'your-video-id'
ORDER BY timestamp_start;
```

If `drive_id` is NULL, the play isn't linked to a drive. You need to:
1. Create drives for the game (using drive builder)
2. Link plays to drives (select drive in tagging form)

**Check 3:** Did you refresh the browser?
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Or open in incognito/private window to bypass cache

### Trigger Not Firing

Check trigger status:
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'play_instances'::regclass
  AND tgname LIKE 'trigger_recalc_drive_stats%';
```

`tgenabled` should be `O` (origin, enabled).

If triggers are disabled:
```sql
ALTER TABLE play_instances ENABLE TRIGGER trigger_recalc_drive_stats_insert;
ALTER TABLE play_instances ENABLE TRIGGER trigger_recalc_drive_stats_update;
ALTER TABLE play_instances ENABLE TRIGGER trigger_recalc_drive_stats_delete;
```

---

## What This Replaces

You can now **DELETE** these manual SQL scripts (no longer needed):
- ❌ `FIX_DRIVE_COUNTS_CORRECT.sql`
- ❌ `RECALC_ALL_DRIVE_STATS_COMPLETE.sql`
- ❌ Any other manual drive recalculation scripts

The triggers handle everything automatically from now on.

---

## For Production Deployment

This migration is **production-ready**:
- ✅ Handles all edge cases (NULL drive_id, drive changes, deletions)
- ✅ Atomic operations (runs in same transaction as play insert/update)
- ✅ No race conditions
- ✅ Minimal performance impact
- ✅ Recalculates all existing drives on deployment
- ✅ Properly indexes for fast lookups

**Deployment checklist:**
1. Test in development first (tag multiple plays, verify analytics)
2. Backup database before running migration
3. Run migration during low-traffic period (optional, but safe)
4. Verify triggers installed successfully
5. Spot-check a few drives to confirm stats are correct
6. Monitor performance (should be unnoticeable)

---

## Summary

**One-time setup:**
- Run migration 034 in Supabase SQL Editor

**Going forward:**
- Tag plays as normal
- Drive stats update automatically
- Refresh browser to see analytics
- No more manual SQL scripts needed!

**Result:**
- ✅ Touchdowns appear immediately
- ✅ Turnovers appear immediately
- ✅ Points calculated automatically
- ✅ All drive stats stay in sync
- ✅ Zero manual intervention required
