import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ sessionId: string; logId: string }>;
}

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const { sessionId: _sessionId, logId } = await context.params;

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

    // Verify the log belongs to the user
    const { data: existing } = await supabase
      .from('time_logs')
      .select('id')
      .eq('id', logId)
      .eq('tester_id', user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Time log not found or access denied' }, { status: 403 });
    }

    const { data: timeLog, error: updateError } = await supabase
      .from('time_logs')
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', logId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to stop time log:', updateError);
      return NextResponse.json({ error: 'Failed to stop time log' }, { status: 500 });
    }

    return NextResponse.json(timeLog);
  } catch (error) {
    console.error('PATCH /api/test-hub/sessions/[sessionId]/time/[logId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
