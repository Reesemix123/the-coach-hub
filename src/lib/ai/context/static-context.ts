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
import { generateAIContext } from '@/content/features';

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
