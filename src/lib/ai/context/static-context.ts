/**
 * Static Context Provider
 *
 * Provides comprehensive app documentation from the User Guide
 * as context for the AI to answer questions about the application.
 *
 * Uses the shared Feature Registry (src/content/features.ts) as the
 * single source of truth for feature descriptions. This ensures the
 * AI context stays in sync with the User Guide.
 *
 * The content is loaded once at initialization for performance.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { ContextProvider, GuideCategory, GuideSection } from './types';
import { generateAIContext, APP_FEATURES, COMMON_TASKS } from '@/content/features';

class StaticContextProvider implements ContextProvider {
  id = 'static-guide';
  name = 'Static Guide Context';

  private guideContent: string | null = null;
  private categories: GuideCategory[] = [];
  private initialized = false;

  /**
   * Initialize the context provider by loading all guide content
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const guidePath = path.join(process.cwd(), 'src/content/guide');
    this.categories = await this.loadGuideCategories(guidePath);
    this.guideContent = this.formatGuideContent(this.categories);
    this.initialized = true;
  }

  /**
   * Load all guide categories and their content
   */
  private async loadGuideCategories(basePath: string): Promise<GuideCategory[]> {
    const categories: GuideCategory[] = [];

    try {
      const dirs = fs.readdirSync(basePath, { withFileTypes: true });

      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;

        const categoryPath = path.join(basePath, dir.name);
        const sections = await this.loadCategorySections(categoryPath, dir.name);

        if (sections.length > 0) {
          categories.push({
            name: this.formatCategoryName(dir.name),
            sections,
          });
        }
      }
    } catch (error) {
      console.error('Error loading guide categories:', error);
    }

    return categories;
  }

  /**
   * Load all sections within a category
   */
  private async loadCategorySections(
    categoryPath: string,
    categoryName: string
  ): Promise<GuideSection[]> {
    const sections: GuideSection[] = [];

    try {
      const files = fs.readdirSync(categoryPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(categoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: markdown } = matter(content);

        sections.push({
          title: frontmatter.title || this.formatFileName(file),
          path: `${categoryName}/${file.replace('.md', '')}`,
          content: markdown.trim(),
        });
      }
    } catch (error) {
      console.error(`Error loading sections from ${categoryPath}:`, error);
    }

    return sections;
  }

  /**
   * Format category directory name to readable title
   */
  private formatCategoryName(name: string): string {
    return name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format file name to readable title
   */
  private formatFileName(filename: string): string {
    return filename
      .replace('.md', '')
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format all guide content into a structured string for the AI
   */
  private formatGuideContent(categories: GuideCategory[]): string {
    const sections: string[] = [];

    for (const category of categories) {
      sections.push(`\n## ${category.name}\n`);

      for (const section of category.sections) {
        sections.push(`### ${section.title}\n`);
        sections.push(section.content);
        sections.push('\n');
      }
    }

    return sections.join('\n');
  }

  /**
   * Get a condensed summary of app features for efficient token usage
   *
   * Uses the shared Feature Registry to ensure consistency with the User Guide.
   * When features change, update src/content/features.ts and both the AI
   * context and Guide navigation will stay in sync.
   */
  private getCondensedContext(): string {
    return generateAIContext();
  }

  /**
   * Get the system context for the AI
   * Uses condensed context for efficiency, with full docs available for specific queries
   */
  async getContext(_userId: string, query: string): Promise<string> {
    await this.initialize();

    // Use condensed context by default to reduce token usage
    // Could expand to full docs for complex queries in the future
    const contextContent = this.getCondensedContext();

    return `You are a helpful AI assistant for Youth Coach Hub, a football coaching platform.

GUIDELINES:
- Provide helpful, informative answers (3-5 sentences for most questions)
- Start with a direct answer, then add useful context or tips
- For "how to" questions, include clear step-by-step instructions
- Always include the navigation path (e.g., "Go to Team Settings > Manage Coaches")
- Mention related features when relevant (e.g., "You can also...")
- End with a User Guide link using markdown: [Learn more](/guide/path)
- Use bullet points for multi-step processes

RESPONSE FORMAT EXAMPLES:
Q: "How do I add coaches?"
A: "To invite coaches to your team, go to **Team Settings > Manage Coaches > Invite**. Enter their email address and select their role (Coach or Analyst). They'll receive an email invitation to join your team. Once they accept, they can start contributing to your playbook and film analysis. [Learn more](/guide/getting-started/inviting-coaches)"

Q: "What can coaches do?"
A: "Assistant Coaches have access to most team features. They can create and edit plays in your playbook, upload and tag game film, view all analytics reports, and access the roster. They cannot change team settings or manage other coaches - only the Owner/Head Coach has those permissions. [Learn more](/guide/roles-permissions/assistant-coach)"

${contextContent}

Be helpful and informative. Give coaches the context they need to use the feature effectively.`;
  }
}

// Export singleton instance
export const staticContextProvider = new StaticContextProvider();

// ---------------------------------------------------------------------------
// Parent AI Context
// ---------------------------------------------------------------------------

const PARENT_RELEVANT_IDS = new Set([
  'player-profiles',
  'parent-profile-subscription',
  'athlete-profile-creation',
  'coach-parent-dual-role',
  'communication-hub',
]);

/**
 * Generate a complete system prompt + feature context for parent users.
 * Filters the feature registry to parent-relevant entries only.
 */
export function generateParentAIContext(): string {
  // Build parent-filtered feature summary (same format as generateAIContext)
  const sections: string[] = ['YOUTH COACH HUB — PARENT FEATURES\n'];

  const parentCategories = APP_FEATURES.filter((c) => PARENT_RELEVANT_IDS.has(c.id));
  parentCategories.forEach((category, index) => {
    sections.push(`${index + 1}. ${category.name.toUpperCase()}`);
    category.features.forEach((feature) => {
      const nav = feature.navigationPath ? ` (${feature.navigationPath})` : '';
      sections.push(`- ${feature.name}: ${feature.description}${nav}`);
      if (feature.subFeatures) {
        feature.subFeatures.forEach((sf) => sections.push(`  • ${sf}`));
      }
    });
    sections.push('');
  });

  // Parent-specific common tasks
  const parentTasks = COMMON_TASKS.filter((t) =>
    t.path.toLowerCase().includes('parent') ||
    t.task.toLowerCase().includes('athlete') ||
    t.task.toLowerCase().includes('clip') ||
    t.task.toLowerCase().includes('report') ||
    t.task.toLowerCase().includes('subscribe') ||
    t.task.toLowerCase().includes('join code') ||
    t.task.toLowerCase().includes('switch')
  );

  if (parentTasks.length > 0) {
    sections.push('COMMON PARENT TASKS:');
    parentTasks.forEach((t) => sections.push(`- ${t.task}: ${t.path}`));
  }

  const featureContext = sections.join('\n');

  return `You are a helpful assistant for Youth Coach Hub, specifically here to help parents navigate the parent app and understand their athlete's content.

Your role: Help parents find clips and reports, understand their athlete profile, navigate the app, manage their subscription, and get the most out of Youth Coach Hub as a parent.

Tone: Warm, clear, encouraging, and non-technical. You are speaking to a sports parent who loves their kid, not a developer or a coach. Use plain language. Avoid coaching jargon entirely.

Scope: Only answer questions about the parent app experience. If asked about coaching tools, playbooks, film analysis, or coaching strategy, politely explain that those are coach tools and redirect to parent features.

Navigation reference:
- Home: tap the Youth Coach Hub logo or /parent
- Bottom tabs: Schedule, Messages, Videos, Reports, Directory, Player Profile
- More menu: Announcements, Switch to coach view (if dual-role), Settings, Sign out
- Athlete profile: Player Profile tab in bottom navigation
- Create athlete profile: Player Profile tab → /parent/athletes/new
- Clips location: athlete profile page → Highlights section
- Reports location: athlete profile page → Game Reports section OR the Reports tab in bottom navigation

GUIDELINES:
- Provide helpful, clear answers (2-4 sentences for most questions)
- Start with a direct answer, then add useful context
- For "how to" questions, include step-by-step instructions using the navigation reference above
- Use warm, encouraging language — you're helping a parent, not giving a technical briefing
- If a parent asks about something that requires coach action (approving clips, publishing reports), explain that their coach handles that step
- Never mention database tables, API routes, or technical implementation details

RESPONSE EXAMPLES:
Q: "Where are my son's highlights?"
A: "Your child's game highlights are on their athlete profile page. Tap the **Player Profile** tab at the bottom of your screen — you'll see a **Highlights** section with all approved game clips. If you don't see any clips yet, your coach may not have reviewed them yet. Clips appear automatically after your coach completes film analysis and approves them."

Q: "How do I keep access to clips after the season?"
A: "During the season, you can view clips and reports for free as long as your coach's Communication Hub plan is active. To keep permanent access after the season ends, you can subscribe for $19.99/year on your athlete's profile page — look for the **Subscribe** button. This keeps all clips and reports available forever, across all seasons."

${featureContext}

Be helpful and reassuring. Parents want to see their child succeed — help them find what they need.`;
}
