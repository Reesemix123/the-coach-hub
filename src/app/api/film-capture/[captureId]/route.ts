import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ captureId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { captureId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    // Fetch the capture to verify existence and get storage path
    const { data: capture } = await serviceClient
      .from('film_captures')
      .select('id, uploader_id, storage_path')
      .eq('id', captureId)
      .single();

    if (!capture) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Check ownership or platform admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.is_platform_admin === true;

    if (capture.uploader_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from storage — log failure but continue to remove the DB record
    const { error: storageError } = await serviceClient.storage
      .from('film_captures')
      .remove([capture.storage_path]);

    if (storageError) {
      console.error('[film-capture] Storage delete failed:', storageError);
    }

    // Delete the database record
    const { error: dbError } = await serviceClient
      .from('film_captures')
      .delete()
      .eq('id', captureId);

    if (dbError) {
      console.error('[film-capture] DB delete failed:', dbError);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[film-capture/delete] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
