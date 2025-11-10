import AuthGuard from '@/components/AuthGuard';
import TeamNavigation from '@/components/TeamNavigation';
import GameWeekHeader from '@/components/game-week/GameWeekHeader';
import Station from '@/components/game-week/Station';
import EmptyState from '@/components/game-week/EmptyState';
import GameSelector from '@/components/game-week/GameSelector';
import { getGameWeekContext, getStationData, getUpcomingGames } from '@/lib/services/game-week.service';
import { createClient } from '@/utils/supabase/server';

interface GameWeekPageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ game?: string; showAll?: string }>;
}

export default async function GameWeekPage({ params, searchParams }: GameWeekPageProps) {
  const { teamId } = await params;
  const { game: selectedGameId, showAll } = await searchParams;
  const supabase = await createClient();

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

  // Get upcoming games for selector
  const upcomingGames = await getUpcomingGames(teamId, showAll === 'true');

  // Get game week context (with selected game if provided)
  const context = await getGameWeekContext(teamId, selectedGameId);

  // Show empty state if off-season or bye week
  if (context.phase === 'off_season') {
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

  if (context.phase === 'bye_week') {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white">
          <TeamNavigation team={team} teamId={teamId} currentPage="game-week" />
          <div className="max-w-7xl mx-auto px-6 py-12">
            <EmptyState type="bye_week" teamId={teamId} />
          </div>
        </div>
      </AuthGuard>
    );
  }

  // Get station data (only if we have an active game week)
  const stations = context.gameId && context.daysUntilGame !== null
    ? await getStationData(teamId, context.gameId, context.daysUntilGame)
    : [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <TeamNavigation team={team} teamId={teamId} currentPage="game-week" />
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Game Selector */}
          <GameSelector
            upcomingGames={upcomingGames}
            selectedGameId={context.gameId}
            teamId={teamId}
          />

          {/* Header with game info and countdown */}
          <GameWeekHeader context={context} />

          {/* Station Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stations.map((station) => (
              <Station key={station.name} station={station} />
            ))}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
