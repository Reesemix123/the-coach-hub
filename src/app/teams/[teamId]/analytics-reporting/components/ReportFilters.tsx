/**
 * ReportFilters Component
 *
 * Filter controls for reports: game selection, view mode, opponent, date range, player.
 * Supports both single-game and cumulative (through week X) filtering.
 *
 * Game selection is always required. Use "Through Week" mode on the last game
 * to see full season stats.
 */

'use client';

import { useEffect } from 'react';
import { ReportFilters as ReportFiltersType } from '@/types/reports';

interface Game {
  id: string;
  name: string;
  date: string;
  opponent: string;
  week_number?: number;
}

interface Player {
  id: string;
  jersey_number: string;
  first_name: string;
  last_name: string;
}

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onFiltersChange: (filters: ReportFiltersType) => void;
  games?: Game[];
  players?: Player[];
  showGameFilter?: boolean;
  showPlayerFilter?: boolean;
  showOpponentFilter?: boolean;
  showDateRange?: boolean;
}

export default function ReportFilters({
  filters,
  onFiltersChange,
  games = [],
  players = [],
  showGameFilter = true,
  showPlayerFilter = false,
  showOpponentFilter = false,
  showDateRange = false,
}: ReportFiltersProps) {

  // Sort games by week_number or date for proper ordering
  const sortedGames = [...games].sort((a, b) => {
    if (a.week_number && b.week_number) {
      return a.week_number - b.week_number;
    }
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Calculate cumulative game IDs when viewMode or gameId changes
  useEffect(() => {
    if (filters.viewMode === 'cumulative' && filters.gameId) {
      const selectedGame = sortedGames.find(g => g.id === filters.gameId);
      if (selectedGame) {
        // Get all games up to and including the selected game
        const cumulativeGames = sortedGames.filter(g => {
          if (selectedGame.week_number && g.week_number) {
            return g.week_number <= selectedGame.week_number;
          }
          return new Date(g.date).getTime() <= new Date(selectedGame.date).getTime();
        });
        const gameIds = cumulativeGames.map(g => g.id);

        // Only update if gameIds changed
        if (JSON.stringify(gameIds) !== JSON.stringify(filters.gameIds)) {
          onFiltersChange({
            ...filters,
            gameIds,
          });
        }
      }
    } else if (filters.viewMode === 'single' && filters.gameIds) {
      // Clear gameIds when switching to single mode
      onFiltersChange({
        ...filters,
        gameIds: undefined,
      });
    }
  }, [filters.viewMode, filters.gameId, sortedGames]);

  const handleFilterChange = (key: keyof ReportFiltersType, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const handleViewModeChange = (mode: 'single' | 'cumulative') => {
    onFiltersChange({
      ...filters,
      viewMode: mode,
      gameIds: undefined, // Reset gameIds, will be recalculated by useEffect
    });
  };

  // Get unique opponents from games
  const opponents = Array.from(new Set(games.map(g => g.opponent))).filter(Boolean);

  // Get display info for cumulative view
  const selectedGame = filters.gameId ? sortedGames.find(g => g.id === filters.gameId) : null;
  const cumulativeGamesCount = filters.gameIds?.length || 0;
  const showViewModeToggle = showGameFilter && filters.gameId;

  // Check if any filters are active
  const hasActiveFilters = filters.gameId || filters.opponent || filters.playerId || filters.startDate || filters.endDate;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-end gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Game Filter */}
        {showGameFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Game
            </label>
            <select
              value={filters.gameId || ''}
              onChange={(e) => handleFilterChange('gameId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              {!filters.gameId && (
                <option value="">Select a game...</option>
              )}
              {sortedGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.week_number ? `Week ${game.week_number}` : game.name} - {game.opponent}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* View Mode Toggle - Only show when a game is selected */}
        {showViewModeToggle && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              View
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => handleViewModeChange('single')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  filters.viewMode !== 'cumulative'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                This Game
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('cumulative')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                  filters.viewMode === 'cumulative'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Through Week
              </button>
            </div>
          </div>
        )}

        {/* Opponent Filter */}
        {showOpponentFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opponent
            </label>
            <select
              value={filters.opponent || ''}
              onChange={(e) => handleFilterChange('opponent', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">All Opponents</option>
              {opponents.map((opponent) => (
                <option key={opponent} value={opponent}>
                  {opponent}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Player Filter */}
        {showPlayerFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player
            </label>
            <select
              value={filters.playerId || ''}
              onChange={(e) => handleFilterChange('playerId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="">Select Player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        {showDateRange && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
          </>
        )}
        </div>

        {/* Clear Filters - inline at end of row */}
        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange({})}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap pb-2"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Cumulative View Info */}
      {filters.viewMode === 'cumulative' && selectedGame && cumulativeGamesCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing stats for <span className="font-medium">{cumulativeGamesCount} game{cumulativeGamesCount > 1 ? 's' : ''}</span>
            {selectedGame.week_number && (
              <span> (Weeks 1-{selectedGame.week_number})</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
