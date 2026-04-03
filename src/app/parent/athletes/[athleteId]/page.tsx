export const dynamic = 'force-dynamic';

import { createClient, createServiceClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, GraduationCap, Lock } from 'lucide-react';
import { ReportCard } from '@/components/parent/ReportCard';
import { SeasonSelector } from '@/components/parent/SeasonSelector';
import { ClipsSection } from '@/components/parent/ClipsSection';

// =============================================================================
// Types
// =============================================================================

interface PageProps {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ season?: string }>;
}

interface SeasonRow {
  id: string;
  team_id: string;
  roster_id: string;
  sport: string;
  season_year: number;
  position: string | null;
  jersey_number: string | null;
}

interface ReportRow {
  id: string;
  game_id: string | null;
  report_type: string;
  stats_snapshot: Record<string, unknown> | null;
  ai_narrative_parent: string | null;
  is_published_to_parent: boolean;
  created_at: string;
}

// =============================================================================
// Helpers
// =============================================================================

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Aggregate stats_snapshot objects across reports to produce season totals. */
function aggregateSeasonStats(reports: ReportRow[]): {
  gamesPlayed: number;
  avgPositionGrade: number | null;
  unit: string | null;
  highlights: { label: string; value: string }[];
} {
  const snapshots = reports
    .map((r) => r.stats_snapshot)
    .filter((s): s is Record<string, unknown> => s != null);

  if (snapshots.length === 0) {
    return { gamesPlayed: 0, avgPositionGrade: null, unit: null, highlights: [] };
  }

  const gamesPlayed = snapshots.length;
  const grades = snapshots
    .map((s) => s.position_grade as number | undefined)
    .filter((g): g is number => g != null);
  const avgPositionGrade =
    grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;

  const unit = (snapshots[0]?.unit as string) ?? null;
  const highlights: { label: string; value: string }[] = [];

  if (unit === 'offense') {
    const tds = snapshots.reduce((sum, s) => {
      const bc = s.as_ball_carrier as { touchdowns?: number } | undefined;
      const rec = s.as_receiver as { touchdowns?: number } | undefined;
      const pass = s.as_passer as { touchdowns?: number } | undefined;
      return sum + (bc?.touchdowns ?? 0) + (rec?.touchdowns ?? 0) + (pass?.touchdowns ?? 0);
    }, 0);
    const snaps = snapshots.reduce((sum, s) => sum + ((s.snaps_played as number) ?? 0), 0);
    highlights.push({ label: 'Touchdowns', value: String(tds) });
    highlights.push({ label: 'Total Snaps', value: String(snaps) });
  } else if (unit === 'offense_oline') {
    const totalHeld = snapshots.reduce((sum, s) => {
      const br = s.block_results as { held?: number; beaten?: number } | undefined;
      return sum + (br?.held ?? 0);
    }, 0);
    const totalSnaps = snapshots.reduce((sum, s) => {
      const br = s.block_results as { held?: number; pushed_back?: number; beaten?: number; penalty?: number } | undefined;
      return sum + (br?.held ?? 0) + (br?.pushed_back ?? 0) + (br?.beaten ?? 0) + (br?.penalty ?? 0);
    }, 0);
    const blockPct = totalSnaps > 0 ? ((totalHeld / totalSnaps) * 100).toFixed(0) : '0';
    const pressures = snapshots.reduce((sum, s) => sum + ((s.pressures_allowed as number) ?? 0), 0);
    highlights.push({ label: 'Block Grade', value: `${blockPct}%` });
    highlights.push({ label: 'Pressures Allowed', value: String(pressures) });
  } else if (unit === 'defense') {
    const tackles = snapshots.reduce((sum, s) => {
      const t = s.tackles as { primary?: number; assist?: number } | undefined;
      return sum + (t?.primary ?? 0) + (t?.assist ?? 0);
    }, 0);
    const turnovers = snapshots.reduce((sum, s) => sum + ((s.turnovers_created as number) ?? 0), 0);
    highlights.push({ label: 'Tackles', value: String(tackles) });
    highlights.push({ label: 'Turnovers', value: String(turnovers) });
  } else if (unit === 'special_teams') {
    const kicker = snapshots.find((s) => s.as_kicker != null);
    const returner = snapshots.find((s) => s.as_returner != null);
    if (kicker) {
      const k = kicker.as_kicker as { made?: number; attempts?: number };
      highlights.push({ label: 'FG', value: `${k.made ?? 0}/${k.attempts ?? 0}` });
    }
    if (returner) {
      const r = returner.as_returner as { average?: number };
      highlights.push({ label: 'Return Avg', value: `${(r.average ?? 0).toFixed(1)} yds` });
    }
  }

  return { gamesPlayed, avgPositionGrade, unit, highlights };
}

// =============================================================================
// Page
// =============================================================================

export default async function AthleteProfilePage({ params, searchParams }: PageProps) {
  const { athleteId } = await params;
  const { season: seasonParam } = await searchParams;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // 1. Auth (layout handles redirect, but we need parentProfile.id)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: parentProfile } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!parentProfile) redirect('/parent');

  // 2. Fetch athlete profile
  const { data: athlete } = await serviceClient
    .from('athlete_profiles')
    .select('id, athlete_first_name, athlete_last_name, graduation_year, profile_photo_url')
    .eq('id', athleteId)
    .single();

  if (!athlete) redirect('/parent');

  // 3. Fetch all seasons with team names
  const { data: rawSeasons } = await serviceClient
    .from('athlete_seasons')
    .select('id, team_id, roster_id, sport, season_year, position, jersey_number, teams(name)')
    .eq('athlete_profile_id', athleteId)
    .order('season_year', { ascending: false });

  const seasons = (rawSeasons ?? []).map((s) => ({
    ...(s as unknown as SeasonRow),
    teamName: (s.teams as unknown as { name: string })?.name ?? 'Unknown Team',
  }));

  if (seasons.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-[#6b7280]">No seasons found for this athlete.</p>
      </div>
    );
  }

  // 4. Resolve selected season from URL param
  const selectedSeason =
    (seasonParam
      ? seasons.find((s) => String(s.season_year) === seasonParam)
      : null) ?? seasons[0];

  // 5. Fetch player info from roster
  const { data: player } = await serviceClient
    .from('players')
    .select('first_name, last_name, jersey_number, primary_position, position_group')
    .eq('id', selectedSeason.roster_id)
    .single();

  // 6. Check content access
  const { data: hasAccess } = await serviceClient.rpc(
    'parent_can_access_athlete_content',
    { p_athlete_profile_id: athleteId, p_parent_id: parentProfile.id }
  );

  // 7. Check subscription status
  const { data: subscription } = await serviceClient
    .from('parent_profile_subscriptions')
    .select('id, status, current_period_end, lapsed_at, data_archive_scheduled_at')
    .eq('parent_id', parentProfile.id)
    .eq('athlete_profile_id', athleteId)
    .in('status', ['active', 'past_due', 'lapsed'])
    .maybeSingle();

  const hasActiveSubscription = subscription?.status === 'active';

  // 8. Check Comm Hub plan for this team
  const { data: commPlan } = await serviceClient
    .from('team_communication_plans')
    .select('id, status, expires_at')
    .eq('team_id', selectedSeason.team_id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  const commPlanActive = !!commPlan;
  const commPlanExpiresSoon =
    commPlan?.expires_at
      ? (new Date(commPlan.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 60
      : false;

  // 9. Fetch published reports for this season
  const { data: rawReports } = await serviceClient
    .from('player_reports')
    .select('id, game_id, report_type, stats_snapshot, ai_narrative_parent, is_published_to_parent, created_at')
    .eq('athlete_profile_id', athleteId)
    .eq('athlete_season_id', selectedSeason.id)
    .eq('is_published_to_parent', true)
    .order('created_at', { ascending: false });

  const reports = (rawReports ?? []) as unknown as ReportRow[];

  // 10. Fetch game context for reports
  const reportGameIds = [...new Set(reports.map((r) => r.game_id).filter(Boolean))] as string[];
  const gameMap = new Map<string, { opponent: string; date: string | null }>();
  if (reportGameIds.length > 0) {
    const { data: games } = await serviceClient
      .from('games')
      .select('id, opponent, date')
      .in('id', reportGameIds);
    for (const g of games ?? []) {
      gameMap.set(g.id, { opponent: g.opponent ?? 'Unknown', date: g.date });
    }
  }

  // 11. Aggregate season stats
  const seasonStats = aggregateSeasonStats(reports);

  // 12. Count clips + reports for upsell
  const { count: clipCount } = await serviceClient
    .from('player_clips')
    .select('id', { count: 'exact', head: true })
    .eq('athlete_profile_id', athleteId)
    .eq('coach_approved', true)
    .eq('coach_suppressed', false);

  // 13. Compute upsell visibility
  const showUpsell =
    !hasActiveSubscription && (!commPlanActive || commPlanExpiresSoon);

  const daysUntilArchive =
    subscription?.data_archive_scheduled_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.data_archive_scheduled_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  // =========================================================================
  // Render
  // =========================================================================

  const displayName = `${athlete.athlete_first_name} ${athlete.athlete_last_name}`;
  const jerseyNumber = player?.jersey_number ?? selectedSeason.jersey_number;
  const position = player?.primary_position ?? selectedSeason.position;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/parent"
          className="inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#1a1a1a] mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        {/* ============================================================= */}
        {/* PROFILE HEADER                                                */}
        {/* ============================================================= */}
        <div className="flex items-start gap-4 mb-8">
          {/* Photo or initials */}
          {athlete.profile_photo_url ? (
            <img
              src={athlete.profile_photo_url}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#B8CA6E] flex items-center justify-center text-[#1a1410] text-xl font-bold flex-shrink-0">
              {initials(athlete.athlete_first_name, athlete.athlete_last_name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-[#1a1a1a]">{displayName}</h1>
            <p className="text-sm text-[#6b7280] mt-0.5">
              {selectedSeason.teamName}
              {position ? ` · ${position}` : ''}
              {jerseyNumber ? ` · #${jerseyNumber}` : ''}
            </p>

            <div className="flex items-center gap-2 mt-2">
              {athlete.graduation_year && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B8CA6E] text-[#1a1410]">
                  <GraduationCap className="w-3 h-3" />
                  Class of {athlete.graduation_year}
                </span>
              )}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  hasActiveSubscription
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-[#6b7280]'
                }`}
              >
                {hasActiveSubscription ? 'Profile active' : 'Free access'}
              </span>
            </div>

            {/* Season selector */}
            {seasons.length > 1 && (
              <div className="mt-3">
                <SeasonSelector
                  seasons={seasons.map((s) => ({
                    id: s.id,
                    seasonYear: s.season_year,
                    sport: s.sport,
                    teamName: s.teamName,
                  }))}
                  selectedSeasonId={selectedSeason.id}
                />
              </div>
            )}
          </div>
        </div>

        {/* ============================================================= */}
        {/* SEASON STATS STRIP                                            */}
        {/* ============================================================= */}
        {seasonStats.gamesPlayed > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-[#f9fafb] rounded-lg p-3">
              <p className="text-xs text-[#6b7280]">Games</p>
              <p className="text-lg font-bold text-[#1a1a1a]">{seasonStats.gamesPlayed}</p>
            </div>
            {seasonStats.avgPositionGrade != null && (
              <div className="bg-[#f9fafb] rounded-lg p-3">
                <p className="text-xs text-[#6b7280]">Avg Grade</p>
                <p className="text-lg font-bold text-[#1a1a1a]">
                  {seasonStats.avgPositionGrade.toFixed(1)}
                </p>
              </div>
            )}
            {seasonStats.highlights.map((h) => (
              <div key={h.label} className="bg-[#f9fafb] rounded-lg p-3">
                <p className="text-xs text-[#6b7280]">{h.label}</p>
                <p className="text-lg font-bold text-[#1a1a1a]">{h.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================= */}
        {/* REPORTS SECTION                                               */}
        {/* ============================================================= */}
        {reports.length > 0 && (
          <section className="mb-8">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
              Game Reports
            </p>
            <div className="space-y-3">
              {reports.map((report) => {
                const game = report.game_id ? gameMap.get(report.game_id) : null;
                const grade = (report.stats_snapshot?.position_grade as number) ?? null;

                return (
                  <ReportCard
                    key={report.id}
                    opponent={game?.opponent ?? 'Unknown'}
                    gameDate={game?.date ?? null}
                    positionGrade={grade}
                    parentNarrative={report.ai_narrative_parent}
                    locked={!hasAccess}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ============================================================= */}
        {/* CLIPS SECTION                                                 */}
        {/* ============================================================= */}
        <section className="mb-8">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
            Highlights
          </p>
          <ClipsSection athleteId={athleteId} seasonId={selectedSeason.id} />
        </section>

        {/* ============================================================= */}
        {/* SUBSCRIPTION UPSELL                                           */}
        {/* ============================================================= */}
        {showUpsell && (
          <section className="mb-8">
            <div className="border border-[#e5e7eb] border-l-4 border-l-[#B8CA6E] rounded-xl p-5">
              <h3 className="text-base font-bold text-[#1a1a1a] mb-1">
                Keep {athlete.athlete_first_name}&apos;s highlights forever
              </h3>
              <p className="text-sm text-[#6b7280] mb-3">
                {clipCount ?? 0} clips and {reports.length} reports saved so far this season
              </p>

              {daysUntilArchive != null && (
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-amber-50 rounded-lg">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    Your highlights will be archived in {daysUntilArchive} days
                  </p>
                </div>
              )}

              <Link
                href={`/api/parent-subscriptions/create-checkout?athleteId=${athleteId}`}
                className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 transition-all"
              >
                Subscribe — $19.99/year
              </Link>
              <p className="text-xs text-[#6b7280] mt-2">
                Annual auto-renewal. Cancel anytime.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
