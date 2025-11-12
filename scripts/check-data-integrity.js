/**
 * Check Data Integrity - Verify if plays exist
 *
 * This will check both with service role and anon key
 * to see if RLS is blocking access
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n🔍 DATA INTEGRITY CHECK\n');

async function checkWithServiceRole() {
  console.log('═'.repeat(70));
  console.log('CHECK 1: Using SERVICE ROLE KEY (bypasses RLS)');
  console.log('═'.repeat(70));

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Check play_instances
  const { data: plays, error: playsError, count: playsCount } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact' });

  if (playsError) {
    console.log('❌ Error querying play_instances:', playsError.message);
  } else {
    console.log(`✅ play_instances: ${playsCount} total rows`);
    if (plays && plays.length > 0) {
      console.log('   Sample row:', {
        id: plays[0].id,
        team_id: plays[0].team_id,
        video_id: plays[0].video_id,
        play_code: plays[0].play_code,
        down: plays[0].down,
        distance: plays[0].distance
      });
    }
  }

  // Check videos
  const { data: videos, error: videosError, count: videosCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact' });

  if (videosError) {
    console.log('❌ Error querying videos:', videosError.message);
  } else {
    console.log(`✅ videos: ${videosCount} total rows`);
  }

  // Check playbook_plays
  const { data: playbook, error: playbookError, count: playbookCount } = await supabase
    .from('playbook_plays')
    .select('*', { count: 'exact' });

  if (playbookError) {
    console.log('❌ Error querying playbook_plays:', playbookError.message);
  } else {
    console.log(`✅ playbook_plays: ${playbookCount} total rows`);
  }

  console.log('\n');
}

async function checkWithAnonKey() {
  console.log('═'.repeat(70));
  console.log('CHECK 2: Using ANON KEY (enforces RLS)');
  console.log('═'.repeat(70));

  const supabase = createClient(supabaseUrl, anonKey);

  // Check play_instances
  const { data: plays, error: playsError, count: playsCount } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact' });

  if (playsError) {
    console.log('❌ Error querying play_instances with anon key:', playsError.message);
    console.log('   This is what the browser sees!');
  } else {
    console.log(`✅ play_instances (anon): ${playsCount} rows visible`);
  }

  // Check videos
  const { data: videos, error: videosError, count: videosCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact' });

  if (videosError) {
    console.log('❌ Error querying videos with anon key:', videosError.message);
  } else {
    console.log(`✅ videos (anon): ${videosCount} rows visible`);
  }

  // Check playbook_plays
  const { data: playbook, error: playbookError, count: playbookCount } = await supabase
    .from('playbook_plays')
    .select('*', { count: 'exact' });

  if (playbookError) {
    console.log('❌ Error querying playbook_plays with anon key:', playbookError.message);
  } else {
    console.log(`✅ playbook_plays (anon): ${playbookCount} rows visible`);
  }

  console.log('\n');
}

async function checkSpecificTeam() {
  console.log('═'.repeat(70));
  console.log('CHECK 3: Specific team query (99ef9d88-454e-42bf-8f52-04d37b34a9d6)');
  console.log('═'.repeat(70));

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const teamId = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

  const { data: plays, error, count } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact' })
    .eq('team_id', teamId);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ Found ${count} play instances for this team`);
    if (plays && plays.length > 0) {
      console.log('\n   First 5 plays:');
      plays.slice(0, 5).forEach((play, i) => {
        console.log(`   ${i + 1}. Play ${play.play_code} - Down ${play.down}, Distance ${play.distance}, Yards ${play.yards_gained}`);
      });
    }
  }

  console.log('\n');
}

async function main() {
  await checkWithServiceRole();
  await checkWithAnonKey();
  await checkSpecificTeam();

  console.log('═'.repeat(70));
  console.log('DIAGNOSIS');
  console.log('═'.repeat(70));
  console.log('\nIf service role shows rows but anon key shows 0:');
  console.log('  → RLS policies are blocking access');
  console.log('  → Need to fix RLS policies on play_instances');
  console.log('\nIf both show 0 rows:');
  console.log('  → Data was lost during migrations');
  console.log('  → Need to restore from backup or re-tag plays');
  console.log('\nIf both show rows:');
  console.log('  → Data exists, something else is wrong');
  console.log('  → Check browser auth state');
  console.log('\n');
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
