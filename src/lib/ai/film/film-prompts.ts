// src/lib/ai/film/film-prompts.ts
// AI prompts for film analysis at different tagging tiers

export const QUALITY_ASSESSMENT_PROMPT = `Analyze this football game film sample (first 30 seconds) and assess recording quality for AI-assisted play tagging.

**Evaluate:**

1. Camera:
   - Angle: sideline, endzone, elevated (press box), drone, or mixed
   - Stability: steady (tripod), moderate (handheld stable), shaky
   - Field visibility: full (whole field), partial (60-80%), limited (<60%)

2. Audio (if present):
   - Can you hear whistles clearly?
   - Can you hear snap cadence?

3. Quality Score: 1-10 overall usefulness for AI play tagging

**Based on this assessment, indicate what AI can reliably detect:**
- Play type (run/pass): high/medium/low confidence expected
- Direction (left/middle/right): high/medium/low
- Formation: high/medium/low
- Result: high/medium/low
- Yards gained: high/medium/low

**Provide 2-3 specific tips for better film next game.**

Return ONLY valid JSON (no markdown):
{
  "camera_angle": "sideline",
  "stability": "steady",
  "field_visibility": "partial",
  "quality_score": 7,
  "audio": {
    "available": true,
    "quality": "moderate",
    "can_hear_whistle": true,
    "can_hear_cadence": false
  },
  "ai_capabilities": {
    "play_type": { "expected_confidence": "high", "notes": "" },
    "direction": { "expected_confidence": "high", "notes": "" },
    "formation": { "expected_confidence": "medium", "notes": "Distance limits detail" },
    "result": { "expected_confidence": "high", "notes": "" },
    "yards_gained": { "expected_confidence": "low", "notes": "Yard markers not fully visible" }
  },
  "improvement_tips": [
    "Move camera to midfield for balanced view of both directions",
    "Elevate camera 10-15 feet to see over players on sideline"
  ]
}`;

export const QUICK_TAG_PROMPT = `Analyze this football play clip and suggest tags for QUICK tagging mode.

**Context:**
- Team level: {team_level}
- Our team is on: {offense_or_defense}
- Film quality: {quality_score}/10
- Audio available: {audio_available}

**Analyze these Quick Tag fields ONLY:**
- play_type: "run", "pass", or "special_teams"
- direction: "left", "middle", "right"
- result: For runs (gain, loss, no_gain, fumble, touchdown). For passes (complete, incomplete, interception, touchdown, sack)
- yards_gained: Estimate yards (negative for losses, use your best judgment)

**If audio is available, use it to:**
- Confirm play timing (whistle, snap)
- Increase confidence when audio confirms visual

Return ONLY valid JSON (no markdown):
{
  "play_type": { "value": "pass", "confidence": 85 },
  "direction": { "value": "right", "confidence": 78 },
  "result": { "value": "complete", "confidence": 90 },
  "yards_gained": { "value": 12, "confidence": 55, "notes": "Estimated - yard lines partially visible" },
  "audio_used": true,
  "reasoning": "Brief explanation of what you observed"
}

**Confidence Guidelines:**
- 80-100: Very clear, high certainty
- 60-79: Reasonably confident
- 40-59: Best guess, coach should verify
- Below 40: Uncertain, flag for review`;

export const STANDARD_TAG_PROMPT = `Analyze this football play clip and suggest tags for STANDARD tagging mode.

**Context:**
- Team level: {team_level}
- Our team is on: {offense_or_defense}
- Film quality: {quality_score}/10
- Audio available: {audio_available}
- Previous play context: {previous_play_context}

**Analyze these Standard Tag fields:**

Basic (from Quick):
- play_type: "run", "pass", "special_teams"
- direction: "left", "middle", "right"
- result: (see Quick Tag options)
- yards_gained: Estimate

Additional Standard fields:
- formation: Common formations (shotgun, pistol, i_form, singleback, empty, spread, wing_t, goal_line, etc.)
- personnel: If identifiable (11, 12, 21, 22, 10, etc. - first digit = RBs, second = TEs)
- hash: "left", "middle", "right" (where ball is spotted)
- down: 1-4 if visible or deducible
- distance: Yards to go if visible

Return ONLY valid JSON (no markdown):
{
  "play_type": { "value": "pass", "confidence": 85 },
  "direction": { "value": "right", "confidence": 78 },
  "result": { "value": "complete", "confidence": 90 },
  "yards_gained": { "value": 12, "confidence": 55 },
  "formation": { "value": "shotgun", "confidence": 72, "notes": "4 WR visible" },
  "personnel": { "value": "11", "confidence": 65 },
  "hash": { "value": "left", "confidence": 80 },
  "down": { "value": 2, "confidence": 40, "notes": "Not visible, guessing from context" },
  "distance": { "value": 7, "confidence": 40 },
  "audio_used": false,
  "fields_uncertain": ["down", "distance", "yards_gained"],
  "reasoning": "Brief explanation of what you observed"
}`;

export const COMPREHENSIVE_TAG_PROMPT = `Analyze this football play clip in detail for COMPREHENSIVE tagging mode.

**Context:**
- Team level: {team_level}
- Our team is on: {offense_or_defense}
- Film quality: {quality_score}/10
- Audio available: {audio_available}
- Previous play context: {previous_play_context}
- Team's playbook formations: {playbook_formations}

**Analyze ALL detectable fields:**

Basic (Quick):
- play_type, direction, result, yards_gained

Formation & Personnel (Standard):
- formation (match to team's playbook if possible)
- personnel
- hash
- down, distance

Situational (Comprehensive):
- field_zone: "own_territory", "midfield", "opponent_territory", "red_zone"
- quarter: 1-4 if visible
- motion: true/false (was there pre-snap motion?)
- play_action: true/false (for passes)

Play Details (if detectable):
- run_concept: "inside_zone", "outside_zone", "power", "counter", "sweep", "draw", "dive" (for runs)
- pass_concept: "quick_game", "dropback", "screen", "play_action", "rollout" (for passes)

**Do NOT guess at:**
- Specific play name from playbook
- Player grades
- Individual blocking assignments

Return ONLY valid JSON (no markdown):
{
  "play_type": { "value": "pass", "confidence": 85 },
  "direction": { "value": "right", "confidence": 78 },
  "result": { "value": "complete", "confidence": 90 },
  "yards_gained": { "value": 12, "confidence": 55 },
  "formation": { "value": "shotgun", "confidence": 72 },
  "personnel": { "value": "11", "confidence": 65 },
  "hash": { "value": "left", "confidence": 80 },
  "down": { "value": 2, "confidence": 40 },
  "distance": { "value": 7, "confidence": 40 },
  "field_zone": { "value": "midfield", "confidence": 75 },
  "quarter": { "value": 2, "confidence": 30 },
  "motion": { "value": true, "confidence": 85 },
  "play_action": { "value": false, "confidence": 90 },
  "pass_concept": { "value": "quick_game", "confidence": 60 },
  "audio_used": false,
  "fields_uncertain": ["down", "distance", "quarter"],
  "reasoning": "Detailed explanation of what you observed and why you made these predictions"
}`;

// Helper to fill in prompt templates
export function buildPrompt(
  template: string,
  context: {
    team_level?: string;
    offense_or_defense?: 'offense' | 'defense';
    quality_score?: number;
    audio_available?: boolean;
    previous_play_context?: string;
    playbook_formations?: string[];
  }
): string {
  return template
    .replace('{team_level}', context.team_level || 'High School')
    .replace('{offense_or_defense}', context.offense_or_defense || 'offense')
    .replace('{quality_score}', String(context.quality_score || 7))
    .replace('{audio_available}', context.audio_available ? 'Yes' : 'No')
    .replace('{previous_play_context}', context.previous_play_context || 'None')
    .replace(
      '{playbook_formations}',
      context.playbook_formations?.join(', ') || 'Standard formations'
    );
}
