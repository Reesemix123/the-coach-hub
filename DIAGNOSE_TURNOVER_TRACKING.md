# Diagnose Turnover Tracking Issues

## Quick Check: Did You Run the Migration?

The automatic turnover counting requires migration 034b to be installed.

**Run this in Supabase SQL Editor:**

```sql
-- Check if the drive stats trigger exists
SELECT trigger_name, tgenabled
FROM pg_trigger
WHERE tgrelid = 'play_instances'::regclass
  AND tgname LIKE 'trigger_recalc_drive_stats%';
```

**Expected Result:** 3 rows (insert, update, delete triggers)

**If you see 0 rows:** The migration wasn't run! Go run `supabase/migrations/034b_auto_recalc_drive_stats_FIXED.sql`

---

## Issue: Player Stats Not Showing

This is a SEPARATE issue from drive stats. Player-level stats require:
1. Tracking WHICH player made the interception or forced the fumble
2. Querying player participation data

Let me check if player participation is being saved correctly...
