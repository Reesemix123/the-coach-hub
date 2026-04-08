import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
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

    // End any existing active time logs for this session
    const { error: endError } = await supabase
      .from('time_logs')
      .update({ ended_at: new Date().toISOString(), is_active: false })
      .eq('session_id', sessionId)
      .eq('tester_id', user.id)
      .eq('is_active', true);

    if (endError) {
      console.error('Failed to end existing time logs:', endError);
    }

    // Insert new active time log
    const { data: timeLog, error: insertError } = await supabase
      .from('time_logs')
      .insert({
        session_id: sessionId,
        tester_id: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create time log:', insertError);
      return NextResponse.json({ error: 'Failed to start time log' }, { status: 500 });
    }

    return NextResponse.json(timeLog, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-hub/sessions/[sessionId]/time error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
