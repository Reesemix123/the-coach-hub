'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { OnboardingState } from '@/types/onboarding';

interface GlobalOnboardingContextType {
  state: OnboardingState;
  showTour: boolean;
  showChecklist: boolean;
  teamId: string | null;
  isDemoTour: boolean;
  startTour: () => void;
  startDemoTour: () => void;
  completeTour: () => Promise<void>;
  skipTour: () => Promise<void>;
  dismissChecklist: () => Promise<void>;
  resetChecklist: () => Promise<void>;
  toggleChecklist: () => void;
  refreshState: () => Promise<void>;
}

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

const GlobalOnboardingContext = createContext<GlobalOnboardingContextType | null>(null);

export function useGlobalOnboarding() {
  const context = useContext(GlobalOnboardingContext);
  if (!context) {
    throw new Error('useGlobalOnboarding must be used within a GlobalOnboardingProvider');
  }
  return context;
}

// Safe hook that returns null if not in provider context
export function useGlobalOnboardingSafe(): GlobalOnboardingContextType | null {
  return useContext(GlobalOnboardingContext);
}

interface GlobalOnboardingProviderProps {
  children: ReactNode;
}

export default function GlobalOnboardingProvider({ children }: GlobalOnboardingProviderProps) {
  const pathname = usePathname();
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [showTour, setShowTour] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [isDemoTour, setIsDemoTour] = useState(false);

  // Extract teamId from URL path (e.g., /teams/[teamId]/...)
  const teamId = extractTeamId(pathname);

  const fetchState = useCallback(async () => {
    if (!teamId) {
      setState({ ...defaultState, loading: false });
      return;
    }

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

      // Auto-expand checklist if not all items completed and not dismissed
      if (!data.checklistDismissed && data.completionCount < data.totalItems) {
        setShowChecklist(true);
      }
    } catch (error) {
      console.error('Error fetching onboarding state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [teamId]);

  // Fetch state on mount and when pathname changes (user navigates)
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Also refresh when user navigates to a different team page
  useEffect(() => {
    if (teamId) {
      fetchState();
    }
  }, [pathname]);

  const updateOnboarding = async (action: string) => {
    if (!teamId) return;

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
    setIsDemoTour(false);
    setShowTour(true);
  }, []);

  const startDemoTour = useCallback(() => {
    setIsDemoTour(true);
    setShowTour(true);
  }, []);

  const completeTour = useCallback(async () => {
    setShowTour(false);
    setIsDemoTour(false);
    // Only save to DB if not in demo mode
    if (teamId) {
      await updateOnboarding('complete_tour');
    }
  }, [teamId]);

  const skipTour = useCallback(async () => {
    setShowTour(false);
    setIsDemoTour(false);
    // Only save to DB if not in demo mode
    if (teamId) {
      await updateOnboarding('skip_tour');
    }
  }, [teamId]);

  const dismissChecklist = useCallback(async () => {
    setShowChecklist(false);
    await updateOnboarding('dismiss_checklist');
  }, [teamId]);

  const resetChecklist = useCallback(async () => {
    await updateOnboarding('reset_checklist');
    setShowChecklist(true);
  }, [teamId]);

  const toggleChecklist = useCallback(() => {
    setShowChecklist(prev => {
      // Refresh state when expanding the checklist
      if (!prev) {
        fetchState();
      }
      return !prev;
    });
  }, [fetchState]);

  const refreshState = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  const value: GlobalOnboardingContextType = {
    state,
    showTour,
    showChecklist,
    teamId,
    isDemoTour,
    startTour,
    startDemoTour,
    completeTour,
    skipTour,
    dismissChecklist,
    resetChecklist,
    toggleChecklist,
    refreshState,
  };

  return (
    <GlobalOnboardingContext.Provider value={value}>
      {children}
    </GlobalOnboardingContext.Provider>
  );
}

// Helper to extract teamId from URL path
function extractTeamId(pathname: string): string | null {
  // Match /teams/[uuid]/... pattern
  const match = pathname.match(/\/teams\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}
