/**
 * Cleanup the parentprofile@example.com test account and re-seed with correct name.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/cleanup-and-reseed-parent.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'parentprofile@example.com';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Cleaning up existing parentprofile@example.com data...\n');

  // Find the auth user
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find(u => u.email === TEST_EMAIL);

  if (!user) {
    console.log('No existing user found. Run seed-parent-with-profile.ts instead.');
    return;
  }

  const userId = user.id;
  console.log(`  Found auth user: ${userId}`);

  // Find parent profile
  const { data: parent } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (parent) {
    const parentId = parent.id;
    console.log(`  Found parent profile: ${parentId}`);

    // Delete athlete_seasons (cascades from athlete_profiles, but let's be explicit)
    const { data: athletes } = await supabase
      .from('athlete_profiles')
      .select('id')
      .eq('created_by_parent_id', parentId);

    for (const a of athletes ?? []) {
      await supabase.from('athlete_seasons').delete().eq('athlete_profile_id', a.id);
      console.log(`  Deleted athlete_seasons for ${a.id}`);
    }

    // Delete athlete_profiles
    await supabase.from('athlete_profiles').delete().eq('created_by_parent_id', parentId);
    console.log(`  Deleted athlete_profiles`);

    // Delete links
    await supabase.from('player_parent_links').delete().eq('parent_id', parentId);
    console.log(`  Deleted player_parent_links`);

    // Delete team access
    await supabase.from('team_parent_access').delete().eq('parent_id', parentId);
    console.log(`  Deleted team_parent_access`);

    // Delete parent profile
    await supabase.from('parent_profiles').delete().eq('id', parentId);
    console.log(`  Deleted parent_profiles`);
  }

  // Update parent name on the auth user (can't rename, but we'll fix the profile)
  // Delete and recreate the auth user
  await supabase.auth.admin.deleteUser(userId);
  console.log(`  Deleted auth user`);

  console.log('\n✅ Cleanup complete. Now run:\n');
  console.log('  npx dotenv -e .env.local -- npx tsx scripts/seed-parent-with-profile.ts\n');
}

main().catch(console.error);
