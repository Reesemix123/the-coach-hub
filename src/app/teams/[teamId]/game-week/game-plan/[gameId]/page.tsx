import AuthGuard from '@/components/AuthGuard';
import TeamNavigation from '@/components/TeamNavigation';
import GamePlanBuilder from '@/components/game-plan/GamePlanBuilder';
import { createClient } from '@/utils/supabase/server';
import { getOrCreateGamePlan, getGamePlanWithPlays } from '@/lib/services/game-plan.service';
import { getOpponentTendencies, getOpponentOffensiveTendencies, getOpponentSpecialTeamsTendencies } from '@/lib/services/opponent-analytics.service';
import { getTeamPlayRelationships } from '@/lib/services/setup-counter.service';
import type { PlaybookPlay } from '@/types/football';

interface GamePlanPageProps {
  params: Promise<{ teamId: string; gameId: string }>;
}

export default async function GamePlanPage({ params }: GamePlanPageProps) {
  const { teamId, gameId } = await params;
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

  // Get game data
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-gray-400">Game not found</div>
        </div>
      </AuthGuard>
    );
  }

  // Get or create game plan for this game (pass server client for auth)
  const gamePlan = await getOrCreateGamePlan(gameId, teamId, supabase);
  const gamePlanWithPlays = await getGamePlanWithPlays(gamePlan.id, supabase);

  // Get team's playbook for browsing
  const { data: playbook } = await supabase
    .from('playbook_plays')
    .select('*')
    .or(`team_id.eq.${teamId},team_id.is.null`)
    .eq('is_archived', false)
    .order('play_code', { ascending: true });

  // Get opponent tendencies from film (defensive, offensive, and special teams)
  const opponentName = game.opponent || '';
  const [opponentDefensiveProfile, opponentOffensiveProfile, opponentSpecialTeamsProfile] = await Promise.all([
    getOpponentTendencies(teamId, opponentName, supabase),
    getOpponentOffensiveTendencies(teamId, opponentName, supabase),
    getOpponentSpecialTeamsTendencies(teamId, opponentName, supabase)
  ]);

  // Get setup/counter relationships
  const setupCounterRelationships = await getTeamPlayRelationships(teamId, supabase);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <TeamNavigation team={team} teamId={teamId} currentPage="game-week" />
        <GamePlanBuilder
          teamId={teamId}
          gameId={gameId}
          game={game}
          gamePlan={gamePlanWithPlays}
          playbook={(playbook as PlaybookPlay[]) || []}
          opponentDefensiveProfile={opponentDefensiveProfile}
          opponentOffensiveProfile={opponentOffensiveProfile}
          opponentSpecialTeamsProfile={opponentSpecialTeamsProfile}
          setupCounterRelationships={setupCounterRelationships}
        />
      </div>
    </AuthGuard>
  );
}
