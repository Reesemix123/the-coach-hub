# Virtual Timeline - Integration Guide

## ✅ What's Been Built

### 1. **VirtualVideoPlayer Component** (`/src/components/VirtualVideoPlayer.tsx`)
A fully-featured video player that seamlessly plays multiple videos as one continuous timeline.

**Features:**
- Automatic switching between videos
- Seek across virtual timeline
- Play/pause controls
- Playback speed (0.5x - 2x)
- Visual progress bar with segment markers
- Preloading next video for smooth transitions
- Time display (current / total)
- Video counter (Video X of Y)

**Usage:**
```typescript
<VirtualVideoPlayer
  videoGroupId="group-uuid"
  onTimeUpdate={(virtualTime, totalDuration) => {
    // Handle time updates for play tagging
  }}
  onPlayStateChange={(isPlaying) => {
    // Handle play/pause state changes
  }}
  className="w-full h-[600px]"
/>
```

---

### 2. **VideoGroupManager Component** (`/src/components/VideoGroupManager.tsx`)
Modal UI for creating video groups.

**Features:**
- Shows all available videos for a game
- Click to select multiple videos
- Drag-like interface (up/down arrows) to reorder
- Visual order numbers (1, 2, 3...)
- Remove videos from selection
- Name the group
- Creates group in database

**Usage:**
```typescript
<VideoGroupManager
  gameId="game-uuid"
  videos={availableVideos}
  onGroupCreated={(groupId) => {
    // Switch to newly created group
    setActiveGroupId(groupId);
  }}
  onClose={() => setShowGroupManager(false)}
/>
```

---

## 🔧 Integration Steps

### **Step 1: Apply Database Migration**

Run in Supabase SQL Editor:
```bash
# File: supabase/migrations/016_video_management_system.sql
```

This creates:
- `video_groups` table
- `video_group_members` table
- `video_processing_jobs` table
- `video_timeline_markers` table

---

### **Step 2: Update Film Page**

The film page (`/src/app/film/[gameId]/page.tsx`) needs these additions:

#### **A. Add State for Video Groups**

```typescript
// Add to existing state
const [videoGroups, setVideoGroups] = useState<VideoGroup[]>([]);
const [selectedGroup, setSelectedGroup] = useState<VideoGroup | null>(null);
const [showGroupManager, setShowGroupManager] = useState(false);
const [viewMode, setViewMode] = useState<'single' | 'group'>('single');
```

#### **B. Fetch Video Groups**

```typescript
async function fetchVideoGroups() {
  const { data, error } = await supabase
    .from('video_groups')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false });

  if (!error && data) {
    setVideoGroups(data);
  }
}

// Call in useEffect
useEffect(() => {
  if (gameId) {
    fetchGame();
    fetchVideos();
    fetchVideoGroups(); // ADD THIS
  }
}, [gameId]);
```

#### **C. Add UI Toggle (Above Video Player)**

```typescript
{/* View Mode Toggle */}
<div className="mb-4 flex items-center justify-between">
  <div className="flex gap-2 border border-gray-300 rounded-lg p-1">
    <button
      onClick={() => setViewMode('single')}
      className={`px-4 py-2 rounded-md text-sm font-medium ${
        viewMode === 'single'
          ? 'bg-black text-white'
          : 'text-gray-700 hover:text-gray-900'
      }`}
    >
      Single Video
    </button>
    <button
      onClick={() => setViewMode('group')}
      className={`px-4 py-2 rounded-md text-sm font-medium ${
        viewMode === 'group'
          ? 'bg-black text-white'
          : 'text-gray-700 hover:text-gray-900'
      }`}
    >
      Video Groups ({videoGroups.length})
    </button>
  </div>

  {viewMode === 'group' && (
    <button
      onClick={() => setShowGroupManager(true)}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
    >
      + Create Video Group
    </button>
  )}
</div>
```

#### **D. Conditional Rendering of Player**

```typescript
{/* Video Player Area */}
{viewMode === 'single' ? (
  /* EXISTING SINGLE VIDEO PLAYER */
  <div>
    <video ref={videoRef} src={selectedVideo?.url} ... />
  </div>
) : (
  /* NEW: GROUP PLAYER */
  <div>
    {!selectedGroup ? (
      <div className="bg-gray-50 rounded-lg p-12 text-center">
        <p className="text-gray-600 mb-4">
          {videoGroups.length === 0
            ? 'No video groups yet. Create one to get started.'
            : 'Select a video group from the list below.'}
        </p>
      </div>
    ) : (
      <VirtualVideoPlayer
        videoGroupId={selectedGroup.id}
        onTimeUpdate={(virtualTime, totalDuration) => {
          // Can still tag plays using virtual time
          setCurrentTime(virtualTime / 1000); // Convert ms to seconds
        }}
        className="w-full h-[600px]"
      />
    )}

    {/* Group Selector */}
    {videoGroups.length > 0 && (
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Available Groups:
        </h3>
        <div className="flex gap-2 flex-wrap">
          {videoGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedGroup?.id === group.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

#### **E. Add Modal for Group Manager**

```typescript
{/* Video Group Manager Modal */}
{showGroupManager && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <VideoGroupManager
      gameId={gameId}
      videos={videos}
      onGroupCreated={(groupId) => {
        setShowGroupManager(false);
        fetchVideoGroups(); // Refresh list

        // Auto-select newly created group
        const newGroup = videoGroups.find(g => g.id === groupId);
        if (newGroup) {
          setSelectedGroup(newGroup);
          setViewMode('group');
        }
      }}
      onClose={() => setShowGroupManager(false)}
    />
  </div>
)}
```

---

## 🎬 User Workflow

### **Creating a Video Group:**

1. Coach uploads multiple videos to a game (Quarters 1, 2, 3, 4)
2. Goes to Film page → Switches to "Video Groups" tab
3. Clicks "+ Create Video Group"
4. Modal opens showing all videos
5. Clicks videos to select them (checkmarks appear)
6. Uses ↑↓ arrows to reorder if needed
7. Names group "Full Game"
8. Clicks "Create Group"
9. Virtual player automatically loads with all videos combined

### **Watching Combined Timeline:**

1. Press play
2. Video 1 plays → seamlessly switches to Video 2 → Video 3 → Video 4
3. Seek bar shows entire virtual timeline
4. Vertical lines mark video boundaries
5. Can seek anywhere in virtual timeline
6. Can still tag plays using timestamps

### **Tagging Plays Across Virtual Timeline:**

- When virtual player is active, play tagging still works
- Virtual time is converted to actual video + timestamp
- All existing play tagging functionality preserved

---

## 📋 Quick Checklist

- [ ] Apply migration 016 in Supabase
- [ ] Verify tables created: `video_groups`, `video_group_members`
- [ ] Import `VirtualVideoPlayer` in film page
- [ ] Import `VideoGroupManager` in film page
- [ ] Add state for video groups
- [ ] Add `fetchVideoGroups()` function
- [ ] Add view mode toggle UI
- [ ] Add conditional rendering (single vs group)
- [ ] Add group manager modal
- [ ] Test with 2-3 videos

---

## 🧪 Testing Checklist

### **Test 1: Create Group**
- [ ] Upload 2-3 videos to a game
- [ ] Go to film page
- [ ] Switch to "Video Groups" tab
- [ ] Click "Create Video Group"
- [ ] Select videos in order
- [ ] Name it "Test Group"
- [ ] Verify group appears in database

### **Test 2: Play Virtual Timeline**
- [ ] Select created group
- [ ] Press play
- [ ] Verify video 1 plays
- [ ] Verify automatic switch to video 2
- [ ] Verify no crashes or errors

### **Test 3: Seeking**
- [ ] Drag seek bar to middle of timeline
- [ ] Verify correct video loads
- [ ] Verify playback from correct position

### **Test 4: Controls**
- [ ] Test play/pause
- [ ] Test playback speed (0.5x, 1x, 2x)
- [ ] Verify time display is accurate
- [ ] Verify segment markers appear on timeline

---

## 🐛 Common Issues & Solutions

### **Issue: Videos have gaps/pauses between segments**
**Why:** Network delay loading next video
**Solution:** Videos should preload (already implemented), but slight gap is expected (~100ms)

### **Issue: Seek bar jumps around**
**Why:** Video duration metadata not loaded
**Solution:** Need to store video durations in database for accurate timeline calculation

### **Issue: Can't see video groups tab**
**Why:** Migration not applied
**Solution:** Run migration 016 in Supabase

### **Issue: Group manager doesn't show videos**
**Why:** Props not passed correctly
**Solution:** Ensure `videos` array passed to `VideoGroupManager`

---

## 🚀 Future Enhancements

Once this is working, you can add:

1. **Trim Points** - Set start/end times for each video
2. **Timeline Markers** - Visual markers for quarters, plays
3. **Thumbnail Preview** - Hover over seek bar to see frame
4. **Keyboard Shortcuts** - Space = play/pause, arrow keys = seek
5. **Server-Side Merge** (Phase 2) - Export as real merged video
6. **Multi-Angle Overlay** (Phase 3) - PiP, side-by-side layouts

---

## 💬 Need Help?

If you get stuck:
1. Check browser console for errors
2. Check Supabase logs for database errors
3. Verify migration ran successfully
4. Test with simple 2-video group first

The system is designed to be resilient - if virtual player fails, it falls back to single video mode.
