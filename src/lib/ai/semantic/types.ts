/**
 * Semantic Layer Types
 *
 * Defines interfaces for Phase 2 semantic understanding capabilities.
 * These allow the AI to understand and query football-specific concepts.
 *
 * NOTE: These are stub interfaces only - resolvers are not implemented in MVP.
 */

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface MetricDefinition {
  name: string;
  description: string;
  unit?: string;
  /**
   * Calculate the metric value from provided data
   * @param data - Raw data to calculate from
   * @returns The calculated metric value
   */
  calculate: (data: unknown) => number;
}

export interface SemanticConcept {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  /**
   * Resolve this concept with the given parameters
   * @param params - Parameters for the query
   * @param context - Additional context (user, team, etc.)
   * @returns Natural language response
   */
  resolve: (params: unknown, context: unknown) => Promise<string>;
}

export interface SemanticLayer {
  metrics: Record<string, MetricDefinition>;
  concepts: Record<string, SemanticConcept>;
  /**
   * Find relevant concepts for a user query
   * @param query - The user's natural language query
   * @returns Matched concepts with extracted parameters
   */
  matchQuery: (
    query: string
  ) => Promise<Array<{ concept: SemanticConcept; params: unknown }>>;
}
