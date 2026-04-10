import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  const { userId } = await context.params;
  const { admin, serviceClient } = auth;

  const body = await request.json() as { film_capture_access: boolean };
  const { film_capture_access } = body;

  if (typeof film_capture_access !== 'boolean') {
    return NextResponse.json(
      { error: 'film_capture_access must be a boolean' },
      { status: 400 }
    );
  }

  // Check if user exists in profiles (coach) or parent_profiles (parent)
  const [{ data: coachProfile }, { data: parentProfile }] = await Promise.all([
    serviceClient.from('profiles').select('id').eq('id', userId).maybeSingle(),
    serviceClient.from('parent_profiles').select('id, user_id').eq('user_id', userId).maybeSingle(),
  ]);

  let updated = false;

  if (coachProfile) {
    await serviceClient
      .from('profiles')
      .update({ film_capture_access })
      .eq('id', userId);
    updated = true;
  }

  if (parentProfile) {
    await serviceClient
      .from('parent_profiles')
      .update({ film_capture_access })
      .eq('user_id', userId);
    updated = true;
  }

  if (!updated) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await logAdminAction(
    admin.id,
    admin.email || '',
    film_capture_access ? 'film_capture.access_granted' : 'film_capture.access_revoked',
    'user',
    userId,
    undefined,
    { film_capture_access }
  );

  return NextResponse.json({ success: true, film_capture_access });
}
