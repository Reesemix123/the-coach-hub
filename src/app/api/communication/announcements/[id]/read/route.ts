/**
 * API: /api/communication/announcements/[id]/read
 * POST - Mark announcement as read (parents only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get announcement ID from route params
    const params = await context.params;
    const announcementId = params.id;

    if (!announcementId) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 });
    }

    // Get parent profile for current user
    const { data: parentProfile, error: parentError } = await supabase
      .from('parent_profiles')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single();

    if (parentError || !parentProfile) {
      return NextResponse.json(
        { error: 'Only parents can mark announcements as read' },
        { status: 403 }
      );
    }

    // Verify announcement exists
    const { data: announcement, error: announcementError } = await supabase
      .from('announcements')
      .select('id, team_id')
      .eq('id', announcementId)
      .single();

    if (announcementError || !announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Verify parent has access to this team (use service client to avoid RLS recursion)
    const serviceClient = createServiceClient();
    const { data: parentAccess } = await serviceClient
      .from('team_parent_access')
      .select('id')
      .eq('team_id', announcement.team_id)
      .eq('parent_id', parentProfile.id)
      .eq('status', 'active')
      .single();

    if (!parentAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this announcement' },
        { status: 403 }
      );
    }

    // Upsert into announcement_reads
    const { error: upsertError } = await supabase
      .from('announcement_reads')
      .upsert(
        {
          announcement_id: announcementId,
          parent_id: parentProfile.id,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: 'announcement_id,parent_id',
        }
      );

    if (upsertError) {
      console.error('Failed to mark announcement as read:', upsertError);
      return NextResponse.json(
        { error: 'Failed to mark announcement as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark announcement as read' },
      { status: 500 }
    );
  }
}
