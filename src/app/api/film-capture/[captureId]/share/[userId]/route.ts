import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ captureId: string; userId: string }>;
}

/**
 * DELETE /api/film-capture/[captureId]/share/[userId]
 * Revokes a specific user's access to a capture.
 * Only the capture owner or a platform admin can call this.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { captureId, userId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    // Verify ownership or admin
    const { data: capture } = await serviceClient
      .from('film_captures')
      .select('uploader_id')
      .eq('id', captureId)
      .single();

    if (!capture) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.is_platform_admin === true;

    if (capture.uploader_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await serviceClient
      .from('film_capture_shares')
      .delete()
      .eq('capture_id', captureId)
      .eq('shared_with_user_id', userId);

    if (deleteError) {
      console.error('[film-capture/share/userId] Delete failed:', deleteError);
      return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[film-capture/share/userId] DELETE error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
