/**
 * Documentation Navigation Configuration
 *
 * Defines the structure for the in-app Guide documentation system.
 * Content files live in src/content/guide/
 */

export interface DocSection {
  title: string;
  slug: string;
  icon?: string; // Lucide icon name
  children?: DocSection[];
  comingSoon?: boolean;
}

export const docsNavigation: DocSection[] = [
  {
    title: "Getting Started",
    slug: "getting-started",
    icon: "Rocket",
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
    children: [
      { title: "Team Settings", slug: "team-settings" },
      { title: "Roster Management", slug: "roster-management" },
      { title: "Seasons", slug: "seasons" },
    ],
  },
  {
    title: "Playbook",
    slug: "playbook",
    icon: "BookOpen",
    children: [
      { title: "Creating Plays", slug: "creating-plays" },
      { title: "Organizing Your Playbook", slug: "organizing-playbook" },
      { title: "Play Builder", slug: "play-builder" },
    ],
  },
  {
    title: "Film",
    slug: "film",
    icon: "Video",
    children: [
      { title: "Uploading Film", slug: "uploading-film" },
      { title: "Tagging Plays", slug: "tagging-plays" },
      { title: "Tagging Levels", slug: "tagging-levels" },
      { title: "Multi-Camera", slug: "multi-camera" },
    ],
  },
  {
    title: "Analytics",
    slug: "analytics",
    icon: "BarChart3",
    children: [
      { title: "Team Analytics", slug: "team-analytics" },
      { title: "Season Trends", slug: "season-trends" },
      { title: "Player Stats", slug: "player-stats" },
    ],
  },
  {
    title: "Game Week Preparation",
    slug: "game-week",
    icon: "Calendar",
    children: [
      { title: "Overview", slug: "overview" },
      { title: "Scouting Reports", slug: "scouting-reports" },
      { title: "Practice Planning", slug: "practice-planning" },
      { title: "Game Day Ready", slug: "game-day-ready" },
    ],
  },
  {
    title: "Roles & Permissions",
    slug: "roles-permissions",
    icon: "Shield",
    children: [
      { title: "Owner / Head Coach", slug: "owner-head-coach" },
      { title: "Assistant Coach", slug: "assistant-coach" },
      { title: "Managing Team Members", slug: "managing-team-members" },
    ],
  },
  {
    title: "Subscriptions",
    slug: "subscriptions",
    icon: "CreditCard",
    children: [
      { title: "Tier Comparison", slug: "tier-comparison" },
      { title: "Upgrading Your Plan", slug: "upgrading" },
      { title: "Billing & Payments", slug: "billing" },
    ],
  },
  {
    title: "AI Features",
    slug: "ai-features",
    icon: "Sparkles",
    children: [
      { title: "AI Assistant", slug: "ai-assistant", comingSoon: true },
      { title: "AI Film Tagging", slug: "ai-film-tagging", comingSoon: true },
    ],
  },
  {
    title: "Support",
    slug: "support",
    icon: "HelpCircle",
    children: [
      { title: "Providing Feedback", slug: "providing-feedback" },
      { title: "Reporting Bugs", slug: "reporting-bugs" },
    ],
  },
];

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
