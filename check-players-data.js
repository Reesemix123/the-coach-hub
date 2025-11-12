// Check actual player data to see why position_group isn't being set
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

async function checkPlayers() {
  console.log('Checking player data...\n');

  const { data: players, error } = await supabase
    .from('players')
    .select('id, jersey_number, first_name, last_name, primary_position, position_group, position_depths')
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Found ${players.length} players:\n`);

  players.forEach(player => {
    console.log(`#${player.jersey_number} ${player.first_name} ${player.last_name}`);
    console.log(`  primary_position: ${player.primary_position || 'NULL'}`);
    console.log(`  position_group: ${player.position_group || 'NULL'}`);
    console.log(`  position_depths: ${JSON.stringify(player.position_depths)}`);
    console.log('');
  });

  // Check if any position_depths are empty
  const { count: emptyDepths } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .or('position_depths.is.null,position_depths.eq.{}');

  console.log(`\nPlayers with empty position_depths: ${emptyDepths}`);

  // Check total players
  const { count: total } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true });

  console.log(`Total players: ${total}`);
}

checkPlayers().catch(console.error);
