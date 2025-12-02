// /api/admin/config/[key] - Individual Configuration Value API
// GET: Retrieve a single configuration value
// PUT: Update a configuration value
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getConfig, setConfig, validateConfigValue } from '@/lib/admin/config';

interface RouteContext {
  params: Promise<{ key: string }>;
}

/**
 * GET /api/admin/config/[key]
 * Returns a single configuration value by key.
 * Requires platform admin authentication.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Verify admin access
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { key } = await context.params;

  try {
    const value = await getConfig(key);

    if (value === null) {
      return NextResponse.json(
        { success: false, error: `Configuration key "${key}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        key,
        value
      }
    });
  } catch (error) {
    console.error(`Error fetching config key "${key}":`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/config/[key]
 * Updates a configuration value.
 * Requires platform admin authentication.
 *
 * Request body:
 * {
 *   value: any,        // The new configuration value
 *   description?: string  // Optional description for the config
 * }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  // Verify admin access
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { key } = await context.params;

  // Parse request body
  let body: { value: unknown; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate request
  if (body.value === undefined) {
    return NextResponse.json(
      { success: false, error: "Missing required field: 'value'" },
      { status: 400 }
    );
  }

  // Validate the config value based on known keys
  const validationError = validateConfigValue(key, body.value);
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError },
      { status: 400 }
    );
  }

  try {
    // Get old value for audit log
    const oldValue = await getConfig(key);

    // Update the config
    const config = await setConfig(
      key,
      body.value,
      body.description,
      auth.admin.id
    );

    // Log the action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'config.updated',
      'config',
      key,
      key,
      {
        old_value: oldValue,
        new_value: body.value
      }
    );

    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error(`Error updating config key "${key}":`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
