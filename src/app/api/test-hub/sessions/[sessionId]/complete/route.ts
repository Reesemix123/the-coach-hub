import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

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

    const body = await request.json().catch(() => ({}));
    const { notes } = body as { notes?: string };

    // Verify session belongs to user and is active
    const { data: session } = await supabase
      .from('test_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('tester_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Active session not found' }, { status: 404 });
    }

    // End any active time logs for this session
    const { error: timeLogError } = await supabase
      .from('time_logs')
      .update({ ended_at: new Date().toISOString(), is_active: false })
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (timeLogError) {
      console.error('Failed to end time logs for session:', timeLogError);
    }

    // Mark session as completed
    const { data: updated, error: updateError } = await supabase
      .from('test_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to complete test session:', updateError);
      return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('POST /api/test-hub/sessions/[sessionId]/complete error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
