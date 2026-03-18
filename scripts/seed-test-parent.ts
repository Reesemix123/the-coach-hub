/**
 * Seed Script: Create a test parent account for local development
 *
 * Usage: npx tsx scripts/seed-test-parent.ts
 *
 * Creates:
 * 1. A Supabase Auth user with email/password
 * 2. A parent_profiles record
 * 3. Links to the first player on your first team
 * 4. Grants team_parent_access
 *
 * Login credentials:
 *   Email: testparent@example.com
 *   Password: TestParent123!
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = 'testparent@example.com';
const TEST_PASSWORD = 'TestParent123!';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    console.error('Run with: npx dotenv -e .env.local -- npx tsx scripts/seed-test-parent.ts');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('🏈 Seeding test parent account...\n');

  // 1. Get the first team
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .limit(1)
    .single();

  if (teamsError || !teams) {
    console.error('No teams found. Create a team first.');
    process.exit(1);
  }

  console.log(`  Team: ${teams.name} (${teams.id})`);

  // 2. Get the first player on that team
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number')
    .eq('team_id', teams.id)
    .limit(1)
    .single();

  if (playerError || !player) {
    console.error('No players found on this team. Add a player first.');
    process.exit(1);
  }

  console.log(`  Player: ${player.first_name} ${player.last_name} #${player.jersey_number} (${player.id})`);

  // 3. Check if test user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === TEST_EMAIL);

  let userId: string;

  if (existingUser) {
    console.log(`  Auth user already exists: ${existingUser.id}`);
    userId = existingUser.id;
  } else {
    // Create auth user
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true, // Auto-confirm so they can log in immediately
    });

    if (authError || !newUser.user) {
      console.error('Failed to create auth user:', authError);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`  Created auth user: ${userId}`);
  }

  // 4. Create or update parent_profiles
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
        first_name: 'Test',
        last_name: 'Parent',
        email: TEST_EMAIL,
        phone: '+15555550100',
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
    .eq('team_id', teams.id)
    .maybeSingle();

  if (existingAccess) {
    console.log(`  Team access already exists`);
  } else {
    const { error: accessError } = await supabase
      .from('team_parent_access')
      .insert({
        team_id: teams.id,
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

  console.log('\n✅ Test parent account ready!\n');
  console.log('  Login credentials:');
  console.log(`    Email:    ${TEST_EMAIL}`);
  console.log(`    Password: ${TEST_PASSWORD}`);
  console.log(`    Team:     ${teams.name}`);
  console.log(`    Player:   ${player.first_name} ${player.last_name}`);
  console.log(`\n  Parent Profile ID: ${parentId}`);
  console.log(`  Team ID: ${teams.id}`);
  console.log(`\n  To test messaging, open an incognito window and log in as the parent.`);
  console.log(`  Then navigate to: /parent/teams/${teams.id}/messages`);
}

main().catch(console.error);
