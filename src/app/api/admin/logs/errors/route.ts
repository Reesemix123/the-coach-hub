// /api/admin/logs/errors - Error Logs API
// Returns application error logs for platform admins
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  stack_trace: string | null;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  source: string | null;
  endpoint: string | null;
}

interface ErrorLogsResponse {
  logs: ErrorLogEntry[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  stats: {
    errors_24h: number;
    warnings_24h: number;
    info_24h: number;
  };
}

/**
 * GET /api/admin/logs/errors
 * Returns error logs with pagination and filtering
 *
 * Query params:
 * - page: Page number (default: 1)
 * - page_size: Items per page (default: 50, max: 100)
 * - severity: Filter by severity (error, warning, info)
 * - source: Filter by source (api, webhook, cron, client)
 * - start_date: Filter logs after this date (ISO string)
 * - end_date: Filter logs before this date (ISO string)
 * - search: Search in message text
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
  const severity = searchParams.get('severity');
  const source = searchParams.get('source');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const search = searchParams.get('search');

  try {
    // Build query
    let query = supabase
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (source) {
      query = query.eq('source', source);
    }
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }
    if (search) {
      query = query.ilike('message', `%${search}%`);
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
      .from('error_logs')
      .select('severity')
      .gte('timestamp', twentyFourHoursAgo);

    if (statsError) throw statsError;

    const stats = {
      errors_24h: (statsData || []).filter(s => s.severity === 'error').length,
      warnings_24h: (statsData || []).filter(s => s.severity === 'warning').length,
      info_24h: (statsData || []).filter(s => s.severity === 'info').length
    };

    const total = count || 0;
    const hasMore = offset + pageSize < total;

    const response: ErrorLogsResponse = {
      logs: (logs || []) as ErrorLogEntry[],
      total,
      page,
      page_size: pageSize,
      has_more: hasMore,
      stats
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching error logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}
