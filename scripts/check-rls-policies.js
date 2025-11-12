/**
 * Check RLS Policies on play_instances
 *
 * This will show us if any RLS policies are referencing
 * broken functions or non-existent columns.
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

console.log('\n🔒 CHECKING RLS POLICIES ON play_instances\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  // Query pg_policies to see all RLS policies
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual as using_expression,
          with_check as with_check_expression
        FROM pg_policies
        WHERE tablename = 'play_instances'
        ORDER BY policyname;
      `
    });

  if (error) {
    console.log('❌ Cannot query policies via RPC');
    console.log('   Error:', error.message);
    console.log('\nTrying alternative method...\n');

    // Try direct query with postgrest
    const { data: altData, error: altError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'play_instances');

    if (altError) {
      console.log('❌ Also failed with alternative method');
      console.log('   Error:', altError.message);
      console.log('\n⚠️  Manual check required:');
      console.log('   Go to Supabase Dashboard → Database → Tables → play_instances → Policies');
      console.log('   Look for any policies that might reference broken functions\n');
      return;
    }

    console.log('✅ RLS Policies found:', altData);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No RLS policies found on play_instances');
    console.log('   This might be the problem - table might not have RLS enabled\n');
    return;
  }

  console.log(`Found ${data.length} RLS policies:\n`);

  data.forEach((policy, index) => {
    console.log(`${index + 1}. ${policy.policyname}`);
    console.log(`   Command: ${policy.cmd}`);
    console.log(`   Roles: ${policy.roles}`);
    console.log(`   USING: ${policy.using_expression || '(none)'}`);
    console.log(`   WITH CHECK: ${policy.with_check_expression || '(none)'}`);
    console.log('');
  });

  console.log('═'.repeat(70));
  console.log('CHECKING FOR COMMON ISSUES');
  console.log('═'.repeat(70));

  // Check for policies that might call functions
  const problematicPatterns = [
    'auth.uid()',
    'auth.jwt()',
    'current_user',
    'session_user',
  ];

  data.forEach(policy => {
    const usingExpr = policy.using_expression || '';
    const checkExpr = policy.with_check_expression || '';

    problematicPatterns.forEach(pattern => {
      if (usingExpr.includes(pattern) || checkExpr.includes(pattern)) {
        console.log(`✅ Policy "${policy.policyname}" uses ${pattern}`);
      }
    });
  });

  console.log('\n');
}

async function testWithAuthUser() {
  console.log('═'.repeat(70));
  console.log('TESTING QUERY AS AUTHENTICATED USER');
  console.log('═'.repeat(70));

  // This simulates what the browser does
  const { data, error } = await supabase
    .from('play_instances')
    .select('*')
    .eq('team_id', '99ef9d88-454e-42bf-8f52-04d37b34a9d6')
    .eq('is_opponent_play', false);

  if (error) {
    console.log('❌ Query failed:');
    console.log('   Code:', error.code);
    console.log('   Message:', error.message);
    console.log('   Details:', error.details);
    console.log('   Hint:', error.hint);
    console.log('\n🔥 THIS IS THE RLS POLICY ERROR! 🔥\n');
  } else {
    console.log(`✅ Query succeeded, returned ${data.length} rows`);
  }

  console.log('\n');
}

async function main() {
  await checkPolicies();
  await testWithAuthUser();

  console.log('═'.repeat(70));
  console.log('DIAGNOSIS COMPLETE');
  console.log('═'.repeat(70));
  console.log('\nIf you saw RLS policy errors above, the fix is to:');
  console.log('  1. Temporarily disable RLS: ALTER TABLE play_instances DISABLE ROW LEVEL SECURITY;');
  console.log('  2. Or fix the broken policy in Supabase Dashboard');
  console.log('  3. Or run the correct RLS policy migration');
  console.log('\n');
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
