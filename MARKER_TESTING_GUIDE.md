# Video Marker System - Testing Guide

## Prerequisites

### 1. Apply Database Migration

First, you need to apply the migration to your Supabase database:

**Option A: Supabase CLI (if linked)**
```bash
npx supabase db push
```

**Option B: Supabase Dashboard (recommended)**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open `/supabase/migrations/027_video_markers_simple.sql`
4. Copy and paste the entire SQL content
5. Click "Run" to execute the migration

### 2. Verify Migration Applied

Run this query in Supabase SQL Editor to verify the table is updated:

```sql
-- Check if new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'video_timeline_markers'
  AND column_name IN ('video_id', 'quarter', 'color', 'created_by', 'updated_at');

-- Check if video_id column exists and video_group_id is nullable
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_timeline_markers' AND column_name = 'video_id'
  ) as video_id_exists,
  (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'video_timeline_markers' AND column_name = 'video_group_id'
  ) as video_group_id_nullable;
```

Expected result: `video_id_exists: true`, `video_group_id_nullable: YES`

---

## Manual Testing Workflow

### Test 1: Add a Marker

1. **Navigate** to a game film page: `/teams/{teamId}/film/{gameId}`
2. **Wait** for the video to load
3. **Play** the video to about 30 seconds
4. **Pause** the video
5. **Click** the "Add Marker" button (next to "Mark Start")
6. **Verify**:
   - A vertical line appears on the timeline above the video
   - The "Markers" button now shows a count: "Markers (1)"

### Test 2: View Markers

1. **Click** the "Markers" button to toggle the marker panel
2. **Verify**:
   - A panel appears below the video showing your marker
   - Marker shows:
     - Color indicator (blue dot)
     - Label: "Marker at 0:30" (or similar)
     - Timestamp: "0:30"
     - Play button (▶)
     - Delete button (trash icon, visible on hover)

### Test 3: Jump to Marker

1. **Seek** the video to a different time (e.g., 0:00)
2. **Open** the marker panel if closed
3. **Click** the Play button (▶) on your marker
4. **Verify**:
   - Video jumps to the marker timestamp (0:30)
   - Current time display updates

### Test 4: Marker on Timeline

1. **Hover** over the vertical line on the timeline
2. **Verify**:
   - A tooltip appears showing:
     - Marker icon
     - Label: "Marker at 0:30"
     - Timestamp and quarter (if set)
3. **Click** the marker line
4. **Verify**:
   - Video jumps to that timestamp

### Test 5: Delete Marker

1. **Open** the marker panel
2. **Hover** over a marker in the list
3. **Click** the delete button (trash icon, appears on hover)
4. **Verify**:
   - Marker disappears from the list
   - Marker disappears from the timeline
   - Marker count decreases: "Markers (0)"

### Test 6: Multiple Markers

1. **Add** markers at different timestamps:
   - Pause at 0:15, click "Add Marker"
   - Pause at 0:45, click "Add Marker"
   - Pause at 1:30, click "Add Marker"
2. **Verify**:
   - All markers appear on the timeline at correct positions
   - All markers listed in the panel sorted by time
   - Each marker is clickable and navigates correctly

### Test 7: Persistence

1. **Add** a marker
2. **Refresh** the page (F5)
3. **Verify**:
   - Marker persists after reload
   - Marker appears on timeline
   - Marker count is correct

---

## Testing with Browser Developer Tools

### Check Network Requests

1. Open **Chrome DevTools** (F12)
2. Go to **Network** tab
3. Filter by **Fetch/XHR**
4. Add a marker and watch for:
   - POST request to Supabase (creating marker)
   - Response with new marker data
5. Delete a marker and watch for:
   - DELETE request to Supabase
   - Success response

### Check Console for Errors

1. Open **Console** tab in DevTools
2. Perform marker operations
3. **Verify**: No errors appear (red messages)
4. Look for successful logs (if any)

### Inspect Marker Elements

1. Right-click a marker on the timeline
2. Select **Inspect Element**
3. **Verify**:
   - Marker has correct position style: `left: X%`
   - Position percentage matches timestamp/duration ratio
   - Color styles are applied correctly

---

## Database Verification

After testing, verify data in Supabase:

```sql
-- View all markers
SELECT
  id,
  video_id,
  marker_type,
  label,
  virtual_timestamp_start_ms,
  quarter,
  color,
  created_at
FROM video_timeline_markers
ORDER BY virtual_timestamp_start_ms;

-- Count markers per video
SELECT
  video_id,
  COUNT(*) as marker_count
FROM video_timeline_markers
WHERE video_id IS NOT NULL
GROUP BY video_id;

-- Check marker types
SELECT
  marker_type,
  COUNT(*) as count
FROM video_timeline_markers
GROUP BY marker_type;
```

---

## Common Issues & Troubleshooting

### Issue: "Add Marker" button does nothing

**Possible Causes:**
- Migration not applied
- No video selected
- JavaScript error in console

**Fix:**
1. Check browser console for errors
2. Verify migration was applied
3. Refresh the page

### Issue: Markers don't appear on timeline

**Possible Causes:**
- Video duration is 0
- Marker data not fetched
- CSS/rendering issue

**Fix:**
1. Check Network tab - was marker created?
2. Check `markers` state in React DevTools
3. Verify video duration > 0

### Issue: Can't delete markers

**Possible Causes:**
- RLS policy blocking delete
- Missing `created_by` in marker

**Fix:**
1. Check console for error message
2. Verify RLS policies in Supabase
3. Check user is authenticated

### Issue: Markers show wrong timestamp

**Possible Causes:**
- Millisecond/second conversion error
- Wrong video duration

**Fix:**
1. Check `currentTime * 1000` in handler
2. Verify `videoDuration` is in seconds
3. Check marker data in database (should be in ms)

---

## Next Steps After Testing

Once basic functionality works:

1. **Test auto-generation features**:
   - Add quarter markers based on play tags
   - Auto-generate markers by dividing video evenly

2. **Test different marker types**:
   - Create markers with type: 'quarter_start', 'halftime', 'big_play', etc.
   - Verify colors match marker type

3. **Performance testing**:
   - Add 20+ markers
   - Verify timeline renders smoothly
   - Check for any lag when scrubbing

4. **Edge cases**:
   - Add marker at 0:00
   - Add marker at video end
   - Very short video (< 1 minute)
   - Very long video (> 2 hours)

---

## Success Criteria

✅ Can add markers at current video time
✅ Markers appear visually on timeline
✅ Can click markers to jump to timestamp
✅ Can delete markers
✅ Markers persist after page refresh
✅ Multiple markers work correctly
✅ No console errors
✅ Database stores correct data

