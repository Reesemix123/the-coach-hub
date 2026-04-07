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
        description: 'Invite coaches via email (even without an existing account) and manage their roles',
        guidePath: '/guide/getting-started/inviting-coaches',
        navigationPath: 'Team Settings > Members > Invite Coach',
      },
      {
        name: 'Team Settings',
        description: 'Configure team details, manage subscription, track usage, and invite coaches - all from one place',
        guidePath: '/guide/teams/team-settings',
        navigationPath: 'Team > Settings',
        subFeatures: [
          'Team tab: name, level, team colors, and Add Another Team button',
          'Subscription tab: view plan, change tier, manage billing via Stripe, Add Another Team button',
          'Usage tab: token balance with team/opponent breakdown, purchase additional tokens',
          'Members tab: invite coaches, manage roles, view and manage pending invites',
        ],
      },
      {
        name: 'Game Management',
        description: 'Create games on your schedule and delete them with automatic token refund if no plays have been tagged',
        guidePath: '/guide/teams/schedule',
        navigationPath: 'Team > Schedule > Game > Delete',
        subFeatures: [
          'Token refund when deleting games with no tagged plays',
          'Clear confirmation showing refund eligibility',
          'Cascade deletion of videos and tagged plays',
        ],
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
    description: 'Track performance with 9 different analytical reports',
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
      {
        name: 'Opponent Scouting',
        description: 'Comprehensive opponent analysis including defensive tendencies, offensive patterns, and special teams insights',
        guidePath: '/guide/analytics/opponent-scouting',
        navigationPath: 'Analytics > Reports > Opponent Scouting',
        subFeatures: [
          'Defensive tendencies: coverage distribution, blitz rates, run/pass defense',
          'Offensive tendencies: run/pass splits, formation usage, concept frequencies',
          'Special teams analysis: kicking, returning, and scoring tendencies',
          'Game plan recommendations based on opponent patterns',
        ],
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
        description: 'Invite coaches via email (sends signup link for new users) and manage pending invitations',
        guidePath: '/guide/roles-permissions/managing-team-members',
        navigationPath: 'Team Settings > Members > Invite Coach',
        subFeatures: [
          'Email invitations for coaches without accounts',
          'Pending invites section with copy link, resend, and cancel options',
          'Automatic team join after signup via invite link',
        ],
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
        description: 'Change your plan, manage payment methods, and view billing from Team Settings',
        guidePath: '/guide/subscriptions/upgrading',
        navigationPath: 'Team Settings > Subscription > Change Plan',
      },
      {
        name: 'Purchase Tokens',
        description: 'Buy additional film upload tokens ($12 each) that never expire',
        guidePath: '/guide/subscriptions/billing',
        navigationPath: 'Team Settings > Usage > Purchase',
      },
    ],
  },
  {
    id: 'communication-hub',
    name: 'Parent Communication Hub',
    description: 'Connect with parents through a mobile-friendly PWA with messaging, scheduling, video sharing, and reports',
    guidePath: '/guide/communication',
    features: [
      {
        name: 'Parent Portal (PWA)',
        description: 'Mobile-optimized Progressive Web App for parents with iOS-style bottom tab navigation. Parents access via invitation from their coach.',
        guidePath: '/guide/communication/parent-portal',
        navigationPath: '/parent (redirects to Messages)',
        subFeatures: [
          'Bottom tab bar: Schedule, Messages, Videos, Reports, Directory, More',
          'Team switcher dropdown in top bar for parents on multiple teams',
          'Settings and sign out in the More menu',
          'Auto-installs as a home screen app on iOS and Android',
        ],
      },
      {
        name: 'Messages',
        description: 'Two-way messaging between coaches and parents, plus parent-to-parent direct messages with photo attachments',
        guidePath: '/guide/communication/messages',
        navigationPath: 'Communication > Messages (coach) | Messages tab (parent)',
        subFeatures: [
          'Coach inbox with conversation list and unread counts',
          'Parent inbox showing conversations with coach and other parents',
          'Photo attachments: upload and display images inline in messages',
          'New message picker to start conversations with any team parent',
          'Auto-polling: messages refresh every 5 seconds, inbox every 15 seconds',
          'Parent-to-parent messaging toggle in Communication Settings',
          'Notifications via email and/or SMS based on parent preferences',
        ],
      },
      {
        name: 'Schedule (Unified Calendar)',
        description: 'Team calendar showing both coach-created events and games from the schedule, with RSVP for parents',
        guidePath: '/guide/communication/calendar',
        navigationPath: 'Communication > Schedule (coach) | Schedule tab (parent)',
        subFeatures: [
          'Coach games from the schedule auto-appear in the parent calendar',
          'Game cards show Trophy badge, opponent, and W/L/T score when completed',
          'Events support RSVP: parents select Attending, Maybe, or Not Attending',
          'Family RSVP modal with per-child exceptions for multi-player families',
          'Coach sees RSVP attendance summary with counts and reminder send',
          'Event types: Practice, Game, Scrimmage, Meeting, Film Session, Team Bonding, Parent Meeting, Fundraiser',
          'Notification channel selection per event (email, SMS, or both)',
        ],
      },
      {
        name: 'Videos',
        description: 'Share game film with parents via Mux-powered video streaming with signed URLs',
        guidePath: '/guide/communication/videos',
        navigationPath: 'Communication > Videos (coach) | Videos tab (parent)',
        subFeatures: [
          'Upload videos with Mux encoding and HLS streaming',
          'Share with entire team (uses video credits) or individual players (unlimited)',
          'Coach notes visible to parents on shared videos',
          'COPPA consent confirmation before publishing',
          'Notification to parents when video is shared',
          'Video credit tracking with top-up packs ($39 for 5)',
        ],
      },
      {
        name: 'Reports & Game Summaries',
        description: 'AI-powered game summaries and player reports with real stats from film analysis',
        guidePath: '/guide/communication/reports',
        navigationPath: 'Communication > Reports (coach) | Reports tab (parent)',
        subFeatures: [
          'Game summary with AI draft generation from tagged play data',
          'AI uses coach-like voice: direct, specific, 100-150 words, cites real stats',
          'Game selector auto-fills opponent, date, score, and shows film analysis stats preview',
          'Stats include: success rate by down, 3rd down conversions, red zone efficiency, penalties, top player stat lines',
          'Coach can write notes, generate AI draft, edit, then publish to parents',
          'Parents see: score card, AI summary text, game stats grid, top performers, player highlights',
          'Player reports: summary cards, season progress, individual reports, game recaps',
          'Configurable AI tone: coach (default), formal, casual',
          'Delete drafts and published reports',
        ],
      },
      {
        name: 'Parent Directory',
        description: 'View all parents on the team with their linked players and jersey numbers',
        guidePath: '/guide/communication/directory',
        navigationPath: 'Directory tab (parent)',
        subFeatures: [
          'Avatar with initials and deterministic color',
          'Parent name with linked player names and jersey numbers',
          'Relationship type hidden for child safety',
        ],
      },
      {
        name: 'Team Treats Sign-up',
        description: 'Parents sign up to bring treats and snacks to games, with configurable slot limits',
        guidePath: '/guide/communication/treats',
        navigationPath: 'Calendar > Game card (parent) | RSVP modal (coach)',
        subFeatures: [
          'Coach enables treats in Communication > Settings',
          'Configurable max families per game (1-5)',
          'Parents see treat sign-up section on game cards in calendar',
          'Sign up with optional description of what they are bringing',
          'Coach sees treat signups in the RSVP Attendance modal',
        ],
      },
      {
        name: 'Parent Invitations',
        description: 'Coaches invite parents via email to join the team communication hub. Enforces parent count limits based on the active communication plan tier.',
        guidePath: '/guide/communication/parents',
        navigationPath: 'Communication > Parents (coach)',
        subFeatures: [
          'Email invitation with sign-up link',
          'Parent creates account with notification preferences (email, SMS, or both)',
          'COPPA consent for child information storage',
          'SMS opt-in disclosure with link to SMS Policy page',
          'Parent champion designation for team leaders',
          'Parent limit enforcement: blocks invites when team reaches tier limit (active + pending counted)',
          'Upgrade banner shown inline when limit is reached, with next tier name, price, and direct checkout link',
        ],
      },
      {
        name: 'Communication Plans & Billing',
        description: 'Tiered communication plans with free and paid options. Free tiers include messaging, scheduling, and RSVP. Paid tiers add video sharing, AI reports, and parent portal.',
        guidePath: '/guide/communication/plans',
        navigationPath: 'Communication > Plan (coach)',
        subFeatures: [
          'Rookie (Free): up to 20 parents, messaging, SMS/email notifications, scheduling + RSVP, roster management',
          'Varsity ($79/season): up to 40 parents, everything in Rookie plus player clips, AI performance reports, parent portal (PWA)',
          'All-Conference ($149/season): up to 60 parents, same features as Varsity — Most Popular',
          'All-State ($249/season): unlimited parents, same features as Varsity',
          'Free Rookie plan auto-activates on team creation',
          'Auto-clips and AI report generation gated behind paid plans',
          'Parent clips API returns empty with upgrade hint for free tier teams',
          '6-month season duration with 30-day grace period',
          'Video top-up packs: 5 for $39 (available on paid tiers only)',
          'Plan page shows tier-aware features with current plan badge, grayed-out lower tiers, and upgrade CTAs',
        ],
      },
      {
        name: 'Post-Creation Comm Hub Upsell',
        description: 'After creating a team, coaches see an interstitial page offering Communication Hub upgrade options before reaching the dashboard.',
        navigationPath: '/football/teams/[teamId]/setup-complete',
        subFeatures: [
          'Shows Rookie (current, free) plus 3 paid tier upgrade cards',
          'Prominent "Skip — take me to my team" button (no dark patterns)',
          'Film checkout success banner when returning from Stripe',
          'Comm hub purchase success redirects to plan page',
          'Onboarding tour and checklist suppressed on this page',
          'Hint text in team creation form: "After creating your team, you\'ll also be able to set up parent communication"',
        ],
      },
      {
        name: 'Communication Settings',
        description: 'Configure parent communication features per team',
        guidePath: '/guide/communication/settings',
        navigationPath: 'Communication > Settings (coach)',
        subFeatures: [
          'Toggle team treats sign-up on/off',
          'Set max treat slots per game (1-5 families)',
          'Toggle parent-to-parent messaging on/off',
        ],
      },
      {
        name: 'SMS Compliance',
        description: 'TCPA-compliant SMS opt-in disclosure and messaging policy',
        guidePath: '/guide/communication/sms',
        navigationPath: '/sms-policy (public page)',
        subFeatures: [
          'Public SMS Policy page for Twilio toll-free verification',
          'Opt-in via invitation acceptance + SMS preference selection',
          'Opt-out via STOP reply or account settings',
          'SMS consent language on parent sign-up page',
          'SMS section in Privacy Policy, Twilio in service providers list',
        ],
      },
    ],
  },
  {
    id: 'player-profiles',
    name: 'Player Profiles',
    description: 'Persistent athlete profiles owned by parents. Accumulates clips and AI-generated performance reports across seasons and teams. Parent owns the profile — it survives team and coach changes.',
    guidePath: '/parent/guide/parent-profile/overview',
    features: [
      {
        name: 'Athlete Profile Page',
        description: 'Profile header with photo, name, graduation year. Season stats strip with unit-appropriate metrics. Game reports section. Highlights clips section. Subscription upsell when needed.',
        navigationPath: 'Parent app > Player Profile tab > /parent/athletes/[athleteId]',
      },
      {
        name: 'Auto-Generated Clips',
        description: 'Created automatically when coach completes film analysis. Require coach approval before parent can view. Grouped by game. Filterable by unit (offense, defense, special teams).',
        navigationPath: 'Parent app > Player Profile > Highlights section',
      },
      {
        name: 'AI Performance Reports',
        description: 'Generated after each game. Parent view shows warm developmental narrative (no grades or scores). Coach view shows technical grades. Coach must publish before parent can see.',
        navigationPath: 'Parent app > Player Profile > Game Reports section',
      },
      {
        name: 'Season Stats Strip',
        description: 'Aggregated metrics appropriate to player unit — offense skill (carries, targets, snaps), O-Line (block grade, pressures allowed), defense (tackles, turnovers, grade), special teams (unit, key stat).',
      },
      {
        name: 'Multi-Season History',
        description: 'Profile accumulates data across seasons and sports. Each season appears as a selector on the profile page.',
      },
    ],
  },
  {
    id: 'parent-profile-subscription',
    name: 'Player Profile Subscription',
    description: '$19.99/year annual subscription for parents. Unlocks permanent clip and report history beyond the coaching season. Auto-renews annually.',
    guidePath: '/parent/guide/parent-subscription/free-vs-paid',
    features: [
      {
        name: 'Free Access',
        description: 'Current season clips and reports visible while team Comm Hub plan is active. No subscription required during the active season.',
      },
      {
        name: 'Subscribed Access',
        description: 'Permanent history across all seasons and sports. Clips and reports never expire.',
      },
      {
        name: 'Stripe Checkout',
        description: 'Initiated from the upsell card on the athlete profile page.',
        navigationPath: 'Parent app > Player Profile > Subscribe button',
      },
      {
        name: 'Annual Auto-Renewal',
        description: 'Parent is charged once per year. 7-day reminder email before renewal.',
      },
      {
        name: '90-Day Grace Period',
        description: 'After subscription lapses, data is held for 90 days before archiving. Profile page shows countdown.',
      },
      {
        name: 'Billing Portal',
        description: 'Parent can manage, cancel, or update payment from the subscription upsell card.',
      },
    ],
  },
  {
    id: 'athlete-profile-creation',
    name: 'Create Athlete Profile',
    description: '3-step flow for parents to create a persistent athlete profile. Located at /parent/athletes/new. Accessible from the Player Profile tab in the parent bottom navigation.',
    guidePath: '/parent/guide/parent-getting-started/athlete-profile',
    features: [
      {
        name: 'Step 1 — Athlete Basics',
        description: 'First name, last name, graduation year, optional profile photo upload.',
        navigationPath: 'Parent app > Player Profile tab > /parent/athletes/new',
      },
      {
        name: 'Step 2 — Sport Selection',
        description: 'Football (active), baseball and basketball (coming soon, grayed out). Season year dropdown.',
      },
      {
        name: 'Step 3 — Confirmation + Join Code',
        description: 'Success message with athlete initials. Optional 6-character join code entry to link to a team roster. "Skip for now" option always visible.',
      },
      {
        name: 'Join Code System',
        description: 'Coaches copy a 6-character code from the Actions column on their Players roster page. Parent enters the code on Step 3. Linking grants immediate Comm Hub access to the team.',
        navigationPath: 'Coach: Team > Players > Code button | Parent: Create profile > Step 3',
      },
    ],
  },
  {
    id: 'coach-parent-dual-role',
    name: 'Coach + Parent Mode',
    description: 'A single account can be both a coach and a parent. Switch between coach and parent views without logging out.',
    guidePath: '/parent/guide/parent-account/dual-role',
    features: [
      {
        name: 'Dashboard Parent Card',
        description: 'If the coach also has a parent profile, a parent context card appears on /dashboard between the football sport card and the coming soon sports.',
        navigationPath: 'Dashboard > Parent view card > Switch →',
      },
      {
        name: 'Switch to Parent View',
        description: 'Available in the avatar dropdown on /dashboard. Navigates to /parent.',
        navigationPath: 'Dashboard > Avatar > Switch to parent view',
      },
      {
        name: 'Switch to Coach View',
        description: 'Available in the More menu of the parent bottom tab bar. Navigates to /dashboard.',
        navigationPath: 'Parent app > More > Switch to coach view',
      },
      {
        name: 'Onboarding Prompt',
        description: 'When a coach purchases a Comm Hub plan, a dismissible banner asks "Do you have a child on this team?" with a link to create a parent profile.',
        navigationPath: 'Communication > Plan > After purchase success',
      },
    ],
  },
  {
    id: 'clip-review',
    name: 'Clip Review Queue',
    description: 'Coach reviews and approves auto-generated player clips before they are visible to parents. Located at /football/teams/[teamId]/players/clips.',
    guidePath: '/parent/guide/parent-clips/finding-clips',
    features: [
      {
        name: 'Clip Review Page',
        description: 'Access via Players tab → Clip Review sub-tab. Pending count badge on the sub-tab. Bulk approve button for all pending clips.',
        navigationPath: 'Team > Players > Clip Review',
        subFeatures: [
          'Bulk approve: one button approves all pending clips for the team at once',
          'Per-clip actions: Approve (green checkmark), Suppress (gray X), Add Note (pencil icon)',
          'Visual states: amber border (pending), green border (approved), gray (suppressed)',
          'Filter tabs: All, Pending, Approved, Suppressed',
          'Grouped by player with horizontal scroll of clips',
        ],
      },
    ],
  },
  {
    id: 'report-management',
    name: 'Player Report Management',
    description: 'Coach reviews, edits, and publishes AI-generated player performance reports. Located at /football/teams/[teamId]/players/reports.',
    guidePath: '/parent/guide/parent-reports/reading-reports',
    features: [
      {
        name: 'Report Management Page',
        description: 'Access via Players tab → Reports sub-tab. Unpublished count badge. Filter by game and player.',
        navigationPath: 'Team > Players > Reports',
        subFeatures: [
          'Report card: player name, position, jersey, opponent, date, position grade pill, Draft/Published badge',
          'Inline edit panel: coach analysis (read-only), parent report (editable textarea)',
          'Save draft: saves edits without publishing',
          'Publish to parents: saves and publishes, sends parent email notification',
          'Unpublish: removes from parent view immediately',
        ],
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
  { task: 'Invite coaches', path: 'Team Settings > Members > Invite Coach' },
  { task: 'View analytics', path: 'Analytics > Reports' },
  { task: 'Scout opponent', path: 'Analytics > Reports > Scouting > Opponent Scouting' },
  { task: 'Print wristbands', path: 'Playbook > Print' },
  { task: 'Create game plan', path: 'Game Week > New Game Plan' },
  { task: 'Delete a game', path: 'Team > Schedule > Click Game > Delete (token refunded if no plays tagged)' },
  { task: 'Change plan', path: 'Team Settings > Subscription > Change Plan' },
  { task: 'View token balance', path: 'Team Settings > Usage' },
  { task: 'Purchase tokens', path: 'Team Settings > Usage > Purchase' },
  { task: 'Manage billing', path: 'Team Settings > Subscription > Manage Payment Method' },
  { task: 'Create another team', path: 'Team Settings > Team tab or Billing tab > Add Another Team' },
  { task: 'Upgrade communication plan', path: 'Communication > Plan > Upgrade to [tier]' },
  // Coach: player profile management
  { task: 'Review clips', path: 'Team > Players > Clip Review' },
  { task: 'Publish player report', path: 'Team > Players > Reports > Edit & Publish' },
  { task: 'Copy join code', path: 'Team > Players (roster view) > Code button in Actions column' },
  // Parent tasks
  { task: 'View athlete profile', path: 'Parent app > Player Profile tab' },
  { task: 'Create athlete profile', path: 'Parent app > Player Profile tab > /parent/athletes/new' },
  { task: 'Enter join code', path: 'Parent app > Create profile > Step 3 > Enter 6-character code' },
  { task: 'View game clips', path: 'Parent app > Player Profile > Highlights section' },
  { task: 'View game reports', path: 'Parent app > Player Profile > Game Reports section' },
  { task: 'Subscribe to profile', path: 'Parent app > Player Profile > Subscribe button' },
  { task: 'Switch to parent view', path: 'Dashboard > Avatar dropdown > Switch to parent view' },
  { task: 'Switch to coach view', path: 'Parent app > More menu > Switch to coach view' },
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
