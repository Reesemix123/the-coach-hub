import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import GamePrepHubClient from './GamePrepHubClient';
import {
  getOrCreatePrepPlan,
  getPrepPlanWithDetails,
  generateInsightsFromFilm,
  refreshPrepPlanTasks
} from '@/lib/services/game-prep-hub.service';

interface PageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ game?: string }>;
}

export default async function GamePrepHubPage({ params, searchParams }: PageProps) {
  const { teamId } = await params;
  const { game: gameId } = await searchParams;

  const supabase = await createClient();

  // Get user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Verify team ownership
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!team) {
    redirect('/');
  }

  // If no game specified, find the next upcoming game
  let selectedGameId: string = gameId || '';
  if (!selectedGameId) {
    const now = new Date();
    const { data: upcomingGame } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .gte('date', now.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(1)
      .single();

    if (upcomingGame) {
      selectedGameId = upcomingGame.id;
    } else {
      // No upcoming games
      redirect(`/teams/${teamId}/schedule`);
    }
  }

  // At this point selectedGameId is guaranteed to be a string
  if (!selectedGameId) {
    redirect(`/teams/${teamId}/schedule`);
  }

  // Get game details
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', selectedGameId)
    .eq('team_id', teamId)
    .single();

  if (!game) {
    redirect(`/teams/${teamId}/game-week`);
  }

  // Get or create prep plan
  const prepPlan = await getOrCreatePrepPlan(teamId, selectedGameId);

  // Check if there are any insights in the database
  const { data: existingInsights } = await supabase
    .from('prep_insights')
    .select('id, data_json')
    .eq('prep_plan_id', prepPlan.id);

  const existingInsightsCount = existingInsights?.length || 0;

  // Check if insights are only placeholders (no data_json means they were generated without real data)
  const hasOnlyPlaceholderInsights = existingInsightsCount > 0 &&
    existingInsights?.every(insight => insight.data_json === null);

  // If we only have placeholder insights, check if we now have real play data
  let shouldRegenerateInsights = existingInsightsCount === 0;

  if (hasOnlyPlaceholderInsights) {
    // Check if there are now play_instances with real data
    // Note: play_instances links to games through videos table (video_id -> videos.game_id)
    const { data: allGames } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .limit(5);

    const gameIds = allGames?.map(g => g.id) || [];

    if (gameIds.length > 0) {
      // Get videos for these games
      const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .in('game_id', gameIds);

      const videoIds = videos?.map(v => v.id) || [];

      if (videoIds.length > 0) {
        const { count: playInstancesCount } = await supabase
          .from('play_instances')
          .select('*', { count: 'exact', head: true })
          .in('video_id', videoIds);

        // If we now have play data, regenerate insights
        if ((playInstancesCount || 0) > 0) {
          // Delete placeholder insights
          await supabase
            .from('prep_insights')
            .delete()
            .eq('prep_plan_id', prepPlan.id);

          shouldRegenerateInsights = true;
        }
      }
    }
  }

  // Generate insights if needed
  if (shouldRegenerateInsights) {
    await generateInsightsFromFilm(prepPlan.id, teamId, selectedGameId);
  }

  // Check if tasks need refreshing (should have 9 template tasks)
  const { count: taskCount } = await supabase
    .from('prep_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('prep_plan_id', prepPlan.id)
    .eq('source_type', 'template');

  const expectedTaskCount = 9; // Number of hardcoded tasks
  if ((taskCount || 0) !== expectedTaskCount) {
    await refreshPrepPlanTasks(prepPlan.id, teamId, selectedGameId);
  }

  // Get full prep plan with details
  const prepPlanWithDetails = await getPrepPlanWithDetails(prepPlan.id);

  if (!prepPlanWithDetails) {
    redirect(`/teams/${teamId}/game-week`);
  }

  // Get playbook for play selection prompts
  const { data: playbook } = await supabase
    .from('playbook_plays')
    .select('play_code, play_name')
    .eq('team_id', teamId)
    .eq('is_archived', false)
    .order('play_code', { ascending: true });

  // Calculate days until game
  const gameDate = new Date(game.date);
  const now = new Date();
  const daysUntilGame = Math.ceil((gameDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <GamePrepHubClient
      teamId={teamId}
      teamName={team.name}
      gameId={selectedGameId}
      game={game}
      prepPlan={prepPlanWithDetails}
      playbook={playbook || []}
      daysUntilGame={daysUntilGame}
    />
  );
}
