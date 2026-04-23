/**
 * POST /api/sidelineiq/analyze
 *
 * SidelineIQ analysis endpoint. Accepts current game state, computes
 * football-intelligent context server-side, and sends structured
 * instructions to Gemini. All proprietary logic stays here, not the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getOpponentTendencies, getOpponentOffensiveTendencies } from '@/lib/services/opponent-analytics.service'
import type { OpponentProfile } from '@/types/football'

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
})

const model = googleAI('gemini-2.5-flash')

// ---------------------------------------------------------------------------
// Helper 1 — Field Zone
// ---------------------------------------------------------------------------

export function computeFieldZone(yardLine: number, fieldLength: number): { label: string; instruction: string } {
  const backedUp = fieldLength * 0.20
  const scoringPos = fieldLength * 0.50
  const redZone = fieldLength * 0.75

  if (yardLine <= backedUp) {
    return {
      label: 'Backed Up',
      instruction: 'Ball security is the priority. No low-percentage throws. Punting is acceptable. Avoid any play risking a turnover inside own 20.',
    }
  }
  if (yardLine < scoringPos) {
    return {
      label: 'Own Territory',
      instruction: 'Stay on schedule. Build momentum. Avoid low-percentage shots downfield.',
    }
  }
  if (yardLine < redZone) {
    return {
      label: 'Scoring Position',
      instruction: 'Intermediate game is open. Calculated shots downfield are acceptable.',
    }
  }
  return {
    label: 'Red Zone',
    instruction: 'Condensed field. Prioritize route combinations, play-action, and compressed formations. Avoid plays requiring deep drops or stretching the field vertically.',
  }
}

// ---------------------------------------------------------------------------
// Helper 2 — Drive Phase Target
// ---------------------------------------------------------------------------

export function computeDrivePhaseTarget(down: number, distance: number): { label: string; instruction: string } {
  if (down === 1) {
    return {
      label: 'stay_on_schedule',
      instruction: '1st down goal is not to gain 10 yards in one play. Prefer plays with 60%+ probability of gaining 4–6 yards. Do not suggest low-percentage shots regardless of potential yardage.',
    }
  }
  if (down === 2) {
    if (distance <= 4) {
      return {
        label: 'convert',
        instruction: 'Short yardage — high-percentage conversion plays only. Run or quick game. Avoid anything with risk of loss.',
      }
    }
    if (distance <= 7) {
      return {
        label: 'stay_on_schedule',
        instruction: 'Stay on schedule. Target 4–5 yards to set up manageable 3rd down. Avoid 3rd and long.',
      }
    }
    return {
      label: 'damage_control',
      instruction: 'Long 2nd down. Gain what you can. Avoid sack or loss of yards above all else.',
    }
  }
  if (down === 3) {
    if (distance <= 3) {
      return {
        label: 'must_convert',
        instruction: 'Must convert. Suggest only the highest-confidence plays for short yardage. Run or quick game.',
      }
    }
    if (distance <= 6) {
      return {
        label: 'convert_calculated',
        instruction: 'Conversion down. Intermediate routes and calculated shots are acceptable. Balance probability with yardage.',
      }
    }
    return {
      label: 'long_conversion',
      instruction: 'Long conversion needed. Shot plays are acceptable. Still avoid turnovers.',
    }
  }
  // down === 4
  return {
    label: 'fourth_down',
    instruction: '4th down — see decision layer output for go/punt/FG guidance.',
  }
}

// ---------------------------------------------------------------------------
// Helper 3 — Time Situation
// ---------------------------------------------------------------------------

export function computeTimeSituation(
  clockStart: string,
  quarter: number,
  quarterLengthMinutes: number,
  scoreMargin: number
): { label: string; instruction: string | null } {
  // Parse MM:SS to seconds
  const parts = clockStart.split(':')
  const clockSeconds = (parseInt(parts[0] || '0', 10) * 60) + parseInt(parts[1] || '0', 10)
  const quarterLengthSeconds = quarterLengthMinutes * 60
  const pctRemaining = quarterLengthSeconds > 0 ? clockSeconds / quarterLengthSeconds : 1

  // Priority order — first match wins
  if (quarter >= 3 && pctRemaining <= 0.25 && scoreMargin >= 10) {
    return {
      label: 'clock_kill',
      instruction: 'Leading late. Suggest clock-killing runs, QB sneaks, safe ball-control plays. Avoid any risk of turnover or incomplete pass.',
    }
  }
  if (quarter >= 3 && pctRemaining <= 0.33 && scoreMargin <= -10) {
    return {
      label: 'hurry_up_trailing',
      instruction: 'Trailing late. Suggest shots downfield, quick sideline routes, plays that stop the clock. Urgency is required.',
    }
  }
  if ((quarter === 2 || quarter === 4) && pctRemaining <= 0.17) {
    return {
      label: 'two_minute_drill',
      instruction: 'Two-minute situation. Suggest quick game, sideline routes, and clock-stopping plays. No huddle tempo assumed. Avoid runs up the middle unless converting short yardage.',
    }
  }
  if (quarter === 1 && pctRemaining >= 0.75) {
    return {
      label: 'early_game',
      instruction: 'Early in the game. Establish base plays. Do not tip the playbook — suggest reliable, multiple-use formations.',
    }
  }
  return { label: 'normal', instruction: null }
}

// ---------------------------------------------------------------------------
// Helper 4 — Opponent Counters
// ---------------------------------------------------------------------------

export function computeOpponentCounters(
  profile: OpponentProfile,
  situationKey: string
): string[] {
  if (profile.totalPlaysAnalyzed < 10) {
    return ['Insufficient opponent data — suggest based on situation and field position only.']
  }

  const counters: string[] = []

  // Blitz rate — situation-specific first, fall back to overall
  // Values are 0-100 percentages
  const sitBlitz = profile.blitzRateBySituation[situationKey]
  const effectiveBlitz = sitBlitz !== undefined ? sitBlitz : profile.blitzRate
  if (effectiveBlitz > 50) {
    counters.push('Opponent blitzes frequently in this situation. Prioritize quick game, screens, and hot routes. Avoid 7-step drops or plays requiring sustained pass protection.')
  }

  if (profile.runStopRate > 60) {
    counters.push('Opponent stops the run effectively. Favor play-action, misdirection, and outside zone. Avoid inside runs into a stacked box.')
  }

  if (profile.passDefenseRate > 60) {
    counters.push('Opponent defends the pass well. Favor the run game, RPO, and play-action to set up later passing downs.')
  }

  // Coverage distribution analysis
  const coverageEntries = Object.entries(profile.coverageDistribution)
  const totalCoverages = coverageEntries.reduce((sum, [, count]) => sum + count, 0)
  if (totalCoverages > 0) {
    const zoneCount = coverageEntries
      .filter(([key]) => key.toLowerCase().includes('zone'))
      .reduce((sum, [, count]) => sum + count, 0)
    const manCount = coverageEntries
      .filter(([key]) => key.toLowerCase().includes('man'))
      .reduce((sum, [, count]) => sum + count, 0)

    if (zoneCount / totalCoverages > 0.40) {
      counters.push('Opponent plays zone coverage predominantly. Flood zones, use mesh and crossing concepts, attack the soft spots between defenders.')
    }
    if (manCount / totalCoverages > 0.40) {
      counters.push('Opponent plays man coverage predominantly. Use motion, pick routes, and rub concepts to create leverage.')
    }
  }

  if (counters.length === 0) {
    return ['No strong tendency signals — suggest based on situation and drive target.']
  }

  return counters
}

// ---------------------------------------------------------------------------
// Helper 5 — Fourth Down Decision
// ---------------------------------------------------------------------------

export function computeFourthDownDecision(
  down: number,
  yardLine: number,
  fieldLength: number,
  distance: number,
  scoreMargin: number,
  pctQuarterRemaining: number,
  quarter: number
): { decision: 'go_for_it' | 'field_goal' | 'punt'; reasoning: string } | null {
  if (down !== 4) return null

  const redZone = fieldLength * 0.75
  const fgRange = fieldLength * 0.60
  const ownTerrEnd = fieldLength * 0.50

  if (yardLine >= redZone && distance <= 3) {
    return { decision: 'go_for_it', reasoning: `4th and ${distance} in the red zone — high-percentage opportunity, go for it.` }
  }
  if (yardLine >= fgRange) {
    return { decision: 'field_goal', reasoning: 'Inside field goal range — attempt the kick.' }
  }
  if (scoreMargin <= -10 && quarter >= 3) {
    return { decision: 'go_for_it', reasoning: 'Trailing by 10+ in the second half — must keep possession, go for it.' }
  }
  if (pctQuarterRemaining <= 0.17 && scoreMargin < 0) {
    return { decision: 'go_for_it', reasoning: 'Late in the period and trailing — go for it to maintain possession.' }
  }
  return { decision: 'punt', reasoning: 'Field position favors a punt — pin them deep.' }
}

// ---------------------------------------------------------------------------
// Helper: parse clock to pct remaining
// ---------------------------------------------------------------------------

function parseClockPct(clockStart: string, quarterLengthMinutes: number): number {
  const parts = clockStart.split(':')
  const clockSeconds = (parseInt(parts[0] || '0', 10) * 60) + parseInt(parts[1] || '0', 10)
  const quarterLengthSeconds = quarterLengthMinutes * 60
  return quarterLengthSeconds > 0 ? clockSeconds / quarterLengthSeconds : 1
}

// ---------------------------------------------------------------------------
// Helper: infer situation key for opponent counter lookup
// ---------------------------------------------------------------------------

function inferSituationKey(down: number, distance: number): string {
  if (down === 1) return '1st_down'
  const dist = distance <= 3 ? 'short' : distance <= 6 ? 'medium' : 'long'
  if (down === 2) return `2nd_${dist}`
  if (down === 3) return `3rd_${dist}`
  return distance <= 2 ? '4th_short' : '3rd_long'
}

// ---------------------------------------------------------------------------
// Main API handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const {
    teamId, gameId, opponentName,
    clock_start = '12:00',
    quarter = 1,
    quarter_length_minutes = 12,
    score_own = 0,
    score_opponent = 0,
    field_length = 100,
    down = 1,
    distance = 10,
    yard_line = 25,
  } = body

  if (!teamId || !gameId) {
    return NextResponse.json({ error: 'teamId and gameId required' }, { status: 400 })
  }

  // Lightweight 4th down AI advice — separate Gemini call, no DB queries
  if (body.askAI4thDown) {
    try {
      const advicePrompt = `A football coach needs advice on a 4th down decision.
Situation: ${down} and ${distance}, yard line ${yard_line} of ${field_length}-yard field,
Q${quarter} with ${clock_start} remaining, score ${score_own}–${score_opponent}.
Should the coach go for it, punt, or attempt a field goal?
Give a direct one-paragraph recommendation with football reasoning. Be concise.`

      const adviceResult = await generateText({ model, prompt: advicePrompt })
      return NextResponse.json({ fourthDownAdvice: adviceResult.text.trim() })
    } catch (err) {
      console.error('[SidelineIQ] 4th down advice error:', err)
      return NextResponse.json({ fourthDownAdvice: 'Unable to generate advice right now.' })
    }
  }

  try {
    // 1. Get game plan plays with full playbook attributes
    const { data: gamePlans } = await supabase
      .from('game_plans')
      .select('id')
      .eq('team_id', teamId)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(1)

    let gamePlanId = gamePlans?.[0]?.id ?? null

    // Fallback to latest team game plan
    if (!gamePlanId) {
      const { data: fallbackPlans } = await supabase
        .from('game_plans')
        .select('id')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)
      gamePlanId = fallbackPlans?.[0]?.id ?? null
    }

    let gamePlanPlays: Array<{
      play_code: string
      call_number: number
      situation: string | null
      side: string
      playbook_plays: {
        play_code: string
        play_name: string
        attributes: Record<string, unknown>
      }
    }> = []

    if (gamePlanId) {
      const { data: gppData } = await supabase
        .from('game_plan_plays')
        .select(`
          play_code,
          call_number,
          situation,
          side,
          playbook_plays (
            play_code,
            play_name,
            attributes
          )
        `)
        .eq('game_plan_id', gamePlanId)
        .order('sort_order', { ascending: true })

      if (gppData) {
        gamePlanPlays = (gppData as unknown[]).filter((row): row is typeof gamePlanPlays[0] => {
          const r = row as Record<string, unknown>
          return r.playbook_plays !== null && !Array.isArray(r.playbook_plays)
        })
      }
    }

    // Fallback: if no game plan plays, use full playbook
    let usingPlaybookFallback = false
    if (gamePlanPlays.length === 0) {
      const { data: playbookData } = await supabase
        .from('playbook_plays')
        .select('play_code, play_name, attributes')
        .eq('team_id', teamId)
        .eq('is_archived', false)
        .order('play_code', { ascending: true })

      if (playbookData && playbookData.length > 0) {
        usingPlaybookFallback = true
        gamePlanPlays = playbookData.map((p) => ({
          play_code: p.play_code,
          call_number: 0,
          situation: null,
          side: ((p.attributes as Record<string, unknown>)?.odk as string)?.toLowerCase() === 'defense' ? 'defense' : 'offense',
          playbook_plays: {
            play_code: p.play_code,
            play_name: p.play_name,
            attributes: p.attributes as Record<string, unknown>,
          },
        }))
      }
    }

    // 2. Get opponent tendencies
    const [defensiveProfile, offensiveProfile] = await Promise.all([
      getOpponentTendencies(teamId, opponentName || '', supabase),
      getOpponentOffensiveTendencies(teamId, opponentName || '', supabase),
    ])

    const totalPlaysAnalyzed = defensiveProfile.totalPlaysAnalyzed + offensiveProfile.totalPlaysAnalyzed

    // 3. Compute situational context
    const fieldZone = computeFieldZone(yard_line, field_length)
    const driveTarget = computeDrivePhaseTarget(down, distance)
    const scoreMargin = score_own - score_opponent
    const timeSituation = computeTimeSituation(clock_start, quarter, quarter_length_minutes, scoreMargin)
    const situationKey = inferSituationKey(down, distance)
    const opponentCounters = computeOpponentCounters(defensiveProfile, situationKey)
    const pctRemaining = parseClockPct(clock_start, quarter_length_minutes)
    const fourthDown = computeFourthDownDecision(down, yard_line, field_length, distance, scoreMargin, pctRemaining, quarter)

    // 4. Build play lists for prompt
    const offensePlays = gamePlanPlays
      .filter(p => p.side === 'offense')
      .map(p => ({
        playCode: p.play_code,
        callNumber: p.call_number || undefined,
        name: p.playbook_plays.play_name,
        type: (p.playbook_plays.attributes.playType as string) ?? 'unknown',
        formation: (p.playbook_plays.attributes.formation as string) ?? '',
        concept: (p.playbook_plays.attributes.runConcept as string) || (p.playbook_plays.attributes.passConcept as string) || '',
      }))

    const defensePlays = gamePlanPlays
      .filter(p => p.side === 'defense')
      .map(p => ({
        playCode: p.play_code,
        callNumber: p.call_number || undefined,
        name: p.playbook_plays.play_name,
        front: (p.playbook_plays.attributes.front as string) ?? '',
        coverage: (p.playbook_plays.attributes.coverage as string) ?? '',
      }))

    // 5. Build the Gemini prompt
    const callNumberNote = usingPlaybookFallback
      ? 'callNumber is not available — this is full playbook mode'
      : 'callNumber is included — use wristband numbers'

    let prompt = `You are a football play-calling assistant helping a coach make the best decision for the current game situation. Suggest plays from the provided playbook only. Never invent play codes. Return only valid JSON, no prose, no markdown fences.

CURRENT SITUATION:
- Down & Distance: ${down} and ${distance}
- Field Position: Yard line ${yard_line} of ${field_length} — ${fieldZone.label}
- Quarter: ${quarter} | Clock: ${clock_start}
- Score: Us ${score_own} – Them ${score_opponent}

FIELD ZONE INSTRUCTION:
${fieldZone.instruction}

DRIVE TARGET:
${driveTarget.instruction}`

    if (timeSituation.instruction) {
      prompt += `

TIME SITUATION — ${timeSituation.label}:
${timeSituation.instruction}`
    }

    if (fourthDown) {
      prompt += `

4TH DOWN DECISION:
Recommended: ${fourthDown.decision.replace(/_/g, ' ')} — ${fourthDown.reasoning}
Suggest plays consistent with this decision only.`
    }

    prompt += `

OPPONENT TENDENCIES — COUNTER INTELLIGENCE:
${opponentCounters.join('\n')}

${usingPlaybookFallback ? 'FULL PLAYBOOK (no game plan selected)' : 'GAME PLAN PLAYS'}:
Offense (${offensePlays.length} plays): ${JSON.stringify(offensePlays)}
Defense (${defensePlays.length} plays): ${JSON.stringify(defensePlays)}

INSTRUCTIONS:
- Return top 3 offense suggestions and top 3 defense suggestions
- Each suggestion must use a playCode that exactly matches one of the plays listed above
- Weight toward the drive target — do not optimize for maximum yardage at the expense of probability
- Apply all field zone constraints — never suggest a deep shot in Backed Up or Red Zone
- Apply all time situation instructions if present
- Apply all opponent counter instructions
- ${callNumberNote}
- For each suggestion return: playCode, callNumber (or null), playName, playType, rationale (one sentence, football-specific, tells the coach WHY this play fits this situation), confidence (0-1)
- Confidence: 0.9+ only with 50+ opponent plays analyzed, 0.7-0.8 with 20-49, 0.5-0.6 with 10-19, 0.3-0.5 with limited/no data

Return format:
{
  "offense": [{"playCode":"PWR-R","callNumber":21,"playName":"Power Right","playType":"run","rationale":"Power run exploits their weak interior against short yardage.","confidence":0.7}],
  "defense": [{"playCode":"COV2","callNumber":71,"playName":"Cover 2","playType":"defense","rationale":"Cover 2 shells limit deep shots in scoring position.","confidence":0.6}]
}`

    const result = await generateText({ model, prompt })
    const jsonText = result.text.trim()
    const cleaned = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')

    let suggestions: Record<string, unknown>
    try {
      suggestions = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: 'Failed to parse AI response',
        raw: cleaned.substring(0, 500),
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      suggestions,
      fourthDownDecision: fourthDown,
      totalPlaysAnalyzed,
      playsInGamePlan: gamePlanPlays.length,
      source: usingPlaybookFallback ? 'playbook' : 'game_plan',
      generatedAt: Date.now(),
    })
  } catch (err) {
    console.error('[SidelineIQ] Analysis error:', err)
    return NextResponse.json({
      error: 'Analysis failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
