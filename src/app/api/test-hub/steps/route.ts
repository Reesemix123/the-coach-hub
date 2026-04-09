/**
 * API: POST /api/test-hub/steps
 * Creates a new test step on a test case.
 * Admin only.
 *
 * Body: { test_case_id: string, step_type: 'setup' | 'test', instruction: string, expected_outcome?: string }
 */

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
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { test_case_id, step_type, instruction, expected_outcome } = body as {
      test_case_id?: string;
      step_type?: string;
      instruction?: string;
      expected_outcome?: string;
    };

    if (!test_case_id || !instruction?.trim()) {
      return NextResponse.json(
        { error: 'test_case_id and instruction are required' },
        { status: 400 }
      );
    }

    if (step_type !== 'setup' && step_type !== 'test') {
      return NextResponse.json(
        { error: 'step_type must be "setup" or "test"' },
        { status: 400 }
      );
    }

    // Get max display_order for this step_type in the case
    const { data: existingSteps } = await supabase
      .from('test_steps')
      .select('display_order')
      .eq('test_case_id', test_case_id)
      .eq('step_type', step_type)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = (existingSteps?.[0]?.display_order ?? -1) + 1;

    const { data: step, error: insertError } = await supabase
      .from('test_steps')
      .insert({
        test_case_id,
        step_type,
        display_order: nextOrder,
        instruction: instruction.trim(),
        expected_outcome: expected_outcome?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create test step:', insertError);
      return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
    }

    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    console.error('POST /api/test-hub/steps error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
