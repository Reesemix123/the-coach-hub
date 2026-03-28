import AuthGuard from '@/components/AuthGuard';
import TeamNavigation from '@/components/TeamNavigation';
import GameWeekHeader from '@/components/game-week/GameWeekHeader';
import Station from '@/components/game-week/Station';
import EmptyState from '@/components/game-week/EmptyState';
import GameSelector from '@/components/game-week/GameSelector';
import { getGameWeekContext, getStationData, getGamesForSelector, TimeFilter } from '@/lib/services/game-week.service';
import { createClient } from '@/utils/supabase/server';

interface GameWeekPageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ game?: string; time?: string }>;
}

export default async function GameWeekPage({ params, searchParams }: GameWeekPageProps) {
  const { teamId } = await params;
  const { game: selectedGameId, time } = await searchParams;
  const supabase = await createClient();

  // Parse time filter (default to 'upcoming')
  const timeFilter: TimeFilter = (time === 'past' || time === 'all') ? time : 'upcoming';

  // Get team data
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (!team) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-gray-400">Team not found</div>
        </div>
      </AuthGuard>
    );
  }

  // Get games for selector (includes both upcoming and past based on filter)
  const { upcoming: upcomingGames, past: pastGames } = await getGamesForSelector(teamId, 'all');

  // Get game week context (with selected game if provided)
  const context = await getGameWeekContext(teamId, selectedGameId);

  // Determine if we should show an empty state
  // Off-season only applies when there are no games AND no game is selected
  if (context.phase === 'off_season' && !selectedGameId) {
    // Check if there are any past games to review
    if (pastGames.length > 0) {
      // There are past games - don't show off-season, let the user select one
      // Fall through to normal rendering
    } else {
      return (
        <AuthGuard>
          <div className="min-h-screen bg-white">
            <TeamNavigation team={team} teamId={teamId} currentPage="game-week" />
            <div className="max-w-7xl mx-auto px-6 py-12">
              <EmptyState type="off_season" teamId={teamId} />
            </div>
          </div>
        </AuthGuard>
      );
    }
  }

  // Bye week only applies to upcoming games (not when reviewing past games)
  if (context.phase === 'bye_week' && !context.isHistorical) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white">
          <TeamNavigation team={team} teamId={teamId} currentPage="game-week" />
          <div className="max-w-7xl mx-auto px-6 py-12">
            <GameSelector
              upcomingGames={upcomingGames}
              pastGames={pastGames}
              selectedGameId={context.gameId}
              teamId={teamId}
              timeFilter={timeFilter}
              isHistorical={context.isHistorical}
            />
            <EmptyState type="bye_week" teamId={teamId} />
          </div>
        </div>
      </AuthGuard>
    );
  }

  // Get station data (works for both future and past games)
  // For past games, use daysAgo (as positive number) for display purposes
  const daysForStation = context.isHistorical
    ? (context.daysAgo || 0)
    : (context.daysUntilGame || 0);

  const stations = context.gameId
    ? await getStationData(teamId, context.gameId, daysForStation)
    : [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <TeamNavigation team={team} teamId={teamId} currentPage="game-week" />
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Game Selector with Time Filter */}
          <GameSelector
            upcomingGames={upcomingGames}
            pastGames={pastGames}
            selectedGameId={context.gameId}
            teamId={teamId}
            timeFilter={timeFilter}
            isHistorical={context.isHistorical}
          />

          {/* Header with game info and countdown/result */}
          <GameWeekHeader context={context} />

          {/* Station Grid - Two large tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stations.map((station) => (
              <Station key={station.name} station={station} large />
            ))}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
