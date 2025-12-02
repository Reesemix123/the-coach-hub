/**
 * Game Prep Hub Client Service
 * Client-side functions for game preparation - used in client components
 */

import { createClient } from '@/utils/supabase/client';

// ============================================================================
// Types (re-export from main service types)
// ============================================================================

export type PrepPlanStatus = 'not_started' | 'in_progress' | 'ready';
export type InsightCategory = 'opponent_tendency' | 'matchup_advantage' | 'matchup_concern' | 'own_strength' | 'own_weakness' | 'situational' | 'personnel';
export type PromptCategory = 'offensive_identity' | 'defensive_identity' | 'special_teams_identity' | 'situational' | 'personnel' | 'adjustments';
export type LinkedStation = 'film_review' | 'game_plan' | 'practice' | 'personnel' | 'playbook';
export type TaskSourceType = 'template' | 'auto' | 'manual';
export type ResponseType = 'text' | 'single_choice' | 'multi_choice' | 'play_select';

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

type NotesCategory = 'general' | 'offensive' | 'defensive' | 'special_teams';

// ============================================================================
// Notes Functions
// ============================================================================

/**
 * Update coach notes for a specific category
 */
export async function updatePrepPlanNotes(
  prepPlanId: string,
  category: NotesCategory,
  notes: string
): Promise<void> {
  const supabase = createClient();

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
 * Mark an insight as reviewed
 */
export async function markInsightReviewed(
  insightId: string,
  notes?: string
): Promise<void> {
  const supabase = createClient();

  const { data: insight, error: fetchError } = await supabase
    .from('prep_insights')
    .update({ is_reviewed: true, coach_notes: notes || null })
    .eq('id', insightId)
    .select('prep_plan_id')
    .single();

  if (fetchError) throw fetchError;

  if (insight) {
    await updatePrepPlanCounts(insight.prep_plan_id);
  }
}

/**
 * Dismiss an insight (delete)
 */
export async function dismissInsight(insightId: string): Promise<void> {
  const supabase = createClient();

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
 * Answer a prompt
 */
export async function answerPrompt(
  promptId: string,
  responseText?: string,
  responsePlays?: string[]
): Promise<void> {
  const supabase = createClient();

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
    await updatePrepPlanCounts(prompt.prep_plan_id);
  }
}

/**
 * Clear a prompt answer
 */
export async function clearPromptAnswer(promptId: string): Promise<void> {
  const supabase = createClient();

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
    await updatePrepPlanCounts(prompt.prep_plan_id);
  }
}

// ============================================================================
// Tasks Functions
// ============================================================================

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
  const supabase = createClient();

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

  await updatePrepPlanCounts(prepPlanId);

  return data as PrepTask;
}

/**
 * Complete a task
 */
export async function completeTask(taskId: string): Promise<void> {
  const supabase = createClient();

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
    await updatePrepPlanCounts(task.prep_plan_id);
  }
}

/**
 * Uncomplete a task
 */
export async function uncompleteTask(taskId: string): Promise<void> {
  const supabase = createClient();

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
    await updatePrepPlanCounts(task.prep_plan_id);
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  const supabase = createClient();

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
    await updatePrepPlanCounts(task.prep_plan_id);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update prep plan counts and status
 */
async function updatePrepPlanCounts(prepPlanId: string): Promise<void> {
  const supabase = createClient();

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
  const insightsReviewed = insights.filter((i: { is_reviewed: boolean }) => i.is_reviewed).length;
  const promptsTotal = prompts.length;
  const promptsAnswered = prompts.filter((p: { responded_at: string | null }) => p.responded_at).length;
  const tasksTotal = tasks.length;
  const tasksCompleted = tasks.filter((t: { is_completed: boolean }) => t.is_completed).length;

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
  await supabase
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
    .eq('id', prepPlanId);
}
