'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { OnboardingState, OnboardingContextType } from '@/types/onboarding';

const defaultState: OnboardingState = {
  tourCompleted: false,
  tourSkipped: false,
  checklistDismissed: false,
  completedItems: {
    hasPlayers: false,
    hasGames: false,
    hasPlays: false,
    hasVideos: false,
  },
  completionCount: 0,
  totalItems: 4,
  loading: true,
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

interface OnboardingProviderProps {
  children: ReactNode;
  teamId: string;
}

export default function OnboardingProvider({ children, teamId }: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [showTour, setShowTour] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`/api/user/onboarding?team_id=${teamId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding state');
      }
      const data = await response.json();
      setState({
        ...data,
        loading: false,
      });

      // Auto-show tour for first-time users
      if (!data.tourCompleted && !data.tourSkipped) {
        setShowTour(true);
      }
    } catch (error) {
      console.error('Error fetching onboarding state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [teamId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const updateOnboarding = async (action: string) => {
    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: teamId,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update onboarding state');
      }

      // Refresh state after update
      await fetchState();
    } catch (error) {
      console.error('Error updating onboarding:', error);
    }
  };

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const completeTour = useCallback(async () => {
    setShowTour(false);
    await updateOnboarding('complete_tour');
  }, [teamId]);

  const skipTour = useCallback(async () => {
    setShowTour(false);
    await updateOnboarding('skip_tour');
  }, [teamId]);

  const dismissChecklist = useCallback(async () => {
    await updateOnboarding('dismiss_checklist');
  }, [teamId]);

  const refreshState = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  const value: OnboardingContextType = {
    state,
    showTour,
    startTour,
    completeTour,
    skipTour,
    dismissChecklist,
    refreshState,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
