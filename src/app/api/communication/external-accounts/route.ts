/**
 * API: /api/communication/external-accounts
 *
 * GET    - Return the current user's connected external platform accounts.
 *          Currently only Vimeo is supported.
 *
 * DELETE - Disconnect an external platform account.
 *          Requires ?platform=vimeo query parameter.
 *          Marks the record as 'disconnected' (does not delete it, preserving
 *          historical external_video_shares references).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  getVimeoAccount,
  disconnectVimeo,
} from '@/lib/services/communication/vimeo.service';

const SUPPORTED_PLATFORMS = ['vimeo'] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

// ============================================================================
// GET — List connected external accounts
// ============================================================================

export async function GET(request: NextRequest) {
  // Consume request to satisfy Next.js App Router conventions
  void request;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vimeoAccount = await getVimeoAccount(user.id);

    return NextResponse.json({
      accounts: {
        vimeo: vimeoAccount
          ? {
              connected: vimeoAccount.status === 'active',
              accountName: vimeoAccount.platform_account_name,
              accountId: vimeoAccount.platform_account_id,
              connectedAt: vimeoAccount.connected_at,
              status: vimeoAccount.status,
              tokenExpiresAt: vimeoAccount.token_expires_at,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching external accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// ============================================================================
// DELETE — Disconnect an external account
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform || !SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform)) {
      return NextResponse.json(
        { error: `platform is required and must be one of: ${SUPPORTED_PLATFORMS.join(', ')}` },
        { status: 400 },
      );
    }

    if (platform === 'vimeo') {
      await disconnectVimeo(user.id);
      return NextResponse.json({ success: true });
    }

    // Unreachable given the guard above, but satisfies TypeScript exhaustiveness
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  } catch (error) {
    console.error('Error disconnecting external account:', error);
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 });
  }
}
