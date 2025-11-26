// Query the database to find drives
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local file
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function queryDrives() {
  console.log('=== STEP 1: Find ALL games ===');
  const { data: allGames, error: allGamesError } = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })
    .limit(10);

  if (allGamesError) {
    console.error('Error fetching all games:', allGamesError);
    return;
  }

  console.log('All games (last 10):');
  allGames?.forEach(g => {
    console.log(`  - ${g.name} vs ${g.opponent} (${g.date}) [ID: ${g.id}]`);
  });

  console.log('\n=== STEP 2: Find Bears games ===');
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .ilike('opponent', '%bear%');

  if (gamesError) {
    console.error('Error fetching games:', gamesError);
    return;
  }

  console.log('Games with "bear" in name:', games);

  if (!games || games.length === 0) {
    console.log('No games found with "bear" in opponent name');
    console.log('\nPlease check the opponent name in the list above and let me know which game is the Bears game!');
    return;
  }

  const gameId = games[0].id;
  console.log('\n=== STEP 2: Find drives for game:', games[0].opponent, '===');

  const { data: drives, error: drivesError } = await supabase
    .from('drives')
    .select('*')
    .eq('game_id', gameId)
    .order('drive_number');

  if (drivesError) {
    console.error('Error fetching drives:', drivesError);
    return;
  }

  console.log('Drives found:', drives);

  console.log('\n=== STEP 3: Count plays for each drive ===');
  for (const drive of drives || []) {
    const { count, error } = await supabase
      .from('play_instances')
      .select('*', { count: 'exact', head: true })
      .eq('drive_id', drive.id);

    console.log(`Drive #${drive.drive_number} (${drive.possession_type}): plays_count=${drive.plays_count}, actual=${count}`);
  }
}

queryDrives().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
