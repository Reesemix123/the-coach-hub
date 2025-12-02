/**
 * Show IDs Helper Script
 *
 * Displays team IDs, game IDs, and current tagging data counts
 * to help you run the reset-tagging-data.js script.
 *
 * Usage:
 *   node scripts/show-ids.js
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function showIds() {
  console.log('🔍 Fetching your teams and games...\n');

  try {
    // Get teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (teamsError) {
      console.error('❌ Error fetching teams:', teamsError.message);
      return;
    }

    if (!teams || teams.length === 0) {
      console.log('📭 No teams found.');
      return;
    }

    console.log('📋 YOUR TEAMS:\n');

    for (const team of teams) {
      console.log(`🏈 ${team.name}`);
      console.log(`   ID: ${team.id}`);
      console.log(`   Level: ${team.level}`);

      // Get play count for this team
      const { count: playCount } = await supabase
        .from('play_instances')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);

      const { count: participationCount } = await supabase
        .from('player_participation')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);

      const { count: driveCount } = await supabase
        .from('drives')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);

      console.log(`   📊 Current data:`);
      console.log(`      • ${playCount || 0} play instances`);
      console.log(`      • ${participationCount || 0} player participation records`);
      console.log(`      • ${driveCount || 0} drives`);

      // Get games for this team
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', team.id)
        .order('date', { ascending: false });

      if (games && games.length > 0) {
        console.log(`\n   🎮 GAMES:`);
        for (const game of games) {
          console.log(`      • ${game.name} (${game.date})`);
          console.log(`        ID: ${game.id}`);
          console.log(`        Opponent: ${game.opponent || 'N/A'}`);

          // Get play count for this game
          const { count: gamePlays } = await supabase
            .from('play_instances')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id);

          console.log(`        Tagged plays: ${gamePlays || 0}`);
        }
      } else {
        console.log(`\n   📭 No games yet`);
      }

      console.log('\n' + '─'.repeat(60) + '\n');
    }

    console.log('💡 TO RESET DATA:\n');
    console.log('Reset all tagging data for a team:');
    console.log('  node scripts/reset-tagging-data.js [TEAM_ID]\n');
    console.log('Reset tagging data for a specific game:');
    console.log('  node scripts/reset-tagging-data.js [TEAM_ID] [GAME_ID]\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

showIds();
