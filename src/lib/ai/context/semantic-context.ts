/**
 * Semantic Context Provider
 *
 * Provides team-specific context for coaching intelligence queries.
 * Fetches relevant data from Supabase and formats it for the AI.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContextProvider } from './types';
import type { ClassificationEntities } from '../router/intent-classifier';
import { resolveConceptForTopic, getTeamIdForUser, getTeamName } from '../semantic';

const COACHING_SYSTEM_PROMPT = `You are an expert youth football coaching assistant for Youth Coach Hub.

ROLE:
- Analyze team performance data provided in context
- Give specific, actionable coaching insights
- Use actual numbers from the data (don't make up statistics)
- Tailor advice for youth/high school level

STYLE:
- Be direct and specific
- Lead with the key insight
- Support with 2-3 data points
- End with 1-2 actionable recommendations
- Keep responses concise (3-5 paragraphs max)

LIMITATIONS:
- Only reference data provided in context
- If data is insufficient, say so
- Don't make assumptions about missing data

FORMATTING:
- Use markdown for headers and bold text
- Use bullet points for lists
- Include specific numbers from the data`;

class SemanticContextProvider implements ContextProvider {
  id = 'semantic-coaching';
  name = 'Semantic Coaching Context';

  private supabase: SupabaseClient | null = null;
  private entities: ClassificationEntities = {};

  /**
   * Set the Supabase client for data fetching
   */
  setSupabase(supabase: SupabaseClient): void {
    this.supabase = supabase;
  }

  /**
   * Set the classified entities for context generation
   */
  setEntities(entities: ClassificationEntities): void {
    this.entities = entities;
  }

  /**
   * Get context for a coaching query
   */
  async getContext(userId: string, query: string): Promise<string> {
    if (!this.supabase) {
      console.error('Supabase client not set for SemanticContextProvider');
      return this.getFallbackContext();
    }

    try {
      // Get user's team
      const teamId = await getTeamIdForUser(this.supabase, userId);

      if (!teamId) {
        return this.getNoTeamContext();
      }

      // Get team name
      const teamName = await getTeamName(this.supabase, teamId);

      // Resolve the appropriate concept based on entities
      const analysisData = await resolveConceptForTopic(
        this.supabase,
        teamId,
        this.entities
      );

      // Combine system prompt with data
      return `${COACHING_SYSTEM_PROMPT}

---

# Team: ${teamName}

## Analysis Data

${analysisData}

---

Based on this data, answer the coach's question with specific insights and recommendations.`;
    } catch (error) {
      console.error('Error generating semantic context:', error);
      return this.getFallbackContext();
    }
  }

  private getFallbackContext(): string {
    return `${COACHING_SYSTEM_PROMPT}

---

I don't have access to your team's data right now. Please try again in a moment.

If you continue to see this message, make sure you have:
1. At least one team set up
2. Some games with tagged film
3. Plays linked to your playbook`;
  }

  private getNoTeamContext(): string {
    return `${COACHING_SYSTEM_PROMPT}

---

I couldn't find a team associated with your account. To use coaching intelligence:

1. Create a team in Team Settings
2. Add some games
3. Upload and tag game film
4. Link plays to your playbook

Once you have some data, I can analyze your team's performance!`;
  }
}

// Export singleton instance
export const semanticContextProvider = new SemanticContextProvider();
