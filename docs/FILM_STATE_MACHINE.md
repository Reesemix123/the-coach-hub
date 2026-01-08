# Film Tagging Page State Machine

> **Document Status:** Phase 3 - Task 3.1
> **Created:** 2025-01-08
> **Purpose:** Map state flow and dependencies to enable safe component decomposition

## Overview

The film tagging page (`src/app/teams/[teamId]/film/[gameId]/tag/page.tsx`) has:
- **72 useState** declarations
- **14 useEffect** hooks
- **~6,500 lines** of code

This document maps the state machine to identify:
1. State groupings (what belongs together)
2. Effect dependencies (what triggers what)
3. Race condition patterns (timing-sensitive code)

---

## State Categories

### 1. Core Data State (Fetched from DB)
| State | Type | Source | Used By |
|-------|------|--------|---------|
| `game` | `Game \| null` | Supabase | Entire page |
| `videos` | `Video[]` | Supabase | Video selection, timeline |
| `plays` | `Play[]` | Supabase | Play selection dropdown |
| `playInstances` | `PlayInstance[]` | Supabase | Tagged plays list |
| `players` | `Player[]` | Supabase | Player dropdowns |
| `formations` | `Formation[]` | Supabase | Formation dropdown |
| `drives` | `Drive[]` | Supabase | Drive assignment |
| `markers` | `Marker[]` | Supabase | Timeline markers |

### 2. Video Playback State
| State | Type | Purpose |
|-------|------|---------|
| `selectedVideo` | `Video \| null` | Currently playing video |
| `videoUrl` | `string` | Signed URL for video element |
| `videoLoadError` | `string \| null` | Error message if load fails |
| `urlGeneratedAt` | `number \| null` | Timestamp for URL refresh |
| `urlRefreshAttempted` | `boolean` | Tracks error retry |
| `currentTime` | `number` | Current playback position (seconds) |
| `videoDuration` | `number` | Total video length (seconds) |
| `isPlaying` | `boolean` | Play/pause state |

### 3. Camera Sync State
| State | Type | Purpose |
|-------|------|---------|
| `videoOffsetMs` | `number` | Video position on game timeline |
| `clipDurationMs` | `number` | Duration of current clip |
| `offsetDataVideoId` | `string \| null` | Which video the offset data belongs to |
| `isSwitchingCamera` | `boolean` | Camera switch in progress |
| `pendingCameraId` | `string \| null` | Target camera during switch |
| `pendingSyncSeek` | `number \| null` | Seek position after switch |
| `shouldResumePlayback` | `boolean` | Auto-play after switch |
| `targetGameTimeMs` | `number \| null` | Target time for coverage check |
| `gameTimelinePositionMs` | `number` | Current position on unified timeline |
| `timelineDurationMs` | `number` | Total timeline duration |

### 4. Multi-Camera Timeline State
| State | Type | Purpose |
|-------|------|---------|
| `timelineLanes` | `CameraLane[]` | Timeline swimlanes with clips |
| `currentLaneNumber` | `number` | Active camera lane |
| `isVirtuallyPlaying` | `boolean` | Playing through coverage gap |

### 5. Tagging Form State
| State | Type | Purpose |
|-------|------|---------|
| `tagStartTime` | `number` | Start timestamp of current tag |
| `tagEndTime` | `number \| null` | End timestamp (optional) |
| `showTagModal` | `boolean` | Modal visibility |
| `editingInstance` | `PlayInstance \| null` | Play being edited |
| `taggingMode` | `string` | 'offense' / 'defense' / 'specialTeams' |
| `isTaggingOpponent` | `boolean` | Tagging opponent's play |
| `isSavingPlay` | `boolean` | Prevent double-submit |
| `driveAssignMode` | `string` | 'new' / 'current' / 'select' |
| `currentDrive` | `Drive \| null` | Active drive |

### 6. UI State
| State | Type | Purpose |
|-------|------|---------|
| `showPeriodMarkerMenu` | `boolean` | Quarter marker menu |
| `showAddMarkerMenu` | `boolean` | Add marker menu |
| `quarterScores` | `QuarterScore[]` | Score display |
| `scoreMismatch` | `ScoreMismatch \| null` | Score warning |

---

## useEffect Dependency Map

### Effect 1: Cleanup (line 675)
```
Dependencies: []
Reads: virtualPlaybackRef
Writes: (cleanup only)
Purpose: Clean up interval on unmount
```

### Effect 2: Initial Fetch (line 683)
```
Dependencies: [gameId]
Reads: gameId
Writes: game, videos, drives, cameraLimit (via fetches)
Purpose: Load initial data when game ID available
Triggers: #3, #4
```

### Effect 3: Team-Dependent Fetch (line 692)
```
Dependencies: [game]
Reads: game.team_id
Writes: plays, players, formations, analyticsTier
Purpose: Load team-specific data
```

### Effect 4: Play Instances Fetch (line 702)
```
Dependencies: [timelineLanes]
Reads: timelineLanes (video IDs)
Writes: playInstances
Purpose: Fetch tagged plays for timeline videos
```

### Effect 5: Video Selection (line 712)
```
Dependencies: [selectedVideo, videos]
Reads: selectedVideo, videos
Writes: selectedVideo, videoUrl, markers
Purpose: Validate selection, auto-select first video, load video
CRITICAL: Can cause loop if not careful with setSelectedVideo
```

### Effect 6: URL Refresh Timer (line 743)
```
Dependencies: [urlGeneratedAt, selectedVideo, videoUrl]
Reads: urlGeneratedAt, selectedVideo, videoUrl, videoRef
Writes: (triggers loadVideo which sets videoUrl, urlGeneratedAt)
Purpose: Auto-refresh signed URLs at 45 minutes
```

### Effect 7: Deferred Camera Switch (line 798)
```
Dependencies: [videos]
Reads: deferredCameraSwitch.current, videos
Writes: (calls handleCameraSwitch)
Purpose: Process pending camera switch when video becomes available
```

### Effect 8: Video Element Events (line 813)
```
Dependencies: [selectedVideo, gameId]
Reads: videoRef, selectedVideo, gameId
Writes: currentTime, isPlaying, videoDuration
Purpose: Attach DOM event listeners to video element
```

### Effect 9: Pending Seek (line 846)
```
Dependencies: [pendingSyncSeek, videoDuration, shouldResumePlayback, videoOffsetMs, targetGameTimeMs]
Reads: pendingSyncSeek, videoDuration, videoRef, targetGameTimeMs, videoOffsetMs
Writes: currentTime, gameTimelinePositionMs, seekLockRef, pendingSyncSeek, shouldResumePlayback
Purpose: Apply seek after video metadata loads
CRITICAL: Part of camera switch state machine
```

### Effect 10: Quarter Scores (line 915)
```
Dependencies: [gameId, game]
Reads: gameId, game
Writes: quarterScores, scoreMismatch
Purpose: Load score data
```

### Effect 11: Coverage Check (line 923)
```
Dependencies: [targetGameTimeMs, pendingCameraId, videoOffsetMs, clipDurationMs, videoDuration, selectedVideo?.id, selectedVideo?.sync_offset_seconds, offsetDataVideoId]
Reads: All deps + videoRef
Writes: targetGameTimeMs, pendingCameraId, isSwitchingCamera, shouldResumePlayback
Purpose: Verify camera switch landed in valid coverage
CRITICAL: Complex race condition handling - waits for correct camera data
```

### Effect 12: Video Pause for Overlay (line 1021)
```
Dependencies: [pendingCameraId, targetGameTimeMs]
Reads: videoRef, pendingCameraId, targetGameTimeMs
Writes: (pauses video element)
Purpose: Pause video when "No film" overlay shows
```

### Effect 13: Click Outside (line 1043)
```
Dependencies: [showPeriodMarkerMenu, showAddMarkerMenu]
Reads: showPeriodMarkerMenu, showAddMarkerMenu
Writes: showPeriodMarkerMenu, showAddMarkerMenu
Purpose: Close menus on outside click
```

### Effect 14: Lane Initialization (line 1596)
```
Dependencies: [timelineLanes, selectedVideo?.id, currentLaneNumber]
Reads: timelineLanes, selectedVideo, currentLaneNumber
Writes: currentLaneNumber
Purpose: Set initial lane based on selected video
```

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PAGE LOAD                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Effect 2       │
                    │  (gameId)       │
                    │  fetchGame()    │
                    │  fetchVideos()  │
                    └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Effect 3   │  │  Effect 5   │  │  FilmBridge │
    │  (game)     │  │  (videos)   │  │  sets lanes │
    │  fetchPlays │  │  select     │  │             │
    │  fetchPlayers│  │  video      │  │             │
    └─────────────┘  └──────┬──────┘  └──────┬──────┘
                            │                │
                            ▼                ▼
                   ┌─────────────┐  ┌─────────────┐
                   │  Effect 8   │  │  Effect 4   │
                   │  attach DOM │  │  (lanes)    │
                   │  events     │  │  fetchPlays │
                   └─────────────┘  └─────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     CAMERA SWITCH FLOW                           │
└─────────────────────────────────────────────────────────────────┘

User clicks camera button
         │
         ▼
┌─────────────────────┐
│ handleCameraSwitch  │
│ - set pendingCameraId│
│ - set targetGameTimeMs│
│ - set isSwitchingCamera│
│ - call loadVideo    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ loadVideo()         │
│ - set videoUrl      │
│ - set selectedVideo │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Effect 8            │────▶│ Effect 9            │
│ video.loadedmetadata│     │ (pendingSyncSeek)   │
│ sets videoDuration  │     │ apply seek          │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │ Effect 11           │
                            │ (coverage check)    │
                            │ verify offset data  │
                            │ clear switching state│
                            └─────────────────────┘
```

---

## Race Condition Patterns

### Pattern 1: Stale Offset Data
**Location:** Effect 11 (coverage check)
**Problem:** After camera switch, offset data might still be for old camera
**Solution:** Check `offsetDataVideoId === pendingCameraId` before proceeding

### Pattern 2: Seek Lock
**Location:** Effect 9 (pending seek)
**Problem:** `onTimeUpdate` fires immediately after seek, overwrites `gameTimelinePositionMs`
**Solution:** `seekLockRef` blocks updates for 500ms after seek

### Pattern 3: Video Not Yet Loaded
**Location:** Effect 7 (deferred camera switch)
**Problem:** User clicks camera before `videos` array contains it
**Solution:** Store in `deferredCameraSwitch.current`, process when videos update

### Pattern 4: URL Expiration
**Location:** Effect 6 (URL refresh)
**Problem:** Signed URLs expire after 1 hour
**Solution:** Timer at 45 minutes, restore playback position after refresh

---

## Recommended State Groupings for Context

Based on this analysis, the state should be grouped into these contexts:

### FilmPlaybackContext
- `selectedVideo`, `videoUrl`, `videoLoadError`
- `currentTime`, `videoDuration`, `isPlaying`
- `urlGeneratedAt`, `urlRefreshAttempted`

### FilmCameraContext
- `videoOffsetMs`, `clipDurationMs`, `offsetDataVideoId`
- `isSwitchingCamera`, `pendingCameraId`, `pendingSyncSeek`
- `shouldResumePlayback`, `targetGameTimeMs`
- `gameTimelinePositionMs`, `timelineDurationMs`
- `timelineLanes`, `currentLaneNumber`
- `isVirtuallyPlaying`

### FilmTaggingContext
- `tagStartTime`, `tagEndTime`, `showTagModal`
- `editingInstance`, `taggingMode`, `isTaggingOpponent`
- `isSavingPlay`, `driveAssignMode`, `currentDrive`

### FilmDataContext
- `game`, `videos`, `plays`, `playInstances`
- `players`, `formations`, `drives`, `markers`

---

## Next Steps (Task 3.2)

1. Create `FilmContext` combining all state
2. Implement `useReducer` with typed actions
3. Create selector hooks for derived state
4. Migrate effects to use context dispatch
