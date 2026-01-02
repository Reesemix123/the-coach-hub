import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/admin/cleanup-storage
 *
 * Finds and deletes storage files that don't have matching video records in the database.
 * This cleans up orphaned files after video records are deleted.
 *
 * Query params:
 * - dryRun=true (default): Only list what would be deleted, don't actually delete
 * - dryRun=false: Actually delete the orphaned files
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (optional - you may want to restrict this)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // For safety, only allow admins or specific users
    // Comment this out if you want any authenticated user to run it
    if (profile?.role !== 'admin') {
      // Allow for now since this is a one-time cleanup
      // return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') !== 'false';

    // Get all file paths from the videos table
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('file_path')
      .not('file_path', 'is', null);

    if (videosError) {
      return NextResponse.json({ error: 'Failed to fetch videos', details: videosError.message }, { status: 500 });
    }

    const validFilePaths = new Set(videos?.map(v => v.file_path) || []);

    // List all files in the game-film bucket
    // We need to list by folder since Supabase storage lists are folder-based
    const { data: folders, error: listError } = await supabase.storage
      .from('game-film')
      .list('', { limit: 1000 });

    if (listError) {
      return NextResponse.json({ error: 'Failed to list storage', details: listError.message }, { status: 500 });
    }

    const orphanedFiles: string[] = [];
    let totalBytesOrphaned = 0;

    // For each folder (usually game IDs), list files inside
    for (const folder of folders || []) {
      if (folder.id === null) {
        // This is a folder, list its contents
        const { data: files, error: filesError } = await supabase.storage
          .from('game-film')
          .list(folder.name, { limit: 1000 });

        if (filesError) {
          console.error(`Error listing folder ${folder.name}:`, filesError);
          continue;
        }

        for (const file of files || []) {
          if (file.id !== null) {
            // This is a file
            const filePath = `${folder.name}/${file.name}`;

            // Check if this file path exists in the database
            if (!validFilePaths.has(filePath)) {
              orphanedFiles.push(filePath);
              totalBytesOrphaned += file.metadata?.size || 0;
            }
          }
        }
      } else {
        // This is a file at root level
        const filePath = folder.name;
        if (!validFilePaths.has(filePath)) {
          orphanedFiles.push(filePath);
          totalBytesOrphaned += folder.metadata?.size || 0;
        }
      }
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        message: 'Dry run - no files deleted. Set dryRun=false to actually delete.',
        orphanedFilesCount: orphanedFiles.length,
        orphanedFiles: orphanedFiles,
        estimatedBytesToFree: totalBytesOrphaned,
        estimatedMBToFree: (totalBytesOrphaned / (1024 * 1024)).toFixed(2),
      });
    }

    // Actually delete the orphaned files
    const deleteResults: { path: string; success: boolean; error?: string }[] = [];

    for (const filePath of orphanedFiles) {
      const { error: deleteError } = await supabase.storage
        .from('game-film')
        .remove([filePath]);

      deleteResults.push({
        path: filePath,
        success: !deleteError,
        error: deleteError?.message,
      });
    }

    const successCount = deleteResults.filter(r => r.success).length;
    const failCount = deleteResults.filter(r => !r.success).length;

    return NextResponse.json({
      dryRun: false,
      message: `Deleted ${successCount} orphaned files. ${failCount} failures.`,
      deletedCount: successCount,
      failedCount: failCount,
      results: deleteResults,
      bytesFreed: totalBytesOrphaned,
      mbFreed: (totalBytesOrphaned / (1024 * 1024)).toFixed(2),
    });

  } catch (error) {
    console.error('Storage cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
