/**
 * Report Registry
 *
 * Central registry of all available reports in the Analytics and Reporting system.
 * Add new reports here to make them available in the report selector.
 */

import { ReportConfig, ReportType } from '@/types/reports';

// ============================================================================
// Report Registry
// ============================================================================

export const REPORT_REGISTRY: ReportConfig[] = [
  // Team Reports
  {
    id: 'season-overview',
    name: 'Season Overview',
    description: '28 comprehensive team metrics and performance summary',
    category: 'team',
    icon: 'BarChart3',
  },
  {
    id: 'game-report',
    name: 'Game Report',
    description: 'Detailed breakdown of a single game with comparisons',
    category: 'team',
    requiresGame: true,
    icon: 'FileText',
  },

  // Unit Reports
  {
    id: 'offensive',
    name: 'Offensive Report',
    description: 'Complete offensive analysis with player stats and drive analytics',
    category: 'unit',
    icon: 'TrendingUp',
  },
  {
    id: 'defensive',
    name: 'Defensive Report',
    description: 'Complete defensive analysis with player stats and opponent analytics',
    category: 'unit',
    icon: 'Shield',
  },
  {
    id: 'special-teams',
    name: 'Special Teams Report',
    description: 'Special teams performance metrics and analysis',
    category: 'unit',
    icon: 'Zap',
  },

  // Analysis Reports
  {
    id: 'player',
    name: 'Player Report',
    description: 'Individual player performance by position group',
    category: 'analysis',
    requiresPlayer: true,
    icon: 'User',
  },
  {
    id: 'situational',
    name: 'Situational Report',
    description: 'Performance by down, distance, field position, and score',
    category: 'analysis',
    icon: 'Split',
  },
  {
    id: 'drives',
    name: 'Drive Analysis',
    description: 'Drive-level performance metrics and efficiency',
    category: 'analysis',
    icon: 'ArrowRight',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get report configuration by ID
 */
export function getReportConfig(reportType: ReportType): ReportConfig | undefined {
  return REPORT_REGISTRY.find(r => r.id === reportType);
}

/**
 * Get all reports in a category
 */
export function getReportsByCategory(category: 'team' | 'unit' | 'analysis'): ReportConfig[] {
  return REPORT_REGISTRY.filter(r => r.category === category);
}

/**
 * Get default report (first in list)
 */
export function getDefaultReport(): ReportConfig {
  return REPORT_REGISTRY[0];
}

/**
 * Validate if report can be displayed with current filters
 */
export function canDisplayReport(
  report: ReportConfig,
  filters: { gameId?: string; playerId?: string }
): { valid: boolean; message?: string } {
  if (report.requiresGame && !filters.gameId) {
    return { valid: false, message: 'This report requires a game to be selected' };
  }

  if (report.requiresPlayer && !filters.playerId) {
    return { valid: false, message: 'This report requires a player to be selected' };
  }

  return { valid: true };
}
