'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface Game {
  id: string;
  name: string;
  opponent: string;
  opponent_team_name?: string;
  date: string;
  is_opponent_game?: boolean;
}

interface GameSelectorProps {
  upcomingGames: Game[];
  selectedGameId: string | null;
  teamId: string;
}

export default function GameSelector({
  upcomingGames,
  selectedGameId,
  teamId
}: GameSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAll, setShowAll] = useState(searchParams.get('showAll') === 'true');

  const handleGameChange = (gameId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('game', gameId);
    router.push(`/teams/${teamId}/game-week?${params.toString()}`);
  };

  const toggleShowAll = () => {
    const newShowAll = !showAll;
    setShowAll(newShowAll);
    const params = new URLSearchParams(searchParams);
    if (newShowAll) {
      params.set('showAll', 'true');
    } else {
      params.delete('showAll');
    }
    // Keep selected game if it exists
    if (selectedGameId) {
      params.set('game', selectedGameId);
    }
    router.push(`/teams/${teamId}/game-week?${params.toString()}`);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (upcomingGames.length === 0) {
    return (
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No upcoming games scheduled.</p>
      </div>
    );
  }

  const nextGameId = upcomingGames[0]?.id;

  return (
    <div className="mb-6">
      <div className="flex items-end gap-4">
        {/* Game Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preparing For:
          </label>
          <select
            value={selectedGameId || ''}
            onChange={(e) => handleGameChange(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900
                       bg-white text-lg font-medium"
          >
            {upcomingGames.map(game => {
              const isNext = game.id === nextGameId;
              let label = '';

              if (game.is_opponent_game) {
                // Opponent scouting game
                label = `Scouting: ${game.opponent_team_name || game.opponent}`;
              } else {
                // Your team's game
                label = `vs ${game.opponent}`;
              }

              return (
                <option key={game.id} value={game.id}>
                  {label} - {formatDate(game.date)}
                  {isNext ? ' 🔥 NEXT GAME' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Show All Toggle */}
        <div className="flex-shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Range:
          </label>
          <button
            onClick={toggleShowAll}
            className="px-4 py-3 border-2 border-gray-300 rounded-lg
                       hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                       text-gray-900 bg-white font-medium transition-colors"
          >
            {showAll ? 'Next 60 Days' : 'All Games'}
          </button>
        </div>
      </div>
    </div>
  );
}
