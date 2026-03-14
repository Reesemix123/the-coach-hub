/**
 * API: /api/communication/messages
 *
 * POST - Send a direct message
 * GET  - Fetch a conversation thread or coach inbox
 *
 * Access rules:
 * - Parents can only send messages to coaches (enforced in service layer too)
 * - Coaches can message any parent on their team
 * - Both parties can only read conversations they are part of (enforced by RLS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  sendMessage,
  getConversation,
  getCoachInbox,
  markMessagesAsRead,
} from '@/lib/services/communication/messaging.service';
import { sendEmail } from '@/lib/email';
import { getCommHubEmailTemplate } from '@/lib/services/communication/notification.service';
import type { MessageSenderType } from '@/types/communication';

// ============================================================================
// POST /api/communication/messages
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, recipientId, message: messageBody } = body;

    if (!teamId || !recipientId || !messageBody?.trim()) {
      return NextResponse.json(
        { error: 'teamId, recipientId, and message are required' },
        { status: 400 }
      );
    }

    // Determine whether the sender is a parent or a coach/owner
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isParent = !!parentProfile;

    let senderType: MessageSenderType;
    let senderId: string;
    let recipientType: 'coach' | 'parent';

    if (isParent) {
      // Verify parent has access to this team
      const { data: parentAccess } = await supabase
        .from('team_parent_access')
        .select('id')
        .eq('team_id', teamId)
        .eq('parent_id', parentProfile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!parentAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      senderType = 'parent';
      senderId = parentProfile.id;
      recipientType = 'coach';
    } else {
      // Verify coach/owner has access to this team
      const { data: team } = await supabase
        .from('teams')
        .select('user_id, name')
        .eq('id', teamId)
        .single();

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const isOwner = team.user_id === user.id;
      if (!isOwner && !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      senderType = isOwner ? 'owner' : (membership?.role as MessageSenderType) ?? 'coach';
      senderId = user.id;
      recipientType = 'parent';
    }

    const msg = await sendMessage({
      teamId,
      senderType,
      senderId,
      recipientType,
      recipientId,
      body: messageBody.trim(),
    });

    // Send a non-blocking email notification to the recipient
    void notifyRecipient({
      teamId,
      recipientId,
      recipientType,
      supabase,
    });

    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/communication/messages] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send message',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/communication/messages
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const participantId = searchParams.get('participantId');
    const view = searchParams.get('view'); // 'inbox' returns conversation list for coaches

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Determine if the caller is a parent
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isParent = !!parentProfile;

    // --- Coach: inbox view (list of all conversations) ---
    if (view === 'inbox' && !isParent) {
      const conversations = await getCoachInbox(teamId, user.id);
      return NextResponse.json({ conversations });
    }

    // --- Coach or parent: specific conversation thread ---
    if (participantId) {
      const myId = isParent ? parentProfile!.id : user.id;
      const messages = await getConversation(teamId, myId, participantId);

      // Mark incoming messages as read now that the conversation is open
      await markMessagesAsRead(myId, participantId, teamId);

      return NextResponse.json({ messages });
    }

    // --- Parent: default view — conversation with team owner/coach ---
    if (isParent) {
      const { data: team } = await supabase
        .from('teams')
        .select('user_id')
        .eq('id', teamId)
        .single();

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      const messages = await getConversation(
        teamId,
        parentProfile!.id,
        team.user_id
      );
      await markMessagesAsRead(parentProfile!.id, team.user_id, teamId);

      return NextResponse.json({ messages, coachId: team.user_id });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[GET /api/communication/messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Sends an email notification to a message recipient.
 * Intentionally non-blocking — failures are logged but never surface to the caller.
 */
async function notifyRecipient(params: {
  teamId: string;
  recipientId: string;
  recipientType: 'coach' | 'parent';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}): Promise<void> {
  const { teamId, recipientId, recipientType, supabase } = params;

  try {
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();
    const teamName: string = team?.name ?? 'Your team';

    let recipientEmail: string | null = null;

    if (recipientType === 'parent') {
      const { data: parent } = await supabase
        .from('parent_profiles')
        .select('email')
        .eq('id', recipientId)
        .single();
      recipientEmail = parent?.email ?? null;
    } else {
      // Coach — look up email via the profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', recipientId)
        .single();
      recipientEmail = profile?.email ?? null;
    }

    if (!recipientEmail) return;

    const html = getCommHubEmailTemplate({
      title: 'New Message',
      body: `<p>You have a new direct message from your ${recipientType === 'parent' ? 'coaching staff' : 'parent'}. Open the app to read and reply.</p>`,
      teamName,
      ctaText: 'View Message',
    });

    await sendEmail({
      to: recipientEmail,
      subject: `${teamName}: New Message`,
      html,
    });
  } catch (err) {
    console.error('[notifyRecipient] Email notification failed (non-critical):', err);
  }
}
