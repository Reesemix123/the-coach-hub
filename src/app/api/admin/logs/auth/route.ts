// /api/admin/logs/auth - Auth Logs API
// Returns authentication event logs for platform admins
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface AuthLogEntry {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  status: 'success' | 'failure';
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

interface AuthLogsResponse {
  logs: AuthLogEntry[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  stats: {
    logins_24h: number;
    failures_24h: number;
    signups_24h: number;
  };
}

/**
 * GET /api/admin/logs/auth
 * Returns authentication logs with pagination and filtering
 *
 * Query params:
 * - page: Page number (default: 1)
 * - page_size: Items per page (default: 50, max: 100)
 * - action: Filter by action (login, logout, signup, password_reset, etc.)
 * - status: Filter by status (success, failure)
 * - user_email: Filter by user email
 * - start_date: Filter logs after this date (ISO string)
 * - end_date: Filter logs before this date (ISO string)
 */
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;
  const { searchParams } = new URL(request.url);

  // Parse query params
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50')));
  const action = searchParams.get('action');
  const status = searchParams.get('status');
  const userEmail = searchParams.get('user_email');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  try {
    // Build query
    let query = supabase
      .from('auth_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (userEmail) {
      query = query.ilike('user_email', `%${userEmail}%`);
    }
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: logs, count, error } = await query;

    if (error) throw error;

    // Get 24h stats
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: statsData, error: statsError } = await supabase
      .from('auth_logs')
      .select('action, status')
      .gte('timestamp', twentyFourHoursAgo);

    if (statsError) throw statsError;

    const stats = {
      logins_24h: (statsData || []).filter(s => s.action === 'login' && s.status === 'success').length,
      failures_24h: (statsData || []).filter(s => s.status === 'failure').length,
      signups_24h: (statsData || []).filter(s => s.action === 'signup' && s.status === 'success').length
    };

    const total = count || 0;
    const hasMore = offset + pageSize < total;

    const response: AuthLogsResponse = {
      logs: (logs || []) as AuthLogEntry[],
      total,
      page,
      page_size: pageSize,
      has_more: hasMore,
      stats
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching auth logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auth logs' },
      { status: 500 }
    );
  }
}
