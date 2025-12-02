'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

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
  const [isPending, startTransition] = useTransition();

  const handleGameChange = (gameId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('game', gameId);
    startTransition(() => {
      router.push(`/teams/${teamId}/game-week?${params.toString()}`);
    });
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
    startTransition(() => {
      router.push(`/teams/${teamId}/game-week?${params.toString()}`);
    });
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
          <div className="relative">
            <select
              value={selectedGameId || ''}
              onChange={(e) => handleGameChange(e.target.value)}
              disabled={isPending}
              className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900
                         bg-white text-lg font-medium transition-opacity
                         ${isPending ? 'opacity-50 cursor-wait' : ''}`}
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
                    {isNext ? ' NEXT GAME' : ''}
                  </option>
                );
              })}
            </select>
            {isPending && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            )}
          </div>
        </div>

        {/* Show All Toggle */}
        <div className="flex-shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Range:
          </label>
          <button
            onClick={toggleShowAll}
            disabled={isPending}
            className={`px-4 py-3 border-2 border-gray-300 rounded-lg
                       hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                       text-gray-900 bg-white font-medium transition-all
                       ${isPending ? 'opacity-50 cursor-wait' : ''}`}
          >
            {showAll ? 'Next 60 Days' : 'All Games'}
          </button>
        </div>
      </div>

      {/* Loading overlay message */}
      {isPending && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading game data...</span>
        </div>
      )}
    </div>
  );
}
