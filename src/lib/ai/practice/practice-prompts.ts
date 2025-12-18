/**
 * Practice Plan AI Prompts
 *
 * System prompts and templates for AI-powered practice planning.
 * Includes age-appropriate guidelines and output format specifications.
 */

import type { PracticeDataContext } from './practice-data-fetcher';

/**
 * Team level descriptions for age-appropriate practice design
 */
export const TEAM_LEVEL_GUIDELINES: Record<string, string> = {
  youth: `
## 8U-10U Guidelines (Youth/Flag)
- Focus on FUNDAMENTALS: stance, hand placement, basic tackling form
- Short drills: 5-8 minutes maximum per drill
- High variety: Change activities frequently to maintain engagement
- Fun emphasis: Include games and competitions
- No complex schemes: Simple formations (I-form, 4-3 base)
- No live tackling: Use tags or wrap-up drills
- Participation: Ensure every player gets repetitions`,

  middle_school: `
## 11U-12U Guidelines (Middle School)
- Basic concepts: Introduce zone vs man coverage, pulling guards
- 8-10 minute drills with clear coaching points
- Position-specific intro: Start grouping by position for some drills
- Simple reads: 1-2 read progressions for QB, basic gap responsibility
- Limited contact: Thud tempo, controlled scrimmage
- Building blocks: Focus on technique that transfers to higher levels`,

  high_school_jv: `
## JV High School Guidelines
- Scheme installation: Basic offensive/defensive schemes
- 10-12 minute drill periods
- Position groups: Dedicated position work with position coaches
- Competition: Include competitive drills with winners/losers
- Film tie-in: Reference game film in practice corrections
- Conditioning: Include football-specific conditioning
- Varsity preparation: Mirror varsity terminology and concepts`,

  high_school: `
## Varsity High School Guidelines
- Full complexity: Advanced schemes, motions, audibles
- 10-15 minute concentrated periods
- Situational work: Red zone, 2-minute, goal line
- Player accountability: Track rep quality and effort
- Film integration: Correct specific game film mistakes
- Opponent prep: Scout-specific periods when applicable
- Intensity management: Plan tempo and contact level thoughtfully`,

  default: `
## General Practice Guidelines
- Age-appropriate drill selection
- Balance fundamentals with scheme installation
- Include warm-up and conditioning
- Mix individual, group, and team periods
- Ensure all position groups have work`
};

/**
 * System prompt for practice plan generation
 */
export function getSystemPrompt(teamLevel: string): string {
  const levelGuide = TEAM_LEVEL_GUIDELINES[teamLevel] || TEAM_LEVEL_GUIDELINES.default;

  return `You are an expert football coach assistant helping to create practice plans.

You will receive team analytics data and must generate a structured, age-appropriate practice plan.

${levelGuide}

## REQUIRED Practice Structure (in this order!)

Every practice MUST follow this structure to fill the FULL duration:

1. **Coach Talk** (5-10 min, period_type: "other")
   - Introduction period where coach addresses the team
   - Explain practice goals and what you'll focus on
   - Set expectations for effort and attitude

2. **Warmup** (10-15 min, period_type: "warmup")
   - Dynamic stretching
   - Form running
   - Position-specific activation drills

3. **Individual/Position Drills** (15-25 min, period_type: "drill")
   - Position-specific skill work
   - Multiple drills per position group
   - Include SPECIFIC drill names with descriptions

4. **Group Work** (10-20 min, period_type: "drill")
   - OL/RB combinations, WR/QB routes, etc.
   - Small group execution

5. **Team Periods** (20-40 min depending on duration, period_type: "team")
   - Full offense vs defense
   - Situational work (3rd down, red zone, etc.)
   - Include plays from playbook when available

6. **Special Teams** (5-10 min, period_type: "special_teams") - optional
   - Kickoff, punt, FG/XP
   - Include if time allows

7. **Conditioning** (5-15 min, period_type: "conditioning")
   - End with conditioning as specified by coach
   - Sprints, gassers, or agility work

## Period Types
- warmup: Dynamic stretching, form running, activation
- drill: Position-specific skill work (individual or group)
- team: Full team periods (offense vs defense)
- special_teams: Kicking game work
- conditioning: Sprints, agility, strength
- other: Coach talk, water breaks, film review

## Output Format

You MUST return valid JSON matching this structure:

\`\`\`json
{
  "title": "Practice Title",
  "duration_minutes": 90,
  "focus_areas": ["Area 1", "Area 2"],
  "ai_reasoning": "Brief explanation of focus selection based on data",
  "periods": [
    {
      "name": "Period Name",
      "duration_minutes": 15,
      "period_type": "warmup|drill|team|special_teams|conditioning|other",
      "is_concurrent": false,
      "start_time": 0,
      "notes": "Coaching points and emphasis",
      "drills": [
        {
          "drill_name": "Drill Name",
          "position_group": "All|OL|RB|WR|TE|QB|DL|LB|DB",
          "description": "Brief description of drill execution",
          "equipment_needed": "cones, blocking pads",
          "play_codes": ["P-001", "P-002"]
        }
      ]
    }
  ]
}
\`\`\`

## Concurrent Periods

For position-specific individual work, create MULTIPLE periods that run at the SAME TIME:
- Set "is_concurrent": true for periods that run simultaneously
- Set the same "start_time" (minutes from practice start) for concurrent periods
- Only count the duration ONCE when concurrent periods overlap

Example: 3 concurrent 15-min periods at start_time 17 = 15 minutes total, not 45!

## CRITICAL Rules

1. **Duration MUST add up EXACTLY**: Period durations must sum to EXACTLY the requested practice duration
2. **Coach Talk FIRST**: Always start with a coach talk period
3. **Warmup SECOND**: Always follow with warmup before any drills
4. **Conditioning LAST**: End with conditioning (unless coach said "no conditioning")
5. **Fill ALL time**: Do not leave any minutes unscheduled
6. **EVERY DRILL MUST HAVE A DESCRIPTION**: Each drill needs both a name AND a 1-2 sentence description explaining how to execute it. Never leave description empty.
7. **Multiple drills per period**: Each drill period should have 2-4 specific drills
8. **Address weaknesses**: Prioritize areas identified in analytics
9. **Age appropriate**: Match intensity and complexity to team level

## Drill Description Examples
- "Players line up in 2 lines. Alternate catching passes from QB while running a 10-yard slant. Focus on securing the catch before turning upfield."
- "Linemen work in pairs. On snap count, practice punch and hand placement against a partner. 5 reps each, then switch."
- "Set up cones at 5-yard intervals. Players shuffle between cones, focusing on low hips and quick feet. 3 sets of 4 cones."

## Example: 90-minute Practice

| Period | Minutes | Running Total |
|--------|---------|---------------|
| Coach Talk | 5 | 5 |
| Warmup | 12 | 17 |
| Individual (OL/Skill) | 15 | 32 |
| Group Work | 13 | 45 |
| Team Offense | 15 | 60 |
| Team Defense | 15 | 75 |
| Special Teams | 10 | 85 |
| Conditioning | 5 | 90 |

This accounts for EXACTLY 90 minutes.`;
}

/**
 * Generate the user prompt with team context
 */
export function getUserPrompt(
  context: PracticeDataContext,
  formattedContext: string,
  options: {
    duration?: number;
    focusAreas?: string[];
    opponentPrepNotes?: string;
    contactLevel?: 'no_contact' | 'thud' | 'live';
    equipmentWorn?: 'helmets' | 'shells' | 'full_pads';
    equipmentNeeded?: string[];
    coachCount?: number;
    conditioning?: {
      type: 'sprints' | 'gassers' | 'ladders' | 'shuttles' | 'intervals' | 'bear_crawls' | 'custom' | 'none';
      duration: number;
    };
  } = {}
): string {
  const duration = options.duration || 90;
  const focusStr = options.focusAreas?.length
    ? `\n\n**Requested Focus Areas:** ${options.focusAreas.join(', ')}`
    : '';

  // Check for game preparation focus areas
  const gamePrepFocusAreas = options.focusAreas?.filter(f =>
    f.toLowerCase().includes('opponent') ||
    f.toLowerCase().includes('scout') ||
    f.toLowerCase().includes('game plan') ||
    f.toLowerCase().includes('situational')
  ) || [];

  const gamePrepStr = gamePrepFocusAreas.length > 0
    ? `\n\n**IMPORTANT - Game Preparation Required:** The coach has requested game preparation activities. You MUST include the following in the practice plan:
${gamePrepFocusAreas.map(f => `- ${f}`).join('\n')}

Include these as part of the practice by:
1. **Scout Report Discussion** - Add a "team" period where coach reviews opponent tendencies with players (what defense they run, blitz tendencies, coverage schemes)
2. **Game Plan Walkthrough** - Include a low-intensity walk-through period where players learn their assignments for specific plays designed to attack opponent weaknesses
3. **Situational Adjustments** - During team periods, simulate game situations the team is likely to face against this opponent

These game prep activities should be woven into existing periods or added as dedicated "team" or "other" type periods.`
    : '';

  const opponentStr = options.opponentPrepNotes
    ? `\n\n**Coach Notes for Opponent Prep:** ${options.opponentPrepNotes}`
    : '';

  // Build contact level instruction
  const contactLabels: Record<string, string> = {
    no_contact: 'NO CONTACT - Air/walk-through only. Do not include any contact drills like tackling, live blocking, or hitting.',
    thud: 'THUD - Controlled contact. Include blocking drills but stop before going to ground. No live tackling.',
    live: 'LIVE/FULL CONTACT - Full contact drills allowed. Include live tackling and full-speed blocking.',
  };
  const contactStr = options.contactLevel
    ? `\n\n**Contact Level:** ${contactLabels[options.contactLevel]}`
    : '';

  // Build equipment instruction
  const equipWornLabels: Record<string, string> = {
    helmets: 'Helmets only - plan drills appropriate for minimal protection',
    shells: 'Shells (helmets + shoulder pads) - can include some contact',
    full_pads: 'Full pads - all drills appropriate',
  };
  const equipWornStr = options.equipmentWorn
    ? `\n\n**Equipment Worn:** ${equipWornLabels[options.equipmentWorn]}`
    : '';

  // Build equipment needed instruction
  const equipNeededStr = options.equipmentNeeded?.length
    ? `\n\n**Equipment Available:** ${options.equipmentNeeded.join(', ')}. Use these in drill descriptions where appropriate.`
    : '';

  // Build coach count instruction
  const coachCount = options.coachCount || 2;
  const coachCountStr = `\n\n**Coaches Available:** ${coachCount} coach${coachCount !== 1 ? 'es' : ''}. You can run at most ${coachCount} concurrent drills at the same time. ${coachCount === 1 ? 'With only 1 coach, keep all drills sequential (no concurrent periods).' : `With ${coachCount} coaches, you can split position groups into ${Math.min(coachCount, 4)} concurrent stations max.`}`;

  // Build conditioning instruction
  let conditioningStr = '';
  if (options.conditioning) {
    if (options.conditioning.type === 'none') {
      conditioningStr = '\n\n**Conditioning:** NO CONDITIONING - Do not include a conditioning period. Use that time for more team work.';
    } else {
      const conditioningDetails: Record<string, string> = {
        sprints: '40-yard sprints with walk-back recovery',
        gassers: 'Sideline-to-sideline gassers',
        ladders: 'Agility ladder footwork and coordination drills',
        shuttles: 'Pro agility 5-10-5 shuttle runs',
        intervals: 'Interval training with run-walk-run cycles',
        bear_crawls: 'Bear crawls combined with bodyweight exercises',
        custom: 'Coach-selected conditioning activities',
      };
      const detail = conditioningDetails[options.conditioning.type] || 'football-specific conditioning';
      conditioningStr = `\n\n**Conditioning:** End practice with ${options.conditioning.duration} minutes of ${options.conditioning.type} - ${detail}`;
    }
  }

  return `Generate a ${duration}-minute practice plan for this team.

${formattedContext}
${focusStr}${gamePrepStr}${opponentStr}${contactStr}${equipWornStr}${equipNeededStr}${coachCountStr}${conditioningStr}

## Requirements for this ${duration}-minute practice:

1. **Start with Coach Talk** (5 min) - Introduction, practice goals, expectations
2. **Warmup** (10-12 min) - Dynamic stretching, form running
3. **Individual/Position Drills** (15-20 min) - ${coachCount > 1 ? `**CONCURRENT** periods where position groups work separately (max ${Math.min(coachCount, 4)} groups):` : '**SEQUENTIAL** drills since only 1 coach is available:'}
   ${coachCount > 1 ? `- Create up to ${Math.min(coachCount, 4)} SEPARATE periods for position groups
   - Mark these as "is_concurrent": true in the JSON
   - These periods run AT THE SAME TIME (don't add their durations separately)` : `- All drills run one after another
   - Do NOT use "is_concurrent": true`}
4. **Group Work** (10-15 min) - OL/RB combos, WR/QB routes, etc.
5. **Team Periods** (remaining time minus conditioning) - Offense vs Defense
6. **Conditioning** (${options.conditioning?.type === 'none' ? 'SKIP' : `${options.conditioning?.duration || 5} min`})

## CRITICAL: Coach Count Constraint (${coachCount} coach${coachCount !== 1 ? 'es' : ''})

${coachCount === 1 ? `With only 1 coach available:
- DO NOT create concurrent periods
- All drills must be sequential
- The whole team works together under the one coach's supervision
- Consider using buddy drills where players can work in pairs` : `With ${coachCount} coaches available, you MUST create EXACTLY ${coachCount} concurrent periods during individual/position drill time:
- Create EXACTLY ${coachCount} periods with "is_concurrent": true
- ALL ${coachCount} concurrent periods MUST have the SAME "start_time" value
- Each period should focus on different position groups
- Example: Coach 1 = OL work, Coach 2 = Skill work${coachCount >= 3 ? `, Coach 3 = Defensive work` : ''}

**REQUIRED EXAMPLE for ${coachCount} concurrent periods at start_time 17:**
\`\`\`json
{
  "name": "Individual - Offensive Line",
  "duration_minutes": 15,
  "period_type": "drill",
  "is_concurrent": true,
  "start_time": 17,
  "notes": "Offensive line fundamentals",
  "drills": [...]
},
{
  "name": "Individual - Skill Positions",
  "duration_minutes": 15,
  "period_type": "drill",
  "is_concurrent": true,
  "start_time": 17,
  "notes": "RB/WR/TE route work",
  "drills": [...]
}${coachCount >= 3 ? `,
{
  "name": "Individual - Defense",
  "duration_minutes": 15,
  "period_type": "drill",
  "is_concurrent": true,
  "start_time": 17,
  "notes": "DL/LB/DB technique work",
  "drills": [...]
}` : ''}
\`\`\`

**IMPORTANT**: These ${coachCount} concurrent periods = 15 minutes total (NOT ${coachCount * 15}!) because they run at the same time.
**IMPORTANT**: You MUST create exactly ${coachCount} concurrent periods - one for each coach!`}

The NON-CONCURRENT periods MUST add up to EXACTLY ${duration} minutes total.

Based on the analytics, prioritize:
- ${context.positionGroupPerformance?.weakestGroup?.groupName || 'Position group'} needs work
- Plays needing drilling: ${context.playDrillCandidates?.needsDrilling?.slice(0, 2).map(p => p.playName).join(', ') || 'N/A'}

Return ONLY the JSON object. No markdown code blocks, no explanation text before or after. Just the raw JSON starting with { and ending with }`;
}

/**
 * Refinement prompt for adjusting generated plans
 */
export function getRefinementPrompt(
  currentPlan: string,
  userFeedback: string
): string {
  return `The coach has requested changes to the practice plan.

Current Plan:
${currentPlan}

Coach's Requested Changes:
${userFeedback}

Please update the practice plan based on this feedback. Keep the same JSON structure.
Only modify what's necessary to address the coach's request.
Return ONLY the updated JSON object.`;
}

/**
 * Analysis prompt for initial team assessment
 */
export function getAnalysisPrompt(formattedContext: string): string {
  return `Based on this team's analytics data, provide a brief analysis of:

1. **Biggest Strength**: What's working well that we should maintain
2. **Primary Weakness**: What most needs practice focus
3. **Secondary Weakness**: Another area needing attention
4. **Suggested Focus**: 2-3 practice emphasis areas

${formattedContext}

Provide a concise 3-4 sentence summary that a coach could quickly understand.`;
}

/**
 * Conversation state types for the chat flow
 */
export type ConversationState =
  | 'game_selection'
  | 'analysis'
  | 'focus_selection'
  | 'duration'
  | 'generating'
  | 'preview'
  | 'refining';

/**
 * Get the appropriate prompt for each conversation state
 */
export function getStatePrompt(state: ConversationState): string {
  switch (state) {
    case 'game_selection':
      return 'Select an upcoming game to prepare for, or choose "General Practice" for team improvement focus.';

    case 'analysis':
      return 'Based on your team\'s analytics, here\'s what I recommend focusing on...';

    case 'focus_selection':
      return 'Would you like to adjust the focus areas, or proceed with these recommendations?';

    case 'duration':
      return 'How long is your practice? (Default: 90 minutes)';

    case 'generating':
      return 'Generating your practice plan...';

    case 'preview':
      return 'Here\'s your practice plan. You can use it as-is, request changes, or regenerate.';

    case 'refining':
      return 'What changes would you like to make?';

    default:
      return '';
  }
}
