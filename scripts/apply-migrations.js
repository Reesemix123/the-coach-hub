/**
 * Migration Runner
 *
 * Applies SQL migrations directly to the database using Supabase client.
 * This bypasses the need for CLI authentication.
 *
 * Run with: node scripts/apply-migrations.js
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

// Create Supabase client with service role key for admin operations
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Migrations to apply (in order)
const MIGRATIONS = [
  {
    file: '009_play_instances_tier12_fields.sql',
    description: 'Tier 2 - Player Attribution Fields',
    priority: 'HIGH'
  },
  {
    file: '010_play_instances_ol_tracking.sql',
    description: 'Tier 3 - Offensive Line Tracking + Indexes',
    priority: 'HIGH'
  },
  {
    file: '011_play_instances_defensive_tracking.sql',
    description: 'Tier 3 - Defensive Tracking + Indexes',
    priority: 'HIGH'
  },
  {
    file: '012_play_instances_situational_data.sql',
    description: 'Tier 3 - Situational Data Fields',
    priority: 'MEDIUM'
  }
];

async function applyMigration(migration) {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migration.file);

  if (!fs.existsSync(migrationPath)) {
    console.log(`❌ Migration file not found: ${migration.file}`);
    return false;
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📄 ${migration.file}`);
  console.log(`   ${migration.description}`);
  console.log(`   Priority: ${migration.priority}`);
  console.log(`${'='.repeat(70)}\n`);

  // Split SQL into individual statements (handle CREATE FUNCTION which has semicolons inside)
  const statements = [];
  let currentStatement = '';
  let inFunction = false;

  sql.split('\n').forEach(line => {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('--') || trimmed === '') {
      return;
    }

    // Track if we're inside a function definition
    if (trimmed.includes('CREATE OR REPLACE FUNCTION') || trimmed.includes('CREATE FUNCTION')) {
      inFunction = true;
    }

    currentStatement += line + '\n';

    // End of function
    if (inFunction && (trimmed === '$$ LANGUAGE plpgsql STABLE;' || trimmed === '$$ LANGUAGE plpgsql;')) {
      inFunction = false;
      statements.push(currentStatement.trim());
      currentStatement = '';
      return;
    }

    // Regular statement end
    if (!inFunction && trimmed.endsWith(';') && !trimmed.includes('$$')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  });

  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`   Found ${statements.length} SQL statements to execute...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip empty statements
    if (!statement || statement === '') continue;

    // Get a preview of the statement
    const preview = statement.split('\n')[0].substring(0, 70);
    const stmtNumber = `[${i + 1}/${statements.length}]`;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0); // Just test connection

        if (directError) {
          throw error;
        }

        // If we can't use exec_sql, we need to use the REST API differently
        // This is a limitation - we can't execute DDL through the anon key
        throw new Error('Cannot execute DDL statements with anon key. Service role key required.');
      }

      console.log(`   ✅ ${stmtNumber} ${preview}...`);
      successCount++;

    } catch (err) {
      // Check if error is "already exists" which is fine (idempotent)
      if (err.message && (
        err.message.includes('already exists') ||
        err.message.includes('IF NOT EXISTS') ||
        err.message.includes('duplicate')
      )) {
        console.log(`   ⚠️  ${stmtNumber} ${preview}... (already exists, skipping)`);
        successCount++;
      } else {
        console.log(`   ❌ ${stmtNumber} ${preview}...`);
        console.log(`      Error: ${err.message}`);
        errorCount++;
      }
    }
  }

  console.log(`\n   Summary: ${successCount} successful, ${errorCount} failed`);

  return errorCount === 0;
}

async function runMigrations() {
  console.log('\n🚀 Youth Coach Hub - Database Migration Runner\n');
  console.log(`Connecting to: ${supabaseUrl}`);
  console.log(`Using key: ${supabaseKey.substring(0, 20)}...\n`);

  // Check if we have service role key
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️  WARNING: Service role key not found in .env.local');
    console.log('   Using anon key instead (limited permissions)\n');
    console.log('💡 To apply migrations properly, add to .env.local:');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.log('   (Get it from Supabase Dashboard → Settings → API → service_role)\n');
    console.log('📋 ALTERNATIVE: Apply migrations manually via Supabase Dashboard:\n');

    MIGRATIONS.forEach(m => {
      console.log(`   1. Open: https://supabase.com/dashboard/project/gvzdsuodulrdbitxfvjw/sql/new`);
      console.log(`   2. Copy contents of: supabase/migrations/${m.file}`);
      console.log(`   3. Click "Run"\n`);
    });

    return;
  }

  let appliedCount = 0;

  for (const migration of MIGRATIONS) {
    const success = await applyMigration(migration);
    if (success) appliedCount++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ Migration run complete: ${appliedCount}/${MIGRATIONS.length} applied successfully\n`);

  if (appliedCount === MIGRATIONS.length) {
    console.log('🎉 All migrations applied! Your database is now up to date.');
    console.log('   Refresh your app to see the player stats working.\n');
  } else {
    console.log('⚠️  Some migrations failed. Check errors above.');
    console.log('   You may need to apply them manually via Supabase Dashboard.\n');
  }
}

runMigrations().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
