/**
 * Cleanup Orphaned Storage Files
 *
 * This script finds and deletes storage files in the game-film bucket
 * that don't have matching records in the videos database table.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-orphaned-storage.ts          # Dry run (preview)
 *   npx ts-node scripts/cleanup-orphaned-storage.ts --delete # Actually delete
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file (get it from Supabase dashboard → Settings → API)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const shouldDelete = process.argv.includes('--delete');

  console.log('='.repeat(60));
  console.log('Orphaned Storage Cleanup Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${shouldDelete ? '🗑️  DELETE' : '👀 DRY RUN (preview only)'}`);
  console.log('');

  // Get all file paths from the videos table
  console.log('Fetching video records from database...');
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('file_path')
    .not('file_path', 'is', null);

  if (videosError) {
    console.error('Failed to fetch videos:', videosError.message);
    process.exit(1);
  }

  const validFilePaths = new Set(videos?.map(v => v.file_path) || []);
  console.log(`Found ${validFilePaths.size} valid video file paths in database`);

  // List all files in the game-film bucket
  console.log('Listing files in game-film storage bucket...');
  const { data: folders, error: listError } = await supabase.storage
    .from('game-film')
    .list('', { limit: 1000 });

  if (listError) {
    console.error('Failed to list storage:', listError.message);
    process.exit(1);
  }

  const orphanedFiles: { path: string; size: number }[] = [];

  // For each folder (usually game IDs), list files inside
  for (const folder of folders || []) {
    if (folder.id === null) {
      // This is a folder, list its contents
      const { data: files, error: filesError } = await supabase.storage
        .from('game-film')
        .list(folder.name, { limit: 1000 });

      if (filesError) {
        console.error(`Error listing folder ${folder.name}:`, filesError.message);
        continue;
      }

      for (const file of files || []) {
        if (file.id !== null) {
          const filePath = `${folder.name}/${file.name}`;
          if (!validFilePaths.has(filePath)) {
            orphanedFiles.push({
              path: filePath,
              size: file.metadata?.size || 0,
            });
          }
        }
      }
    } else {
      // This is a file at root level
      if (!validFilePaths.has(folder.name)) {
        orphanedFiles.push({
          path: folder.name,
          size: folder.metadata?.size || 0,
        });
      }
    }
  }

  const totalBytes = orphanedFiles.reduce((sum, f) => sum + f.size, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  console.log('');
  console.log('='.repeat(60));
  console.log(`Found ${orphanedFiles.length} orphaned files (${totalMB} MB)`);
  console.log('='.repeat(60));

  if (orphanedFiles.length === 0) {
    console.log('✅ No orphaned files found. Storage is clean!');
    return;
  }

  console.log('');
  console.log('Orphaned files:');
  for (const file of orphanedFiles) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`  - ${file.path} (${sizeMB} MB)`);
  }

  if (!shouldDelete) {
    console.log('');
    console.log('='.repeat(60));
    console.log('This was a DRY RUN. No files were deleted.');
    console.log('To actually delete these files, run:');
    console.log('  npx ts-node scripts/cleanup-orphaned-storage.ts --delete');
    console.log('='.repeat(60));
    return;
  }

  // Actually delete the files
  console.log('');
  console.log('Deleting orphaned files...');

  let successCount = 0;
  let failCount = 0;

  for (const file of orphanedFiles) {
    const { error: deleteError } = await supabase.storage
      .from('game-film')
      .remove([file.path]);

    if (deleteError) {
      console.error(`  ❌ Failed to delete ${file.path}: ${deleteError.message}`);
      failCount++;
    } else {
      console.log(`  ✅ Deleted ${file.path}`);
      successCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Cleanup complete!`);
  console.log(`  ✅ Deleted: ${successCount} files`);
  console.log(`  ❌ Failed: ${failCount} files`);
  console.log(`  💾 Space freed: ~${totalMB} MB`);
  console.log('='.repeat(60));
}

main().catch(console.error);
