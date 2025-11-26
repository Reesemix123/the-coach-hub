/**
 * ReportFilters Component
 *
 * Filter controls for reports: game selection, opponent, date range, player.
 * Dynamically shows/hides filters based on report requirements.
 */

'use client';

import { ReportFilters as ReportFiltersType } from '@/types/reports';

interface Game {
  id: string;
  name: string;
  date: string;
  opponent: string;
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
  const handleFilterChange = (key: keyof ReportFiltersType, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  // Get unique opponents from games
  const opponents = Array.from(new Set(games.map(g => g.opponent))).filter(Boolean);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <option value="">All Games (Season)</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name} - {game.opponent}
                </option>
              ))}
            </select>
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

      {/* Clear Filters */}
      {(filters.gameId || filters.opponent || filters.playerId || filters.startDate || filters.endDate) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => onFiltersChange({})}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
