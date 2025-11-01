# Video Management System - Implementation Guide

## Overview

This document outlines the complete implementation of the video consolidation and multi-angle overlay system for Titan First Read.

---

## 🎯 Goals

1. **Consolidate** multiple videos per game into a single seamless playback experience
2. **Overlay** multiple video angles (scoreboard + field camera)
3. **Simple UX** for coaches (not professional video editors)
4. **Cost-effective** (minimize server processing costs)
5. **Progressive enhancement** (start simple, add features incrementally)

---

## 📊 System Architecture

### **Three-Phase Approach**

#### **Phase 1: Virtual Timeline (IMMEDIATE - No Server Cost)**
- Client-side video player that switches between videos seamlessly
- Store video sequence in database metadata
- No actual video processing
- **Status**: Ready to implement ✅

#### **Phase 2: Server-Side Merge (OPTIONAL - Background Processing)**
- Coaches can optionally request a "real" merged video
- Background job using FFmpeg
- Progress tracking with notifications
- **Status**: Architecture ready, needs FFmpeg server setup

#### **Phase 3: Multi-Angle Overlay (ADVANCED)**
- Sync multiple cameras to same timeline
- Layout presets: PiP, side-by-side, stacked, quad
- Server-side FFmpeg processing
- **Status**: Architecture ready, builds on Phase 2

---

## 💾 Database Schema

### **New Tables (Migration 016)**

1. **`video_groups`** - Container for related videos
   - `group_type`: 'sequence', 'overlay', 'multi_angle'
   - `layout_preset`: 'pip', 'side_by_side', 'stacked', 'quad'
   - `has_merged_video`: Boolean flag
   - `merged_video_id`: Reference to merged output

2. **`video_group_members`** - Videos within a group
   - `sequence_order`: Order in timeline (0, 1, 2...)
   - `start_offset_ms`, `end_offset_ms`: Trim points
   - `sync_point_ms`: Sync offset for overlays
   - `overlay_position`: Where to place in layout
   - `overlay_scale`: Size (0.25 = 25%)

3. **`video_processing_jobs`** - Background task tracking
   - `job_type`: 'merge', 'overlay', 'transcode'
   - `status`: 'pending', 'processing', 'completed', 'failed'
   - `progress_percent`: 0-100
   - `output_video_id`: Result

4. **`video_timeline_markers`** - Play tagging across virtual timeline
   - `virtual_timestamp_start_ms`: Position in combined timeline
   - `actual_video_id`: Which physical video contains this
   - Links to `play_instances` table

---

## 🎬 Phase 1: Virtual Timeline Player

### **How It Works**

1. **Create Video Group**:
   ```typescript
   {
     game_id: "game-123",
     name: "Full Game",
     group_type: "sequence",
     members: [
       { video_id: "vid-1", sequence_order: 0 },
       { video_id: "vid-2", sequence_order: 1 },
       { video_id: "vid-3", sequence_order: 2 }
     ]
   }
   ```

2. **Virtual Timeline Calculation**:
   ```
   Video 1: 0:00 - 10:00 (600s)
   Video 2: 10:00 - 25:00 (900s)
   Video 3: 25:00 - 40:00 (900s)
   Total: 40:00 (2400s virtual timeline)
   ```

3. **Playback Logic**:
   - User seeks to 12:00 → Calculate: Video 2 at 2:00
   - Automatically switch videos when boundary reached
   - Preload next video for smooth transition

### **Components to Build**

#### 1. `VirtualVideoPlayer.tsx`
```typescript
interface Props {
  videoGroupId: string;
  onTimeUpdate: (virtualTime: number) => void;
}

// Features:
// - Loads all videos in sequence
// - Calculates virtual timeline
// - Seamlessly switches between videos
// - Seek across virtual timeline
// - Play/pause, speed controls
```

#### 2. `VideoGroupManager.tsx`
```typescript
// UI for creating/editing video groups
// - Drag-and-drop to reorder videos
// - Trim start/end of each video
// - Preview combined timeline
```

#### 3. `VideoTimelineEditor.tsx`
```typescript
// Visual timeline with:
// - Video segments displayed as blocks
// - Play markers/tags
// - Scrubber for seeking
// - Quarter/timeout markers
```

### **User Workflow**

1. Coach goes to Film page for a game
2. Sees list of uploaded videos
3. Clicks "Create Video Group"
4. Selects multiple videos, sets order
5. Names group "Full Game - All Angles"
6. Opens virtual player → plays as one continuous video
7. Tags plays across virtual timeline

### **Benefits**
- ✅ Instant (no processing time)
- ✅ No server costs
- ✅ Easy to reorder/edit
- ✅ Keeps original files intact

### **Limitations**
- ❌ Small gap between video transitions (~100ms)
- ❌ Can't export as single file
- ❌ Requires all source videos available

---

## 🔧 Phase 2: Server-Side Merge (Optional)

### **When to Use**
- Coach wants to share video with players
- Export for film study platform
- Eliminate transition gaps
- Create highlight reels

### **FFmpeg Command**
```bash
# Create file list
echo "file 'video1.mp4'" > list.txt
echo "file 'video2.mp4'" >> list.txt
echo "file 'video3.mp4'" >> list.txt

# Concatenate videos
ffmpeg -f concat -safe 0 -i list.txt \
  -c copy \  # Copy streams (fast, no re-encoding)
  -movflags +faststart \  # Web optimization
  output.mp4
```

### **Architecture Options**

#### **Option A: Supabase Edge Functions + Docker**
```typescript
// supabase/functions/merge-videos/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (req) => {
  const { videoGroupId } = await req.json();

  // 1. Fetch video URLs from storage
  // 2. Download to temp directory
  // 3. Run FFmpeg in Docker container
  // 4. Upload merged video to storage
  // 5. Update job status in database

  return new Response(JSON.stringify({ jobId }));
});
```

**Pros**:
- Integrated with Supabase
- Auto-scales
- No separate server to manage

**Cons**:
- 10-minute timeout limit
- Memory limits
- Need to package FFmpeg

#### **Option B: Separate Node.js Server**
```typescript
// server.ts
import express from 'express';
import ffmpeg from 'fluent-ffmpeg';

app.post('/api/merge-videos', async (req, res) => {
  const { videoGroupId } = req.body;

  // Create background job
  const job = await queue.add('merge-videos', { videoGroupId });

  res.json({ jobId: job.id });
});

// Worker process
queue.process('merge-videos', async (job) => {
  // FFmpeg processing
  // Update progress in Supabase
});
```

**Pros**:
- No timeout limits
- Full FFmpeg control
- Can handle large files

**Cons**:
- Separate infrastructure
- Need to host/manage server
- Additional cost

#### **Option C: AWS Lambda + EFS (Recommended for Production)**
- Store FFmpeg binary on EFS
- Lambda function with extended timeout (15 min)
- Use Step Functions for long-running jobs
- **Cost**: ~$0.10 per merge operation

### **Job Queue & Progress**

```typescript
// Real-time progress updates
const jobSubscription = supabase
  .channel(`job:${jobId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'video_processing_jobs',
    filter: `id=eq.${jobId}`
  }, (payload) => {
    setProgress(payload.new.progress_percent);
    setCurrentStep(payload.new.current_step);
  })
  .subscribe();
```

---

## 🎥 Phase 3: Multi-Angle Overlay

### **Use Cases**
1. **Scoreboard + Field**: PiP with game clock in corner
2. **End Zone + Sideline**: Split-screen views
3. **Quad View**: 4 angles simultaneously
4. **Coach + Player Cam**: Multi-camera coordination

### **User Workflow**

1. Upload 2+ videos (e.g., "Scoreboard.mp4", "Field.mp4")
2. Click "Create Overlay"
3. **Sync Videos**:
   - Play both videos side-by-side
   - Click matching moments (e.g., kickoff whistle)
   - System calculates offset
4. **Choose Layout**:
   - Picture-in-Picture (scoreboard in corner)
   - Side-by-Side (50/50 split)
   - Stacked (top/bottom)
   - Quad (4-way split)
5. **Customize**:
   - Which video is "primary"
   - Size of secondary (25%, 50%, 75%)
   - Position (corners, center)
   - Audio source (primary, secondary, mix)
6. **Process**:
   - Creates background job
   - Receives notification when ready

### **FFmpeg Commands**

#### Picture-in-Picture (Scoreboard Corner)
```bash
ffmpeg -i field.mp4 -i scoreboard.mp4 \
  -filter_complex "
    [1:v]scale=320:240[scoreboard];
    [0:v][scoreboard]overlay=W-w-10:10
  " \
  -c:a copy output.mp4
```

#### Side-by-Side
```bash
ffmpeg -i field.mp4 -i sideline.mp4 \
  -filter_complex "[0:v][1:v]hstack=inputs=2[v]" \
  -map "[v]" -c:a copy output.mp4
```

#### Stacked (Top/Bottom)
```bash
ffmpeg -i endzone.mp4 -i sideline.mp4 \
  -filter_complex "[0:v][1:v]vstack=inputs=2[v]" \
  -map "[v]" output.mp4
```

#### Quad View (4 Angles)
```bash
ffmpeg -i cam1.mp4 -i cam2.mp4 -i cam3.mp4 -i cam4.mp4 \
  -filter_complex "
    [0:v][1:v]hstack=inputs=2[top];
    [2:v][3:v]hstack=inputs=2[bottom];
    [top][bottom]vstack=inputs=2[v]
  " \
  -map "[v]" output.mp4
```

#### With Audio Mixing
```bash
ffmpeg -i primary.mp4 -i secondary.mp4 \
  -filter_complex "
    [1:v]scale=320:240[small];
    [0:v][small]overlay=W-w-10:10[v];
    [0:a][1:a]amix=inputs=2:weights=0.7 0.3[a]
  " \
  -map "[v]" -map "[a]" output.mp4
```

---

## 🛠️ Implementation Checklist

### **Phase 1: Virtual Timeline (Start Here)**
- [x] Database migration (016)
- [x] TypeScript types
- [ ] `VirtualVideoPlayer` component
- [ ] `VideoGroupManager` UI
- [ ] `VideoTimelineEditor` component
- [ ] Update Film page with "Create Group" button
- [ ] Test with multiple videos

### **Phase 2: Server Merge (Optional)**
- [ ] Choose architecture (Edge Functions vs separate server)
- [ ] Set up FFmpeg environment
- [ ] Implement merge endpoint
- [ ] Job queue & progress tracking
- [ ] UI for requesting merge
- [ ] Notification system

### **Phase 3: Multi-Angle (Advanced)**
- [ ] Sync UI (side-by-side sync tool)
- [ ] Layout preset selector
- [ ] Position/scale controls
- [ ] Audio mixing options
- [ ] FFmpeg overlay processing
- [ ] Preview before processing

---

## 💰 Cost Estimates

### **Phase 1: Virtual Timeline**
- **Cost**: $0 (client-side only)
- **Processing time**: 0 (instant)

### **Phase 2: Server Merge**
- **Option A (Edge Functions)**:
  - $0.10 per merge (10-min videos)
  - Limited by timeouts

- **Option B (AWS Lambda + EFS)**:
  - $0.08-0.15 per merge
  - Scales automatically

- **Option C (Dedicated Server)**:
  - $20-50/month fixed
  - Unlimited merges

### **Phase 3: Overlay**
- 2-3x cost of merge (more processing)
- $0.25-0.40 per overlay operation
- Depends on video length and complexity

---

## 🚀 Recommended Rollout

### **Week 1: Database + UI Foundation**
1. Apply migration 016
2. Build `VideoGroupManager` UI
3. Allow coaches to create sequence groups

### **Week 2: Virtual Player**
4. Build `VirtualVideoPlayer` component
5. Implement seek/playback across multiple videos
6. Test with real game footage

### **Week 3: Timeline Editor**
7. Build visual timeline
8. Play tagging across virtual timeline
9. Polish UI/UX

### **Week 4+: Optional Server Processing**
10. Set up FFmpeg environment
11. Implement merge endpoint
12. Add overlay support (Phase 3)

---

## 📝 Alternative: Use Existing Service

If server implementation is too complex, consider:

### **Mux (mux.com)**
- **Pros**: Managed video infrastructure, excellent API, transcoding included
- **Cons**: $10/1000 minutes processed (~$0.60 per 60-min game)
- **Features**: Automatic adaptive streaming, thumbnails, time-based clipping

### **Cloudinary**
- **Pros**: Video transformation API, overlay support
- **Cons**: $99/month minimum for video
- **Features**: URL-based transformations, PiP, text overlays

### **FFmpeg.wasm (Client-Side)**
- **Pros**: No server costs, full FFmpeg
- **Cons**: Slow (10x slower than native), large download (32MB)
- **Use case**: Small clips only

---

## 🎓 Summary

**Start with Phase 1** (Virtual Timeline):
- Zero cost
- Immediate implementation
- 90% of use cases covered
- No server complexity

**Add Phase 2/3** later if needed:
- Only if coaches request "real" merged videos
- Server setup required
- Consider managed service (Mux) vs self-hosted

**Key Decision Point**:
After Phase 1 launch, monitor usage. If coaches rarely need actual merged files, stay with virtual timeline. If they frequently want to export/share, then invest in server processing.

---

## 📚 Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [FFmpeg Concat Demuxer](https://trac.ffmpeg.org/wiki/Concatenate)
- [FFmpeg Overlay Filter](https://ffmpeg.org/ffmpeg-filters.html#overlay-1)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [AWS Lambda with FFmpeg](https://aws.amazon.com/blogs/media/processing-user-generated-content-using-aws-lambda-and-ffmpeg/)
- [Mux Video API](https://docs.mux.com/)
