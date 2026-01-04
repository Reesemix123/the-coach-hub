import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// We need the service role key to run DDL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.log('The migration needs to be applied manually or via supabase db push');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyFix() {
  console.log('Reading migration file...');
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/122_fix_special_teams_metrics.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration...');

  // Use Postgres function via RPC or raw SQL
  // Since we can't run DDL directly via Supabase JS, we'll need to use the SQL Editor or CLI
  console.log('\\nThis migration needs to be applied via the Supabase Dashboard SQL Editor.');
  console.log('\\n1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
  console.log('2. Copy the contents of: supabase/migrations/122_fix_special_teams_metrics.sql');
  console.log('3. Run the SQL in the editor');
  console.log('\\nOr run: supabase db push (with proper migration history repair)');
}

applyFix().catch(console.error);
