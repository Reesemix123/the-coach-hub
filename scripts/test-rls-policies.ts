import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('Supabase URL:', supabaseUrl?.substring(0, 30) + '...');

async function testPolicies() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Testing RLS policies...\n');

  // Test 1: Query teams table (without auth)
  console.log('1. Testing teams SELECT (anonymous):');
  const { data: teamsAnon, error: teamsAnonError } = await supabase
    .from('teams')
    .select('id, name')
    .limit(1);

  if (teamsAnonError) {
    console.log('   Error:', teamsAnonError.message);
  } else {
    console.log('   Result:', teamsAnon?.length ?? 0, 'teams (should be 0 for anon)');
  }

  // Test 2: Query team_members table (without auth)
  console.log('\n2. Testing team_members SELECT (anonymous):');
  const { data: membersAnon, error: membersAnonError } = await supabase
    .from('team_members')
    .select('id, role')
    .limit(1);

  if (membersAnonError) {
    console.log('   Error:', membersAnonError.message);
  } else {
    console.log('   Result:', membersAnon?.length ?? 0, 'members (should be 0 for anon)');
  }

  // Test 3: Check if get_user_team_ids function exists
  console.log('\n3. Testing get_user_team_ids function:');
  const { data: funcData, error: funcError } = await supabase.rpc('get_user_team_ids');

  if (funcError) {
    console.log('   Error:', funcError.message);
  } else {
    console.log('   Result:', funcData);
  }

  // Test 4: Check current policies
  console.log('\n4. Checking pg_policies for teams:');
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'teams');

  if (policiesError) {
    console.log('   Error:', policiesError.message, '(expected - pg_policies is not exposed)');
  } else {
    console.log('   Policies:', policies);
  }

  console.log('\n\nDone. If no recursion errors occurred, RLS is fixed!');
}

testPolicies().catch(console.error);
