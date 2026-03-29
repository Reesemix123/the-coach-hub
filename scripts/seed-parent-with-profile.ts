/**
 * Seed Script: Create a parent account with athlete profile for testing
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/seed-parent-with-profile.ts
 *
 * Creates:
 * 1. A Supabase Auth user with email/password
 * 2. A parent_profiles record
 * 3. Links to the first player on the coach's first team
 * 4. Grants team_parent_access
 * 5. Creates an athlete_profile owned by this parent
 * 6. Creates an athlete_seasons entry linking profile → roster → team
 *
 * Login credentials:
 *   Email: parentprofile@example.com
 *   Password: ParentProfile123!
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = 'parentprofile@example.com';
const TEST_PASSWORD = 'ParentProfile123!';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    console.error('Run with: npx dotenv -e .env.local -- npx tsx scripts/seed-parent-with-profile.ts');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('🏈 Seeding parent account with athlete profile...\n');

  // 1. Get the first team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .limit(1)
    .single();

  if (teamError || !team) {
    console.error('No teams found. Create a team first.');
    process.exit(1);
  }
  console.log(`  Team: ${team.name} (${team.id})`);

  // 2. Get the first player on that team
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number, primary_position')
    .eq('team_id', team.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (playerError || !player) {
    console.error('No players found on this team. Add a player first.');
    process.exit(1);
  }
  console.log(`  Player: ${player.first_name} ${player.last_name} #${player.jersey_number} (${player.id})`);

  // 3. Create or find auth user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === TEST_EMAIL);

  let userId: string;

  if (existingUser) {
    console.log(`  Auth user already exists: ${existingUser.id}`);
    userId = existingUser.id;
  } else {
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (authError || !newUser.user) {
      console.error('Failed to create auth user:', authError);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log(`  Created auth user: ${userId}`);
  }

  // 4. Create or find parent_profiles
  const { data: existingProfile } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let parentId: string;

  if (existingProfile) {
    parentId = existingProfile.id;
    console.log(`  Parent profile already exists: ${parentId}`);
  } else {
    const { data: profile, error: profileError } = await supabase
      .from('parent_profiles')
      .insert({
        user_id: userId,
        first_name: 'Sarah',
        last_name: 'Tucker',
        email: TEST_EMAIL,
        phone: '+15555550200',
        notification_preference: 'email',
        is_champion: false,
      })
      .select()
      .single();

    if (profileError || !profile) {
      console.error('Failed to create parent profile:', profileError);
      process.exit(1);
    }
    parentId = profile.id;
    console.log(`  Created parent profile: ${parentId}`);
  }

  // 5. Link parent to player
  const { data: existingLink } = await supabase
    .from('player_parent_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('player_id', player.id)
    .maybeSingle();

  if (existingLink) {
    console.log(`  Player-parent link already exists`);
  } else {
    const { error: linkError } = await supabase
      .from('player_parent_links')
      .insert({
        parent_id: parentId,
        player_id: player.id,
        relationship: 'father',
        is_primary_contact: true,
      });

    if (linkError) {
      console.error('Failed to link parent to player:', linkError);
      process.exit(1);
    }
    console.log(`  Linked parent to player`);
  }

  // 6. Grant team access
  const { data: existingAccess } = await supabase
    .from('team_parent_access')
    .select('id')
    .eq('parent_id', parentId)
    .eq('team_id', team.id)
    .maybeSingle();

  if (existingAccess) {
    console.log(`  Team access already exists`);
  } else {
    const { error: accessError } = await supabase
      .from('team_parent_access')
      .insert({
        team_id: team.id,
        parent_id: parentId,
        access_level: 'full',
        status: 'active',
      });

    if (accessError) {
      console.error('Failed to grant team access:', accessError);
      process.exit(1);
    }
    console.log(`  Granted team access`);
  }

  // 7. Create athlete_profile
  const { data: existingAthlete } = await supabase
    .from('athlete_profiles')
    .select('id')
    .eq('created_by_parent_id', parentId)
    .maybeSingle();

  let athleteProfileId: string;

  if (existingAthlete) {
    athleteProfileId = existingAthlete.id;
    console.log(`  Athlete profile already exists: ${athleteProfileId}`);
  } else {
    const { data: athleteProfile, error: athleteError } = await supabase
      .from('athlete_profiles')
      .insert({
        athlete_first_name: player.first_name,
        athlete_last_name: player.last_name,
        graduation_year: 2028,
        created_by_parent_id: parentId,
      })
      .select()
      .single();

    if (athleteError || !athleteProfile) {
      console.error('Failed to create athlete profile:', athleteError);
      process.exit(1);
    }
    athleteProfileId = athleteProfile.id;
    console.log(`  Created athlete profile: ${athleteProfileId}`);
  }

  // 8. Create athlete_seasons
  const { data: existingSeason } = await supabase
    .from('athlete_seasons')
    .select('id')
    .eq('athlete_profile_id', athleteProfileId)
    .eq('team_id', team.id)
    .maybeSingle();

  if (existingSeason) {
    console.log(`  Athlete season already exists: ${existingSeason.id}`);
  } else {
    const { data: season, error: seasonError } = await supabase
      .from('athlete_seasons')
      .insert({
        athlete_profile_id: athleteProfileId,
        team_id: team.id,
        roster_id: player.id,
        sport: 'football',
        season_year: 2026,
        position: player.primary_position,
        jersey_number: player.jersey_number,
      })
      .select()
      .single();

    if (seasonError || !season) {
      console.error('Failed to create athlete season:', seasonError);
      process.exit(1);
    }
    console.log(`  Created athlete season: ${season.id} (2026 football)`);
  }

  console.log('\n✅ Parent account with athlete profile ready!\n');
  console.log('  Login credentials:');
  console.log(`    Email:    ${TEST_EMAIL}`);
  console.log(`    Password: ${TEST_PASSWORD}`);
  console.log(`    Team:     ${team.name}`);
  console.log(`    Player:   ${player.first_name} ${player.last_name} #${player.jersey_number}`);
  console.log(`\n  Parent Profile ID:  ${parentId}`);
  console.log(`  Athlete Profile ID: ${athleteProfileId}`);
  console.log(`  Team ID:            ${team.id}`);
  console.log(`\n  Profile page: /parent/athletes/${athleteProfileId}`);
}

main().catch(console.error);
