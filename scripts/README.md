# Utility Scripts

## Clear Storage Script

The `clear-storage.ts` script removes all files from Supabase Storage buckets.

### Usage

**Option 1: Using npm script (recommended)**

```bash
npm run clear-storage
```

**Option 2: Direct execution**

```bash
npx tsx scripts/clear-storage.ts
```

**Option 3: Make executable and run**

```bash
chmod +x scripts/clear-storage.ts
./scripts/clear-storage.ts
```

### What It Does

- Connects to your Supabase project using credentials from `.env.local`
- Lists all files in configured storage buckets
- Deletes all files from each bucket
- Shows progress and confirmation

### Configuration

Edit the `BUCKETS_TO_CLEAR` array in `clear-storage.ts` to specify which buckets to clear:

```typescript
const BUCKETS_TO_CLEAR = [
  'videos',
  'game-videos',
  'playbook-images',
  'playbook-pdfs',
];
```

### Safety Features

- ⚠️ 3-second countdown before deletion (press Ctrl+C to cancel)
- ✅ Shows file counts before deleting
- ✅ Confirms successful deletion
- ✅ Error handling for missing buckets

### Prerequisites

Make sure you have:
1. `.env.local` file with Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

2. `tsx` installed (run `npm install` to get it)

### Complete Data Reset Workflow

To completely reset your application data:

1. **Clear Database Records**
   - Go to Supabase SQL Editor
   - Run `supabase/scripts/clear_all_data.sql`

2. **Clear Storage Files**
   ```bash
   npm run clear-storage
   ```

3. **Verify**
   - Refresh your app
   - You should see empty states everywhere
   - Your login will still work (auth.users preserved)

4. **Start Fresh**
   - Create a new team
   - Upload new videos
   - Build your playbook

### Troubleshooting

**"Missing Supabase credentials" error:**
- Check that `.env.local` exists
- Verify variables are named correctly
- Make sure there are no typos in the values

**"Bucket not found" error:**
- The bucket might not exist yet
- Remove it from `BUCKETS_TO_CLEAR` array
- Or create the bucket in Supabase Storage dashboard

**Permission errors:**
- Make sure your Supabase anon key has proper permissions
- Check Storage RLS policies
- You may need to use the service role key for admin operations
