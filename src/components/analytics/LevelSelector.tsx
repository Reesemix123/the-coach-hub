/**
 * LevelSelector Component
 *
 * Allows selection between Season, Game, and Player level analytics.
 * - Season: All games combined
 * - Game: Specific game (requires game dropdown)
 * - Player: Individual player stats
 */

'use client';

interface LevelSelectorProps {
  selected: 'season' | 'game' | 'player';
  onChange: (level: 'season' | 'game' | 'player') => void;
}

export default function LevelSelector({ selected, onChange }: LevelSelectorProps) {
  const levels = [
    { value: 'season' as const, label: 'Season', description: 'All games' },
    { value: 'game' as const, label: 'Game', description: 'Single game' },
    { value: 'player' as const, label: 'Player', description: 'Individual stats' },
  ];

  return (
    <div className="flex gap-2 no-print">
      {levels.map((level) => (
        <button
          key={level.value}
          onClick={() => onChange(level.value)}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            selected === level.value
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="text-sm font-semibold">{level.label}</div>
          <div className="text-xs opacity-80">{level.description}</div>
        </button>
      ))}
    </div>
  );
}
