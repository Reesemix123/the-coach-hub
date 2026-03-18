/**
 * API: /api/communication/game-summaries/[id]/publish
 * POST - Publish a game summary and notify all active parents on the team.
 *
 * Requires published_text to be set before calling. Notification delivery
 * is best-effort — a notification failure does not roll back the publish.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  publishGameSummary,
  getGameSummary,
} from '@/lib/services/communication/report.service';
import {
  sendBulkNotification,
  getCommHubEmailTemplate,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';
import type { NotificationChannel, PlayerHighlight } from '@/types/communication';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ParentProfileRow {
  id: string;
  email: string;
  phone: string | null;
  notification_preference: NotificationChannel;
}

interface ParentAccessRow {
  parent_id: string;
  parent_profiles: ParentProfileRow;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;

    const existing = await getGameSummary(id);
    if (!existing) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });

    if (!existing.published_text) {
      return NextResponse.json(
        { error: 'Summary must have published text before publishing' },
        { status: 400 }
      );
    }

    const summary = await publishGameSummary(id);

    // Get team name for notification copy
    const { data: team } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', summary.team_id)
      .single();

    const teamName = team?.name || 'Your team';

    // Notify all active parents on the team
    const { data: parentAccess } = await supabase
      .from('team_parent_access')
      .select('parent_id, parent_profiles!inner(id, email, phone, notification_preference)')
      .eq('team_id', summary.team_id)
      .eq('status', 'active');

    if (parentAccess && parentAccess.length > 0) {
      const recipients: BulkRecipient[] = (parentAccess as unknown as ParentAccessRow[]).map(r => ({
        id: r.parent_profiles.id,
        type: 'parent' as const,
        email: r.parent_profiles.email,
        phone: r.parent_profiles.phone ?? undefined,
        notificationPreference: r.parent_profiles.notification_preference,
      }));

      const scoreText = summary.score_us !== null && summary.score_them !== null
        ? ` (${summary.score_us}-${summary.score_them})`
        : '';

      // Build optional player highlights block for email
      let highlightsHtml = '';
      const highlights = summary.player_highlights as PlayerHighlight[] | null;
      if (highlights && highlights.length > 0) {
        highlightsHtml = '<div style="margin-top: 16px;"><strong>Player Highlights:</strong><ul>';
        highlights.forEach(h => {
          highlightsHtml += `<li>${h.highlight_text}</li>`;
        });
        highlightsHtml += '</ul></div>';
      }

      const emailBody = getCommHubEmailTemplate({
        title: `Game Recap: vs ${summary.opponent || 'Opponent'}${scoreText}`,
        body: `<p style="white-space: pre-wrap;">${summary.published_text}</p>${highlightsHtml}`,
        teamName,
        ctaText: 'View Full Recap',
      });

      const smsBody = formatSmsBody(
        teamName,
        `Game recap posted: vs ${summary.opponent || 'Opponent'}${scoreText}. Open the app to read.`
      );

      await sendBulkNotification({
        teamId: summary.team_id,
        recipients,
        notificationType: 'report_shared',
        subject: `${teamName}: Game Recap vs ${summary.opponent || 'Opponent'}`,
        body: emailBody,
        smsBody,
        channel: summary.notification_channel as NotificationChannel,
      });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error publishing game summary:', error);
    return NextResponse.json({ error: 'Failed to publish summary' }, { status: 500 });
  }
}
