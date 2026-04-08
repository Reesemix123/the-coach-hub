import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { StepCompletionStatus } from '@/types/test-hub';

interface RouteContext {
  params: Promise<{ sessionId: string; stepId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId, stepId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_tester, is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_tester && !profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status, notes, flagged_issue } = body as {
      status: StepCompletionStatus;
      notes?: string;
      flagged_issue?: boolean;
    };

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('test_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('tester_id', user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    const completedAt = status !== 'pending' ? new Date().toISOString() : null;

    // Check if completion record already exists
    const { data: existing } = await supabase
      .from('test_step_completions')
      .select('id')
      .eq('session_id', sessionId)
      .eq('step_id', stepId)
      .maybeSingle();

    let completion;
    let dbError;

    if (existing) {
      const { data, error } = await supabase
        .from('test_step_completions')
        .update({
          status,
          notes: notes ?? null,
          flagged_issue: flagged_issue ?? false,
          completed_at: completedAt,
        })
        .eq('id', existing.id)
        .select()
        .single();

      completion = data;
      dbError = error;
    } else {
      const { data, error } = await supabase
        .from('test_step_completions')
        .insert({
          session_id: sessionId,
          step_id: stepId,
          status,
          notes: notes ?? null,
          flagged_issue: flagged_issue ?? false,
          completed_at: completedAt,
        })
        .select()
        .single();

      completion = data;
      dbError = error;
    }

    if (dbError) {
      console.error('Failed to upsert step completion:', dbError);
      return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
    }

    return NextResponse.json(completion);
  } catch (error) {
    console.error('PATCH /api/test-hub/sessions/[sessionId]/steps/[stepId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
