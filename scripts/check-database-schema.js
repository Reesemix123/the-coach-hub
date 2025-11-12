/**
 * Database Schema Health Check
 *
 * Verifies that all required columns and functions exist for analytics features.
 * Run with: node scripts/check-database-schema.js
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

// Required columns for Tier 2 (Player Attribution)
const TIER2_COLUMNS = [
  'quarter', 'time_remaining', 'score_differential',
  'drive_id', 'qb_id', 'ball_carrier_id', 'target_id'
];

// Required columns for Tier 3 (OL Tracking)
const OL_COLUMNS = [
  'lt_id', 'lt_block_result',
  'lg_id', 'lg_block_result',
  'c_id', 'c_block_result',
  'rg_id', 'rg_block_result',
  'rt_id', 'rt_block_result',
  'ol_penalty_player_id'
];

// Required columns for Tier 3 (Defensive Tracking)
const DEFENSIVE_COLUMNS = [
  'tackler_ids', 'missed_tackle_ids', 'pressure_player_ids',
  'sack_player_id', 'coverage_player_id', 'coverage_result',
  'is_tfl', 'is_sack', 'is_forced_fumble', 'is_pbu', 'is_interception'
];

// Required RPC functions
const REQUIRED_FUNCTIONS = [
  'calculate_block_win_rate',
  'calculate_tackle_participation',
  'calculate_pressure_rate',
  'calculate_coverage_success',
  'calculate_havoc_rate'
];

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  // Check play_instances columns
  console.log('📋 Checking play_instances table columns...');

  const { data: columns, error } = await supabase
    .from('play_instances')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying play_instances:', error.message);
    return;
  }

  const existingColumns = columns && columns.length > 0 ? Object.keys(columns[0]) : [];
  console.log(`✅ Found ${existingColumns.length} columns in play_instances\n`);

  // Check Tier 2 columns
  console.log('🎯 Tier 2 (Player Attribution) Columns:');
  let tier2Missing = [];
  TIER2_COLUMNS.forEach(col => {
    const exists = existingColumns.includes(col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    if (!exists) tier2Missing.push(col);
  });

  // Check OL columns
  console.log('\n🏈 Tier 3 (Offensive Line) Columns:');
  let olMissing = [];
  OL_COLUMNS.forEach(col => {
    const exists = existingColumns.includes(col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    if (!exists) olMissing.push(col);
  });

  // Check Defensive columns
  console.log('\n🛡️  Tier 3 (Defensive) Columns:');
  let defMissing = [];
  DEFENSIVE_COLUMNS.forEach(col => {
    const exists = existingColumns.includes(col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    if (!exists) defMissing.push(col);
  });

  // Check RPC functions
  console.log('\n⚙️  Database Functions:');
  for (const funcName of REQUIRED_FUNCTIONS) {
    // Try to call the function with dummy UUID to see if it exists
    const testId = '00000000-0000-0000-0000-000000000000';
    const { error: funcError } = await supabase
      .rpc(funcName, {
        p_player_id: testId,
        p_team_id: testId
      })
      .limit(0);

    if (funcError) {
      if (funcError.message.includes('does not exist') || funcError.code === '42883') {
        console.log(`  ❌ ${funcName} - NOT FOUND`);
      } else {
        // Function exists but failed for other reason (expected with dummy ID)
        console.log(`  ✅ ${funcName}`);
      }
    } else {
      console.log(`  ✅ ${funcName}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:\n');

  const totalMissing = tier2Missing.length + olMissing.length + defMissing.length;

  if (totalMissing === 0) {
    console.log('✅ All required columns exist!');
  } else {
    console.log(`❌ Missing ${totalMissing} columns:\n`);

    if (tier2Missing.length > 0) {
      console.log('  Tier 2: Run migration 009_play_instances_tier12_fields.sql');
      console.log('  Missing:', tier2Missing.join(', '));
    }

    if (olMissing.length > 0) {
      console.log('\n  Tier 3 (OL): Run migration 010_play_instances_ol_tracking.sql');
      console.log('  Missing:', olMissing.join(', '));
    }

    if (defMissing.length > 0) {
      console.log('\n  Tier 3 (Def): Run migration 011_play_instances_defensive_tracking.sql');
      console.log('  Missing:', defMissing.join(', '));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 To apply migrations:');
  console.log('   1. Open Supabase Dashboard > SQL Editor');
  console.log('   2. Copy the contents of the migration file');
  console.log('   3. Execute the SQL');
  console.log('   4. Refresh your app\n');
}

checkSchema().catch(console.error);
