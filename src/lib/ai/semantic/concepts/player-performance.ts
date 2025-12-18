/**
 * Player Performance Concept Resolver
 *
 * Analyzes individual player performance:
 * - Rushing stats for RBs
 * - Receiving stats for WRs
 * - Overall player rankings
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams, PlayData, PlayerStats } from '../types';
import { fetchPlayInstances, fetchPlayers, findPlayerByNumber, filterToRecentGames } from '../data-fetcher';
import { calculateAggregatedStats } from '../metrics';

/**
 * Resolve player performance analysis
 */
export async function resolvePlayerPerformance(
  supabase: SupabaseClient,
  teamId: string,
  params: ConceptParams = {}
): Promise<string> {
  // Fetch play data
  let plays = await fetchPlayInstances(supabase, teamId, {});

  // Filter to recent games if requested
  if (params.timeframe === 'recent') {
    plays = filterToRecentGames(plays, 2);
  }

  if (plays.length === 0) {
    return 'No play data available for player analysis. Make sure you have tagged some game film with player attributions.';
  }

  // If a specific player number is requested
  if (params.playerNumber) {
    const player = await findPlayerByNumber(supabase, teamId, params.playerNumber);
    if (!player) {
      return `No player found with jersey #${params.playerNumber}.`;
    }
    return formatSinglePlayerAnalysis(plays, player.id, player);
  }

  // Fetch roster for name lookups
  const roster = await fetchPlayers(supabase, teamId);
  const playerMap = new Map(roster.map((p) => [p.id, p]));

  // General player analysis
  if (params.playType === 'run') {
    return formatRushingLeaders(plays, playerMap);
  }

  return formatPlayerOverview(plays, playerMap);
}

function formatSinglePlayerAnalysis(
  plays: PlayData[],
  playerId: string,
  player: { jersey_number: string; first_name: string | null; last_name: string | null }
): string {
  const lines: string[] = [];
  const playerName = `#${player.jersey_number} ${player.first_name || ''} ${player.last_name || ''}`.trim();

  // Get plays where this player was involved
  const carrierPlays = plays.filter((p) => p.ball_carrier_id === playerId);
  const targetPlays = plays.filter((p) => p.target_id === playerId);
  const qbPlays = plays.filter((p) => p.qb_id === playerId);

  lines.push(`## ${playerName} Performance\n`);

  // Rushing stats (as ball carrier on runs)
  const rushingPlays = carrierPlays.filter((p) => p.play_type === 'run');
  if (rushingPlays.length > 0) {
    const stats = calculateAggregatedStats(rushingPlays);
    lines.push('### Rushing');
    lines.push(`- Carries: ${stats.totalPlays}`);
    lines.push(`- Yards: ${stats.totalYards}`);
    lines.push(`- YPC: ${stats.avgYards.toFixed(1)}`);
    lines.push(`- Success Rate: ${stats.successRate.toFixed(1)}%`);
    if (stats.explosivePlays > 0) {
      lines.push(`- Explosive Runs (12+ yds): ${stats.explosivePlays}`);
    }
    lines.push('');
  }

  // Receiving stats (as target on passes)
  const receivingPlays = targetPlays.filter((p) =>
    ['pass', 'screen', 'rpo'].includes(p.play_type || '')
  );
  if (receivingPlays.length > 0) {
    const stats = calculateAggregatedStats(receivingPlays);
    const completions = receivingPlays.filter((p) => (p.yards_gained ?? 0) > 0).length;
    lines.push('### Receiving');
    lines.push(`- Targets: ${stats.totalPlays}`);
    lines.push(`- Receptions: ${completions} (${Math.round((completions / stats.totalPlays) * 100)}%)`);
    lines.push(`- Yards: ${stats.totalYards}`);
    lines.push(`- YPT: ${stats.avgYards.toFixed(1)}`);
    if (stats.explosivePlays > 0) {
      lines.push(`- Explosive Catches (16+ yds): ${stats.explosivePlays}`);
    }
    lines.push('');
  }

  // QB stats
  if (qbPlays.length > 0) {
    const passPlays = qbPlays.filter((p) =>
      ['pass', 'screen', 'rpo'].includes(p.play_type || '')
    );
    const rushPlays = qbPlays.filter((p) => p.play_type === 'run');

    if (passPlays.length > 0) {
      const stats = calculateAggregatedStats(passPlays);
      lines.push('### Passing');
      lines.push(`- Attempts: ${stats.totalPlays}`);
      lines.push(`- Yards: ${stats.totalYards}`);
      lines.push(`- YPA: ${stats.avgYards.toFixed(1)}`);
      lines.push(`- Success Rate: ${stats.successRate.toFixed(1)}%`);
      lines.push('');
    }

    if (rushPlays.length > 0) {
      const stats = calculateAggregatedStats(rushPlays);
      lines.push('### QB Rushing');
      lines.push(`- Carries: ${stats.totalPlays}`);
      lines.push(`- Yards: ${stats.totalYards}`);
      lines.push(`- YPC: ${stats.avgYards.toFixed(1)}`);
      lines.push('');
    }
  }

  if (carrierPlays.length === 0 && targetPlays.length === 0 && qbPlays.length === 0) {
    lines.push('No recorded plays found for this player. Make sure plays are tagged with player attributions.');
  }

  return lines.join('\n');
}

function formatRushingLeaders(
  plays: PlayData[],
  playerMap: Map<string, { jersey_number: string; first_name: string | null; last_name: string | null }>
): string {
  const runPlays = plays.filter((p) => p.play_type === 'run' && p.ball_carrier_id);

  if (runPlays.length === 0) {
    return 'No rushing plays with player attributions found.';
  }

  const lines: string[] = [];
  lines.push(`## Rushing Leaders (${runPlays.length} carries)\n`);

  // Group by ball carrier
  const carrierStats = calculatePlayerStats(runPlays, 'ball_carrier_id', playerMap);

  // Sort by yards
  const sortedByYards = [...carrierStats].sort((a, b) => b.totalYards - a.totalYards);

  lines.push('### By Total Yards');
  for (const player of sortedByYards.slice(0, 5)) {
    lines.push(`- **${player.playerName}**: ${player.totalYards} yds (${player.totalPlays} car, ${player.avgYards.toFixed(1)} YPC)`);
  }
  lines.push('');

  // Sort by efficiency (min 5 carries)
  const efficient = carrierStats
    .filter((p) => p.totalPlays >= 5)
    .sort((a, b) => b.successRate - a.successRate);

  if (efficient.length > 0) {
    lines.push('### Most Efficient (min 5 carries)');
    for (const player of efficient.slice(0, 3)) {
      lines.push(`- **${player.playerName}**: ${player.successRate.toFixed(1)}% success (${player.totalPlays} car, ${player.avgYards.toFixed(1)} YPC)`);
    }
  }

  return lines.join('\n');
}

function formatPlayerOverview(
  plays: PlayData[],
  playerMap: Map<string, { jersey_number: string; first_name: string | null; last_name: string | null }>
): string {
  const lines: string[] = [];
  lines.push(`## Player Performance Overview\n`);

  // Rushing leaders
  const runPlays = plays.filter((p) => p.play_type === 'run' && p.ball_carrier_id);
  if (runPlays.length > 0) {
    const carrierStats = calculatePlayerStats(runPlays, 'ball_carrier_id', playerMap);
    const topRusher = [...carrierStats].sort((a, b) => b.totalYards - a.totalYards)[0];

    if (topRusher) {
      lines.push('### Top Rusher');
      lines.push(`**${topRusher.playerName}**: ${topRusher.totalYards} yds on ${topRusher.totalPlays} carries (${topRusher.avgYards.toFixed(1)} YPC, ${topRusher.successRate.toFixed(1)}% success)`);
      lines.push('');
    }
  }

  // Receiving leaders (where target is tracked)
  const passPlays = plays.filter(
    (p) => ['pass', 'screen', 'rpo'].includes(p.play_type || '') && p.target_id
  );
  if (passPlays.length > 0) {
    const targetStats = calculatePlayerStats(passPlays, 'target_id', playerMap);
    const topReceiver = [...targetStats].sort((a, b) => b.totalYards - a.totalYards)[0];

    if (topReceiver) {
      lines.push('### Top Receiver');
      lines.push(`**${topReceiver.playerName}**: ${topReceiver.totalYards} yds on ${topReceiver.totalPlays} targets (${topReceiver.avgYards.toFixed(1)} YPT)`);
      lines.push('');
    }
  }

  // Most efficient players (combined)
  const allPlays = plays.filter((p) => p.ball_carrier_id || p.target_id);
  if (allPlays.length > 0) {
    const combinedStats = calculateCombinedPlayerStats(allPlays, playerMap);
    const efficient = combinedStats
      .filter((p) => p.totalPlays >= 8)
      .sort((a, b) => b.successRate - a.successRate);

    if (efficient.length > 0) {
      lines.push('### Most Efficient (min 8 touches)');
      for (const player of efficient.slice(0, 3)) {
        lines.push(`- **${player.playerName}**: ${player.successRate.toFixed(1)}% success (${player.totalPlays} touches, ${player.totalYards} yds)`);
      }
    }
  }

  return lines.join('\n');
}

function calculatePlayerStats(
  plays: PlayData[],
  playerField: 'ball_carrier_id' | 'target_id' | 'qb_id',
  playerMap: Map<string, { jersey_number: string; first_name: string | null; last_name: string | null }>
): PlayerStats[] {
  const playerPlays = new Map<string, PlayData[]>();

  for (const play of plays) {
    const playerId = play[playerField];
    if (!playerId) continue;

    if (!playerPlays.has(playerId)) {
      playerPlays.set(playerId, []);
    }
    playerPlays.get(playerId)!.push(play);
  }

  const stats: PlayerStats[] = [];

  for (const [playerId, playerPlayList] of playerPlays) {
    const agg = calculateAggregatedStats(playerPlayList);
    const player = playerMap.get(playerId);
    const playerName = player
      ? `#${player.jersey_number} ${player.first_name || ''} ${player.last_name || ''}`.trim()
      : `Player ${playerId.slice(0, 8)}`;

    stats.push({
      playerId,
      playerName,
      jerseyNumber: player?.jersey_number || 'Unknown',
      ...agg,
    });
  }

  return stats;
}

function calculateCombinedPlayerStats(
  plays: PlayData[],
  playerMap: Map<string, { jersey_number: string; first_name: string | null; last_name: string | null }>
): PlayerStats[] {
  const playerPlays = new Map<string, PlayData[]>();

  for (const play of plays) {
    // Count as ball carrier for runs, target for passes
    const playerId =
      play.play_type === 'run' ? play.ball_carrier_id : play.target_id;
    if (!playerId) continue;

    if (!playerPlays.has(playerId)) {
      playerPlays.set(playerId, []);
    }
    playerPlays.get(playerId)!.push(play);
  }

  return Array.from(playerPlays.entries()).map(([playerId, playerPlayList]) => {
    const agg = calculateAggregatedStats(playerPlayList);
    const player = playerMap.get(playerId);
    const playerName = player
      ? `#${player.jersey_number} ${player.first_name || ''} ${player.last_name || ''}`.trim()
      : `Player ${playerId.slice(0, 8)}`;

    return {
      playerId,
      playerName,
      jerseyNumber: player?.jersey_number || 'Unknown',
      ...agg,
    };
  });
}
