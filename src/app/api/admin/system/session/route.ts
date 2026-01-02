// /api/admin/system/session - Session Settings API
// Manages session timeout configuration for the platform
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getConfig, setConfig } from '@/lib/admin/config';

const CONFIG_KEY = 'session_settings';

interface SessionSettings {
  timeout_minutes: number;  // Default: 180 (3 hours)
  warning_minutes: number;  // Minutes before timeout to show warning. Default: 5
  enabled: boolean;         // Whether session timeout is enabled
}

const DEFAULT_SETTINGS: SessionSettings = {
  timeout_minutes: 180,  // 3 hours
  warning_minutes: 5,
  enabled: true,
};

/**
 * GET /api/admin/system/session
 * Returns session timeout settings
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const settings = await getConfig<SessionSettings>(CONFIG_KEY);

    return NextResponse.json({
      settings: settings || DEFAULT_SETTINGS
    });

  } catch (error) {
    console.error('Error fetching session settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system/session
 * Update session timeout settings
 *
 * Request body: { timeout_minutes: number, warning_minutes: number, enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { timeout_minutes, warning_minutes, enabled } = body;

    // Validate inputs
    if (timeout_minutes !== undefined) {
      if (typeof timeout_minutes !== 'number' || timeout_minutes < 15 || timeout_minutes > 1440) {
        return NextResponse.json(
          { error: 'timeout_minutes must be between 15 and 1440 (24 hours)' },
          { status: 400 }
        );
      }
    }

    if (warning_minutes !== undefined) {
      if (typeof warning_minutes !== 'number' || warning_minutes < 1 || warning_minutes > 30) {
        return NextResponse.json(
          { error: 'warning_minutes must be between 1 and 30' },
          { status: 400 }
        );
      }
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    // Get current settings
    const currentSettings = await getConfig<SessionSettings>(CONFIG_KEY) || DEFAULT_SETTINGS;

    // Merge with new values
    const newSettings: SessionSettings = {
      timeout_minutes: timeout_minutes ?? currentSettings.timeout_minutes,
      warning_minutes: warning_minutes ?? currentSettings.warning_minutes,
      enabled: enabled ?? currentSettings.enabled,
    };

    // Validate warning is less than timeout
    if (newSettings.warning_minutes >= newSettings.timeout_minutes) {
      return NextResponse.json(
        { error: 'warning_minutes must be less than timeout_minutes' },
        { status: 400 }
      );
    }

    // Save settings
    await setConfig(
      CONFIG_KEY,
      newSettings,
      'Session timeout configuration',
      auth.admin.id
    );

    // Log admin action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'update_session_settings',
      'platform_config',
      CONFIG_KEY,
      'Session Settings',
      {
        previous: currentSettings,
        new: newSettings,
      }
    );

    return NextResponse.json({
      success: true,
      settings: newSettings
    });

  } catch (error) {
    console.error('Error updating session settings:', error);
    return NextResponse.json(
      { error: 'Failed to update session settings' },
      { status: 500 }
    );
  }
}
