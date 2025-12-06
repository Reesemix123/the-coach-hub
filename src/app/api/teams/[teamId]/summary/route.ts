// /api/teams/:teamId/summary - Get content summary for canceled subscription page
// Shows users what they've built to encourage resubscription

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Verify user has access to this team (owner or member)
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check if user owns the team or is a member
  let hasAccess = team.user_id === user.id;

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    hasAccess = !!membership;
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'You do not have access to this team' },
      { status: 403 }
    );
  }

  // Get subscription info
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end, data_access_expires_at')
    .eq('team_id', teamId)
    .single();

  // Calculate days until data unavailable
  let daysUntilDataUnavailable: number | null = null;
  let canResubscribe = false;
  let subscriptionEndedAt: string | null = null;

  if (subscription) {
    const dataAccessExpires = subscription.data_access_expires_at
      ? new Date(subscription.data_access_expires_at)
      : subscription.current_period_end
        ? new Date(new Date(subscription.current_period_end).getTime() + 30 * 24 * 60 * 60 * 1000)
        : null;

    if (dataAccessExpires) {
      const now = new Date();
      daysUntilDataUnavailable = Math.max(0, Math.ceil((dataAccessExpires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      canResubscribe = daysUntilDataUnavailable > 0;
    }

    if (subscription.current_period_end) {
      subscriptionEndedAt = subscription.current_period_end;
    }
  }

  // Count plays created in playbook
  const { count: playsCreated } = await supabase
    .from('playbook_plays')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  // Count games recorded
  const { count: gamesRecorded } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  // Count plays tagged in film
  const { count: playsTagged } = await supabase
    .from('play_instances')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  // Count videos uploaded
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId);

  let videosUploaded = 0;
  let totalFilmMinutes = 0;

  if (games && games.length > 0) {
    const gameIds = games.map(g => g.id);

    const { data: videos, count: videoCount } = await supabase
      .from('videos')
      .select('id, duration', { count: 'exact' })
      .in('game_id', gameIds);

    videosUploaded = videoCount || 0;

    // Sum up video durations if available (duration in seconds)
    if (videos) {
      totalFilmMinutes = Math.round(
        videos.reduce((sum, v) => sum + (v.duration || 0), 0) / 60
      );
    }
  }

  // Count practice plans (if table exists)
  let practicePlans = 0;
  try {
    const { count } = await supabase
      .from('practice_plans')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);
    practicePlans = count || 0;
  } catch {
    // Table might not exist
  }

  // Count players on roster
  const { count: playersOnRoster } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  // Count drives analyzed
  let drivesAnalyzed = 0;
  try {
    const { count } = await supabase
      .from('drives')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);
    drivesAnalyzed = count || 0;
  } catch {
    // Table might not exist
  }

  return NextResponse.json({
    team_name: team.name,
    subscription_ended_at: subscriptionEndedAt,
    days_until_data_unavailable: daysUntilDataUnavailable,
    can_resubscribe: canResubscribe,
    content_summary: {
      plays_created: playsCreated || 0,
      games_recorded: gamesRecorded || 0,
      plays_tagged: playsTagged || 0,
      videos_uploaded: videosUploaded,
      total_film_minutes: totalFilmMinutes,
      practice_plans: practicePlans,
      players_on_roster: playersOnRoster || 0,
      drives_analyzed: drivesAnalyzed
    }
  });
}
