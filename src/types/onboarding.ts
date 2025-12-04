// Types for the Onboarding Tour & Checklist System

export interface OnboardingState {
  // Has the user completed the tour?
  tourCompleted: boolean;
  // Has the user skipped the tour?
  tourSkipped: boolean;
  // Has the user dismissed the checklist?
  checklistDismissed: boolean;
  // Which checklist items are completed
  completedItems: ChecklistCompletion;
  // Count of completed items
  completionCount: number;
  // Total items in checklist
  totalItems: number;
  // Loading state
  loading: boolean;
}

export interface ChecklistCompletion {
  hasPlayers: boolean;
  hasGames: boolean;
  hasPlays: boolean;
  hasVideos: boolean;
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  image: string; // Path to screenshot in /public/onboarding/
}

export interface UserOnboardingRecord {
  id: string;
  user_id: string;
  team_id: string | null;
  tour_completed_at: string | null;
  tour_skipped_at: string | null;
  checklist_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingContextType {
  state: OnboardingState;
  showTour: boolean;
  startTour: () => void;
  completeTour: () => Promise<void>;
  skipTour: () => Promise<void>;
  dismissChecklist: () => Promise<void>;
  refreshState: () => Promise<void>;
}

// Tour steps configuration
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Youth Coach Hub!',
    description: 'Your complete coaching platform for managing teams, building playbooks, and analyzing game film. Let\'s take a quick tour to get you started.',
    image: '/onboarding/step-1-welcome.svg',
  },
  {
    id: 'dashboard',
    title: 'Your Team Dashboard',
    description: 'This is your team\'s home base. See upcoming games, quick stats, and take action on common tasks. Everything you need is just a click away.',
    image: '/onboarding/step-2-dashboard.svg',
  },
  {
    id: 'roster',
    title: 'Manage Your Roster',
    description: 'Add your players, assign positions, and build your depth chart. Track jersey numbers and keep your roster organized throughout the season.',
    image: '/onboarding/step-3-roster.svg',
  },
  {
    id: 'playbook',
    title: 'Build Your Playbook',
    description: 'Create and organize your plays with our visual play builder. Design formations, draw routes, and add assignments for every player.',
    image: '/onboarding/step-4-playbook.svg',
  },
  {
    id: 'practice',
    title: 'Plan Your Practices',
    description: 'Design effective practices with our practice builder. Create drill sequences, allocate time, and ensure your team is prepared for game day.',
    image: '/onboarding/step-5-practice.svg',
  },
  {
    id: 'game-plan',
    title: 'Create Game Plans',
    description: 'Build game-specific play sheets and wristbands. Select plays for each situation, organize by down and distance, and print for game day.',
    image: '/onboarding/step-6-game-plan.svg',
  },
  {
    id: 'film-upload',
    title: 'Upload Game Film',
    description: 'Upload game film directly from your device. We support common video formats and organize everything by game for easy access.',
    image: '/onboarding/step-7-film-upload.svg',
  },
  {
    id: 'film-tagging',
    title: 'Tag Your Plays',
    description: 'Tag plays in your film to track downs, distance, and results. Link plays to your playbook for powerful analytics on what works best.',
    image: '/onboarding/step-8-film-tagging.svg',
  },
  {
    id: 'analytics',
    title: 'Track Your Analytics',
    description: 'See what\'s working with detailed analytics. Track success rates by play, formation, and situation. Make data-driven decisions for your team.',
    image: '/onboarding/step-9-analytics.svg',
  },
  {
    id: 'get-started',
    title: 'You\'re Ready!',
    description: 'That\'s the basics! Start by adding your players to the roster, scheduling your games, or uploading film. The checklist on the right will guide you through the essentials.',
    image: '/onboarding/step-10-get-started.svg',
  },
];

// Checklist items configuration
export interface ChecklistItem {
  id: keyof ChecklistCompletion;
  label: string;
  description: string;
  href: (teamId: string) => string;
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'hasPlayers',
    label: 'Add your first player',
    description: 'Build your team roster',
    href: (teamId) => `/teams/${teamId}/players`,
  },
  {
    id: 'hasGames',
    label: 'Schedule a game',
    description: 'Add your upcoming games',
    href: (teamId) => `/teams/${teamId}/schedule`,
  },
  {
    id: 'hasPlays',
    label: 'Create your first play',
    description: 'Start building your playbook',
    href: (teamId) => `/teams/${teamId}/playbook`,
  },
  {
    id: 'hasVideos',
    label: 'Upload game film',
    description: 'Add video for analysis',
    href: (teamId) => `/teams/${teamId}/film`,
  },
];
