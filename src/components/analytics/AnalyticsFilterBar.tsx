/**
 * Analytics Filter Bar Component
 *
 * Compact, horizontal filter bar for analytics page.
 * Contains all filters in a clean, organized layout.
 */

'use client';

import ViewModeToggle, { VIEW_MODES } from '@/components/ViewModeToggle';

interface Game {
  id: string;
  name?: string;
  opponent?: string;
  date?: string;
}

interface AnalyticsFilterBarProps {
  // ODK
  selectedODK: 'offense' | 'defense' | 'special_teams';
  onODKChange: (odk: 'offense' | 'defense' | 'special_teams') => void;

  // Level
  selectedLevel: 'season' | 'game' | 'player';
  onLevelChange: (level: 'season' | 'game' | 'player') => void;

  // Game
  games: Game[];
  selectedGameId: string;
  onGameChange: (gameId: string) => void;

  // View Mode
  viewMode: 'cards' | 'list' | 'print';
  onViewModeChange: (mode: 'cards' | 'list' | 'print') => void;

  // Print
  onPrint: () => void;
}

export default function AnalyticsFilterBar({
  selectedODK,
  onODKChange,
  selectedLevel,
  onLevelChange,
  games,
  selectedGameId,
  onGameChange,
  viewMode,
  onViewModeChange,
  onPrint,
}: AnalyticsFilterBarProps) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 no-print">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Prominent Phase Selector */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Phase</h3>
          </div>
          <div className="flex gap-3">
            {[
              { value: 'offense', label: 'Offense' },
              { value: 'defense', label: 'Defense' },
              { value: 'special_teams', label: 'Special Teams' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => onODKChange(tab.value as any)}
                className={`flex-1 px-6 py-4 rounded-xl font-semibold text-base transition-all ${
                  selectedODK === tab.value
                    ? 'bg-black text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Filters */}
        <div className="flex items-center gap-6 flex-wrap">
          {/* Level Selector - Segmented Control */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="inline-flex rounded-lg border border-gray-300 p-1">
              {[
                { value: 'season', label: 'Season' },
                { value: 'game', label: 'Game' },
                { value: 'player', label: 'Player' },
              ].map((level) => (
                <button
                  key={level.value}
                  onClick={() => onLevelChange(level.value as any)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedLevel === level.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Game Dropdown - Only when Game level selected */}
          {selectedLevel === 'game' && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Game:</span>
              <select
                value={selectedGameId}
                onChange={(e) => onGameChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              >
                <option value="">-- Select --</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    vs {game.opponent} ({game.date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* View Mode - Segmented Control */}
          <ViewModeToggle
            currentMode={viewMode}
            modes={VIEW_MODES.ANALYTICS}
            onChange={(mode) => onViewModeChange(mode as any)}
          />

          {/* Print Button - Only when game selected */}
          {selectedLevel === 'game' && selectedGameId && (
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <span className="text-lg">🖨</span>
              Print Summary
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
