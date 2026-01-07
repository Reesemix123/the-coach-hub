/**
 * Intent Classifier
 *
 * Uses Gemini Flash (cheap/fast) to classify user intent into:
 * - help: Questions about the app (how to use features)
 * - coaching: Questions about team performance/strategy
 * - general: General football knowledge questions
 *
 * Also extracts entities for coaching queries like timeframe, situation, topic.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export type Intent = 'help' | 'coaching' | 'general';

export interface ClassificationEntities {
  topic?: string;
  timeframe?: 'recent' | 'season' | 'all_time' | 'game_specific';
  situation?: {
    down?: number;
    distance?: string;
    fieldZone?: 'red_zone' | 'scoring_position' | 'midfield' | 'own_territory';
  };
  formation?: string;
  playType?: 'run' | 'pass' | 'all';
  player?: string;
  comparison?: string;
  opponent?: string;  // Opponent team name for scouting queries
  // Playbook search entities
  targetPosition?: string;  // Position to feature (TE, RB, WR)
  concept?: string;         // Run/pass concept (power, zone, levels)
  personnel?: string;       // Personnel grouping (12, 11, 21)
  odk?: 'offense' | 'defense' | 'special_teams';  // Offense/Defense/Special Teams
}

export interface ClassificationResult {
  intent: Intent;
  confidence: number;
  entities: ClassificationEntities;
  reasoning?: string;
}

// Initialize Gemini Flash for fast classification
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
});

const classifierModel = googleAI('gemini-2.5-flash');

const CLASSIFICATION_PROMPT = `You are an intent classifier for a youth football coaching app called Youth Coach Hub.

Classify the user's message into exactly one of these intents:
- "help": Questions about how to use the app, its features, navigation, or technical issues
- "coaching": Questions about team performance, player stats, play effectiveness, game strategy, or practice recommendations
- "general": General football knowledge not specific to the user's team data

IMPORTANT DISTINCTIONS:
- "How do I upload film?" → help (asking about app feature)
- "How's my run game?" → coaching (asking about team performance)
- "What is Cover 2?" → general (football knowledge)
- "What formations work on 3rd down?" → coaching (team-specific analysis)
- "How do I invite coaches?" → help (app feature)
- "Who's my best rusher?" → coaching (player performance)

For COACHING intents, also extract relevant entities:
- topic: The main subject (run_game, pass_game, turnovers, penalties, formations, player_stats, trends, tendencies, red_zone, third_down, ol_performance, offensive_line, blocking, linemen, defensive_performance, defense, tackling, pass_rush, coverage, secondary, special_teams, kicking, punting, returns, kickoff, punt, field_goal, opponent_scouting, opponent_tendencies, opponent_weaknesses, game_plan, strategy, schedule, games, record, upcoming_games, past_games, game_results, playbook, playbook_search, play_recommendation, practice, practice_schedule, last_practice, next_practice, upcoming_practices, past_practices, last_practice_details, practice_drills, practice_equipment, next_practice_details, etc.)
- timeframe: recent (last 2 games), season (all games), game_specific (specific game mentioned)
- situation: down (1-4), distance (short/medium/long), fieldZone (red_zone, scoring_position, midfield, own_territory)
- formation: specific formation mentioned
- playType: run, pass, or all
- player: player name or jersey number if mentioned
- comparison: what they're comparing (before/after, game vs game, etc.)
- opponent: opponent team name if asking about a specific opponent (e.g., "Lincoln Lions", "Eagles")
- targetPosition: position to feature in playbook search (TE, RB, WR, QB, LB, CB, S)
- concept: run or pass concept to search for (power, zone, levels, mesh, stick, cover 2, cover 3, blitz)
- personnel: personnel grouping to search for (12, 11, 21, 22)
- odk: offense, defense, or special_teams (for playbook searches)

Examples of OL-related topics (use topic: "ol_performance"):
- "How is my offensive line doing?" → ol_performance
- "Who's my best blocker?" → ol_performance
- "Break down OL performance by position" → ol_performance
- "Which lineman is struggling?" → ol_performance

Examples of defensive topics (use topic: "defensive_performance"):
- "Who's my leading tackler?" → defensive_performance
- "How is our pass rush?" → defensive_performance, pass_rush
- "Show me defensive stats" → defensive_performance
- "Who's getting the most sacks?" → defensive_performance
- "How is our secondary in coverage?" → coverage, secondary
- "Which defenders are making plays?" → defensive_performance
- "Break down our defense" → defensive_performance

Examples of special teams topics (use topic: "special_teams"):
- "How is my kicking game?" → special_teams, kicking
- "Who's my best return man?" → special_teams, returns
- "What's our field goal percentage?" → special_teams, field_goal
- "How is our punt coverage?" → special_teams, punting
- "Show me kickoff stats" → special_teams, kickoff
- "How is my kicker doing?" → special_teams, kicking
- "Break down special teams" → special_teams

Examples of opponent/scouting topics (use topic: "opponent_scouting" or "opponent_tendencies"):
- "How can I exploit the Lincoln Lions?" → opponent_scouting, opponent: "Lincoln Lions"
- "What are the Eagles' weaknesses?" → opponent_weaknesses, opponent: "Eagles"
- "Show me Lincoln Lions tendencies" → opponent_tendencies, opponent: "Lincoln Lions"
- "How do I beat the Tigers?" → opponent_scouting, opponent: "Tigers"
- "What does the Lions defense do on 3rd down?" → opponent_tendencies, opponent: "Lions"
- "Scouting report on Roosevelt" → opponent_scouting, opponent: "Roosevelt"
- "Game plan against Hamilton Hawks" → opponent_scouting, opponent: "Hamilton Hawks"

Examples of schedule/game topics (use topic: "schedule", "games", "record", "upcoming_games", "past_games", "game_results"):
- "When is my next game?" → schedule, upcoming_games
- "What's our record this season?" → record
- "When do we play the Eagles?" → schedule, opponent: "Eagles"
- "Show me our schedule" → schedule
- "What games have we played?" → past_games
- "What was the score against Lincoln Lions?" → game_results, opponent: "Lincoln Lions"
- "Where is our next game?" → schedule, upcoming_games
- "How did we do last week?" → past_games, game_results
- "What time is the game Saturday?" → schedule
- "List all our games" → games

Examples of playbook/play search topics (use topic: "playbook", "playbook_search", "play_recommendation"):
- "What plays in my playbook feature the tight end?" → playbook_search, targetPosition: "TE"
- "Show me my run plays" → playbook_search, playType: run
- "What plays should I use from shotgun?" → playbook_search, formation: "Shotgun"
- "Give me a specific play from my playbook" → playbook
- "What power plays do I have?" → playbook_search, concept: "power"
- "Find plays that feature the RB" → playbook_search, targetPosition: "RB"
- "Which plays should I call to target the TE?" → play_recommendation, targetPosition: "TE"
- "List my passing plays" → playbook_search, playType: pass
- "What 12 personnel plays do I have?" → playbook_search, personnel: "12"
- "Show me zone run plays" → playbook_search, concept: "zone", playType: run
- "What defensive plays do I have?" → playbook_search, odk: defense
- "Show me my Cover 3 plays" → playbook_search, odk: defense, concept: "cover 3"
- "What blitz packages are in my playbook?" → playbook_search, odk: defense, concept: "blitz"
- "List my special teams plays" → playbook_search, odk: special_teams
- "What kickoff plays do I have?" → playbook_search, odk: special_teams
- "Show me punt return plays" → playbook_search, odk: special_teams

Examples of practice topics (use topic: "practice", "practice_schedule", "last_practice", "next_practice", "upcoming_practices", "past_practices", "last_practice_details", "practice_drills", "practice_equipment", "next_practice_details"):
- "When is my next practice?" → next_practice
- "When was my last practice?" → last_practice
- "Show me my practice schedule" → practice_schedule
- "What practices do I have coming up?" → upcoming_practices
- "List my past practices" → past_practices
- "How many practices have we had?" → practice
- "When do we practice next?" → next_practice
- "What's on the schedule for practice?" → practice_schedule
- "Show me upcoming practices" → upcoming_practices
- "What did we do in practice?" → last_practice_details
- "What drills did we run?" → practice_drills
- "Show me the drills from last practice" → practice_drills
- "What equipment do I need for practice?" → practice_equipment
- "What's planned for our next practice?" → next_practice_details
- "Tell me about our last practice" → last_practice_details
- "What plays are we working on in practice?" → practice_drills

Respond in valid JSON only (no markdown, no explanation):
{
  "intent": "help" | "coaching" | "general",
  "confidence": 0.0-1.0,
  "entities": { ... },
  "reasoning": "brief explanation"
}`;

/**
 * Classify user intent and extract entities
 */
export async function classifyIntent(
  message: string
): Promise<ClassificationResult> {
  try {
    const result = await generateText({
      model: classifierModel,
      system: CLASSIFICATION_PROMPT,
      prompt: `Classify this message: "${message}"`,
    });

    // Parse the JSON response
    const responseText = result.text.trim();

    // Handle markdown code blocks if present
    let jsonText = responseText;
    if (responseText.startsWith('```')) {
      jsonText = responseText
        .replace(/^```(?:json)?\n?/, '')
        .replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as ClassificationResult;

    // Validate required fields
    if (!parsed.intent || !['help', 'coaching', 'general'].includes(parsed.intent)) {
      console.warn('Invalid intent classification, defaulting to general:', parsed);
      return {
        intent: 'general',
        confidence: 0.5,
        entities: {},
        reasoning: 'Failed to parse intent, using fallback',
      };
    }

    return {
      intent: parsed.intent,
      confidence: parsed.confidence ?? 0.8,
      entities: parsed.entities ?? {},
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('Intent classification error:', error);

    // Fallback: use simple keyword matching
    return fallbackClassification(message);
  }
}

/**
 * Simple keyword-based fallback classification
 * Used when AI classification fails
 */
function fallbackClassification(message: string): ClassificationResult {
  const lowerMessage = message.toLowerCase();

  // Help keywords - app usage questions
  const helpKeywords = [
    'how do i',
    'how to',
    'where is',
    'can\'t find',
    'upload',
    'invite',
    'add coach',
    'delete',
    'settings',
    'account',
    'subscription',
    'password',
    'login',
    'sign up',
    'export',
    'import',
    'button',
    'menu',
    'page',
    'feature',
    'app',
    'doesn\'t work',
    'not working',
    'error',
    'bug',
  ];

  // Coaching keywords - team performance questions
  const coachingKeywords = [
    'my team',
    'my run',
    'my pass',
    'our',
    'we ',
    'player',
    'formation',
    'success rate',
    'yards per',
    'tendencies',
    'trending',
    'best play',
    'worst play',
    'practice',
    'should we',
    'third down',
    '3rd down',
    'red zone',
    'turnovers',
    'fumbles',
    'interceptions',
    'who\'s',
    'who is',
    'which plays',
    'what works',
    'what doesn\'t',
    'improvement',
    'weakness',
    'strength',
    '#',  // Jersey number
  ];

  // Check for help intent
  const isHelp = helpKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  // Check for coaching intent
  const isCoaching = coachingKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  if (isHelp && !isCoaching) {
    return {
      intent: 'help',
      confidence: 0.6,
      entities: {},
      reasoning: 'Keyword match: help topic detected',
    };
  }

  if (isCoaching) {
    return {
      intent: 'coaching',
      confidence: 0.6,
      entities: extractBasicEntities(lowerMessage),
      reasoning: 'Keyword match: coaching topic detected',
    };
  }

  // Default to general
  return {
    intent: 'general',
    confidence: 0.5,
    entities: {},
    reasoning: 'No specific intent detected, defaulting to general',
  };
}

/**
 * Extract basic entities using simple pattern matching
 */
function extractBasicEntities(message: string): ClassificationEntities {
  const entities: ClassificationEntities = {};

  // Detect opponent-related topics first (higher priority)
  const opponentKeywords = ['exploit', 'beat', 'against', 'opponent', 'scouting', 'game plan', 'weakness'];
  const hasOpponentIntent = opponentKeywords.some(k => message.includes(k));

  if (hasOpponentIntent) {
    entities.topic = 'opponent_scouting';
    // Try to extract opponent name - common patterns like "the [Name]" or "[Name]'s"
    const opponentPatterns = [
      /(?:the|against|beat|exploit)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
      /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)'s?\s+(?:weakness|defense|tendenc)/i,
      /scouting\s+(?:report\s+)?(?:on\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    ];
    for (const pattern of opponentPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        entities.opponent = match[1].trim();
        break;
      }
    }
  }
  // Detect topic
  else if (message.includes('offensive line') || message.includes('o-line') || message.includes('oline') ||
      message.includes('lineman') || message.includes('linemen') || message.includes('blocker') ||
      message.includes('blocking') || (message.includes('ol') && message.includes('performance')))
    entities.topic = 'ol_performance';
  else if (message.includes('defense') || message.includes('defensive') || message.includes('tackl') ||
      message.includes('sack') || message.includes('pressure') || message.includes('pass rush') ||
      message.includes('coverage') || message.includes('secondary') || message.includes('cornerback') ||
      message.includes('safety') || message.includes('linebacker') || message.includes('d-line') ||
      message.includes('dline') || message.includes('pbu') || message.includes('break up') ||
      message.includes('havoc') || message.includes('tfl') || message.includes('tackle for loss'))
    entities.topic = 'defensive_performance';
  else if (message.includes('special teams') || message.includes('kicking') || message.includes('kicker') ||
      message.includes('punting') || message.includes('punter') || message.includes('kickoff') ||
      message.includes('punt ') || message.includes('field goal') || message.includes('fg ') ||
      message.includes('return') || message.includes('returner') || message.includes('touchback') ||
      message.includes('fair catch') || message.includes('long snapper') || message.includes('holder') ||
      message.includes('pat') || message.includes('extra point') || message.includes('coverage team'))
    entities.topic = 'special_teams';
  else if (message.includes('run')) entities.topic = 'run_game';
  else if (message.includes('pass')) entities.topic = 'pass_game';
  else if (message.includes('turnover') || message.includes('fumble') || message.includes('interception'))
    entities.topic = 'turnovers';
  else if (message.includes('penalty') || message.includes('flag'))
    entities.topic = 'penalties';
  else if (message.includes('formation')) entities.topic = 'formations';
  else if (message.includes('player') || message.match(/#\d+/))
    entities.topic = 'player_stats';
  else if (message.includes('tendency') || message.includes('tendencies'))
    entities.topic = 'tendencies';
  else if (message.includes('trend')) entities.topic = 'trends';
  // Schedule/games detection
  else if (message.includes('schedule') || message.includes('next game') || message.includes('upcoming') ||
      message.includes('when do we play') || message.includes('when is') || message.includes('what time') ||
      message.includes('where is') && (message.includes('game') || message.includes('play')))
    entities.topic = 'schedule';
  else if (message.includes('record') || message.includes('win') && message.includes('loss') ||
      message.includes('how many wins') || message.includes('how many losses'))
    entities.topic = 'record';
  else if (message.includes('score') && (message.includes('game') || message.includes('against')) ||
      message.includes('what was the score') || message.includes('final score'))
    entities.topic = 'game_results';
  else if (message.includes('past game') || message.includes('games we played') ||
      message.includes('last week') || message.includes('previous game'))
    entities.topic = 'past_games';
  else if (message.includes('game') && !message.includes('game plan'))
    entities.topic = 'games';
  // Practice detection
  else if (message.includes('last practice') || message.includes('previous practice') ||
      message.includes('when was') && message.includes('practice'))
    entities.topic = 'last_practice';
  else if (message.includes('next practice') || message.includes('when do we practice') ||
      message.includes('when is') && message.includes('practice'))
    entities.topic = 'next_practice';
  else if (message.includes('upcoming practice') || message.includes('practices coming') ||
      message.includes('future practice'))
    entities.topic = 'upcoming_practices';
  else if (message.includes('past practice') || message.includes('practices we had') ||
      message.includes('practice history'))
    entities.topic = 'past_practices';
  else if (message.includes('practice schedule') || message.includes('how many practice'))
    entities.topic = 'practice_schedule';
  else if (message.includes('drill') || message.includes('what did we do') && message.includes('practice') ||
      message.includes('tell me about') && message.includes('practice') ||
      message.includes('what we worked on'))
    entities.topic = 'practice_drills';
  else if (message.includes('equipment') && message.includes('practice') ||
      message.includes('what do i need') && message.includes('practice') ||
      message.includes('bring to practice'))
    entities.topic = 'practice_equipment';
  else if (message.includes('planned for') && message.includes('practice') ||
      message.includes('what\'s in') && message.includes('practice'))
    entities.topic = 'next_practice_details';
  else if (message.includes('practice'))
    entities.topic = 'practice';
  // Playbook search detection
  else if (message.includes('playbook') || message.includes('my plays') ||
      message.includes('what plays') || message.includes('which plays') ||
      message.includes('show me') && message.includes('play') ||
      message.includes('find play') || message.includes('list') && message.includes('play') ||
      message.includes('feature') && (message.includes('te') || message.includes('tight end') ||
        message.includes('rb') || message.includes('running back') || message.includes('wr') ||
        message.includes('receiver')))
    entities.topic = 'playbook_search';

  // Detect target position for playbook searches (offense, defense, special teams)
  // Offensive positions
  if (message.includes('te') || message.includes('tight end')) {
    entities.targetPosition = 'TE';
  } else if (message.includes('rb') || message.includes('running back') || message.includes('tailback')) {
    entities.targetPosition = 'RB';
  } else if (message.includes('wr') || message.includes('receiver') || message.includes('wide out')) {
    entities.targetPosition = 'WR';
  } else if (message.includes('qb') || message.includes('quarterback')) {
    entities.targetPosition = 'QB';
  }
  // Offensive line positions
  else if (message.includes('offensive line') || message.includes('o-line') || message.includes('oline') || message.match(/\bol\b/)) {
    entities.targetPosition = 'OL';
  } else if (message.includes('left tackle') || message.match(/\blt\b/)) {
    entities.targetPosition = 'LT';
  } else if (message.includes('left guard') || message.match(/\blg\b/)) {
    entities.targetPosition = 'LG';
  } else if (message.includes('center') && !message.includes('field')) {
    entities.targetPosition = 'C';
  } else if (message.includes('right guard') || message.match(/\brg\b/)) {
    entities.targetPosition = 'RG';
  } else if (message.includes('right tackle') || message.match(/\brt\b/)) {
    entities.targetPosition = 'RT';
  } else if (message.includes('guard') && message.includes('pull')) {
    entities.targetPosition = 'guard';
  }
  // Defensive line positions
  else if (message.includes('defensive line') || message.includes('d-line') || message.includes('dline') || message.match(/\bdl\b/)) {
    entities.targetPosition = 'DL';
  } else if (message.includes('defensive end') || message.match(/\bde\b/) || message.includes('edge')) {
    entities.targetPosition = 'DE';
  } else if (message.includes('defensive tackle') || message.match(/\bdt\b/) || message.includes('nose tackle') || message.includes('nose guard')) {
    entities.targetPosition = 'DT';
  }
  // Other defensive positions
  else if (message.includes('linebacker') || message.match(/\blb\b/)) {
    entities.targetPosition = 'LB';
  } else if (message.includes('cornerback') || message.includes('corner') || message.match(/\bcb\b/)) {
    entities.targetPosition = 'CB';
  } else if (message.includes('safety') || message.match(/\bfs\b/) || message.match(/\bss\b/)) {
    entities.targetPosition = 'S';
  }
  // Special teams positions
  else if (message.includes('kicker') || message.match(/\bk\b/) && message.includes('play')) {
    entities.targetPosition = 'K';
  } else if (message.includes('punter') || message.match(/\bp\b/) && message.includes('play')) {
    entities.targetPosition = 'P';
  } else if (message.includes('returner') || message.match(/\bkr\b/) || message.match(/\bpr\b/)) {
    entities.targetPosition = 'Returner';
  }

  // Detect play concept for playbook searches (offense, defense, special teams)
  // Offensive run concepts
  if (message.includes('power')) {
    entities.concept = 'power';
  } else if (message.includes('zone') && !message.includes('coverage')) {
    entities.concept = 'zone';
  } else if (message.includes('counter')) {
    entities.concept = 'counter';
  } else if (message.includes('trap')) {
    entities.concept = 'trap';
  } else if (message.includes('sweep')) {
    entities.concept = 'sweep';
  }
  // Offensive pass concepts
  else if (message.includes('levels')) {
    entities.concept = 'levels';
  } else if (message.includes('mesh')) {
    entities.concept = 'mesh';
  } else if (message.includes('stick')) {
    entities.concept = 'stick';
  } else if (message.includes('smash')) {
    entities.concept = 'smash';
  } else if (message.includes('four verts') || message.includes('4 verts')) {
    entities.concept = 'four verts';
  }
  // Defensive coverage concepts
  else if (message.includes('cover 0') || message.includes('cover zero')) {
    entities.concept = 'cover 0';
  } else if (message.includes('cover 1')) {
    entities.concept = 'cover 1';
  } else if (message.includes('cover 2')) {
    entities.concept = 'cover 2';
  } else if (message.includes('cover 3')) {
    entities.concept = 'cover 3';
  } else if (message.includes('cover 4') || message.includes('quarters')) {
    entities.concept = 'cover 4';
  } else if (message.includes('cover 6')) {
    entities.concept = 'cover 6';
  } else if (message.includes('man coverage') || message.includes('man-to-man')) {
    entities.concept = 'man';
  } else if (message.includes('zone coverage')) {
    entities.concept = 'zone coverage';
  }
  // Defensive blitz concepts
  else if (message.includes('blitz')) {
    entities.concept = 'blitz';
  } else if (message.includes('fire zone')) {
    entities.concept = 'fire zone';
  } else if (message.includes('zero blitz')) {
    entities.concept = 'zero blitz';
  }
  // Special teams concepts
  else if (message.includes('onside')) {
    entities.concept = 'onside';
  } else if (message.includes('squib')) {
    entities.concept = 'squib';
  } else if (message.includes('pooch')) {
    entities.concept = 'pooch';
  }

  // Detect personnel for playbook searches
  const personnelMatch = message.match(/\b(11|12|13|21|22|23|10|20)\b\s*(?:personnel)?/);
  if (personnelMatch) {
    entities.personnel = personnelMatch[1];
  }

  // Detect ODK (Offense/Defense/Special Teams) for playbook searches
  if (message.includes('defensive') || message.includes('defense play') ||
      message.includes('cover ') || message.includes('blitz') ||
      message.includes('linebacker') || message.includes('cornerback') ||
      message.includes('safety play') || message.includes('zone coverage') ||
      message.includes('man coverage')) {
    entities.odk = 'defense';
  } else if (message.includes('special team') || message.includes('kickoff') ||
      message.includes('punt') || message.includes('field goal') ||
      message.includes('extra point') || message.includes('onside') ||
      message.includes('return play')) {
    entities.odk = 'special_teams';
  } else if (message.includes('offensive') || message.includes('offense play')) {
    entities.odk = 'offense';
  }

  // Detect play type
  if (message.includes('run') && !message.includes('pass')) {
    entities.playType = 'run';
  } else if (message.includes('pass') && !message.includes('run')) {
    entities.playType = 'pass';
  }

  // Detect situation
  if (message.includes('3rd down') || message.includes('third down')) {
    entities.situation = { down: 3 };
  } else if (message.includes('1st down') || message.includes('first down')) {
    entities.situation = { down: 1 };
  } else if (message.includes('2nd down') || message.includes('second down')) {
    entities.situation = { down: 2 };
  } else if (message.includes('4th down') || message.includes('fourth down')) {
    entities.situation = { down: 4 };
  }

  // Detect field zone
  if (message.includes('red zone')) {
    entities.situation = { ...entities.situation, fieldZone: 'red_zone' };
  }

  // Detect timeframe
  if (message.includes('recent') || message.includes('lately') || message.includes('last few')) {
    entities.timeframe = 'recent';
  } else if (message.includes('season') || message.includes('all year') || message.includes('overall')) {
    entities.timeframe = 'season';
  }

  // Detect player reference (jersey number)
  const jerseyMatch = message.match(/#(\d+)/);
  if (jerseyMatch) {
    entities.player = jerseyMatch[1];
  }

  return entities;
}
