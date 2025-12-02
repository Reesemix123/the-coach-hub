// src/lib/admin/auth.ts
// Authentication utilities for Platform Admin routes

import { createClient, createServiceClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { ProfileWithAdmin } from '@/types/admin';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AdminAuthResult {
  success: true;
  admin: ProfileWithAdmin;
  serviceClient: SupabaseClient; // Service client for admin queries that bypass RLS
}

export interface AdminAuthError {
  success: false;
  response: NextResponse;
}

export type AdminAuthResponse = AdminAuthResult | AdminAuthError;

/**
 * Verifies the current user is a platform admin.
 * Returns the admin profile if authorized, or an error response if not.
 *
 * Usage in API routes:
 * ```typescript
 * export async function GET() {
 *   const auth = await requirePlatformAdmin();
 *   if (!auth.success) return auth.response;
 *
 *   const admin = auth.admin;
 *   // ... admin-only logic
 * }
 * ```
 */
export async function requirePlatformAdmin(): Promise<AdminAuthResponse> {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    };
  }

  // Check if user is a platform admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, organization_id, is_platform_admin, last_active_at, updated_at')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    };
  }

  if (!profile.is_platform_admin) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Forbidden: Platform admin access required' },
        { status: 403 }
      )
    };
  }

  // Update last_active_at for admin activity tracking
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);

  // Create a service client for admin queries that need to bypass RLS
  // This is safe because we've already verified the user is a platform admin
  const serviceClient = createServiceClient();

  return {
    success: true,
    admin: profile as ProfileWithAdmin,
    serviceClient
  };
}

/**
 * Logs an admin action to the audit log.
 * Should be called after any admin action that modifies data.
 */
export async function logAdminAction(
  actorId: string,
  actorEmail: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  targetName?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();

  await supabase.from('audit_logs').insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    target_name: targetName || null,
    metadata: metadata || null
  });
}
