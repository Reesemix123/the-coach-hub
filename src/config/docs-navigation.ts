/**
 * Documentation Navigation Configuration
 *
 * Defines the structure for the in-app Guide documentation system.
 * Content files live in src/content/guide/
 *
 * audience field:
 *   'coach'  — shown in coach guide (/guide)
 *   'parent' — shown in parent guide (/parent/guide)
 *   'all'    — shown in both (not currently used)
 */

export interface DocSection {
  title: string;
  slug: string;
  icon?: string; // Lucide icon name or emoji
  children?: DocSection[];
  comingSoon?: boolean;
  audience?: 'coach' | 'parent' | 'all';
}

// =============================================================================
// Coach Guide Navigation
// =============================================================================

export const docsNavigation: DocSection[] = [
  {
    title: "Getting Started",
    slug: "getting-started",
    icon: "Rocket",
    audience: 'coach',
    children: [
      { title: "Creating Your Account", slug: "creating-account" },
      { title: "Creating Your First Team", slug: "creating-first-team" },
      { title: "Inviting Coaches", slug: "inviting-coaches" },
    ],
  },
  {
    title: "Teams",
    slug: "teams",
    icon: "Users",
    audience: 'coach',
    children: [
      { title: "Team Settings", slug: "team-settings" },
      { title: "Roster Management", slug: "roster-management" },
      { title: "Switching Teams", slug: "switching-teams" },
      { title: "Schedule & Calendar", slug: "schedule" },
    ],
  },
  {
    title: "Practice",
    slug: "practice",
    icon: "ClipboardList",
    audience: 'coach',
    children: [
      { title: "Creating Practice Plans", slug: "creating-practice-plans" },
      { title: "Practice Templates", slug: "templates" },
    ],
  },
  {
    title: "Playbook",
    slug: "playbook",
    icon: "BookOpen",
    audience: 'coach',
    children: [
      { title: "Getting Started with Plays", slug: "getting-started" },
      { title: "Drawing Play Diagrams", slug: "drawing-diagrams" },
      { title: "Managing Your Playbook", slug: "managing-playbook" },
    ],
  },
  {
    title: "Film",
    slug: "film",
    icon: "Video",
    audience: 'coach',
    children: [
      { title: "Uploading Film", slug: "uploading-film" },
      { title: "Tagging Plays", slug: "tagging-plays" },
      { title: "Tagging Levels", slug: "tagging-levels" },
      { title: "Multi-Camera", slug: "multi-camera" },
      { title: "Storage Limits", slug: "storage-limits" },
    ],
  },
  {
    title: "Analytics",
    slug: "analytics",
    icon: "BarChart3",
    audience: 'coach',
    children: [
      { title: "Season Overview", slug: "season-overview" },
      { title: "Game Report", slug: "game-report" },
      { title: "Offensive Report", slug: "offensive-report" },
      { title: "Defensive Report", slug: "defensive-report" },
      { title: "Situational Report", slug: "situational-report" },
      { title: "Drive Analysis", slug: "drive-analysis" },
      { title: "Special Teams", slug: "special-teams-report" },
      { title: "Player Report", slug: "player-report" },
      { title: "Opponent Scouting", slug: "opponent-scouting" },
    ],
  },
  {
    title: "Game Week Preparation",
    slug: "game-week",
    icon: "Calendar",
    audience: 'coach',
    children: [
      { title: "Overview", slug: "overview" },
      { title: "Opponent Tendencies", slug: "scouting-reports" },
      { title: "Data-Driven Practice", slug: "practice-planning" },
      { title: "Game Day Ready", slug: "game-day-ready" },
    ],
  },
  {
    title: "Roles & Permissions",
    slug: "roles-permissions",
    icon: "Shield",
    audience: 'coach',
    children: [
      { title: "Owner / Head Coach", slug: "owner-head-coach" },
      { title: "Coach", slug: "assistant-coach" },
      { title: "Managing Team Members", slug: "managing-team-members" },
    ],
  },
  {
    title: "Subscriptions",
    slug: "subscriptions",
    icon: "CreditCard",
    audience: 'coach',
    children: [
      { title: "Tier Comparison", slug: "tier-comparison" },
      { title: "Upgrading Your Plan", slug: "upgrading" },
      { title: "Billing & Payments", slug: "billing" },
    ],
  },
  {
    title: "AI Coaching",
    slug: "ai-features",
    icon: "Sparkles",
    audience: 'coach',
    children: [
      { title: "Coaching Chat", slug: "coaching-chat" },
      { title: "AI Film Tagging", slug: "ai-film-tagging", comingSoon: true },
    ],
  },
  {
    title: "Support",
    slug: "support",
    icon: "HelpCircle",
    audience: 'coach',
    children: [
      { title: "Providing Feedback", slug: "providing-feedback" },
      { title: "Reporting Bugs", slug: "reporting-bugs" },
    ],
  },
];

// =============================================================================
// Parent Guide Navigation
// =============================================================================

export const parentDocsNavigation: DocSection[] = [
  {
    title: 'Getting Started',
    slug: 'parent-getting-started',
    icon: '👋',
    audience: 'parent',
    children: [
      { title: 'Welcome to Youth Coach Hub', slug: 'welcome', audience: 'parent' },
      { title: 'Setting Up Your Account', slug: 'account-setup', audience: 'parent' },
      { title: 'Creating Your Athlete Profile', slug: 'athlete-profile', audience: 'parent' },
      { title: 'Joining Your Team', slug: 'join-team', audience: 'parent' },
    ],
  },
  {
    title: 'Clips & Highlights',
    slug: 'parent-clips',
    icon: '🎬',
    audience: 'parent',
    children: [
      { title: "Finding Your Athlete's Clips", slug: 'finding-clips', audience: 'parent' },
      { title: 'Understanding Clip Categories', slug: 'categories', audience: 'parent' },
      { title: 'Why Some Clips Are Locked', slug: 'locked-clips', audience: 'parent' },
    ],
  },
  {
    title: 'Game Reports',
    slug: 'parent-reports',
    icon: '📊',
    audience: 'parent',
    children: [
      { title: "Reading Your Athlete's Report", slug: 'reading-reports', audience: 'parent' },
      { title: 'Understanding Performance Stats', slug: 'stats-explained', audience: 'parent' },
      { title: 'Season Summary Reports', slug: 'season-summary', audience: 'parent' },
    ],
  },
  {
    title: 'Athlete Profile',
    slug: 'parent-profile',
    icon: '👤',
    audience: 'parent',
    children: [
      { title: "Your Athlete's Profile Page", slug: 'overview', audience: 'parent' },
      { title: 'Adding a Profile Photo', slug: 'photo', audience: 'parent' },
      { title: 'Season History', slug: 'seasons', audience: 'parent' },
      { title: "Sharing Your Athlete's Profile", slug: 'sharing', audience: 'parent' },
    ],
  },
  {
    title: 'Subscription',
    slug: 'parent-subscription',
    icon: '⭐',
    audience: 'parent',
    children: [
      { title: 'Free vs Subscribed Access', slug: 'free-vs-paid', audience: 'parent' },
      { title: 'Subscribing to Player Profile', slug: 'subscribe', audience: 'parent' },
      { title: 'Managing Your Subscription', slug: 'manage', audience: 'parent' },
      { title: 'What Happens When It Expires', slug: 'expiry', audience: 'parent' },
    ],
  },
  {
    title: 'Team Communication',
    slug: 'parent-communication',
    icon: '💬',
    audience: 'parent',
    children: [
      { title: 'Viewing the Schedule', slug: 'schedule', audience: 'parent' },
      { title: 'Messaging Your Coach', slug: 'messaging', audience: 'parent' },
      { title: 'RSVP to Events', slug: 'rsvp', audience: 'parent' },
      { title: 'Team Videos', slug: 'videos', audience: 'parent' },
    ],
  },
  {
    title: 'Account & Settings',
    slug: 'parent-account',
    icon: '⚙️',
    audience: 'parent',
    children: [
      { title: 'Notification Preferences', slug: 'notifications', audience: 'parent' },
      { title: 'Coach + Parent Mode', slug: 'dual-role', audience: 'parent' },
      { title: 'Installing the App (PWA)', slug: 'install-pwa', audience: 'parent' },
    ],
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to find a section by slug path
 */
export function findSectionByPath(path: string[]): DocSection | null {
  if (path.length === 0) return null;

  const [category, ...rest] = path;
  const section = docsNavigation.find(s => s.slug === category);

  if (!section) return null;
  if (rest.length === 0) return section;

  const child = section.children?.find(c => c.slug === rest[0]);
  return child || null;
}

/**
 * Helper to find a section in parent docs navigation
 */
export function findParentSectionByPath(path: string[]): DocSection | null {
  if (path.length === 0) return null;

  const [category, ...rest] = path;
  const section = parentDocsNavigation.find(s => s.slug === category);

  if (!section) return null;
  if (rest.length === 0) return section;

  const child = section.children?.find(c => c.slug === rest[0]);
  return child || null;
}

/**
 * Get all doc paths for static generation
 */
export function getAllDocPaths(): string[][] {
  const paths: string[][] = [];

  for (const section of docsNavigation) {
    paths.push([section.slug]);
    if (section.children) {
      for (const child of section.children) {
        paths.push([section.slug, child.slug]);
      }
    }
  }

  return paths;
}

/**
 * Get all parent doc paths for static generation
 */
export function getAllParentDocPaths(): string[][] {
  const paths: string[][] = [];

  for (const section of parentDocsNavigation) {
    paths.push([section.slug]);
    if (section.children) {
      for (const child of section.children) {
        paths.push([section.slug, child.slug]);
      }
    }
  }

  return paths;
}
