// Feature demo configuration for homepage micro-demos
// Each feature has content for both the card and the modal experience

export interface FeatureDemo {
  id: string;
  title: string;
  shortDescription: string; // Shown on the card
  valueStatement: string; // Shown in the modal - time saving / outcome focused
  steps: string[];
  cta: {
    label: string;
    // Auth-aware routing: unauthenticated users go to signup, authenticated go to app
    href: string;
    authHref?: string; // If provided, use this for authenticated users
  };
  secondaryCta?: {
    label: string;
    action: 'view-features' | 'close';
  };
  media: {
    video?: string; // Path relative to /public (e.g., '/demos/digital-playbook.mp4')
    webm?: string; // WebM alternative for better compression
    fallbackImage?: string; // Fallback image if video not available
  };
  icon: 'playbook' | 'analytics' | 'film' | 'gameday';
}

export const FEATURE_DEMOS: FeatureDemo[] = [
  {
    id: 'digital-playbook',
    title: 'Digital Playbook',
    shortDescription: 'Create, organize, and manage your entire playbook digitally. Visual play builder makes it simple.',
    valueStatement: 'Build, organize, and install your playbook digitally—without the binder chaos.',
    steps: [
      'Create formations and concepts in the visual builder',
      'Save and organize by family (run/pass/play-action)',
      'Install plays with practice-ready call sheets',
      'Update once—everywhere stays in sync',
    ],
    cta: {
      label: 'See pricing',
      href: '/pricing',
    },
    media: {
      video: '/demos/digital-playbook.mp4',
      webm: '/demos/digital-playbook.webm',
      fallbackImage: '/demos/digital-playbook.png',
    },
    icon: 'playbook',
  },
  {
    id: 'pro-analytics',
    title: 'Pro-Level Analytics',
    shortDescription: 'The same analysis tools the pros use. Tendencies, success rates, and insights—finally accessible.',
    valueStatement: 'See tendencies and success rates in seconds—no staff room required.',
    steps: [
      'Filter by down/distance, hash, field zone',
      'Auto-summarize top calls and success rates',
      'Compare opponent tendencies vs. your strengths',
      'Export a quick opponent report',
    ],
    cta: {
      label: 'View a sample report',
      href: '/pricing', // Fallback - will be replaced with demo experience
      // Future: This could link to a dedicated sample report page
    },
    secondaryCta: {
      label: 'View other features',
      action: 'view-features',
    },
    media: {
      video: '/demos/pro-analytics.mp4',
      webm: '/demos/pro-analytics.webm',
      fallbackImage: '/demos/pro-analytics.png',
    },
    icon: 'analytics',
  },
  {
    id: 'ai-film-tagging',
    title: 'AI Film Tagging',
    shortDescription: 'Your Co-Pilot cuts film tagging time by 50%. AI suggests, you confirm. Hours become minutes.',
    valueStatement: 'Cut film breakdown time dramatically—AI tags, you confirm.',
    steps: [
      'Upload game film',
      'AI suggests formations, plays, and outcomes',
      'You approve or adjust with one click',
      'Tendencies and cutups update automatically',
    ],
    cta: {
      label: 'Start tagging film',
      href: '/auth/signup',
      authHref: '/teams', // Authenticated users go to team selection, then can navigate to film
    },
    media: {
      video: '/demos/ai-film-tagging.mp4',
      webm: '/demos/ai-film-tagging.webm',
      fallbackImage: '/demos/ai-film-tagging.png',
    },
    icon: 'film',
  },
  {
    id: 'game-day-prep',
    title: 'Game-Day Preparation',
    shortDescription: "Show up on game day with a real plan. Build on your team's proven strengths against opponent tendencies.",
    valueStatement: 'Show up with a plan—built from your film and opponent tendencies.',
    steps: [
      'Generate a week-of scouting summary',
      'Get top 5 tendencies to attack/defend',
      'Build a game plan from recommended calls',
      'Print or view on a tablet on game day',
    ],
    cta: {
      label: 'Build a game plan',
      href: '/auth/signup',
      authHref: '/teams', // Authenticated users go to team selection
    },
    media: {
      video: '/demos/game-day-prep.mp4',
      webm: '/demos/game-day-prep.webm',
      fallbackImage: '/demos/game-day-prep.png',
    },
    icon: 'gameday',
  },
];

// Helper to get a feature by ID
export function getFeatureById(id: string): FeatureDemo | undefined {
  return FEATURE_DEMOS.find((f) => f.id === id);
}

// Helper to get next feature (for "View other features" flow)
export function getNextFeature(currentId: string): FeatureDemo {
  const currentIndex = FEATURE_DEMOS.findIndex((f) => f.id === currentId);
  const nextIndex = (currentIndex + 1) % FEATURE_DEMOS.length;
  return FEATURE_DEMOS[nextIndex];
}
