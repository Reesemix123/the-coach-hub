// /api/admin/system/feature-flags - Feature Flags API
// Manages feature flags for the platform
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getConfig, setConfig } from '@/lib/admin/config';

const CONFIG_KEY = 'feature_flags';

interface FeatureFlags {
  [key: string]: boolean;
}

/**
 * GET /api/admin/system/feature-flags
 * Returns all feature flags
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const flags = await getConfig<FeatureFlags>(CONFIG_KEY);

    return NextResponse.json({
      flags: flags || {}
    });

  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system/feature-flags
 * Create a new feature flag
 *
 * Request body: { flag: string, enabled: boolean }
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { flag, enabled } = body;

    if (!flag || typeof flag !== 'string') {
      return NextResponse.json(
        { error: 'Flag name is required' },
        { status: 400 }
      );
    }

    // Validate flag name (alphanumeric and underscores only)
    if (!/^[a-z][a-z0-9_]*$/.test(flag)) {
      return NextResponse.json(
        { error: 'Flag name must start with a letter and contain only lowercase letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    const currentFlags = await getConfig<FeatureFlags>(CONFIG_KEY) || {};

    if (currentFlags[flag] !== undefined) {
      return NextResponse.json(
        { error: 'Flag already exists' },
        { status: 400 }
      );
    }

    const updatedFlags = { ...currentFlags, [flag]: enabled ?? false };

    await setConfig(
      CONFIG_KEY,
      updatedFlags,
      'Feature flags configuration',
      auth.admin.id
    );

    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'feature_flag.created',
      'config',
      undefined,
      flag,
      { enabled: enabled ?? false }
    );

    return NextResponse.json({ success: true, flags: updatedFlags });

  } catch (error) {
    console.error('Error creating feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to create feature flag' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system/feature-flags
 * Update a feature flag
 *
 * Request body: { flag: string, enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { flag, enabled } = body;

    if (!flag || typeof flag !== 'string') {
      return NextResponse.json(
        { error: 'Flag name is required' },
        { status: 400 }
      );
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled must be a boolean' },
        { status: 400 }
      );
    }

    const currentFlags = await getConfig<FeatureFlags>(CONFIG_KEY) || {};
    const updatedFlags = { ...currentFlags, [flag]: enabled };

    await setConfig(
      CONFIG_KEY,
      updatedFlags,
      'Feature flags configuration',
      auth.admin.id
    );

    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'feature_flag.updated',
      'config',
      undefined,
      flag,
      { enabled }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/system/feature-flags
 * Delete a feature flag
 *
 * Request body: { flag: string }
 */
export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { flag } = body;

    if (!flag || typeof flag !== 'string') {
      return NextResponse.json(
        { error: 'Flag name is required' },
        { status: 400 }
      );
    }

    const currentFlags = await getConfig<FeatureFlags>(CONFIG_KEY) || {};

    if (currentFlags[flag] === undefined) {
      return NextResponse.json(
        { error: 'Flag not found' },
        { status: 404 }
      );
    }

    const { [flag]: removed, ...remainingFlags } = currentFlags;

    await setConfig(
      CONFIG_KEY,
      remainingFlags,
      'Feature flags configuration',
      auth.admin.id
    );

    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'feature_flag.deleted',
      'config',
      undefined,
      flag,
      { previousValue: removed }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}
