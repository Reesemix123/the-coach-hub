/**
 * Report Management Page — Coach view of all player reports for a team.
 *
 * Server component: fetches all reports with player and game context, then
 * hands the result to the interactive ReportManagementBoard client component.
 */

import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import TeamNavigation from '@/components/TeamNavigation';
import { ReportManagementBoard, type ReportData, type GameOption, type PlayerOption } from '@/components/players/ReportManagementBoard';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function ReportManagementPage({ params }: PageProps) {
  const { teamId } = await params;

  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const serviceClient = createServiceClient();

  // 2. Team info for TeamNavigation
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, level, colors')
    .eq('id', teamId)
    .single();

  if (!team) {
    redirect('/dashboard');
  }

  // 3. Athlete seasons for this team
  const { data: athleteSeasons } = await serviceClient
    .from('athlete_seasons')
    .select('id, athlete_profile_id, roster_id')
    .eq('team_id', teamId);

  const seasons = athleteSeasons ?? [];
  const seasonIds = seasons.map((s) => s.id);
  const rosterIds = [...new Set(seasons.map((s) => s.roster_id).filter(Boolean))] as string[];

  // 4. Player info for those roster IDs
  const playersMap = new Map<
    string,
    { id: string; first_name: string; last_name: string; jersey_number: string | null; primary_position_category_code: string | null }
  >();

  if (rosterIds.length > 0) {
    const { data: playersData } = await serviceClient
      .from('players')
      .select('id, first_name, last_name, jersey_number, position_categories!primary_position_category_id(code)')
      .in('id', rosterIds);

    for (const p of playersData ?? []) {
      const cat = (p as unknown as { position_categories?: { code: string | null } | null }).position_categories;
      playersMap.set(p.id, {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        jersey_number: p.jersey_number,
        primary_position_category_code: cat?.code ?? null,
      });
    }
  }

  // Map: seasonId → athlete_profile_id and roster_id
  const seasonToAthleteProfile = new Map<string, string>();
  const seasonToRoster = new Map<string, string>();
  for (const s of seasons) {
    if (s.athlete_profile_id) seasonToAthleteProfile.set(s.id, s.athlete_profile_id);
    if (s.roster_id) seasonToRoster.set(s.id, s.roster_id);
  }

  // 5. All player_reports for these seasons
  interface RawReport {
    id: string;
    athlete_profile_id: string;
    athlete_season_id: string;
    game_id: string | null;
    sport: string;
    report_type: string;
    stats_snapshot: Record<string, unknown> | null;
    ai_narrative_coach: string | null;
    ai_narrative_parent: string | null;
    gemini_model_used: string | null;
    is_published_to_parent: boolean;
    published_at: string | null;
    coach_edited: boolean;
    created_at: string;
    updated_at: string;
  }

  let rawReports: RawReport[] = [];

  if (seasonIds.length > 0) {
    const { data: reportsData } = await serviceClient
      .from('player_reports')
      .select(
        'id, athlete_profile_id, athlete_season_id, game_id, sport, report_type, ' +
          'stats_snapshot, ai_narrative_coach, ai_narrative_parent, gemini_model_used, ' +
          'is_published_to_parent, published_at, coach_edited, created_at, updated_at',
      )
      .in('athlete_season_id', seasonIds)
      .order('created_at', { ascending: false });

    rawReports = (reportsData ?? []) as unknown as RawReport[];
  }

  // 6. Game context for all reports
  const gameIds = [...new Set(rawReports.map((r) => r.game_id).filter(Boolean))] as string[];
  const gameMap = new Map<string, { id: string; opponent: string | null; date: string | null }>();

  if (gameIds.length > 0) {
    const { data: games } = await serviceClient
      .from('games')
      .select('id, opponent, date')
      .in('id', gameIds);

    for (const g of games ?? []) {
      gameMap.set(g.id, g);
    }
  }

  // 7. Build ReportData array
  const reports: ReportData[] = rawReports.map((r) => {
    const rosterId = seasonToRoster.get(r.athlete_season_id);
    const player = rosterId ? playersMap.get(rosterId) : undefined;
    const game = r.game_id ? gameMap.get(r.game_id) : undefined;

    return {
      id: r.id,
      athleteProfileId: r.athlete_profile_id,
      seasonId: r.athlete_season_id,
      gameId: r.game_id,
      opponent: game?.opponent ?? 'Unknown',
      gameDate: game?.date ?? null,
      reportType: r.report_type,
      statsSnapshot: r.stats_snapshot,
      aiNarrativeCoach: r.ai_narrative_coach,
      aiNarrativeParent: r.ai_narrative_parent,
      isPublished: r.is_published_to_parent,
      publishedAt: r.published_at,
      coachEdited: r.coach_edited,
      createdAt: r.created_at,
      playerFirstName: player?.first_name ?? 'Unknown',
      playerLastName: player?.last_name ?? 'Player',
      jerseyNumber: player?.jersey_number ?? null,
      position: player?.primary_position_category_code ?? null,
    };
  });

  // 8. Build game filter options (deduplicated, ordered by date desc)
  const seenGameIds = new Set<string>();
  const gameOptions: GameOption[] = [];
  for (const r of reports) {
    if (r.gameId && !seenGameIds.has(r.gameId)) {
      seenGameIds.add(r.gameId);
      gameOptions.push({ id: r.gameId, opponent: r.opponent, date: r.gameDate });
    }
  }

  // 9. Build player filter options keyed by athlete_profile_id
  // (reports carry athleteProfileId, so that's what the filter compares against)
  const seenAthleteIds = new Set<string>();
  const playerOptions: PlayerOption[] = [];
  for (const r of reports) {
    if (!seenAthleteIds.has(r.athleteProfileId)) {
      seenAthleteIds.add(r.athleteProfileId);
      playerOptions.push({
        id: r.athleteProfileId,
        name: `${r.playerFirstName} ${r.playerLastName}`,
        jerseyNumber: r.jerseyNumber,
      });
    }
  }

  // Sort player options by jersey number
  playerOptions.sort((a, b) => {
    const numA = parseInt(a.jerseyNumber ?? '9999', 10);
    const numB = parseInt(b.jerseyNumber ?? '9999', 10);
    return numA - numB;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamNavigation team={team} teamId={teamId} currentPage="players" />
      <ReportManagementBoard reports={reports} games={gameOptions} players={playerOptions} />
    </div>
  );
}
