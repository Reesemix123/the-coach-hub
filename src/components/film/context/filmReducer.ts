/**
 * Film Context Reducer
 *
 * Pure reducer function for film state management.
 * Handles all state transitions for the film tagging page.
 *
 * @module components/film/context/filmReducer
 * @since Phase 3 - Component Decomposition
 */

import type { FilmState } from './types';
import {
  initialFilmState,
  initialTaggingFormState,
  initialVideoPlaybackState,
} from './types';
import type { FilmAction } from './filmActions';
import {
  SET_LOADING,
  SET_ERROR,
  CLEAR_ERROR,
  SET_GAME,
  SET_VIDEOS,
  SET_PLAYS,
  SET_PLAY_INSTANCES,
  ADD_PLAY_INSTANCE,
  UPDATE_PLAY_INSTANCE,
  DELETE_PLAY_INSTANCE,
  SET_PLAYERS,
  SET_FORMATIONS,
  SET_DRIVES,
  ADD_DRIVE,
  UPDATE_DRIVE,
  SET_MARKERS,
  ADD_MARKER,
  DELETE_MARKER,
  SET_SELECTED_VIDEO,
  SET_VIDEO_URL,
  SET_VIDEO_LOAD_ERROR,
  SET_URL_GENERATED_AT,
  SET_URL_REFRESH_ATTEMPTED,
  SET_CURRENT_TIME,
  SET_VIDEO_DURATION,
  SET_IS_PLAYING,
  LOAD_VIDEO,
  SET_VIDEO_OFFSET,
  SET_CLIP_DURATION,
  SET_OFFSET_DATA_VIDEO_ID,
  SET_IS_SWITCHING_CAMERA,
  SET_PENDING_CAMERA_ID,
  SET_PENDING_SYNC_SEEK,
  SET_SHOULD_RESUME_PLAYBACK,
  SET_TARGET_GAME_TIME,
  SET_GAME_TIMELINE_POSITION,
  SET_TIMELINE_DURATION,
  START_CAMERA_SWITCH,
  COMPLETE_CAMERA_SWITCH,
  SET_TIMELINE_LANES,
  SET_CURRENT_LANE_NUMBER,
  SET_IS_VIRTUALLY_PLAYING,
  SET_TAG_START_TIME,
  SET_TAG_END_TIME,
  SET_SHOW_TAG_MODAL,
  SET_EDITING_INSTANCE,
  SET_TAGGING_MODE,
  SET_IS_TAGGING_OPPONENT,
  SET_IS_SAVING_PLAY,
  SET_DRIVE_ASSIGN_MODE,
  SET_CURRENT_DRIVE,
  OPEN_TAG_MODAL,
  CLOSE_TAG_MODAL,
  SET_SHOW_PERIOD_MARKER_MENU,
  SET_SHOW_ADD_MARKER_MENU,
  SET_QUARTER_SCORES,
  SET_SCORE_MISMATCH,
  SET_ANALYTICS_TIER,
  SET_CAMERA_LIMIT,
  RESET_STATE,
  INITIALIZE_FROM_DATA,
} from './filmActions';

/**
 * Film state reducer
 *
 * @param state - Current state
 * @param action - Action to handle
 * @returns New state
 */
export function filmReducer(state: FilmState, action: FilmAction): FilmState {
  switch (action.type) {
    // ============================================
    // DATA LOADING ACTIONS
    // ============================================

    case SET_LOADING:
      return {
        ...state,
        data: {
          ...state.data,
          loading: {
            ...state.data.loading,
            [action.payload.key]: action.payload.state,
          },
        },
      };

    case SET_ERROR:
      return {
        ...state,
        data: {
          ...state.data,
          error: action.payload,
        },
      };

    case CLEAR_ERROR:
      return {
        ...state,
        data: {
          ...state.data,
          error: null,
        },
      };

    // ============================================
    // CORE DATA ACTIONS
    // ============================================

    case SET_GAME:
      return {
        ...state,
        data: {
          ...state.data,
          game: action.payload,
          loading: {
            ...state.data.loading,
            game: 'success',
          },
        },
      };

    case SET_VIDEOS:
      return {
        ...state,
        data: {
          ...state.data,
          videos: action.payload,
          loading: {
            ...state.data.loading,
            videos: 'success',
          },
        },
      };

    case SET_PLAYS:
      return {
        ...state,
        data: {
          ...state.data,
          plays: action.payload,
          loading: {
            ...state.data.loading,
            plays: 'success',
          },
        },
      };

    case SET_PLAY_INSTANCES:
      return {
        ...state,
        data: {
          ...state.data,
          playInstances: action.payload,
          loading: {
            ...state.data.loading,
            playInstances: 'success',
          },
        },
      };

    case ADD_PLAY_INSTANCE:
      return {
        ...state,
        data: {
          ...state.data,
          playInstances: [...state.data.playInstances, action.payload],
        },
      };

    case UPDATE_PLAY_INSTANCE:
      return {
        ...state,
        data: {
          ...state.data,
          playInstances: state.data.playInstances.map((pi) =>
            pi.id === action.payload.id ? action.payload : pi
          ),
        },
      };

    case DELETE_PLAY_INSTANCE:
      return {
        ...state,
        data: {
          ...state.data,
          playInstances: state.data.playInstances.filter(
            (pi) => pi.id !== action.payload
          ),
        },
      };

    case SET_PLAYERS:
      return {
        ...state,
        data: {
          ...state.data,
          players: action.payload,
          loading: {
            ...state.data.loading,
            players: 'success',
          },
        },
      };

    case SET_FORMATIONS:
      return {
        ...state,
        data: {
          ...state.data,
          formations: action.payload,
          loading: {
            ...state.data.loading,
            formations: 'success',
          },
        },
      };

    case SET_DRIVES:
      return {
        ...state,
        data: {
          ...state.data,
          drives: action.payload,
          loading: {
            ...state.data.loading,
            drives: 'success',
          },
        },
      };

    case ADD_DRIVE:
      return {
        ...state,
        data: {
          ...state.data,
          drives: [...state.data.drives, action.payload],
        },
      };

    case UPDATE_DRIVE:
      return {
        ...state,
        data: {
          ...state.data,
          drives: state.data.drives.map((d) =>
            d.id === action.payload.id ? action.payload : d
          ),
        },
      };

    case SET_MARKERS:
      return {
        ...state,
        data: {
          ...state.data,
          markers: action.payload,
          loading: {
            ...state.data.loading,
            markers: 'success',
          },
        },
      };

    case ADD_MARKER:
      return {
        ...state,
        data: {
          ...state.data,
          markers: [...state.data.markers, action.payload],
        },
      };

    case DELETE_MARKER:
      return {
        ...state,
        data: {
          ...state.data,
          markers: state.data.markers.filter((m) => m.id !== action.payload),
        },
      };

    // ============================================
    // VIDEO PLAYBACK ACTIONS
    // ============================================

    case SET_SELECTED_VIDEO:
      return {
        ...state,
        playback: {
          ...state.playback,
          selectedVideo: action.payload,
        },
      };

    case SET_VIDEO_URL:
      return {
        ...state,
        playback: {
          ...state.playback,
          videoUrl: action.payload,
        },
      };

    case SET_VIDEO_LOAD_ERROR:
      return {
        ...state,
        playback: {
          ...state.playback,
          videoLoadError: action.payload,
        },
      };

    case SET_URL_GENERATED_AT:
      return {
        ...state,
        playback: {
          ...state.playback,
          urlGeneratedAt: action.payload,
        },
      };

    case SET_URL_REFRESH_ATTEMPTED:
      return {
        ...state,
        playback: {
          ...state.playback,
          urlRefreshAttempted: action.payload,
        },
      };

    case SET_CURRENT_TIME:
      return {
        ...state,
        playback: {
          ...state.playback,
          currentTime: action.payload,
        },
      };

    case SET_VIDEO_DURATION:
      return {
        ...state,
        playback: {
          ...state.playback,
          videoDuration: action.payload,
        },
      };

    case SET_IS_PLAYING:
      return {
        ...state,
        playback: {
          ...state.playback,
          isPlaying: action.payload,
        },
      };

    case LOAD_VIDEO:
      return {
        ...state,
        playback: {
          ...state.playback,
          selectedVideo: action.payload.video,
          videoUrl: action.payload.url,
          urlGeneratedAt: action.payload.generatedAt,
          videoLoadError: null,
          urlRefreshAttempted: false,
        },
      };

    // ============================================
    // CAMERA SYNC ACTIONS
    // ============================================

    case SET_VIDEO_OFFSET:
      return {
        ...state,
        camera: {
          ...state.camera,
          videoOffsetMs: action.payload,
        },
      };

    case SET_CLIP_DURATION:
      return {
        ...state,
        camera: {
          ...state.camera,
          clipDurationMs: action.payload,
        },
      };

    case SET_OFFSET_DATA_VIDEO_ID:
      return {
        ...state,
        camera: {
          ...state.camera,
          offsetDataVideoId: action.payload,
        },
      };

    case SET_IS_SWITCHING_CAMERA:
      return {
        ...state,
        camera: {
          ...state.camera,
          isSwitchingCamera: action.payload,
        },
      };

    case SET_PENDING_CAMERA_ID:
      return {
        ...state,
        camera: {
          ...state.camera,
          pendingCameraId: action.payload,
        },
      };

    case SET_PENDING_SYNC_SEEK:
      return {
        ...state,
        camera: {
          ...state.camera,
          pendingSyncSeek: action.payload,
        },
      };

    case SET_SHOULD_RESUME_PLAYBACK:
      return {
        ...state,
        camera: {
          ...state.camera,
          shouldResumePlayback: action.payload,
        },
      };

    case SET_TARGET_GAME_TIME:
      return {
        ...state,
        camera: {
          ...state.camera,
          targetGameTimeMs: action.payload,
        },
      };

    case SET_GAME_TIMELINE_POSITION:
      return {
        ...state,
        camera: {
          ...state.camera,
          gameTimelinePositionMs: action.payload,
        },
      };

    case SET_TIMELINE_DURATION:
      return {
        ...state,
        camera: {
          ...state.camera,
          timelineDurationMs: action.payload,
        },
      };

    case START_CAMERA_SWITCH:
      return {
        ...state,
        camera: {
          ...state.camera,
          isSwitchingCamera: true,
          pendingCameraId: action.payload.targetCameraId,
          targetGameTimeMs: action.payload.targetGameTimeMs,
          shouldResumePlayback: action.payload.shouldResumePlayback,
        },
      };

    case COMPLETE_CAMERA_SWITCH:
      return {
        ...state,
        camera: {
          ...state.camera,
          isSwitchingCamera: false,
          pendingCameraId: null,
          targetGameTimeMs: null,
          videoOffsetMs: action.payload.videoOffsetMs,
          clipDurationMs: action.payload.clipDurationMs,
        },
      };

    // ============================================
    // TIMELINE ACTIONS
    // ============================================

    case SET_TIMELINE_LANES:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          timelineLanes: action.payload,
        },
      };

    case SET_CURRENT_LANE_NUMBER:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          currentLaneNumber: action.payload,
        },
      };

    case SET_IS_VIRTUALLY_PLAYING:
      return {
        ...state,
        timeline: {
          ...state.timeline,
          isVirtuallyPlaying: action.payload,
        },
      };

    // ============================================
    // TAGGING FORM ACTIONS
    // ============================================

    case SET_TAG_START_TIME:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          tagStartTime: action.payload,
        },
      };

    case SET_TAG_END_TIME:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          tagEndTime: action.payload,
        },
      };

    case SET_SHOW_TAG_MODAL:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          showTagModal: action.payload,
        },
      };

    case SET_EDITING_INSTANCE:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          editingInstance: action.payload,
        },
      };

    case SET_TAGGING_MODE:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          taggingMode: action.payload,
        },
      };

    case SET_IS_TAGGING_OPPONENT:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          isTaggingOpponent: action.payload,
        },
      };

    case SET_IS_SAVING_PLAY:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          isSavingPlay: action.payload,
        },
      };

    case SET_DRIVE_ASSIGN_MODE:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          driveAssignMode: action.payload,
        },
      };

    case SET_CURRENT_DRIVE:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          currentDrive: action.payload,
        },
      };

    case OPEN_TAG_MODAL:
      return {
        ...state,
        tagging: {
          ...state.tagging,
          showTagModal: true,
          tagStartTime: action.payload.startTime,
          tagEndTime: action.payload.endTime ?? null,
          editingInstance: action.payload.editingInstance ?? null,
        },
      };

    case CLOSE_TAG_MODAL:
      return {
        ...state,
        tagging: {
          ...initialTaggingFormState,
          // Preserve these across modal closes
          taggingMode: state.tagging.taggingMode,
          isTaggingOpponent: state.tagging.isTaggingOpponent,
          driveAssignMode: state.tagging.driveAssignMode,
          currentDrive: state.tagging.currentDrive,
        },
      };

    // ============================================
    // UI ACTIONS
    // ============================================

    case SET_SHOW_PERIOD_MARKER_MENU:
      return {
        ...state,
        ui: {
          ...state.ui,
          showPeriodMarkerMenu: action.payload,
        },
      };

    case SET_SHOW_ADD_MARKER_MENU:
      return {
        ...state,
        ui: {
          ...state.ui,
          showAddMarkerMenu: action.payload,
        },
      };

    case SET_QUARTER_SCORES:
      return {
        ...state,
        ui: {
          ...state.ui,
          quarterScores: action.payload,
        },
      };

    case SET_SCORE_MISMATCH:
      return {
        ...state,
        ui: {
          ...state.ui,
          scoreMismatch: action.payload,
        },
      };

    case SET_ANALYTICS_TIER:
      return {
        ...state,
        ui: {
          ...state.ui,
          analyticsTier: action.payload,
        },
      };

    case SET_CAMERA_LIMIT:
      return {
        ...state,
        ui: {
          ...state.ui,
          cameraLimit: action.payload,
        },
      };

    // ============================================
    // BATCH/RESET ACTIONS
    // ============================================

    case RESET_STATE:
      return initialFilmState;

    case INITIALIZE_FROM_DATA:
      return {
        ...state,
        data: {
          ...state.data,
          game: action.payload.game,
          videos: action.payload.videos,
          drives: action.payload.drives,
          loading: {
            ...state.data.loading,
            game: 'success',
            videos: 'success',
            drives: 'success',
          },
        },
        playback: {
          ...initialVideoPlaybackState,
          // Auto-select first non-virtual video
          selectedVideo:
            action.payload.videos.find((v) => !v.is_virtual) || null,
        },
        ui: {
          ...state.ui,
          cameraLimit: action.payload.cameraLimit,
        },
      };

    default:
      return state;
  }
}
