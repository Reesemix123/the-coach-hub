/**
 * Trend Analysis Concept Resolver
 *
 * Analyzes how performance changes over time:
 * - Game-by-game trends
 * - Run game trends
 * - Pass game trends
 * - Improvement areas
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams, PlayData, TrendData } from '../types';
import { fetchPlayInstances, getUniqueGames } from '../data-fetcher';
import { calculateAggregatedStats } from '../metrics';

/**
 * Resolve trend analysis
 */
export async function resolveTrendAnalysis(
  supabase: SupabaseClient,
  teamId: string,
  params: ConceptParams = {}
): Promise<string> {
  // Fetch all plays (need history for trends)
  const plays = await fetchPlayInstances(supabase, teamId, {});

  if (plays.length === 0) {
    return 'No play data available for trend analysis. Make sure you have tagged some game film.';
  }

  // Get unique games
  const games = getUniqueGames(plays);

  if (games.length < 2) {
    return 'Need at least 2 games of data for trend analysis. Keep tagging film!';
  }

  // Analyze based on play type if specified
  if (params.playType === 'run') {
    return formatRunTrends(plays, games);
  } else if (params.playType === 'pass') {
    return formatPassTrends(plays, games);
  }

  // General trend analysis
  return formatOverallTrends(plays, games);
}

function formatOverallTrends(
  plays: PlayData[],
  games: { id: string; opponent: string; date: string }[]
): string {
  const lines: string[] = [];
  lines.push(`## Performance Trends (${games.length} games)\n`);

  // Calculate per-game stats
  const gameStats: TrendData[] = games.map((game) => {
    const gamePlays = plays.filter((p) => p.game?.id === game.id);
    return {
      period: `vs ${game.opponent}`,
      gameId: game.id,
      opponent: game.opponent,
      stats: calculateAggregatedStats(gamePlays),
    };
  });

  // Reverse to show chronological order (oldest first)
  const chronological = [...gameStats].reverse();

  // Success rate trend
  lines.push('### Success Rate by Game');
  for (const game of chronological) {
    const trend = getTrendIndicator(chronological, game, 'successRate');
    lines.push(`- ${game.period}: ${game.stats.successRate.toFixed(1)}% ${trend}`);
  }
  lines.push('');

  // Yards per play trend
  lines.push('### Yards Per Play by Game');
  for (const game of chronological) {
    const trend = getTrendIndicator(chronological, game, 'avgYards');
    lines.push(`- ${game.period}: ${game.stats.avgYards.toFixed(1)} ${trend}`);
  }
  lines.push('');

  // Calculate overall trend direction
  const recentGames = chronological.slice(-3);
  const earlierGames = chronological.slice(0, -3);

  if (recentGames.length >= 2 && earlierGames.length >= 1) {
    const recentAvgSuccess =
      recentGames.reduce((sum, g) => sum + g.stats.successRate, 0) / recentGames.length;
    const earlierAvgSuccess =
      earlierGames.reduce((sum, g) => sum + g.stats.successRate, 0) / earlierGames.length;

    const diff = recentAvgSuccess - earlierAvgSuccess;

    lines.push('### Trend Summary');
    if (diff > 5) {
      lines.push(`📈 **Improving**: Success rate up ${diff.toFixed(1)} percentage points in recent games`);
    } else if (diff < -5) {
      lines.push(`📉 **Declining**: Success rate down ${Math.abs(diff).toFixed(1)} percentage points in recent games`);
    } else {
      lines.push(`➡️ **Consistent**: Performance steady across the season`);
    }
  }

  return lines.join('\n');
}

function formatRunTrends(
  plays: PlayData[],
  games: { id: string; opponent: string; date: string }[]
): string {
  const runPlays = plays.filter((p) => p.play_type === 'run');

  if (runPlays.length < 10) {
    return 'Not enough run play data for trend analysis.';
  }

  const lines: string[] = [];
  lines.push(`## Run Game Trends (${runPlays.length} plays)\n`);

  // Calculate per-game run stats
  const gameStats = games.map((game) => {
    const gamePlays = runPlays.filter((p) => p.game?.id === game.id);
    return {
      period: `vs ${game.opponent}`,
      stats: calculateAggregatedStats(gamePlays),
    };
  }).filter((g) => g.stats.totalPlays > 0);

  const chronological = [...gameStats].reverse();

  lines.push('### Run Success Rate by Game');
  for (const game of chronological) {
    lines.push(`- ${game.period}: ${game.stats.successRate.toFixed(1)}% (${game.stats.totalPlays} carries, ${game.stats.avgYards.toFixed(1)} YPC)`);
  }
  lines.push('');

  // Explosive runs
  const explosiveRuns = runPlays.filter((p) => p.explosive === true);
  if (explosiveRuns.length > 0) {
    lines.push(`### Explosive Runs (12+ yards): ${explosiveRuns.length} plays`);
  }

  // Recent vs earlier comparison
  if (chronological.length >= 3) {
    const recent = chronological.slice(-2);
    const earlier = chronological.slice(0, -2);

    const recentAvg =
      recent.reduce((sum, g) => sum + g.stats.successRate, 0) / recent.length;
    const earlierAvg =
      earlier.reduce((sum, g) => sum + g.stats.successRate, 0) / earlier.length;

    const diff = recentAvg - earlierAvg;
    lines.push('');
    lines.push('### Run Game Trend');
    if (diff > 5) {
      lines.push(`📈 **Run game improving**: +${diff.toFixed(1)} pts in recent games`);
    } else if (diff < -5) {
      lines.push(`📉 **Run game declining**: ${diff.toFixed(1)} pts in recent games`);
    } else {
      lines.push(`➡️ **Run game steady**: Consistent performance`);
    }
  }

  return lines.join('\n');
}

function formatPassTrends(
  plays: PlayData[],
  games: { id: string; opponent: string; date: string }[]
): string {
  const passPlays = plays.filter((p) =>
    ['pass', 'screen', 'rpo'].includes(p.play_type || '')
  );

  if (passPlays.length < 10) {
    return 'Not enough pass play data for trend analysis.';
  }

  const lines: string[] = [];
  lines.push(`## Pass Game Trends (${passPlays.length} plays)\n`);

  // Calculate per-game pass stats
  const gameStats = games.map((game) => {
    const gamePlays = passPlays.filter((p) => p.game?.id === game.id);
    return {
      period: `vs ${game.opponent}`,
      stats: calculateAggregatedStats(gamePlays),
    };
  }).filter((g) => g.stats.totalPlays > 0);

  const chronological = [...gameStats].reverse();

  lines.push('### Pass Success Rate by Game');
  for (const game of chronological) {
    lines.push(`- ${game.period}: ${game.stats.successRate.toFixed(1)}% (${game.stats.totalPlays} attempts, ${game.stats.avgYards.toFixed(1)} YPA)`);
  }
  lines.push('');

  // Explosive passes
  const explosivePasses = passPlays.filter((p) => p.explosive === true);
  if (explosivePasses.length > 0) {
    lines.push(`### Explosive Passes (16+ yards): ${explosivePasses.length} plays`);
  }

  return lines.join('\n');
}

function getTrendIndicator(
  games: TrendData[],
  current: TrendData,
  metric: 'successRate' | 'avgYards'
): string {
  const idx = games.indexOf(current);
  if (idx <= 0) return '';

  const prev = games[idx - 1];
  const currVal = current.stats[metric];
  const prevVal = prev.stats[metric];
  const diff = currVal - prevVal;

  if (diff > 3) return '↑';
  if (diff < -3) return '↓';
  return '→';
}
