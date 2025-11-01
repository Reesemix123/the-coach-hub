#!/usr/bin/env tsx
/**
 * Clear Supabase Storage
 *
 * This script deletes all files from Supabase Storage buckets.
 * Run this AFTER clearing the database to remove orphaned video files.
 *
 * Usage:
 *   npx tsx scripts/clear-storage.ts
 *
 * Or make it executable:
 *   chmod +x scripts/clear-storage.ts
 *   ./scripts/clear-storage.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// List of storage buckets to clear
const BUCKETS_TO_CLEAR = [
  'videos',
  'game-videos',
  'playbook-images',
  'playbook-pdfs',
  // Add any other buckets you have
];

async function clearBucket(bucketName: string) {
  console.log(`\n📦 Processing bucket: ${bucketName}`);

  // List all files in the bucket
  const { data: files, error: listError } = await supabase
    .storage
    .from(bucketName)
    .list('', {
      limit: 1000, // Adjust if you have more files
      sortBy: { column: 'name', order: 'asc' }
    });

  if (listError) {
    console.error(`   ⚠️  Error listing files: ${listError.message}`);
    return;
  }

  if (!files || files.length === 0) {
    console.log(`   ✅ Bucket is already empty`);
    return;
  }

  console.log(`   📄 Found ${files.length} file(s)`);

  // Delete all files
  const filePaths = files.map(file => file.name);
  const { error: deleteError } = await supabase
    .storage
    .from(bucketName)
    .remove(filePaths);

  if (deleteError) {
    console.error(`   ❌ Error deleting files: ${deleteError.message}`);
    return;
  }

  console.log(`   ✅ Deleted ${files.length} file(s)`);
}

async function clearAllStorage() {
  console.log('🗑️  Clearing Supabase Storage...\n');
  console.log('⚠️  WARNING: This will delete ALL files from storage buckets!');
  console.log('Press Ctrl+C now to cancel, or wait 3 seconds to continue...\n');

  // Give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));

  for (const bucket of BUCKETS_TO_CLEAR) {
    await clearBucket(bucket);
  }

  console.log('\n✅ Storage clearing complete!\n');
}

// Run the script
clearAllStorage().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
