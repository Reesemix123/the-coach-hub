/**
 * Test Data Seeding Script
 *
 * This script creates all necessary test data for Playwright E2E tests.
 * Run with: npx ts-node scripts/seed-test-data.ts
 *
 * Prerequisites:
 * - TEST_SUPABASE_URL environment variable
 * - TEST_SUPABASE_SERVICE_KEY environment variable (service role key for admin access)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TEST_SUPABASE_URL;
const supabaseServiceKey = process.env.TEST_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- TEST_SUPABASE_URL');
  console.error('- TEST_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test user credentials
const TEST_USERS = {
  owner: {
    email: 'owner@test.com',
    password: 'TestPassword123!',
    full_name: 'Test Owner'
  },
  coach: {
    email: 'coach@test.com',
    password: 'TestPassword123!',
    full_name: 'Test Coach'
  },
  coach2: {
    email: 'coach2@test.com',
    password: 'TestPassword123!',
    full_name: 'Test Coach 2'
  },
  newUser: {
    email: 'newuser@test.com',
    password: 'TestPassword123!',
    full_name: 'New User'
  },
  multiTeamOwner: {
    email: 'multiowner@test.com',
    password: 'TestPassword123!',
    full_name: 'Multi Team Owner'
  }
};

// Test team configurations
const TEST_TEAMS = [
  {
    name: 'Test Team Basic',
    level: 'Youth',
    plan: 'basic',
    colors: { primary: '#1E40AF', secondary: '#FFFFFF' }
  },
  {
    name: 'Test Team Plus',
    level: 'Middle School',
    plan: 'plus',
    colors: { primary: '#DC2626', secondary: '#000000' }
  },
  {
    name: 'Test Team Premium',
    level: 'High School',
    plan: 'premium',
    colors: { primary: '#059669', secondary: '#FBBF24' }
  },
  {
    name: 'Empty Team',
    level: 'Youth',
    plan: 'basic',
    colors: { primary: '#000000', secondary: '#FFFFFF' }
  }
];

// Player roster template
const ROSTER_TEMPLATE = [
  // Offense
  { jersey_number: '12', first_name: 'Test', last_name: 'Quarterback', primary_position: 'QB', position_group: 'offense', depth_order: 1 },
  { jersey_number: '7', first_name: 'Backup', last_name: 'QB', primary_position: 'QB', position_group: 'offense', depth_order: 2 },
  { jersey_number: '22', first_name: 'Test', last_name: 'Runningback', primary_position: 'RB', position_group: 'offense', depth_order: 1 },
  { jersey_number: '33', first_name: 'Backup', last_name: 'RB', primary_position: 'RB', position_group: 'offense', depth_order: 2 },
  { jersey_number: '1', first_name: 'Test', last_name: 'WR1', primary_position: 'WR', position_group: 'offense', depth_order: 1 },
  { jersey_number: '11', first_name: 'Test', last_name: 'WR2', primary_position: 'WR', position_group: 'offense', depth_order: 1 },
  { jersey_number: '81', first_name: 'Test', last_name: 'Slot', primary_position: 'WR', position_group: 'offense', depth_order: 2 },
  { jersey_number: '88', first_name: 'Test', last_name: 'TE', primary_position: 'TE', position_group: 'offense', depth_order: 1 },
  { jersey_number: '72', first_name: 'Test', last_name: 'LT', primary_position: 'LT', position_group: 'offense', depth_order: 1 },
  { jersey_number: '66', first_name: 'Test', last_name: 'LG', primary_position: 'LG', position_group: 'offense', depth_order: 1 },
  { jersey_number: '55', first_name: 'Test', last_name: 'Center', primary_position: 'C', position_group: 'offense', depth_order: 1 },
  { jersey_number: '64', first_name: 'Test', last_name: 'RG', primary_position: 'RG', position_group: 'offense', depth_order: 1 },
  { jersey_number: '78', first_name: 'Test', last_name: 'RT', primary_position: 'RT', position_group: 'offense', depth_order: 1 },
  // Defense
  { jersey_number: '91', first_name: 'Test', last_name: 'DE1', primary_position: 'DE', position_group: 'defense', depth_order: 1 },
  { jersey_number: '95', first_name: 'Test', last_name: 'DE2', primary_position: 'DE', position_group: 'defense', depth_order: 1 },
  { jersey_number: '97', first_name: 'Test', last_name: 'DT1', primary_position: 'DT', position_group: 'defense', depth_order: 1 },
  { jersey_number: '93', first_name: 'Test', last_name: 'DT2', primary_position: 'DT', position_group: 'defense', depth_order: 1 },
  { jersey_number: '54', first_name: 'Test', last_name: 'MLB', primary_position: 'MLB', position_group: 'defense', depth_order: 1 },
  { jersey_number: '52', first_name: 'Test', last_name: 'OLB1', primary_position: 'OLB', position_group: 'defense', depth_order: 1 },
  { jersey_number: '56', first_name: 'Test', last_name: 'OLB2', primary_position: 'OLB', position_group: 'defense', depth_order: 1 },
  { jersey_number: '21', first_name: 'Test', last_name: 'CB1', primary_position: 'CB', position_group: 'defense', depth_order: 1 },
  { jersey_number: '24', first_name: 'Test', last_name: 'CB2', primary_position: 'CB', position_group: 'defense', depth_order: 1 },
  { jersey_number: '29', first_name: 'Test', last_name: 'FS', primary_position: 'FS', position_group: 'defense', depth_order: 1 },
  { jersey_number: '31', first_name: 'Test', last_name: 'SS', primary_position: 'SS', position_group: 'defense', depth_order: 1 },
  // Special Teams
  { jersey_number: '3', first_name: 'Test', last_name: 'Kicker', primary_position: 'K', position_group: 'special_teams', depth_order: 1 },
  { jersey_number: '4', first_name: 'Test', last_name: 'Punter', primary_position: 'P', position_group: 'special_teams', depth_order: 1 },
];

// Playbook plays
const OFFENSIVE_PLAYS = [
  { play_code: 'P-001', play_name: 'Inside Zone', attributes: { odk: 'offense', formation: 'I-Form Pro', playType: 'Run', personnel: '21', customTags: ['Base', '1st Down'] } },
  { play_code: 'P-002', play_name: 'Outside Zone', attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Run', personnel: '11', customTags: ['Base'] } },
  { play_code: 'P-003', play_name: 'Power', attributes: { odk: 'offense', formation: 'I-Form Strong', playType: 'Run', personnel: '22', customTags: ['Short Yardage'] } },
  { play_code: 'P-004', play_name: 'Counter', attributes: { odk: 'offense', formation: 'Shotgun', playType: 'Run', personnel: '11', customTags: ['Misdirection'] } },
  { play_code: 'P-005', play_name: 'Slant Flat', attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', personnel: '11', passConcept: 'Slant/Flat', customTags: ['Quick Game'] } },
  { play_code: 'P-006', play_name: 'Curl Flat', attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', personnel: '11', passConcept: 'Curl/Flat', customTags: ['3rd Down'] } },
  { play_code: 'P-007', play_name: 'Four Verticals', attributes: { odk: 'offense', formation: 'Shotgun Spread', playType: 'Pass', personnel: '11', passConcept: '4 Verts', customTags: ['Deep Shot'] } },
  { play_code: 'P-008', play_name: 'Mesh', attributes: { odk: 'offense', formation: 'Shotgun Empty', playType: 'Pass', personnel: '10', passConcept: 'Mesh', customTags: ['Red Zone'] } },
  { play_code: 'P-009', play_name: 'Screen Left', attributes: { odk: 'offense', formation: 'Shotgun', playType: 'Pass', personnel: '11', passConcept: 'Screen', customTags: ['3rd & Long'] } },
  { play_code: 'P-010', play_name: 'Draw', attributes: { odk: 'offense', formation: 'Shotgun', playType: 'Run', personnel: '11', customTags: ['3rd Down'] } },
  { play_code: 'P-011', play_name: 'Jet Sweep', attributes: { odk: 'offense', formation: 'Pistol', playType: 'Run', personnel: '11', motion: 'Jet', customTags: ['Gadget'] } },
  { play_code: 'P-012', play_name: 'PA Boot', attributes: { odk: 'offense', formation: 'I-Form', playType: 'Pass', personnel: '21', passConcept: 'Boot', customTags: ['Play Action'] } },
  { play_code: 'P-013', play_name: 'Hitch', attributes: { odk: 'offense', formation: 'Shotgun', playType: 'Pass', personnel: '11', passConcept: 'Hitch', customTags: ['Quick Game'] } },
  { play_code: 'P-014', play_name: 'Smash', attributes: { odk: 'offense', formation: 'Shotgun Twins', playType: 'Pass', personnel: '11', passConcept: 'Smash', customTags: ['Cover 2 Beater'] } },
  { play_code: 'P-015', play_name: 'Levels', attributes: { odk: 'offense', formation: 'Shotgun Trips', playType: 'Pass', personnel: '11', passConcept: 'Levels', customTags: ['Zone Beater'] } },
];

const DEFENSIVE_PLAYS = [
  { play_code: 'D-001', play_name: 'Base 4-3', attributes: { odk: 'defense', formation: '4-3 Over', coverage: 'Cover 3' } },
  { play_code: 'D-002', play_name: 'Nickel', attributes: { odk: 'defense', formation: 'Nickel', coverage: 'Cover 2' } },
  { play_code: 'D-003', play_name: 'Dime', attributes: { odk: 'defense', formation: 'Dime', coverage: 'Cover 4' } },
  { play_code: 'D-004', play_name: 'Goal Line', attributes: { odk: 'defense', formation: 'Goal Line', coverage: 'Man' } },
  { play_code: 'D-005', play_name: 'Fire Zone', attributes: { odk: 'defense', formation: '3-4', coverage: 'Cover 3', blitz: true } },
  { play_code: 'D-006', play_name: 'Man Free', attributes: { odk: 'defense', formation: '4-3', coverage: 'Man Cover 1' } },
  { play_code: 'D-007', play_name: 'Tampa 2', attributes: { odk: 'defense', formation: 'Nickel', coverage: 'Tampa 2' } },
  { play_code: 'D-008', play_name: 'Quarters', attributes: { odk: 'defense', formation: '4-3', coverage: 'Cover 4' } },
  { play_code: 'D-009', play_name: 'Pinch', attributes: { odk: 'defense', formation: '4-3 Under', coverage: 'Cover 3' } },
  { play_code: 'D-010', play_name: 'Overload', attributes: { odk: 'defense', formation: '3-4', coverage: 'Zone Blitz', blitz: true } },
];

const SPECIAL_TEAMS_PLAYS = [
  { play_code: 'ST-001', play_name: 'Kickoff Deep', attributes: { odk: 'special_teams', playType: 'Kickoff' } },
  { play_code: 'ST-002', play_name: 'Kickoff Onside', attributes: { odk: 'special_teams', playType: 'Kickoff' } },
  { play_code: 'ST-003', play_name: 'Punt Regular', attributes: { odk: 'special_teams', playType: 'Punt' } },
  { play_code: 'ST-004', play_name: 'FG Right', attributes: { odk: 'special_teams', playType: 'Field Goal' } },
  { play_code: 'ST-005', play_name: 'PAT', attributes: { odk: 'special_teams', playType: 'Extra Point' } },
];

// Helper to get date relative to today
function getRelativeDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

async function createTestUsers() {
  console.log('Creating test users...');
  const createdUsers: Record<string, string> = {};

  for (const [key, user] of Object.entries(TEST_USERS)) {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === user.email);

    if (existing) {
      console.log(`  User ${user.email} already exists`);
      createdUsers[key] = existing.id;
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name }
    });

    if (error) {
      console.error(`  Error creating user ${user.email}:`, error.message);
    } else {
      console.log(`  Created user: ${user.email}`);
      createdUsers[key] = data.user.id;

      // Create profile
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: user.email,
        full_name: user.full_name
      });
    }
  }

  return createdUsers;
}

async function createTeams(ownerIds: { owner: string; multiTeamOwner: string }) {
  console.log('Creating test teams...');
  const createdTeams: Record<string, string> = {};

  for (let i = 0; i < TEST_TEAMS.length; i++) {
    const team = TEST_TEAMS[i];
    // Assign owner: Premium team to multiTeamOwner, others to owner
    const ownerId = team.name === 'Test Team Premium' ? ownerIds.multiTeamOwner : ownerIds.owner;

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: team.name,
        level: team.level,
        colors: team.colors,
        user_id: ownerId
      })
      .select()
      .single();

    if (error) {
      console.error(`  Error creating team ${team.name}:`, error.message);
    } else {
      console.log(`  Created team: ${team.name}`);
      createdTeams[team.name] = data.id;

      // Create team membership for owner
      await supabase.from('team_memberships').insert({
        team_id: data.id,
        user_id: ownerId,
        role: 'owner',
        invited_by: ownerId,
        joined_at: new Date().toISOString()
      });
    }
  }

  return createdTeams;
}

async function createPlayers(teamId: string) {
  console.log(`Creating players for team ${teamId}...`);

  for (const player of ROSTER_TEMPLATE) {
    const { error } = await supabase
      .from('players')
      .insert({
        team_id: teamId,
        ...player,
        is_active: true
      });

    if (error) {
      console.error(`  Error creating player ${player.first_name} ${player.last_name}:`, error.message);
    }
  }

  console.log(`  Created ${ROSTER_TEMPLATE.length} players`);
}

async function createPlays(teamId: string, userId: string) {
  console.log(`Creating playbook plays for team ${teamId}...`);

  const allPlays = [...OFFENSIVE_PLAYS, ...DEFENSIVE_PLAYS, ...SPECIAL_TEAMS_PLAYS];

  for (const play of allPlays) {
    const { error } = await supabase
      .from('playbook_plays')
      .insert({
        team_id: teamId,
        play_code: play.play_code,
        play_name: play.play_name,
        attributes: play.attributes,
        diagram: { odk: play.attributes.odk, formation: play.attributes.formation || '', players: [], routes: [] }
      });

    if (error) {
      console.error(`  Error creating play ${play.play_name}:`, error.message);
    }
  }

  console.log(`  Created ${allPlays.length} plays`);
}

async function createGames(teamId: string, userId: string) {
  console.log(`Creating games for team ${teamId}...`);

  const games = [
    { name: 'vs Opponent A', opponent: 'Opponent A', date: getRelativeDate(-14), team_score: 28, opponent_score: 14, game_result: 'win' },
    { name: 'vs Opponent B', opponent: 'Opponent B', date: getRelativeDate(-7), team_score: 21, opponent_score: 24, game_result: 'loss' },
    { name: 'vs Opponent C', opponent: 'Opponent C', date: getRelativeDate(7), team_score: null, opponent_score: null, game_result: null },
    { name: 'vs Opponent D', opponent: 'Opponent D', date: getRelativeDate(14), team_score: null, opponent_score: null, game_result: null },
  ];

  const createdGames: string[] = [];

  for (const game of games) {
    const { data, error } = await supabase
      .from('games')
      .insert({
        team_id: teamId,
        user_id: userId,
        name: game.name,
        opponent: game.opponent,
        date: game.date,
        team_score: game.team_score,
        opponent_score: game.opponent_score,
        game_result: game.game_result
      })
      .select()
      .single();

    if (error) {
      console.error(`  Error creating game ${game.name}:`, error.message);
    } else {
      createdGames.push(data.id);
      console.log(`  Created game: ${game.name}`);
    }
  }

  return createdGames;
}

async function createScheduleEvents(teamId: string, userId: string) {
  console.log(`Creating schedule events for team ${teamId}...`);

  const events = [
    { event_type: 'practice', title: 'Practice 1', date: getRelativeDate(1), location: 'Main Field' },
    { event_type: 'practice', title: 'Practice 2', date: getRelativeDate(2), location: 'Main Field' },
    { event_type: 'event', title: 'Team Meeting', date: getRelativeDate(3), location: 'Field House' },
  ];

  for (const event of events) {
    const { error } = await supabase
      .from('team_events')
      .insert({
        team_id: teamId,
        created_by: userId,
        ...event
      });

    if (error) {
      console.error(`  Error creating event ${event.title}:`, error.message);
    }
  }

  console.log(`  Created ${events.length} events`);
}

async function createPracticeTemplates(teamId: string, userId: string) {
  console.log(`Creating practice templates for team ${teamId}...`);

  const templates = [
    {
      title: 'Monday Practice',
      template_name: 'Monday Full Pads',
      duration_minutes: 120,
      is_template: true,
      periods: [
        { name: 'Dynamic Warmup', duration_minutes: 10, period_type: 'warmup' },
        { name: 'Individual Period', duration_minutes: 20, period_type: 'drill' },
        { name: 'Indy/Group', duration_minutes: 15, period_type: 'drill' },
        { name: 'Team Run Install', duration_minutes: 20, period_type: 'team' },
        { name: 'Team Pass Install', duration_minutes: 20, period_type: 'team' },
        { name: 'Special Teams', duration_minutes: 15, period_type: 'special_teams' },
        { name: 'Team Scrimmage', duration_minutes: 15, period_type: 'team' },
        { name: 'Conditioning', duration_minutes: 5, period_type: 'conditioning' },
      ]
    },
    {
      title: 'Tuesday Practice',
      template_name: 'Tuesday Shells',
      duration_minutes: 90,
      is_template: true,
      periods: [
        { name: 'Warmup', duration_minutes: 10, period_type: 'warmup' },
        { name: 'Individual', duration_minutes: 15, period_type: 'drill' },
        { name: 'Pass Skeleton', duration_minutes: 20, period_type: 'team' },
        { name: 'Team Period', duration_minutes: 25, period_type: 'team' },
        { name: 'Special Teams', duration_minutes: 15, period_type: 'special_teams' },
        { name: 'Conditioning', duration_minutes: 5, period_type: 'conditioning' },
      ]
    }
  ];

  for (const template of templates) {
    const { data, error } = await supabase
      .from('practice_plans')
      .insert({
        team_id: teamId,
        title: template.title,
        template_name: template.template_name,
        duration_minutes: template.duration_minutes,
        is_template: template.is_template,
        date: getRelativeDate(0), // Placeholder date for template
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error(`  Error creating template ${template.title}:`, error.message);
      continue;
    }

    // Create periods
    for (let i = 0; i < template.periods.length; i++) {
      const period = template.periods[i];
      await supabase
        .from('practice_periods')
        .insert({
          practice_plan_id: data.id,
          period_order: i + 1,
          name: period.name,
          duration_minutes: period.duration_minutes,
          period_type: period.period_type
        });
    }

    console.log(`  Created template: ${template.template_name}`);
  }
}

async function addCoachToTeam(teamId: string, coachUserId: string, invitedBy: string) {
  console.log(`Adding coach to team ${teamId}...`);

  const { error } = await supabase
    .from('team_memberships')
    .insert({
      team_id: teamId,
      user_id: coachUserId,
      role: 'coach',
      invited_by: invitedBy,
      joined_at: new Date().toISOString()
    });

  if (error) {
    console.error('  Error adding coach:', error.message);
  } else {
    console.log('  Coach added successfully');
  }
}

async function cleanupTestData() {
  console.log('Cleaning up existing test data...');

  // Get test user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const testEmails = Object.values(TEST_USERS).map(u => u.email);
  const testUserIds = users?.users
    ?.filter(u => testEmails.includes(u.email || ''))
    .map(u => u.id) || [];

  if (testUserIds.length === 0) {
    console.log('  No existing test data to clean');
    return;
  }

  // Delete in order to respect foreign keys
  // 1. Play instances
  // 2. Videos
  // 3. Games
  // 4. Practice drills
  // 5. Practice periods
  // 6. Practice plans
  // 7. Playbook plays
  // 8. Players
  // 9. Team events
  // 10. Team memberships
  // 11. Teams
  // 12. Users (handled separately)

  // Get team IDs owned by test users
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .in('user_id', testUserIds);

  const teamIds = teams?.map(t => t.id) || [];

  if (teamIds.length > 0) {
    // Delete team-related data
    await supabase.from('play_instances').delete().in('team_id', teamIds);
    await supabase.from('team_events').delete().in('team_id', teamIds);
    await supabase.from('playbook_plays').delete().in('team_id', teamIds);
    await supabase.from('players').delete().in('team_id', teamIds);
    await supabase.from('team_memberships').delete().in('team_id', teamIds);

    // Get and delete games and their related data
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .in('team_id', teamIds);

    if (games && games.length > 0) {
      const gameIds = games.map(g => g.id);
      await supabase.from('videos').delete().in('game_id', gameIds);
      await supabase.from('games').delete().in('id', gameIds);
    }

    // Get and delete practice plans
    const { data: practices } = await supabase
      .from('practice_plans')
      .select('id')
      .in('team_id', teamIds);

    if (practices && practices.length > 0) {
      const practiceIds = practices.map(p => p.id);

      const { data: periods } = await supabase
        .from('practice_periods')
        .select('id')
        .in('practice_plan_id', practiceIds);

      if (periods && periods.length > 0) {
        await supabase.from('practice_drills').delete().in('period_id', periods.map(p => p.id));
      }

      await supabase.from('practice_periods').delete().in('practice_plan_id', practiceIds);
      await supabase.from('practice_plans').delete().in('id', practiceIds);
    }

    // Delete teams
    await supabase.from('teams').delete().in('id', teamIds);
  }

  // Delete profiles and users
  await supabase.from('profiles').delete().in('id', testUserIds);

  for (const userId of testUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }

  console.log('  Cleanup complete');
}

async function main() {
  console.log('========================================');
  console.log('Youth Coach Hub - Test Data Seeding');
  console.log('========================================\n');

  // Clean up first
  await cleanupTestData();
  console.log('');

  // Create users
  const users = await createTestUsers();
  console.log('');

  if (!users.owner || !users.multiTeamOwner) {
    console.error('Failed to create required users');
    process.exit(1);
  }

  // Create teams
  const teams = await createTeams({ owner: users.owner, multiTeamOwner: users.multiTeamOwner });
  console.log('');

  // Set up Test Team Plus as the main test team
  const mainTeamId = teams['Test Team Plus'];
  if (!mainTeamId) {
    console.error('Failed to create main test team');
    process.exit(1);
  }

  // Add coach to main team
  if (users.coach) {
    await addCoachToTeam(mainTeamId, users.coach, users.owner);
    console.log('');
  }

  // Create full data for main team
  await createPlayers(mainTeamId);
  console.log('');

  await createPlays(mainTeamId, users.owner);
  console.log('');

  await createGames(mainTeamId, users.owner);
  console.log('');

  await createScheduleEvents(mainTeamId, users.owner);
  console.log('');

  await createPracticeTemplates(mainTeamId, users.owner);
  console.log('');

  console.log('========================================');
  console.log('Test data seeding complete!');
  console.log('========================================');
  console.log('\nTest Accounts:');
  console.log('  Owner: owner@test.com / TestPassword123!');
  console.log('  Coach: coach@test.com / TestPassword123!');
  console.log('  New User: newuser@test.com / TestPassword123!');
}

main().catch(console.error);
