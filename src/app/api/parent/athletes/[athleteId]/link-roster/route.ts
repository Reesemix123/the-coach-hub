/**
 * API: POST /api/parent/athletes/[athleteId]/link-roster
 * Links an athlete profile to a roster player via 6-character join code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { sendNotification, formatSmsBody, getCommHubEmailTemplate } from '@/lib/services/communication/notification.service';

interface RouteContext {
  params: Promise<{ athleteId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { athleteId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify parent owns this athlete
    const serviceClient = createServiceClient();
    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ error: 'Parent profile required' }, { status: 403 });

    const { data: athlete } = await serviceClient
      .from('athlete_profiles')
      .select('id')
      .eq('id', athleteId)
      .eq('created_by_parent_id', parent.id)
      .maybeSingle();

    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    // Parse join code
    const body = await request.json() as { joinCode?: string };
    const code = body.joinCode?.trim().toUpperCase();

    if (!code || code.length < 4 || code.length > 8) {
      return NextResponse.json({ error: 'Invalid join code format' }, { status: 400 });
    }

    // Find player by join code (case-insensitive)
    const { data: player } = await serviceClient
      .from('players')
      .select('id, first_name, last_name, jersey_number, team_id, position_categories!primary_position_category_id(code)')
      .eq('join_code', code)
      .maybeSingle();

    if (!player) {
      return NextResponse.json(
        { error: 'Code not found. Check with your coach.' },
        { status: 404 }
      );
    }

    // Get team info
    const { data: team } = await serviceClient
      .from('teams')
      .select('id, name, sport, user_id')
      .eq('id', player.team_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://youthcoachhub.com';

    // Plan-limit check — skip when this parent already has active access on the team
    // (they're a returning member adding another athlete, not consuming a new slot).
    const { data: existingAccessForLimit } = await serviceClient
      .from('team_parent_access')
      .select('id, status')
      .eq('team_id', team.id)
      .eq('parent_id', parent.id)
      .maybeSingle();

    const isReturningParent = existingAccessForLimit?.status === 'active';

    if (!isReturningParent) {
      const { data: activePlan } = await serviceClient
        .from('team_communication_plans')
        .select('id, plan_tier, max_parents')
        .eq('team_id', team.id)
        .eq('status', 'active')
        .maybeSingle();

      if (activePlan && activePlan.max_parents !== null) {
        const [{ count: activeParentCount }, { count: pendingInviteCount }] = await Promise.all([
          serviceClient
            .from('team_parent_access')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)
            .eq('status', 'active'),
          serviceClient
            .from('parent_invitations')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)
            .eq('status', 'pending'),
        ]);

        const totalParents = (activeParentCount ?? 0) + (pendingInviteCount ?? 0);

        if (totalParents >= activePlan.max_parents) {
          // Notify the coach (fire-and-forget) — email only, matches existing pattern
          const upgradeUrl = `${appUrl}/football/teams/${team.id}/communication/plan`;
          const athleteName = `${player.first_name} ${player.last_name}`;

          const [parentRes, coachRes] = await Promise.all([
            serviceClient
              .from('parent_profiles')
              .select('first_name, last_name')
              .eq('id', parent.id)
              .single(),
            serviceClient
              .from('profiles')
              .select('email')
              .eq('id', team.user_id)
              .single(),
          ]);

          const parentName = parentRes.data
            ? `${parentRes.data.first_name} ${parentRes.data.last_name}`.trim()
            : 'A parent';

          sendNotification({
            teamId: team.id,
            recipientId: team.user_id,
            recipientType: 'coach',
            channel: 'email',
            notificationType: 'announcement',
            subject: `${parentName} couldn't join ${team.name} — your plan is full`,
            body: getCommHubEmailTemplate({
              title: 'Your Comm Hub plan has reached its parent limit',
              body: `<p><strong>${parentName}</strong> tried to join <strong>${team.name}</strong> as ${athleteName}'s parent, but couldn't because your current ${activePlan.plan_tier} plan has reached its maximum of ${activePlan.max_parents} parents.</p><p>Upgrade your plan to make room — once you do, ${parentName} will be able to join.</p>`,
              teamName: team.name,
              ctaText: 'Upgrade Comm Hub',
              ctaUrl: upgradeUrl,
            }),
            smsBody: '',
            recipientEmail: coachRes.data?.email ?? undefined,
          }).catch((err) =>
            console.error('[link-roster] Limit notification failed:', err),
          );

          return NextResponse.json(
            {
              error: "Your coach's current plan has reached the maximum number of parents.",
              code: 'PARENT_LIMIT_REACHED',
              teamName: team.name,
              planTier: activePlan.plan_tier,
              maxParents: activePlan.max_parents,
              currentParentCount: totalParents,
              upgradeUrl,
            },
            { status: 409 },
          );
        }
      }
    }

    // Derive season year: if before August use current year, else current year (fall season)
    const now = new Date();
    const seasonYear = now.getFullYear();

    // Check for existing athlete_seasons entry
    const { data: existingSeason } = await serviceClient
      .from('athlete_seasons')
      .select('id')
      .eq('athlete_profile_id', athleteId)
      .eq('team_id', team.id)
      .eq('season_year', seasonYear)
      .eq('sport', team.sport ?? 'football')
      .maybeSingle();

    if (existingSeason) {
      return NextResponse.json(
        { error: 'Already linked to this team for this season' },
        { status: 409 }
      );
    }

    // Create athlete_seasons row
    const { data: season, error: seasonError } = await serviceClient
      .from('athlete_seasons')
      .insert({
        athlete_profile_id: athleteId,
        team_id: team.id,
        roster_id: player.id,
        sport: team.sport ?? 'football',
        season_year: seasonYear,
        position: (player as unknown as { position_categories?: { code: string | null } | null }).position_categories?.code ?? null,
        jersey_number: player.jersey_number,
      })
      .select('id')
      .single();

    if (seasonError) {
      console.error('[link-roster] Insert failed:', seasonError);
      return NextResponse.json({ error: 'Failed to link to team' }, { status: 500 });
    }

    // Also create player_parent_links if not already linked
    const { data: existingLink } = await serviceClient
      .from('player_parent_links')
      .select('id')
      .eq('player_id', player.id)
      .eq('parent_id', parent.id)
      .maybeSingle();

    if (!existingLink) {
      await serviceClient.from('player_parent_links').insert({
        player_id: player.id,
        parent_id: parent.id,
        relationship: 'parent',
        is_primary_contact: false,
      });
    }

    // Grant team_parent_access if not already granted
    const { data: existingAccess } = await serviceClient
      .from('team_parent_access')
      .select('id')
      .eq('team_id', team.id)
      .eq('parent_id', parent.id)
      .maybeSingle();

    if (!existingAccess) {
      await serviceClient.from('team_parent_access').insert({
        team_id: team.id,
        parent_id: parent.id,
        access_level: 'full',
        status: 'active',
      });
    }

    // Fire-and-forget notifications — do not block the response
    const athleteName = `${player.first_name} ${player.last_name}`;

    const [{ data: parentContact }, { data: coachProfile }] = await Promise.all([
      serviceClient.from('parent_profiles').select('email, phone, notification_preference').eq('id', parent.id).single(),
      serviceClient.from('profiles').select('email').eq('id', team.user_id).single(),
    ]);

    // Parent confirmation
    sendNotification({
      teamId: team.id,
      recipientId: parent.id,
      recipientType: 'parent',
      channel: (parentContact?.notification_preference as 'sms' | 'email' | 'both') ?? 'email',
      notificationType: 'announcement',
      subject: `You're now linked to ${team.name}`,
      body: getCommHubEmailTemplate({
        title: `Welcome to ${team.name}`,
        body: `<p>You've been linked to <strong>${athleteName}</strong> on ${team.name}. Your coach can now share clips, reports, and updates with you through Youth Coach Hub.</p>`,
        teamName: team.name,
        ctaText: 'View Your Athlete',
        ctaUrl: `${appUrl}/parent/athletes`,
      }),
      smsBody: formatSmsBody(team.name, `You've been linked to ${athleteName} on ${team.name}. Your coach can now share clips and reports with you.`),
      recipientEmail: parentContact?.email ?? undefined,
      recipientPhone: parentContact?.phone ?? undefined,
    }).catch(err => console.error('[link-roster] Parent notification failed:', err));

    // Coach notification — email only
    sendNotification({
      teamId: team.id,
      recipientId: team.user_id,
      recipientType: 'coach',
      channel: 'email',
      notificationType: 'announcement',
      subject: `A parent linked to ${athleteName}`,
      body: getCommHubEmailTemplate({
        title: 'Parent Linked via Join Code',
        body: `<p>A parent has self-linked to <strong>${athleteName}</strong> on your roster using a join code. Review your parent roster to confirm access is correct.</p>`,
        teamName: team.name,
        ctaText: 'View Parent Roster',
        ctaUrl: `${appUrl}/${team.sport ?? 'football'}/teams/${team.id}/communication/parents`,
      }),
      smsBody: '',
      recipientEmail: coachProfile?.email ?? undefined,
    }).catch(err => console.error('[link-roster] Coach notification failed:', err));

    return NextResponse.json({
      athleteSeasonId: season.id,
      teamName: team.name,
      playerName: athleteName,
    });
  } catch (error) {
    console.error('[link-roster] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
