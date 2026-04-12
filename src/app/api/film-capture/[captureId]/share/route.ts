import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ captureId: string }>;
}

/**
 * GET /api/film-capture/[captureId]/share
 * Returns the list of users this capture is currently shared with.
 * Only the capture owner or a platform admin can call this.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { captureId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    // Verify ownership or admin
    const { data: capture } = await serviceClient
      .from('film_captures')
      .select('uploader_id')
      .eq('id', captureId)
      .single();

    if (!capture) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.is_platform_admin === true;

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can manage sharing' }, { status: 403 });
    }

    // Fetch all shares for this capture
    const { data: shares, error: sharesError } = await serviceClient
      .from('film_capture_shares')
      .select('shared_with_user_id, shared_at')
      .eq('capture_id', captureId);

    if (sharesError) {
      console.error('[film-capture/share] GET shares failed:', sharesError);
      return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
    }

    if (!shares || shares.length === 0) {
      return NextResponse.json({ shares: [] });
    }

    // Resolve user names from profiles and parent_profiles
    const sharedUserIds = shares.map(s => s.shared_with_user_id);

    const [{ data: profileData }, { data: parentData }] = await Promise.all([
      serviceClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sharedUserIds),
      serviceClient
        .from('parent_profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', sharedUserIds),
    ]);

    const nameMap = new Map<string, { name: string; email: string }>();
    for (const p of profileData ?? []) {
      nameMap.set(p.id, {
        name: (p.full_name as string | null) || (p.email as string | null) || p.id,
        email: (p.email as string | null) || '',
      });
    }
    for (const p of parentData ?? []) {
      nameMap.set(p.user_id, {
        name: `${p.first_name} ${p.last_name}`.trim(),
        email: p.email,
      });
    }

    const enrichedShares = shares.map(s => ({
      shared_with_user_id: s.shared_with_user_id,
      shared_at: s.shared_at,
      name: nameMap.get(s.shared_with_user_id)?.name ?? s.shared_with_user_id,
      email: nameMap.get(s.shared_with_user_id)?.email ?? '',
    }));

    return NextResponse.json({ shares: enrichedShares });
  } catch (error) {
    console.error('[film-capture/share] GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/film-capture/[captureId]/share
 * Body: { userIds: string[] }
 * Replaces the full share list — adds new shares, removes unchecked ones.
 * Only the capture owner or a platform admin can call this.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { captureId } = await context.params;

    const body = await request.json();
    const userIds: unknown = body.userIds;

    if (!Array.isArray(userIds) || userIds.some(id => typeof id !== 'string')) {
      return NextResponse.json(
        { error: 'userIds must be an array of strings' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = createServiceClient();

    // Verify ownership or admin
    const { data: capture } = await serviceClient
      .from('film_captures')
      .select('uploader_id')
      .eq('id', captureId)
      .single();

    if (!capture) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.is_platform_admin === true;

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can manage sharing' }, { status: 403 });
    }

    // Prevent sharing with yourself
    const targetIds = (userIds as string[]).filter(id => id !== user.id);

    // Fetch current shares to diff
    const { data: existingShares } = await serviceClient
      .from('film_capture_shares')
      .select('shared_with_user_id')
      .eq('capture_id', captureId);

    const existingUserIds = new Set((existingShares ?? []).map(s => s.shared_with_user_id));
    const requestedIds = new Set(targetIds);

    // IDs to add: in requested but not existing
    const toAdd = targetIds.filter(id => !existingUserIds.has(id));
    // IDs to remove: in existing but not requested
    const toRemove = [...existingUserIds].filter(id => !requestedIds.has(id));

    // Remove revoked shares
    if (toRemove.length > 0) {
      const { error: deleteError } = await serviceClient
        .from('film_capture_shares')
        .delete()
        .eq('capture_id', captureId)
        .in('shared_with_user_id', toRemove);

      if (deleteError) {
        console.error('[film-capture/share] Delete shares failed:', deleteError);
        return NextResponse.json({ error: 'Failed to revoke shares' }, { status: 500 });
      }
    }

    // Insert new shares
    let added = 0;
    if (toAdd.length > 0) {
      const rows = toAdd.map(uid => ({
        capture_id: captureId,
        shared_with_user_id: uid,
        shared_by_user_id: user.id,
      }));

      const { error: insertError } = await serviceClient
        .from('film_capture_shares')
        .insert(rows);

      if (insertError) {
        console.error('[film-capture/share] Insert shares failed:', insertError);
        return NextResponse.json({ error: 'Failed to create shares' }, { status: 500 });
      }

      added = toAdd.length;
    }

    return NextResponse.json({
      success: true,
      shared_count: targetIds.length,
      added,
      removed: toRemove.length,
    });
  } catch (error) {
    console.error('[film-capture/share] POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
