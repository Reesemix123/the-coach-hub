/**
 * API: /api/communication/game-summaries
 * POST - Create a new game summary draft
 * GET  - List game summaries (coach sees all, parent sees published only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  createGameSummary,
  getTeamGameSummaries,
  getPublishedSummariesForParent,
} from '@/lib/services/communication/report.service';
import type { NotificationChannel, GameSummaryStatus } from '@/types/communication';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { teamId, gameId, coachRawNotes, opponent, scoreUs, scoreThem, gameDate, notificationChannel } = body;

    if (!teamId || !notificationChannel) {
      return NextResponse.json(
        { error: 'teamId and notificationChannel are required' },
        { status: 400 }
      );
    }

    // Verify coach access
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
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

    const summary = await createGameSummary({
      teamId,
      coachId: user.id,
      gameId,
      coachRawNotes,
      opponent,
      scoreUs,
      scoreThem,
      gameDate,
      notificationChannel: notificationChannel as NotificationChannel,
    });

    return NextResponse.json({ summary }, { status: 201 });
  } catch (error) {
    console.error('Error creating game summary:', error);
    return NextResponse.json({ error: 'Failed to create game summary' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const status = searchParams.get('status') as GameSummaryStatus | null;

    if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 });

    // If caller is a parent, show published only
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (parentProfile) {
      const summaries = await getPublishedSummariesForParent(teamId);
      return NextResponse.json({ summaries });
    }

    // Coach view — all summaries, with optional status filter
    const summaries = await getTeamGameSummaries(teamId, { status: status ?? undefined });
    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('Error fetching game summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
  }
}
