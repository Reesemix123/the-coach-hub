'use client';

import { AlertCircle } from 'lucide-react';
import type { TaggingTier } from '@/types/football';

interface IncompletePlayIndicatorProps {
  tier: TaggingTier;
  playData: Record<string, unknown>;
  unitType: 'offense' | 'defense' | 'specialTeams';
  size?: 'sm' | 'md';
}

/**
 * Visual indicator for plays missing data for the current tier level
 * Shows on play tiles/list items
 */
export function IncompletePlayIndicator({
  tier,
  playData,
  unitType,
  size = 'sm'
}: IncompletePlayIndicatorProps) {
  // Check if play is missing required fields for the current tier
  const isMissingData = checkMissingTierData(tier, playData, unitType);

  if (!isMissingData) return null;

  const sizeStyles = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div
      className="inline-flex items-center justify-center text-amber-500"
      title="This play is missing some data for the current tier"
    >
      <AlertCircle className={sizeStyles} />
    </div>
  );
}

/**
 * Check if a play is missing required fields for the tier
 */
function checkMissingTierData(
  tier: TaggingTier,
  playData: Record<string, unknown>,
  unitType: 'offense' | 'defense' | 'specialTeams'
): boolean {
  // Define required fields per tier and unit type
  const requiredFields: Record<TaggingTier, Record<string, string[]>> = {
    quick: {
      offense: ['result_type', 'yards_gained'],
      defense: ['result_type', 'yards_gained'],
      specialTeams: ['special_teams_unit', 'kick_result']
    },
    standard: {
      offense: ['result_type', 'yards_gained', 'play_type'],
      defense: ['result_type', 'yards_gained', 'tackler_ids'],
      specialTeams: ['special_teams_unit', 'kick_result']
    },
    comprehensive: {
      offense: ['result_type', 'yards_gained', 'play_type', 'qb_id', 'ball_carrier_id'],
      defense: ['result_type', 'yards_gained', 'tackler_ids'],
      specialTeams: ['special_teams_unit', 'kick_result']
    }
  };

  const required = requiredFields[tier][unitType] || [];

  // Check if any required field is missing or empty
  for (const field of required) {
    const value = playData[field];
    if (value === null || value === undefined || value === '') {
      return true;
    }
    // Check for empty arrays
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get a summary of what data is missing
 */
export function getMissingDataSummary(
  tier: TaggingTier,
  playData: Record<string, unknown>,
  unitType: 'offense' | 'defense' | 'specialTeams'
): string[] {
  const missing: string[] = [];

  // Check Standard tier fields
  if (tier === 'standard' || tier === 'comprehensive') {
    if (unitType === 'offense') {
      if (!playData.qb_id) missing.push('QB');
      if (!playData.ball_carrier_id) missing.push('Ball Carrier');
      if (!playData.direction) missing.push('Direction');
    }
    if (unitType === 'defense') {
      const tacklers = playData.tackler_ids as string[] | undefined;
      if (!tacklers || tacklers.length === 0) missing.push('Tacklers');
    }
  }

  // Check Comprehensive tier fields
  if (tier === 'comprehensive') {
    if (unitType === 'offense') {
      if (!playData.lt_block_result) missing.push('OL Grades');
    }
    if (unitType === 'defense') {
      const missedTackles = playData.missed_tackle_ids as string[] | undefined;
      // Missed tackles are optional, but we track them
    }
  }

  return missing;
}

export default IncompletePlayIndicator;
