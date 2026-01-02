// /api/config/session-timeout - Public Session Timeout Config API
// Returns session timeout settings for client-side session management
// No authentication required - returns only non-sensitive configuration

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface SessionSettings {
  timeout_minutes: number;
  warning_minutes: number;
  enabled: boolean;
}

const DEFAULT_SETTINGS: SessionSettings = {
  timeout_minutes: 180,  // 3 hours
  warning_minutes: 5,
  enabled: true,
};

/**
 * GET /api/config/session-timeout
 * Returns session timeout configuration for client-side use
 * Public endpoint - no authentication required
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'session_settings')
      .single();

    if (error) {
      // If not found, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json(DEFAULT_SETTINGS);
      }
      console.error('Error fetching session settings:', error);
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const settings = data?.value as SessionSettings;

    return NextResponse.json({
      timeout_minutes: settings?.timeout_minutes ?? DEFAULT_SETTINGS.timeout_minutes,
      warning_minutes: settings?.warning_minutes ?? DEFAULT_SETTINGS.warning_minutes,
      enabled: settings?.enabled ?? DEFAULT_SETTINGS.enabled,
    });

  } catch (error) {
    console.error('Error fetching session timeout config:', error);
    // Return defaults on error - don't break the app
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}
