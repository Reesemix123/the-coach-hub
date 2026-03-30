import { createClient } from '@/utils/supabase/server';
import { PlayersSubNav } from '@/components/players/PlayersSubNav';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function PlayersLayout({ children, params }: LayoutProps) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Fetch pending clip count (not approved, not suppressed) for this team
  const { count: pendingClipCount } = await supabase
    .from('player_clips')
    .select('id', { count: 'exact', head: true })
    .eq('coach_approved', false)
    .eq('coach_suppressed', false)
    .in(
      'athlete_season_id',
      // Subquery: all athlete_seasons for this team
      (await supabase
        .from('athlete_seasons')
        .select('id')
        .eq('team_id', teamId)
      ).data?.map((s) => s.id) ?? []
    );

  // Fetch unpublished report count for this team
  const { count: unpublishedReportCount } = await supabase
    .from('player_reports')
    .select('id', { count: 'exact', head: true })
    .eq('is_published_to_parent', false)
    .in(
      'athlete_season_id',
      (await supabase
        .from('athlete_seasons')
        .select('id')
        .eq('team_id', teamId)
      ).data?.map((s) => s.id) ?? []
    );

  return (
    <div>
      <PlayersSubNav
        teamId={teamId}
        pendingClipCount={pendingClipCount ?? 0}
        unpublishedReportCount={unpublishedReportCount ?? 0}
      />
      {children}
    </div>
  );
}
