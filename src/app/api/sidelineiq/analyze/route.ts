/**
 * POST /api/sidelineiq/analyze
 *
 * Pre-game analysis job for SidelineIQ.
 * Queries game plan plays, opponent film history, and sends
 * structured context to Gemini to generate a SituationalSuggestionMap.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getOpponentTendencies, getOpponentOffensiveTendencies } from '@/lib/services/opponent-analytics.service'

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
})

const model = googleAI('gemini-2.5-flash')

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { teamId, gameId, opponentName } = body

  if (!teamId || !gameId) {
    return NextResponse.json({ error: 'teamId and gameId required' }, { status: 400 })
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

    // 2. Get opponent tendencies
    const [defensiveProfile, offensiveProfile] = await Promise.all([
      getOpponentTendencies(teamId, opponentName || '', supabase),
      getOpponentOffensiveTendencies(teamId, opponentName || '', supabase),
    ])

    const totalPlaysAnalyzed = defensiveProfile.totalPlaysAnalyzed + offensiveProfile.totalPlaysAnalyzed

    // 3. Build Gemini prompt
    const offensePlays = gamePlanPlays
      .filter(p => p.side === 'offense')
      .map(p => ({
        playCode: p.play_code,
        callNumber: p.call_number,
        name: p.playbook_plays.play_name,
        type: (p.playbook_plays.attributes.playType as string) ?? 'unknown',
        formation: (p.playbook_plays.attributes.formation as string) ?? '',
        concept: (p.playbook_plays.attributes.runConcept as string) || (p.playbook_plays.attributes.passConcept as string) || '',
      }))

    const defensePlays = gamePlanPlays
      .filter(p => p.side === 'defense')
      .map(p => ({
        playCode: p.play_code,
        callNumber: p.call_number,
        name: p.playbook_plays.play_name,
        front: (p.playbook_plays.attributes.front as string) ?? '',
        coverage: (p.playbook_plays.attributes.coverage as string) ?? '',
      }))

    const prompt = `You are a football analytics engine. Return only valid JSON, no prose, no markdown fences.

CONTEXT:
- Opponent: ${opponentName || 'Unknown'}
- Opponent film plays analyzed: ${totalPlaysAnalyzed} (${totalPlaysAnalyzed < 10 ? 'LIMITED DATA — use general football situational logic' : totalPlaysAnalyzed < 20 ? 'MODERATE DATA' : 'GOOD DATA'})
${totalPlaysAnalyzed >= 10 ? `- Opponent defensive tendencies: blitz rate ${defensiveProfile.blitzRate}%, run stop rate ${defensiveProfile.runStopRate}%, pass defense rate ${defensiveProfile.passDefenseRate}%
- Coverage distribution: ${JSON.stringify(defensiveProfile.coverageDistribution)}
- Opponent offensive tendencies: run/pass split ${JSON.stringify((offensiveProfile as unknown as Record<string, unknown>).runPassSplit || {})}` : ''}

GAME PLAN PLAYS:
Offense (${offensePlays.length}): ${JSON.stringify(offensePlays)}
Defense (${defensePlays.length}): ${JSON.stringify(defensePlays)}

Generate a SituationalSuggestionMap JSON object. Keys are situation strings like "1_short_midfield_offense". For each key, include top 3 offense plays, top 3 defense plays.

Each SuggestedPlay has: playCode (must match a play from the game plan), callNumber, reason (max 6 words), confidence (0-1).

Situation keys to generate (all combinations):
Downs: 1, 2, 3, 4
Distance: short (1-3yd), medium (4-7yd), long (8+yd), goal_line (93+ yl)
Field: own_territory, midfield, scoring, red_zone
Side: offense, defense

Only include keys where you have game plan plays to suggest. Skip keys with no relevant plays.
Confidence: 0.9+ only with 50+ analyzed plays, 0.7-0.8 with 20-49 plays, 0.5-0.6 with 10-19 plays, 0.3-0.5 with limited/no data.
Reason should be concise football wisdom: "Beats Cover 3 seam" or "Power run short yardage".

Return format:
{
  "1_short_midfield_offense": {
    "offense": [{"playCode":"PWR-R","callNumber":21,"reason":"Power run short yardage","confidence":0.7}],
    "defense": [],
    "specialTeams": []
  }
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
      totalPlaysAnalyzed,
      playsInGamePlan: gamePlanPlays.length,
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
