// /api/admin/logs/audit - Audit Logs API
// Returns admin action audit logs for platform admins
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, unknown> | null;
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * GET /api/admin/logs/audit
 * Returns audit logs with pagination and filtering
 *
 * Query params:
 * - page: Page number (default: 1)
 * - page_size: Items per page (default: 50, max: 100)
 * - action: Filter by action type
 * - actor_id: Filter by actor (admin user)
 * - target_type: Filter by target type
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
  const actorId = searchParams.get('actor_id');
  const targetType = searchParams.get('target_type');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  try {
    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }
    if (actorId) {
      query = query.eq('actor_id', actorId);
    }
    if (targetType) {
      query = query.eq('target_type', targetType);
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

    const total = count || 0;
    const hasMore = offset + pageSize < total;

    const response: AuditLogsResponse = {
      logs: (logs || []) as AuditLogEntry[],
      total,
      page,
      page_size: pageSize,
      has_more: hasMore
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
