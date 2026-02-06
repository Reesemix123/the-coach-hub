'use client';

import React, { memo } from 'react';
import type { TaggingTier } from '@/types/football';
import { TierBadge } from '@/components/film/TierBadge';

// ============================================
// TYPES
// ============================================

interface FilmPageHeaderProps {
  gameName: string;
  opponent?: string;
  gameDate?: string;
  taggingTier: TaggingTier | null;
  onBackClick: () => void;
  onTierUpgradeClick: () => void;
}

// ============================================
// COMPONENT
// ============================================

export const FilmPageHeader = memo(function FilmPageHeader({
  gameName,
  opponent,
  gameDate,
  taggingTier,
  onBackClick,
  onTierUpgradeClick,
}: FilmPageHeaderProps) {
  return (
    <div className="mb-6">
      <button
        onClick={onBackClick}
        className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 mb-4 font-medium transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Back to All Games</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-gray-900">{gameName}</h1>
            {taggingTier && (
              <TierBadge
                tier={taggingTier}
                size="md"
                showUpgradeHint={taggingTier !== 'comprehensive'}
                onClick={taggingTier !== 'comprehensive' ? onTierUpgradeClick : undefined}
              />
            )}
          </div>
          {opponent && (
            <p className="text-lg text-gray-600 mt-1">vs {opponent}</p>
          )}
          <p className="text-gray-500">
            {gameDate ? new Date(gameDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'No date set'}
          </p>
        </div>
      </div>
    </div>
  );
});
