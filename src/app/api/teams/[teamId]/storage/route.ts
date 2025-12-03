import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Team Storage Usage API
 * Returns storage usage, quota, and upload statistics
 */

/**
 * GET /api/teams/[teamId]/storage
 * Get storage usage for a team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team access
    const { data: teamAccess } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { data: teamOwner } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (!teamAccess && teamOwner?.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get storage usage
    const { data: usage, error: usageError } = await supabase.rpc('get_team_storage_usage', {
      p_team_id: teamId,
    });

    if (usageError) {
      console.error('Get storage usage error:', usageError);
      return NextResponse.json(
        { error: 'Failed to get storage usage' },
        { status: 500 }
      );
    }

    // Format for frontend
    return NextResponse.json({
      ...usage,
      // Add human-readable sizes
      total_bytes_used_formatted: formatBytes(usage.total_bytes_used),
      quota_bytes_formatted: formatBytes(usage.quota_bytes),
      bytes_remaining_formatted: formatBytes(usage.bytes_remaining),
      max_file_size_formatted: formatBytes(usage.max_file_size_bytes),
    });
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams/[teamId]/storage/recalculate
 * Recalculate storage from upload logs (admin/repair function)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can recalculate
    const { data: teamOwner } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (teamOwner?.user_id !== user.id) {
      // Check if platform admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_platform_admin) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Recalculate storage
    const { data: result, error } = await supabase.rpc('recalculate_team_storage', {
      p_team_id: teamId,
    });

    if (error) {
      console.error('Recalculate storage error:', error);
      return NextResponse.json(
        { error: 'Failed to recalculate storage' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Recalculate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
