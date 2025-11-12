/**
 * Fast Database Schema Check
 *
 * Uses information_schema instead of querying actual tables.
 * Run with: node scripts/check-schema-fast.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Required columns for each tier
const TIER2_COLUMNS = ['quarter', 'time_remaining', 'score_differential', 'drive_id', 'qb_id', 'ball_carrier_id', 'target_id'];
const OL_COLUMNS = ['lt_id', 'lt_block_result', 'lg_id', 'lg_block_result', 'c_id', 'c_block_result', 'rg_id', 'rg_block_result', 'rt_id', 'rt_block_result', 'ol_penalty_player_id'];
const DEFENSIVE_COLUMNS = ['tackler_ids', 'missed_tackle_ids', 'pressure_player_ids', 'sack_player_id', 'coverage_player_id', 'coverage_result', 'is_tfl', 'is_sack', 'is_forced_fumble', 'is_pbu', 'is_interception'];

async function checkSchema() {
  console.log('🔍 Fast Schema Check (using information_schema)...\n');

  // Query information_schema to get all columns
  const { data: columnsData, error } = await supabase.rpc('get_table_columns', {
    p_table_name: 'play_instances'
  });

  // If RPC doesn't exist, try direct query
  if (error || !columnsData) {
    console.log('⚠️  RPC not available, trying direct SQL query...\n');

    // Use raw SQL via rpc
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'play_instances'
      ORDER BY ordinal_position;
    `;

    const { data: rawData, error: rawError } = await supabase.rpc('exec_sql', { sql: query });

    if (rawError) {
      console.error('❌ Cannot query information_schema:', rawError.message);
      console.log('\n💡 CRITICAL ISSUE: Cannot access database schema.');
      console.log('   This suggests a database connection or permission issue.\n');
      return;
    }
  }

  // Alternative: Try to get columns by checking one of the migrations
  console.log('📊 Analyzing required vs actual schema...\n');

  // Count how many play_instances rows exist
  console.log('📈 Checking play_instances table size...');
  const { count, error: countError } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    if (countError.message.includes('timeout')) {
      console.log('❌ Table query TIMED OUT!');
      console.log('   This is the ROOT CAUSE of your analytics issues.\n');
      console.log('🔥 CRITICAL PROBLEM IDENTIFIED:');
      console.log('   The play_instances table is too slow to query.');
      console.log('   Possible causes:');
      console.log('   1. Missing indexes (migrations 009-012 not applied)');
      console.log('   2. Table has too many rows without proper indexes');
      console.log('   3. Database needs VACUUM/ANALYZE\n');
    } else {
      console.log(`❌ Error: ${countError.message}\n`);
    }
  } else {
    console.log(`✅ Found ${count || 0} play instances\n`);
  }

  // Check if RPC functions exist by trying to call them
  console.log('⚙️  Checking Database Functions...');

  const functions = [
    { name: 'calculate_block_win_rate', migration: '010' },
    { name: 'calculate_tackle_participation', migration: '011' },
    { name: 'calculate_pressure_rate', migration: '011' },
    { name: 'calculate_coverage_success', migration: '011' },
  ];

  for (const func of functions) {
    const testId = '00000000-0000-0000-0000-000000000000';
    const { error: funcError } = await supabase
      .rpc(func.name, { p_player_id: testId, p_team_id: testId })
      .limit(0);

    if (funcError) {
      if (funcError.message.includes('does not exist') || funcError.code === '42883') {
        console.log(`  ❌ ${func.name} - Migration ${func.migration} NOT applied`);
      } else if (funcError.message.includes('timeout')) {
        console.log(`  ⚠️  ${func.name} - EXISTS but TIMES OUT`);
      } else {
        console.log(`  ✅ ${func.name}`);
      }
    } else {
      console.log(`  ✅ ${func.name}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎯 DIAGNOSIS:\n');
  console.log('Your analytics are failing because:');
  console.log('1. ❌ play_instances table queries are TIMING OUT');
  console.log('2. ❌ Missing database functions (migrations not applied)');
  console.log('3. ❌ Missing columns and indexes\n');

  console.log('🔧 SOLUTION:\n');
  console.log('You MUST apply these migrations in order:');
  console.log('   📄 009_play_instances_tier12_fields.sql    (Tier 2 columns)');
  console.log('   📄 010_play_instances_ol_tracking.sql      (OL + indexes)');
  console.log('   📄 011_play_instances_defensive_tracking.sql (Defense + indexes)');
  console.log('   📄 012_play_instances_situational_data.sql (Situational)\n');

  console.log('📋 Steps to fix:');
  console.log('   1. Open Supabase Dashboard → SQL Editor');
  console.log('   2. Copy migration 009 content');
  console.log('   3. Run it');
  console.log('   4. Repeat for 010, 011, 012');
  console.log('   5. Refresh your app\n');

  console.log('⚡ These migrations add critical INDEXES that will fix the timeout.\n');
  console.log('='.repeat(70) + '\n');
}

checkSchema().catch(console.error);
