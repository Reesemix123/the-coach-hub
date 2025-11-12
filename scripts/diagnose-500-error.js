/**
 * Diagnose 500 Error on play_instances queries
 *
 * This script connects to Supabase and runs diagnostic queries
 * to identify why SELECT queries on play_instances are failing.
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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n🔍 DIAGNOSING 500 ERROR ON play_instances\n');
console.log(`Connecting to: ${supabaseUrl}`);
console.log(`Using key: ${supabaseKey.substring(0, 20)}...\n`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  const teamId = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

  console.log('═'.repeat(70));
  console.log('STEP 1: Check if we can count play_instances');
  console.log('═'.repeat(70));

  try {
    const { data, error, count } = await supabase
      .from('play_instances')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Error counting play_instances:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
    } else {
      console.log(`✅ Total play_instances rows: ${count}`);
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('STEP 2: Try selecting a single row');
  console.log('═'.repeat(70));

  try {
    const { data, error } = await supabase
      .from('play_instances')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error selecting single row:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
    } else {
      console.log(`✅ Successfully selected ${data.length} row(s)`);
      if (data.length > 0) {
        console.log('   Columns present:', Object.keys(data[0]).join(', '));
      }
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('STEP 3: Try the exact query that failed in the app');
  console.log('═'.repeat(70));

  try {
    const { data, error } = await supabase
      .from('play_instances')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_opponent_play', false);

    if (error) {
      console.log('❌ Error with team filter:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
      console.log('\n🔥 THIS IS THE ERROR CAUSING THE 500! 🔥\n');
    } else {
      console.log(`✅ Successfully queried play_instances for team`);
      console.log(`   Rows returned: ${data.length}`);
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('STEP 4: Check database schema for play_instances');
  console.log('═'.repeat(70));

  try {
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'play_instances'
          ORDER BY ordinal_position;
        `
      });

    if (error) {
      console.log('❌ Cannot query schema via RPC (trying alternative method)');

      // Try getting schema from a sample row
      const { data: sampleData, error: sampleError } = await supabase
        .from('play_instances')
        .select('*')
        .limit(1)
        .single();

      if (!sampleError && sampleData) {
        console.log('✅ Columns from sample row:');
        Object.keys(sampleData).forEach(col => {
          console.log(`   - ${col}: ${typeof sampleData[col]}`);
        });
      }
    } else {
      console.log('✅ Schema query successful');
      console.log(data);
    }
  } catch (err) {
    console.log('⚠️  Cannot determine schema:', err.message);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('STEP 5: Check if critical columns exist');
  console.log('═'.repeat(70));

  // Try to select specific columns that should exist
  const criticalColumns = [
    // From migration 009 (tier 2 fields)
    ['quarter', 'time_remaining', 'score_differential'],
    ['ball_carrier_id', 'qb_id', 'target_id'],
    ['drive_id', 'success', 'explosive'],

    // From migration 010 (OL tracking)
    ['lt_id', 'lg_id', 'c_id', 'rg_id', 'rt_id'],
    ['lt_block_result', 'lg_block_result', 'c_block_result'],
    ['ol_penalty_player_id'],

    // From migration 011 (defensive)
    ['tackler_ids', 'missed_tackle_ids', 'pressure_player_ids'],
    ['sack_player_id', 'coverage_player_id', 'coverage_result'],

    // From migration 012 (situational)
    ['has_motion', 'is_play_action', 'facing_blitz'],
  ];

  for (const columnGroup of criticalColumns) {
    try {
      const { data, error } = await supabase
        .from('play_instances')
        .select(columnGroup.join(','))
        .limit(1);

      if (error) {
        console.log(`❌ Missing columns: ${columnGroup.join(', ')}`);
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`✅ Found columns: ${columnGroup.join(', ')}`);
      }
    } catch (err) {
      console.log(`❌ Error checking ${columnGroup.join(', ')}:`, err.message);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('DIAGNOSIS COMPLETE');
  console.log('═'.repeat(70));
  console.log('\nCheck the errors above to identify the root cause.');
  console.log('Most likely issues:');
  console.log('  1. Missing columns from migrations 009-012');
  console.log('  2. Broken trigger function (auto_compute_play_metrics)');
  console.log('  3. RLS policy referencing non-existent columns/functions');
  console.log('\n');
}

diagnose().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
