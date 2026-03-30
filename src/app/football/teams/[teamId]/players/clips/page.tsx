/**
 * Clip Review Page — Coach view of all player clips for a team.
 *
 * Server component: fetches all data, generates signed Mux URLs, then hands
 * the grouped result to the interactive ClipReviewBoard client component.
 */

import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { getSignedPlaybackUrl } from '@/lib/services/communication/video.service';
import { ClipReviewBoard } from '@/components/players/ClipReviewBoard';
import TeamNavigation from '@/components/TeamNavigation';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function ClipReviewPage({ params }: PageProps) {
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
    .select('id, athlete_profile_id, roster_id, team_id')
    .eq('team_id', teamId);

  const seasons = athleteSeasons ?? [];
  const seasonIds = seasons.map((s) => s.id);
  const rosterIds = [...new Set(seasons.map((s) => s.roster_id).filter(Boolean))] as string[];

  // 4. Player info for those roster IDs
  const playersMap = new Map<
    string,
    { id: string; first_name: string; last_name: string; jersey_number: string | null; primary_position: string | null }
  >();

  if (rosterIds.length > 0) {
    const { data: playersData } = await serviceClient
      .from('players')
      .select('id, first_name, last_name, jersey_number, primary_position')
      .in('id', rosterIds);

    for (const p of playersData ?? []) {
      playersMap.set(p.id, p);
    }
  }

  // Raw clip shape returned from the DB query
  interface RawClip {
    id: string;
    athlete_profile_id: string;
    athlete_season_id: string;
    game_id: string;
    play_instance_id: string | null;
    play_type: string | null;
    play_result: string | null;
    coach_note: string | null;
    coach_approved: boolean;
    coach_suppressed: boolean;
    is_featured: boolean;
    mux_playback_id: string | null;
    mux_clip_status: string | null;
    created_at: string;
  }

  // 5. Player clips for all seasons
  let rawClips: RawClip[] = [];

  if (seasonIds.length > 0) {
    const { data: clipsData } = await serviceClient
      .from('player_clips')
      .select(
        'id, athlete_profile_id, athlete_season_id, game_id, play_instance_id, ' +
          'play_type, play_result, coach_note, coach_approved, coach_suppressed, ' +
          'is_featured, mux_playback_id, mux_clip_status, created_at',
      )
      .in('athlete_season_id', seasonIds)
      .order('created_at', { ascending: false });

    rawClips = (clipsData ?? []) as unknown as RawClip[];
  }

  // 6. Play instance context (down, distance, quarter, yard_line)
  const playIds = [...new Set(rawClips.map((c) => c.play_instance_id).filter(Boolean))] as string[];
  const playMap = new Map<
    string,
    { id: string; down: number | null; distance: number | null; quarter: number | null }
  >();

  if (playIds.length > 0) {
    const { data: plays } = await serviceClient
      .from('play_instances')
      .select('id, down, distance, quarter, yard_line')
      .in('id', playIds);

    for (const play of plays ?? []) {
      playMap.set(play.id, play);
    }
  }

  // 7. Game context for opponent names
  const gameIds = [...new Set(rawClips.map((c) => c.game_id).filter(Boolean))] as string[];
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

  // 8. Generate signed playback URLs in parallel
  const clipsWithUrls = await Promise.all(
    rawClips.map(async (clip) => {
      let playbackUrl: string | null = null;

      if (clip.mux_clip_status === 'ready' && clip.mux_playback_id) {
        try {
          playbackUrl = await getSignedPlaybackUrl(clip.mux_playback_id, 24);
        } catch {
          // Non-fatal: signed URL generation may fail if env vars are missing in local dev
          playbackUrl = null;
        }
      }

      const game = gameMap.get(clip.game_id);
      const play = clip.play_instance_id ? playMap.get(clip.play_instance_id) : undefined;

      return {
        id: clip.id,
        athleteProfileId: clip.athlete_profile_id,
        seasonId: clip.athlete_season_id,
        gameId: clip.game_id,
        opponent: game?.opponent ?? 'Unknown',
        gameDate: game?.date ?? null,
        playResult: clip.play_result ?? null,
        playType: clip.play_type ?? null,
        coachNote: clip.coach_note ?? null,
        coachApproved: clip.coach_approved ?? false,
        coachSuppressed: clip.coach_suppressed ?? false,
        isFeatured: clip.is_featured ?? false,
        playbackUrl,
        clipStatus: clip.mux_clip_status ?? null,
        down: play?.down ?? null,
        distance: play?.distance ?? null,
        quarter: play?.quarter ?? null,
        createdAt: clip.created_at,
      };
    }),
  );

  // 9. Build player-grouped structure
  // Map: seasonId → rosterId
  const seasonToRoster = new Map<string, string>();
  for (const s of seasons) {
    if (s.roster_id) seasonToRoster.set(s.id, s.roster_id);
  }

  // Map: rosterId → ClipData[]
  const rosterClipsMap = new Map<string, (typeof clipsWithUrls)[number][]>();

  for (const clip of clipsWithUrls) {
    const rosterId = seasonToRoster.get(clip.seasonId);
    if (!rosterId) continue;

    const existing = rosterClipsMap.get(rosterId) ?? [];
    existing.push(clip);
    rosterClipsMap.set(rosterId, existing);
  }

  const playerGroups = Array.from(rosterClipsMap.entries())
    .map(([rosterId, clips]) => {
      const player = playersMap.get(rosterId);
      return {
        playerId: rosterId,
        firstName: player?.first_name ?? 'Unknown',
        lastName: player?.last_name ?? 'Player',
        jerseyNumber: player?.jersey_number ?? null,
        position: player?.primary_position ?? null,
        clips,
      };
    })
    .sort((a, b) => {
      const numA = parseInt(a.jerseyNumber ?? '9999', 10);
      const numB = parseInt(b.jerseyNumber ?? '9999', 10);
      return numA - numB;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamNavigation team={team} teamId={teamId} currentPage="players" />
      <ClipReviewBoard teamId={teamId} playerGroups={playerGroups} />
    </div>
  );
}
