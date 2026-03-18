/**
 * API: /api/communication/parents/validate-token
 * GET - Validate a parent invitation token (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client — this endpoint is public (token-based access)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, serviceKey);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Fetch invitation by token
    const { data: inv, error: invError } = await supabase
      .from('parent_invitations')
      .select('id, team_id, player_id, parent_email, parent_name, relationship, status, token_expires_at')
      .eq('invitation_token', token)
      .single();

    if (invError || !inv) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    // Check expiry
    if (new Date(inv.token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired. Please ask the coach to resend it.' }, { status: 410 });
    }

    if (inv.status === 'accepted') {
      return NextResponse.json({ error: 'This invitation has already been accepted. Please sign in.' }, { status: 410 });
    }

    if (inv.status === 'revoked') {
      return NextResponse.json({ error: 'This invitation has been revoked. Please contact the coach.' }, { status: 410 });
    }

    // Get team and player names
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', inv.team_id)
      .single();

    const { data: player } = await supabase
      .from('players')
      .select('first_name, last_name')
      .eq('id', inv.player_id)
      .single();

    return NextResponse.json({
      invitation: {
        id: inv.id,
        team_id: inv.team_id,
        player_id: inv.player_id,
        parent_email: inv.parent_email,
        parent_name: inv.parent_name,
        relationship: inv.relationship,
        status: inv.status,
        team_name: team?.name || null,
        player_name: player ? `${player.first_name} ${player.last_name}` : null,
      },
    });
  } catch (error) {
    console.error('Error validating invitation token:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}
