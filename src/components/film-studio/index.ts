// Main component
export { FilmStudio } from './FilmStudio';

// Context
export { FilmStudioProvider, useFilmStudio } from './context/FilmStudioContext';
export type { FilmStudioState, CameraInfo, CameraSelection, VideoWithUrl } from './context/FilmStudioContext';

// Timeline components
export { UnifiedTimeline } from './timeline/UnifiedTimeline';
export { PhaseMarkerStrip } from './timeline/PhaseMarkerStrip';
export { DraggablePhaseMarker } from './timeline/DraggablePhaseMarker';
export { SwimLaneWithUpload } from './timeline/SwimLaneWithUpload';
export { LaneDropZone } from './timeline/LaneDropZone';

// Layout components
export { CompactVideoPlayer } from './layout/CompactVideoPlayer';
export { SliceModal } from './layout/SliceModal';

// Director's Cut
export { DirectorsCutControls } from './directors-cut/DirectorsCutControls';

// Hooks
export { useClipPositioning } from './hooks/useClipPositioning';
export type { ShiftPlan, ShiftedClip } from './hooks/useClipPositioning';
