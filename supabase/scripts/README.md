# Database Scripts

## Clear All Data

The `clear_all_data.sql` script removes all data from your database while preserving the structure (tables, RLS policies, indexes, etc.).

### How to Run

**Option 1: Via Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New query**
4. Copy and paste the contents of `clear_all_data.sql`
5. Click **Run** or press `Cmd/Ctrl + Enter`

**Option 2: Via psql CLI**

```bash
# Connect to your database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the script
\i supabase/scripts/clear_all_data.sql
```

**Option 3: Via Supabase CLI**

```bash
# Make sure you're linked to your project
supabase db reset --db-url "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"

# Or run the script directly
cat supabase/scripts/clear_all_data.sql | supabase db execute
```

### What Gets Cleared

- ✅ All teams
- ✅ All playbook plays
- ✅ All games and videos
- ✅ All play instances (tagged plays)
- ✅ All drives
- ✅ All players
- ✅ All team memberships
- ✅ All game plans and wristbands
- ✅ All video groups (virtual videos)

### What's Preserved

- ✅ Database schema (tables, columns, types)
- ✅ RLS policies
- ✅ Indexes and constraints
- ✅ Functions and triggers
- ✅ Migrations history
- ✅ User accounts (auth.users) - **Your login will still work**

### Clearing Supabase Storage (Videos)

The SQL script only clears database records. To also delete uploaded video files:

1. Go to **Storage** in Supabase Dashboard
2. Find your storage bucket (likely named `videos` or `game-videos`)
3. Select all files
4. Click **Delete**

Or use the Supabase client:

```typescript
// In your app or a script
const { data, error } = await supabase
  .storage
  .from('videos')
  .list();

if (data) {
  const filePaths = data.map(file => file.name);
  await supabase.storage.from('videos').remove(filePaths);
}
```

### Post-Clear Checklist

After clearing data:

1. ✅ Refresh your app - you should see empty states
2. ✅ Create a new team to test
3. ✅ Upload a test video
4. ✅ Create a test play in playbook
5. ✅ Tag a test play in film viewer

### Safety Notes

⚠️ **This is irreversible!** Make sure you want to delete all data before running.

💡 **Development Only:** This is intended for development/testing. In production, you'd want:
- Database backups before clearing
- Soft deletes instead of hard deletes
- User confirmation workflows

🔒 **User Accounts:** Your auth.users table is NOT affected. You can still log in with the same credentials.

### Troubleshooting

**"Permission denied" error:**
- Make sure you're connected as the `postgres` user (superuser)
- Check that RLS policies allow deletion (though this script runs as superuser)

**"Table does not exist" error:**
- Some tables may not exist yet if migrations haven't been run
- The `IF EXISTS` clause prevents errors, so this should be safe to ignore

**Foreign key constraint errors:**
- The `CASCADE` option should handle this
- If you still get errors, try running the script twice

### Alternative: Reset Database Completely

If you want to start completely fresh (re-run all migrations):

```bash
# This will drop and recreate the database
supabase db reset

# Then re-run your migrations
supabase db push
```

This approach:
- ✅ Ensures perfect clean slate
- ✅ Tests that your migrations work correctly
- ❌ Takes longer (drops and recreates everything)
- ❌ Requires local Supabase setup
