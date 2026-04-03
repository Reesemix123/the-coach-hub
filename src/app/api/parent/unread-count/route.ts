/**
 * API: GET /api/parent/unread-count?teamId={teamId}
 * Lightweight endpoint returning combined unread message + announcement count.
 * Designed for badge polling — returns counts only, no payload data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const teamId = request.nextUrl.searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ total: 0 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ total: 0 });

    const serviceClient = createServiceClient();

    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ total: 0 });

    // Count unread conversations: distinct senders with unread messages to this parent
    const { data: unreadMsgs } = await serviceClient
      .from('direct_messages')
      .select('sender_id')
      .eq('team_id', teamId)
      .eq('recipient_id', parent.id)
      .is('read_at', null);

    const unreadConversations = new Set((unreadMsgs ?? []).map(m => m.sender_id)).size;

    // Count unread announcements: announcements without a read record for this parent
    // Skip position-group filtering — approximate count is acceptable for badge
    const { data: announcements } = await serviceClient
      .from('announcements')
      .select('id')
      .eq('team_id', teamId)
      .eq('status', 'published');

    let unreadAnnouncements = 0;
    if (announcements && announcements.length > 0) {
      const announcementIds = announcements.map(a => a.id);
      const { data: readRecords } = await serviceClient
        .from('announcement_reads')
        .select('announcement_id')
        .eq('parent_id', parent.id)
        .in('announcement_id', announcementIds);

      const readSet = new Set((readRecords ?? []).map(r => r.announcement_id));
      unreadAnnouncements = announcements.filter(a => !readSet.has(a.id)).length;
    }

    const total = unreadConversations + unreadAnnouncements;

    return NextResponse.json({
      unreadConversations,
      unreadAnnouncements,
      total,
    });
  } catch (error) {
    console.error('[unread-count] Error:', error);
    return NextResponse.json({ total: 0 });
  }
}
