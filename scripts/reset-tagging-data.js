/**
 * Reset Tagging Data Script
 *
 * Deletes play_instances, player_participation, and drives data
 * while preserving teams, players, games, and videos.
 *
 * Usage:
 *   node scripts/reset-tagging-data.js [teamId]
 *   node scripts/reset-tagging-data.js [teamId] [gameId]
 *
 * Examples:
 *   node scripts/reset-tagging-data.js abc-123              (reset all data for team)
 *   node scripts/reset-tagging-data.js abc-123 xyz-789      (reset data for specific game)
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

async function resetTaggingData(teamId, gameId = null) {
  console.log('🧹 Starting tagging data reset...\n');

  try {
    // Step 1: Delete player_participation records
    console.log('1️⃣ Deleting player_participation records...');
    let participationQuery = supabase
      .from('player_participation')
      .delete()
      .eq('team_id', teamId);

    if (gameId) {
      // Need to filter by play_instances that belong to this game
      const { data: playIds } = await supabase
        .from('play_instances')
        .select('id')
        .eq('game_id', gameId);

      if (playIds && playIds.length > 0) {
        participationQuery = participationQuery.in('play_instance_id', playIds.map(p => p.id));
      }
    }

    const { error: participationError, count: participationCount } = await participationQuery;

    if (participationError) {
      console.error('❌ Error deleting player_participation:', participationError.message);
    } else {
      console.log(`   ✅ Deleted ${participationCount || 0} player_participation records`);
    }

    // Step 2: Delete play_instances
    console.log('\n2️⃣ Deleting play_instances...');
    let playQuery = supabase
      .from('play_instances')
      .delete()
      .eq('team_id', teamId);

    if (gameId) {
      playQuery = playQuery.eq('game_id', gameId);
    }

    const { error: playError, count: playCount } = await playQuery;

    if (playError) {
      console.error('❌ Error deleting play_instances:', playError.message);
    } else {
      console.log(`   ✅ Deleted ${playCount || 0} play_instances`);
    }

    // Step 3: Delete drives
    console.log('\n3️⃣ Deleting drives...');
    let driveQuery = supabase
      .from('drives')
      .delete()
      .eq('team_id', teamId);

    if (gameId) {
      driveQuery = driveQuery.eq('game_id', gameId);
    }

    const { error: driveError, count: driveCount } = await driveQuery;

    if (driveError) {
      console.error('❌ Error deleting drives:', driveError.message);
    } else {
      console.log(`   ✅ Deleted ${driveCount || 0} drives`);
    }

    // Summary
    console.log('\n✨ Reset complete!\n');
    console.log('📊 Summary:');
    console.log(`   • Team: ${teamId}`);
    if (gameId) console.log(`   • Game: ${gameId}`);
    console.log(`   • Play instances deleted: ${playCount || 0}`);
    console.log(`   • Player participation deleted: ${participationCount || 0}`);
    console.log(`   • Drives deleted: ${driveCount || 0}`);
    console.log('\n✅ Your teams, players, games, and videos are preserved.');
    console.log('🎬 You can now re-tag film to test the analytics pipeline!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('❌ Usage: node scripts/reset-tagging-data.js [teamId] [gameId]\n');
  console.log('Examples:');
  console.log('  node scripts/reset-tagging-data.js abc-123');
  console.log('  node scripts/reset-tagging-data.js abc-123 xyz-789\n');
  process.exit(1);
}

const [teamId, gameId] = args;

resetTaggingData(teamId, gameId);
