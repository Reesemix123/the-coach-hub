/**
 * Seed Opponent Teams with Complete Data
 *
 * Creates 8 opponent teams with:
 * - Unique team profiles and tendencies
 * - Full rosters (27 players each)
 * - Team-specific playbook plays
 * - Season games (including vs Central Eagles)
 * - Videos (using same source video)
 * - Play instances with team-specific tendencies
 *
 * Run: npx tsx scripts/seed-opponent-teams.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Central Eagles team ID (for reference)
const CENTRAL_EAGLES_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// Source video to copy for all games
const SOURCE_VIDEO = {
  name: 'Game Film',
  file_path: 'game-film/test-game.mp4',
  url: 'https://storage.example.com/game-film/test-game.mp4',
};

// ============================================
// TEAM PROFILES
// ============================================
interface TeamProfile {
  id: string;
  name: string;
  mascot: string;
  level: string;
  colors: { primary: string; secondary: string };
  offensiveStyle: 'spread' | 'power' | 'west_coast' | 'air_raid' | 'option' | 'pro_style';
  defensiveStyle: '4-3' | '3-4' | 'nickel' | '4-2-5' | '3-3-5';
  runPassRatio: number; // 0-1, higher = more run
  strengths: string[];
  weaknesses: string[];
  starPositions: string[]; // Positions with standout players
  record: { wins: number; losses: number };
  pointsFor: number;
  pointsAgainst: number;
}

const OPPONENT_TEAMS: TeamProfile[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Lincoln Lions',
    mascot: 'Lions',
    level: 'varsity',
    colors: { primary: '#B8860B', secondary: '#000000' },
    offensiveStyle: 'spread',
    defensiveStyle: 'nickel',
    runPassRatio: 0.35, // Pass-heavy
    strengths: ['QB arm', 'WR depth', 'Secondary'],
    weaknesses: ['Run defense', 'Offensive line'],
    starPositions: ['QB', 'WR', 'CB'],
    record: { wins: 5, losses: 3 },
    pointsFor: 196,
    pointsAgainst: 168,
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Roosevelt Roughriders',
    mascot: 'Roughriders',
    level: 'varsity',
    colors: { primary: '#8B0000', secondary: '#FFD700' },
    offensiveStyle: 'power',
    defensiveStyle: '4-3',
    runPassRatio: 0.72, // Very run-heavy
    strengths: ['Power run game', 'Offensive line', 'Linebackers'],
    weaknesses: ['Pass coverage', 'Deep ball'],
    starPositions: ['RB', 'OL', 'MLB'],
    record: { wins: 7, losses: 1 },
    pointsFor: 224,
    pointsAgainst: 112,
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Jefferson Jaguars',
    mascot: 'Jaguars',
    level: 'varsity',
    colors: { primary: '#006400', secondary: '#FFD700' },
    offensiveStyle: 'west_coast',
    defensiveStyle: '3-4',
    runPassRatio: 0.48, // Balanced
    strengths: ['Short passing', 'Ball control', 'Pass rush'],
    weaknesses: ['Big plays', 'Red zone offense'],
    starPositions: ['TE', 'OLB', 'DE'],
    record: { wins: 3, losses: 5 },
    pointsFor: 140,
    pointsAgainst: 182,
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Washington Wolves',
    mascot: 'Wolves',
    level: 'varsity',
    colors: { primary: '#4B0082', secondary: '#C0C0C0' },
    offensiveStyle: 'air_raid',
    defensiveStyle: '4-2-5',
    runPassRatio: 0.25, // Very pass-heavy
    strengths: ['Vertical passing', 'Tempo', 'Slot receivers'],
    weaknesses: ['Run game', 'Time of possession', 'Run defense'],
    starPositions: ['QB', 'Slot WR', 'FS'],
    record: { wins: 6, losses: 2 },
    pointsFor: 252,
    pointsAgainst: 196,
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Adams Arrows',
    mascot: 'Arrows',
    level: 'varsity',
    colors: { primary: '#FF4500', secondary: '#FFFFFF' },
    offensiveStyle: 'option',
    defensiveStyle: '3-3-5',
    runPassRatio: 0.78, // Option-heavy
    strengths: ['Read option', 'Misdirection', 'Secondary'],
    weaknesses: ['Passing game', 'Size'],
    starPositions: ['QB', 'RB', 'SS'],
    record: { wins: 2, losses: 6 },
    pointsFor: 126,
    pointsAgainst: 210,
  },
  {
    id: '11111111-1111-1111-1111-111111111106',
    name: 'Madison Mustangs',
    mascot: 'Mustangs',
    level: 'varsity',
    colors: { primary: '#000080', secondary: '#FFD700' },
    offensiveStyle: 'pro_style',
    defensiveStyle: '4-3',
    runPassRatio: 0.52, // Balanced pro-style
    strengths: ['Play action', 'Tight end usage', 'Run defense'],
    weaknesses: ['Speed', 'Deep coverage'],
    starPositions: ['TE', 'FB', 'DT'],
    record: { wins: 4, losses: 4 },
    pointsFor: 168,
    pointsAgainst: 168,
  },
  {
    id: '11111111-1111-1111-1111-111111111107',
    name: 'Monroe Monarchs',
    mascot: 'Monarchs',
    level: 'varsity',
    colors: { primary: '#800080', secondary: '#GOLD' },
    offensiveStyle: 'spread',
    defensiveStyle: 'nickel',
    runPassRatio: 0.40, // Spread balanced
    strengths: ['RPO', 'Crossing routes', 'Zone coverage'],
    weaknesses: ['Goal line', 'Power situations'],
    starPositions: ['QB', 'WR', 'NCB'],
    record: { wins: 6, losses: 2 },
    pointsFor: 210,
    pointsAgainst: 154,
  },
  {
    id: '11111111-1111-1111-1111-111111111108',
    name: 'Hamilton Hawks',
    mascot: 'Hawks',
    level: 'varsity',
    colors: { primary: '#228B22', secondary: '#FFFFFF' },
    offensiveStyle: 'power',
    defensiveStyle: '3-4',
    runPassRatio: 0.65, // Run-first
    strengths: ['Counter plays', 'Defensive line', 'Special teams'],
    weaknesses: ['Secondary', 'Pass protection'],
    starPositions: ['RB', 'DE', 'K'],
    record: { wins: 3, losses: 5 },
    pointsFor: 154,
    pointsAgainst: 189,
  },
];

// ============================================
// PLAYER NAME GENERATORS
// ============================================
const FIRST_NAMES = [
  'James', 'Michael', 'David', 'Chris', 'Daniel', 'Matthew', 'Anthony', 'Andrew',
  'Joshua', 'Brandon', 'Tyler', 'Ryan', 'Justin', 'Kevin', 'Jason', 'Marcus',
  'Eric', 'Brian', 'Aaron', 'Derek', 'Corey', 'Trevor', 'Kyle', 'Jordan',
  'Cameron', 'Austin', 'Caleb', 'Isaiah', 'Jaylen', 'Deshawn', 'Marcus', 'Terrell',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
  'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee',
  'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall',
  'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams',
];

function getRandomName(): { first: string; last: string } {
  return {
    first: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)],
    last: LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)],
  };
}

// ============================================
// ROSTER GENERATION
// ============================================
interface PlayerData {
  id: string;
  team_id: string;
  jersey_number: string;
  first_name: string;
  last_name: string;
  position_depths: Record<string, number>; // e.g., {"QB": 1, "RB": 2}
  is_active: boolean;
  grade_level: string;
}

const ROSTER_TEMPLATE = [
  // Offense
  { position: 'QB', group: 'offense', count: 2 },
  { position: 'RB', group: 'offense', count: 3 },
  { position: 'FB', group: 'offense', count: 1 },
  { position: 'WR', group: 'offense', count: 4 },
  { position: 'TE', group: 'offense', count: 2 },
  { position: 'LT', group: 'offense', count: 1 },
  { position: 'LG', group: 'offense', count: 1 },
  { position: 'C', group: 'offense', count: 1 },
  { position: 'RG', group: 'offense', count: 1 },
  { position: 'RT', group: 'offense', count: 1 },
  // Defense
  { position: 'DE', group: 'defense', count: 2 },
  { position: 'DT', group: 'defense', count: 2 },
  { position: 'MLB', group: 'defense', count: 1 },
  { position: 'OLB', group: 'defense', count: 2 },
  { position: 'CB', group: 'defense', count: 2 },
  { position: 'FS', group: 'defense', count: 1 },
  { position: 'SS', group: 'defense', count: 1 },
  // Special Teams
  { position: 'K', group: 'special_teams', count: 1 },
  { position: 'P', group: 'special_teams', count: 1 },
];

function generateRoster(teamId: string): PlayerData[] {
  const players: PlayerData[] = [];
  let jerseyNum = 1;

  for (const pos of ROSTER_TEMPLATE) {
    for (let depth = 1; depth <= pos.count; depth++) {
      const name = getRandomName();
      players.push({
        id: randomUUID(),
        team_id: teamId,
        jersey_number: String(jerseyNum++),
        first_name: name.first,
        last_name: name.last,
        position_depths: { [pos.position]: depth }, // e.g., {"QB": 1}
        is_active: true,
        grade_level: depth === 1 ? 'Senior' : depth === 2 ? 'Junior' : 'Sophomore',
      });
    }
  }

  return players;
}

// ============================================
// PLAYBOOK GENERATION BY STYLE
// ============================================
interface PlayData {
  id: string;
  team_id: string;
  play_code: string;
  play_name: string;
  attributes: {
    odk: string;
    formation: string;
    playType: string;
    personnel?: string;
    runConcept?: string;
    passConcept?: string;
  };
}

const PLAYS_BY_STYLE: Record<string, Array<{ name: string; odk: string; formation: string; playType: string; concept?: string }>> = {
  spread: [
    { name: 'Bubble Screen', odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', concept: 'Screen' },
    { name: 'RPO Slant', odk: 'offense', formation: 'Shotgun Spread', playType: 'RPO', concept: 'Slant' },
    { name: 'Four Verts', odk: 'offense', formation: 'Shotgun Empty', playType: 'Pass', concept: 'Verticals' },
    { name: 'Zone Read', odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', concept: 'Zone Read' },
    { name: 'Mesh Concept', odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', concept: 'Mesh' },
    { name: 'Inside Zone', odk: 'offense', formation: 'Shotgun', playType: 'Run', concept: 'Inside Zone' },
    { name: 'Swing Pass', odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', concept: 'Swing' },
    { name: 'Nickel Zone', odk: 'defense', formation: 'Nickel', playType: 'Coverage', concept: 'Cover 3' },
    { name: 'Nickel Blitz', odk: 'defense', formation: 'Nickel', playType: 'Blitz', concept: 'NCB Blitz' },
  ],
  power: [
    { name: 'Power Right', odk: 'offense', formation: 'I-Formation', playType: 'Run', concept: 'Power' },
    { name: 'Power Left', odk: 'offense', formation: 'I-Formation', playType: 'Run', concept: 'Power' },
    { name: 'Iso', odk: 'offense', formation: 'I-Formation', playType: 'Run', concept: 'Isolation' },
    { name: 'Dive', odk: 'offense', formation: 'I-Formation Strong', playType: 'Run', concept: 'Dive' },
    { name: 'Counter', odk: 'offense', formation: 'I-Formation', playType: 'Run', concept: 'Counter' },
    { name: 'Play Action Boot', odk: 'offense', formation: 'I-Formation', playType: 'Pass', concept: 'Bootleg' },
    { name: 'FB Dive', odk: 'offense', formation: 'Goal Line', playType: 'Run', concept: 'FB Dive' },
    { name: '4-3 Under', odk: 'defense', formation: '4-3 Under', playType: 'Coverage', concept: 'Cover 2' },
    { name: 'Run Blitz', odk: 'defense', formation: '4-3', playType: 'Blitz', concept: 'A-Gap' },
  ],
  west_coast: [
    { name: 'Slant-Flat', odk: 'offense', formation: 'Pro Set', playType: 'Pass', concept: 'Slant-Flat' },
    { name: 'Curl-Flat', odk: 'offense', formation: 'Twins', playType: 'Pass', concept: 'Curl-Flat' },
    { name: 'Cross Concept', odk: 'offense', formation: 'Pro Set', playType: 'Pass', concept: 'Cross' },
    { name: 'Drive Concept', odk: 'offense', formation: 'Pro Set', playType: 'Pass', concept: 'Drive' },
    { name: 'Inside Zone', odk: 'offense', formation: 'Pro Set', playType: 'Run', concept: 'Inside Zone' },
    { name: 'Outside Zone', odk: 'offense', formation: 'Twins', playType: 'Run', concept: 'Outside Zone' },
    { name: 'TE Seam', odk: 'offense', formation: '22 Personnel', playType: 'Pass', concept: 'Seam' },
    { name: '3-4 Base', odk: 'defense', formation: '3-4', playType: 'Coverage', concept: 'Cover 3' },
    { name: 'Edge Rush', odk: 'defense', formation: '3-4', playType: 'Blitz', concept: 'OLB Edge' },
  ],
  air_raid: [
    { name: 'Y-Cross', odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', concept: 'Sail' },
    { name: 'Mesh', odk: 'offense', formation: 'Shotgun Empty', playType: 'Pass', concept: 'Mesh' },
    { name: 'Four Verticals', odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', concept: 'Verticals' },
    { name: 'Stick', odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', concept: 'Stick' },
    { name: 'Smash', odk: 'offense', formation: 'Shotgun Twins', playType: 'Pass', concept: 'Smash' },
    { name: 'Shallow Cross', odk: 'offense', formation: 'Shotgun Empty', playType: 'Pass', concept: 'Shallow' },
    { name: 'Quick Screen', odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', concept: 'Screen' },
    { name: 'Dime Coverage', odk: 'defense', formation: '4-2-5', playType: 'Coverage', concept: 'Cover 4' },
    { name: 'Zone Blitz', odk: 'defense', formation: '4-2-5', playType: 'Blitz', concept: 'Zone Blitz' },
  ],
  option: [
    { name: 'Triple Option', odk: 'offense', formation: 'Flexbone', playType: 'Run', concept: 'Triple Option' },
    { name: 'Speed Option', odk: 'offense', formation: 'Shotgun', playType: 'Run', concept: 'Speed Option' },
    { name: 'Midline', odk: 'offense', formation: 'Flexbone', playType: 'Run', concept: 'Midline' },
    { name: 'Veer', odk: 'offense', formation: 'Wishbone', playType: 'Run', concept: 'Veer' },
    { name: 'Counter Option', odk: 'offense', formation: 'Flexbone', playType: 'Run', concept: 'Counter Option' },
    { name: 'Play Action Pass', odk: 'offense', formation: 'Flexbone', playType: 'Pass', concept: 'PA Wheel' },
    { name: 'QB Sneak', odk: 'offense', formation: 'Under Center', playType: 'Run', concept: 'Sneak' },
    { name: 'Split Field', odk: 'defense', formation: '3-3-5', playType: 'Coverage', concept: 'Cover 6' },
    { name: 'Scrape Exchange', odk: 'defense', formation: '3-3-5', playType: 'Blitz', concept: 'Scrape' },
  ],
  pro_style: [
    { name: 'Power O', odk: 'offense', formation: 'Pro Set', playType: 'Run', concept: 'Power' },
    { name: 'Play Action', odk: 'offense', formation: 'I-Formation', playType: 'Pass', concept: 'PA Boot' },
    { name: 'Draw', odk: 'offense', formation: 'Shotgun', playType: 'Run', concept: 'Draw' },
    { name: 'TE Flood', odk: 'offense', formation: '22 Personnel', playType: 'Pass', concept: 'Flood' },
    { name: 'Zone Stretch', odk: 'offense', formation: 'Pro Set', playType: 'Run', concept: 'Outside Zone' },
    { name: 'Deep Post', odk: 'offense', formation: 'Pro Set', playType: 'Pass', concept: 'Post' },
    { name: 'Toss Sweep', odk: 'offense', formation: 'I-Formation', playType: 'Run', concept: 'Toss' },
    { name: '4-3 Over', odk: 'defense', formation: '4-3 Over', playType: 'Coverage', concept: 'Cover 2' },
    { name: 'Tampa 2', odk: 'defense', formation: '4-3', playType: 'Coverage', concept: 'Tampa 2' },
  ],
};

function generatePlaybook(teamId: string, style: string, teamName: string): PlayData[] {
  const plays: PlayData[] = [];
  const stylePlays = PLAYS_BY_STYLE[style] || PLAYS_BY_STYLE.pro_style;

  stylePlays.forEach((play, index) => {
    plays.push({
      id: randomUUID(),
      team_id: teamId,
      play_code: `${teamName.substring(0, 3).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
      play_name: play.name,
      attributes: {
        odk: play.odk,
        formation: play.formation,
        playType: play.playType,
        ...(play.odk === 'offense' && play.playType === 'Run' ? { runConcept: play.concept } : {}),
        ...(play.odk === 'offense' && play.playType === 'Pass' ? { passConcept: play.concept } : {}),
      },
    });
  });

  return plays;
}

// ============================================
// GAME SCHEDULE FOR EACH TEAM
// ============================================
interface GameData {
  id: string;
  team_id: string;
  name: string;
  opponent: string;
  opponent_id?: string;
  date: string;
  team_score: number;
  opponent_score: number;
  game_result: string;
}

// Map of game results from Central Eagles perspective
const CENTRAL_GAMES_RESULTS = [
  { opponent: 'Lincoln Lions', centralScore: 21, oppScore: 14, week: 1 },
  { opponent: 'Roosevelt Roughriders', centralScore: 14, oppScore: 28, week: 2 },
  { opponent: 'Jefferson Jaguars', centralScore: 28, oppScore: 7, week: 3 },
  { opponent: 'Washington Wolves', centralScore: 17, oppScore: 21, week: 4 },
  { opponent: 'Adams Arrows', centralScore: 35, oppScore: 14, week: 5 },
  { opponent: 'Madison Mustangs', centralScore: 24, oppScore: 21, week: 6 },
  { opponent: 'Monroe Monarchs', centralScore: 7, oppScore: 14, week: 7 },
  { opponent: 'Hamilton Hawks', centralScore: 28, oppScore: 21, week: 8 },
];

function generateGamesForTeam(team: TeamProfile): GameData[] {
  const games: GameData[] = [];
  const baseDate = new Date('2024-09-06'); // Season starts first Friday of September

  // Find game vs Central Eagles and other opponents
  const vsCentral = CENTRAL_GAMES_RESULTS.find(g => g.opponent === team.name);

  // Create 8-game schedule for this team
  const opponents = [
    { name: 'Central Eagles', id: CENTRAL_EAGLES_ID },
    ...OPPONENT_TEAMS.filter(t => t.id !== team.id).slice(0, 7).map(t => ({ name: t.name, id: t.id })),
  ];

  // Distribute wins/losses across the season
  let winsRemaining = team.record.wins;
  let lossesRemaining = team.record.losses;

  opponents.forEach((opp, week) => {
    const gameDate = new Date(baseDate);
    gameDate.setDate(gameDate.getDate() + (week * 7));

    let teamScore: number;
    let oppScore: number;

    if (opp.name === 'Central Eagles' && vsCentral) {
      // Use actual result vs Central Eagles (from opponent's perspective)
      teamScore = vsCentral.oppScore;
      oppScore = vsCentral.centralScore;
    } else {
      // Generate realistic score based on team tendency
      const isWin = winsRemaining > 0 && (lossesRemaining === 0 || Math.random() < 0.5);
      if (isWin) {
        teamScore = 14 + Math.floor(Math.random() * 21); // 14-35
        oppScore = Math.max(0, teamScore - 3 - Math.floor(Math.random() * 14)); // Losing by 3-17
        winsRemaining--;
      } else {
        oppScore = 14 + Math.floor(Math.random() * 21);
        teamScore = Math.max(0, oppScore - 3 - Math.floor(Math.random() * 14));
        lossesRemaining--;
      }
    }

    games.push({
      id: randomUUID(),
      team_id: team.id,
      name: `Week ${week + 1} vs ${opp.name}`,
      opponent: opp.name,
      opponent_id: opp.id,
      date: gameDate.toISOString().split('T')[0],
      team_score: teamScore,
      opponent_score: oppScore,
      game_result: teamScore > oppScore ? 'win' : teamScore < oppScore ? 'loss' : 'tie',
    });
  });

  return games;
}

// ============================================
// PLAY INSTANCE GENERATION
// ============================================
interface PlayInstance {
  id: string;
  video_id: string;
  play_code: string;
  team_id: string;
  timestamp_start: number;
  timestamp_end: number;
  down: number;
  distance: number;
  yard_line: number;
  hash_mark: string;
  result: string;
  yards_gained: number;
  resulted_in_first_down: boolean;
  is_turnover: boolean;
  is_opponent_play: boolean;
  notes: string | null;
  play_type: string;
  quarter: number;
  qb_id?: string;
  ball_carrier_id?: string;
}

function generatePlayInstances(
  videoId: string,
  teamId: string,
  plays: PlayData[],
  roster: PlayerData[],
  profile: TeamProfile,
  gameResult: string,
  teamScore: number,
  oppScore: number
): PlayInstance[] {
  const instances: PlayInstance[] = [];
  const offensivePlays = plays.filter(p => p.attributes.odk === 'offense');

  if (offensivePlays.length === 0) return instances;

  // Find players by position using position_depths
  const qb = roster.find(p => p.position_depths['QB'] === 1);
  const rbs = roster.filter(p => p.position_depths['RB'] !== undefined);
  const wrs = roster.filter(p => p.position_depths['WR'] !== undefined);

  // Calculate plays per game based on style
  const totalPlays = profile.offensiveStyle === 'air_raid' ? 75 :
                     profile.offensiveStyle === 'option' ? 65 :
                     profile.offensiveStyle === 'power' ? 55 : 60;

  let timestamp = 0;
  let yardLine = 25; // Start at own 25
  let down = 1;
  let distance = 10;
  let quarter = 1;

  for (let i = 0; i < totalPlays; i++) {
    // Select play based on team tendencies
    const isRun = Math.random() < profile.runPassRatio;
    const eligiblePlays = offensivePlays.filter(p =>
      isRun ? p.attributes.playType === 'Run' || p.attributes.playType === 'RPO' :
              p.attributes.playType === 'Pass' || p.attributes.playType === 'RPO'
    );

    const play = eligiblePlays.length > 0
      ? eligiblePlays[Math.floor(Math.random() * eligiblePlays.length)]
      : offensivePlays[Math.floor(Math.random() * offensivePlays.length)];

    // Calculate result based on team strengths
    let yards: number;
    let result: string;

    const isStarPlayer = profile.starPositions.includes(isRun ? 'RB' : 'QB');
    const baseSuccess = isStarPlayer ? 0.55 : 0.45;
    const gameAdjust = gameResult === 'win' ? 0.05 : gameResult === 'loss' ? -0.05 : 0;

    if (Math.random() < (baseSuccess + gameAdjust)) {
      // Successful play
      if (Math.random() < 0.15) {
        // Explosive play
        yards = isRun ? 12 + Math.floor(Math.random() * 30) : 18 + Math.floor(Math.random() * 40);
        result = yards >= 20 ? 'Big Gain' : 'Good Gain';
      } else {
        yards = isRun ? 3 + Math.floor(Math.random() * 6) : 6 + Math.floor(Math.random() * 10);
        result = 'Gain';
      }
    } else {
      // Unsuccessful play
      if (Math.random() < 0.1) {
        // Negative play
        yards = -(1 + Math.floor(Math.random() * 5));
        result = isRun ? 'TFL' : 'Sack';
      } else {
        yards = isRun ? Math.floor(Math.random() * 3) : 0;
        result = yards === 0 ? (isRun ? 'No Gain' : 'Incomplete') : 'Short Gain';
      }
    }

    // Turnover chance
    const isTurnover = Math.random() < 0.025;
    if (isTurnover) {
      result = isRun ? 'Fumble' : 'Interception';
      yards = 0;
    }

    const madeFirstDown = yards >= distance;

    instances.push({
      id: randomUUID(),
      video_id: videoId,
      play_code: play.play_code,
      team_id: teamId,
      timestamp_start: timestamp,
      timestamp_end: timestamp + 8,
      down,
      distance,
      yard_line: yardLine,
      hash_mark: ['left', 'middle', 'right'][Math.floor(Math.random() * 3)],
      result,
      yards_gained: yards,
      resulted_in_first_down: madeFirstDown && !isTurnover,
      is_turnover: isTurnover,
      is_opponent_play: false,
      notes: null,
      play_type: play.attributes.playType.toLowerCase() as 'run' | 'pass' | 'screen' | 'rpo',
      quarter,
      qb_id: qb?.id,
      ball_carrier_id: isRun && rbs.length > 0
        ? rbs[Math.floor(Math.random() * rbs.length)].id
        : undefined,
    });

    // Update game state
    timestamp += 20 + Math.floor(Math.random() * 15);
    yardLine = Math.min(99, Math.max(1, yardLine + yards));

    if (madeFirstDown || isTurnover || down > 4) {
      down = 1;
      distance = 10;
      if (isTurnover || yardLine >= 90) {
        yardLine = 25; // Reset after score or turnover
      }
    } else {
      down++;
      distance = Math.max(1, distance - yards);
    }

    // Quarter progression
    if (timestamp > (quarter * 720)) {
      quarter = Math.min(4, quarter + 1);
    }
  }

  return instances;
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  console.log('🏈 Seeding Opponent Teams Data\n');
  console.log('='.repeat(60));

  // Login
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  const userId = auth.user?.id;
  console.log(`✅ Logged in as test coach\n`);

  let teamsCreated = 0;
  let playersCreated = 0;
  let playsCreated = 0;
  let gamesCreated = 0;
  let videosCreated = 0;
  let instancesCreated = 0;

  for (const team of OPPONENT_TEAMS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${team.name}`);
    console.log(`   Style: ${team.offensiveStyle} offense / ${team.defensiveStyle} defense`);
    console.log(`   Run/Pass: ${Math.round(team.runPassRatio * 100)}% run`);
    console.log(`   Record: ${team.record.wins}-${team.record.losses}`);
    console.log('='.repeat(60));

    // 1. Create team
    const { error: teamError } = await supabase
      .from('teams')
      .upsert({
        id: team.id,
        name: team.name,
        level: team.level,
        colors: team.colors,
        user_id: userId,
      }, { onConflict: 'id' });

    if (teamError) {
      console.log(`  ❌ Team error: ${teamError.message}`);
      continue;
    }
    console.log(`  ✅ Team created`);
    teamsCreated++;

    // 2. Create roster
    const roster = generateRoster(team.id);

    // Delete existing players first
    await supabase.from('players').delete().eq('team_id', team.id);

    const { error: rosterError } = await supabase
      .from('players')
      .insert(roster);

    if (rosterError) {
      console.log(`  ❌ Roster error: ${rosterError.message}`);
    } else {
      console.log(`  ✅ Roster: ${roster.length} players`);
      playersCreated += roster.length;
    }

    // 3. Create playbook
    const plays = generatePlaybook(team.id, team.offensiveStyle, team.name);

    // Delete existing plays first
    await supabase.from('playbook_plays').delete().eq('team_id', team.id);

    const { error: playsError } = await supabase
      .from('playbook_plays')
      .insert(plays);

    if (playsError) {
      console.log(`  ❌ Playbook error: ${playsError.message}`);
    } else {
      console.log(`  ✅ Playbook: ${plays.length} plays`);
      playsCreated += plays.length;
    }

    // 4. Create games
    const games = generateGamesForTeam(team);

    // Delete existing games first
    await supabase.from('games').delete().eq('team_id', team.id);

    const { data: insertedGames, error: gamesError } = await supabase
      .from('games')
      .insert(games.map(g => ({
        id: g.id,
        team_id: g.team_id,
        name: g.name,
        opponent: g.opponent,
        date: g.date,
        team_score: g.team_score,
        opponent_score: g.opponent_score,
        game_result: g.game_result,
        user_id: userId,
      })))
      .select('id, name');

    if (gamesError) {
      console.log(`  ❌ Games error: ${gamesError.message}`);
      continue;
    }
    console.log(`  ✅ Schedule: ${games.length} games`);
    gamesCreated += games.length;

    // 5. Create videos and play instances for each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const videoId = randomUUID();

      // Create video for this game
      const { error: videoError } = await supabase
        .from('videos')
        .insert({
          id: videoId,
          name: `${team.name} - ${game.name}`,
          file_path: SOURCE_VIDEO.file_path,
          url: SOURCE_VIDEO.url,
          game_id: game.id,
        });

      if (videoError) {
        console.log(`    ⚠️ Video error for ${game.name}: ${videoError.message}`);
        continue;
      }
      videosCreated++;

      // Generate play instances
      const instances = generatePlayInstances(
        videoId,
        team.id,
        plays,
        roster,
        team,
        game.game_result,
        game.team_score,
        game.opponent_score
      );

      if (instances.length > 0) {
        // Insert in batches to avoid size limits
        const batchSize = 50;
        for (let j = 0; j < instances.length; j += batchSize) {
          const batch = instances.slice(j, j + batchSize);
          const { error: instanceError } = await supabase
            .from('play_instances')
            .insert(batch);

          if (instanceError) {
            console.log(`    ⚠️ Play instances error: ${instanceError.message}`);
            break;
          }
        }
        instancesCreated += instances.length;
      }
    }
    console.log(`  ✅ Videos & instances created`);
  }

  // Add timeline markers for all opponent games
  console.log('\n📍 Adding game markers...');

  const { data: allVideos } = await supabase
    .from('videos')
    .select('id, game_id, name')
    .in('game_id', OPPONENT_TEAMS.flatMap(t =>
      generateGamesForTeam(t).map(g => g.id)
    ).slice(0, 100));

  if (allVideos && allVideos.length > 0) {
    const markers: any[] = [];

    for (const video of allVideos) {
      const quarterLength = 12 * 60 * 1000;
      const halftimeLength = 10 * 60 * 1000;
      const breakLength = 30 * 1000;

      const q1Start = 0;
      const q1End = quarterLength;
      const q2Start = q1End + breakLength;
      const q2End = q2Start + quarterLength;
      const halftimeStart = q2End;
      const q3Start = q2End + halftimeLength;
      const q3End = q3Start + quarterLength;
      const q4Start = q3End + breakLength;
      const q4End = q4Start + quarterLength;

      markers.push(
        { video_id: video.id, marker_type: 'quarter_start', virtual_timestamp_start_ms: q1Start, quarter: 1, label: 'Q1 Start', color: '#22C55E' },
        { video_id: video.id, marker_type: 'quarter_end', virtual_timestamp_start_ms: q1End, quarter: 1, label: 'End Q1', color: '#3B82F6' },
        { video_id: video.id, marker_type: 'quarter_start', virtual_timestamp_start_ms: q2Start, quarter: 2, label: 'Q2 Start', color: '#3B82F6' },
        { video_id: video.id, marker_type: 'quarter_end', virtual_timestamp_start_ms: q2End, quarter: 2, label: 'End Q2', color: '#F59E0B' },
        { video_id: video.id, marker_type: 'halftime', virtual_timestamp_start_ms: halftimeStart, quarter: 2, label: 'Halftime', color: '#F59E0B' },
        { video_id: video.id, marker_type: 'quarter_start', virtual_timestamp_start_ms: q3Start, quarter: 3, label: 'Q3 Start', color: '#3B82F6' },
        { video_id: video.id, marker_type: 'quarter_end', virtual_timestamp_start_ms: q3End, quarter: 3, label: 'End Q3', color: '#3B82F6' },
        { video_id: video.id, marker_type: 'quarter_start', virtual_timestamp_start_ms: q4Start, quarter: 4, label: 'Q4 Start', color: '#3B82F6' },
        { video_id: video.id, marker_type: 'quarter_end', virtual_timestamp_start_ms: q4End, quarter: 4, label: 'End Q4', color: '#EF4444' },
        { video_id: video.id, marker_type: 'custom', virtual_timestamp_start_ms: q4End + 60000, quarter: 4, label: 'Game End', color: '#EF4444' },
      );
    }

    // Insert markers in batches
    const batchSize = 100;
    for (let i = 0; i < markers.length; i += batchSize) {
      const batch = markers.slice(i, i + batchSize);
      await supabase.from('video_timeline_markers').insert(batch);
    }
    console.log(`  ✅ Added ${markers.length} game markers`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 OPPONENT TEAMS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Teams created: ${teamsCreated}`);
  console.log(`✅ Players created: ${playersCreated}`);
  console.log(`✅ Plays created: ${playsCreated}`);
  console.log(`✅ Games created: ${gamesCreated}`);
  console.log(`✅ Videos created: ${videosCreated}`);
  console.log(`✅ Play instances: ${instancesCreated}`);
  console.log('\n🏈 All opponent teams are ready for scouting!');
}

main().catch(console.error);
