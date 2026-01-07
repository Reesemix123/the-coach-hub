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
- topic: The main subject (run_game, pass_game, turnovers, penalties, formations, player_stats, trends, tendencies, red_zone, third_down, ol_performance, offensive_line, blocking, linemen, defensive_performance, defense, tackling, pass_rush, coverage, secondary, special_teams, kicking, punting, returns, kickoff, punt, field_goal, opponent_scouting, opponent_tendencies, opponent_weaknesses, game_plan, strategy, etc.)
- timeframe: recent (last 2 games), season (all games), game_specific (specific game mentioned)
- situation: down (1-4), distance (short/medium/long), fieldZone (red_zone, scoring_position, midfield, own_territory)
- formation: specific formation mentioned
- playType: run, pass, or all
- player: player name or jersey number if mentioned
- comparison: what they're comparing (before/after, game vs game, etc.)
- opponent: opponent team name if asking about a specific opponent (e.g., "Lincoln Lions", "Eagles")

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
