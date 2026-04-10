/**
 * Film Analytics Integration Test Seed Data
 *
 * Creates a fully isolated test dataset for verifying analytics calculations.
 * All records share a single teamId so cleanup is a single team delete (cascade
 * handles everything downstream).
 *
 * SEED DATA DESIGN
 * ================
 *
 * Team: "TEST TEAM — DELETE AFTER TESTING [<run-id>]"
 *
 * Players (6):
 *   #1  QB  — passer
 *   #22 RB  — rusher
 *   #88 WR  — receiver
 *   #55 LB  — tackler
 *   #99 DE  — pass rusher
 *   #25 CB  — coverage
 *
 * Game: vs "Test Opponent", film_analysis_status = 'complete'
 * Video: linked to game
 *
 * Drives (3):
 *   Drive 1 — result: touchdown  (plays 1–4,  4 plays,  65 yards)
 *   Drive 2 — result: punt       (plays 5–7,  3 plays,   8 yards, three-and-out)
 *   Drive 3 — result: field_goal (plays 8–10, 3 plays,  35 yards)
 *
 * OFFENSIVE PLAYS (10, is_opponent_play = false)
 * -----------------------------------------------
 * Play  1: 1st & 10, pass_complete,           yl=65, +15 yd, first_down   → SUCCESS (15 ≥ 4.0)
 * Play  2: 1st & 10, rush,                    yl=50, + 8 yd              → SUCCESS ( 8 ≥ 4.0)
 * Play  3: 2nd &  2, pass_complete_touchdown,  yl=25, +25 yd, first_down  → SUCCESS (25 ≥ 1.2)
 * Play  4: 1st & 10, pass_complete,           yl=50, +17 yd, first_down   → SUCCESS (17 ≥ 4.0)
 * Play  5: 1st & 10, rush,                    yl=75, + 2 yd              → FAILURE ( 2 < 4.0)
 * Play  6: 2nd &  8, pass_incomplete,         yl=73, + 0 yd              → FAILURE ( 0 < 4.8)
 * Play  7: 3rd &  8, pass_incomplete,         yl=73, + 0 yd              → FAILURE ( 0 < 8.0)
 * Play  8: 1st & 10, rush,                    yl=45, +20 yd, first_down   → SUCCESS (20 ≥ 4.0)
 * Play  9: 1st & 10, pass_complete,           yl=18, +12 yd, first_down   → SUCCESS (12 ≥ 4.0) RED ZONE
 * Play 10: 2nd &  3, rush,                    yl=15, + 3 yd              → SUCCESS ( 3 ≥ 1.8) RED ZONE
 *
 * EXPECTED OFFENSIVE METRICS
 * ---------------------------
 * Total plays    : 10
 * Total yards    : 102  (15+8+25+17+2+0+0+20+12+3)
 * Avg yards/play : 10.2
 * Successful     : 7   (plays 1,2,3,4,8,9,10)
 * Success rate   : 70%
 * First downs    : 5   (plays 1,3,4,8,9 have resulted_in_first_down=true)
 * Turnovers      : 0
 * Red zone plays : 2   (plays 9,10 where yard_line ≤ 20)
 * Red zone TDs   : 0   (the TD was at yl=25, outside red zone)
 * Touchdowns     : 1   (play 3)
 *
 * Pass plays  : 6  (1,3,4,6,7,9)
 * Run plays   : 4  (2,5,8,10)
 * Completed   : 4  (1,3,4,9) — result starts with 'pass_complete'
 * Pass yards  : 69 (15+25+17+12)
 * Rush yards  : 33 (8+2+20+3)
 *
 * Down breakdown (offensive plays):
 *   1st down plays : 6  (1,2,4,5,8,9)   → success: 5 (1,2,4,8,9)
 *   2nd down plays : 3  (3,6,10)         → success: 2 (3,10)
 *   3rd down plays : 1  (7)              → success: 0
 *
 * PLAYER PARTICIPATION
 * --------------------
 * Plays 1–7:  player_participation rows AND legacy FK columns (qb_id / ball_carrier_id / target_id).
 *             Tests that no double-counting occurs when both models coexist.
 * Plays 8–10: player_participation rows ONLY (no legacy FK columns on those play rows).
 *
 * QB participation (passer): plays 1,3,4,6,7,9  → 6 rows, 6 unique play IDs
 * RB participation (rusher): plays 2,5,8,10      → 4 rows
 * WR participation (receiver):
 *   play 1  result='success', play 3 result='success', play 4 result='success'
 *   play 6  result='failure', play 9 result='success'
 *   → 5 rows total, 4 catches, 1 drop
 *
 * DEFENSIVE PLAYS (5, is_opponent_play = true)
 * --------------------------------------------
 * Play 11: opponent pass +5 yd  — LB primary_tackle
 * Play 12: opponent pass −2 yd  — DE pressure/sack
 * Play 13: opponent pass  0 yd  — CB interception + turnover
 * Play 14: opponent run  +3 yd  — LB assist_tackle
 * Play 15: opponent pass +8 yd  — CB pass_breakup
 *
 * EXPECTED DEFENSIVE STATS
 * ------------------------
 * LB : 1 primary_tackle, 1 assist_tackle
 * DE : 1 sack (participation_type='pressure', result='sack')
 * CB : 1 interception, 1 pass_breakup
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[seed] Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SeedPlayerIds {
  qb: string;
  rb: string;
  wr: string;
  lb: string;
  de: string;
  cb: string;
}

export interface SeedResult {
  /** Short UUID used to namespace / identify this seed run in logs. */
  testSeedRunId: string;
  teamId: string;
  gameId: string;
  videoId: string;
  playerIds: SeedPlayerIds;
  /** Array of 3 drive IDs in drive-number order. */
  driveIds: string[];
  /** 10 play instance IDs (offensive), index 0–9. */
  offensivePlayIds: string[];
  /** 5 play instance IDs (defensive/opponent), index 0–4. */
  defensivePlayIds: string[];
  /** player_participation row IDs created during seeding. */
  participationIds: string[];
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/**
 * Seeds an isolated film analytics test dataset.
 * Uses the Supabase service role client to bypass RLS.
 *
 * @returns Metadata about all created records for use in tests.
 */
export async function seedFilmAnalyticsData(): Promise<SeedResult> {
  const client = getServiceClient();
  const testSeedRunId = crypto.randomUUID();
  const teamName = `TEST TEAM — DELETE AFTER TESTING [${testSeedRunId.slice(0, 8)}]`;

  console.log(`[seed] Starting seed run: ${testSeedRunId}`);

  // ------------------------------------------------------------------
  // Resolve an existing user_id to satisfy teams.user_id FK constraint
  // ------------------------------------------------------------------
  const { data: adminProfile, error: adminErr } = await client
    .from('profiles')
    .select('id')
    .eq('is_platform_admin', true)
    .limit(1)
    .single();

  if (adminErr || !adminProfile) {
    throw new Error(
      '[seed] No platform admin profile found. Cannot create test team without a valid user_id. ' +
      `Details: ${adminErr?.message ?? 'null result'}`
    );
  }
  const userId = adminProfile.id as string;

  // ------------------------------------------------------------------
  // Pre-generate all IDs upfront so they can be used in FK columns
  // ------------------------------------------------------------------
  const teamId = crypto.randomUUID();
  const gameId = crypto.randomUUID();
  const videoId = crypto.randomUUID();
  const driveIds = [
    crypto.randomUUID(), // Drive 1 — touchdown
    crypto.randomUUID(), // Drive 2 — punt
    crypto.randomUUID(), // Drive 3 — field goal
  ];
  const playerIds: SeedPlayerIds = {
    qb: crypto.randomUUID(),
    rb: crypto.randomUUID(),
    wr: crypto.randomUUID(),
    lb: crypto.randomUUID(),
    de: crypto.randomUUID(),
    cb: crypto.randomUUID(),
  };

  // 10 offensive + 5 defensive = 15 plays
  const allPlayIds = Array.from({ length: 15 }, () => crypto.randomUUID());
  const offensivePlayIds = allPlayIds.slice(0, 10);
  const defensivePlayIds = allPlayIds.slice(10, 15);

  // ------------------------------------------------------------------
  // 1. Team
  // ------------------------------------------------------------------
  console.log('[seed] Creating team...');
  const { error: teamErr } = await client.from('teams').insert({
    id: teamId,
    name: teamName,
    sport: 'football',
    level: 'Varsity',
    colors: { primary: '#000000', secondary: '#FFFFFF' },
    user_id: userId,
  });
  if (teamErr) throw new Error(`[seed] Team insert failed: ${teamErr.message}`);

  // ------------------------------------------------------------------
  // 2. Game (film_analysis_status = 'complete' is required by analytics queries)
  // ------------------------------------------------------------------
  console.log('[seed] Creating game...');
  const { error: gameErr } = await client.from('games').insert({
    id: gameId,
    team_id: teamId,
    user_id: userId,
    name: 'Test Game',
    opponent: 'Test Opponent',
    date: '2026-04-01',
    game_type: 'team',
    film_analysis_status: 'complete',
    film_analysis_completed_at: new Date().toISOString(),
  });
  if (gameErr) throw new Error(`[seed] Game insert failed: ${gameErr.message}`);

  // ------------------------------------------------------------------
  // 3. Video  (no file_path / team_id — not present in the videos schema)
  // ------------------------------------------------------------------
  console.log('[seed] Creating video...');
  const { error: videoErr } = await client.from('videos').insert({
    id: videoId,
    game_id: gameId,
    name: `test-video-${testSeedRunId.slice(0, 8)}`,
    camera_label: 'Sideline',
    camera_order: 1,
    upload_status: 'ready',
    duration_seconds: 3600,
  });
  if (videoErr) throw new Error(`[seed] Video insert failed: ${videoErr.message}`);

  // ------------------------------------------------------------------
  // 4. Drives
  // ------------------------------------------------------------------
  console.log('[seed] Creating drives...');
  const { error: driveErr } = await client.from('drives').insert([
    {
      id: driveIds[0],
      game_id: gameId,
      team_id: teamId,
      drive_number: 1,
      result: 'touchdown',
      plays_count: 4,
      yards_gained: 65,
      points: 7,
      scoring_drive: true,
      reached_red_zone: false,
    },
    {
      id: driveIds[1],
      game_id: gameId,
      team_id: teamId,
      drive_number: 2,
      result: 'punt',
      plays_count: 3,
      yards_gained: 8,
      points: 0,
      three_and_out: true,
      scoring_drive: false,
      reached_red_zone: false,
    },
    {
      id: driveIds[2],
      game_id: gameId,
      team_id: teamId,
      drive_number: 3,
      result: 'field_goal',
      plays_count: 3,
      yards_gained: 35,
      points: 3,
      scoring_drive: true,
      reached_red_zone: true,
    },
  ]);
  if (driveErr) throw new Error(`[seed] Drives insert failed: ${driveErr.message}`);

  // ------------------------------------------------------------------
  // 5. Players
  // ------------------------------------------------------------------
  console.log('[seed] Creating players...');
  const { error: playerErr } = await client.from('players').insert([
    {
      id: playerIds.qb,
      team_id: teamId,
      jersey_number: '1',
      first_name: 'Test',
      last_name: 'QB',
      primary_position: 'QB',
      position_group: 'offense',
      position_depths: { QB: 1 },
    },
    {
      id: playerIds.rb,
      team_id: teamId,
      jersey_number: '22',
      first_name: 'Test',
      last_name: 'RB',
      primary_position: 'RB',
      position_group: 'offense',
      position_depths: { RB: 1 },
    },
    {
      id: playerIds.wr,
      team_id: teamId,
      jersey_number: '88',
      first_name: 'Test',
      last_name: 'WR',
      primary_position: 'WR',
      position_group: 'offense',
      position_depths: { WR: 1 },
    },
    {
      id: playerIds.lb,
      team_id: teamId,
      jersey_number: '55',
      first_name: 'Test',
      last_name: 'LB',
      primary_position: 'LB',
      position_group: 'defense',
      position_depths: { LB: 1 },
    },
    {
      id: playerIds.de,
      team_id: teamId,
      jersey_number: '99',
      first_name: 'Test',
      last_name: 'DE',
      primary_position: 'DE',
      position_group: 'defense',
      position_depths: { DE: 1 },
    },
    {
      id: playerIds.cb,
      team_id: teamId,
      jersey_number: '25',
      first_name: 'Test',
      last_name: 'CB',
      primary_position: 'CB',
      position_group: 'defense',
      position_depths: { CB: 1 },
    },
  ]);
  if (playerErr) throw new Error(`[seed] Players insert failed: ${playerErr.message}`);

  // ------------------------------------------------------------------
  // 6. Play instances
  //
  // Plays 1–7 populate legacy FK columns (qb_id, ball_carrier_id,
  // target_id) in addition to player_participation rows.  This tests
  // that the analytics service does not double-count.
  //
  // Plays 8–10 use player_participation ONLY (legacy FK columns omitted).
  //
  // Play 3 intentionally keeps yard_line = 25 so the TD is NOT in the
  // red zone — confirming red_zone_touchdowns = 0.
  // ------------------------------------------------------------------
  console.log('[seed] Creating play instances...');
  const plays = [
    // ── Drive 1: Touchdown drive ──────────────────────────────────────
    // Play 1 – 1st & 10, pass complete 15 yd, first down
    {
      id: offensivePlayIds[0],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[0],
      timestamp_start: 100,
      quarter: 1,
      down: 1,
      distance: 10,
      yard_line: 65,
      yards_gained: 15,
      result: 'pass_complete',
      play_type: 'pass',
      direction: 'right',
      is_opponent_play: false,
      resulted_in_first_down: true,
      is_complete: true,
      // legacy FK columns present on plays 1–7
      qb_id: playerIds.qb,
      target_id: playerIds.wr,
    },
    // Play 2 – 1st & 10, rush 8 yd
    {
      id: offensivePlayIds[1],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[0],
      timestamp_start: 200,
      quarter: 1,
      down: 1,
      distance: 10,
      yard_line: 50,
      yards_gained: 8,
      result: 'rush',
      play_type: 'run',
      direction: 'left',
      is_opponent_play: false,
      resulted_in_first_down: false,
      ball_carrier_id: playerIds.rb,
    },
    // Play 3 – 2nd & 2, pass complete TD 25 yd (yard_line=25 → NOT red zone)
    {
      id: offensivePlayIds[2],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[0],
      timestamp_start: 300,
      quarter: 1,
      down: 2,
      distance: 2,
      yard_line: 25,
      yards_gained: 25,
      result: 'pass_complete_touchdown',
      play_type: 'pass',
      direction: 'right',
      is_opponent_play: false,
      resulted_in_first_down: true,
      is_complete: true,
      is_touchdown: true,
      scoring_type: 'touchdown',
      qb_id: playerIds.qb,
      target_id: playerIds.wr,
    },
    // Play 4 – 1st & 10, pass complete 17 yd, first down
    {
      id: offensivePlayIds[3],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[0],
      timestamp_start: 400,
      quarter: 1,
      down: 1,
      distance: 10,
      yard_line: 50,
      yards_gained: 17,
      result: 'pass_complete',
      play_type: 'pass',
      direction: 'left',
      is_opponent_play: false,
      resulted_in_first_down: true,
      is_complete: true,
      qb_id: playerIds.qb,
      target_id: playerIds.wr,
    },
    // ── Drive 2: Punt / three-and-out ────────────────────────────────
    // Play 5 – 1st & 10, rush 2 yd (failure: 2 < 4.0)
    {
      id: offensivePlayIds[4],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[1],
      timestamp_start: 500,
      quarter: 2,
      down: 1,
      distance: 10,
      yard_line: 75,
      yards_gained: 2,
      result: 'rush',
      play_type: 'run',
      direction: 'middle',
      is_opponent_play: false,
      resulted_in_first_down: false,
      ball_carrier_id: playerIds.rb,
    },
    // Play 6 – 2nd & 8, pass incomplete 0 yd (failure: 0 < 4.8)
    {
      id: offensivePlayIds[5],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[1],
      timestamp_start: 600,
      quarter: 2,
      down: 2,
      distance: 8,
      yard_line: 73,
      yards_gained: 0,
      result: 'pass_incomplete',
      play_type: 'pass',
      direction: 'right',
      is_opponent_play: false,
      resulted_in_first_down: false,
      is_complete: false,
      qb_id: playerIds.qb,
      target_id: playerIds.wr,
    },
    // Play 7 – 3rd & 8, pass incomplete 0 yd (failure: 0 < 8.0)
    {
      id: offensivePlayIds[6],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[1],
      timestamp_start: 700,
      quarter: 2,
      down: 3,
      distance: 8,
      yard_line: 73,
      yards_gained: 0,
      result: 'pass_incomplete',
      play_type: 'pass',
      direction: 'left',
      is_opponent_play: false,
      resulted_in_first_down: false,
      is_complete: false,
      qb_id: playerIds.qb,
      // No target_id — throw-away / scramble pressure
    },
    // ── Drive 3: Field goal ───────────────────────────────────────────
    // Play 8 – 1st & 10, rush 20 yd, first down (participation ONLY — no legacy FKs)
    {
      id: offensivePlayIds[7],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[2],
      timestamp_start: 800,
      quarter: 3,
      down: 1,
      distance: 10,
      yard_line: 45,
      yards_gained: 20,
      result: 'rush',
      play_type: 'run',
      direction: 'right',
      is_opponent_play: false,
      resulted_in_first_down: true,
    },
    // Play 9 – 1st & 10, pass complete 12 yd, first down, RED ZONE (yl=18)
    {
      id: offensivePlayIds[8],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[2],
      timestamp_start: 900,
      quarter: 3,
      down: 1,
      distance: 10,
      yard_line: 18,
      yards_gained: 12,
      result: 'pass_complete',
      play_type: 'pass',
      direction: 'right',
      is_opponent_play: false,
      resulted_in_first_down: true,
      is_complete: true,
    },
    // Play 10 – 2nd & 3, rush 3 yd, RED ZONE (yl=15), scoring_type=field_goal set on drive
    {
      id: offensivePlayIds[9],
      video_id: videoId,
      team_id: teamId,
      drive_id: driveIds[2],
      timestamp_start: 1000,
      quarter: 3,
      down: 2,
      distance: 3,
      yard_line: 15,
      yards_gained: 3,
      result: 'rush',
      play_type: 'run',
      direction: 'middle',
      is_opponent_play: false,
      resulted_in_first_down: false,
    },
    // ── Defensive plays (opponent's offense) ─────────────────────────
    // Play 11 – opponent pass +5 yd
    {
      id: defensivePlayIds[0],
      video_id: videoId,
      team_id: teamId,
      timestamp_start: 1100,
      quarter: 2,
      down: 1,
      distance: 10,
      yard_line: 30,
      yards_gained: 5,
      result: 'pass_complete',
      play_type: 'pass',
      is_opponent_play: true,
    },
    // Play 12 – opponent pass, −2 yd sack
    {
      id: defensivePlayIds[1],
      video_id: videoId,
      team_id: teamId,
      timestamp_start: 1200,
      quarter: 2,
      down: 2,
      distance: 5,
      yard_line: 35,
      yards_gained: -2,
      result: 'sack',
      play_type: 'pass',
      is_opponent_play: true,
      is_sack: true,
    },
    // Play 13 – opponent pass, interception / turnover
    {
      id: defensivePlayIds[2],
      video_id: videoId,
      team_id: teamId,
      timestamp_start: 1300,
      quarter: 2,
      down: 3,
      distance: 7,
      yard_line: 33,
      yards_gained: 0,
      result: 'interception',
      play_type: 'pass',
      is_opponent_play: true,
      is_interception: true,
      is_turnover: true,
    },
    // Play 14 – opponent run +3 yd
    {
      id: defensivePlayIds[3],
      video_id: videoId,
      team_id: teamId,
      timestamp_start: 1400,
      quarter: 3,
      down: 1,
      distance: 10,
      yard_line: 50,
      yards_gained: 3,
      result: 'rush',
      play_type: 'run',
      is_opponent_play: true,
    },
    // Play 15 – opponent pass +8 yd
    {
      id: defensivePlayIds[4],
      video_id: videoId,
      team_id: teamId,
      timestamp_start: 1500,
      quarter: 3,
      down: 2,
      distance: 7,
      yard_line: 47,
      yards_gained: 8,
      result: 'pass_complete',
      play_type: 'pass',
      is_opponent_play: true,
    },
  ];

  const { error: playsErr } = await client.from('play_instances').insert(plays);
  if (playsErr) throw new Error(`[seed] Play instances insert failed: ${playsErr.message}`);

  // ------------------------------------------------------------------
  // 7. Player participation
  //
  // The participation_type check constraint (from migration 123) allows
  // these values: passer, rusher, receiver, blocker, primary_tackle,
  // assist_tackle, pressure, interception, pass_breakup, etc.
  //
  // Plays 1–7: both legacy FK and participation rows coexist.
  //   Tests that the analytics service deduplicates correctly.
  // Plays 8–10: participation rows only (no legacy FKs on play rows).
  // Plays 11–15: defensive participation only.
  // ------------------------------------------------------------------
  console.log('[seed] Creating player participation...');

  const participations = [
    // ── Plays 1–4 (Drive 1, legacy + participation) ──────────────────
    { play_instance_id: offensivePlayIds[0], player_id: playerIds.qb, team_id: teamId, participation_type: 'passer', phase: 'offense' },
    { play_instance_id: offensivePlayIds[0], player_id: playerIds.wr, team_id: teamId, participation_type: 'receiver', phase: 'offense', result: 'success' },

    { play_instance_id: offensivePlayIds[1], player_id: playerIds.rb, team_id: teamId, participation_type: 'rusher', phase: 'offense' },

    { play_instance_id: offensivePlayIds[2], player_id: playerIds.qb, team_id: teamId, participation_type: 'passer', phase: 'offense' },
    { play_instance_id: offensivePlayIds[2], player_id: playerIds.wr, team_id: teamId, participation_type: 'receiver', phase: 'offense', result: 'success' },

    { play_instance_id: offensivePlayIds[3], player_id: playerIds.qb, team_id: teamId, participation_type: 'passer', phase: 'offense' },
    { play_instance_id: offensivePlayIds[3], player_id: playerIds.wr, team_id: teamId, participation_type: 'receiver', phase: 'offense', result: 'success' },

    // ── Plays 5–7 (Drive 2, legacy + participation) ──────────────────
    { play_instance_id: offensivePlayIds[4], player_id: playerIds.rb, team_id: teamId, participation_type: 'rusher', phase: 'offense' },

    { play_instance_id: offensivePlayIds[5], player_id: playerIds.qb, team_id: teamId, participation_type: 'passer', phase: 'offense' },
    { play_instance_id: offensivePlayIds[5], player_id: playerIds.wr, team_id: teamId, participation_type: 'receiver', phase: 'offense', result: 'failure' },

    { play_instance_id: offensivePlayIds[6], player_id: playerIds.qb, team_id: teamId, participation_type: 'passer', phase: 'offense' },
    // No WR on play 7 — QB had no designated target on the throw-away

    // ── Plays 8–10 (Drive 3, participation ONLY — no legacy FKs) ─────
    { play_instance_id: offensivePlayIds[7], player_id: playerIds.rb, team_id: teamId, participation_type: 'rusher', phase: 'offense' },

    { play_instance_id: offensivePlayIds[8], player_id: playerIds.qb, team_id: teamId, participation_type: 'passer', phase: 'offense' },
    { play_instance_id: offensivePlayIds[8], player_id: playerIds.wr, team_id: teamId, participation_type: 'receiver', phase: 'offense', result: 'success' },

    { play_instance_id: offensivePlayIds[9], player_id: playerIds.rb, team_id: teamId, participation_type: 'rusher', phase: 'offense' },

    // ── Defensive plays 11–15 ─────────────────────────────────────────
    { play_instance_id: defensivePlayIds[0], player_id: playerIds.lb, team_id: teamId, participation_type: 'primary_tackle', phase: 'defense' },

    { play_instance_id: defensivePlayIds[1], player_id: playerIds.de, team_id: teamId, participation_type: 'pressure', phase: 'defense', result: 'sack' },

    { play_instance_id: defensivePlayIds[2], player_id: playerIds.cb, team_id: teamId, participation_type: 'interception', phase: 'defense' },

    { play_instance_id: defensivePlayIds[3], player_id: playerIds.lb, team_id: teamId, participation_type: 'assist_tackle', phase: 'defense' },

    { play_instance_id: defensivePlayIds[4], player_id: playerIds.cb, team_id: teamId, participation_type: 'pass_breakup', phase: 'defense' },
  ];

  const { data: insertedParticipation, error: partErr } = await client
    .from('player_participation')
    .insert(participations)
    .select('id');

  if (partErr) throw new Error(`[seed] Player participation insert failed: ${partErr.message}`);

  const participationIds = (insertedParticipation ?? []).map((p: { id: string }) => p.id);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log(`[seed] Seed complete: ${testSeedRunId.slice(0, 8)}`);
  console.log(`[seed]   Team      : ${teamId}`);
  console.log(`[seed]   Game      : ${gameId}`);
  console.log(`[seed]   Video     : ${videoId}`);
  console.log(`[seed]   Plays     : ${allPlayIds.length} (${offensivePlayIds.length} offensive, ${defensivePlayIds.length} defensive)`);
  console.log(`[seed]   Participation: ${participationIds.length} rows`);

  return {
    testSeedRunId,
    teamId,
    gameId,
    videoId,
    playerIds,
    driveIds,
    offensivePlayIds,
    defensivePlayIds,
    participationIds,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Deletes all records created by a seed run.
 *
 * Deletion order respects FK constraints (child tables first).
 * Most tables cascade from team_id, but we are explicit for safety and so
 * that partial-failure seed runs are still fully cleaned up.
 *
 * @param seedResult - The result returned by seedFilmAnalyticsData.
 */
export async function cleanupFilmAnalyticsData(seedResult: SeedResult): Promise<void> {
  const client = getServiceClient();
  const { teamId, gameId, testSeedRunId } = seedResult;

  console.log(`[cleanup] Starting cleanup for seed run: ${testSeedRunId.slice(0, 8)}`);

  // player_participation → play_instances → drives → players → videos → games → teams
  // Each step is wrapped individually so a failure in one does not prevent the rest.

  const steps: Array<{ label: string; fn: () => Promise<void> }> = [
    {
      label: 'player_participation',
      fn: async () => {
        const { error } = await client
          .from('player_participation')
          .delete()
          .eq('team_id', teamId);
        if (error) throw error;
      },
    },
    {
      label: 'play_instances',
      fn: async () => {
        const { error } = await client
          .from('play_instances')
          .delete()
          .eq('team_id', teamId);
        if (error) throw error;
      },
    },
    {
      label: 'drives',
      fn: async () => {
        const { error } = await client
          .from('drives')
          .delete()
          .eq('team_id', teamId);
        if (error) throw error;
      },
    },
    {
      label: 'players',
      fn: async () => {
        const { error } = await client
          .from('players')
          .delete()
          .eq('team_id', teamId);
        if (error) throw error;
      },
    },
    {
      label: 'videos',
      fn: async () => {
        const { error } = await client
          .from('videos')
          .delete()
          .eq('game_id', gameId);
        if (error) throw error;
      },
    },
    {
      label: 'games',
      fn: async () => {
        const { error } = await client
          .from('games')
          .delete()
          .eq('team_id', teamId);
        if (error) throw error;
      },
    },
    {
      label: 'teams',
      fn: async () => {
        const { error } = await client
          .from('teams')
          .delete()
          .eq('id', teamId);
        if (error) throw error;
      },
    },
  ];

  for (const step of steps) {
    try {
      await step.fn();
      console.log(`[cleanup] Deleted ${step.label}`);
    } catch (err) {
      // Log and continue — don't let one failure block the rest
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cleanup] Warning: failed to delete ${step.label}: ${msg}`);
    }
  }

  console.log(`[cleanup] Complete for seed run: ${testSeedRunId.slice(0, 8)}`);
}
