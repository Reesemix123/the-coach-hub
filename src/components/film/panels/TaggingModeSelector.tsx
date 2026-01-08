'use client';

/**
 * TaggingModeSelector
 *
 * Extracted component for selecting tagging mode (offense/defense/special teams).
 * Used in the tag modal to control which form fields are shown.
 *
 * @module components/film/panels/TaggingModeSelector
 * @since Phase 3 - Component Decomposition
 */

import React from 'react';
import type { TaggingMode } from '@/components/film/context/types';

// ============================================
// TYPES
// ============================================

export interface TaggingModeSelectorProps {
  /** Current tagging mode */
  mode: TaggingMode;
  /** Callback when mode changes */
  onModeChange: (mode: TaggingMode) => void;
  /** Whether this is an opponent game */
  isOpponentGame?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================
// CONSTANTS
// ============================================

export const TAGGING_MODE_LABELS: Record<TaggingMode, string> = {
  offense: 'Offense',
  defense: 'Defense',
  specialTeams: 'Special Teams',
};

export const TAGGING_MODE_DESCRIPTIONS: Record<TaggingMode, { normal: string; opponent: string }> = {
  offense: {
    normal: 'Offense = your offense',
    opponent: 'Offense = opponent offense',
  },
  defense: {
    normal: 'Defense = opponent plays (what your defense faced)',
    opponent: 'Defense = opponent defense',
  },
  specialTeams: {
    normal: 'Special Teams = kickoffs, punts, field goals, PATs',
    opponent: 'Special Teams = kickoffs, punts, field goals, PATs',
  },
};

// ============================================
// COMPONENT
// ============================================

/**
 * TaggingModeSelector - Toggle between offense/defense/special teams modes
 */
export function TaggingModeSelector({
  mode,
  onModeChange,
  isOpponentGame = false,
  className = '',
}: TaggingModeSelectorProps) {
  const description = TAGGING_MODE_DESCRIPTIONS[mode];
  const descriptionText = isOpponentGame ? description.opponent : description.normal;

  return (
    <div className={`bg-gray-50 rounded-lg p-3 border border-gray-200 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {isOpponentGame ? 'Tagging Opponent:' : 'Tagging:'}
      </label>

      <div className="flex space-x-2">
        {(['offense', 'defense', 'specialTeams'] as TaggingMode[]).map((modeOption) => (
          <button
            key={modeOption}
            type="button"
            onClick={() => onModeChange(modeOption)}
            className={
              mode === modeOption
                ? 'flex-1 px-4 py-2 bg-black text-white rounded-md font-medium transition-colors'
                : 'flex-1 px-4 py-2 bg-white text-gray-700 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors'
            }
          >
            {TAGGING_MODE_LABELS[modeOption]}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-2">{descriptionText}</p>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the appropriate tagging mode based on play type
 */
export function inferTaggingModeFromPlayType(playType: string | undefined): TaggingMode {
  if (!playType) return 'offense';

  const specialTeamsTypes = ['kick', 'pat', 'two_point', 'punt', 'kickoff', 'field_goal'];
  if (specialTeamsTypes.includes(playType)) {
    return 'specialTeams';
  }

  return 'offense';
}

/**
 * Check if a tagging mode uses special teams fields
 */
export function isSpecialTeamsMode(mode: TaggingMode): boolean {
  return mode === 'specialTeams';
}

/**
 * Check if a tagging mode tracks opponent plays
 */
export function isDefenseMode(mode: TaggingMode): boolean {
  return mode === 'defense';
}

export default TaggingModeSelector;
