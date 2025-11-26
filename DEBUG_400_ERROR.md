# Debug 400 Error When Saving Plays

## What to Check

### Step 1: Get the Full Error Message

Open your browser's Developer Console:
- **Chrome/Edge:** Press F12 or Cmd+Option+J (Mac) / Ctrl+Shift+J (Windows)
- **Firefox:** Press F12 or Cmd+Option+K (Mac) / Ctrl+Shift+K (Windows)
- **Safari:** Cmd+Option+C (Mac)

Look for:
1. Red error messages in the Console tab
2. Network tab → Find the failed request → Click it → Look at "Response" tab
3. Copy the full error message and share it

The error should show something like:
```
{
  "code": "XXXXX",
  "message": "detailed error message here",
  "details": "..."
}
```

### Step 2: Check if Migration 034 Installed Correctly

Run this in Supabase SQL Editor:

```sql
-- Check if triggers exist
SELECT trigger_name, tgenabled
FROM pg_trigger
WHERE tgrelid = 'play_instances'::regclass
  AND tgname LIKE 'trigger_recalc_drive_stats%';
```

**Expected:** 3 rows with tgenabled = 'O'
**If empty:** Migration didn't run successfully

### Step 3: Check if Trigger Function Has Errors

Try manually calling the trigger function:

```sql
-- Replace with an actual drive_id from your database
SELECT update_single_drive_stats('your-drive-id-here');
```

If this fails, it will show the exact error in the trigger function.

### Step 4: Check if result_type Column Exists

The trigger uses a column called `result_type`. Verify it exists:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'play_instances'
  AND column_name IN ('result_type', 'result', 'is_turnover');
```

**Expected:** Should show all 3 columns
**If result_type is missing:** This is the problem!

### Step 5: Temporarily Disable Triggers (for testing)

If the trigger is causing the 400 error, disable it temporarily:

```sql
ALTER TABLE play_instances DISABLE TRIGGER trigger_recalc_drive_stats_insert;
ALTER TABLE play_instances DISABLE TRIGGER trigger_recalc_drive_stats_update;
ALTER TABLE play_instances DISABLE TRIGGER trigger_recalc_drive_stats_delete;
```

Then try saving a play again. If it works, the trigger is the problem.

To re-enable:
```sql
ALTER TABLE play_instances ENABLE TRIGGER trigger_recalc_drive_stats_insert;
ALTER TABLE play_instances ENABLE TRIGGER trigger_recalc_drive_stats_update;
ALTER TABLE play_instances ENABLE TRIGGER trigger_recalc_drive_stats_delete;
```

## Common Causes

### Cause 1: result_type vs result Column Name Mismatch

The trigger expects `result_type` but the actual column might be `result`.

**Fix:** I'll need to update the migration to use the correct column name.

### Cause 2: Missing Required Fields

The form might not be sending all required fields.

**Check:** What fields are required in play_instances table?

### Cause 3: Trigger Function Error

The trigger function might be failing silently.

**Check:** Supabase logs (Dashboard → Database → Logs)

## What to Report Back

Please provide:
1. ✅ Full error message from browser console
2. ✅ Result of Step 2 (do triggers exist?)
3. ✅ Result of Step 4 (does result_type column exist?)
4. ✅ Did disabling triggers (Step 5) fix the save issue?

This will tell me exactly what's wrong!
