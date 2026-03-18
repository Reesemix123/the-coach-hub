/**
 * API: /api/cron/mux-cleanup
 * POST/GET — Delete expired Mux assets on a daily schedule.
 *
 * Security: Requires either the Vercel-injected `x-vercel-cron` header or a
 * `Bearer <CRON_SECRET>` Authorization header. When neither is present the
 * request is rejected with 401.
 *
 * Processing: Fetches up to 50 `mux_cleanup_queue` rows with
 * `status = 'pending'` and `scheduled_cleanup_at <= now`, attempts to delete
 * each Mux asset, and marks the row `completed`. A 404 from Mux is treated as
 * a successful deletion (asset was already removed).
 *
 * GET is aliased to POST so that Vercel Cron (which uses GET by default) works
 * without additional configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';

// ============================================================================
// Auth helper
// ============================================================================

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron injects this header automatically — no secret needed.
  if (request.headers.get('x-vercel-cron')) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // No secret configured and no Vercel header → deny.
    return false;
  }

  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Fetch pending entries that are due for cleanup (batch of 50).
    const { data: entries, error: fetchError } = await supabase
      .from('mux_cleanup_queue')
      .select('id, mux_asset_id')
      .eq('status', 'pending')
      .lte('scheduled_cleanup_at', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error('[MuxCleanup] Failed to fetch queue:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch cleanup queue' },
        { status: 500 }
      );
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ message: 'No assets to clean up', processed: 0 });
    }

    // Lazily initialise the Mux client only when there is real work to do.
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!tokenId || !tokenSecret) {
      console.error('[MuxCleanup] Mux credentials not configured');
      return NextResponse.json(
        { error: 'Mux credentials not configured' },
        { status: 503 }
      );
    }

    const Mux = (await import('@mux/mux-node')).default;
    const mux = new Mux({ tokenId, tokenSecret });

    let deleted = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const entry of entries) {
      try {
        await mux.video.assets.delete(entry.mux_asset_id);

        await supabase
          .from('mux_cleanup_queue')
          .update({ status: 'completed', cleaned_up_at: now })
          .eq('id', entry.id);

        deleted++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        // 404 means the asset no longer exists in Mux — mark it complete.
        if (message.includes('404') || message.toLowerCase().includes('not found')) {
          await supabase
            .from('mux_cleanup_queue')
            .update({ status: 'completed', cleaned_up_at: now })
            .eq('id', entry.id);

          deleted++;
        } else {
          console.error(
            `[MuxCleanup] Failed to delete asset ${entry.mux_asset_id}:`,
            message
          );
          failed++;
        }
      }
    }

    console.log(
      `[MuxCleanup] Processed ${entries.length}: ${deleted} deleted, ${failed} failed`
    );

    return NextResponse.json({
      message: `Processed ${entries.length} assets`,
      processed: entries.length,
      deleted,
      failed,
    });
  } catch (error) {
    console.error('[MuxCleanup] Unexpected error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}

// Vercel Cron uses GET by default.
export async function GET(request: NextRequest) {
  return POST(request);
}
