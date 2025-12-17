/**
 * Context Provider Types
 *
 * Defines the interface for context providers that supply relevant
 * information to the AI for answering questions.
 */

export interface ContextProvider {
  id: string;
  name: string;
  /**
   * Get context relevant to the user's query
   * @param userId - The authenticated user's ID (for personalization)
   * @param query - The user's question (for relevance filtering)
   * @returns Context string to include in the AI prompt
   */
  getContext(userId: string, query: string): Promise<string>;
}

export interface GuideSection {
  title: string;
  path: string;
  content: string;
}

export interface GuideCategory {
  name: string;
  sections: GuideSection[];
}
