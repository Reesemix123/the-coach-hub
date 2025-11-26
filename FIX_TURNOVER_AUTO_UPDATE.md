# Fix: Turnovers Not Auto-Updating

## Problems Found

### Problem 1: Drive Stats Not Auto-Updating
**Symptom:** Turnover counts don't update in drive/game analytics
**Root Cause:** Database trigger (migration 034b) not installed
**Impact:** Team-level turnover stats stuck at 0

### Problem 2: Player Stats Not Showing Interceptions
**Symptom:** Individual players don't show interceptions in their stats
**Root Cause:** Removed UI checkbox but field wasn't auto-populated
**Impact:** Player-level interception stats don't work

---

## Fixes Applied

### Fix 1: Auto-Set is_interception Field (Code)
**File:** `src/app/teams/[teamId]/film/[gameId]/page.tsx:874`

**Changed:**
```typescript
// OLD: Used removed checkbox value (always false)
is_interception: isTaggingOpponent ? (values.is_interception || false) : undefined,

// NEW: Auto-set based on Result dropdown
is_interception: isTaggingOpponent ? (values.result_type === 'pass_interception') : undefined,
```

**How It Works:**
- When you select "Pass - Interception" in Result dropdown
- ✅ Automatically sets `is_interception = true`
- ✅ Player-level stats will now show interceptions

### Fix 2: Install Database Trigger (Migration)
**Required:** Run migration 034b to enable auto-updating

---

## Installation Steps

### Step 1: Run Migration 034b

1. Go to **Supabase SQL Editor**
2. Copy entire contents of: `supabase/migrations/034b_auto_recalc_drive_stats_FIXED.sql`
3. Paste and run it
4. Should see: "Success" with 3 triggers listed

### Step 2: Verify Triggers Installed

Run this query:
```sql
SELECT trigger_name, tgenabled
FROM pg_trigger
WHERE tgrelid = 'play_instances'::regclass
  AND tgname LIKE 'trigger_recalc_drive_stats%';
```

**Expected:** 3 rows
- trigger_recalc_drive_stats_delete
- trigger_recalc_drive_stats_insert
- trigger_recalc_drive_stats_update

### Step 3: Fix Existing Interception Data

Run this to backfill is_interception for existing plays:

```sql
-- Auto-set is_interception based on result_type
UPDATE play_instances
SET is_interception = true
WHERE result_type = 'pass_interception'
  AND (is_interception = false OR is_interception IS NULL);

-- Verify
SELECT
  id,
  result_type,
  is_interception
FROM play_instances
WHERE result_type = 'pass_interception'
LIMIT 10;
```

All should show `is_interception = true`.

---

## Testing

### Test 1: Tag New Interception

1. Tag a defensive play
2. Result dropdown: Select "Pass - Interception"
3. Save
4. ✅ Drive stats should auto-update (turnovers count)
5. ✅ Player stats should show interception (if you used multi-player tracking)

### Test 2: Tag New Forced Fumble

1. Tag a defensive play
2. Result dropdown: Select "Fumble - Lost"
3. Big Plays: Check "Forced Fumble"
4. Save
5. ✅ Drive stats should auto-update (turnovers count)
6. ✅ Player stats should show forced fumble

### Test 3: Check Analytics

**Drive/Game Level:**
```
Turnovers Forced: 2  ← Should show your interceptions + fumbles recovered
```

**Player Level:**
Go to player's defensive stats page, should see:
```
Interceptions: 1
Forced Fumbles: 1
```

---

## How It All Works Now

### For Turnovers (Team Stats)

**Single Source:** Result Dropdown

| Result Selection | is_turnover | turnover_type | Counts in Analytics |
|---|---|---|---|
| Pass - Interception | ✅ true | interception | ✅ Yes |
| Fumble - Lost | ✅ true | fumble | ✅ Yes |
| Fumble - Recovered | ❌ false | - | ❌ No |

### For Player Stats

**Two Sources:**
1. **is_interception field** (auto-set from Result dropdown)
2. **player_participation table** (from multi-player tracking)

**Best Practice:** Use multi-player tracking sections (DL/LB/DB) to specify which players get credit.

**Fallback:** If you don't use multi-player tracking, the play is still marked as having an interception/forced fumble, just not attributed to specific player.

---

## Troubleshooting

### "Turnovers still not updating"

**Check 1:** Did you run migration 034b?
```sql
SELECT COUNT(*) FROM pg_trigger
WHERE tgrelid = 'play_instances'::regclass
AND tgname LIKE 'trigger_recalc_drive_stats%';
```
Should return 3. If 0, run the migration.

**Check 2:** Hard refresh browser
- Chrome/Edge: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Or open in incognito window

**Check 3:** Check drive stats in database
```sql
SELECT
  d.drive_number,
  d.result,
  d.points,
  d.scoring_drive,
  COUNT(pi.id) as actual_plays
FROM drives d
JOIN games g ON g.id = d.game_id
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'
GROUP BY d.id, d.drive_number, d.result, d.points, d.scoring_drive
ORDER BY d.drive_number;
```

Look for drives with `result = 'turnover'` and `points = 0`.

### "Player stats still showing 0 interceptions"

**Check 1:** Did you run the backfill SQL?
```sql
SELECT COUNT(*) FROM play_instances
WHERE result_type = 'pass_interception'
AND is_interception = true;
```

Should match number of interceptions you tagged.

**Check 2:** Are plays linked to the player?
```sql
SELECT
  pi.id,
  pi.result_type,
  pi.is_interception,
  p.first_name,
  p.last_name
FROM play_instances pi
LEFT JOIN players p ON p.id = pi.coverage_player_id  -- or check participation table
WHERE pi.result_type = 'pass_interception'
LIMIT 10;
```

If player names are NULL, the plays aren't attributed to specific players yet.

---

## Summary

**What You Need to Do:**
1. ✅ Run migration 034b (one-time)
2. ✅ Run backfill SQL for existing interceptions (one-time)
3. ✅ Hard refresh browser

**What Happens Automatically:**
1. ✅ Drive stats update when you save plays
2. ✅ is_interception auto-set when you select "Pass - Interception"
3. ✅ is_turnover auto-set for both interceptions and fumbles lost
4. ✅ Analytics show correct counts

**Result:** No more manual SQL scripts needed!
