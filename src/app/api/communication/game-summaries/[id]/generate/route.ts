/**
 * API: /api/communication/game-summaries/[id]/generate
 * POST - Generate an AI draft from coach notes and tagged play data.
 *
 * Uses Gemini 2.5 Flash via the Vercel AI SDK. The prompt uses a coach-like
 * voice with real game statistics to produce concise, actionable summaries.
 * Tone is controlled by the team's `report_tone` communication setting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { getGameSummary, updateGameSummary } from '@/lib/services/communication/report.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// Types
// ============================================================================

interface PlayerParticipationRow {
  player_id: string;
  participation_type: string;
  yards_gained: number | null;
  is_touchdown: boolean | null;
  is_turnover: boolean | null;
  result: string | null;
  play_instances: {
    id: string;
    down: number | null;
    distance: number | null;
    yards_gained: number | null;
    resulted_in_first_down: boolean | null;
    is_turnover: boolean | null;
    scoring_type: string | null;
    is_touchdown: boolean | null;
    result: string | null;
    yard_line: number | null;
    play_code: string | null;
    is_opponent_play: boolean | null;
  } | null;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
    primary_position: string | null;
  } | null;
}

interface AggregatedPlayerStats {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  position: string | null;
  // Rushing
  rushAttempts: number;
  rushYards: number;
  rushTDs: number;
  // Passing
  passAttempts: number;
  completions: number;
  passYards: number;
  passTDs: number;
  passInts: number;
  // Receiving
  targets: number;
  receptions: number;
  recYards: number;
  recTDs: number;
  // Defensive
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
  passBreakups: number;
  defInts: number;
}

type ReportTone = 'coach' | 'formal' | 'casual';

// ============================================================================
// Helpers
// ============================================================================

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

/**
 * Determines whether a play was successful based on standard football success criteria.
 */
function isPlaySuccessful(
  down: number | null,
  distance: number | null,
  yardsGained: number | null,
  resultedInFirstDown: boolean | null
): boolean {
  if (resultedInFirstDown) return true;
  if (!down || !distance || yardsGained === null) return false;
  if (down === 1) return yardsGained >= distance * 0.4;
  if (down === 2) return yardsGained >= distance * 0.6;
  if (down === 3 || down === 4) return yardsGained >= distance;
  return false;
}

/**
 * Checks whether a play instance resulted in a touchdown using all available signals.
 */
function isTouchdown(play: { scoring_type?: string | null; is_touchdown?: boolean | null; result?: string | null }): boolean {
  return play.scoring_type === 'touchdown' || play.is_touchdown === true || (play.result?.includes('touchdown') ?? false);
}

/**
 * Builds a concise, role-appropriate stat line for a player to include in the prompt.
 * Returns null if the player had no meaningful activity.
 */
function buildPlayerStatLine(stats: AggregatedPlayerStats): string | null {
  const parts: string[] = [];

  if (stats.rushAttempts > 0) {
    const tdText = stats.rushTDs > 0 ? `, ${stats.rushTDs} TD${stats.rushTDs > 1 ? 's' : ''}` : '';
    const avg = stats.rushAttempts > 0 ? (stats.rushYards / stats.rushAttempts).toFixed(1) : '0.0';
    parts.push(`${stats.rushAttempts} car, ${stats.rushYards} yds (${avg} avg)${tdText}`);
  }

  if (stats.passAttempts > 0) {
    const tdText = stats.passTDs > 0 ? `, ${stats.passTDs} TD${stats.passTDs > 1 ? 's' : ''}` : '';
    const intText = stats.passInts > 0 ? `, ${stats.passInts} INT` : '';
    parts.push(`${stats.completions}/${stats.passAttempts} passing, ${stats.passYards} yds${tdText}${intText}`);
  }

  if (stats.targets > 0) {
    const tdText = stats.recTDs > 0 ? `, ${stats.recTDs} TD${stats.recTDs > 1 ? 's' : ''}` : '';
    const avg = stats.receptions > 0 ? (stats.recYards / stats.receptions).toFixed(1) : '0.0';
    parts.push(`${stats.receptions}/${stats.targets} rec, ${stats.recYards} yds (${avg} avg)${tdText}`);
  }

  const defParts: string[] = [];
  if (stats.tackles > 0) defParts.push(`${stats.tackles} tkl`);
  if (stats.tacklesForLoss > 0) defParts.push(`${stats.tacklesForLoss} TFL`);
  if (stats.sacks > 0) defParts.push(`${stats.sacks} sack${stats.sacks > 1 ? 's' : ''}`);
  if (stats.passBreakups > 0) defParts.push(`${stats.passBreakups} PBU`);
  if (stats.defInts > 0) defParts.push(`${stats.defInts} INT`);
  if (defParts.length > 0) parts.push(defParts.join(', '));

  if (parts.length === 0) return null;

  const jersey = stats.jerseyNumber != null ? ` (#${stats.jerseyNumber})` : '';
  return `${stats.name}${jersey}: ${parts.join(' | ')}`;
}

/**
 * Returns the tone-appropriate system preamble for the AI prompt.
 */
function getTonePreamble(tone: ReportTone): string {
  switch (tone) {
    case 'formal':
      return 'You are writing a professional game recap for a youth football program. Your tone is polished and informative — like an athletic department release written for parents.';
    case 'casual':
      return 'You are a friendly youth football coach writing a quick game recap for parents. Your tone is warm, upbeat, and conversational — like a coach texting parents after a game.';
    case 'coach':
    default:
      return 'You are an experienced youth football coach writing a game summary for parents. Your tone is direct, specific, and encouraging — like a coach talking to parents after the game. Be concise and actionable.';
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const summary = await getGameSummary(id);
    if (!summary) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });

    // -------------------------------------------------------------------------
    // Fetch tone from team communication settings (fallback to 'coach')
    // -------------------------------------------------------------------------
    let reportTone: ReportTone = 'coach';
    if (summary.team_id) {
      const { data: commSettings } = await supabase
        .from('team_communication_settings')
        .select('report_tone')
        .eq('team_id', summary.team_id)
        .maybeSingle();

      const rawTone = (commSettings as { report_tone?: string } | null)?.report_tone;
      if (rawTone === 'formal' || rawTone === 'casual' || rawTone === 'coach') {
        reportTone = rawTone;
      }
    }

    // -------------------------------------------------------------------------
    // Build per-game statistics when a game_id is linked
    // -------------------------------------------------------------------------
    let teamStatsSection = '';
    let bigPlaysSection = '';
    let playerStatsSection = '';

    if (summary.game_id) {
      // Fetch all offensive play instances for this game.
      // Cast through unknown because Supabase's generated types don't know
      // about extended columns like resulted_in_first_down, scoring_type, etc.
      const { data: rawPlays } = await supabase
        .from('play_instances')
        .select(
          'id, down, distance, yard_line, yards_gained, resulted_in_first_down, ' +
          'is_turnover, is_touchdown, scoring_type, result, play_code, is_opponent_play'
        )
        .eq('game_id', summary.game_id)
        .eq('is_opponent_play', false);

      const plays = rawPlays as unknown as Array<{
        id: string;
        down: number | null;
        distance: number | null;
        yard_line: number | null;
        yards_gained: number | null;
        resulted_in_first_down: boolean | null;
        is_turnover: boolean | null;
        is_touchdown: boolean | null;
        scoring_type: string | null;
        result: string | null;
        play_code: string | null;
        is_opponent_play: boolean | null;
      }> | null;

      // Fetch player participation for this game, joined to play instances and players.
      const { data: rawParticipation } = await supabase
        .from('player_participation')
        .select(
          'player_id, participation_type, yards_gained, is_touchdown, is_turnover, result, ' +
          'play_instances!inner(id, down, distance, yards_gained, resulted_in_first_down, ' +
          'is_turnover, is_touchdown, scoring_type, result, yard_line, play_code, is_opponent_play), ' +
          'players(id, first_name, last_name, jersey_number, primary_position)'
        )
        .eq('play_instances.game_id', summary.game_id)
        .eq('play_instances.is_opponent_play', false);

      const participation = rawParticipation as unknown as PlayerParticipationRow[] | null;

      if (plays && plays.length > 0) {
        // ---- Overall team metrics ----
        const totalPlays = plays.length;
        const totalYards = plays.reduce((sum, p) => sum + (p.yards_gained || 0), 0);
        const avgYardsPerPlay = totalPlays > 0 ? totalYards / totalPlays : 0;
        const successfulPlays = plays.filter(p =>
          isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)
        );
        const successRate = totalPlays > 0 ? (successfulPlays.length / totalPlays) * 100 : 0;
        const firstDowns = plays.filter(p => p.resulted_in_first_down).length;
        const turnovers = plays.filter(p => p.is_turnover).length;

        // ---- By down ----
        const firstDownPlays = plays.filter(p => p.down === 1);
        const secondDownPlays = plays.filter(p => p.down === 2);
        const thirdDownPlays = plays.filter(p => p.down === 3);

        const firstDownSuccessRate = firstDownPlays.length > 0
          ? (firstDownPlays.filter(p => isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)).length / firstDownPlays.length) * 100
          : 0;
        const secondDownSuccessRate = secondDownPlays.length > 0
          ? (secondDownPlays.filter(p => isPlaySuccessful(p.down, p.distance, p.yards_gained, p.resulted_in_first_down)).length / secondDownPlays.length) * 100
          : 0;

        const thirdDownConversions = thirdDownPlays.filter(p => p.resulted_in_first_down).length;
        const thirdDownAttempts = thirdDownPlays.length;
        const thirdDownRate = thirdDownAttempts > 0 ? (thirdDownConversions / thirdDownAttempts) * 100 : 0;

        // ---- Red zone ----
        const redZonePlays = plays.filter(p => p.yard_line != null && p.yard_line <= 20);
        const redZoneTDs = redZonePlays.filter(p => isTouchdown(p)).length;
        const redZoneAttempts = redZonePlays.length;
        const redZoneRate = redZoneAttempts > 0 ? (redZoneTDs / redZoneAttempts) * 100 : 0;

        // ---- Big plays ----
        const bigPlays = plays
          .filter(p => (p.yards_gained || 0) >= 15)
          .sort((a, b) => (b.yards_gained || 0) - (a.yards_gained || 0))
          .slice(0, 8);

        teamStatsSection = [
          `- Total plays: ${totalPlays} | Total yards: ${totalYards} | Yards/play: ${avgYardsPerPlay.toFixed(1)}`,
          `- Success rate: ${successRate.toFixed(0)}%`,
          `- 1st down: ${firstDownSuccessRate.toFixed(0)}% success (${firstDownPlays.length} plays)`,
          `- 2nd down: ${secondDownSuccessRate.toFixed(0)}% success (${secondDownPlays.length} plays)`,
          `- 3rd down conversions: ${thirdDownConversions}/${thirdDownAttempts} (${thirdDownRate.toFixed(0)}%)`,
          `- Red zone: ${redZoneTDs}/${redZoneAttempts} TDs (${redZoneRate.toFixed(0)}%)`,
          `- Turnovers: ${turnovers}`,
          `- First downs earned: ${firstDowns}`,
        ].join('\n');

        if (bigPlays.length > 0) {
          // Attempt to annotate big plays with player names from participation data
          const playParticipantMap = new Map<string, string>();
          (participation || []).forEach(row => {
            if (
              row.play_instances &&
              row.players &&
              (row.participation_type === 'rusher' || row.participation_type === 'receiver') &&
              !playParticipantMap.has(row.play_instances.id)
            ) {
              playParticipantMap.set(
                row.play_instances.id,
                `${row.players.first_name} ${row.players.last_name}`
              );
            }
          });

          const bigPlayLines = bigPlays.map(bp => {
            const playerName = playParticipantMap.get(bp.id);
            const tdNote = isTouchdown(bp) ? ' (TD)' : '';
            const downNote = bp.down ? ` on ${bp.down}${bp.down === 1 ? 'st' : bp.down === 2 ? 'nd' : bp.down === 3 ? 'rd' : 'th'} & ${bp.distance ?? '?'}` : '';
            if (playerName) {
              return `  - ${playerName}: ${bp.yards_gained} yds${tdNote}${downNote}`;
            }
            return `  - ${bp.yards_gained} yds${tdNote}${downNote}`;
          });

          bigPlaysSection = bigPlayLines.join('\n');
        }
      }

      // ---- Per-player stats from participation table ----
      if (participation && participation.length > 0) {
        const playerMap = new Map<string, AggregatedPlayerStats>();

        participation.forEach(row => {
          if (!row.players || !row.play_instances) return;
          if (row.play_instances.is_opponent_play) return;

          const playerId = row.player_id;
          if (!playerMap.has(playerId)) {
            playerMap.set(playerId, {
              playerId,
              name: `${row.players.first_name} ${row.players.last_name}`,
              jerseyNumber: row.players.jersey_number ?? null,
              position: row.players.primary_position ?? null,
              rushAttempts: 0, rushYards: 0, rushTDs: 0,
              passAttempts: 0, completions: 0, passYards: 0, passTDs: 0, passInts: 0,
              targets: 0, receptions: 0, recYards: 0, recTDs: 0,
              tackles: 0, tacklesForLoss: 0, sacks: 0, passBreakups: 0, defInts: 0,
            });
          }

          const stats = playerMap.get(playerId)!;
          const play = row.play_instances;
          const ptType = row.participation_type;
          const yards = row.yards_gained ?? play.yards_gained ?? 0;
          const td = row.is_touchdown || isTouchdown(play);
          const isComplete = play.result === 'pass_complete' || play.result === 'complete' || td;
          const isInt = play.result === 'pass_interception' || play.result?.includes('interception');

          switch (ptType) {
            case 'rusher':
              stats.rushAttempts++;
              stats.rushYards += yards;
              if (td) stats.rushTDs++;
              break;
            case 'passer':
              stats.passAttempts++;
              stats.passYards += yards;
              if (isComplete) stats.completions++;
              if (td) stats.passTDs++;
              if (isInt) stats.passInts++;
              break;
            case 'receiver':
              stats.targets++;
              stats.recYards += yards;
              if (isComplete) stats.receptions++;
              if (td) stats.recTDs++;
              break;
            case 'primary_tackle':
            case 'solo_tackle':
            case 'assist_tackle':
              stats.tackles++;
              break;
            case 'tackle_for_loss':
              stats.tacklesForLoss++;
              stats.tackles++;
              break;
            case 'sack':
              stats.sacks++;
              break;
            case 'pass_breakup':
            case 'pbu':
              stats.passBreakups++;
              break;
            case 'interception':
              stats.defInts++;
              break;
          }
        });

        // Score each player to surface the most impactful contributors
        const scoredPlayers = Array.from(playerMap.values())
          .map(s => {
            const offScore = s.rushYards + s.recYards + s.passYards * 0.5 + (s.rushTDs + s.recTDs + s.passTDs) * 50;
            const defScore = s.tackles * 5 + s.tacklesForLoss * 10 + s.sacks * 15 + s.passBreakups * 8 + s.defInts * 20;
            return { stats: s, score: offScore + defScore };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        const statLines = scoredPlayers
          .map(({ stats }) => buildPlayerStatLine(stats))
          .filter((line): line is string => line !== null);

        if (statLines.length > 0) {
          playerStatsSection = statLines.join('\n');
        }
      }
    }

    // -------------------------------------------------------------------------
    // Determine game result label
    // -------------------------------------------------------------------------
    const scoreUs = summary.score_us ?? null;
    const scoreThem = summary.score_them ?? null;
    let gameResultLabel = 'Result unknown';
    if (scoreUs !== null && scoreThem !== null) {
      if (scoreUs > scoreThem) gameResultLabel = 'WIN';
      else if (scoreUs < scoreThem) gameResultLabel = 'LOSS';
      else gameResultLabel = 'TIE';
    }

    const scoreDisplay = scoreUs !== null && scoreThem !== null
      ? `${scoreUs}-${scoreThem}`
      : 'Score not recorded';

    // -------------------------------------------------------------------------
    // Build the prompt
    // -------------------------------------------------------------------------
    const tonePreamble = getTonePreamble(reportTone);

    const hasGameData = teamStatsSection.length > 0;

    const prompt = `${tonePreamble}

RULES:
- Sound like a real coach, not a press release. Use short, direct sentences.
- Lead with the result and 2-3 key takeaways from the game.
- Reference specific stats to back up observations (e.g., "We converted 5 of 8 third downs").
- Highlight 2-3 standout players by name with specific stats when data is available.
- If the team lost, acknowledge it directly but focus on what was done well and what to work on.
- Never blame individual players. Frame struggles as team areas to improve.
- End with 1 sentence about what the team is working on going forward.
- Keep it to 100-150 words. Coaches are concise.

GAME RESULT:
${gameResultLabel} — ${scoreDisplay} vs ${summary.opponent || 'Unknown Opponent'} on ${summary.game_date || 'date not set'}
${hasGameData ? `
TEAM PERFORMANCE:
${teamStatsSection}
` : ''}${bigPlaysSection ? `
BIG PLAYS (15+ yards):
${bigPlaysSection}
` : ''}${playerStatsSection ? `
TOP PLAYER CONTRIBUTIONS:
${playerStatsSection}
` : ''}
COACH'S NOTES:
${summary.coach_raw_notes || 'No additional notes provided'}

Write the game summary now:`;

    // -------------------------------------------------------------------------
    // Generate via Gemini
    // -------------------------------------------------------------------------
    const result = await generateText({
      model: googleAI('gemini-2.5-flash'),
      prompt,
    });

    // Persist the AI draft so the coach can review before publishing
    const updated = await updateGameSummary(id, { aiDraft: result.text });

    return NextResponse.json({ summary: updated, aiDraft: result.text });
  } catch (error) {
    console.error('Error generating AI draft:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
