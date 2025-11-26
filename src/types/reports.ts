/**
 * Report Types and Interfaces
 *
 * Type definitions for the unified Analytics and Reporting system.
 * Supports multiple pre-configured report types with flexible filtering.
 */

import { ReactElement } from 'react';

// ============================================================================
// Report Types
// ============================================================================

export type ReportType =
  | 'season-overview'
  | 'game-report'
  | 'offensive'
  | 'defensive'
  | 'special-teams'
  | 'player'
  | 'situational'
  | 'drives';

export type ReportCategory = 'team' | 'unit' | 'analysis';

// ============================================================================
// Report Configuration
// ============================================================================

export interface ReportConfig {
  id: ReportType;
  name: string;
  description: string;
  category: ReportCategory;
  requiresGame?: boolean;      // Does this report need a game selected?
  requiresPlayer?: boolean;    // Does this report need a player selected?
  icon?: string;               // Lucide icon name (optional)
}

// ============================================================================
// Report Props and Filters
// ============================================================================

export interface ReportProps {
  teamId: string;
  gameId?: string;
  playerId?: string;
  filters: ReportFilters;
}

export interface ReportFilters {
  gameId?: string;
  opponent?: string;
  startDate?: string;
  endDate?: string;
  playerId?: string;
  positionGroup?: string;
}

// ============================================================================
// Report Display Options
// ============================================================================

export interface ReportDisplayOptions {
  viewMode: 'cards' | 'list' | 'print';
  showComparisons?: boolean;
  showTrends?: boolean;
}
