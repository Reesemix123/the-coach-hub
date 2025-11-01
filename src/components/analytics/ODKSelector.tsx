/**
 * ODKSelector Component
 *
 * Allows selection between Offense, Defense, and Special Teams analytics.
 * Used to filter analytics by phase of the game.
 */

'use client';

interface ODKSelectorProps {
  selected: 'offense' | 'defense' | 'special_teams';
  onChange: (odk: 'offense' | 'defense' | 'special_teams') => void;
}

export default function ODKSelector({ selected, onChange }: ODKSelectorProps) {
  const options = [
    { value: 'offense' as const, label: 'Offense' },
    { value: 'defense' as const, label: 'Defense' },
    { value: 'special_teams' as const, label: 'Special Teams' },
  ];

  return (
    <div className="flex gap-2 no-print">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            selected === option.value
              ? 'bg-black text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
