/**
 * Play Drill Candidates Concept Resolver
 *
 * Identifies plays that need practice focus based on performance data.
 * Separates "needs drilling" from "consider removing" based on improvement potential.
 * Includes diagnostic information about WHY plays are struggling.
 */

import type { PlayData, PlayerData } from '../types';

export interface PlayDrillCandidate {
  playCode: string;
  playName: string;
  formation: string;
  playType: string;
  successRate: number;
  totalAttempts: number;
  avgYards: number;
  category: 'needs_drilling' | 'consider_removing';
  issues: string[];
  recommendation: string;
}

export interface PlayDrillCandidatesResult {
  summary: string;
  needsDrilling: PlayDrillCandidate[];
  considerRemoving: PlayDrillCandidate[];
  workingWell: Array<{
    playCode: string;
    playName: string;
    successRate: number;
    totalAttempts: number;
  }>;
  practiceRecommendations: string[];
}

interface PlayStats {
  playCode: string;
  playName: string;
  formation: string;
  playType: string;
  totalAttempts: number;
  successfulPlays: number;
  totalYards: number;
  avgYards: number;
  successRate: number;
  olBreakdowns: number;
  qbIssues: number;
  skillMistakes: number;
  plays: PlayData[];
}

/**
 * Analyze why a play is struggling
 */
function diagnosePlayIssues(stats: PlayStats, players: PlayerData[]): string[] {
  const issues: string[] = [];
  const plays = stats.plays;

  // Check for OL breakdowns
  const olPlays = plays.filter((p) => p.lt_id || p.lg_id || p.c_id || p.rg_id || p.rt_id);
  if (olPlays.length > 0) {
    const positions = [
      { name: 'LT', resultKey: 'lt_block_result' as keyof PlayData },
      { name: 'LG', resultKey: 'lg_block_result' as keyof PlayData },
      { name: 'C', resultKey: 'c_block_result' as keyof PlayData },
      { name: 'RG', resultKey: 'rg_block_result' as keyof PlayData },
      { name: 'RT', resultKey: 'rt_block_result' as keyof PlayData },
    ];

    for (const pos of positions) {
      const posPlays = olPlays.filter((p) => p[pos.resultKey]);
      const losses = posPlays.filter((p) => p[pos.resultKey] === 'loss').length;
      if (posPlays.length >= 3 && losses / posPlays.length > 0.5) {
        issues.push(`${pos.name} blocking breakdown (${Math.round((losses / posPlays.length) * 100)}% loss rate)`);
      }
    }
  }

  // Check for consistent negative/zero yardage
  const negativeOrZero = plays.filter((p) => (p.yards_gained ?? 0) <= 0).length;
  if (negativeOrZero / plays.length > 0.4) {
    issues.push(`Frequently stopped at or behind LOS (${Math.round((negativeOrZero / plays.length) * 100)}%)`);
  }

  // Check for turnovers
  const turnovers = plays.filter((p) => p.result === 'turnover' || p.result === 'interception' || p.result === 'fumble').length;
  if (turnovers > 0) {
    issues.push(`Ball security issues (${turnovers} turnover${turnovers > 1 ? 's' : ''})`);
  }

  // Check for situational failures
  const thirdDownPlays = plays.filter((p) => p.down === 3);
  if (thirdDownPlays.length >= 2) {
    const thirdDownSuccess = thirdDownPlays.filter((p) => p.success === true).length;
    if (thirdDownSuccess / thirdDownPlays.length < 0.3) {
      issues.push(`Poor 3rd down conversion (${thirdDownSuccess}/${thirdDownPlays.length})`);
    }
  }

  // If no specific issues found, provide general assessment
  if (issues.length === 0) {
    if (stats.avgYards < 2) {
      issues.push('Low yards per attempt - execution issues');
    } else {
      issues.push('Inconsistent execution');
    }
  }

  return issues;
}

/**
 * Determine if play should be drilled or removed
 */
function categorizePlay(stats: PlayStats, issues: string[]): 'needs_drilling' | 'consider_removing' {
  // Consider removing if:
  // 1. Very low success rate (<20%) with enough attempts
  // 2. Multiple systematic issues
  // 3. Ball security problems

  const hasBallSecurityIssues = issues.some((i) => i.includes('Ball security') || i.includes('turnover'));
  const hasMultipleOLIssues = issues.filter((i) => i.includes('breakdown')).length >= 2;
  const veryLowSuccess = stats.successRate < 20;

  if (stats.totalAttempts >= 5) {
    if (veryLowSuccess && hasMultipleOLIssues) {
      return 'consider_removing';
    }
    if (hasBallSecurityIssues && stats.successRate < 30) {
      return 'consider_removing';
    }
    if (stats.successRate < 15) {
      return 'consider_removing';
    }
  }

  return 'needs_drilling';
}

/**
 * Drill suggestions mapped to common issues
 */
const DRILL_SUGGESTIONS: Record<string, { drill: string; focus: string }> = {
  // OL blocking issues
  'LT_breakdown': { drill: 'Drive Blocking', focus: 'pad level and hip explosion on the edge' },
  'LG_breakdown': { drill: 'Combo Blocks', focus: 'double-team timing and climbing to linebacker' },
  'C_breakdown': { drill: 'Reach Blocks', focus: 'first-step quickness and head placement' },
  'RG_breakdown': { drill: 'Pull & Trap', focus: 'pull technique and finding the hole' },
  'RT_breakdown': { drill: 'Pass Set Drill', focus: 'kick slide and hand punch timing' },
  'OL_general': { drill: 'Board Drill', focus: 'footwork and sustaining blocks' },
  // Ball security
  'ball_security': { drill: 'Gauntlet Drill', focus: 'high-and-tight ball carry through traffic' },
  // Timing/execution
  'timing': { drill: 'Tempo Reps', focus: 'running at 75% speed with proper timing' },
  'execution': { drill: 'Install Walk-Through', focus: 'assignment clarity and communication' },
  // Pass-specific
  'coverage': { drill: 'Route Adjustments', focus: 'reading coverage and finding soft spots' },
  'pressure': { drill: 'Hot Route Drill', focus: 'quick release vs pressure looks' },
};

/**
 * Generate recommendation for a struggling play with specific drill
 */
function generateRecommendation(stats: PlayStats, issues: string[], category: 'needs_drilling' | 'consider_removing'): string {
  if (category === 'consider_removing') {
    return `Review whether this play fits your personnel - ${issues[0]?.toLowerCase() || 'poor execution'}`;
  }

  // Find the most relevant drill based on issues
  const olIssue = issues.find((i) => i.includes('breakdown'));
  if (olIssue) {
    const pos = olIssue.match(/^[A-Z]+/)?.[0] || 'OL';
    const suggestion = DRILL_SUGGESTIONS[`${pos}_breakdown`] || DRILL_SUGGESTIONS['OL_general'];
    return `**${suggestion.drill}** - ${suggestion.focus}`;
  }

  if (issues.some((i) => i.includes('Ball security') || i.includes('turnover'))) {
    const suggestion = DRILL_SUGGESTIONS['ball_security'];
    return `**${suggestion.drill}** - ${suggestion.focus}`;
  }

  if (issues.some((i) => i.includes('behind LOS') || i.includes('stopped'))) {
    const suggestion = DRILL_SUGGESTIONS['timing'];
    return `**${suggestion.drill}** - ${suggestion.focus}`;
  }

  const suggestion = DRILL_SUGGESTIONS['execution'];
  return `**${suggestion.drill}** - ${suggestion.focus}`;
}

/**
 * Resolve play drill candidates for practice planning
 */
export function resolvePlayDrillCandidates(
  plays: PlayData[],
  players: PlayerData[],
  options: { successThreshold?: number; minAttempts?: number } = {}
): PlayDrillCandidatesResult {
  const { successThreshold = 40, minAttempts = 3 } = options;

  // Filter to team offensive plays with play codes
  const teamPlays = plays.filter(
    (p) => p.is_opponent_play !== true && p.play_code
  );

  if (teamPlays.length === 0) {
    return {
      summary: 'No play data available. Tag game film with plays to identify drill candidates.',
      needsDrilling: [],
      considerRemoving: [],
      workingWell: [],
      practiceRecommendations: ['Tag game film with play codes to unlock play analysis'],
    };
  }

  // Group plays by play_code
  const playsByCode = new Map<string, PlayData[]>();
  for (const play of teamPlays) {
    const code = play.play_code!;
    if (!playsByCode.has(code)) {
      playsByCode.set(code, []);
    }
    playsByCode.get(code)!.push(play);
  }

  // Calculate stats for each play
  const playStats: PlayStats[] = [];

  for (const [playCode, codePlays] of playsByCode) {
    if (codePlays.length < minAttempts) continue;

    const playbook = codePlays[0]?.playbook_play;
    const successfulPlays = codePlays.filter((p) => p.success === true).length;
    const totalYards = codePlays.reduce((sum, p) => sum + (p.yards_gained ?? 0), 0);

    playStats.push({
      playCode,
      playName: playbook?.play_name || playCode,
      formation: playbook?.attributes?.formation || 'Unknown',
      playType: playbook?.attributes?.playType || codePlays[0]?.play_type || 'Unknown',
      totalAttempts: codePlays.length,
      successfulPlays,
      totalYards,
      avgYards: totalYards / codePlays.length,
      successRate: (successfulPlays / codePlays.length) * 100,
      olBreakdowns: 0,
      qbIssues: 0,
      skillMistakes: 0,
      plays: codePlays,
    });
  }

  // Separate into categories
  const needsDrilling: PlayDrillCandidate[] = [];
  const considerRemoving: PlayDrillCandidate[] = [];
  const workingWell: Array<{
    playCode: string;
    playName: string;
    successRate: number;
    totalAttempts: number;
  }> = [];

  for (const stats of playStats) {
    if (stats.successRate >= 60) {
      // Play is working well
      workingWell.push({
        playCode: stats.playCode,
        playName: stats.playName,
        successRate: Math.round(stats.successRate),
        totalAttempts: stats.totalAttempts,
      });
    } else if (stats.successRate < successThreshold) {
      // Play needs attention
      const issues = diagnosePlayIssues(stats, players);
      const category = categorizePlay(stats, issues);
      const recommendation = generateRecommendation(stats, issues, category);

      const candidate: PlayDrillCandidate = {
        playCode: stats.playCode,
        playName: stats.playName,
        formation: stats.formation,
        playType: stats.playType,
        successRate: Math.round(stats.successRate),
        totalAttempts: stats.totalAttempts,
        avgYards: Math.round(stats.avgYards * 10) / 10,
        category,
        issues,
        recommendation,
      };

      if (category === 'needs_drilling') {
        needsDrilling.push(candidate);
      } else {
        considerRemoving.push(candidate);
      }
    }
  }

  // Sort by success rate (lowest first)
  needsDrilling.sort((a, b) => a.successRate - b.successRate);
  considerRemoving.sort((a, b) => a.successRate - b.successRate);
  workingWell.sort((a, b) => b.successRate - a.successRate);

  // Generate practice recommendations with actionable drill suggestions
  const practiceRecommendations: string[] = [];

  if (needsDrilling.length > 0) {
    const topPriority = needsDrilling.slice(0, 3);
    for (const play of topPriority) {
      // Format: "Play Name (X% success): Issue → Drill recommendation"
      const displayName = play.playName !== play.playCode ? play.playName : play.playCode;
      const issue = play.issues[0] || 'execution issues';
      // Create actionable recommendation
      practiceRecommendations.push(
        `${displayName} (${play.successRate}% success): ${issue} → ${play.recommendation}`
      );
    }
  }

  if (considerRemoving.length > 0) {
    const playNames = considerRemoving.slice(0, 2).map(p =>
      p.playName !== p.playCode ? p.playName : p.playCode
    ).join(', ');
    practiceRecommendations.push(
      `Consider simplifying or removing: ${playNames}${considerRemoving.length > 2 ? ` (+${considerRemoving.length - 2} more)` : ''}`
    );
  }

  if (practiceRecommendations.length === 0) {
    practiceRecommendations.push('All plays performing well - focus on refining timing and execution');
  }

  // Build summary
  let summary = `**Play Performance Analysis (${playStats.length} plays analyzed)**\n\n`;

  if (needsDrilling.length > 0) {
    summary += `**Needs Drilling (${needsDrilling.length}):**\n`;
    for (const play of needsDrilling.slice(0, 5)) {
      summary += `• ${play.playName} (${play.playCode}): ${play.successRate}% success\n`;
      summary += `  - ${play.issues[0] || 'Execution issues'}\n`;
    }
    if (needsDrilling.length > 5) {
      summary += `  ... and ${needsDrilling.length - 5} more\n`;
    }
    summary += '\n';
  }

  if (considerRemoving.length > 0) {
    summary += `**Consider Removing (${considerRemoving.length}):**\n`;
    for (const play of considerRemoving) {
      summary += `• ${play.playName} (${play.playCode}): ${play.successRate}% success\n`;
      summary += `  - ${play.issues[0] || 'Beyond skill level'}\n`;
    }
    summary += '\n';
  }

  if (workingWell.length > 0) {
    summary += `**Working Well (${workingWell.length}):**\n`;
    for (const play of workingWell.slice(0, 3)) {
      summary += `• ${play.playName}: ${play.successRate}% success (${play.totalAttempts} attempts)\n`;
    }
    if (workingWell.length > 3) {
      summary += `  ... and ${workingWell.length - 3} more\n`;
    }
  }

  return {
    summary,
    needsDrilling,
    considerRemoving,
    workingWell,
    practiceRecommendations,
  };
}
