# Database Reset Guide

**Purpose:** Delete all test data and start fresh

**What gets deleted:**
- ✅ All teams, games, plays, videos, practice plans
- ✅ All uploaded files in storage
- ❌ Your auth users (login still works)
- ❌ Database structure (tables/migrations stay)

---

## 🗑️ Complete Reset (Database + Storage)

### Step 1: Clear Database Tables

**Go to Supabase Dashboard:**
1. Open your project
2. Click "SQL Editor" in left sidebar
3. Copy/paste the contents of `scripts/reset-database.sql`
4. Click "Run" (or press Cmd/Ctrl + Enter)

**Expected result:**
```
DELETE 5   -- teams
DELETE 0   -- players
DELETE 10  -- games
...etc

Verification query shows:
table_name | count
-----------|------
teams      | 0
players    | 0
games      | 0
...all 0s
```

### Step 2: Clear Storage Files

**Run the storage clearing script:**

```bash
npm run clear-storage
```

**Expected output:**
```
🗑️  Clearing Supabase Storage...
⚠️  WARNING: This will delete ALL files from storage buckets!
Press Ctrl+C now to cancel, or wait 3 seconds to continue...

📦 Processing bucket: videos
   📄 Found 3 file(s)
   ✅ Deleted 3 file(s)

📦 Processing bucket: game-videos
   ✅ Bucket is already empty

✅ Storage clearing complete!
```

### Step 3: Verify in Browser

1. Refresh your app: http://localhost:3000
2. Should redirect to homepage (no teams)
3. Click "Get Started"
4. Create a new team → Should work perfectly ✅

---

## ⚡ Quick Reset (One Command)

For convenience, you can run both steps with one command:

### Option A: Manual (2 steps)
```bash
# 1. Run SQL in Supabase Dashboard (copy from scripts/reset-database.sql)
# 2. Run storage clear
npm run clear-storage
```

### Option B: Script (Coming Soon)
```bash
# We can create this if you want:
npm run reset-all
```

---

## 🛡️ Safety Notes

**What's Protected:**
- Your Supabase auth users (can still login)
- Database structure (tables, columns, RLS policies)
- Migrations (won't need to re-run)

**What Gets Deleted:**
- All team data
- All playbook plays
- All games and videos
- All practice plans
- All uploaded files

**Can't Undo:**
- There's no "undo" button
- Files are permanently deleted
- Use database backups if you need to restore

---

## 🧪 Testing Workflow After Reset

Recommended testing sequence:

1. **Homepage:** Should show "Get Started" button
2. **Create Team:** Click button, fill form, submit
3. **Build Play:** Go to playbook, create a play
4. **Add Game:** Create a game on schedule
5. **Upload Video:** Add video to game
6. **Tag Play:** Tag the play in video
7. **Check Analytics:** Should calculate based on tagged plays

This tests the complete end-to-end workflow! ✅

---

## ❓ Common Questions

**Q: Will I lose my login?**
A: No - your auth user is preserved. You can still login with same email/password.

**Q: Will I need to run migrations again?**
A: No - database structure stays intact. Just the data is deleted.

**Q: What if I want to keep some data?**
A: Don't run the full reset. Instead, delete specific rows:
```sql
-- Example: Delete only one team
DELETE FROM teams WHERE id = 'team-id-here';
-- This will cascade delete related data
```

**Q: Can I reset just the database OR just storage?**
A: Yes!
- Database only: Run the SQL script in Supabase
- Storage only: Run `npm run clear-storage`

---

## 📋 Quick Reference

```bash
# Clear everything (manual 2-step process)
# Step 1: Run scripts/reset-database.sql in Supabase SQL Editor
# Step 2:
npm run clear-storage

# Verify it worked
# Visit http://localhost:3000
# Should show "Get Started" button ✅
```

---

**Ready to reset?** Follow Steps 1-3 above! 🗑️
