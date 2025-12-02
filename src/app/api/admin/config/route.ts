// /api/admin/config - Platform Configuration API
// GET: Retrieve all configuration values
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getAllConfig } from '@/lib/admin/config';

/**
 * GET /api/admin/config
 * Returns all platform configuration values.
 * Requires platform admin authentication.
 */
export async function GET() {
  // Verify admin access
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const configs = await getAllConfig();

    return NextResponse.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error fetching platform config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}
