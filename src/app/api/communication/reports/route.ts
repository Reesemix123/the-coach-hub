/**
 * API: /api/communication/reports
 * POST - Create and share a report
 * GET  - List reports (coach or parent view)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  createReport,
  getTeamReports,
  getReportsForParent,
  buildPlayerSummaryData,
  buildGameRecapData,
} from '@/lib/services/communication/report.service';
import {
  sendBulkNotification,
  getCommHubEmailTemplate,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';
import type { ReportType, NotificationChannel, ReportVisibility } from '@/types/communication';

const REPORT_TYPE_LABELS: Record<string, string> = {
  player_summary: 'Player Summary',
  game_recap: 'Game Recap',
  season_progress: 'Season Progress',
  individual: 'Player Report',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { teamId, reportType, playerId, gameId, coachNotes, notificationChannel, visibility, targetParentId } = body;

    if (!teamId || !reportType || !notificationChannel) {
      return NextResponse.json(
        { error: 'teamId, reportType, and notificationChannel are required' },
        { status: 400 }
      );
    }

    // Verify coach access
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', teamId)
      .single();

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    if (!isOwner && !['owner', 'coach'].includes(membership?.role || '')) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Build report data based on type
    let reportData: Record<string, unknown> = {};

    if (reportType === 'player_summary' && playerId) {
      reportData = await buildPlayerSummaryData(teamId, playerId) as unknown as Record<string, unknown>;
    } else if (reportType === 'game_recap' && gameId) {
      reportData = await buildGameRecapData(teamId, gameId);
    } else if (reportType === 'season_progress' && playerId) {
      reportData = await buildPlayerSummaryData(teamId, playerId) as unknown as Record<string, unknown>;
      reportData.reportSubType = 'season_progress';
    } else if (reportType === 'individual' && playerId) {
      reportData = await buildPlayerSummaryData(teamId, playerId) as unknown as Record<string, unknown>;
      reportData.reportSubType = 'individual';
    } else {
      reportData = body.reportData || {};
    }

    if (coachNotes) {
      reportData.coachNotes = coachNotes;
    }

    const report = await createReport({
      teamId,
      coachId: user.id,
      reportType: reportType as ReportType,
      playerId,
      gameId,
      coachNotes,
      reportData,
      visibility: (visibility || 'parents') as ReportVisibility,
      targetParentId,
      notificationChannel: notificationChannel as NotificationChannel,
    });

    // Send notifications to relevant parents
    const { data: parentAccess } = await supabase
      .from('team_parent_access')
      .select('parent_id, parent_profiles!inner(id, email, phone, notification_preference)')
      .eq('team_id', teamId)
      .eq('status', 'active');

    let recipients: BulkRecipient[] = [];

    if (visibility === 'specific_parent' && targetParentId) {
      recipients = (parentAccess || [])
        .filter((r: unknown) => {
          const row = r as { parent_profiles: { id: string } };
          return row.parent_profiles.id === targetParentId;
        })
        .map((r: unknown) => {
          const row = r as { parent_profiles: { id: string; email: string; phone: string | null; notification_preference: NotificationChannel } };
          return {
            id: row.parent_profiles.id,
            type: 'parent' as const,
            email: row.parent_profiles.email,
            phone: row.parent_profiles.phone ?? undefined,
            notificationPreference: row.parent_profiles.notification_preference,
          };
        });
    } else if (playerId) {
      // For player-specific reports, notify only that player's parents
      const { data: playerParents } = await supabase
        .from('player_parent_links')
        .select('parent_id')
        .eq('player_id', playerId);

      const parentIds = new Set((playerParents || []).map(p => p.parent_id));
      recipients = (parentAccess || [])
        .filter((r: unknown) => {
          const row = r as { parent_profiles: { id: string } };
          return parentIds.has(row.parent_profiles.id);
        })
        .map((r: unknown) => {
          const row = r as { parent_profiles: { id: string; email: string; phone: string | null; notification_preference: NotificationChannel } };
          return {
            id: row.parent_profiles.id,
            type: 'parent' as const,
            email: row.parent_profiles.email,
            phone: row.parent_profiles.phone ?? undefined,
            notificationPreference: row.parent_profiles.notification_preference,
          };
        });
    } else {
      recipients = (parentAccess || []).map((r: unknown) => {
        const row = r as { parent_profiles: { id: string; email: string; phone: string | null; notification_preference: NotificationChannel } };
        return {
          id: row.parent_profiles.id,
          type: 'parent' as const,
          email: row.parent_profiles.email,
          phone: row.parent_profiles.phone ?? undefined,
          notificationPreference: row.parent_profiles.notification_preference,
        };
      });
    }

    if (recipients.length > 0) {
      const label = REPORT_TYPE_LABELS[reportType] || 'Report';

      const emailBody = getCommHubEmailTemplate({
        title: `New ${label} Available`,
        body: `<p>A new report has been shared with you. Open the app to view it.</p>${coachNotes ? `<p style="margin-top: 16px;"><strong>Coach's Note:</strong> ${coachNotes}</p>` : ''}`,
        teamName: team.name,
        ctaText: 'View Report',
      });

      const smsBody = formatSmsBody(team.name, `New ${label} available. Open the app to view.`);

      await sendBulkNotification({
        teamId,
        recipients,
        notificationType: 'report_shared',
        subject: `${team.name}: New ${label}`,
        body: emailBody,
        smsBody,
        channel: notificationChannel as NotificationChannel,
      });
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const reportType = searchParams.get('reportType') as ReportType | null;
    const playerId = searchParams.get('playerId');

    if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 });

    // If caller is a parent, return their filtered view
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (parentProfile) {
      const reports = await getReportsForParent(teamId, parentProfile.id);
      return NextResponse.json({ reports });
    }

    // Coach view — full list
    const reports = await getTeamReports(teamId, {
      reportType: reportType ?? undefined,
      playerId: playerId ?? undefined,
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
