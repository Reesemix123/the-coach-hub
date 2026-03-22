/**
 * API: /api/communication/game-summaries/[id]
 * GET    - Get a single game summary
 * PATCH  - Update a game summary
 * DELETE - Delete a game summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  getGameSummary,
  updateGameSummary,
  deleteGameSummary,
} from '@/lib/services/communication/report.service';
import type { NotificationChannel } from '@/types/communication';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const summary = await getGameSummary(id);
    if (!summary) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching game summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json();

    const summary = await updateGameSummary(id, {
      coachRawNotes: body.coachRawNotes,
      aiDraft: body.aiDraft,
      publishedText: body.publishedText,
      playerHighlights: body.playerHighlights,
      opponent: body.opponent,
      scoreUs: body.scoreUs,
      scoreThem: body.scoreThem,
      gameDate: body.gameDate,
      gameId: body.gameId,
      notificationChannel: body.notificationChannel as NotificationChannel | undefined,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error updating game summary:', error);
    return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    await deleteGameSummary(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game summary:', error);
    return NextResponse.json({ error: 'Failed to delete summary' }, { status: 500 });
  }
}
