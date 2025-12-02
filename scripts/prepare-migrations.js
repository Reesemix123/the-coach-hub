/**
 * Migration Preparation Tool
 *
 * Combines all required migrations into a single SQL file
 * that can be copy/pasted into Supabase Dashboard SQL Editor.
 *
 * Run with: node scripts/prepare-migrations.js
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  '009_play_instances_tier12_fields.sql',
  '010_play_instances_ol_tracking.sql',
  '011_play_instances_defensive_tracking.sql',
  '012_play_instances_situational_data.sql'
];

function prepareMigrations() {
  console.log('\n🔧 Preparing migrations for Supabase Dashboard...\n');

  const outputPath = path.join(__dirname, '..', 'APPLY_THESE_MIGRATIONS.sql');
  let combinedSQL = `-- ============================================================================
-- THE COACH HUB - DATABASE MIGRATIONS
-- ============================================================================
-- INSTRUCTIONS:
--   1. Copy ALL of this SQL
--   2. Open: https://supabase.com/dashboard/project/gvzdsuodulrdbitxfvjw/sql/new
--   3. Paste and click "Run"
--   4. Wait for completion (may take 30-60 seconds)
--   5. Refresh your app
-- ============================================================================

`;

  MIGRATIONS.forEach((migrationFile, index) => {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.log(`❌ Missing: ${migrationFile}`);
      return;
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    combinedSQL += `\n\n-- ============================================================================
-- MIGRATION ${index + 1}/4: ${migrationFile}
-- ============================================================================\n\n`;

    combinedSQL += sql;

    console.log(`✅ Added: ${migrationFile}`);
  });

  combinedSQL += `\n\n-- ============================================================================
-- ✅ MIGRATIONS COMPLETE!
-- ============================================================================
-- If you see no errors above, the migrations were applied successfully.
-- Refresh your The Coach Hub app to see player stats working.
-- ============================================================================\n`;

  fs.writeFileSync(outputPath, combinedSQL, 'utf-8');

  console.log(`\n✅ Created: APPLY_THESE_MIGRATIONS.sql\n`);
  console.log('📋 NEXT STEPS:\n');
  console.log('   1. Open the file: APPLY_THESE_MIGRATIONS.sql');
  console.log('   2. Copy ALL the SQL (Cmd+A, Cmd+C)');
  console.log('   3. Go to: https://supabase.com/dashboard/project/gvzdsuodulrdbitxfvjw/sql/new');
  console.log('   4. Paste the SQL and click "Run"');
  console.log('   5. Wait for completion');
  console.log('   6. Refresh your app\n');
  console.log('⚡ This will fix all the timeout and missing column issues!\n');
}

prepareMigrations();
