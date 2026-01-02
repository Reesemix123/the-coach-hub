// /api/teams/[teamId]/tokens/purchase - Purchase additional tokens
// POST: Purchase team or opponent tokens

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

// Token pricing (cents per token)
const TOKEN_PRICING = {
  team: 1200,      // $12.00 per team token
  opponent: 1200,  // $12.00 per opponent token
};

// POST: Purchase tokens
export async function POST(request: NextRequest, context: RouteContext) {
  const { teamId } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check team ownership (only owners can purchase tokens)
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  if (team.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Only team owners can purchase tokens' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: {
    token_type: 'team' | 'opponent';
    quantity: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { token_type, quantity } = body;

  // Validate inputs
  if (!['team', 'opponent'].includes(token_type)) {
    return NextResponse.json(
      { error: 'token_type must be "team" or "opponent"' },
      { status: 400 }
    );
  }

  if (!quantity || quantity < 1 || quantity > 100) {
    return NextResponse.json(
      { error: 'quantity must be between 1 and 100' },
      { status: 400 }
    );
  }

  try {
    // Calculate cost
    const unitPrice = TOKEN_PRICING[token_type];
    const totalCents = unitPrice * quantity;

    // Credit the purchased tokens to token_balance
    const columnToUpdate = token_type === 'team'
      ? 'team_purchased_tokens_available'
      : 'opponent_purchased_tokens_available';

    // Also update the legacy purchased_tokens_available for backward compatibility
    const { data: updatedBalance, error: updateError } = await supabase
      .from('token_balance')
      .update({
        [columnToUpdate]: supabase.rpc('increment_value', {
          column_name: columnToUpdate,
          increment_by: quantity
        }),
        purchased_tokens_available: supabase.rpc('increment_value', {
          column_name: 'purchased_tokens_available',
          increment_by: quantity
        })
      })
      .eq('team_id', teamId)
      .select()
      .single();

    // If update fails (no row exists), do an upsert
    if (updateError) {
      // Try direct increment with raw SQL via RPC
      const { error: rpcError } = await supabase.rpc('credit_purchased_tokens', {
        p_team_id: teamId,
        p_token_type: token_type,
        p_quantity: quantity
      });

      if (rpcError) {
        // Fallback: manual update
        const { data: currentBalance } = await supabase
          .from('token_balance')
          .select('*')
          .eq('team_id', teamId)
          .single();

        if (currentBalance) {
          const currentValue = token_type === 'team'
            ? currentBalance.team_purchased_tokens_available || 0
            : currentBalance.opponent_purchased_tokens_available || 0;

          const currentLegacy = currentBalance.purchased_tokens_available || 0;

          await supabase
            .from('token_balance')
            .update({
              [columnToUpdate]: currentValue + quantity,
              purchased_tokens_available: currentLegacy + quantity
            })
            .eq('team_id', teamId);
        } else {
          // Create new token_balance record
          const newBalance: Record<string, unknown> = {
            team_id: teamId,
            subscription_tokens_available: 0,
            subscription_tokens_used_this_period: 0,
            purchased_tokens_available: quantity,
            team_subscription_tokens_available: 0,
            team_subscription_tokens_used_this_period: 0,
            team_purchased_tokens_available: token_type === 'team' ? quantity : 0,
            opponent_subscription_tokens_available: 0,
            opponent_subscription_tokens_used_this_period: 0,
            opponent_purchased_tokens_available: token_type === 'opponent' ? quantity : 0,
          };

          await supabase
            .from('token_balance')
            .insert(newBalance);
        }
      }
    }

    // Log the transaction
    await supabase.from('token_transactions').insert({
      team_id: teamId,
      transaction_type: 'purchase',
      amount: quantity,
      source: `${token_type}_purchased`,
      game_type: token_type,
      performed_by_user_id: user.id,
      notes: `Purchased ${quantity} ${token_type} token${quantity !== 1 ? 's' : ''} for $${(totalCents / 100).toFixed(2)}`
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'tokens.purchased',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        token_type,
        quantity,
        unit_price_cents: unitPrice,
        total_cents: totalCents
      }
    });

    // Get updated balance
    const { data: newBalance } = await supabase
      .from('token_balance')
      .select('*')
      .eq('team_id', teamId)
      .single();

    return NextResponse.json({
      success: true,
      token_type,
      quantity,
      total_cents: totalCents,
      balance: newBalance ? {
        teamAvailable: (newBalance.team_subscription_tokens_available || 0) +
                       (newBalance.team_purchased_tokens_available || 0),
        opponentAvailable: (newBalance.opponent_subscription_tokens_available || 0) +
                           (newBalance.opponent_purchased_tokens_available || 0),
        totalAvailable: (newBalance.subscription_tokens_available || 0) +
                        (newBalance.purchased_tokens_available || 0)
      } : null
    });
  } catch (error) {
    console.error('Error purchasing tokens:', error);
    return NextResponse.json(
      { error: 'Failed to purchase tokens' },
      { status: 500 }
    );
  }
}

// GET: Get token pricing
export async function GET(request: NextRequest, context: RouteContext) {
  const { teamId } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check team access
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const isOwner = team.user_id === user.id;

  const { data: membership } = await supabase
    .from('team_memberships')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!isOwner && !membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({
    pricing: TOKEN_PRICING,
    isOwner
  });
}
