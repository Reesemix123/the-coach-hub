/**
 * Error Report API Route
 *
 * Receives client-side error reports and logs them to Supabase
 * using the existing logging.service.ts infrastructure.
 *
 * @module api/errors/report
 * @since Phase 4 - Hardening
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError, type ErrorSeverity } from '@/lib/services/logging.service';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max errors per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT) {
    return true;
  }

  entry.count++;
  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429 }
      );
    }

    const body = await request.json();

    const {
      severity,
      code,
      message,
      stack,
      metadata,
      source,
      timestamp,
      url,
      userAgent,
    } = body;

    // Validate required fields
    if (!severity || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Log to database using existing service
    await logError({
      severity: severity as ErrorSeverity,
      message: `[${code || 'client'}] ${message}`,
      stackTrace: stack,
      metadata: {
        ...metadata,
        clientTimestamp: timestamp,
        clientUrl: url,
        clientUserAgent: userAgent,
      },
      source: source || 'client',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error report failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
