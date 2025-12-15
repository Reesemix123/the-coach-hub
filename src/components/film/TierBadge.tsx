'use client';

import { Zap, Target, Users } from 'lucide-react';
import type { TaggingTier } from '@/types/football';

interface TierBadgeProps {
  tier: TaggingTier;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  showUpgradeHint?: boolean;
}

/**
 * Small badge/pill displaying the current tagging tier
 * Used in the tagging interface header
 */
export function TierBadge({
  tier,
  showIcon = true,
  size = 'sm',
  onClick,
  showUpgradeHint = false
}: TierBadgeProps) {
  const getTierIcon = () => {
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    switch (tier) {
      case 'quick':
        return <Zap className={iconSize} />;
      case 'standard':
        return <Target className={iconSize} />;
      case 'comprehensive':
        return <Users className={iconSize} />;
    }
  };

  const getTierStyles = () => {
    switch (tier) {
      case 'quick':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'standard':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'comprehensive':
        return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  const getTierName = () => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const sizeStyles = size === 'sm'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-3 py-1 text-sm gap-1.5';

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center font-medium rounded-full border ${getTierStyles()} ${sizeStyles} ${
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      }`}
      title={showUpgradeHint && tier !== 'comprehensive' ? 'Click to upgrade tier' : undefined}
    >
      {showIcon && getTierIcon()}
      <span>{getTierName()}</span>
      {showUpgradeHint && tier !== 'comprehensive' && (
        <span className="ml-1 text-[10px] opacity-60">↑</span>
      )}
    </Component>
  );
}

export default TierBadge;
