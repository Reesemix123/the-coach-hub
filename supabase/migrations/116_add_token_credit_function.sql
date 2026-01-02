-- Migration 116: Add function to credit purchased tokens
-- This function safely adds purchased tokens to a team's balance

CREATE OR REPLACE FUNCTION credit_purchased_tokens(
  p_team_id UUID,
  p_token_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
  v_new_team INTEGER;
  v_new_opponent INTEGER;
BEGIN
  -- Validate inputs
  IF p_token_type NOT IN ('team', 'opponent') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'token_type must be "team" or "opponent"'
    );
  END IF;

  IF p_quantity < 1 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'quantity must be at least 1'
    );
  END IF;

  -- Get current balance (or create if doesn't exist)
  SELECT * INTO v_balance
  FROM token_balance
  WHERE team_id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create new balance record
    INSERT INTO token_balance (
      team_id,
      subscription_tokens_available,
      subscription_tokens_used_this_period,
      purchased_tokens_available,
      team_subscription_tokens_available,
      team_subscription_tokens_used_this_period,
      team_purchased_tokens_available,
      opponent_subscription_tokens_available,
      opponent_subscription_tokens_used_this_period,
      opponent_purchased_tokens_available
    ) VALUES (
      p_team_id,
      0, 0,
      p_quantity,
      0, 0,
      CASE WHEN p_token_type = 'team' THEN p_quantity ELSE 0 END,
      0, 0,
      CASE WHEN p_token_type = 'opponent' THEN p_quantity ELSE 0 END
    );

    v_new_team := CASE WHEN p_token_type = 'team' THEN p_quantity ELSE 0 END;
    v_new_opponent := CASE WHEN p_token_type = 'opponent' THEN p_quantity ELSE 0 END;
  ELSE
    -- Update existing balance
    IF p_token_type = 'team' THEN
      UPDATE token_balance SET
        team_purchased_tokens_available = COALESCE(team_purchased_tokens_available, 0) + p_quantity,
        purchased_tokens_available = COALESCE(purchased_tokens_available, 0) + p_quantity
      WHERE team_id = p_team_id;

      v_new_team := COALESCE(v_balance.team_subscription_tokens_available, 0) +
                    COALESCE(v_balance.team_purchased_tokens_available, 0) + p_quantity;
      v_new_opponent := COALESCE(v_balance.opponent_subscription_tokens_available, 0) +
                        COALESCE(v_balance.opponent_purchased_tokens_available, 0);
    ELSE
      UPDATE token_balance SET
        opponent_purchased_tokens_available = COALESCE(opponent_purchased_tokens_available, 0) + p_quantity,
        purchased_tokens_available = COALESCE(purchased_tokens_available, 0) + p_quantity
      WHERE team_id = p_team_id;

      v_new_team := COALESCE(v_balance.team_subscription_tokens_available, 0) +
                    COALESCE(v_balance.team_purchased_tokens_available, 0);
      v_new_opponent := COALESCE(v_balance.opponent_subscription_tokens_available, 0) +
                        COALESCE(v_balance.opponent_purchased_tokens_available, 0) + p_quantity;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'team_available', v_new_team,
    'opponent_available', v_new_opponent
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION credit_purchased_tokens TO authenticated;
