'use client';

import { Play } from 'lucide-react';
import { useGlobalOnboardingSafe } from '@/components/onboarding/GlobalOnboardingProvider';

export default function TourButton() {
  const onboarding = useGlobalOnboardingSafe();

  // Only show if we're on a team page (teamId is available)
  if (!onboarding || !onboarding.teamId) {
    return null;
  }

  // Don't show while loading
  if (onboarding.state.loading) {
    return null;
  }

  return (
    <button
      onClick={onboarding.startTour}
      className="flex items-center gap-1.5 text-gray-600 hover:text-black font-medium text-sm transition-colors"
      title="Take the Tour"
    >
      <Play className="h-4 w-4" />
      Tour
    </button>
  );
}
