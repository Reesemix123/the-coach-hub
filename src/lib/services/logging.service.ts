// Logging Service
// Provides utilities to log audit events, auth events, and errors to the database
// Uses the database functions created in migrations 051 and 060

import { createClient } from '@/utils/supabase/server';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create_team'
  | 'update_team'
  | 'delete_team'
  | 'create_subscription'
  | 'update_subscription'
  | 'cancel_subscription'
  | 'update_feature_flag'
  | 'update_tier_config'
  | 'waive_billing'
  | 'flag_video'
  | 'approve_video'
  | 'delete_video'
  | 'invite_member'
  | 'remove_member'
  | 'update_member_role'
  | 'upload_video'
  | 'create_game'
  | 'update_game'
  | 'delete_game';

export type AuthAction =
  | 'login'
  | 'logout'
  | 'signup'
  | 'password_reset'
  | 'password_change'
  | 'email_change'
  | 'mfa_enable'
  | 'mfa_disable'
  | 'token_refresh'
  | 'session_end';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export type ErrorSource = 'api' | 'webhook' | 'cron' | 'client';

/**
 * Log an audit event (admin/important actions)
 */
export async function logAuditEvent({
  actorId,
  action,
  targetType,
  targetId,
  targetName,
  metadata,
}: {
  actorId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('log_audit_event', {
      p_actor_id: actorId,
      p_action: action,
      p_target_type: targetType || null,
      p_target_id: targetId || null,
      p_target_name: targetName || null,
      p_metadata: metadata || null,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('Error logging audit event:', err);
    return null;
  }
}

/**
 * Log an authentication event
 */
export async function logAuthEvent({
  userId,
  userEmail,
  action,
  status,
  ipAddress,
  userAgent,
  failureReason,
  metadata,
}: {
  userId: string | null;
  userEmail: string | null;
  action: AuthAction;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('log_auth_event', {
      p_user_id: userId,
      p_user_email: userEmail,
      p_action: action,
      p_status: status,
      p_ip_address: ipAddress || null,
      p_user_agent: userAgent || null,
      p_failure_reason: failureReason || null,
      p_metadata: metadata || null,
    });

    if (error) {
      console.error('Failed to log auth event:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('Error logging auth event:', err);
    return null;
  }
}

/**
 * Log an error event
 */
export async function logError({
  severity,
  message,
  stackTrace,
  metadata,
  source,
  endpoint,
  requestId,
}: {
  severity: ErrorSeverity;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
  source?: ErrorSource;
  endpoint?: string;
  requestId?: string;
}): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('log_error', {
      p_severity: severity,
      p_message: message,
      p_stack_trace: stackTrace || null,
      p_metadata: metadata || null,
      p_source: source || null,
      p_endpoint: endpoint || null,
      p_request_id: requestId || null,
    });

    if (error) {
      console.error('Failed to log error:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('Error logging error event:', err);
    return null;
  }
}

/**
 * Helper to extract IP address from request headers
 */
export function getClientIp(headers: Headers): string | null {
  // Try various headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, first one is the client
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return null;
}

/**
 * Helper to get user agent from request headers
 */
export function getUserAgent(headers: Headers): string | null {
  return headers.get('user-agent');
}
