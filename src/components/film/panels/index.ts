/**
 * Film Panels Module
 *
 * Extracted panel components from the film tagging page.
 *
 * @module components/film/panels
 * @since Phase 3 - Component Decomposition
 */

export {
  VideoPlaybackPanel,
  createVideoHandlers,
  type VideoPlaybackState,
  type CameraSyncState,
  type VideoPlaybackHandlers,
  type VideoPlaybackPanelProps,
  type VideoPlaybackPanelRef,
} from './VideoPlaybackPanel';

export {
  TaggingModeSelector,
  inferTaggingModeFromPlayType,
  isSpecialTeamsMode,
  isDefenseMode,
  TAGGING_MODE_LABELS,
  TAGGING_MODE_DESCRIPTIONS,
  type TaggingModeSelectorProps,
} from './TaggingModeSelector';

export {
  TaggingFormContainer,
  TaggingFormSection,
  TaggingFormRow,
  TaggingFormField,
  type TaggingFormContainerProps,
} from './TaggingFormContainer';
