# How to Run Migration 033 and Fix Analytics

## The Problem

You tagged defensive plays, but the data isn't showing in analytics because **Migration 033 hasn't been run yet**.

Without this migration:
- New participation types (`dl_run_defense`, `lb_run_stop`, etc.) don't exist in the database
- Database rejects the inserts (constraint violation)
- Saves fail silently
- Analytics show 0 because no data was saved

## Solution: Run Migration 033

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run the Migration

1. Click **+ New query**
2. Open this file on your computer:
   ```
   /Users/markreese/the-coach-hub/supabase/migrations/033_add_multi_player_defensive_tracking.sql
   ```
3. Copy the ENTIRE contents (336 lines)
4. Paste into the SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 3: Verify Success

You should see:
```
Successfully created N objects
```

If you see an error instead, let me know what it says.

### Step 4: Verify New Types Exist

Run this quick check in SQL Editor:
```sql
-- This should return the new participation types
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'participation_type'
)
ORDER BY enumlabel;
```

You should see these NEW types:
- `db_pass_coverage`
- `db_run_support`
- `dl_run_defense`
- `lb_pass_coverage`
- `lb_run_stop`

### Step 5: Re-Tag Some Plays

1. Go back to your Bears game film page
2. **Delete** one of the plays you tagged (the data was rejected)
3. Tag it again with the new UI
4. Click Save
5. Check browser console for errors (F12 → Console tab)
6. Should see no errors

### Step 6: Verify Data Saved

Run this in SQL Editor:
```sql
SELECT participation_type, COUNT(*)
FROM player_participation
GROUP BY participation_type
ORDER BY count DESC;
```

You should now see:
- `dl_run_defense: X`
- `lb_run_stop: X`
- `db_run_support: X`
- etc.

### Step 7: Check Analytics

1. Go to the game analytics page
2. Refresh the page
3. Defensive drive analytics should show data
4. Go to a player's page (like your Strong Safety)
5. Should see tackle stats

---

## Troubleshooting

### Issue: "ERROR: constraint violation"

**This means the migration didn't run.**

Double-check:
1. You copied the ENTIRE file (all 336 lines)
2. You pasted it into Supabase SQL Editor
3. You clicked "Run"

### Issue: "duplicate key value violates unique constraint"

**This means the migration already ran.**

Skip to Step 5 (re-tag plays).

### Issue: Still showing 0 in analytics

**Possible causes:**

1. **Migration didn't run** - Check Step 4
2. **Data not saved** - Check browser console for errors when saving
3. **Analytics cache** - Hard refresh the page (Cmd/Ctrl + Shift + R)
4. **Wrong game** - Make sure you're viewing the same game you tagged

### Issue: Player doesn't appear in stats

**Check:**
```sql
-- Find your Strong Safety
SELECT * FROM players
WHERE primary_position IN ('SS', 'FS', 'S')
  AND team_id = 'YOUR_TEAM_ID';

-- Check their participations
SELECT pp.*, pi.down, pi.distance
FROM player_participation pp
JOIN play_instances pi ON pi.id = pp.play_instance_id
WHERE pp.player_id = 'PLAYER_ID_FROM_ABOVE'
ORDER BY pp.created_at DESC;
```

If you see 0 rows, the data wasn't saved. Re-tag the play after running migration.

---

## Quick Diagnostic

Run this file to check everything:
```
/Users/markreese/the-coach-hub/CHECK_PARTICIPATION_DATA.sql
```

Paste it into Supabase SQL Editor and run it. It will show you:
1. What participation types exist
2. How many participations are saved
3. Recent participations
4. Your Strong Safety's tackles

---

## Expected Timeline

1. Run migration: **2 minutes**
2. Re-tag 3-5 plays: **5 minutes**
3. Verify data shows in analytics: **2 minutes**

**Total: ~10 minutes**

---

## After Migration Works

Once you verify the migration worked and data is saving:
1. You can continue tagging plays normally
2. Analytics will update automatically
3. All the multi-player tracking features will work

The migration is a **one-time** step. After it's done, you never need to run it again.

---

## Need Help?

If you run the migration and still have issues:
1. Copy the error message you see
2. Run `CHECK_PARTICIPATION_DATA.sql` and share results
3. Check browser console and share any errors
4. Let me know and I'll help debug!
