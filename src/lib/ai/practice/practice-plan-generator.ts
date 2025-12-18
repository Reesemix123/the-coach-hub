/**
 * Practice Plan Generator
 *
 * Orchestrates AI-powered practice plan generation using the semantic layer
 * and Gemini Pro for reasoning/generation tasks.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PracticePlanWithDetails, PositionGroup, PeriodType } from '@/lib/services/practice-plan.service';
import { fetchPracticeContext, formatContextForPrompt } from './practice-data-fetcher';
import { getSystemPrompt, getUserPrompt, getRefinementPrompt, getAnalysisPrompt } from './practice-prompts';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';

// Create Google AI instance
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

// Use Gemini Pro for plan generation (needs reasoning)
const geminiPro = googleAI('gemini-2.5-pro');

// Use Gemini Flash for simple tasks
const geminiFlash = googleAI('gemini-2.5-flash');

/**
 * Generated practice plan structure from AI
 */
export interface GeneratedPracticePlan {
  title: string;
  duration_minutes: number;
  focus_areas: string[];
  ai_reasoning: string;
  periods: GeneratedPeriod[];
}

export interface GeneratedPeriod {
  name: string;
  duration_minutes: number;
  period_type: PeriodType;
  is_concurrent?: boolean;
  start_time?: number;
  notes?: string;
  drills: GeneratedDrill[];
}

export interface GeneratedDrill {
  drill_name: string;
  position_group: PositionGroup | 'All';
  description?: string;
  equipment_needed?: string;
  play_codes?: string[];
}

/**
 * Team analysis result from AI
 */
export interface TeamAnalysis {
  strength: string;
  primaryWeakness: string;
  secondaryWeakness: string;
  suggestedFocus: string[];
  summary: string;
}

/**
 * Generate initial team analysis for the conversation
 */
export async function generateTeamAnalysis(
  supabase: SupabaseClient,
  teamId: string,
  opponentName?: string
): Promise<TeamAnalysis> {
  // Fetch context from semantic layer
  const context = await fetchPracticeContext(supabase, teamId, { opponentName });

  if (!context.hasAnalyticsData) {
    return {
      strength: 'Unable to analyze - no film data',
      primaryWeakness: 'Unable to analyze - no film data',
      secondaryWeakness: '',
      suggestedFocus: ['Fundamentals', 'Basic drills'],
      summary: 'Tag some game film to unlock AI-powered practice recommendations.',
    };
  }

  const formattedContext = formatContextForPrompt(context);
  const analysisPrompt = getAnalysisPrompt(formattedContext);

  try {
    const result = await generateText({
      model: geminiFlash,
      system: 'You are a football analytics expert. Provide concise, actionable analysis.',
      prompt: analysisPrompt,
    });

    // Parse the AI response into structured analysis
    const text = result.text;
    const suggestedFocus = context.practiceRecommendations.slice(0, 3);

    // Get secondary weakness - use play name if different from code, otherwise describe the issue
    const topDrillCandidate = context.playDrillCandidates.needsDrilling[0];
    let secondaryWeakness = '';
    if (topDrillCandidate) {
      // If playName is same as playCode, show issue instead
      if (topDrillCandidate.playName !== topDrillCandidate.playCode) {
        secondaryWeakness = `${topDrillCandidate.playName} (${topDrillCandidate.successRate}% success)`;
      } else if (topDrillCandidate.issues?.[0]) {
        secondaryWeakness = topDrillCandidate.issues[0];
      } else {
        secondaryWeakness = `Play execution (${topDrillCandidate.successRate}% success)`;
      }
    }

    return {
      strength: extractSection(text, 'Biggest Strength') || 'Balanced attack',
      primaryWeakness: context.positionGroupPerformance.weakestGroup?.groupName || 'Need more data',
      secondaryWeakness,
      suggestedFocus,
      summary: text,
    };
  } catch (error) {
    console.error('Error generating team analysis:', error);
    return {
      strength: 'Analysis unavailable',
      primaryWeakness: context.positionGroupPerformance.weakestGroup?.groupName || 'Unknown',
      secondaryWeakness: '',
      suggestedFocus: context.practiceRecommendations.slice(0, 3),
      summary: 'Using analytics data for recommendations.',
    };
  }
}

/**
 * Generate a complete practice plan
 */
export async function generatePracticePlan(
  supabase: SupabaseClient,
  teamId: string,
  options: {
    duration?: number;
    focusAreas?: string[];
    opponentName?: string;
    gameId?: string;
    contactLevel?: 'no_contact' | 'thud' | 'live';
    equipmentWorn?: 'helmets' | 'shells' | 'full_pads';
    equipmentNeeded?: string[];
    coachCount?: number;
    conditioning?: {
      type: 'sprints' | 'gassers' | 'ladders' | 'shuttles' | 'intervals' | 'bear_crawls' | 'custom' | 'none';
      duration: number;
    };
  } = {}
): Promise<GeneratedPracticePlan> {
  // Fetch context from semantic layer
  const context = await fetchPracticeContext(supabase, teamId, {
    opponentName: options.opponentName,
    gameId: options.gameId,
  });

  const formattedContext = formatContextForPrompt(context);
  const systemPrompt = getSystemPrompt(context.teamLevel);
  const userPrompt = getUserPrompt(context, formattedContext, {
    duration: options.duration,
    focusAreas: options.focusAreas,
    contactLevel: options.contactLevel,
    equipmentWorn: options.equipmentWorn,
    equipmentNeeded: options.equipmentNeeded,
    coachCount: options.coachCount,
    conditioning: options.conditioning,
  });

  try {
    const result = await generateText({
      model: geminiPro,
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Parse JSON from response
    const plan = parseGeneratedPlan(result.text);

    // Validate the plan
    validatePlan(plan, options.duration || 90);

    return plan;
  } catch (error) {
    console.error('Error generating practice plan:', error);
    throw new Error('Failed to generate practice plan. Please try again.');
  }
}

/**
 * Stream a practice plan generation for real-time UI updates
 */
export async function streamPracticePlan(
  supabase: SupabaseClient,
  teamId: string,
  options: {
    duration?: number;
    focusAreas?: string[];
    opponentName?: string;
    gameId?: string;
    contactLevel?: 'no_contact' | 'thud' | 'live';
    equipmentWorn?: 'helmets' | 'shells' | 'full_pads';
    equipmentNeeded?: string[];
    coachCount?: number;
    conditioning?: {
      type: 'sprints' | 'gassers' | 'ladders' | 'shuttles' | 'intervals' | 'bear_crawls' | 'custom' | 'none';
      duration: number;
    };
  } = {}
): Promise<ReadableStream<string>> {
  // Fetch context from semantic layer
  const context = await fetchPracticeContext(supabase, teamId, {
    opponentName: options.opponentName,
    gameId: options.gameId,
  });

  const formattedContext = formatContextForPrompt(context);
  const systemPrompt = getSystemPrompt(context.teamLevel);
  const userPrompt = getUserPrompt(context, formattedContext, {
    duration: options.duration,
    focusAreas: options.focusAreas,
    contactLevel: options.contactLevel,
    equipmentWorn: options.equipmentWorn,
    equipmentNeeded: options.equipmentNeeded,
    coachCount: options.coachCount,
    conditioning: options.conditioning,
  });

  const result = streamText({
    model: geminiPro,
    system: systemPrompt,
    messages: [{ role: 'user' as const, content: userPrompt }],
  });

  const { textStream } = result;

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        controller.error(error);
      }
    },
  });
}

/**
 * Refine an existing practice plan based on coach feedback
 */
export async function refinePracticePlan(
  currentPlan: GeneratedPracticePlan,
  feedback: string,
  teamLevel: string
): Promise<GeneratedPracticePlan> {
  const systemPrompt = getSystemPrompt(teamLevel);
  const currentPlanJson = JSON.stringify(currentPlan, null, 2);
  const refinementPrompt = getRefinementPrompt(currentPlanJson, feedback);

  try {
    const result = await generateText({
      model: geminiPro,
      system: systemPrompt,
      prompt: refinementPrompt,
    });

    const plan = parseGeneratedPlan(result.text);
    return plan;
  } catch (error) {
    console.error('Error refining practice plan:', error);
    throw new Error('Failed to refine practice plan. Please try again.');
  }
}

/**
 * Parse AI-generated JSON into a practice plan
 */
function parseGeneratedPlan(text: string): GeneratedPracticePlan {
  // Try to extract JSON from the response
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Find JSON object bounds
  const startIdx = jsonStr.indexOf('{');
  const endIdx = jsonStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    jsonStr = jsonStr.slice(startIdx, endIdx + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.title || !parsed.periods || !Array.isArray(parsed.periods)) {
      throw new Error('Invalid plan structure');
    }

    return parsed as GeneratedPracticePlan;
  } catch (error) {
    console.error('Failed to parse AI response:', text);
    throw new Error('Invalid response from AI. Please try again.');
  }
}

/**
 * Validate a generated plan
 */
function validatePlan(plan: GeneratedPracticePlan, expectedDuration: number): void {
  // Check duration adds up
  const totalDuration = plan.periods.reduce((sum, p) => sum + p.duration_minutes, 0);
  if (Math.abs(totalDuration - expectedDuration) > 5) {
    console.warn(`Plan duration mismatch: expected ${expectedDuration}, got ${totalDuration}`);
  }

  // Validate period types
  const validTypes: PeriodType[] = ['warmup', 'drill', 'team', 'special_teams', 'conditioning', 'other'];
  for (const period of plan.periods) {
    if (!validTypes.includes(period.period_type)) {
      period.period_type = 'drill'; // Default to drill
    }
  }

  // Validate position groups
  const validGroups = ['All', 'OL', 'RB', 'WR', 'TE', 'QB', 'DL', 'LB', 'DB'];
  for (const period of plan.periods) {
    for (const drill of period.drills || []) {
      if (!validGroups.includes(drill.position_group)) {
        drill.position_group = 'All';
      }
    }
  }
}

/**
 * Helper to extract a section from AI text
 */
function extractSection(text: string, label: string): string | null {
  const regex = new RegExp(`\\*\\*${label}\\*\\*:?\\s*(.+?)(?=\\*\\*|$)`, 'is');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Convert a generated plan to the format expected by practice-plan.service
 */
export function convertToServiceFormat(
  generated: GeneratedPracticePlan,
  teamId: string,
  date: string
): {
  plan: {
    team_id: string;
    title: string;
    date: string;
    duration_minutes: number;
    notes: string;
    is_template: boolean;
  };
  periods: Array<{
    name: string;
    duration_minutes: number;
    period_type: PeriodType;
    notes?: string;
    drills: Array<{
      drill_name: string;
      position_group?: PositionGroup | 'All';
      description?: string;
      play_codes?: string[];
    }>;
  }>;
} {
  return {
    plan: {
      team_id: teamId,
      title: generated.title,
      date,
      duration_minutes: generated.duration_minutes,
      notes: `Focus: ${generated.focus_areas.join(', ')}\n\nAI Reasoning: ${generated.ai_reasoning}`,
      is_template: false,
    },
    periods: generated.periods.map((p) => ({
      name: p.name,
      duration_minutes: p.duration_minutes,
      period_type: p.period_type,
      notes: p.notes,
      drills: p.drills.map((d) => ({
        drill_name: d.drill_name,
        position_group: d.position_group === 'All' ? undefined : d.position_group as PositionGroup,
        description: d.description,
        play_codes: d.play_codes,
      })),
    })),
  };
}
