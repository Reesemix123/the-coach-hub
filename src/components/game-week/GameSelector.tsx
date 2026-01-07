'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Calendar, History, CalendarDays } from 'lucide-react';

type TimeFilter = 'upcoming' | 'past' | 'all';

interface Game {
  id: string;
  name: string;
  opponent: string;
  opponent_team_name?: string;
  date: string;
  is_opponent_game?: boolean;
  team_score?: number | null;
  opponent_score?: number | null;
  game_result?: 'win' | 'loss' | 'tie' | null;
}

interface GameSelectorProps {
  upcomingGames: Game[];
  pastGames: Game[];
  selectedGameId: string | null;
  teamId: string;
  timeFilter: TimeFilter;
  isHistorical?: boolean;
}

export default function GameSelector({
  upcomingGames,
  pastGames,
  selectedGameId,
  teamId,
  timeFilter: initialTimeFilter,
  isHistorical
}: GameSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialTimeFilter);
  const [isPending, startTransition] = useTransition();

  const handleGameChange = (gameId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('game', gameId);
    params.set('time', timeFilter);
    startTransition(() => {
      router.push(`/teams/${teamId}/game-week?${params.toString()}`);
    });
  };

  const handleTimeFilterChange = (newFilter: TimeFilter) => {
    setTimeFilter(newFilter);
    const params = new URLSearchParams(searchParams);
    params.set('time', newFilter);

    // If changing filter and current selection doesn't exist in new filter, clear it
    const allGamesInFilter = newFilter === 'upcoming' ? upcomingGames
      : newFilter === 'past' ? pastGames
      : [...upcomingGames, ...pastGames];

    if (selectedGameId && !allGamesInFilter.find(g => g.id === selectedGameId)) {
      params.delete('game');
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

  // Format game result
  const formatResult = (game: Game) => {
    if (game.team_score === null || game.team_score === undefined) return '';
    const score = `${game.team_score}-${game.opponent_score}`;
    const result = game.game_result === 'win' ? 'W' : game.game_result === 'loss' ? 'L' : 'T';
    return ` (${result} ${score})`;
  };

  const hasUpcoming = upcomingGames.length > 0;
  const hasPast = pastGames.length > 0;
  const hasAnyGames = hasUpcoming || hasPast;

  // Determine which games to show based on filter
  const showUpcoming = timeFilter === 'upcoming' || timeFilter === 'all';
  const showPast = timeFilter === 'past' || timeFilter === 'all';

  // Get the next game ID for highlighting
  const nextGameId = upcomingGames[0]?.id;

  if (!hasAnyGames) {
    return (
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No games scheduled.</p>
      </div>
    );
  }

  // Determine label based on context
  const labelText = isHistorical ? 'Reviewing:' : 'Preparing For:';

  return (
    <div className="mb-6">
      <div className="flex items-end gap-4">
        {/* Game Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labelText}
          </label>
          <div className="relative">
            <select
              value={selectedGameId || ''}
              onChange={(e) => handleGameChange(e.target.value)}
              disabled={isPending}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900
                         bg-white transition-opacity
                         ${isPending ? 'opacity-50 cursor-wait' : ''}`}
            >
              <option value="" disabled>Select a game...</option>

              {/* Upcoming Games Group */}
              {showUpcoming && upcomingGames.length > 0 && (
                <optgroup label="Upcoming Games">
                  {upcomingGames.map(game => {
                    const isNext = game.id === nextGameId;
                    let label = '';

                    if (game.is_opponent_game) {
                      label = `Scouting: ${game.opponent_team_name || game.opponent}`;
                    } else {
                      label = `vs ${game.opponent}`;
                    }

                    return (
                      <option key={game.id} value={game.id}>
                        {label} - {formatDate(game.date)}
                        {isNext ? ' ★ NEXT' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              )}

              {/* Past Games Group */}
              {showPast && pastGames.length > 0 && (
                <optgroup label="Past Games">
                  {pastGames.map(game => {
                    let label = '';

                    if (game.is_opponent_game) {
                      label = `Scouting: ${game.opponent_team_name || game.opponent}`;
                    } else {
                      label = `vs ${game.opponent}`;
                    }

                    return (
                      <option key={game.id} value={game.id}>
                        {label} - {formatDate(game.date)}{formatResult(game)}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
            {isPending && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            )}
          </div>
        </div>

        {/* Time Filter Toggle */}
        <div className="flex-shrink-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Show:
          </label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => handleTimeFilterChange('upcoming')}
              disabled={isPending || !hasUpcoming}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors
                         ${timeFilter === 'upcoming'
                           ? 'bg-gray-900 text-white'
                           : 'bg-white text-gray-700 hover:bg-gray-50'}
                         ${isPending || !hasUpcoming ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Show upcoming games"
            >
              <Calendar className="w-4 h-4" />
              Upcoming
            </button>
            <button
              onClick={() => handleTimeFilterChange('past')}
              disabled={isPending || !hasPast}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 flex items-center gap-1.5 transition-colors
                         ${timeFilter === 'past'
                           ? 'bg-gray-900 text-white'
                           : 'bg-white text-gray-700 hover:bg-gray-50'}
                         ${isPending || !hasPast ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Show past games"
            >
              <History className="w-4 h-4" />
              Past
            </button>
            <button
              onClick={() => handleTimeFilterChange('all')}
              disabled={isPending}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 flex items-center gap-1.5 transition-colors
                         ${timeFilter === 'all'
                           ? 'bg-gray-900 text-white'
                           : 'bg-white text-gray-700 hover:bg-gray-50'}
                         ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Show all games"
            >
              <CalendarDays className="w-4 h-4" />
              All
            </button>
          </div>
        </div>
      </div>

      {/* Loading overlay message */}
      {isPending && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading game data...</span>
        </div>
      )}

      {/* Historical mode indicator */}
      {isHistorical && (
        <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          <History className="w-4 h-4" />
          <span>Viewing game prep history - this game has already been played</span>
        </div>
      )}
    </div>
  );
}
