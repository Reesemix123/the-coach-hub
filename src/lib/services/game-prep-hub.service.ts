/**
 * Game Prep Hub Service
 * Handles game preparation planning, insights, prompts, and tasks
 */

import { createClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type PrepPlanStatus = 'not_started' | 'in_progress' | 'ready';
export type InsightCategory = 'opponent_tendency' | 'matchup_advantage' | 'matchup_concern' | 'own_strength' | 'own_weakness' | 'situational' | 'personnel';
export type PromptCategory = 'offensive_identity' | 'defensive_identity' | 'special_teams_identity' | 'situational' | 'personnel' | 'adjustments';
export type LinkedStation = 'film_review' | 'game_plan' | 'practice' | 'personnel' | 'playbook';
export type TaskSourceType = 'template' | 'auto' | 'manual';
export type ResponseType = 'text' | 'single_choice' | 'multi_choice' | 'play_select';

export interface PrepPlan {
  id: string;
  team_id: string;
  game_id: string;
  status: PrepPlanStatus;
  overall_readiness: number;
  insights_reviewed: number;
  insights_total: number;
  tasks_completed: number;
  tasks_total: number;
  prompts_answered: number;
  prompts_total: number;
  general_notes: string | null;
  offensive_notes: string | null;
  defensive_notes: string | null;
  special_teams_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrepInsight {
  id: string;
  prep_plan_id: string;
  category: InsightCategory;
  priority: number;
  title: string;
  description: string;
  data_json: Record<string, unknown> | null;
  is_reviewed: boolean;
  coach_notes: string | null;
  suggested_action: string | null;
  linked_station: LinkedStation | null;
  created_at: string;
}

export interface PrepPrompt {
  id: string;
  prep_plan_id: string;
  category: PromptCategory;
  question_text: string;
  help_text: string | null;
  sort_order: number;
  response_type: ResponseType;
  response_options: string[] | null;
  response_text: string | null;
  response_plays: string[] | null;
  responded_at: string | null;
  created_at: string;
}

export interface PrepTask {
  id: string;
  prep_plan_id: string;
  title: string;
  description: string | null;
  priority: number;
  sort_order: number;
  linked_station: LinkedStation;
  link_href: string | null;
  is_completed: boolean;
  completed_at: string | null;
  source_type: TaskSourceType;
  source_insight_id: string | null;
  created_at: string;
}

export interface PrepPlanWithDetails extends PrepPlan {
  insights: PrepInsight[];
  prompts: PrepPrompt[];
  tasks: PrepTask[];
}

export interface GameReadinessData {
  overallReadiness: number;
  filmProgress: number;
  gamePlanProgress: number;
  tasksProgress: number;
  promptsProgress: number;
  criticalInsightsCount: number;
  daysUntilGame: number | null;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get or create a prep plan for a specific game
 */
export async function getOrCreatePrepPlan(teamId: string, gameId: string): Promise<PrepPlan> {
  const supabase = await createClient();

  // Try to get existing prep plan
  const { data: existingPlan } = await supabase
    .from('prep_plans')
    .select('*')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .single();

  if (existingPlan) {
    return existingPlan as PrepPlan;
  }

  // Create new prep plan
  const { data: newPlan, error } = await supabase
    .from('prep_plans')
    .insert({
      team_id: teamId,
      game_id: gameId,
      status: 'not_started'
    })
    .select()
    .single();

  if (error) throw error;

  // Initialize prompts and tasks from templates
  await Promise.all([
    initializePromptsFromTemplates(supabase, newPlan.id),
    initializeTasksFromTemplates(supabase, newPlan.id, teamId, gameId)
  ]);

  // Update counts
  const updatedPlan = await updatePrepPlanCounts(supabase, newPlan.id);

  return updatedPlan;
}

/**
 * Get prep plan with all details (insights, prompts, tasks)
 */
export async function getPrepPlanWithDetails(prepPlanId: string): Promise<PrepPlanWithDetails | null> {
  const supabase = await createClient();

  const [planResult, insightsResult, promptsResult, tasksResult] = await Promise.all([
    supabase.from('prep_plans').select('*').eq('id', prepPlanId).single(),
    supabase.from('prep_insights').select('*').eq('prep_plan_id', prepPlanId).order('priority', { ascending: true }),
    supabase.from('prep_prompts').select('*').eq('prep_plan_id', prepPlanId).order('sort_order', { ascending: true }),
    supabase.from('prep_tasks').select('*').eq('prep_plan_id', prepPlanId).order('priority', { ascending: true }).order('sort_order', { ascending: true })
  ]);

  if (!planResult.data) return null;

  return {
    ...planResult.data,
    insights: insightsResult.data || [],
    prompts: promptsResult.data || [],
    tasks: tasksResult.data || []
  } as PrepPlanWithDetails;
}

/**
 * Get prep plan by team and game IDs
 */
export async function getPrepPlanByGame(teamId: string, gameId: string): Promise<PrepPlanWithDetails | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('prep_plans')
    .select('*')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .single();

  if (!plan) return null;

  return getPrepPlanWithDetails(plan.id);
}

// ============================================================================
// Notes Functions
// ============================================================================

type NotesCategory = 'general' | 'offensive' | 'defensive' | 'special_teams';

/**
 * Update coach notes for a specific category
 */
export async function updatePrepPlanNotes(
  prepPlanId: string,
  category: NotesCategory,
  notes: string
): Promise<void> {
  const supabase = await createClient();

  const column = `${category}_notes` as const;

  const { error } = await supabase
    .from('prep_plans')
    .update({ [column]: notes, status: 'in_progress' })
    .eq('id', prepPlanId);

  if (error) throw error;
}

// ============================================================================
// Insights Functions
// ============================================================================

/**
 * Generate insights from film analysis data
 */
export async function generateInsightsFromFilm(
  prepPlanId: string,
  teamId: string,
  gameId: string
): Promise<PrepInsight[]> {
  const supabase = await createClient();

  // Get the game details for opponent info
  const { data: game } = await supabase
    .from('games')
    .select('opponent, is_opponent_game')
    .eq('id', gameId)
    .single();

  if (!game) return [];

  const insights: Omit<PrepInsight, 'id' | 'created_at'>[] = [];

  // Get all games for this team to find plays
  const { data: allGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .order('date', { ascending: false })
    .limit(5);

  const allGameIds = allGames?.map(g => g.id) || [];

  // Get opponent plays - either from is_opponent_game=true games OR is_opponent_play=true on play_instances
  // Note: play_instances links to games through videos table (play_instances.video_id -> videos.game_id)
  let opponentPlays: any[] = [];

  if (allGameIds.length > 0) {
    // Get video IDs for these games
    const { data: videos } = await supabase
      .from('videos')
      .select('id, game_id')
      .in('game_id', allGameIds);

    const videoIds = videos?.map(v => v.id) || [];

    if (videoIds.length > 0) {
      // First try: plays marked as opponent plays
      const { data: markedOpponentPlays } = await supabase
        .from('play_instances')
        .select('*')
        .in('video_id', videoIds)
        .eq('is_opponent_play', true);

      if (markedOpponentPlays && markedOpponentPlays.length > 0) {
        opponentPlays = markedOpponentPlays;
      } else {
        // Fallback: plays from games marked as opponent games
        const { data: opponentGames } = await supabase
          .from('games')
          .select('id')
          .eq('team_id', teamId)
          .eq('is_opponent_game', true)
          .limit(3);

        if (opponentGames && opponentGames.length > 0) {
          const opponentGameIds = opponentGames.map(g => g.id);
          const opponentVideoIds = videos
            ?.filter(v => opponentGameIds.includes(v.game_id))
            .map(v => v.id) || [];

          if (opponentVideoIds.length > 0) {
            const { data: plays } = await supabase
              .from('play_instances')
              .select('*')
              .in('video_id', opponentVideoIds);
            opponentPlays = plays || [];
          }
        }
      }
    }
  }

  if (opponentPlays.length > 0) {
      // Analyze run vs pass tendency
      const runPlays = opponentPlays.filter((p: any) => p.play_type === 'run');
      const passPlays = opponentPlays.filter((p: any) => p.play_type === 'pass');
      const runPct = Math.round((runPlays.length / opponentPlays.length) * 100);
      const passPct = 100 - runPct;

      if (runPct >= 60) {
        insights.push({
          prep_plan_id: prepPlanId,
          category: 'opponent_tendency',
          priority: 1,
          title: `${game.opponent} is Run-Heavy`,
          description: `They run ${runPct}% of the time. Stack the box and focus on run fits.`,
          data_json: { runPct, passPct, sampleSize: opponentPlays.length },
          is_reviewed: false,
          coach_notes: null,
          suggested_action: 'Consider adding extra linebacker or safety in box',
          linked_station: 'game_plan'
        });
      } else if (passPct >= 60) {
        insights.push({
          prep_plan_id: prepPlanId,
          category: 'opponent_tendency',
          priority: 1,
          title: `${game.opponent} is Pass-Heavy`,
          description: `They pass ${passPct}% of the time. Focus on coverage and pass rush.`,
          data_json: { runPct, passPct, sampleSize: opponentPlays.length },
          is_reviewed: false,
          coach_notes: null,
          suggested_action: 'Consider nickel/dime packages and coverage priorities',
          linked_station: 'game_plan'
        });
      }

      // Analyze 3rd down tendencies
      const thirdDownPlays = opponentPlays.filter((p: any) => p.down === 3);
      const thirdLongPlays = thirdDownPlays.filter((p: any) => (p.distance || 0) >= 7);
      const thirdLongPassPlays = thirdLongPlays.filter((p: any) => p.play_type === 'pass');

      if (thirdLongPlays.length >= 5) {
        const thirdLongPassPct = Math.round((thirdLongPassPlays.length / thirdLongPlays.length) * 100);

        insights.push({
          prep_plan_id: prepPlanId,
          category: 'situational',
          priority: 2,
          title: '3rd & Long Tendency',
          description: `On 3rd & 7+, ${game.opponent} passes ${thirdLongPassPct}% of the time (${thirdLongPlays.length} plays analyzed).`,
          data_json: { thirdLongPassPct, sampleSize: thirdLongPlays.length },
          is_reviewed: false,
          coach_notes: null,
          suggested_action: thirdLongPassPct >= 70 ? 'Consider bringing pressure on 3rd & long' : 'Mix pressure with coverage',
          linked_station: 'game_plan'
        });
      }

      // Analyze red zone tendencies
      const redZonePlays = opponentPlays.filter((p: any) => (p.yard_line || 0) <= 20 && (p.yard_line || 0) > 0);
      const redZoneRunPlays = redZonePlays.filter((p: any) => p.play_type === 'run');

      if (redZonePlays.length >= 3) {
        const rzRunPct = Math.round((redZoneRunPlays.length / redZonePlays.length) * 100);

        insights.push({
          prep_plan_id: prepPlanId,
          category: 'situational',
          priority: 2,
          title: 'Red Zone Tendency',
          description: `In the red zone, ${game.opponent} runs ${rzRunPct}% of the time.`,
          data_json: { rzRunPct, sampleSize: redZonePlays.length },
          is_reviewed: false,
          coach_notes: null,
          suggested_action: rzRunPct >= 60 ? 'Focus on goal line run defense' : 'Prepare for pass-heavy red zone attack',
          linked_station: 'game_plan'
        });
      }
  }

  // Get your team's recent performance for strengths/weaknesses
  // Look for plays where is_opponent_play = false (your own plays)
  // Note: play_instances links to games through videos table
  let yourPlays: any[] = [];

  if (allGameIds.length > 0) {
    // Get video IDs for these games (reuse if we already have them, otherwise fetch)
    let videoIds: string[] = [];

    // Check if we already fetched videos above
    const { data: videos } = await supabase
      .from('videos')
      .select('id')
      .in('game_id', allGameIds);

    videoIds = videos?.map(v => v.id) || [];

    if (videoIds.length > 0) {
      // Get plays marked as own plays (not opponent)
      const { data: ownPlays } = await supabase
        .from('play_instances')
        .select('*')
        .in('video_id', videoIds)
        .or('is_opponent_play.is.null,is_opponent_play.eq.false');

      yourPlays = ownPlays || [];
    }
  }

  if (yourPlays.length > 0) {
      // Analyze your explosive plays
      const explosiveRuns = yourPlays.filter((p: any) => p.play_type === 'run' && (p.yards_gained || 0) >= 10);
      const explosivePasses = yourPlays.filter((p: any) => p.play_type === 'pass' && (p.yards_gained || 0) >= 15);
      const totalPlays = yourPlays.length;

      const explosiveRate = Math.round(((explosiveRuns.length + explosivePasses.length) / totalPlays) * 100);

      if (explosiveRate >= 15) {
        insights.push({
          prep_plan_id: prepPlanId,
          category: 'own_strength',
          priority: 2,
          title: 'Explosive Play Strength',
          description: `${explosiveRate}% of your plays are explosive (10+ run, 15+ pass). Keep attacking!`,
          data_json: { explosiveRate, explosiveRuns: explosiveRuns.length, explosivePasses: explosivePasses.length },
          is_reviewed: false,
          coach_notes: null,
          suggested_action: 'Continue featuring plays that generate explosive plays',
          linked_station: 'game_plan'
        });
      }

      // Analyze turnover issues
      const turnovers = yourPlays.filter((p: any) => p.is_turnover);
      const turnoverRate = Math.round((turnovers.length / totalPlays) * 100);

      if (turnoverRate >= 5) {
        insights.push({
          prep_plan_id: prepPlanId,
          category: 'own_weakness',
          priority: 1,
          title: 'Turnover Concern',
          description: `${turnovers.length} turnovers in recent games (${turnoverRate}% of plays). Ball security is critical.`,
          data_json: { turnovers: turnovers.length, turnoverRate },
          is_reviewed: false,
          coach_notes: null,
          suggested_action: 'Emphasize ball security in practice, consider conservative play calls in risky situations',
          linked_station: 'practice'
        });
      }
  }

  // Add starter insights if no data-driven insights were generated
  if (insights.length === 0) {
    const opponentName = game.opponent || 'Opponent';

    // Add helpful starter insights to guide the coach
    insights.push({
      prep_plan_id: prepPlanId,
      category: 'opponent_tendency',
      priority: 2,
      title: `Scout ${opponentName}`,
      description: `Upload and tag opponent film to generate automatic tendency analysis. Look for their base formations, favorite plays, and key players.`,
      data_json: null,
      is_reviewed: false,
      coach_notes: null,
      suggested_action: 'Upload opponent game film and tag plays with down, distance, and play type',
      linked_station: 'film_review'
    });

    insights.push({
      prep_plan_id: prepPlanId,
      category: 'own_strength',
      priority: 2,
      title: 'Review Your Recent Games',
      description: `Tag your own game film to identify what's working and what needs improvement. Track success rates and explosive plays.`,
      data_json: null,
      is_reviewed: false,
      coach_notes: null,
      suggested_action: 'Tag your last 2-3 games to build analytics baseline',
      linked_station: 'film_review'
    });

    insights.push({
      prep_plan_id: prepPlanId,
      category: 'situational',
      priority: 3,
      title: 'Key Situations to Prepare',
      description: `Consider your game plan for critical situations: 3rd & short, 3rd & long, red zone, goal line, 2-minute drill, and 4th down decisions.`,
      data_json: null,
      is_reviewed: false,
      coach_notes: null,
      suggested_action: 'Answer the strategic questions below to document your approach',
      linked_station: 'game_plan'
    });

    insights.push({
      prep_plan_id: prepPlanId,
      category: 'personnel',
      priority: 3,
      title: 'Check Player Availability',
      description: `Review your roster for injuries, eligibility, and depth chart updates before finalizing your game plan.`,
      data_json: null,
      is_reviewed: false,
      coach_notes: null,
      suggested_action: 'Update player status and verify depth chart',
      linked_station: 'personnel'
    });
  }

  // Insert insights into database
  if (insights.length > 0) {
    const { data: insertedInsights, error } = await supabase
      .from('prep_insights')
      .insert(insights)
      .select();

    if (error) throw error;

    // Update prep plan counts
    await updatePrepPlanCounts(supabase, prepPlanId);

    return insertedInsights as PrepInsight[];
  }

  return [];
}

/**
 * Mark an insight as reviewed
 */
export async function markInsightReviewed(
  insightId: string,
  notes?: string
): Promise<void> {
  const supabase = await createClient();

  const { data: insight, error: fetchError } = await supabase
    .from('prep_insights')
    .update({ is_reviewed: true, coach_notes: notes || null })
    .eq('id', insightId)
    .select('prep_plan_id')
    .single();

  if (fetchError) throw fetchError;

  if (insight) {
    await updatePrepPlanCounts(supabase, insight.prep_plan_id);
  }
}

/**
 * Dismiss an insight (soft delete by removing from active insights)
 */
export async function dismissInsight(insightId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('prep_insights')
    .delete()
    .eq('id', insightId);

  if (error) throw error;
}

// ============================================================================
// Prompts Functions
// ============================================================================

/**
 * Initialize prompts from templates
 */
async function initializePromptsFromTemplates(
  supabase: SupabaseClient,
  prepPlanId: string
): Promise<void> {
  const { data: templates } = await supabase
    .from('prep_prompt_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (!templates || templates.length === 0) return;

  const prompts = templates.map((template: any) => ({
    prep_plan_id: prepPlanId,
    category: template.category,
    question_text: template.question_text,
    help_text: template.help_text,
    response_type: template.response_type,
    response_options: template.response_options,
    sort_order: template.sort_order
  }));

  await supabase.from('prep_prompts').insert(prompts);
}

/**
 * Answer a prompt
 */
export async function answerPrompt(
  promptId: string,
  responseText?: string,
  responsePlays?: string[]
): Promise<void> {
  const supabase = await createClient();

  const { data: prompt, error } = await supabase
    .from('prep_prompts')
    .update({
      response_text: responseText || null,
      response_plays: responsePlays || null,
      responded_at: new Date().toISOString()
    })
    .eq('id', promptId)
    .select('prep_plan_id')
    .single();

  if (error) throw error;

  if (prompt) {
    await updatePrepPlanCounts(supabase, prompt.prep_plan_id);
  }
}

/**
 * Clear a prompt answer
 */
export async function clearPromptAnswer(promptId: string): Promise<void> {
  const supabase = await createClient();

  const { data: prompt, error } = await supabase
    .from('prep_prompts')
    .update({
      response_text: null,
      response_plays: null,
      responded_at: null
    })
    .eq('id', promptId)
    .select('prep_plan_id')
    .single();

  if (error) throw error;

  if (prompt) {
    await updatePrepPlanCounts(supabase, prompt.prep_plan_id);
  }
}

// ============================================================================
// Tasks Functions
// ============================================================================

/**
 * Initialize tasks from hardcoded game prep workflow
 * Tasks align with Quick Actions: Film, Game Plan, Playbook, Practice, Roster
 */
async function initializeTasksFromTemplates(
  supabase: SupabaseClient,
  prepPlanId: string,
  teamId: string,
  gameId: string
): Promise<void> {
  // Hardcoded tasks aligned with game preparation workflow
  const taskDefinitions = [
    // Must Do (Priority 1)
    { title: 'Analyze opponent film', description: 'Watch and tag opponent game film to identify tendencies', priority: 1, linked_station: 'film_review', sort_order: 1 },
    { title: 'Review your last game film', description: 'Analyze your team\'s performance from the previous game', priority: 1, linked_station: 'film_review', sort_order: 2 },
    { title: 'Create game plan', description: 'Select plays for offense, defense, and special teams', priority: 1, linked_station: 'game_plan', sort_order: 3 },

    // Should Do (Priority 2)
    { title: 'Plan practices', description: 'Script practice schedules for the week', priority: 2, linked_station: 'practice', sort_order: 4 },
    { title: 'Evaluate roster', description: 'Check player availability, injuries, and depth chart', priority: 2, linked_station: 'personnel', sort_order: 5 },
    { title: 'Answer strategic questions', description: 'Complete the strategic questions for this game', priority: 2, linked_station: 'game_plan', sort_order: 6 },
    { title: 'Print QB wristband', description: 'Generate and print the play call wristband', priority: 2, linked_station: 'game_plan', sort_order: 7 },
    { title: 'Review playbook plays', description: 'Ensure game plan plays have complete diagrams', priority: 2, linked_station: 'playbook', sort_order: 8 },

    // Nice to Have (Priority 3)
    { title: 'Add coach notes', description: 'Document any additional notes for this game', priority: 3, linked_station: 'game_plan', sort_order: 9 },
  ];

  const tasks = taskDefinitions.map((def) => ({
    prep_plan_id: prepPlanId,
    title: def.title,
    description: def.description,
    priority: def.priority,
    sort_order: def.sort_order,
    linked_station: def.linked_station,
    link_href: getLinkHref(def.linked_station as LinkedStation, teamId, gameId),
    source_type: 'template'
  }));

  await supabase.from('prep_tasks').insert(tasks);
}

/**
 * Refresh tasks for an existing prep plan (replaces old tasks with current templates)
 */
export async function refreshPrepPlanTasks(
  prepPlanId: string,
  teamId: string,
  gameId: string
): Promise<void> {
  const supabase = await createClient();

  // Delete existing template-based tasks (keep manual ones)
  await supabase
    .from('prep_tasks')
    .delete()
    .eq('prep_plan_id', prepPlanId)
    .eq('source_type', 'template');

  // Create new tasks
  await initializeTasksFromTemplates(supabase, prepPlanId, teamId, gameId);

  // Update counts
  await updatePrepPlanCounts(supabase, prepPlanId);
}

/**
 * Get link href for a station
 */
function getLinkHref(station: LinkedStation, teamId: string, gameId: string): string {
  switch (station) {
    case 'film_review':
      return `/teams/${teamId}/film`;
    case 'game_plan':
      return `/teams/${teamId}/game-week/game-plan/${gameId}`;
    case 'practice':
      return `/teams/${teamId}/practice`;
    case 'personnel':
      return `/teams/${teamId}/players`;
    case 'playbook':
      return `/teams/${teamId}/playbook`;
    default:
      return `/teams/${teamId}`;
  }
}

/**
 * Get tasks grouped by station
 */
export async function getTasksByStation(
  prepPlanId: string,
  station?: LinkedStation
): Promise<PrepTask[]> {
  const supabase = await createClient();

  let query = supabase
    .from('prep_tasks')
    .select('*')
    .eq('prep_plan_id', prepPlanId)
    .order('priority', { ascending: true })
    .order('sort_order', { ascending: true });

  if (station) {
    query = query.eq('linked_station', station);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as PrepTask[];
}

/**
 * Get task counts by station
 */
export async function getTaskCountsByStation(
  prepPlanId: string
): Promise<Record<LinkedStation, { total: number; completed: number }>> {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from('prep_tasks')
    .select('linked_station, is_completed')
    .eq('prep_plan_id', prepPlanId);

  const counts: Record<LinkedStation, { total: number; completed: number }> = {
    film_review: { total: 0, completed: 0 },
    game_plan: { total: 0, completed: 0 },
    practice: { total: 0, completed: 0 },
    personnel: { total: 0, completed: 0 },
    playbook: { total: 0, completed: 0 }
  };

  (tasks || []).forEach((task: any) => {
    const station = task.linked_station as LinkedStation;
    if (counts[station]) {
      counts[station].total++;
      if (task.is_completed) {
        counts[station].completed++;
      }
    }
  });

  return counts;
}

/**
 * Create a new task (manual)
 */
export async function createTask(
  prepPlanId: string,
  title: string,
  linkedStation: LinkedStation,
  options?: {
    description?: string;
    priority?: number;
    linkHref?: string;
    sourceInsightId?: string;
  }
): Promise<PrepTask> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('prep_tasks')
    .insert({
      prep_plan_id: prepPlanId,
      title,
      description: options?.description || null,
      priority: options?.priority || 2,
      linked_station: linkedStation,
      link_href: options?.linkHref || null,
      source_type: options?.sourceInsightId ? 'auto' : 'manual',
      source_insight_id: options?.sourceInsightId || null
    })
    .select()
    .single();

  if (error) throw error;

  await updatePrepPlanCounts(supabase, prepPlanId);

  return data as PrepTask;
}

/**
 * Complete a task
 */
export async function completeTask(taskId: string): Promise<void> {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from('prep_tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .select('prep_plan_id')
    .single();

  if (error) throw error;

  if (task) {
    await updatePrepPlanCounts(supabase, task.prep_plan_id);
  }
}

/**
 * Uncomplete a task
 */
export async function uncompleteTask(taskId: string): Promise<void> {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from('prep_tasks')
    .update({
      is_completed: false,
      completed_at: null
    })
    .eq('id', taskId)
    .select('prep_plan_id')
    .single();

  if (error) throw error;

  if (task) {
    await updatePrepPlanCounts(supabase, task.prep_plan_id);
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  const supabase = await createClient();

  const { data: task, error: fetchError } = await supabase
    .from('prep_tasks')
    .select('prep_plan_id')
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('prep_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;

  if (task) {
    await updatePrepPlanCounts(supabase, task.prep_plan_id);
  }
}

// ============================================================================
// Readiness Functions
// ============================================================================

/**
 * Calculate overall game readiness
 */
export async function calculateGameReadiness(
  teamId: string,
  gameId: string
): Promise<GameReadinessData> {
  const supabase = await createClient();

  // Get prep plan
  const { data: plan } = await supabase
    .from('prep_plans')
    .select('*')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .single();

  // Get game date
  const { data: game } = await supabase
    .from('games')
    .select('date')
    .eq('id', gameId)
    .single();

  let daysUntilGame: number | null = null;
  if (game?.date) {
    const gameDate = new Date(game.date);
    const now = new Date();
    daysUntilGame = Math.ceil((gameDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Calculate film progress
  const filmProgress = await calculateFilmProgress(supabase, teamId, gameId);

  // Calculate game plan progress
  const gamePlanProgress = await calculateGamePlanProgress(supabase, teamId, gameId);

  // Get prep plan progress
  const tasksProgress = plan && plan.tasks_total > 0
    ? Math.round((plan.tasks_completed / plan.tasks_total) * 100)
    : 0;

  const promptsProgress = plan && plan.prompts_total > 0
    ? Math.round((plan.prompts_answered / plan.prompts_total) * 100)
    : 0;

  // Get critical insights count
  const { count: criticalInsightsCount } = await supabase
    .from('prep_insights')
    .select('*', { count: 'exact', head: true })
    .eq('prep_plan_id', plan?.id || 'none')
    .eq('priority', 1)
    .eq('is_reviewed', false);

  // Calculate overall readiness (weighted)
  const weights = {
    filmReview: 0.25,
    gamePlan: 0.25,
    tasks: 0.30,
    prompts: 0.20
  };

  const overallReadiness = Math.round(
    filmProgress * weights.filmReview +
    gamePlanProgress * weights.gamePlan +
    tasksProgress * weights.tasks +
    promptsProgress * weights.prompts
  );

  return {
    overallReadiness,
    filmProgress,
    gamePlanProgress,
    tasksProgress,
    promptsProgress,
    criticalInsightsCount: criticalInsightsCount || 0,
    daysUntilGame
  };
}

/**
 * Calculate film review progress
 */
async function calculateFilmProgress(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string
): Promise<number> {
  // Get game date
  const { data: game } = await supabase
    .from('games')
    .select('date')
    .eq('id', gameId)
    .single();

  // Get recent own games
  const { data: recentGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', false)
    .lt('date', game?.date || new Date().toISOString())
    .order('date', { ascending: false })
    .limit(2);

  // Get opponent games
  const { data: opponentGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', true)
    .order('date', { ascending: false })
    .limit(3);

  const yourGameIds = recentGames?.map(g => g.id) || [];
  const opponentGameIds = opponentGames?.map(g => g.id) || [];

  // Get video counts
  const [yourVideos, yourTagged, opponentVideos, opponentTagged] = await Promise.all([
    supabase.from('videos').select('id', { count: 'exact', head: true })
      .in('game_id', yourGameIds.length > 0 ? yourGameIds : ['none']),
    supabase.from('videos').select('id, play_instances!inner(id)', { count: 'exact', head: true })
      .in('game_id', yourGameIds.length > 0 ? yourGameIds : ['none']),
    supabase.from('videos').select('id', { count: 'exact', head: true })
      .in('game_id', opponentGameIds.length > 0 ? opponentGameIds : ['none']),
    supabase.from('videos').select('id, play_instances!inner(id)', { count: 'exact', head: true })
      .in('game_id', opponentGameIds.length > 0 ? opponentGameIds : ['none'])
  ]);

  const yourProgress = (yourVideos.count || 0) > 0
    ? ((yourTagged.count || 0) / (yourVideos.count || 1)) * 100
    : 0;

  const opponentProgress = (opponentVideos.count || 0) > 0
    ? ((opponentTagged.count || 0) / (opponentVideos.count || 1)) * 100
    : 0;

  // Weight: 60% own film, 40% opponent film (scouting)
  return Math.round(yourProgress * 0.6 + opponentProgress * 0.4);
}

/**
 * Calculate game plan progress
 */
async function calculateGamePlanProgress(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string
): Promise<number> {
  const { data: gamePlan } = await supabase
    .from('game_plans')
    .select('id, game_plan_plays(count)')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .single();

  const playsCount = gamePlan?.game_plan_plays?.[0]?.count || 0;

  // Target: 30 plays for "complete" game plan
  return Math.min(Math.round((playsCount / 30) * 100), 100);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update prep plan counts and status
 */
async function updatePrepPlanCounts(
  supabase: SupabaseClient,
  prepPlanId: string
): Promise<PrepPlan> {
  // Get counts
  const [insightsResult, promptsResult, tasksResult] = await Promise.all([
    supabase.from('prep_insights')
      .select('is_reviewed')
      .eq('prep_plan_id', prepPlanId),
    supabase.from('prep_prompts')
      .select('responded_at')
      .eq('prep_plan_id', prepPlanId),
    supabase.from('prep_tasks')
      .select('is_completed')
      .eq('prep_plan_id', prepPlanId)
  ]);

  const insights = insightsResult.data || [];
  const prompts = promptsResult.data || [];
  const tasks = tasksResult.data || [];

  const insightsTotal = insights.length;
  const insightsReviewed = insights.filter((i: any) => i.is_reviewed).length;
  const promptsTotal = prompts.length;
  const promptsAnswered = prompts.filter((p: any) => p.responded_at).length;
  const tasksTotal = tasks.length;
  const tasksCompleted = tasks.filter((t: any) => t.is_completed).length;

  // Calculate overall readiness
  const insightProgress = insightsTotal > 0 ? (insightsReviewed / insightsTotal) * 100 : 100;
  const promptProgress = promptsTotal > 0 ? (promptsAnswered / promptsTotal) * 100 : 0;
  const taskProgress = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  // Weighted average: Tasks 50%, Prompts 30%, Insights 20%
  const overallReadiness = Math.round(
    taskProgress * 0.5 +
    promptProgress * 0.3 +
    insightProgress * 0.2
  );

  // Determine status
  let status: PrepPlanStatus = 'not_started';
  if (tasksCompleted > 0 || promptsAnswered > 0 || insightsReviewed > 0) {
    status = 'in_progress';
  }
  if (overallReadiness >= 80) {
    status = 'ready';
  }

  // Update prep plan
  const { data, error } = await supabase
    .from('prep_plans')
    .update({
      insights_reviewed: insightsReviewed,
      insights_total: insightsTotal,
      prompts_answered: promptsAnswered,
      prompts_total: promptsTotal,
      tasks_completed: tasksCompleted,
      tasks_total: tasksTotal,
      overall_readiness: overallReadiness,
      status
    })
    .eq('id', prepPlanId)
    .select()
    .single();

  if (error) throw error;

  return data as PrepPlan;
}
