/**
 * Semantic Metrics
 *
 * Placeholder definitions for Phase 2 football metrics.
 * These will be implemented when AI-powered analytics are added.
 */

import type { MetricDefinition } from './types';

/**
 * Placeholder metrics - to be implemented in Phase 2
 */
export const METRICS: Record<string, MetricDefinition> = {
  // Offensive metrics
  successRate: {
    name: 'Success Rate',
    description:
      'Percentage of plays that gain expected yardage based on down and distance',
    unit: 'percentage',
    calculate: () => {
      throw new Error('Not implemented - Phase 2');
    },
  },

  yardsPerPlay: {
    name: 'Yards Per Play',
    description: 'Average yards gained per offensive play',
    unit: 'yards',
    calculate: () => {
      throw new Error('Not implemented - Phase 2');
    },
  },

  explosivePlayRate: {
    name: 'Explosive Play Rate',
    description: 'Percentage of plays gaining 10+ yards (run) or 15+ yards (pass)',
    unit: 'percentage',
    calculate: () => {
      throw new Error('Not implemented - Phase 2');
    },
  },

  // Defensive metrics
  havocRate: {
    name: 'Havoc Rate',
    description:
      'Percentage of plays with TFL, sack, forced fumble, or interception',
    unit: 'percentage',
    calculate: () => {
      throw new Error('Not implemented - Phase 2');
    },
  },

  // Red zone metrics
  redZoneEfficiency: {
    name: 'Red Zone Efficiency',
    description: 'Touchdown percentage on red zone possessions',
    unit: 'percentage',
    calculate: () => {
      throw new Error('Not implemented - Phase 2');
    },
  },
};
