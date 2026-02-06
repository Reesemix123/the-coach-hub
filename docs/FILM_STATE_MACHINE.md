# Film Tag Page - State Machine Documentation

> **Task 3.1** from REFACTOR_PLAN.md
> **Updated:** 2026-02-03
> **Source:** `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (6,657 lines)

---

## Overview

The tag page has **71 useState declarations**, **14 useEffect hooks**, and **7 useRef declarations**. The FilmContext already defines the target state shape but is only connected via a bridge (`useSyncLocalStateToContext`) that syncs 9 of the 71 state variables. The remaining 62 are local-only.

---

## 1. useState Declarations (71 total)

### Core Data (7 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 355 | `game` | `Game \| null` | `null` | `data.game` |
| 362 | `plays` | `Play[]` | `[]` | `data.plays` |
| 363 | `playInstances` | `PlayInstance[]` | `[]` | `data.playInstances` |
| 364 | `players` | `any[]` | `[]` | `data.players` |
| 365 | `formations` | `string[]` | `[]` | `data.formations` |
| 366 | `drives` | `Drive[]` | `[]` | `data.drives` |
| 462 | `markers` | `VideoTimelineMarker[]` | `[]` | `data.markers` |

### Video Playback (7 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 356 | `videos` | `Video[]` | `[]` | `data.videos` |
| 357 | `selectedVideo` | `Video \| null` | `null` | `playback.selectedVideo` |
| 358 | `videoUrl` | `string` | `''` | `playback.videoUrl` |
| 359 | `videoLoadError` | `string \| null` | `null` | `playback.videoLoadError` |
| 360 | `urlGeneratedAt` | `number \| null` | `null` | `playback.urlGeneratedAt` |
| 361 | `urlRefreshAttempted` | `boolean` | `false` | `playback.urlRefreshAttempted` |
| 399 | `isPlaying` | `boolean` | `false` | `playback.isPlaying` |

### Video Time (2 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 381 | `currentTime` | `number` | `0` | `playback.currentTime` |
| 382 | `videoDuration` | `number` | `0` | `playback.videoDuration` |

### Camera Sync (11 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 375 | `cameraLimit` | `number` | `1` | `ui.cameraLimit` |
| 378 | `pendingSyncSeek` | `number \| null` | `null` | `camera.pendingSyncSeek` |
| 379 | `shouldResumePlayback` | `boolean` | `false` | `camera.shouldResumePlayback` |
| 384 | `videoOffsetMs` | `number` | `0` | `camera.videoOffsetMs` |
| 385 | `clipDurationMs` | `number` | `0` | `camera.clipDurationMs` |
| 386 | `offsetDataVideoId` | `string \| null` | `null` | `camera.offsetDataVideoId` |
| 387 | `targetGameTimeMs` | `number \| null` | `null` | `camera.targetGameTimeMs` |
| 388 | `pendingCameraId` | `string \| null` | `null` | `camera.pendingCameraId` |
| 389 | `gameTimelinePositionMs` | `number` | `0` | `camera.gameTimelinePositionMs` |
| 391 | `isSwitchingCamera` | `boolean` | `false` | `camera.isSwitchingCamera` |
| 383 | `timelineDurationMs` | `number` | `0` | `camera.timelineDurationMs` |

### Timeline (3 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 390 | `timelineLanes` | `CameraLane[]` | `[]` | `timeline.timelineLanes` |
| 395 | `currentLaneNumber` | `number` | `1` | `timeline.currentLaneNumber` |
| 398 | `isVirtuallyPlaying` | `boolean` | `false` | `timeline.isVirtuallyPlaying` |

### Tagging Form (9 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 400 | `showTagModal` | `boolean` | `false` | `tagging.showTagModal` |
| 401 | `editingInstance` | `PlayInstance \| null` | `null` | `tagging.editingInstance` |
| 402 | `tagStartTime` | `number` | `0` | `tagging.tagStartTime` |
| 403 | `tagEndTime` | `number \| null` | `null` | `tagging.tagEndTime` |
| 414 | `taggingMode` | `TaggingMode` | `'offense'` | `tagging.taggingMode` |
| 486 | `isSavingPlay` | `boolean` | `false` | `tagging.isSavingPlay` |
| 367 | `currentDrive` | `Drive \| null` | `null` | `tagging.currentDrive` |
| 368 | `driveAssignMode` | `'current' \| 'new' \| 'select'` | `'current'` | `tagging.driveAssignMode` |
| 413 | `isSettingEndTime` | `boolean` | `false` | -- (local only) |

### Upload (4 vars) -- LOCAL ONLY

| Line | Variable | Type | Initial |
|------|----------|------|---------|
| 404 | `uploadingVideo` | `boolean` | `false` |
| 405 | `uploadProgress` | `number` | `0` |
| 406 | `uploadStatus` | `string` | `''` |
| 407 | `uploadDetails` | `{ speed, remaining, uploaded, total } \| null` | `null` |

### AI Tagging (4 vars) -- LOCAL ONLY

| Line | Variable | Type | Initial |
|------|----------|------|---------|
| 418 | `aiPredictions` | `AITagPredictions \| null` | `null` |
| 419 | `aiError` | `string \| null` | `null` |
| 421 | `aiFilledFields` | `Record<string, number>` | `{}` |
| 483 | `autoPopulatedFields` | `string[]` | `[]` |

### Filters (3 vars) -- LOCAL ONLY

| Line | Variable | Type | Initial |
|------|----------|------|---------|
| 457 | `filterQuarter` | `string` | `'all'` |
| 458 | `filterOffenseDefense` | `string` | `'all'` |
| 459 | `filterDrive` | `string` | `'all'` |

### Markers UI (5 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 463 | `showMarkerPanel` | `boolean` | `false` | -- (local) |
| 464 | `markersCollapsed` | `boolean` | `false` | -- (local) |
| 465 | `showPeriodMarkerMenu` | `boolean` | `false` | `ui.showPeriodMarkerMenu` |
| 466 | `showAddMarkerMenu` | `boolean` | `false` | `ui.showAddMarkerMenu` |
| 467 | `editingMarker` | `VideoTimelineMarker \| null` | `null` | -- (local) |

### Tagging Tier (3 vars)

| Line | Variable | Type | Initial |
|------|----------|------|---------|
| 471 | `taggingTier` | `TaggingTier \| null` | `null` |
| 472 | `showTierSelector` | `boolean` | `false` |
| 473 | `showTierUpgrade` | `boolean` | `false` |

### Scoring / Film Status (5 vars)

| Line | Variable | Type | Initial | Context Field |
|------|----------|------|---------|---------------|
| 476 | `quarterScores` | `GameScoreBreakdown \| null` | `null` | `ui.quarterScores` (partial match) |
| 477 | `scoreMismatch` | `ScoreMismatchResult \| null` | `null` | `ui.scoreMismatch` (partial match) |
| 478 | `filmAnalysisStatus` | `FilmAnalysisStatus` | `'not_started'` | -- |
| 479 | `showTaggingCompleteModal` | `boolean` | `false` | -- (local) |
| 480 | `finalScoreInputs` | `{ teamScore, opponentScore }` | `{ '', '' }` | -- (local) |

### Misc UI (7 vars) -- LOCAL ONLY

| Line | Variable | Type | Initial |
|------|----------|------|---------|
| 371 | `selectedVideoIds` | `Set<string>` | `new Set()` |
| 372 | `showCombineModal` | `boolean` | `false` |
| 376 | `showCameraUpload` | `boolean` | `false` |
| 415 | `analyticsTier` | `string` | `'premium'` |
| 416 | `selectedTab` | `string` | `'context'` |
| 417 | `selectedSpecialTeamsUnit` | `SpecialTeamsUnit \| ''` | `''` |
| 453 | `selectedTacklers` | `string[]` | `[]` |
| 454 | `primaryTacklerId` | `string` | `''` |

---

## 2. useRef Declarations (7 total)

| Ref | Line | Type | Purpose |
|-----|------|------|---------|
| `videoRef` | 350 | `HTMLVideoElement` | Direct video element control (play, pause, seek, currentTime) |
| `fileInputRef` | 377 | `HTMLInputElement` | Hidden file input for camera upload |
| `lastCameraSwitchTime` | 392 | `number` | Debounce rapid camera clicks (500ms threshold) |
| `deferredCameraSwitch` | 393 | `{ videoId, gameTime? } \| null` | Pending camera switch when target video not yet in state |
| `seekLockRef` | 394 | `boolean` | Prevents onTimeUpdate from overwriting gameTimelinePositionMs for 500ms after programmatic seek |
| `virtualPlaybackRef` | 396 | `NodeJS.Timeout \| null` | Interval timer for advancing timeline during coverage gaps |
| `virtualPlaybackTargetRef` | 397 | `number \| null` | Target time for virtual playback stop condition |

---

## 3. useEffect Hooks (14 total)

### Effect 1: Virtual Playback Cleanup (line ~677)
- **Deps:** `[]`
- **Reads:** nothing
- **Writes:** nothing
- **Side effects:** Clears `virtualPlaybackRef` interval on unmount
- **Timing:** Independent

### Effect 2: Initial Data Fetch (line ~685)
- **Deps:** `[gameId]`
- **Reads:** `gameId`
- **Writes:** `game`, `taggingMode`, `taggingTier`, `filmAnalysisStatus`, `videos`, `drives`, `currentDrive`, `driveAssignMode`, `cameraLimit`
- **Side effects:** 4 parallel Supabase queries (fetchGame, fetchVideos, fetchDrives, fetchCameraLimit)
- **Timing:** Must complete before Effects 3, 4, 5, 7, 10

### Effect 3: Team-Dependent Data Fetch (line ~694)
- **Deps:** `[game]`
- **Reads:** `game.team_id`
- **Writes:** `plays`, `players`, `formations`, `analyticsTier`
- **Side effects:** 4 parallel Supabase queries
- **Timing:** Depends on Effect 2 setting `game`

### Effect 4: Fetch Play Instances from Timeline (line ~704)
- **Deps:** `[timelineLanes]`
- **Reads:** `timelineLanes`
- **Writes:** `playInstances`, `filmAnalysisStatus`
- **Side effects:** Supabase query to play_instances + playbook_plays
- **Timing:** Depends on `timelineLanes` populated by TagPageUnifiedTimeline component

### Effect 5: Video Selection and Loading (line ~714)
- **Deps:** `[selectedVideo, videos]`
- **Reads:** `selectedVideo`, `videos`
- **Writes:** `selectedVideo` (self-trigger!), `videoUrl`, `urlGeneratedAt`, `urlRefreshAttempted`, `videoLoadError`, `markers`
- **Side effects:** Supabase Storage signed URL generation, marker query
- **Timing:** Depends on Effect 2 populating `videos`. **CAUTION: can self-trigger**

### Effect 6: Auto-Refresh Signed URLs (line ~745)
- **Deps:** `[urlGeneratedAt, selectedVideo, videoUrl]`
- **Reads:** `urlGeneratedAt`, `selectedVideo`, `videoUrl`
- **Writes:** `videoUrl`, `urlGeneratedAt`, `urlRefreshAttempted` (via loadVideo callback)
- **Side effects:** setTimeout (45 min), loadedmetadata event listener
- **Timing:** Depends on Effect 5 setting `urlGeneratedAt`

### Effect 7: Deferred Camera Switch (line ~800)
- **Deps:** `[videos]`
- **Reads:** `videos`, `deferredCameraSwitch` ref
- **Writes:** Indirectly via `handleCameraSwitch` (many camera state vars)
- **Side effects:** Triggers camera switch if deferred target now exists
- **Timing:** Depends on videos array update

### Effect 8: Video Event Listeners (line ~815)
- **Deps:** `[selectedVideo, gameId]`
- **Reads:** `selectedVideo`, `gameId`
- **Writes:** `currentTime`, `isPlaying`, `videoDuration`
- **Side effects:** 4 DOM event listeners on video element, filmSessionService on pause
- **Timing:** Depends on videoRef being rendered

### Effect 9: Apply Pending Seek (line ~848)
- **Deps:** `[pendingSyncSeek, videoDuration, shouldResumePlayback, videoOffsetMs, targetGameTimeMs]`
- **Reads:** all deps above
- **Writes:** `currentTime`, `gameTimelinePositionMs`, `pendingSyncSeek` (clears), `shouldResumePlayback` (clears)
- **Side effects:** videoRef.currentTime seek, videoRef.play(), seekLockRef for 500ms
- **Timing:** Depends on pending seek + video metadata loaded

### Effect 10: Quarter Scores and Mismatch (line ~917)
- **Deps:** `[gameId, game]`
- **Reads:** `gameId`, `game`
- **Writes:** `quarterScores`, `scoreMismatch`
- **Side effects:** gameScoreService API calls
- **Timing:** Depends on Effect 2 setting `game`

### Effect 11: Camera Switch Coverage Verification (line ~925)
- **Deps:** `[targetGameTimeMs, pendingCameraId, videoOffsetMs, clipDurationMs, videoDuration, selectedVideo?.id, selectedVideo?.sync_offset_seconds, offsetDataVideoId]`
- **Reads:** all deps above
- **Writes:** `targetGameTimeMs`, `pendingCameraId`, `isSwitchingCamera`, `shouldResumePlayback`
- **Side effects:** videoRef.play() or videoRef.pause()
- **Timing:** **Most timing-sensitive.** Needs selectedVideo, offset data, AND duration all updated for new camera.

### Effect 12: Pause During Overlay (line ~1023)
- **Deps:** `[pendingCameraId, targetGameTimeMs]`
- **Reads:** `pendingCameraId`, `targetGameTimeMs`
- **Writes:** none
- **Side effects:** videoRef.pause()
- **Timing:** Runs in parallel with Effect 11

### Effect 13: Click-Outside for Marker Menus (line ~1045)
- **Deps:** `[showPeriodMarkerMenu, showAddMarkerMenu]`
- **Reads/Writes:** `showPeriodMarkerMenu`, `showAddMarkerMenu`
- **Side effects:** Document click listener
- **Timing:** Independent

### Effect 14: Lane Init from Selected Video (line ~1598)
- **Deps:** `[timelineLanes, selectedVideo?.id, currentLaneNumber]`
- **Reads:** `timelineLanes`, `selectedVideo`, `currentLaneNumber`
- **Writes:** `currentLaneNumber`
- **Timing:** Depends on timelineLanes + selectedVideo

---

## 4. Effect Dependency Graph

```
Page Mount
    |
    v
Effect 2: fetchGame, fetchVideos, fetchDrives, fetchCameraLimit
    |                    |
    v                    v
Effect 3:             Effect 5: Video Selection & Loading
(team data)              |           |
    |                    v           v
Effect 10:          Effect 6:    Effect 8: Event Listeners
(scores)            (URL refresh)    |
                                     v
                                Effect 14: Lane Init

TagPageUnifiedTimeline component populates timelineLanes
    |
    v
Effect 4: fetchPlayInstances

Camera Switch (user action) --> handleCameraSwitch()
    |
    v
Effect 9: Apply Pending Seek  <-->  Effect 11: Coverage Verification
                                         |
                                         v
                                    Effect 12: Pause During Overlay
```

---

## 5. Race Conditions Identified

### RC-1: Effect 5 Self-Triggering Loop
Effect 5 depends on `[selectedVideo, videos]` and can call `setSelectedVideo`. Guarded by validity checks, but fragile.

### RC-2: Camera Switch State Race (Effects 9 + 11)
Both depend on `videoDuration`. If `videoDuration` updates before `offsetDataVideoId`, Effect 11 may evaluate with stale offset data. Guarded by `offsetDataVideoId` check.

### RC-3: URL Refresh During Camera Switch (Effects 6 + 5)
45-min timer could fire during a camera switch. Timer cleanup runs on dependency change but there's a window where callback fires after `selectedVideo` changes.

### RC-4: Deferred Camera Switch + Video Selection (Effects 7 + 5)
When `videos` updates, both effects run. Effect 5 may auto-select a video, then Effect 7 may switch to a different one.

### RC-5: Film Status Stale Closure (Effect 4)
`filmAnalysisStatus` captured in closure when Effect 4 runs. If updated between trigger and async completion, stale value may cause incorrect status update.

### RC-6: Parallel Initial Fetches (Effect 2)
4 async fetches without `Promise.all`. Resolution order is nondeterministic, but downstream effects are independent so no functional race.

---

## 6. Migration Plan

### Move to Context (shared across panels) -- ~43 vars
All variables with a "Context Field" mapping in the tables above. These need to be readable/writable by child panel components (VideoPlaybackPanel, TaggingPanel, TimelinePanel).

### Stay Local (panel-specific or ephemeral) -- ~28 vars

| Category | Variables | Reason |
|----------|-----------|--------|
| Upload | `uploadingVideo`, `uploadProgress`, `uploadStatus`, `uploadDetails` | Upload UI only |
| AI Tagging | `aiPredictions`, `aiError`, `aiFilledFields`, `autoPopulatedFields` | Tagging form only |
| Filters | `filterQuarter`, `filterOffenseDefense`, `filterDrive` | Play list panel only |
| Markers UI | `showMarkerPanel`, `markersCollapsed`, `editingMarker` | Marker panel only |
| Tier Modals | `showTierSelector`, `showTierUpgrade` | Modal toggles, local |
| Scoring Modals | `showTaggingCompleteModal`, `finalScoreInputs` | Modal toggles, local |
| Form | `isSettingEndTime`, `selectedTab`, `selectedSpecialTeamsUnit`, `selectedTacklers`, `primaryTacklerId` | Tagging form internal |
| Video Combine | `selectedVideoIds`, `showCombineModal` | Video management UI |
| Camera Upload | `showCameraUpload` | Upload toggle |

### Refs -- Stay in tag page or move to hooks
All 7 refs are tightly coupled to video element manipulation. They belong in the tag page or in a `useVideoPlayback` hook.

### Effect Migration Strategy

| Effect | Target Location | Notes |
|--------|----------------|-------|
| Effects 5, 6, 8, 9 | `useVideoPlayback` hook | Video selection, URL refresh, event listeners, seek |
| Effects 11, 12, 14 | `useCameraSync` hook | Coverage verification, overlay pause, lane init |
| Effects 2, 3, 4, 10 | `useFilmData` hook (or stay in page) | Data fetching on mount |
| Effect 1 | Stay in page | Cleanup only |
| Effect 7 | Move with camera logic | Deferred camera switch |
| Effect 13 | `useClickOutside` utility hook | Generic behavior |

---

*This document is a living reference for Phase 3 of the film refactor.*
