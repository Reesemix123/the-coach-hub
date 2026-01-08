# Film System Refactor Plan

> **Status:** Planning Complete - Awaiting Approval to Begin Phase 1
> **Last Updated:** 2025-01-08
> **Owner:** [Your Name]

This document tracks the phased refactoring of the film upload and multi-camera playback system. Each phase must be completed and validated before proceeding to the next.

---

## Overview

### Problem Statement
The film tagging page (`src/app/teams/[teamId]/film/[gameId]/tag/page.tsx`) is a 6,493-line "god component" with 70 useState declarations and 13 useEffect hooks. This architecture leads to:
- Recurring bugs that are difficult to isolate
- Fixes in one area breaking other areas
- Performance inconsistencies
- Difficult onboarding for new developers

### Goals
1. Improve reliability through better error handling and state management
2. Improve maintainability through component decomposition
3. Improve testability through service extraction
4. Prepare architecture for future scaling (third-party video services, new features)

### Timeline
- **Phase 1:** 2 weeks + 1 week soak
- **Phase 2:** 3 weeks + 2 weeks soak
- **Phase 3:** 3-4 weeks + 1 week soak
- **Phase 4:** 2 weeks
- **Total:** 14-16 weeks

---

## Pre-Phase: Baseline Metrics

> Complete this section before starting Phase 1.

### Current Error Rates
- [ ] Video playback errors per session: _____________
- [ ] Camera sync failures per switch: _____________
- [ ] Play tagging errors per submission: _____________
- [ ] Signed URL failures per day: _____________

### Data Sources
- [ ] Supabase logs reviewed for video-related errors
- [ ] Browser console errors documented (if any user reports exist)
- [ ] Known bugs listed below

### Known Issues (Pre-Refactor)
| Issue | Severity | Description |
|-------|----------|-------------|
| Signed URL expiration | P0 | URLs expire after 1 hour with no refresh mechanism |
| Double-submit bug | P1 | Fixed in recent commit, verify still resolved |
| Video 400 error loop | P1 | Fixed in recent commit, verify still resolved |
| [Add others as discovered] | | |

### Baseline Captured
- [ ] Date: _____________
- [ ] Captured by: _____________

---

## Phase 1: Stabilization

**Goal:** Fix immediate reliability issues without changing architecture.

**Duration:** 2 weeks implementation + 1 week soak

**Git Tag Before:** `pre-phase-1`
**Git Branch:** `refactor/film-phase-1`

### Prerequisites
- [ ] Baseline metrics documented above
- [ ] All team members notified of upcoming changes
- [ ] Testing environment verified

### Tasks

#### Task 1.1: Add ErrorBoundary Wrapper
- **Definition of Done:**
  - ErrorBoundary component wraps the video player section
  - Video errors display recovery UI instead of crashing page
  - User can click "Reload Video" to recover
  - Error is logged to console with context
- **Estimated Effort:** 2 hours
- **Files to Change:**
  - [ ] `src/components/film/VideoErrorBoundary.tsx` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (wrap video section)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 1.2: Add URL Refresh Mechanism
- **Definition of Done:**
  - Signed URLs auto-refresh at 45-minute intervals
  - Video playback continues uninterrupted during refresh
  - Refresh happens in background without user action
  - Console logs confirm refresh cycle
- **Estimated Effort:** 4 hours
- **Files to Change:**
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (add refresh logic)
  - [ ] Consider extracting to `useSignedUrlRefresh` hook
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 1.3: Add URL Refresh on Error Detection
- **Definition of Done:**
  - When video element fires error event, attempt URL refresh before showing error
  - If refresh succeeds, video resumes automatically
  - If refresh fails, show user-friendly error with "Refresh" button
  - 401/403 errors specifically trigger refresh attempt
- **Estimated Effort:** 2 hours
- **Files to Change:**
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (modify onError handler)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 1.4: Extract VideoPlaybackState Hook
- **Definition of Done:**
  - New `useVideoPlaybackState` hook encapsulates:
    - `videoUrl`, `videoRef`, `currentTime`, `duration`, `isPlaying`
    - `playbackRate`, `videoLoadError`, `videoDuration`
  - Tag page imports and uses the hook
  - No behavior changes - pure extraction
  - Hook is in separate file with JSDoc comments
- **Estimated Effort:** 4 hours
- **Files to Change:**
  - [ ] `src/hooks/film/useVideoPlaybackState.ts` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use hook)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 1.5: Extract CameraState Hook
- **Definition of Done:**
  - New `useCameraState` hook encapsulates:
    - `cameras`, `primaryCamera`, `selectedCamera`, `selectedVideo`
    - `syncOffsets`, `videoOffsetMs`, `clipDurationMs`
    - `isSwitchingCamera`, `pendingCameraId`, `pendingSyncSeek`
  - Tag page imports and uses the hook
  - No behavior changes - pure extraction
- **Estimated Effort:** 4 hours
- **Files to Change:**
  - [ ] `src/hooks/film/useCameraState.ts` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use hook)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 1.6: Add Loading State Machine
- **Definition of Done:**
  - Unified `useLoadingState` hook or pattern
  - States: `idle`, `loading`, `error`, `success`
  - Applied to: video loading, camera switching, play saving
  - Loading indicators consistent across all operations
- **Estimated Effort:** 3 hours
- **Files to Change:**
  - [ ] `src/hooks/useLoadingState.ts` (new, optional)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (apply pattern)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

### Phase 1 Completion Checklist
- [ ] All 6 tasks complete
- [ ] All files committed to `refactor/film-phase-1` branch
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Manual testing complete:
  - [ ] Video loads and plays
  - [ ] Camera switching works
  - [ ] Play tagging works
  - [ ] URL refresh verified (wait 45+ min or mock)
  - [ ] Error recovery verified (disconnect network, reconnect)
- [ ] PR created for review
- [ ] PR approved
- [ ] Merged to main
- [ ] Tagged as `post-phase-1`
- [ ] Deployed to production

### Phase 1 Soak Period

**Duration:** 1 week
**Start Date:** _____________
**End Date:** _____________

#### Success Criteria
| Metric | Baseline | Target | Actual |
|--------|----------|--------|--------|
| Video playback errors/session | _____ | ≤ baseline | _____ |
| Camera sync failures/switch | _____ | ≤ baseline | _____ |
| URL expiration errors | _____ | 0 | _____ |
| P0 bugs reported | _____ | 0 | _____ |

#### Daily Monitoring Log
| Date | Errors Observed | Notes |
|------|-----------------|-------|
| Day 1 | | |
| Day 2 | | |
| Day 3 | | |
| Day 4 | | |
| Day 5 | | |
| Day 6 | | |
| Day 7 | | |

#### Issues Discovered
| Issue | Severity | Resolution |
|-------|----------|------------|
| | | |

### Phase 1 Sign-off
- [ ] All soak criteria met
- [ ] No blocking issues discovered
- [ ] Approved to proceed to Phase 2
- [ ] Sign-off Date: _____________
- [ ] Signed by: _____________

---

## Phase 2: Service Extraction

**Goal:** Extract business logic into testable services.

**Duration:** 3 weeks implementation + 2 weeks soak

**Git Tag Before:** `pre-phase-2`
**Git Branch:** `refactor/film-phase-2`

### Prerequisites
- [ ] Phase 1 complete and signed off
- [ ] Phase 1 soak period passed

### Tasks

#### Task 2.1: Create VideoPlaybackManager Class
- **Definition of Done:**
  - Class encapsulates all video element operations
  - Methods: `load(video)`, `play()`, `pause()`, `seek(time)`, `getPosition()`
  - Handles signed URL generation with refresh
  - Event emitters for state changes
  - Used by tag page instead of direct video element manipulation
- **Estimated Effort:** 1 day
- **Files to Change:**
  - [ ] `src/lib/video/VideoPlaybackManager.ts` (new)
  - [ ] `src/lib/video/types.ts` (new - interfaces)
  - [ ] `src/lib/video/providers/SupabaseVideoProvider.ts` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use manager)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 2.2: Create CameraSyncService
- **Definition of Done:**
  - Centralizes all offset calculations
  - Methods: `calculateSyncedTime(gameTime, camera)`, `getSyncOffset(camera)`
  - Handles gap detection logic
  - Pure functions where possible (testable)
- **Estimated Effort:** 4 hours
- **Files to Change:**
  - [ ] `src/lib/services/camera-sync.service.ts` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use service)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 2.3: Migrate Marker Logic to Service
- **Definition of Done:**
  - `video-marker.service.ts` handles all marker CRUD
  - Tag page calls service instead of inline Supabase queries
  - Service includes error handling and validation
- **Estimated Effort:** 4 hours
- **Files to Change:**
  - [ ] `src/lib/services/video-marker.service.ts` (enhance existing)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use service)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 2.4: Create PlayTaggingService
- **Definition of Done:**
  - Encapsulates play instance CRUD
  - Methods: `createPlay(data)`, `updatePlay(id, data)`, `deletePlay(id)`
  - Handles form validation
  - Integrates with AI tagging (calls AI endpoint)
  - Error handling with user-friendly messages
- **Estimated Effort:** 1 day
- **Files to Change:**
  - [ ] `src/lib/services/play-tagging.service.ts` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use service)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

### Phase 2 Completion Checklist
- [ ] All 4 tasks complete
- [ ] All services have JSDoc comments
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Unit tests added for services (optional but recommended):
  - [ ] `CameraSyncService.test.ts`
  - [ ] `PlayTaggingService.test.ts`
- [ ] Manual testing complete (all Phase 1 test cases pass)
- [ ] PR created, reviewed, approved
- [ ] Merged to main, tagged as `post-phase-2`
- [ ] Deployed to production

### Phase 2 Soak Period

**Duration:** 2 weeks
**Start Date:** _____________
**End Date:** _____________

#### Success Criteria
| Metric | Phase 1 Value | Target | Actual |
|--------|---------------|--------|--------|
| Video playback errors | _____ | ≤ Phase 1 | _____ |
| Camera sync success rate | _____ | ≥ 99% | _____ |
| Play tagging success rate | _____ | ≥ 99.5% | _____ |
| Service-level errors logged | N/A | < 10/day | _____ |

#### Weekly Monitoring Log
| Week | Key Observations | Issues |
|------|------------------|--------|
| Week 1 | | |
| Week 2 | | |

### Phase 2 Sign-off
- [ ] All soak criteria met
- [ ] No blocking issues discovered
- [ ] Approved to proceed to Phase 3
- [ ] Sign-off Date: _____________
- [ ] Signed by: _____________

---

## Phase 3: Component Decomposition

**Goal:** Break the god component into focused, maintainable panels.

**Duration:** 3-4 weeks implementation + 1 week soak

**Git Tag Before:** `pre-phase-3`
**Git Branch:** `refactor/film-phase-3`

### Prerequisites
- [ ] Phase 2 complete and signed off
- [ ] Phase 2 soak period passed (2 weeks minimum)
- [ ] State machine documented (Task 3.1)

### Tasks

#### Task 3.1: Document Current State Machine
- **Definition of Done:**
  - All 13 useEffect hooks documented with:
    - Dependencies
    - What state they read
    - What state they write
    - Execution order / timing dependencies
  - State flow diagram created
  - Race condition patterns identified
- **Estimated Effort:** 1 day
- **Files to Change:**
  - [ ] `docs/FILM_STATE_MACHINE.md` (new)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 3.2: Create FilmContext with Reducer
- **Definition of Done:**
  - Single FilmContext replaces 70 useState declarations
  - useReducer pattern with typed actions
  - Actions: `LOAD_VIDEO`, `SWITCH_CAMERA`, `UPDATE_MARKER`, `SUBMIT_PLAY`, etc.
  - Selector hooks for derived state
  - Old useState code commented but preserved (for rollback)
- **Estimated Effort:** 3-5 days
- **Files to Change:**
  - [ ] `src/components/film/context/FilmContext.tsx` (new)
  - [ ] `src/components/film/context/filmReducer.ts` (new)
  - [ ] `src/components/film/context/filmActions.ts` (new)
  - [ ] `src/components/film/context/filmSelectors.ts` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use context)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 3.3: Extract VideoPlaybackPanel
- **Definition of Done:**
  - New component: `VideoPlaybackPanel.tsx`
  - Contains: video element, playback controls, camera switcher
  - Consumes FilmContext for state
  - Max 300 lines
- **Estimated Effort:** 2-3 days
- **Files to Change:**
  - [ ] `src/components/film/panels/VideoPlaybackPanel.tsx` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use panel)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 3.4: Extract TaggingPanel
- **Definition of Done:**
  - New component: `TaggingPanel.tsx`
  - Contains: play form, AI suggestions, score tracking
  - Consumes FilmContext for state
  - Max 400 lines
- **Estimated Effort:** 2 days
- **Files to Change:**
  - [ ] `src/components/film/panels/TaggingPanel.tsx` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use panel)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 3.5: Extract TimelinePanel
- **Definition of Done:**
  - New component: `TimelinePanel.tsx`
  - Contains: timeline editor, camera rows, marker list
  - Consumes FilmContext for state
  - Max 300 lines
- **Estimated Effort:** 2 days
- **Files to Change:**
  - [ ] `src/components/film/panels/TimelinePanel.tsx` (new)
  - [ ] `src/app/teams/[teamId]/film/[gameId]/tag/page.tsx` (use panel)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

#### Task 3.6: Integration Testing
- **Definition of Done:**
  - All panels work together correctly
  - State changes in one panel reflected in others
  - No race conditions in camera sync
  - Performance profiled (no unnecessary re-renders)
- **Estimated Effort:** 2 days
- **Files to Change:**
  - [ ] Testing and bug fixes across all new files
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete
- **Completed Date:** _____________

### Phase 3 Completion Checklist
- [ ] All 6 tasks complete
- [ ] Tag page reduced to < 500 lines
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Performance verified (no render regressions)
- [ ] All Phase 1 + Phase 2 test cases pass
- [ ] PR created, reviewed, approved
- [ ] Merged to main, tagged as `post-phase-3`
- [ ] Deployed to production

### Phase 3 Soak Period

**Duration:** 1 week
**Start Date:** _____________
**End Date:** _____________

#### Success Criteria
| Metric | Phase 2 Value | Target | Actual |
|--------|---------------|--------|--------|
| All Phase 2 metrics | _____ | Maintained | _____ |
| Page load time | _____ | ≤ 10% regression | _____ |
| State sync bugs | N/A | 0 | _____ |

### Phase 3 Sign-off
- [ ] All soak criteria met
- [ ] Approved to proceed to Phase 4
- [ ] Sign-off Date: _____________
- [ ] Signed by: _____________

---

## Phase 4: Hardening

**Goal:** Add tests, telemetry, and documentation.

**Duration:** 2 weeks

**Git Tag Before:** `pre-phase-4`
**Git Branch:** `refactor/film-phase-4`

### Tasks

#### Task 4.1: Add Unit Tests for Services
- **Definition of Done:**
  - Test coverage for:
    - `CameraSyncService`: offset calculations, gap detection
    - `PlayTaggingService`: validation, CRUD operations
    - `VideoPlaybackManager`: state transitions
  - Tests run in CI
- **Estimated Effort:** 2 days
- **Files to Change:**
  - [ ] `src/lib/services/__tests__/camera-sync.service.test.ts`
  - [ ] `src/lib/services/__tests__/play-tagging.service.test.ts`
  - [ ] `src/lib/video/__tests__/VideoPlaybackManager.test.ts`
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete

#### Task 4.2: Add Integration Tests
- **Definition of Done:**
  - E2E tests for critical flows:
    - Video upload flow
    - Camera switching with sync
    - Play tagging submission
  - Tests can run against test database
- **Estimated Effort:** 1 day
- **Files to Change:**
  - [ ] `tests/e2e/film-tagging.spec.ts` (new)
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete

#### Task 4.3: Add Error Telemetry
- **Definition of Done:**
  - Errors logged to monitoring service (Sentry, LogRocket, etc.)
  - Context included: user, team, video, action
  - Dashboard or alerts configured
- **Estimated Effort:** 4 hours
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete

#### Task 4.4: Performance Audit
- **Definition of Done:**
  - React DevTools profiler run
  - Unnecessary re-renders identified and fixed
  - Bundle size checked for regressions
  - Load time measured and documented
- **Estimated Effort:** 4 hours
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete

#### Task 4.5: Update Documentation
- **Definition of Done:**
  - `CLAUDE.md` updated with new architecture
  - Component JSDoc comments complete
  - This file marked as complete
- **Estimated Effort:** 2 hours
- **Status:** [ ] Not Started / [ ] In Progress / [ ] Complete

### Phase 4 Completion
- [ ] All tasks complete
- [ ] PR merged to main
- [ ] Tagged as `post-phase-4`
- [ ] Refactor complete!

---

## Rollback Procedures

### Phase 1 Rollback
```bash
# If issues discovered during Phase 1 soak
git checkout main
git revert --no-commit post-phase-1..HEAD
git commit -m "Rollback Phase 1 refactor"
# Or hard reset
git reset --hard pre-phase-1
```
**Data impact:** None (no schema changes)

### Phase 2 Rollback
```bash
git checkout main
git revert --no-commit post-phase-2..HEAD
git commit -m "Rollback Phase 2 refactor"
```
**Data impact:** None (no schema changes)

### Phase 3 Rollback
```bash
# Phase 3 has higher risk - consider gradual rollback
# Option 1: Full revert
git revert --no-commit post-phase-3..HEAD
git commit -m "Rollback Phase 3 refactor"

# Option 2: Feature flag (if implemented)
# Set FILM_USE_LEGACY_STATE=true in environment
```
**Data impact:** None (no schema changes)

---

## Appendix: Files Changed Summary

Will be populated as tasks complete.

| Phase | Files Added | Files Modified |
|-------|-------------|----------------|
| Phase 1 | | |
| Phase 2 | | |
| Phase 3 | | |
| Phase 4 | | |

---

## Change Log

| Date | Change | By |
|------|--------|-----|
| 2025-01-08 | Initial plan created | Claude |
| | | |
