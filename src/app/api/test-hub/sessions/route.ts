import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
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
    const { testCaseId } = body as { testCaseId: string };

    if (!testCaseId) {
      return NextResponse.json({ error: 'testCaseId is required' }, { status: 400 });
    }

    // Fetch test case to get checkout_mode and verify it's active
    const { data: testCase } = await supabase
      .from('test_cases')
      .select('id, checkout_mode, status')
      .eq('id', testCaseId)
      .single();

    if (!testCase || testCase.status !== 'active') {
      return NextResponse.json({ error: 'Test case not found or not active' }, { status: 404 });
    }

    // If exclusive mode, block if an active session already exists
    if (testCase.checkout_mode === 'exclusive') {
      const { data: existingSession } = await supabase
        .from('test_sessions')
        .select('id')
        .eq('test_case_id', testCaseId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSession) {
        return NextResponse.json(
          { error: 'Test case is already checked out', code: 'ALREADY_CHECKED_OUT' },
          { status: 409 }
        );
      }
    }

    const { data: session, error: insertError } = await supabase
      .from('test_sessions')
      .insert({
        test_case_id: testCaseId,
        tester_id: user.id,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create test session:', insertError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-hub/sessions error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
