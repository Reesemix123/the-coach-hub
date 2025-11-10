/**
 * Game Strategy Assistant Service
 * Generates rule-based strategic insights for game preparation
 * Future: Will be enhanced with AI capabilities
 */

import { createClient } from '@/utils/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface StrategicInsight {
  category: 'opponent_tendency' | 'own_strength' | 'own_weakness' | 'matchup_advantage' | 'matchup_concern' | 'personnel_consideration';
  title: string;
  description: string;
  priority: 1 | 2 | 3;
  recommendations?: string[];
}

export interface StrategyReport {
  // Opponent Analysis
  opponentTendencies: {
    down: number;
    distanceRange: string;
    runPct: number;
    passPct: number;
    successRate: number;
    playCount: number;
  }[];
  opponentStrengths: string[];
  opponentWeaknesses: string[];

  // Own Team Analysis
  teamStrengths: string[];
  teamWeaknesses: string[];
  topPlays: { code: string; name: string; successRate: number }[];

  // Key Insights (prioritized)
  insights: StrategicInsight[];

  // Preparation Guidance
  strategicQuestions: { category: string; question: string; options?: string[] }[];
  preparationChecklist: { category: string; item: string; priority: 1 | 2 | 3 }[];

  // Metadata
  generatedAt: string;
  dataQuality: 'high' | 'medium' | 'low';
  filmTaggedCount: { own: number; opponent: number };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Generate comprehensive strategy report for upcoming game
 */
export async function generateStrategyReport(
  teamId: string,
  gameId: string
): Promise<StrategyReport> {
  const supabase = await createClient();

  // Get game details
  const { data: game } = await supabase
    .from('games')
    .select('opponent, date')
    .eq('id', gameId)
    .single();

  if (!game) throw new Error('Game not found');

  // Fetch data in parallel
  const [opponentData, ownTeamData, filmQuality] = await Promise.all([
    analyzeOpponent(teamId, game.opponent),
    analyzeOwnTeam(teamId),
    assessFilmQuality(teamId, game.opponent)
  ]);

  // Generate rule-based insights
  const insights = generateInsights(opponentData, ownTeamData);

  // Generate strategic questions
  const questions = generateStrategicQuestions(insights);

  // Generate preparation checklist
  const checklist = generatePreparationChecklist(insights);

  return {
    opponentTendencies: opponentData.tendencies,
    opponentStrengths: opponentData.strengths,
    opponentWeaknesses: opponentData.weaknesses,
    teamStrengths: ownTeamData.strengths,
    teamWeaknesses: ownTeamData.weaknesses,
    topPlays: ownTeamData.topPlays,
    insights: insights.sort((a, b) => a.priority - b.priority),
    strategicQuestions: questions,
    preparationChecklist: checklist,
    generatedAt: new Date().toISOString(),
    dataQuality: filmQuality.quality,
    filmTaggedCount: filmQuality.counts
  };
}

// ============================================================================
// Opponent Analysis
// ============================================================================

async function analyzeOpponent(teamId: string, opponentName: string) {
  const supabase = await createClient();

  // Get opponent game IDs
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', true)
    .ilike('opponent', `%${opponentName}%`)
    .order('date', { ascending: false })
    .limit(3);

  if (!games || games.length === 0) {
    return {
      tendencies: [],
      strengths: ['No opponent film data available'],
      weaknesses: ['Upload and tag opponent film for insights']
    };
  }

  const gameIds = games.map(g => g.id);

  // Get videos for these games
  const { data: videos } = await supabase
    .from('videos')
    .select('id')
    .in('game_id', gameIds);

  if (!videos || videos.length === 0) {
    return {
      tendencies: [],
      strengths: ['No opponent film data available'],
      weaknesses: ['Upload opponent game film']
    };
  }

  const videoIds = videos.map(v => v.id);

  // Get play instances
  const { data: plays } = await supabase
    .from('play_instances')
    .select('down, distance, play_type, yards_gained, success, formation')
    .in('video_id', videoIds);

  if (!plays || plays.length === 0) {
    return {
      tendencies: [],
      strengths: ['No opponent film tagged yet'],
      weaknesses: ['Tag opponent plays for insights']
    };
  }

  // Analyze tendencies by down
  const tendenciesByDown: Record<number, any> = {};

  plays.forEach(play => {
    if (!play.down) return;

    const distanceRange =
      (play.distance || 0) <= 3 ? 'short' :
      (play.distance || 0) <= 7 ? 'medium' : 'long';

    const key = `${play.down}-${distanceRange}`;

    if (!tendenciesByDown[key]) {
      tendenciesByDown[key] = {
        down: play.down,
        distanceRange,
        runs: 0,
        passes: 0,
        totalYards: 0,
        successes: 0,
        total: 0
      };
    }

    const t = tendenciesByDown[key];
    t.total++;
    if (play.play_type === 'run') t.runs++;
    if (play.play_type === 'pass') t.passes++;
    t.totalYards += play.yards_gained || 0;
    if (play.success) t.successes++;
  });

  const tendencies = Object.values(tendenciesByDown).map((t: any) => ({
    down: t.down,
    distanceRange: t.distanceRange,
    runPct: (t.runs / t.total) * 100,
    passPct: (t.passes / t.total) * 100,
    successRate: (t.successes / t.total) * 100,
    playCount: t.total
  }));

  // Extract strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  tendencies.forEach(t => {
    if (t.successRate >= 55) {
      strengths.push(`Effective on ${getDownText(t.down)} & ${t.distanceRange} (${t.successRate.toFixed(0)}% success)`);
    } else if (t.successRate <= 40) {
      weaknesses.push(`Struggles on ${getDownText(t.down)} & ${t.distanceRange} (${t.successRate.toFixed(0)}% success)`);
    }
  });

  // Analyze formation usage
  const formations: Record<string, number> = {};
  plays.forEach(p => {
    if (p.formation) {
      formations[p.formation] = (formations[p.formation] || 0) + 1;
    }
  });

  const topFormation = Object.entries(formations)
    .sort((a, b) => b[1] - a[1])[0];

  if (topFormation && (topFormation[1] / plays.length) >= 0.3) {
    strengths.push(`Favors ${topFormation[0]} formation (${((topFormation[1] / plays.length) * 100).toFixed(0)}% of plays)`);
  }

  return {
    tendencies: tendencies.sort((a, b) => a.down - b.down),
    strengths: strengths.length > 0 ? strengths.slice(0, 5) : ['No clear strengths identified yet - need more data'],
    weaknesses: weaknesses.length > 0 ? weaknesses.slice(0, 5) : ['No clear weaknesses identified yet - need more data']
  };
}

// ============================================================================
// Own Team Analysis
// ============================================================================

async function analyzeOwnTeam(teamId: string) {
  const supabase = await createClient();

  // Get own team's play instances
  const { data: plays } = await supabase
    .from('play_instances')
    .select('play_code, play_type, yards_gained, success, down, resulted_in_first_down, is_turnover, explosive')
    .eq('team_id', teamId)
    .eq('is_opponent_play', false)
    .order('created_at', { ascending: false })
    .limit(200); // Recent 200 plays

  if (!plays || plays.length === 0) {
    return {
      strengths: ['No own team film data available'],
      weaknesses: ['Tag your own game film for insights'],
      topPlays: []
    };
  }

  // Calculate team stats
  const totalPlays = plays.length;
  const runPlays = plays.filter(p => p.play_type === 'run');
  const passPlays = plays.filter(p => p.play_type === 'pass');
  const thirdDownPlays = plays.filter(p => p.down === 3);

  const runSuccessRate = runPlays.length > 0
    ? (runPlays.filter(p => p.success).length / runPlays.length) * 100
    : 0;

  const passSuccessRate = passPlays.length > 0
    ? (passPlays.filter(p => p.success).length / passPlays.length) * 100
    : 0;

  const thirdDownConversion = thirdDownPlays.length > 0
    ? (thirdDownPlays.filter(p => p.resulted_in_first_down).length / thirdDownPlays.length) * 100
    : 0;

  const turnoverRate = (plays.filter(p => p.is_turnover).length / totalPlays) * 100;
  const explosiveRate = (plays.filter(p => p.explosive).length / totalPlays) * 100;

  // Extract strengths
  const strengths: string[] = [];

  if (runSuccessRate >= 55) {
    strengths.push(`Strong run game (${runSuccessRate.toFixed(0)}% success rate)`);
  }
  if (passSuccessRate >= 55) {
    strengths.push(`Effective passing attack (${passSuccessRate.toFixed(0)}% success rate)`);
  }
  if (thirdDownConversion >= 45) {
    strengths.push(`Good 3rd down conversion (${thirdDownConversion.toFixed(0)}%)`);
  }
  if (explosiveRate >= 10) {
    strengths.push(`Big play capability (${explosiveRate.toFixed(0)}% explosive play rate)`);
  }
  if (turnoverRate <= 5) {
    strengths.push(`Good ball security (${turnoverRate.toFixed(1)}% turnover rate)`);
  }

  // Extract weaknesses
  const weaknesses: string[] = [];

  if (runSuccessRate < 40) {
    weaknesses.push(`Struggling run game (${runSuccessRate.toFixed(0)}% success rate)`);
  }
  if (passSuccessRate < 40) {
    weaknesses.push(`Ineffective passing (${passSuccessRate.toFixed(0)}% success rate)`);
  }
  if (thirdDownConversion < 35) {
    weaknesses.push(`Poor 3rd down conversion (${thirdDownConversion.toFixed(0)}%)`);
  }
  if (turnoverRate > 8) {
    weaknesses.push(`Ball security issues (${turnoverRate.toFixed(1)}% turnover rate)`);
  }

  // Analyze play performance
  const playStats: Record<string, { attempts: number; yards: number; successes: number }> = {};

  plays.forEach(p => {
    if (!p.play_code) return;

    if (!playStats[p.play_code]) {
      playStats[p.play_code] = { attempts: 0, yards: 0, successes: 0 };
    }

    playStats[p.play_code].attempts++;
    playStats[p.play_code].yards += p.yards_gained || 0;
    if (p.success) playStats[p.play_code].successes++;
  });

  // Get play names
  const playCodes = Object.keys(playStats);
  const { data: playbookPlays } = await supabase
    .from('playbook_plays')
    .select('play_code, play_name')
    .in('play_code', playCodes);

  const playNames = new Map(playbookPlays?.map(p => [p.play_code, p.play_name]) || []);

  const topPlays = Object.entries(playStats)
    .filter(([_, stats]) => stats.attempts >= 3)
    .map(([code, stats]) => ({
      code,
      name: playNames.get(code) || code,
      successRate: (stats.successes / stats.attempts) * 100
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);

  return {
    strengths: strengths.length > 0 ? strengths : ['Continue building your game film library'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['No major concerns identified'],
    topPlays
  };
}

// ============================================================================
// Generate Insights
// ============================================================================

function generateInsights(opponentData: any, ownTeamData: any): StrategicInsight[] {
  const insights: StrategicInsight[] = [];

  // Opponent tendency insights
  opponentData.tendencies.forEach((t: any) => {
    if (t.runPct >= 70) {
      insights.push({
        category: 'opponent_tendency',
        title: `Opponent is Run-Heavy on ${getDownText(t.down)}`,
        description: `${t.runPct.toFixed(0)}% of opponent's ${getDownText(t.down)} & ${t.distanceRange} plays are runs. Stack the box and force them into passing situations.`,
        priority: 2,
        recommendations: [
          'Use heavier defensive fronts',
          'Bring safeties into the box',
          'Force them into obvious passing downs'
        ]
      });
    } else if (t.passPct >= 70) {
      insights.push({
        category: 'opponent_tendency',
        title: `Opponent is Pass-Heavy on ${getDownText(t.down)}`,
        description: `${t.passPct.toFixed(0)}% of opponent's ${getDownText(t.down)} & ${t.distanceRange} plays are passes. Play more coverage and get pressure.`,
        priority: 2,
        recommendations: [
          'Play more DBs',
          'Get pressure with 4-man rush',
          'Drop 7 into coverage'
        ]
      });
    }
  });

  // Own team strength insights
  if (ownTeamData.topPlays.length > 0) {
    const topPlay = ownTeamData.topPlays[0];
    insights.push({
      category: 'own_strength',
      title: `${topPlay.name} is Highly Effective`,
      description: `${topPlay.successRate.toFixed(0)}% success rate. Feature this play in your game plan.`,
      priority: 1,
      recommendations: [
        `Call ${topPlay.name} in key situations`,
        'Practice this play extensively',
        'Have variations ready'
      ]
    });
  }

  // Matchup insights
  const ownRunStrength = ownTeamData.strengths.some((s: string) => s.includes('run game'));
  const oppRunWeakness = opponentData.weaknesses.some((w: string) => w.toLowerCase().includes('run'));

  if (ownRunStrength && oppRunWeakness) {
    insights.push({
      category: 'matchup_advantage',
      title: 'Run Game Matchup Advantage',
      description: 'Your strong run game vs opponent\'s run defense weakness. Establish the run early.',
      priority: 1,
      recommendations: [
        'Start with run game',
        'Set up play action',
        'Control time of possession'
      ]
    });
  }

  return insights;
}

// ============================================================================
// Strategic Questions
// ============================================================================

function generateStrategicQuestions(insights: StrategicInsight[]) {
  return [
    {
      category: 'offensive_strategy',
      question: 'What is our primary offensive identity for this game?',
      options: ['Power run game', 'Spread passing attack', 'Balanced attack', 'Ball control']
    },
    {
      category: 'offensive_strategy',
      question: 'What are our 3 "must-have" plays for this game?'
    },
    {
      category: 'defensive_strategy',
      question: 'What is our defensive game plan priority?',
      options: ['Stop the run first', 'Take away their best player', 'Force turnovers', 'Limit explosive plays']
    },
    {
      category: 'defensive_strategy',
      question: 'When/how will we bring pressure?',
      options: ['3rd-and-long situations', 'After completion', 'Scripted blitzes', 'Minimal pressure']
    },
    {
      category: 'personnel',
      question: 'Who are our 3 "X-Factor" players to feature?'
    }
  ];
}

// ============================================================================
// Preparation Checklist
// ============================================================================

function generatePreparationChecklist(insights: StrategicInsight[]) {
  const checklist = [
    { category: 'Film Review', item: 'Review and tag all opponent game film', priority: 1 as 1 },
    { category: 'Film Review', item: 'Review own team\'s last 2 games', priority: 1 as 1 },
    { category: 'Playbook', item: 'Trim game plan to 30-40 core plays', priority: 1 as 1 },
    { category: 'Practice', item: 'Script first 15 plays of game', priority: 1 as 1 },
    { category: 'Practice', item: 'Practice goal line and red zone situations', priority: 1 as 1 },
    { category: 'Practice', item: 'Practice two-minute offense', priority: 1 as 1 },
    { category: 'Personnel', item: 'Update depth chart', priority: 2 as 2 },
    { category: 'Personnel', item: 'Check injury status', priority: 1 as 1 },
    { category: 'Special Teams', item: 'Practice field goal protection', priority: 2 as 2 },
    { category: 'Game Plan', item: 'Create situational call sheets', priority: 1 as 1 }
  ];

  // Add insight-specific items
  insights.forEach(insight => {
    if (insight.priority <= 2) {
      checklist.push({
        category: 'Strategic Focus',
        item: `Address: ${insight.title}`,
        priority: insight.priority as 1 | 2
      });
    }
  });

  return checklist;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function assessFilmQuality(teamId: string, opponentName: string) {
  const supabase = await createClient();

  // Count own film tagged
  const { data: ownGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', false)
    .order('date', { ascending: false })
    .limit(3);

  const ownGameIds = ownGames?.map(g => g.id) || [];

  const { data: ownVideos } = await supabase
    .from('videos')
    .select('id')
    .in('game_id', ownGameIds);

  const ownVideoIds = ownVideos?.map(v => v.id) || [];

  const { count: ownCount } = await supabase
    .from('play_instances')
    .select('id', { count: 'exact', head: true })
    .in('video_id', ownVideoIds);

  // Count opponent film tagged
  const { data: oppGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', true)
    .ilike('opponent', `%${opponentName}%`);

  const oppGameIds = oppGames?.map(g => g.id) || [];

  const { data: oppVideos } = await supabase
    .from('videos')
    .select('id')
    .in('game_id', oppGameIds);

  const oppVideoIds = oppVideos?.map(v => v.id) || [];

  const { count: oppCount } = await supabase
    .from('play_instances')
    .select('id', { count: 'exact', head: true })
    .in('video_id', oppVideoIds);

  const own = ownCount || 0;
  const opponent = oppCount || 0;

  let quality: 'high' | 'medium' | 'low' = 'low';
  if (own >= 100 && opponent >= 50) {
    quality = 'high';
  } else if (own >= 50 && opponent >= 30) {
    quality = 'medium';
  }

  return {
    quality,
    counts: { own, opponent }
  };
}

function getDownText(down: number): string {
  const map: Record<number, string> = {
    1: '1st down',
    2: '2nd down',
    3: '3rd down',
    4: '4th down'
  };
  return map[down] || `${down} down`;
}

// ============================================================================
// Database Persistence
// ============================================================================

/**
 * Save strategy report to database (insights, questions, checklist)
 */
export async function saveStrategyReport(
  teamId: string,
  gameId: string,
  report: StrategyReport
): Promise<void> {
  const supabase = await createClient();

  // Get game opponent name for insights
  const { data: game } = await supabase
    .from('games')
    .select('opponent')
    .eq('id', gameId)
    .single();

  const opponentName = game?.opponent || '';

  // Clear existing data for this game (allow regeneration)
  await Promise.all([
    supabase.from('strategic_insights').delete().eq('team_id', teamId).eq('game_id', gameId),
    supabase.from('strategic_questions').delete().eq('team_id', teamId).eq('game_id', gameId),
    supabase.from('preparation_checklist').delete().eq('team_id', teamId).eq('game_id', gameId)
  ]);

  // Save insights
  if (report.insights.length > 0) {
    const insightsToInsert = report.insights.map((insight) => ({
      team_id: teamId,
      game_id: gameId,
      opponent_name: opponentName,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      confidence_score: report.dataQuality === 'high' ? 0.9 : report.dataQuality === 'medium' ? 0.7 : 0.5,
      supporting_stats: {
        filmTaggedCount: report.filmTaggedCount,
        recommendations: insight.recommendations || []
      },
      generation_method: 'rule_based',
      is_active: true
    }));

    const { error: insightsError } = await supabase
      .from('strategic_insights')
      .insert(insightsToInsert);

    if (insightsError) {
      console.error('Error saving insights:', insightsError);
      throw new Error('Failed to save strategic insights');
    }
  }

  // Save strategic questions
  if (report.strategicQuestions.length > 0) {
    const questionsToInsert = report.strategicQuestions.map((q, idx) => ({
      team_id: teamId,
      game_id: gameId,
      category: q.category,
      question_text: q.question,
      sort_order: idx + 1,
      response_options: q.options || null
    }));

    const { error: questionsError } = await supabase
      .from('strategic_questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Error saving questions:', questionsError);
      throw new Error('Failed to save strategic questions');
    }
  }

  // Save preparation checklist
  if (report.preparationChecklist.length > 0) {
    const checklistToInsert = report.preparationChecklist.map((item, idx) => ({
      team_id: teamId,
      game_id: gameId,
      category: item.category,
      item_text: item.item,
      priority: item.priority,
      sort_order: idx + 1,
      is_auto_generated: true,
      is_completed: false
    }));

    const { error: checklistError } = await supabase
      .from('preparation_checklist')
      .insert(checklistToInsert);

    if (checklistError) {
      console.error('Error saving checklist:', checklistError);
      throw new Error('Failed to save preparation checklist');
    }
  }
}

/**
 * Check if strategy report already exists for a game
 */
export async function strategyReportExists(teamId: string, gameId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('strategic_insights')
    .select('id')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .limit(1);

  return !error && data && data.length > 0;
}
