// /api/cron/expire-games - Game Expiration Cron Job
// Called daily to lock expired games
// Secured with Vercel cron header or CRON_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for cron operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase service role configuration missing');
  }

  return createClient(url, serviceKey);
}

// Verify the request is from Vercel Cron or has valid CRON_SECRET
function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron sends this header automatically
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader) {
    return true;
  }

  // Fallback: check CRON_SECRET for manual triggers or other cron services
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret configured, only allow Vercel cron
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = getServiceClient();

    // Run the expiration function
    const { data, error } = await supabase.rpc('expire_old_games');

    if (error) {
      console.error('Failed to expire games:', error);
      return NextResponse.json(
        { error: 'Failed to expire games', details: error.message },
        { status: 500 }
      );
    }

    const expiredGames = data || [];

    // Log audit events for expired games
    if (expiredGames.length > 0) {
      const auditLogs = expiredGames.map((game: {
        team_id: string;
        game_id: string;
        game_name: string;
        expired_at: string;
      }) => ({
        action: 'game.expired',
        target_type: 'game',
        target_id: game.game_id,
        metadata: {
          team_id: game.team_id,
          game_name: game.game_name,
          expired_at: game.expired_at
        }
      }));

      await supabase.from('audit_logs').insert(auditLogs);
    }

    console.log(`Expired ${expiredGames.length} games`);

    return NextResponse.json({
      success: true,
      gamesExpired: expiredGames.length,
      games: expiredGames.map((g: { game_id: string; game_name: string }) => ({
        id: g.game_id,
        name: g.game_name
      }))
    });

  } catch (err) {
    console.error('Cron job error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET for Vercel Cron (Vercel crons use GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
