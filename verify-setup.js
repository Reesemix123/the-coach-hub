// Verify complete setup
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local file
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifySetup() {
  console.log('=== VERIFYING SETUP ===\n');

  // 1. Check teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name');

  console.log(`✓ Teams: ${teams?.length || 0}`);
  if (teams && teams.length > 0) {
    console.log(`  Using team: ${teams[0].name} (${teams[0].id})\n`);

    const teamId = teams[0].id;

    // 2. Check analytics config
    const { data: config } = await supabase
      .from('team_analytics_config')
      .select('*')
      .eq('team_id', teamId)
      .single();

    console.log(`✓ Analytics Tier: ${config?.tier || 'Not configured (defaults to hs_basic)'}`);
    if (config) {
      console.log(`  - Drive analytics: ${config.enable_drive_analytics}`);
      console.log(`  - Player attribution: ${config.enable_player_attribution}`);
      console.log(`  - OL tracking: ${config.enable_ol_tracking}`);
      console.log(`  - Defensive tracking: ${config.enable_defensive_tracking}\n`);
    }

    // 3. Check players
    const { data: players, count } = await supabase
      .from('players')
      .select('id, jersey_number, first_name, last_name, primary_position, position_group, position_depths', { count: 'exact' })
      .eq('team_id', teamId);

    console.log(`✓ Players: ${count || 0}`);
    if (players && players.length > 0) {
      console.log(`  Sample players:`);
      players.slice(0, 5).forEach(p => {
        console.log(`  - #${p.jersey_number} ${p.first_name} ${p.last_name} (${p.primary_position || 'NO POSITION'}) [group: ${p.position_group || 'NOT SET'}]`);
      });
      console.log('');

      // Check how many have position_group set
      const { count: withGroup } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .not('position_group', 'is', null);

      console.log(`  Players with position_group: ${withGroup || 0}/${count}\n`);
    } else {
      console.log(`  ⚠️  No players found. Go to Players page to add team members.\n`);
    }

    // 4. Check games
    const { count: gamesCount } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    console.log(`✓ Games: ${gamesCount || 0}\n`);

    // 5. Check play instances
    const { count: playsCount } = await supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    console.log(`✓ Tagged plays: ${playsCount || 0}\n`);

    if (playsCount && playsCount > 0) {
      console.log('✅ You have tagged plays! Analytics should display.\n');
    } else {
      console.log('⚠️  No tagged plays yet. Tag some plays in Film Room to see analytics.\n');
    }
  } else {
    console.log('  ⚠️  No teams found. Create a team first.\n');
  }
}

verifySetup().catch(console.error);
