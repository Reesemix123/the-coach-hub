/**
 * API: PATCH /api/test-hub/cases/[caseId]/order
 * Updates the display_order of a single test case.
 * Admin only.
 *
 * Body: { display_order: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ caseId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { caseId } = await context.params;

    // Admin auth check
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
    const { display_order } = body as { display_order: number };

    if (display_order === undefined || display_order === null) {
      return NextResponse.json({ error: 'display_order is required' }, { status: 400 });
    }

    if (typeof display_order !== 'number' || !Number.isInteger(display_order) || display_order < 0) {
      return NextResponse.json(
        { error: 'display_order must be a non-negative integer' },
        { status: 400 }
      );
    }

    const { data: testCase, error: updateError } = await supabase
      .from('test_cases')
      .update({
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .select('id, display_order, updated_at')
      .single();

    if (updateError) {
      console.error('Failed to update display_order:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...testCase });
  } catch (error) {
    console.error('PATCH /api/test-hub/cases/[caseId]/order error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
