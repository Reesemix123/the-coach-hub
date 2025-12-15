'use client';

import { Info } from 'lucide-react';
import type { ReportSection, TaggingTier } from '@/types/football';
import { getReportTierMessage, REPORT_SECTION_MIN_TIERS } from '@/types/football';

interface TierUpgradeMessageProps {
  section: ReportSection;
  currentTier?: TaggingTier;
  className?: string;
}

/**
 * Soft blue info box for tier upgrade prompts in reports
 * Used when data requires a higher tagging tier
 */
export function TierUpgradeMessage({
  section,
  currentTier,
  className = ''
}: TierUpgradeMessageProps) {
  const requiredTier = REPORT_SECTION_MIN_TIERS[section];
  const message = getReportTierMessage(section);

  // Check if we should show the message
  // Show if currentTier is lower than required, or if currentTier is undefined (no games tagged yet)
  if (currentTier) {
    const tierOrder: TaggingTier[] = ['quick', 'standard', 'comprehensive'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(requiredTier);

    // If current tier meets or exceeds required, don't show message
    if (currentIndex >= requiredIndex) {
      return null;
    }
  }

  // Parse markdown bold (**text**) to HTML
  const formattedMessage = message.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold">$1</strong>'
  );

  return (
    <div className={`p-4 bg-blue-50 border border-blue-100 rounded-lg ${className}`}>
      <div className="flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p
          className="text-sm text-blue-800"
          dangerouslySetInnerHTML={{ __html: formattedMessage }}
        />
      </div>
    </div>
  );
}

/**
 * Inline tier requirement indicator for section headers
 */
interface TierRequirementBadgeProps {
  section: ReportSection;
  className?: string;
}

export function TierRequirementBadge({ section, className = '' }: TierRequirementBadgeProps) {
  const tier = REPORT_SECTION_MIN_TIERS[section];
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

  const getColor = () => {
    switch (tier) {
      case 'standard':
        return 'bg-gray-100 text-gray-600';
      case 'comprehensive':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-blue-100 text-blue-600';
    }
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${getColor()} ${className}`}>
      {tierName}+
    </span>
  );
}

/**
 * Player report specific message based on tier
 */
interface PlayerReportTierMessageProps {
  tier: TaggingTier;
  className?: string;
}

export function PlayerReportTierMessage({ tier, className = '' }: PlayerReportTierMessageProps) {
  if (tier === 'comprehensive') {
    return null; // Full access, no message needed
  }

  const messages = {
    quick: 'Tag games at **Comprehensive** level to unlock full player performance tracking. Quick tagging provides team-level statistics only.',
    standard: 'Tag games at **Comprehensive** level for individual player grades and position-specific metrics.'
  };

  const message = messages[tier];
  const formattedMessage = message.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold">$1</strong>'
  );

  return (
    <div className={`p-4 bg-blue-50 border border-blue-100 rounded-lg ${className}`}>
      <div className="flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p
          className="text-sm text-blue-800"
          dangerouslySetInnerHTML={{ __html: formattedMessage }}
        />
      </div>
    </div>
  );
}

export default TierUpgradeMessage;
