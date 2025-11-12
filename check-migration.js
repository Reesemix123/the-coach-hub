// Quick script to check if migration 029 was applied
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

async function checkMigration() {
  console.log('Checking if migration 029 was applied...\n');

  // Try to select the new columns
  const { data, error } = await supabase
    .from('players')
    .select('id, jersey_number, first_name, last_name, primary_position, position_group, position_depths')
    .limit(5);

  if (error) {
    console.error('❌ Error querying players table:');
    console.error(error.message);

    if (error.message.includes('primary_position') || error.message.includes('position_group')) {
      console.log('\n⚠️  Migration 029 has NOT been applied yet.');
      console.log('Please run the migration in your Supabase dashboard.');
    }
    return;
  }

  console.log('✅ Migration 029 has been applied successfully!\n');
  console.log('Sample players:');
  console.log('===============');

  data.forEach(player => {
    console.log(`#${player.jersey_number} ${player.first_name} ${player.last_name}`);
    console.log(`  Primary Position: ${player.primary_position || 'NOT SET'}`);
    console.log(`  Position Group: ${player.position_group || 'NOT SET'}`);
    console.log(`  Position Depths: ${JSON.stringify(player.position_depths)}`);
    console.log('');
  });

  // Check how many players have position_group set
  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .not('position_group', 'is', null);

  console.log(`\n${count} players have position_group set`);
}

checkMigration().catch(console.error);
