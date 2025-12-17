/**
 * Feature Registry - Single Source of Truth
 *
 * This file defines all app features and their descriptions.
 * It is used by:
 *   1. AI context (static-context.ts) - for AI assistant responses
 *   2. Guide navigation - for consistent feature names
 *   3. Onboarding flows - for feature introductions
 *
 * IMPORTANT: When adding or modifying features, update this file first.
 * The AI context will automatically pick up changes.
 */

export interface FeatureCategory {
  id: string;
  name: string;
  description: string;
  guidePath: string;
  features: Feature[];
}

export interface Feature {
  name: string;
  description: string;
  guidePath?: string;
  navigationPath?: string; // e.g., "Team > Roster > Add Player"
  subFeatures?: string[];
}

export const APP_FEATURES: FeatureCategory[] = [
  {
    id: 'teams',
    name: 'Teams & Roster',
    description: 'Create and manage your football team',
    guidePath: '/guide/teams',
    features: [
      {
        name: 'Create Team',
        description: 'Set up a team with name, level (youth/JV/varsity), and colors',
        guidePath: '/guide/getting-started/creating-first-team',
        navigationPath: 'Dashboard > Create Team',
      },
      {
        name: 'Roster Management',
        description: 'Add players with jersey numbers, positions, and depth chart order',
        guidePath: '/guide/teams/roster-management',
        navigationPath: 'Team > Roster > Add Player',
      },
      {
        name: 'Coaching Staff',
        description: 'Invite and manage assistant coaches with appropriate permissions',
        guidePath: '/guide/getting-started/inviting-coaches',
        navigationPath: 'Team Settings > Manage Coaches',
      },
      {
        name: 'Team Settings',
        description: 'Configure notifications, display preferences, and team details',
        guidePath: '/guide/teams/team-settings',
        navigationPath: 'Team > Settings',
      },
    ],
  },
  {
    id: 'playbook',
    name: 'Digital Playbook',
    description: 'Create and organize your offensive and defensive plays',
    guidePath: '/guide/playbook',
    features: [
      {
        name: 'Play Builder',
        description: 'Create plays with drag-drop player positioning and route drawing',
        guidePath: '/guide/playbook/drawing-diagrams',
        navigationPath: 'Playbook > New Play',
      },
      {
        name: 'Formations',
        description: 'Choose from 40+ offensive, defensive, and special teams formations',
        guidePath: '/guide/playbook/getting-started',
      },
      {
        name: 'Play Organization',
        description: 'Organize plays by formation and type (run/pass), add custom tags',
        guidePath: '/guide/playbook/managing-playbook',
        navigationPath: 'Playbook > Filter',
      },
      {
        name: 'Wristbands & Coach Sheets',
        description: 'Print formatted play sheets for game day',
        guidePath: '/guide/playbook/managing-playbook',
        navigationPath: 'Playbook > Print',
      },
    ],
  },
  {
    id: 'film',
    name: 'Game Film & Analysis',
    description: 'Upload, organize, and analyze game video',
    guidePath: '/guide/film',
    features: [
      {
        name: 'Video Upload',
        description: 'Upload game videos with support for multiple camera angles',
        guidePath: '/guide/film/uploading-film',
        navigationPath: 'Film > Select Game > Upload Video',
      },
      {
        name: 'Play Tagging',
        description: 'Tag plays with down, distance, result, yards gained, and player attribution',
        guidePath: '/guide/film/tagging-plays',
        navigationPath: 'While watching film, click "Tag Play"',
      },
      {
        name: 'Tagging Tiers',
        description: 'Choose detail level: Quick (basic stats) to Advanced (full player tracking)',
        guidePath: '/guide/film/tagging-levels',
      },
      {
        name: 'Multi-Camera Sync',
        description: 'Sync multiple camera angles for comprehensive review',
        guidePath: '/guide/film/multi-camera',
      },
      {
        name: 'Playbook Linking',
        description: 'Link tagged plays to your playbook for play-specific analytics',
        guidePath: '/guide/film/tagging-plays',
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & Reporting',
    description: 'Track performance with 8 different analytical reports',
    guidePath: '/guide/analytics',
    features: [
      {
        name: 'Season Overview',
        description: '28 comprehensive team metrics and performance summary',
        guidePath: '/guide/analytics/season-overview',
        navigationPath: 'Analytics > Reports > Season Overview',
      },
      {
        name: 'Game Report',
        description: 'Detailed breakdown of a single game with comparisons',
        guidePath: '/guide/analytics/game-report',
        navigationPath: 'Analytics > Reports > Game Report',
      },
      {
        name: 'Offensive Report',
        description: 'Complete offensive analysis with player stats and drive analytics',
        guidePath: '/guide/analytics/offensive-report',
        navigationPath: 'Analytics > Reports > Offensive Report',
      },
      {
        name: 'Defensive Report',
        description: 'Defensive performance metrics and opponent analytics',
        guidePath: '/guide/analytics/defensive-report',
        navigationPath: 'Analytics > Reports > Defensive Report',
      },
      {
        name: 'Special Teams Report',
        description: 'Kicking, punting, and return game analysis',
        guidePath: '/guide/analytics/special-teams-report',
        navigationPath: 'Analytics > Reports > Special Teams Report',
      },
      {
        name: 'Player Report',
        description: 'Individual player performance by position group',
        guidePath: '/guide/analytics/player-report',
        navigationPath: 'Analytics > Reports > Player Report',
      },
      {
        name: 'Situational Report',
        description: 'Performance by down, distance, field position, and score',
        guidePath: '/guide/analytics/situational-report',
        navigationPath: 'Analytics > Reports > Situational Report',
      },
      {
        name: 'Drive Analysis',
        description: 'Drive-level performance metrics and efficiency',
        guidePath: '/guide/analytics/drive-analysis',
        navigationPath: 'Analytics > Reports > Drive Analysis',
      },
    ],
  },
  {
    id: 'game-week',
    name: 'Game Planning',
    description: 'Prepare for upcoming games with organized play sheets',
    guidePath: '/guide/game-week',
    features: [
      {
        name: 'Game Plan Creation',
        description: 'Create game plans with selected plays from your playbook',
        guidePath: '/guide/game-week/overview',
        navigationPath: 'Game Week > New Game Plan',
      },
      {
        name: 'Situational Organization',
        description: 'Organize plays by situation (1st down, red zone, 3rd & short, etc.)',
        guidePath: '/guide/game-week/overview',
      },
      {
        name: 'Play Sheets',
        description: 'Print formatted play sheets for sideline use',
        guidePath: '/guide/game-week/overview',
        navigationPath: 'Game Plan > Print',
      },
    ],
  },
  {
    id: 'practice',
    name: 'Practice Planning',
    description: 'Build structured practice schedules',
    guidePath: '/guide/game-week/practice-planning',
    features: [
      {
        name: 'Practice Schedule',
        description: 'Build practice schedules with drills and time blocks',
        guidePath: '/guide/game-week/practice-planning',
        navigationPath: 'Practice > New Practice',
      },
      {
        name: 'Player Groups',
        description: 'Assign drills to specific position groups',
        guidePath: '/guide/game-week/practice-planning',
      },
      {
        name: 'Practice Objectives',
        description: 'Track practice goals and focus areas',
        guidePath: '/guide/game-week/practice-planning',
      },
    ],
  },
  {
    id: 'roles',
    name: 'Roles & Permissions',
    description: 'Manage team access and coach permissions',
    guidePath: '/guide/roles-permissions',
    features: [
      {
        name: 'Owner/Head Coach',
        description: 'Full control of team settings, roster, and all features',
        guidePath: '/guide/roles-permissions/owner-head-coach',
      },
      {
        name: 'Assistant Coach',
        description: 'Can edit plays, tag film, and view analytics',
        guidePath: '/guide/roles-permissions/assistant-coach',
      },
      {
        name: 'Team Invites',
        description: 'Invite coaches via email and manage their roles',
        guidePath: '/guide/roles-permissions/managing-team-members',
        navigationPath: 'Team Settings > Manage Coaches > Invite',
      },
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscription Tiers',
    description: 'Choose the plan that fits your coaching needs',
    guidePath: '/guide/subscriptions',
    features: [
      {
        name: 'Basic (Free)',
        description: 'Core features for getting started',
        guidePath: '/guide/subscriptions/tier-comparison',
      },
      {
        name: 'Plus',
        description: 'Enhanced analytics and increased storage',
        guidePath: '/guide/subscriptions/tier-comparison',
      },
      {
        name: 'Premium',
        description: 'Full features including AI assistance and priority support',
        guidePath: '/guide/subscriptions/tier-comparison',
      },
      {
        name: 'Upgrade & Billing',
        description: 'Manage your subscription and billing information',
        guidePath: '/guide/subscriptions/upgrading',
        navigationPath: 'Team Settings > Subscription',
      },
    ],
  },
];

/**
 * Common tasks and their navigation paths
 * Used by AI context for quick answers
 */
export const COMMON_TASKS = [
  { task: 'Add a player', path: 'Team > Roster > Add Player' },
  { task: 'Create a play', path: 'Playbook > New Play' },
  { task: 'Upload film', path: 'Film > Select Game > Upload Video' },
  { task: 'Tag plays', path: 'While watching film, click "Tag Play"' },
  { task: 'Invite coaches', path: 'Team Settings > Manage Coaches' },
  { task: 'View analytics', path: 'Analytics > Reports' },
  { task: 'Print wristbands', path: 'Playbook > Print' },
  { task: 'Create game plan', path: 'Game Week > New Game Plan' },
];

/**
 * Generate AI context string from features
 * Used by static-context.ts
 */
export function generateAIContext(): string {
  const sections: string[] = ['YOUTH COACH HUB - FEATURE SUMMARY\n'];

  APP_FEATURES.forEach((category, index) => {
    sections.push(`${index + 1}. ${category.name.toUpperCase()}`);

    category.features.forEach((feature) => {
      const nav = feature.navigationPath ? ` (${feature.navigationPath})` : '';
      const guide = feature.guidePath ? ` [Guide: ${feature.guidePath}]` : '';
      sections.push(`- ${feature.name}: ${feature.description}${nav}${guide}`);
    });

    sections.push('');
  });

  sections.push('COMMON TASKS:');
  COMMON_TASKS.forEach((item) => {
    sections.push(`- ${item.task}: ${item.path}`);
  });

  sections.push(
    '\nIMPORTANT: Always link to SPECIFIC guide pages (e.g., /guide/film/uploading-film), NOT category pages (e.g., /guide/film). Use markdown: [Learn more](/guide/specific-page)'
  );

  return sections.join('\n');
}
