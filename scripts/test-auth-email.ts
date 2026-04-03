/**
 * One-off script to trigger a password reset email via Supabase admin API.
 * Tests that the branded auth email template renders correctly.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/test-auth-email.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Generating password recovery link for markreese@live.com...');

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: 'markreese@live.com',
  });

  if (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Recovery link generated successfully!');
  console.log('  Email should arrive shortly at markreese@live.com');
  console.log('  Link properties:', JSON.stringify(data.properties, null, 2));
}

main().catch(console.error);
