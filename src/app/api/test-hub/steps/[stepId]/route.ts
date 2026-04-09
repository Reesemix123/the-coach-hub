/**
 * API: PATCH /api/test-hub/steps/[stepId] — update step fields
 *       DELETE /api/test-hub/steps/[stepId] — delete a step
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ stepId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { stepId } = await context.params;

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
    const { instruction, expected_outcome, display_order } = body as {
      instruction?: string;
      expected_outcome?: string;
      display_order?: number;
    };

    // Build update object from only the provided fields
    const updates: Record<string, unknown> = {};

    if (instruction !== undefined) {
      if (typeof instruction !== 'string' || instruction.trim() === '') {
        return NextResponse.json({ error: 'instruction must be a non-empty string' }, { status: 400 });
      }
      updates.instruction = instruction.trim();
    }

    if (expected_outcome !== undefined) {
      updates.expected_outcome = expected_outcome;
    }

    if (display_order !== undefined) {
      if (typeof display_order !== 'number' || display_order < 0) {
        return NextResponse.json({ error: 'display_order must be a non-negative number' }, { status: 400 });
      }
      updates.display_order = display_order;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'At least one field must be provided' },
        { status: 400 }
      );
    }

    const { data: step, error: updateError } = await supabase
      .from('test_steps')
      .update(updates)
      .eq('id', stepId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update test step:', updateError);
      return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
    }

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    return NextResponse.json(step);
  } catch (error) {
    console.error('PATCH /api/test-hub/steps/[stepId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { stepId } = await context.params;

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

    const { error: deleteError } = await supabase
      .from('test_steps')
      .delete()
      .eq('id', stepId);

    if (deleteError) {
      console.error('Failed to delete test step:', deleteError);
      return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/test-hub/steps/[stepId] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
