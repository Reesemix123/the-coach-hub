/**
 * API: PATCH /api/player-profiles/reports/[reportId]
 *
 * Manages a player report — saving coach edits, publishing to parents,
 * or unpublishing a previously published report.
 *
 * Actions:
 *   save       — persists the coach-edited narrative, marks coach_edited = true
 *   publish    — saves narrative (if provided), sets is_published_to_parent = true,
 *                records published_at, and sends a notification email to the parent
 *   unpublish  — clears is_published_to_parent and published_at
 *
 * Email failure on publish does NOT fail the API response. The report is
 * updated regardless and the email error is logged to the console.
 *
 * Authorization: team owner OR active team_memberships row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/email';
import { getCommHubEmailTemplate } from '@/lib/services/communication/notification.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportAction = 'publish' | 'unpublish' | 'save';

interface PatchBody {
  ai_narrative_parent?: string;
  action?: ReportAction;
}

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

interface ExistingReport {
  id: string;
  athlete_profile_id: string;
  athlete_season_id: string;
  game_id: string;
  ai_narrative_parent: string | null;
  is_published_to_parent: boolean;
  coach_edited: boolean;
  athlete_seasons: { team_id: string };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { reportId } = await context.params;

    // -------------------------------------------------------------------------
    // 1. Auth — verify requesting user is authenticated
    // -------------------------------------------------------------------------

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. Parse and validate request body
    // -------------------------------------------------------------------------

    let body: PatchBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validActions: ReportAction[] = ['publish', 'unpublish', 'save'];
    if (body.action !== undefined && !validActions.includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be one of: publish, unpublish, save' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Fetch report with team context via service client
    // -------------------------------------------------------------------------

    const serviceClient = createServiceClient();

    const { data: report, error: reportError } = await serviceClient
      .from('player_reports')
      .select(
        'id, athlete_profile_id, athlete_season_id, game_id, ai_narrative_parent, is_published_to_parent, coach_edited, athlete_seasons!inner(team_id)'
      )
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const existing = report as unknown as ExistingReport;
    const teamId = existing.athlete_seasons.team_id;

    // -------------------------------------------------------------------------
    // 4. Authorize — team owner OR active team member
    // -------------------------------------------------------------------------

    const [{ data: team }, { data: membership }] = await Promise.all([
      supabase.from('teams').select('user_id').eq('id', teamId).single(),
      supabase
        .from('team_memberships')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single(),
    ]);

    const isOwner = team?.user_id === user.id;
    const isMember = !!membership;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // -------------------------------------------------------------------------
    // 5. Build update payload based on action
    // -------------------------------------------------------------------------

    type UpdatePayload = {
      ai_narrative_parent?: string | null;
      coach_edited?: boolean;
      is_published_to_parent?: boolean;
      published_at?: string | null;
    };

    let updatePayload: UpdatePayload = {};
    const action = body.action ?? 'save';

    if (action === 'save') {
      updatePayload = {
        ai_narrative_parent: body.ai_narrative_parent,
        coach_edited: true,
      };
    } else if (action === 'publish') {
      const narrativeToSave =
        body.ai_narrative_parent !== undefined
          ? body.ai_narrative_parent
          : existing.ai_narrative_parent;

      updatePayload = {
        ai_narrative_parent: narrativeToSave,
        is_published_to_parent: true,
        published_at: new Date().toISOString(),
        coach_edited:
          body.ai_narrative_parent !== undefined ? true : existing.coach_edited,
      };
    } else {
      // unpublish
      updatePayload = {
        is_published_to_parent: false,
        published_at: null,
      };
    }

    // -------------------------------------------------------------------------
    // 6. Persist update and return updated row
    // -------------------------------------------------------------------------

    const { data: updated, error: updateError } = await serviceClient
      .from('player_reports')
      .update(updatePayload)
      .eq('id', reportId)
      .select()
      .single();

    if (updateError) {
      console.error('[report-mgmt] Failed to update report:', updateError);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // 7. On publish: send parent notification email (non-blocking)
    // -------------------------------------------------------------------------

    if (action === 'publish') {
      sendParentNotification({
        serviceClient,
        athleteProfileId: existing.athlete_profile_id,
        gameId: existing.game_id,
      }).catch((err: unknown) => {
        console.error('[report-mgmt] Parent notification failed:', err);
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[report-mgmt] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helper: send parent notification email
// Wrapped in its own async function so the caller can fire-and-forget safely.
// ---------------------------------------------------------------------------

async function sendParentNotification({
  serviceClient,
  athleteProfileId,
  gameId,
}: {
  serviceClient: ReturnType<typeof createServiceClient>;
  athleteProfileId: string;
  gameId: string;
}): Promise<void> {
  // Look up athlete
  const { data: athlete, error: athleteError } = await serviceClient
    .from('athlete_profiles')
    .select('id, athlete_first_name, athlete_last_name, created_by_parent_id')
    .eq('id', athleteProfileId)
    .single();

  if (athleteError || !athlete) {
    console.error('[report-mgmt] Could not find athlete for notification:', athleteError);
    return;
  }

  if (!athlete.created_by_parent_id) {
    // Athlete has no linked parent — nothing to send
    return;
  }

  // Look up parent
  const { data: parent, error: parentError } = await serviceClient
    .from('parent_profiles')
    .select('email, first_name')
    .eq('id', athlete.created_by_parent_id)
    .single();

  if (parentError || !parent?.email) {
    console.error('[report-mgmt] Could not find parent for notification:', parentError);
    return;
  }

  // Look up game
  const { data: game, error: gameError } = await serviceClient
    .from('games')
    .select('opponent, date')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    console.error('[report-mgmt] Could not find game for notification:', gameError);
    return;
  }

  const athleteName = `${athlete.athlete_first_name} ${athlete.athlete_last_name}`;
  const gameDate = game.date
    ? new Date(game.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'a recent game';
  const opponent = game.opponent ?? 'an opponent';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://youthcoachhub.com';
  const reportUrl = `${appUrl}/parent/athletes/${athleteProfileId}`;
  const greeting = parent.first_name ? `Hi ${parent.first_name},` : 'Hi there,';

  const emailBody = `
    <p>${greeting}</p>
    <p>The coaching staff has published a new game report for <strong>${athleteName}</strong> from the game vs <strong>${opponent}</strong> on ${gameDate}.</p>
    <p>Log in to your parent portal to read the full report, including coach notes and performance highlights.</p>
  `;

  const html = getCommHubEmailTemplate({
    title: `New Game Report for ${athleteName}`,
    body: emailBody,
    ctaText: 'View Report',
    ctaUrl: reportUrl,
  });

  try {
    await sendEmail({
      to: parent.email,
      subject: `New game report available for ${athleteName}`,
      html,
      tags: [
        { name: 'notification_type', value: 'report_published' },
        { name: 'athlete_profile_id', value: athleteProfileId },
      ],
    });
  } catch (emailErr) {
    // Log and swallow — callers must not fail due to email issues
    console.error('[report-mgmt] sendEmail threw unexpectedly:', emailErr);
  }
}
