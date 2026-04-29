/**
 * Service: Player Report Generation
 *
 * Aggregates per-player game statistics from play_instances / player_participation,
 * calls Gemini to produce coach and parent narratives, then persists the result to
 * player_reports. Stat aggregation helpers are private to this file.
 *
 * Usage:
 *   await generatePlayerReport(athleteProfileId, gameId, teamId);
 */

import { createServiceClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Types
// ============================================================================

type PlayerUnit = 'offense' | 'offense_oline' | 'defense' | 'special_teams';

interface PlayRow {
  id: string; down: number | null; distance: number | null; yards_gained: number | null;
  result: string | null; scoring_type: string | null; is_touchdown: boolean | null;
  play_code: string | null; yard_line: number | null; rb_broken_tackles: number | null;
  lt_block_result: string | null; lg_block_result: string | null;
  c_block_result: string | null; rg_block_result: string | null; rt_block_result: string | null;
  ball_carrier_id: string | null; qb_id: string | null; target_id: string | null;
  sack_player_id: string | null; coverage_player_id: string | null;
  lt_id: string | null; lg_id: string | null; c_id: string | null;
  rg_id: string | null; rt_id: string | null; kicker_id: string | null;
  returner_id: string | null; punter_id: string | null;
  gunner_tackle_id: string | null; coverage_tackler_id: string | null;
}

interface PartRow {
  play_instance_id: string; player_id: string; participation_type: string;
  yards_gained: number | null; is_touchdown: boolean | null; result: string | null;
}

interface GeminiResponse {
  coach_narrative: string; parent_narrative: string;
  position_grade: number; effort_grade: number; growth_area: string;
}

interface OffenseStats {
  unit: 'offense'; snaps_played: number;
  plays_by_type: { run:number; pass:number; screen:number; rpo:number };
  as_ball_carrier: { carries:number; yards:number; broken_tackles:number; touchdowns:number };
  as_receiver: { targets:number; receptions:number; yards:number; touchdowns:number };
  as_passer: { attempts:number; completions:number; yards:number; touchdowns:number; interceptions:number; under_pressure_count:number };
  points_scored: number;
}
interface OLineStats {
  unit: 'offense_oline'; snaps_played: number; position: string;
  block_results: { held:number; pushed_back:number; beaten:number; penalty:number };
  pressures_allowed: number; penalties: number;
}
interface DefenseStats {
  unit: 'defense'; snaps_played: number;
  tackles: { primary:number; assist:number; missed:number; for_loss:number };
  pass_rush: { pressures:number; sacks:number; hurries:number };
  coverage: { assignments:number; pass_breakups:number; interceptions:number; completions_allowed:number };
  turnovers_created: number; run_defense: { stops:number };
}
interface STStats {
  unit: 'special_teams';
  as_kicker: { attempts:number; made:number; missed:number; distances:number[]; field_goal_pct:number } | null;
  as_punter: { punts:number; average_distance:number } | null;
  as_returner: { returns:number; total_yards:number; average:number; long:number } | null;
  as_gunner: { tackles:number } | null;
  as_coverage: { tackles:number } | null;
}
type StatsSnapshot = OffenseStats | OLineStats | DefenseStats | STStats;

// ============================================================================
// Constants
// ============================================================================

const OFFENSE_TYPES = new Set([
  'passer','rusher','receiver','blocker','ol_lt','ol_lg','ol_c','ol_rg','ol_rt','ol_penalty',
]);
const OLINE_TYPES  = new Set(['ol_lt','ol_lg','ol_c','ol_rg','ol_rt']);
const DEFENSE_TYPES = new Set([
  'primary_tackle','assist_tackle','missed_tackle','pressure','interception','pass_breakup',
  'forced_fumble','fumble_recovery','tackle_for_loss','coverage_assignment',
  'dl_run_defense','lb_run_stop','db_run_support','lb_pass_coverage','db_pass_coverage',
]);
const ST_TYPES = new Set([
  'kicker','punter','long_snapper','holder','returner','gunner','jammer',
  'coverage_tackle','st_blocker','punt_return','kickoff_return','punt_coverage','kickoff_coverage',
]);
const OLINE_LABELS: Record<string, string> = { ol_lt:'LT', ol_lg:'LG', ol_c:'C', ol_rg:'RG', ol_rt:'RT' };
const OLINE_BLOCK_COL: Record<string, keyof PlayRow> = {
  ol_lt:'lt_block_result', ol_lg:'lg_block_result', ol_c:'c_block_result',
  ol_rg:'rg_block_result', ol_rt:'rt_block_result',
};
const DOWN_SUFFIX = ['st','nd','rd','th'];
const UNIT_LABELS: Record<PlayerUnit, string> = {
  offense:'Offense', offense_oline:'Offensive Line', defense:'Defense', special_teams:'Special Teams',
};

// ============================================================================
// Private helpers
// ============================================================================

function isTD(play: PlayRow, part?: PartRow | null): boolean {
  return play.scoring_type === 'touchdown' || play.is_touchdown === true
    || part?.is_touchdown === true || (play.result?.includes('touchdown') ?? false);
}

function determineUnit(parts: PartRow[]): PlayerUnit {
  let off = 0, def = 0, st = 0, ol = 0;
  for (const { participation_type: pt } of parts) {
    if (OFFENSE_TYPES.has(pt)) { off++; if (OLINE_TYPES.has(pt)) ol++; }
    else if (DEFENSE_TYPES.has(pt)) def++;
    else if (ST_TYPES.has(pt)) st++;
  }
  const max = Math.max(off, def, st);
  if (off === max && off > 0) return (off > 0 && ol / off >= 0.5) ? 'offense_oline' : 'offense';
  if (def === max && def > 0) return 'defense';
  if (st > 0) return 'special_teams';
  return 'offense';
}

function buildOffenseStats(parts: PartRow[], pm: Map<string, PlayRow>): OffenseStats {
  const bc = { carries:0, yards:0, broken_tackles:0, touchdowns:0 };
  const rec = { targets:0, receptions:0, yards:0, touchdowns:0 };
  const pass = { attempts:0, completions:0, yards:0, touchdowns:0, interceptions:0, under_pressure_count:0 };
  const byType = { run:0, pass:0, screen:0, rpo:0 };
  let points = 0;
  const snaps = new Set(parts.map(p => p.play_instance_id)).size;

  for (const row of parts) {
    const play = pm.get(row.play_instance_id); if (!play) continue;
    const yards = row.yards_gained ?? play.yards_gained ?? 0;
    const td = isTD(play, row);
    const res = play.result ?? '';
    const complete = res === 'pass_complete' || res === 'complete' || td;
    const isInt = res === 'pass_interception' || res.includes('interception');

    if (row.participation_type === 'rusher') {
      bc.carries++; bc.yards += yards; bc.broken_tackles += play.rb_broken_tackles ?? 0;
      if (td) { bc.touchdowns++; points += 6; }
      res.includes('rpo') ? byType.rpo++ : byType.run++;
    } else if (row.participation_type === 'receiver') {
      rec.targets++;
      if (complete) { rec.receptions++; rec.yards += yards; }
      if (td) { rec.touchdowns++; points += 6; }
      res.includes('screen') ? byType.screen++ : byType.pass++;
    } else if (row.participation_type === 'passer') {
      pass.attempts++; pass.yards += yards;
      if (complete) pass.completions++;
      if (td) pass.touchdowns++;
      if (isInt) pass.interceptions++;
      if (res.includes('pressure') || res.includes('hurry')) pass.under_pressure_count++;
      byType.pass++;
    }
  }

  return { unit:'offense', snaps_played:snaps, plays_by_type:byType,
    as_ball_carrier:bc, as_receiver:rec, as_passer:pass, points_scored:points };
}

function buildOLineStats(parts: PartRow[], pm: Map<string, PlayRow>): OLineStats {
  const counts: Record<string, number> = {};
  for (const { participation_type: pt } of parts) {
    if (OLINE_TYPES.has(pt)) counts[pt] = (counts[pt] ?? 0) + 1;
  }
  const topType = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'ol_lt';
  const position = OLINE_LABELS[topType] ?? 'OL';
  const br = { held:0, pushed_back:0, beaten:0, penalty:0 };
  let pressures = 0, penalties = 0;
  const snaps = new Set<string>();

  for (const row of parts) {
    const play = pm.get(row.play_instance_id); if (!play) continue;
    snaps.add(row.play_instance_id);
    if (row.participation_type === 'ol_penalty') { penalties++; br.penalty++; continue; }
    if (OLINE_TYPES.has(row.participation_type)) {
      const col = OLINE_BLOCK_COL[row.participation_type];
      const blk = (play[col] as string | null) ?? row.result ?? '';
      if (blk === 'win' || blk === 'held') br.held++;
      else if (blk === 'pushed_back') br.pushed_back++;
      else if (blk === 'loss' || blk === 'beaten') br.beaten++;
      const res = row.result ?? play.result ?? '';
      if (res.includes('pressure') || res.includes('sack')) pressures++;
    }
  }

  return { unit:'offense_oline', snaps_played:snaps.size, position,
    block_results:br, pressures_allowed:pressures, penalties };
}

function buildDefenseStats(parts: PartRow[]): DefenseStats {
  const tackles = { primary:0, assist:0, missed:0, for_loss:0 };
  const rush = { pressures:0, sacks:0, hurries:0 };
  const cov = { assignments:0, pass_breakups:0, interceptions:0, completions_allowed:0 };
  let turnovers = 0, runStops = 0;
  const snaps = new Set(parts.map(p => p.play_instance_id)).size;

  for (const { participation_type: pt, result } of parts) {
    const res = result ?? '';
    if (pt === 'primary_tackle') tackles.primary++;
    else if (pt === 'assist_tackle') tackles.assist++;
    else if (pt === 'missed_tackle') tackles.missed++;
    else if (pt === 'tackle_for_loss') { tackles.for_loss++; tackles.primary++; }
    else if (pt === 'pressure') {
      rush.pressures++;
      if (res.includes('sack')) rush.sacks++;
      else if (res.includes('hurry')) rush.hurries++;
    } else if (pt === 'interception') { cov.interceptions++; turnovers++; }
    else if (pt === 'pass_breakup') cov.pass_breakups++;
    else if (pt === 'forced_fumble' || pt === 'fumble_recovery') turnovers++;
    else if (pt === 'coverage_assignment' || pt === 'lb_pass_coverage' || pt === 'db_pass_coverage') {
      cov.assignments++;
      if (res === 'complete' || res === 'pass_complete') cov.completions_allowed++;
    } else if (pt === 'dl_run_defense' || pt === 'lb_run_stop' || pt === 'db_run_support') runStops++;
  }

  return { unit:'defense', snaps_played:snaps, tackles, pass_rush:rush,
    coverage:cov, turnovers_created:turnovers, run_defense:{ stops:runStops } };
}

function buildSpecialTeamsStats(parts: PartRow[], pm: Map<string, PlayRow>): STStats {
  const kicker = { attempts:0, made:0, missed:0, distances:[] as number[], field_goal_pct:0 };
  const punter = { punts:0, yards:0 };
  const returner = { returns:0, yards:0, long:0 };
  const gunner = { tackles:0 };
  const coverage = { tackles:0 };

  for (const row of parts) {
    const play = pm.get(row.play_instance_id);
    const yards = row.yards_gained ?? play?.yards_gained ?? 0;
    const res = row.result ?? '';
    const { participation_type: pt } = row;

    if (pt === 'kicker') {
      kicker.attempts++;
      if (res === 'made' || res === 'good') { kicker.made++; if (play?.yard_line) kicker.distances.push(play.yard_line); }
      else kicker.missed++;
    } else if (pt === 'punter') { punter.punts++; punter.yards += yards; }
    else if (pt === 'returner' || pt === 'punt_return' || pt === 'kickoff_return') {
      returner.returns++; returner.yards += yards; if (yards > returner.long) returner.long = yards;
    } else if (pt === 'gunner' && res.includes('tackle')) gunner.tackles++;
    else if (pt === 'coverage_tackle' || pt === 'punt_coverage' || pt === 'kickoff_coverage') coverage.tackles++;
  }

  if (kicker.attempts > 0) kicker.field_goal_pct = (kicker.made / kicker.attempts) * 100;

  return {
    unit: 'special_teams',
    as_kicker: kicker.attempts > 0 ? kicker : null,
    as_punter: punter.punts > 0 ? { punts:punter.punts, average_distance:punter.yards/punter.punts } : null,
    as_returner: returner.returns > 0
      ? { returns:returner.returns, total_yards:returner.yards, average:returner.yards/returner.returns, long:returner.long }
      : null,
    as_gunner: gunner.tackles > 0 ? gunner : null,
    as_coverage: coverage.tackles > 0 ? coverage : null,
  };
}

function statsToText(s: StatsSnapshot): string {
  const lines: string[] = [];
  if (s.unit === 'offense') {
    const { bc, rec, pass, pt, pts, n } = { bc:s.as_ball_carrier, rec:s.as_receiver, pass:s.as_passer, pt:s.plays_by_type, pts:s.points_scored, n:s.snaps_played };
    lines.push(`Snaps: ${n}`);
    if (bc.carries > 0) lines.push(`Rushing: ${bc.carries} car, ${bc.yards} yds (${(bc.yards/bc.carries).toFixed(1)} avg), ${bc.touchdowns} TD, ${bc.broken_tackles} broken tackles`);
    if (rec.targets > 0) lines.push(`Receiving: ${rec.receptions}/${rec.targets} targets, ${rec.yards} yds (${rec.receptions > 0 ? (rec.yards/rec.receptions).toFixed(1) : '0.0'} avg), ${rec.touchdowns} TD`);
    if (pass.attempts > 0) lines.push(`Passing: ${pass.completions}/${pass.attempts}, ${pass.yards} yds, ${pass.touchdowns} TD, ${pass.interceptions} INT, ${pass.under_pressure_count} under pressure`);
    if (pts > 0) lines.push(`Points scored: ${pts}`);
    lines.push(`Play types — Run:${pt.run} Pass:${pt.pass} Screen:${pt.screen} RPO:${pt.rpo}`);
  } else if (s.unit === 'offense_oline') {
    const br = s.block_results;
    lines.push(`Position: ${s.position}, Snaps: ${s.snaps_played}`);
    lines.push(`Blocks — Held:${br.held} PushedBack:${br.pushed_back} Beaten:${br.beaten} Penalty:${br.penalty}`);
    lines.push(`Pressures allowed: ${s.pressures_allowed}, Penalties: ${s.penalties}`);
  } else if (s.unit === 'defense') {
    const { t, pr, cov } = { t:s.tackles, pr:s.pass_rush, cov:s.coverage };
    lines.push(`Snaps: ${s.snaps_played}`);
    lines.push(`Tackles — Primary:${t.primary} Assist:${t.assist} Missed:${t.missed} TFL:${t.for_loss}`);
    lines.push(`Pass rush — Pressures:${pr.pressures} Sacks:${pr.sacks} Hurries:${pr.hurries}`);
    lines.push(`Coverage — Assignments:${cov.assignments} PBU:${cov.pass_breakups} INT:${cov.interceptions} CompAllowed:${cov.completions_allowed}`);
    lines.push(`Turnovers created: ${s.turnovers_created}, Run defense stops: ${s.run_defense.stops}`);
  } else {
    const { as_kicker:k, as_punter:p, as_returner:r, as_gunner:g, as_coverage:c } = s;
    if (k) lines.push(`Kicking: ${k.made}/${k.attempts} FGs (${k.field_goal_pct.toFixed(0)}%)`);
    if (p) lines.push(`Punting: ${p.punts} punts, ${p.average_distance.toFixed(1)} avg`);
    if (r) lines.push(`Returns: ${r.returns}, ${r.total_yards} yds, ${r.average.toFixed(1)} avg, long ${r.long}`);
    if (g) lines.push(`Gunner tackles: ${g.tackles}`);
    if (c) lines.push(`Coverage tackles: ${c.tackles}`);
  }
  return lines.join('\n');
}

function playListText(parts: PartRow[], pm: Map<string, PlayRow>): string {
  const seen = new Set<string>();
  return parts.flatMap(row => {
    if (seen.has(row.play_instance_id)) return [];
    seen.add(row.play_instance_id);
    const play = pm.get(row.play_instance_id);
    if (!play) return [];
    const dn = play.down != null ? `${play.down}${DOWN_SUFFIX[Math.min(play.down - 1, 3)]}` : '?';
    const dist = play.distance != null ? ` & ${play.distance}` : '';
    const yards = play.yards_gained != null ? `${play.yards_gained} yds` : 'unknown';
    const td = isTD(play) ? ' (TD)' : '';
    const res = play.result ? ` [${play.result}]` : '';
    return [`  - ${dn}${dist}: ${yards}${td}${res}`];
  }).join('\n');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generates a player game report with stat aggregation and AI narratives,
 * then persists the result to player_reports.
 *
 * Skips silently when the player has no play involvement in this game.
 * If Gemini fails, the stats_snapshot is still saved with null narratives.
 *
 * @param athleteProfileId - athlete_profiles.id
 * @param gameId           - games.id
 * @param teamId           - teams.id scoping the roster entry
 */
export async function generatePlayerReport(
  athleteProfileId: string,
  gameId: string,
  teamId: string,
): Promise<void> {
  console.log('[player-report] Starting report generation', { athleteProfileId, gameId, teamId });

  const supabase = createServiceClient();

  // 1. Resolve athlete_seasons → players
  const { data: seasonRow, error: seasonErr } = await supabase
    .from('athlete_seasons').select('id, roster_id')
    .eq('athlete_profile_id', athleteProfileId).eq('team_id', teamId).maybeSingle();
  if (seasonErr) throw new Error(`[player-report] athlete_seasons lookup failed: ${seasonErr.message}`);
  if (!seasonRow?.roster_id) {
    console.log('[player-report] No athlete_seasons record — skipping', { athleteProfileId, teamId });
    return;
  }
  const rosterId = seasonRow.roster_id as string;
  const seasonId  = seasonRow.id as string;

  const { data: player, error: playerErr } = await supabase
    .from('players').select('first_name, last_name, jersey_number, position_categories!primary_position_category_id(code)')
    .eq('id', rosterId).single();
  if (playerErr) throw new Error(`[player-report] players lookup failed: ${playerErr.message}`);
  console.log('[player-report] Player resolved', { name:`${player.first_name} ${player.last_name}` });

  // 2. Fetch game context
  const { data: game, error: gameErr } = await supabase
    .from('games').select('opponent, date, team_score, opponent_score')
    .eq('id', gameId).single();
  if (gameErr) throw new Error(`[player-report] games lookup failed: ${gameErr.message}`);

  // 3. Collect video IDs
  const { data: videos, error: videoErr } = await supabase
    .from('videos').select('id').eq('game_id', gameId);
  if (videoErr) throw new Error(`[player-report] videos lookup failed: ${videoErr.message}`);
  const videoIds = (videos ?? []).map((v: { id: string }) => v.id);
  if (videoIds.length === 0) {
    console.log('[player-report] No videos for game — skipping', { gameId }); return;
  }

  // 4. Fetch play_instances for those videos
  const { data: rawPlays, error: playsErr } = await supabase
    .from('play_instances')
    .select(
      'id,down,distance,yards_gained,result,scoring_type,is_touchdown,play_code,yard_line,' +
      'rb_broken_tackles,lt_block_result,lg_block_result,c_block_result,rg_block_result,rt_block_result,' +
      'ball_carrier_id,qb_id,target_id,sack_player_id,coverage_player_id,' +
      'lt_id,lg_id,c_id,rg_id,rt_id,kicker_id,returner_id,punter_id,gunner_tackle_id,coverage_tackler_id'
    )
    .in('video_id', videoIds);
  if (playsErr) throw new Error(`[player-report] play_instances lookup failed: ${playsErr.message}`);

  const allPlays = (rawPlays ?? []) as unknown as PlayRow[];
  const allPlayIds = allPlays.map(p => p.id);

  const directIds = new Set<string>(allPlays.filter(p =>
    [p.ball_carrier_id, p.qb_id, p.target_id, p.sack_player_id, p.coverage_player_id,
     p.lt_id, p.lg_id, p.c_id, p.rg_id, p.rt_id,
     p.kicker_id, p.returner_id, p.punter_id, p.gunner_tackle_id, p.coverage_tackler_id
    ].includes(rosterId)
  ).map(p => p.id));

  // 5. Fetch player_participation
  const { data: rawParts, error: partsErr } = await supabase
    .from('player_participation')
    .select('play_instance_id,player_id,participation_type,yards_gained,is_touchdown,result')
    .eq('player_id', rosterId).in('play_instance_id', allPlayIds);
  if (partsErr) throw new Error(`[player-report] player_participation lookup failed: ${partsErr.message}`);

  const parts = (rawParts ?? []) as unknown as PartRow[];
  const involvedIds = new Set([...directIds, ...parts.map(p => p.play_instance_id)]);

  if (involvedIds.size === 0) {
    console.log('[player-report] No play involvement — skipping', { athleteProfileId, gameId }); return;
  }
  console.log('[player-report] Play involvement found', { playCount: involvedIds.size });

  const playMap = new Map(allPlays.filter(p => involvedIds.has(p.id)).map(p => [p.id, p]));

  // 6. Determine unit and aggregate stats
  const unit = determineUnit(parts);
  console.log('[player-report] Unit determined', { unit });

  const statsSnapshot: StatsSnapshot = unit === 'offense' ? buildOffenseStats(parts, playMap)
    : unit === 'offense_oline' ? buildOLineStats(parts, playMap)
    : unit === 'defense'       ? buildDefenseStats(parts)
    : buildSpecialTeamsStats(parts, playMap);

  // 7. Build prompt and call Gemini
  const scoreStr = game.team_score != null && game.opponent_score != null
    ? `${game.team_score}-${game.opponent_score}` : 'Score not recorded';
  const prompt = [
    `Generate two performance narratives for this player's game performance.\n`,
    `PLAYER: ${player.first_name} ${player.last_name} ${player.jersey_number != null ? `#${player.jersey_number}` : ''} (${(player as unknown as { position_categories?: { code?: string } | null }).position_categories?.code ?? 'Unknown'})`,
    `GAME: vs ${game.opponent ?? 'Unknown'} on ${game.date ?? 'unknown date'} — Final: ${scoreStr}`,
    `UNIT: ${UNIT_LABELS[unit]}\n`,
    `PERFORMANCE DATA:\n${statsToText(statsSnapshot)}\n`,
    `PLAYS INVOLVED:\n${playListText(parts, playMap)}\n`,
    `INSTRUCTIONS:\nReturn only valid JSON. No markdown. No preamble.\n`,
    `{\n  "coach_narrative": "...",\n  "parent_narrative": "...",\n  "position_grade": <1-10>,\n  "effort_grade": <1-10>,\n  "growth_area": "..."\n}\n`,
    `For coach_narrative: You are generating a technical performance report for a youth football coach. Be direct and specific. Use coaching terminology. Reference specific plays by down. State what the player did well, what needs work, and one specific drill for next practice. Coaches value honesty over encouragement.\n`,
    `For parent_narrative: You are writing a player development update for a parent. Tone: warm, encouraging, honest, specific. Avoid jargon. Lead with what the player did well and why it matters. Include one growth area as an exciting opportunity. Reference specific moments. Max 3 paragraphs. Never use a numerical grade.`,
  ].join('\n');

  let parsed: GeminiResponse | null = null;
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured');
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('[player-report] Calling Gemini');
    const text = (await model.generateContent(prompt)).response.text();
    const json = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(json) as GeminiResponse;
    console.log('[player-report] Gemini OK', { position_grade: parsed.position_grade, effort_grade: parsed.effort_grade });
  } catch (err) {
    console.error('[player-report] Gemini failed — saving stats only', err);
  }

  // 8. Persist
  const { error: insertErr } = await supabase.from('player_reports').insert({
    athlete_profile_id: athleteProfileId,
    athlete_season_id: seasonId,
    game_id: gameId,
    sport: 'football',
    report_type: 'game',
    stats_snapshot: parsed
      ? { ...statsSnapshot, position_grade: parsed.position_grade, effort_grade: parsed.effort_grade, growth_area: parsed.growth_area }
      : statsSnapshot,
    ai_narrative_coach: parsed?.coach_narrative ?? null,
    ai_narrative_parent: parsed?.parent_narrative ?? null,
    gemini_model_used: 'gemini-2.5-flash',
    is_published_to_parent: false,
    coach_edited: false,
  });
  if (insertErr) throw new Error(`[player-report] insert failed: ${insertErr.message}`);
  console.log('[player-report] Report saved', { athleteProfileId, gameId });
}
