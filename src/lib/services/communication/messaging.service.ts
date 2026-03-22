/**
 * Messaging Service
 * Direct messaging between coaches and parents.
 * Parent-to-parent messaging is supported when enabled in team settings.
 */

import { createServiceClient } from '@/utils/supabase/server';
import type { DirectMessage, MessageSenderType } from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

export interface SendMessageInput {
  teamId: string;
  senderType: MessageSenderType;
  senderId: string;
  recipientType: 'coach' | 'parent';
  recipientId: string;
  body: string;
}

export interface ConversationSummary {
  participantId: string;
  participantName: string;
  participantType: 'coach' | 'parent';
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Sends a direct message between two participants on a team.
 * When a parent messages another parent, checks whether the team allows it.
 *
 * @param input - Message data including sender/recipient identifiers and body
 * @returns The created DirectMessage record
 */
export async function sendMessage(input: SendMessageInput): Promise<DirectMessage> {
  // Use service client for insert — RLS is enforced by the API route's auth checks
  const supabase = createServiceClient();

  // Business rule: parent-to-parent messaging requires team setting to be enabled
  if (input.senderType === 'parent' && input.recipientType === 'parent') {
    const { data: settings } = await supabase
      .from('team_communication_settings')
      .select('allow_parent_to_parent_messaging')
      .eq('team_id', input.teamId)
      .maybeSingle();

    // Default to true if no settings row exists
    const allowed = settings?.allow_parent_to_parent_messaging ?? true;
    if (!allowed) {
      throw new Error('Parent-to-parent messaging is disabled for this team');
    }
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      team_id: input.teamId,
      sender_type: input.senderType,
      sender_id: input.senderId,
      recipient_type: input.recipientType,
      recipient_id: input.recipientId,
      body: input.body.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to send message: ${error.message}`);
  return data;
}

/**
 * Retrieves all messages in a conversation between two participants on a team.
 * Ordered chronologically (oldest first) for thread display.
 *
 * @param teamId - Team scoping for the conversation
 * @param userId - The current user's ID (parent_profile.id or auth user.id for coaches)
 * @param otherUserId - The conversation partner's ID
 * @param limit - Max messages to return (default 50)
 */
export async function getConversation(
  teamId: string,
  userId: string,
  otherUserId: string,
  limit: number = 50
): Promise<DirectMessage[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('team_id', teamId)
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch conversation: ${error.message}`);
  return data || [];
}

/**
 * Marks all unread messages from a specific sender as read.
 * Called when the recipient opens the conversation thread.
 *
 * @param recipientId - The user who is reading (their messages get marked read)
 * @param senderId - The sender whose messages are being marked read
 * @param teamId - Team scope
 */
export async function markMessagesAsRead(
  recipientId: string,
  senderId: string,
  teamId: string
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('sender_id', senderId)
    .eq('recipient_id', recipientId)
    .is('read_at', null);

  if (error) console.error('[MessagingService] Failed to mark messages as read:', error);
}

/**
 * Returns a list of unique conversation summaries for a coach's inbox.
 * Groups messages by conversation partner and resolves parent display names.
 *
 * @param teamId - Team scope
 * @param coachId - The coach's auth user ID
 */
export async function getCoachInbox(
  teamId: string,
  coachId: string
): Promise<ConversationSummary[]> {
  const supabase = createServiceClient();

  // Fetch all messages where coach is a participant, newest first for grouping
  const { data: messages, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('team_id', teamId)
    .or(`sender_id.eq.${coachId},recipient_id.eq.${coachId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch inbox: ${error.message}`);

  // Group messages by conversation partner, tracking last message and unread count
  const conversations = new Map<string, {
    participantId: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
  }>();

  (messages || []).forEach(msg => {
    const partnerId = msg.sender_id === coachId ? msg.recipient_id : msg.sender_id;

    if (!conversations.has(partnerId)) {
      // First occurrence is the most recent (messages ordered desc)
      conversations.set(partnerId, {
        participantId: partnerId,
        lastMessage: msg.body,
        lastMessageAt: msg.created_at,
        unreadCount: 0,
      });
    }

    // Count messages sent TO the coach that haven't been read
    if (msg.recipient_id === coachId && !msg.read_at) {
      const conv = conversations.get(partnerId)!;
      conv.unreadCount++;
    }
  });

  if (conversations.size === 0) return [];

  // Resolve parent display names from parent_profiles
  const parentIds = Array.from(conversations.keys());
  const { data: parents } = await supabase
    .from('parent_profiles')
    .select('id, first_name, last_name')
    .in('id', parentIds);

  const parentNameMap = new Map(
    (parents || []).map(p => [p.id, `${p.first_name} ${p.last_name}`])
  );

  return Array.from(conversations.values())
    .map(conv => ({
      ...conv,
      participantName: parentNameMap.get(conv.participantId) || 'Unknown Parent',
      participantType: 'parent' as const,
    }))
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
}

/**
 * Returns a list of unique conversation summaries for a parent's inbox.
 * A parent can have conversations with the coach AND other parents (when enabled).
 * Groups messages by conversation partner and resolves display names for both types.
 *
 * @param teamId - Team scope
 * @param parentId - The parent's parent_profiles.id
 */
export async function getParentInbox(
  teamId: string,
  parentId: string
): Promise<ConversationSummary[]> {
  const supabase = createServiceClient();

  // Fetch all messages where this parent is a participant, newest first for grouping
  const { data: messages, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('team_id', teamId)
    .or(`sender_id.eq.${parentId},recipient_id.eq.${parentId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch inbox: ${error.message}`);

  // Group messages by conversation partner, tracking last message and unread count.
  // Each entry records the partner's ID and their sender_type so we can resolve the
  // correct name table later.
  const conversations = new Map<string, {
    participantId: string;
    participantType: 'coach' | 'parent';
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
  }>();

  (messages || []).forEach(msg => {
    const partnerId = msg.sender_id === parentId ? msg.recipient_id : msg.sender_id;
    // Determine partner type from the message columns
    const partnerType: 'coach' | 'parent' =
      msg.sender_id === parentId
        ? (msg.recipient_type === 'parent' ? 'parent' : 'coach')
        : (msg.sender_type === 'parent' ? 'parent' : 'coach');

    if (!conversations.has(partnerId)) {
      // First occurrence is the most recent (messages ordered desc)
      conversations.set(partnerId, {
        participantId: partnerId,
        participantType: partnerType,
        lastMessage: msg.body,
        lastMessageAt: msg.created_at,
        unreadCount: 0,
      });
    }

    // Count messages sent TO this parent that haven't been read
    if (msg.recipient_id === parentId && !msg.read_at) {
      const conv = conversations.get(partnerId)!;
      conv.unreadCount++;
    }
  });

  if (conversations.size === 0) return [];

  // Partition partner IDs by type so we can batch-resolve names from the right table
  const partnerIds = Array.from(conversations.values());
  const coachPartnerIds = partnerIds
    .filter(c => c.participantType === 'coach')
    .map(c => c.participantId);
  const parentPartnerIds = partnerIds
    .filter(c => c.participantType === 'parent')
    .map(c => c.participantId);

  // Build a unified name map keyed by participant ID
  const nameMap = new Map<string, string>();

  if (coachPartnerIds.length > 0) {
    const { data: coachProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', coachPartnerIds);

    (coachProfiles || []).forEach(p => {
      const name =
        p.first_name && p.last_name
          ? `${p.first_name} ${p.last_name}`
          : (p.email ?? 'Unknown Coach');
      nameMap.set(p.id, name);
    });
  }

  if (parentPartnerIds.length > 0) {
    const { data: parentProfiles } = await supabase
      .from('parent_profiles')
      .select('id, first_name, last_name')
      .in('id', parentPartnerIds);

    (parentProfiles || []).forEach(p => {
      nameMap.set(p.id, `${p.first_name} ${p.last_name}`);
    });
  }

  return Array.from(conversations.values())
    .map(conv => ({
      participantId: conv.participantId,
      participantType: conv.participantType,
      participantName:
        nameMap.get(conv.participantId) ??
        (conv.participantType === 'coach' ? 'Unknown Coach' : 'Unknown Parent'),
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      unreadCount: conv.unreadCount,
    }))
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
}

/**
 * Returns the count of unread messages for a user on a team.
 * Used for badge indicators in navigation.
 *
 * @param teamId - Team scope
 * @param userId - The user whose unread count to check
 */
export async function getUnreadCount(
  teamId: string,
  userId: string
): Promise<number> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) return 0;
  return count || 0;
}
