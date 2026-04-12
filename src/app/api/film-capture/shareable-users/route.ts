import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import type { ShareableUser } from '@/types/film-capture';

/**
 * GET /api/film-capture/shareable-users
 * Returns all users (coaches + parents) with film_capture_access = true,
 * excluding the current user. Used to populate the share modal.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    // Fetch coaches with film_capture_access
    const { data: coaches, error: coachError } = await serviceClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('film_capture_access', true)
      .neq('id', user.id);

    if (coachError) {
      console.error('[shareable-users] Coach query failed:', coachError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Fetch parents with film_capture_access
    const { data: parents, error: parentError } = await serviceClient
      .from('parent_profiles')
      .select('user_id, first_name, last_name, email')
      .eq('film_capture_access', true)
      .neq('user_id', user.id);

    if (parentError) {
      console.error('[shareable-users] Parent query failed:', parentError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const coachUsers: ShareableUser[] = (coaches ?? []).map(c => ({
      id: c.id,
      name: (c.full_name as string | null) || (c.email as string | null) || c.id,
      email: (c.email as string | null) || '',
      role: 'coach' as const,
    }));

    const parentUsers: ShareableUser[] = (parents ?? []).map(p => ({
      id: p.user_id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      email: p.email,
      role: 'parent' as const,
    }));

    // Sort combined list by name
    const users = [...coachUsers, ...parentUsers].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[shareable-users] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
