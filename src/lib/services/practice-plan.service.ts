/**
 * Practice Plan Service
 * Handles practice planning, periods, and drill management
 */

import { createClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface SelectedCoach {
  id: string;
  name: string;
  isGuest?: boolean;
}

export interface PracticePlan {
  id: string;
  team_id: string;
  title: string;
  date: string;
  duration_minutes: number;
  location?: string;
  notes?: string;
  is_template: boolean;
  template_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  selected_coaches?: SelectedCoach[];
  coach_count?: number;
}

export type PeriodType = 'warmup' | 'drill' | 'team' | 'special_teams' | 'conditioning' | 'other';
export type PositionGroup = 'OL' | 'RB' | 'WR' | 'TE' | 'QB' | 'DL' | 'LB' | 'DB' | 'All';

export interface PracticePeriod {
  id: string;
  practice_plan_id: string;
  period_order: number;
  name: string;
  duration_minutes: number;
  period_type: PeriodType;
  start_time?: number; // Minutes from practice start
  is_concurrent: boolean;
  notes?: string;
  created_at: string;
}

export interface PracticeDrill {
  id: string;
  period_id: string;
  drill_order: number;
  drill_name: string;
  position_group?: PositionGroup;
  description?: string;
  play_codes?: string[]; // Array of play codes from playbook
  equipment_needed?: string;
  created_at: string;
}

export interface PracticePlanWithDetails extends PracticePlan {
  periods: (PracticePeriod & { drills: PracticeDrill[] })[];
}

// ============================================================================
// Practice Plan CRUD
// ============================================================================

/**
 * Get all practice plans for a team
 */
export async function getPracticePlans(teamId: string): Promise<PracticePlan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get practice plans for a specific week
 */
export async function getPracticePlansForWeek(
  teamId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<PracticePlan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('team_id', teamId)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lte('date', weekEnd.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single practice plan with all details
 */
export async function getPracticePlanWithDetails(
  planId: string
): Promise<PracticePlanWithDetails | null> {
  const supabase = await createClient();

  // Get practice plan
  const { data: plan, error: planError } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError) throw planError;
  if (!plan) return null;

  // Get periods
  const { data: periods, error: periodsError } = await supabase
    .from('practice_periods')
    .select('*')
    .eq('practice_plan_id', planId)
    .order('period_order', { ascending: true });

  if (periodsError) throw periodsError;

  // Get drills for each period
  const periodsWithDrills = await Promise.all(
    (periods || []).map(async (period) => {
      const { data: drills, error: drillsError } = await supabase
        .from('practice_drills')
        .select('*')
        .eq('period_id', period.id)
        .order('drill_order', { ascending: true });

      if (drillsError) throw drillsError;

      return {
        ...period,
        drills: drills || []
      };
    })
  );

  return {
    ...plan,
    periods: periodsWithDrills
  };
}

/**
 * Create a new practice plan
 */
export async function createPracticePlan(
  teamId: string,
  practicePlan: Partial<PracticePlan>
): Promise<PracticePlan> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('practice_plans')
    .insert({
      team_id: teamId,
      created_by: user?.id,
      ...practicePlan
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update practice plan
 */
export async function updatePracticePlan(
  planId: string,
  updates: Partial<PracticePlan>
): Promise<PracticePlan> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('practice_plans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete practice plan
 */
export async function deletePracticePlan(planId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('practice_plans')
    .delete()
    .eq('id', planId);

  if (error) throw error;
}

// ============================================================================
// Practice Periods
// ============================================================================

/**
 * Add a period to a practice plan
 */
export async function addPracticePeriod(
  practicePlanId: string,
  period: Partial<PracticePeriod>
): Promise<PracticePeriod> {
  const supabase = await createClient();

  // Get the next order number
  const { data: existingPeriods } = await supabase
    .from('practice_periods')
    .select('period_order')
    .eq('practice_plan_id', practicePlanId)
    .order('period_order', { ascending: false })
    .limit(1);

  const nextOrder = existingPeriods && existingPeriods.length > 0
    ? existingPeriods[0].period_order + 1
    : 1;

  const { data, error } = await supabase
    .from('practice_periods')
    .insert({
      practice_plan_id: practicePlanId,
      period_order: period.period_order ?? nextOrder,
      ...period
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a practice period
 */
export async function updatePracticePeriod(
  periodId: string,
  updates: Partial<PracticePeriod>
): Promise<PracticePeriod> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('practice_periods')
    .update(updates)
    .eq('id', periodId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a practice period
 */
export async function deletePracticePeriod(periodId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('practice_periods')
    .delete()
    .eq('id', periodId);

  if (error) throw error;
}

// ============================================================================
// Practice Drills
// ============================================================================

/**
 * Add a drill to a period
 */
export async function addPracticeDrill(
  periodId: string,
  drill: Partial<PracticeDrill>
): Promise<PracticeDrill> {
  const supabase = await createClient();

  // Get the next order number
  const { data: existingDrills } = await supabase
    .from('practice_drills')
    .select('drill_order')
    .eq('period_id', periodId)
    .order('drill_order', { ascending: false })
    .limit(1);

  const nextOrder = existingDrills && existingDrills.length > 0
    ? existingDrills[0].drill_order + 1
    : 1;

  const { data, error } = await supabase
    .from('practice_drills')
    .insert({
      period_id: periodId,
      drill_order: drill.drill_order ?? nextOrder,
      ...drill
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a practice drill
 */
export async function updatePracticeDrill(
  drillId: string,
  updates: Partial<PracticeDrill>
): Promise<PracticeDrill> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('practice_drills')
    .update(updates)
    .eq('id', drillId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a practice drill
 */
export async function deletePracticeDrill(drillId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('practice_drills')
    .delete()
    .eq('id', drillId);

  if (error) throw error;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get practice plan summary for game week station
 */
export async function getPracticePlanSummary(
  teamId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{
  totalPractices: number;
  nextPractice: PracticePlan | null;
  totalPlays: number;
}> {
  const supabase = await createClient();

  // Get practices for this week
  const { data: practices } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('team_id', teamId)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lte('date', weekEnd.toISOString().split('T')[0])
    .order('date', { ascending: true });

  const now = new Date();
  const nextPractice = practices?.find(p => new Date(p.date) >= now) || null;

  // Count total unique plays across all drills
  const { data: periods } = await supabase
    .from('practice_periods')
    .select('id')
    .in('practice_plan_id', practices?.map(p => p.id) || []);

  const { data: drills } = await supabase
    .from('practice_drills')
    .select('play_codes')
    .in('period_id', periods?.map(p => p.id) || []);

  const uniquePlayCodes = new Set<string>();
  drills?.forEach(drill => {
    drill.play_codes?.forEach((code: string) => uniquePlayCodes.add(code));
  });

  return {
    totalPractices: practices?.length || 0,
    nextPractice,
    totalPlays: uniquePlayCodes.size
  };
}

/**
 * Create a default practice plan template
 */
export async function createDefaultPracticePlan(
  teamId: string,
  date: string
): Promise<PracticePlan> {
  const plan = await createPracticePlan(teamId, {
    title: `Practice - ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
    date,
    duration_minutes: 120,
    location: '',
    notes: ''
  });

  // Add default periods
  await addPracticePeriod(plan.id, {
    name: 'Warmup & Stretch',
    duration_minutes: 15,
    period_type: 'warmup',
    is_concurrent: false
  });

  await addPracticePeriod(plan.id, {
    name: 'Individual Drills',
    duration_minutes: 30,
    period_type: 'drill',
    is_concurrent: true,
    notes: 'Position groups work separately'
  });

  await addPracticePeriod(plan.id, {
    name: 'Team Offense',
    duration_minutes: 30,
    period_type: 'team',
    is_concurrent: false
  });

  await addPracticePeriod(plan.id, {
    name: 'Team Defense',
    duration_minutes: 25,
    period_type: 'team',
    is_concurrent: false
  });

  await addPracticePeriod(plan.id, {
    name: 'Special Teams',
    duration_minutes: 15,
    period_type: 'special_teams',
    is_concurrent: false
  });

  await addPracticePeriod(plan.id, {
    name: 'Conditioning',
    duration_minutes: 5,
    period_type: 'conditioning',
    is_concurrent: false
  });

  return plan;
}

// ============================================================================
// AI-Generated Practice Plans
// ============================================================================

/**
 * Input type for AI-generated practice plans
 */
export interface AIGeneratedPlan {
  title: string;
  duration_minutes: number;
  focus_areas: string[];
  ai_reasoning: string;
  periods: AIGeneratedPeriod[];
}

export interface AIGeneratedPeriod {
  name: string;
  duration_minutes: number;
  period_type: PeriodType;
  is_concurrent?: boolean;
  start_time?: number;
  notes?: string;
  drills: AIGeneratedDrill[];
}

export interface AIGeneratedDrill {
  drill_name: string;
  position_group?: PositionGroup | 'All';
  description?: string;
  equipment_needed?: string;
  play_codes?: string[];
}

/**
 * Create a full practice plan from AI-generated data
 * Creates the plan, all periods, and all drills in a single transaction
 */
export async function createFromAIGenerated(
  teamId: string,
  aiPlan: AIGeneratedPlan,
  date: string,
  location?: string,
  coaches?: SelectedCoach[]
): Promise<PracticePlanWithDetails> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Create the practice plan
  const { data: plan, error: planError } = await supabase
    .from('practice_plans')
    .insert({
      team_id: teamId,
      title: aiPlan.title,
      date,
      duration_minutes: aiPlan.duration_minutes,
      location: location || null,
      notes: `Focus: ${aiPlan.focus_areas.join(', ')}\n\nAI Reasoning: ${aiPlan.ai_reasoning}`,
      is_template: false,
      created_by: user?.id,
      selected_coaches: coaches || null,
      coach_count: coaches?.length || 1,
    })
    .select()
    .single();

  if (planError) throw planError;

  // Create periods with drills
  const periodsWithDrills = [];

  // Helper to check if a string is a valid UUID (for coach assignment)
  const isValidUUID = (str: string | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Group concurrent periods by start_time to auto-assign coaches
  const concurrentGroups = new Map<number, number>(); // start_time -> coach index counter

  for (let i = 0; i < aiPlan.periods.length; i++) {
    const periodData = aiPlan.periods[i];

    // Auto-assign coach to concurrent periods
    let assignedCoachId: string | null = null;
    if (periodData.is_concurrent && coaches && coaches.length > 0) {
      const startTime = periodData.start_time ?? 0;
      const coachIndex = concurrentGroups.get(startTime) ?? 0;

      // Get the coach at this index (cycle through if more periods than coaches)
      const coach = coaches[coachIndex % coaches.length];
      // Only assign if it's a valid UUID (not guest coaches like "guest-123")
      if (isValidUUID(coach?.id)) {
        assignedCoachId = coach.id;
      }

      // Increment counter for next concurrent period at this start time
      concurrentGroups.set(startTime, coachIndex + 1);
    }

    // Create period
    const { data: period, error: periodError } = await supabase
      .from('practice_periods')
      .insert({
        practice_plan_id: plan.id,
        period_order: i + 1,
        name: periodData.name,
        duration_minutes: periodData.duration_minutes,
        period_type: periodData.period_type,
        is_concurrent: periodData.is_concurrent || false,
        start_time: periodData.start_time,
        notes: periodData.notes,
        assigned_coach_id: assignedCoachId,
      })
      .select()
      .single();

    if (periodError) throw periodError;

    // Create drills for this period
    const drills = [];
    for (let j = 0; j < periodData.drills.length; j++) {
      const drillData = periodData.drills[j];

      const { data: drill, error: drillError } = await supabase
        .from('practice_drills')
        .insert({
          period_id: period.id,
          drill_order: j + 1,
          drill_name: drillData.drill_name,
          position_group: drillData.position_group === 'All' ? null : drillData.position_group,
          description: drillData.description,
          equipment_needed: drillData.equipment_needed,
          play_codes: drillData.play_codes || [],
        })
        .select()
        .single();

      if (drillError) throw drillError;
      drills.push(drill);
    }

    periodsWithDrills.push({
      ...period,
      drills,
    });
  }

  return {
    ...plan,
    periods: periodsWithDrills,
  };
}
