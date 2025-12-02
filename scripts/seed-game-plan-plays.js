/**
 * Seed Game Plan Test Plays
 *
 * Creates a comprehensive set of test plays for the Game Plan Builder,
 * including setup/counter relationships.
 *
 * Usage:
 *   node scripts/seed-game-plan-plays.js [TEAM_ID]
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Need SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const teamId = process.argv[2] || '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

// Comprehensive test plays covering all situations
const testPlays = [
  // ========== FIRST 15 PLAYS (OPENING SCRIPT) ==========
  // Run plays to establish the ground game
  {
    play_code: 'IZ-R',
    play_name: 'Inside Zone Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Inside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Inside Zone', 'right')
  },
  {
    play_code: 'IZ-L',
    play_name: 'Inside Zone Left',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Inside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Inside Zone', 'left')
  },
  {
    play_code: 'OZ-R',
    play_name: 'Outside Zone Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Outside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Outside Zone', 'right')
  },
  {
    play_code: 'OZ-L',
    play_name: 'Outside Zone Left',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Outside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Outside Zone', 'left')
  },

  // Counter plays (work with Inside Zone setups)
  {
    play_code: 'CTR-R',
    play_name: 'Counter Trey Right',
    attributes: {
      odk: 'offense',
      formation: 'I-Form Pro',
      playType: 'Run',
      runConcept: 'Counter',
      personnel: '21 (2RB-1TE-2WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Counter', 'right')
  },
  {
    play_code: 'CTR-L',
    play_name: 'Counter Trey Left',
    attributes: {
      odk: 'offense',
      formation: 'I-Form Pro',
      playType: 'Run',
      runConcept: 'Counter',
      personnel: '21 (2RB-1TE-2WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Counter', 'left')
  },

  // Power plays
  {
    play_code: 'PWR-R',
    play_name: 'Power Right',
    attributes: {
      odk: 'offense',
      formation: 'I-Form Pro',
      playType: 'Run',
      runConcept: 'Power',
      personnel: '21 (2RB-1TE-2WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Power', 'right')
  },
  {
    play_code: 'PWR-L',
    play_name: 'Power Left',
    attributes: {
      odk: 'offense',
      formation: 'I-Form Pro',
      playType: 'Run',
      runConcept: 'Power',
      personnel: '21 (2RB-1TE-2WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Power', 'left')
  },

  // ========== QUICK PASSING GAME ==========
  {
    play_code: 'SLNT-R',
    play_name: 'Slant Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Slant',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Slant')
  },
  {
    play_code: 'SLNT-L',
    play_name: 'Slant Left',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Slant',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Slant')
  },
  {
    play_code: 'HTCH-3',
    play_name: 'Triple Hitch',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Trips',
      playType: 'Pass',
      passConcept: 'Hitch',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Hitch')
  },
  {
    play_code: 'BUBL-R',
    play_name: 'Bubble Screen Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Screen',
      passConcept: 'Bubble Screen',
      personnel: '10 (1RB-0TE-4WR)',
      protection: 'None',
      motion: 'None'
    },
    diagram: createPassDiagram('Bubble')
  },

  // ========== INTERMEDIATE PASSING ==========
  {
    play_code: 'CURL-FLT',
    play_name: 'Curl-Flat Combo',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Curl-Flat',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Curl')
  },
  {
    play_code: 'DIG-R',
    play_name: 'Dig Route Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Dig',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Dig')
  },
  {
    play_code: 'OUT-R',
    play_name: 'Out Route Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Out',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Out')
  },
  {
    play_code: 'MESH',
    play_name: 'Mesh Concept',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Mesh',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Mesh')
  },
  {
    play_code: 'LVLS',
    play_name: 'Levels Concept',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Trips',
      playType: 'Pass',
      passConcept: 'Levels',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Slide',
      motion: 'None'
    },
    diagram: createPassDiagram('Levels')
  },

  // ========== DEEP SHOTS ==========
  {
    play_code: '4VERTS',
    play_name: 'Four Verticals',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Four Verts',
      personnel: '10 (1RB-0TE-4WR)',
      protection: '5-Man Max',
      motion: 'None'
    },
    diagram: createPassDiagram('Go')
  },
  {
    play_code: 'POST-R',
    play_name: 'Post Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Post',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Max',
      motion: 'None'
    },
    diagram: createPassDiagram('Post')
  },
  {
    play_code: 'CRNR-R',
    play_name: 'Corner Route Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Corner',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Max',
      motion: 'None'
    },
    diagram: createPassDiagram('Corner')
  },
  {
    play_code: 'SEAM-R',
    play_name: 'Seam Route Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Trips',
      playType: 'Pass',
      passConcept: 'Seam',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Max',
      motion: 'None'
    },
    diagram: createPassDiagram('Seam')
  },

  // ========== PLAY ACTION ==========
  {
    play_code: 'PA-IZ-POST',
    play_name: 'Play Action IZ Post',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Play Action',
      passConcept: 'Post',
      runConcept: 'Inside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Play Action',
      motion: 'None'
    },
    diagram: createPassDiagram('Post')
  },
  {
    play_code: 'PA-PWR-BOOT',
    play_name: 'Power Boot Right',
    attributes: {
      odk: 'offense',
      formation: 'I-Form Pro',
      playType: 'Play Action',
      passConcept: 'Bootleg',
      runConcept: 'Power',
      personnel: '21 (2RB-1TE-2WR)',
      protection: 'Bootleg',
      motion: 'None'
    },
    diagram: createPassDiagram('Out')
  },
  {
    play_code: 'PA-OZ-WHEEL',
    play_name: 'Outside Zone Wheel',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Play Action',
      passConcept: 'Wheel',
      runConcept: 'Outside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Play Action',
      motion: 'None'
    },
    diagram: createPassDiagram('Wheel')
  },

  // ========== RPO (Run-Pass Option) ==========
  {
    play_code: 'RPO-IZ-SLNT',
    play_name: 'RPO Inside Zone Slant',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'RPO',
      passConcept: 'Slant',
      runConcept: 'Inside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'RPO',
      motion: 'None'
    },
    diagram: createRunDiagram('Inside Zone', 'right')
  },
  {
    play_code: 'RPO-IZ-BUBL',
    play_name: 'RPO Inside Zone Bubble',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'RPO',
      passConcept: 'Bubble Screen',
      runConcept: 'Inside Zone',
      personnel: '10 (1RB-0TE-4WR)',
      protection: 'RPO',
      motion: 'None'
    },
    diagram: createRunDiagram('Inside Zone', 'right')
  },
  {
    play_code: 'RPO-PWR-POP',
    play_name: 'RPO Power Pop Pass',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Trips',
      playType: 'RPO',
      passConcept: 'Pop Pass',
      runConcept: 'Power',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'RPO',
      motion: 'None'
    },
    diagram: createRunDiagram('Power', 'right')
  },

  // ========== SCREENS ==========
  {
    play_code: 'SCRN-RB',
    play_name: 'RB Screen',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Screen',
      passConcept: 'RB Screen',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Screen',
      motion: 'None'
    },
    diagram: createPassDiagram('Screen')
  },
  {
    play_code: 'SCRN-WR-R',
    play_name: 'WR Screen Right',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Screen',
      passConcept: 'WR Screen',
      personnel: '10 (1RB-0TE-4WR)',
      protection: 'Screen',
      motion: 'None'
    },
    diagram: createPassDiagram('Screen')
  },
  {
    play_code: 'SCRN-TUNL',
    play_name: 'Tunnel Screen',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Trips',
      playType: 'Screen',
      passConcept: 'Tunnel Screen',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Screen',
      motion: 'None'
    },
    diagram: createPassDiagram('Screen')
  },

  // ========== DRAWS ==========
  {
    play_code: 'DRAW-DLY',
    play_name: 'Delay Draw',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Draw',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Draw', 'middle')
  },
  {
    play_code: 'DRAW-QB',
    play_name: 'QB Draw',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Empty',
      playType: 'Run',
      runConcept: 'QB Draw',
      personnel: '10 (1RB-0TE-4WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Draw', 'middle')
  },

  // ========== GOAL LINE ==========
  {
    play_code: 'GL-DIVE',
    play_name: 'Goal Line Dive',
    attributes: {
      odk: 'offense',
      formation: 'Goal Line',
      playType: 'Run',
      runConcept: 'Dive',
      personnel: '23 (2RB-3TE-0WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Dive', 'middle')
  },
  {
    play_code: 'GL-SNEAK',
    play_name: 'QB Sneak',
    attributes: {
      odk: 'offense',
      formation: 'Goal Line',
      playType: 'Run',
      runConcept: 'QB Sneak',
      personnel: '23 (2RB-3TE-0WR)',
      motion: 'None'
    },
    diagram: createRunDiagram('Sneak', 'middle')
  },
  {
    play_code: 'GL-FADE',
    play_name: 'Goal Line Fade',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Fade',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Quick',
      motion: 'None'
    },
    diagram: createPassDiagram('Fade')
  },
  {
    play_code: 'GL-SLNT',
    play_name: 'Goal Line Slant',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Slant',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Quick',
      motion: 'None'
    },
    diagram: createPassDiagram('Slant')
  },

  // ========== 2-MINUTE DRILL ==========
  {
    play_code: '2M-SPIKE',
    play_name: 'Clock Spike',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Spike',
      personnel: '11 (1RB-1TE-3WR)',
      protection: 'Quick',
      motion: 'None'
    },
    diagram: createPassDiagram('Spike')
  },
  {
    play_code: '2M-OUTS',
    play_name: '2-Minute Outs',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Out',
      personnel: '10 (1RB-0TE-4WR)',
      protection: '5-Man Quick',
      motion: 'None'
    },
    diagram: createPassDiagram('Out')
  },
  {
    play_code: '2M-DRVR',
    play_name: '2-Minute Drive',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Pass',
      passConcept: 'Drive',
      personnel: '11 (1RB-1TE-3WR)',
      protection: '5-Man Quick',
      motion: 'None'
    },
    diagram: createPassDiagram('Dig')
  },

  // ========== MOTION PLAYS ==========
  {
    play_code: 'JET-SWEP',
    play_name: 'Jet Sweep',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Jet Sweep',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'Jet'
    },
    diagram: createRunDiagram('Jet Sweep', 'right')
  },
  {
    play_code: 'JET-FAKE-IZ',
    play_name: 'Jet Fake Inside Zone',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Run',
      runConcept: 'Inside Zone',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'Jet'
    },
    diagram: createRunDiagram('Inside Zone', 'right')
  },
  {
    play_code: 'ORBIT-SCRN',
    play_name: 'Orbit Screen',
    attributes: {
      odk: 'offense',
      formation: 'Shotgun Spread',
      playType: 'Screen',
      passConcept: 'Orbit Screen',
      personnel: '11 (1RB-1TE-3WR)',
      motion: 'Orbit'
    },
    diagram: createPassDiagram('Screen')
  }
];

// Setup/Counter relationships
const setupCounterPairs = [
  // Inside Zone setups Counter plays
  { setup: 'IZ-R', counter: 'CTR-L', key_position: 'MLB', key_indicator: 'cheating_inside', notes: 'Counter when MLB is crashing A-gap' },
  { setup: 'IZ-L', counter: 'CTR-R', key_position: 'MLB', key_indicator: 'cheating_inside', notes: 'Counter when MLB is crashing A-gap' },
  { setup: 'IZ-R', counter: 'PA-IZ-POST', key_position: 'SS', key_indicator: 'run_fit_aggressive', notes: 'Play action when SS is filling run' },

  // Outside Zone setups Boot/Counter
  { setup: 'OZ-R', counter: 'PA-PWR-BOOT', key_position: 'WILL', key_indicator: 'run_fit_aggressive', notes: 'Boot when LBs are flowing hard' },
  { setup: 'OZ-L', counter: 'PA-OZ-WHEEL', key_position: 'SS', key_indicator: 'run_fit_aggressive', notes: 'Wheel when SS is crashing' },

  // Power setups Counter
  { setup: 'PWR-R', counter: 'CTR-L', key_position: 'WILL', key_indicator: 'cheating_inside', notes: 'Counter when WILL cheats to strong side' },
  { setup: 'PWR-L', counter: 'CTR-R', key_position: 'SAM', key_indicator: 'cheating_inside', notes: 'Counter when SAM cheats to strong side' },

  // Slant setups Out routes
  { setup: 'SLNT-R', counter: 'OUT-R', key_position: 'CB1', key_indicator: 'jumping_routes', notes: 'Out route when CB is jumping inside' },
  { setup: 'SLNT-L', counter: 'CRNR-R', key_position: 'CB2', key_indicator: 'soft_coverage', notes: 'Corner when CB is playing soft' },

  // Quick game setups deep shots
  { setup: 'HTCH-3', counter: '4VERTS', key_position: 'FS', key_indicator: 'robber_technique', notes: 'Verticals when FS is robbing underneath' },
  { setup: 'CURL-FLT', counter: 'POST-R', key_position: 'FS', key_indicator: 'robber_technique', notes: 'Post when FS is jumping curl' },

  // Bubble setups inside runs
  { setup: 'BUBL-R', counter: 'IZ-L', key_position: 'CB1', key_indicator: 'biting_motion', notes: 'Inside Zone when CB is chasing bubble' },

  // Jet motion setups
  { setup: 'JET-SWEP', counter: 'JET-FAKE-IZ', key_position: 'WILL', key_indicator: 'biting_motion', notes: 'Inside Zone when LB is chasing jet' },
  { setup: 'JET-SWEP', counter: 'PA-IZ-POST', key_position: 'SS', key_indicator: 'biting_motion', notes: 'Play action when SS is biting on jet' },

  // Draw setups
  { setup: 'DRAW-DLY', counter: 'POST-R', key_position: 'MLB', key_indicator: 'spy_qb', notes: 'Post when MLB is spying QB' },

  // RPO setups
  { setup: 'RPO-IZ-SLNT', counter: 'RPO-IZ-BUBL', key_position: 'NB', key_indicator: 'jumping_routes', notes: 'Bubble when slot is jumping slant' },
  { setup: 'RPO-IZ-BUBL', counter: 'IZ-R', key_position: 'CB1', key_indicator: 'biting_motion', notes: 'Commit to run when CB is chasing bubble' }
];

// Helper function to create a basic run diagram
function createRunDiagram(concept, direction) {
  const baseX = direction === 'left' ? 250 : direction === 'right' ? 450 : 350;
  return {
    odk: 'offense',
    formation: 'Shotgun Spread',
    players: [
      { position: 'QB', x: 350, y: 260, label: 'QB', assignment: 'Handoff' },
      { position: 'RB', x: 350, y: 300, label: 'RB', assignment: concept },
      { position: 'X', x: 50, y: 200, label: 'X', assignment: 'Block' },
      { position: 'H', x: 150, y: 220, label: 'H', assignment: 'Block' },
      { position: 'Y', x: 550, y: 220, label: 'Y', assignment: 'Block' },
      { position: 'Z', x: 650, y: 200, label: 'Z', assignment: 'Block' },
      { position: 'LT', x: 220, y: 200, label: 'LT', assignment: 'Block' },
      { position: 'LG', x: 270, y: 200, label: 'LG', assignment: 'Block' },
      { position: 'C', x: 350, y: 200, label: 'C', assignment: 'Block' },
      { position: 'RG', x: 430, y: 200, label: 'RG', assignment: 'Block' },
      { position: 'RT', x: 480, y: 200, label: 'RT', assignment: 'Block' }
    ],
    routes: [
      { id: 'rb-route', playerId: 'RB', path: [{ x: 350, y: 300 }, { x: baseX, y: 150 }], type: 'run' }
    ]
  };
}

// Helper function to create a basic pass diagram
function createPassDiagram(concept) {
  const routeEndpoints = {
    'Slant': { x: 400, y: 120 },
    'Hitch': { x: 50, y: 160 },
    'Bubble': { x: 100, y: 200 },
    'Curl': { x: 150, y: 140 },
    'Dig': { x: 350, y: 120 },
    'Out': { x: 0, y: 160 },
    'Mesh': { x: 450, y: 180 },
    'Levels': { x: 200, y: 120 },
    'Go': { x: 50, y: 50 },
    'Post': { x: 350, y: 50 },
    'Corner': { x: 0, y: 80 },
    'Seam': { x: 250, y: 50 },
    'Screen': { x: 200, y: 240 },
    'Wheel': { x: 0, y: 50 },
    'Fade': { x: 50, y: 50 },
    'Spike': { x: 350, y: 200 }
  };

  const endpoint = routeEndpoints[concept] || { x: 350, y: 100 };

  return {
    odk: 'offense',
    formation: 'Shotgun Spread',
    players: [
      { position: 'QB', x: 350, y: 260, label: 'QB', assignment: 'Pass' },
      { position: 'RB', x: 350, y: 300, label: 'RB', assignment: 'Block' },
      { position: 'X', x: 50, y: 200, label: 'X', assignment: concept },
      { position: 'H', x: 150, y: 220, label: 'H', assignment: 'Route' },
      { position: 'Y', x: 550, y: 220, label: 'Y', assignment: 'Route' },
      { position: 'Z', x: 650, y: 200, label: 'Z', assignment: 'Route' },
      { position: 'LT', x: 220, y: 200, label: 'LT', assignment: 'Pass Block' },
      { position: 'LG', x: 270, y: 200, label: 'LG', assignment: 'Pass Block' },
      { position: 'C', x: 350, y: 200, label: 'C', assignment: 'Pass Block' },
      { position: 'RG', x: 430, y: 200, label: 'RG', assignment: 'Pass Block' },
      { position: 'RT', x: 480, y: 200, label: 'RT', assignment: 'Pass Block' }
    ],
    routes: [
      { id: 'x-route', playerId: 'X', path: [{ x: 50, y: 200 }, endpoint], type: 'pass', routeType: concept, isPrimary: true }
    ]
  };
}

async function seedPlays() {
  console.log('🏈 Starting Game Plan Test Data Seed...\n');
  console.log(`📋 Team ID: ${teamId}\n`);

  // Step 1: Delete existing plays for this team (and null team_id plays)
  console.log('🗑️  Deleting existing playbook plays...');

  const { error: deleteError } = await supabase
    .from('playbook_plays')
    .delete()
    .or(`team_id.eq.${teamId},team_id.is.null`);

  if (deleteError) {
    console.error('❌ Error deleting existing plays:', deleteError.message);
    return;
  }
  console.log('✅ Existing plays deleted\n');

  // Step 2: Delete existing play relationships for this team
  console.log('🗑️  Deleting existing play relationships...');

  const { error: deleteRelError } = await supabase
    .from('play_relationships')
    .delete()
    .eq('team_id', teamId);

  if (deleteRelError && deleteRelError.code !== 'PGRST116') {
    console.error('❌ Error deleting relationships:', deleteRelError.message);
  } else {
    console.log('✅ Existing relationships deleted\n');
  }

  // Step 3: Insert new plays
  console.log(`📝 Inserting ${testPlays.length} test plays...`);

  const playsToInsert = testPlays.map(play => ({
    ...play,
    team_id: teamId,
    is_archived: false
  }));

  const { data: insertedPlays, error: insertError } = await supabase
    .from('playbook_plays')
    .insert(playsToInsert)
    .select();

  if (insertError) {
    console.error('❌ Error inserting plays:', insertError.message);
    return;
  }
  console.log(`✅ Inserted ${insertedPlays.length} plays\n`);

  // Step 4: Insert setup/counter relationships
  console.log(`🔗 Creating ${setupCounterPairs.length} setup/counter relationships...`);

  const relationshipsToInsert = setupCounterPairs.map(pair => ({
    team_id: teamId,
    setup_play_code: pair.setup,
    counter_play_code: pair.counter,
    key_position: pair.key_position,
    key_indicator: pair.key_indicator,
    notes: pair.notes
  }));

  const { data: insertedRels, error: relError } = await supabase
    .from('play_relationships')
    .insert(relationshipsToInsert)
    .select();

  if (relError) {
    console.error('❌ Error inserting relationships:', relError.message);
    console.error('   Detail:', relError.details);
  } else {
    console.log(`✅ Created ${insertedRels.length} relationships\n`);
  }

  // Summary
  console.log('=' .repeat(50));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(50));
  console.log(`✅ Total plays created: ${insertedPlays.length}`);
  console.log(`✅ Setup/Counter pairs: ${insertedRels?.length || 0}`);
  console.log('\n📂 Plays by category:');

  const categories = {
    'Run': testPlays.filter(p => p.attributes.playType === 'Run').length,
    'Pass': testPlays.filter(p => p.attributes.playType === 'Pass').length,
    'Play Action': testPlays.filter(p => p.attributes.playType === 'Play Action').length,
    'RPO': testPlays.filter(p => p.attributes.playType === 'RPO').length,
    'Screen': testPlays.filter(p => p.attributes.playType === 'Screen').length
  };

  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`   • ${cat}: ${count}`);
  });

  console.log('\n🎯 Ready for Game Plan testing!');
  console.log('   Visit: http://localhost:3000/teams/' + teamId + '/game-week');
}

seedPlays().catch(console.error);
