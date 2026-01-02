# Designated Tokens Testing Guide

This document provides testing steps for the designated tokens feature, which separates film upload tokens into **Team Film Tokens** and **Opponent Scouting Tokens**.

## Prerequisites

1. Run migration 115 (designated tokens schema) in Supabase SQL Editor
2. Run migration 116 (credit_purchased_tokens function) in Supabase SQL Editor
3. Have a test team with an active subscription

---

## Migration Verification

### Test 1: Verify Schema Changes

```sql
-- Check token_balance has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'token_balance'
ORDER BY ordinal_position;

-- Expected new columns:
-- team_subscription_tokens_available
-- team_subscription_tokens_used_this_period
-- team_purchased_tokens_available
-- opponent_subscription_tokens_available
-- opponent_subscription_tokens_used_this_period
-- opponent_purchased_tokens_available
```

### Test 2: Verify Tier Config Updates

```sql
SELECT tier_key, monthly_team_tokens, monthly_opponent_tokens,
       team_token_rollover_cap, opponent_token_rollover_cap
FROM tier_config;

-- Expected:
-- basic:   1 team, 1 opponent, 2 cap each
-- plus:    2 team, 2 opponent, 4 cap each
-- premium: 4 team, 4 opponent, 8 cap each
```

### Test 3: Verify Functions Exist

```sql
-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('consume_designated_token', 'credit_purchased_tokens', 'get_designated_token_balance');
```

---

## UI Testing - Film Page

### Test 4: Token Balance Banner Display

1. Navigate to `/teams/{teamId}/film`
2. **Verify**: Token banner shows two separate counts:
   - Blue icon + "X team"
   - Orange icon + "X opponent"
3. **Verify**: Banner turns amber if either token type is at 0 or 1

### Test 5: Team Game Token Gating

1. Navigate to Film page, filter to "Own Team" games
2. If team tokens = 0:
   - **Verify**: "Add Game" button is disabled
   - **Verify**: Message shows "No team film tokens available"
   - **Verify**: Hint shows remaining opponent tokens if available
3. If team tokens > 0:
   - **Verify**: "Add Game" button is enabled
   - Click "Add Game" and create a game
   - **Verify**: Team token count decreases by 1
   - **Verify**: Opponent token count unchanged

### Test 6: Opponent Game Token Gating

1. Navigate to Film page, filter to "Opponent Scouting" games
2. If opponent tokens = 0:
   - **Verify**: "Add Game" button is disabled
   - **Verify**: Message shows "No opponent scouting tokens available"
   - **Verify**: Hint shows remaining team tokens if available
3. If opponent tokens > 0:
   - **Verify**: "Add Game" button is enabled
   - Click "Add Game" and create an opponent scouting game
   - **Verify**: Opponent token count decreases by 1
   - **Verify**: Team token count unchanged

### Test 7: Cross-Token Independence

1. Use all team tokens (create team games until team tokens = 0)
2. **Verify**: Can still create opponent scouting games
3. Reset and use all opponent tokens
4. **Verify**: Can still create team games

---

## UI Testing - Addons/Purchase Page

### Test 8: Token Balance Display

1. Navigate to `/teams/{teamId}/settings/addons`
2. **Verify**: "Your Token Balance" section shows:
   - Team Film Tokens count (blue card)
   - Opponent Scouting Tokens count (orange card)

### Test 9: Token Purchase UI

1. **Verify**: "Purchase Film Upload Tokens" section displays with two cards
2. **Verify**: Team tokens show $12.00/token pricing
3. **Verify**: Opponent tokens show $12.00/token pricing
4. **Verify**: +/- buttons work to adjust quantity
5. **Verify**: Total price updates dynamically

### Test 10: Purchase Team Tokens

1. Set team token quantity to 2
2. **Verify**: Total shows $24.00
3. Click "Purchase Team Tokens"
4. **Verify**: Success message appears
5. **Verify**: Team token balance increases by 2
6. **Verify**: Opponent token balance unchanged
7. **Verify**: Quantity resets to 0

### Test 11: Purchase Opponent Tokens

1. Set opponent token quantity to 3
2. **Verify**: Total shows $36.00
3. Click "Purchase Opponent Tokens"
4. **Verify**: Success message appears
5. **Verify**: Opponent token balance increases by 3
6. **Verify**: Team token balance unchanged

---

## API Testing

### Test 12: GET /api/tokens

```bash
curl -X GET "http://localhost:3000/api/tokens?team_id={TEAM_ID}" \
  -H "Cookie: {AUTH_COOKIE}"
```

**Verify response includes**:
```json
{
  "balance": {
    "teamAvailable": 2,
    "opponentAvailable": 1,
    "totalAvailable": 3,
    "teamUsedThisPeriod": 1,
    "opponentUsedThisPeriod": 2,
    "monthlyTeamAllocation": 2,
    "monthlyOpponentAllocation": 2
  }
}
```

### Test 13: POST /api/tokens/consume (Team)

```bash
curl -X POST "http://localhost:3000/api/tokens/consume" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "team_id": "{TEAM_ID}",
    "game_id": "{GAME_ID}",
    "game_type": "team"
  }'
```

**Verify**:
- Returns `success: true`
- `remainingTeam` decreased by 1
- `remainingOpponent` unchanged

### Test 14: POST /api/tokens/consume (Opponent)

```bash
curl -X POST "http://localhost:3000/api/tokens/consume" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "team_id": "{TEAM_ID}",
    "game_id": "{GAME_ID}",
    "game_type": "opponent"
  }'
```

**Verify**:
- Returns `success: true`
- `remainingOpponent` decreased by 1
- `remainingTeam` unchanged

### Test 15: POST /api/teams/{teamId}/tokens/purchase

```bash
curl -X POST "http://localhost:3000/api/teams/{TEAM_ID}/tokens/purchase" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "token_type": "team",
    "quantity": 2
  }'
```

**Verify**:
- Returns `success: true`
- `balance.teamAvailable` increased by 2

---

## Database Function Testing

### Test 16: consume_designated_token Function

```sql
-- Test consuming a team token
SELECT consume_designated_token(
  '{TEAM_ID}'::uuid,
  '{GAME_ID}'::uuid,
  'team',
  '{USER_ID}'::uuid
);

-- Verify response
-- { "success": true, "source": "team_subscription", "remaining_team": X, "remaining_opponent": Y }

-- Check token_balance was updated
SELECT team_subscription_tokens_available, opponent_subscription_tokens_available
FROM token_balance
WHERE team_id = '{TEAM_ID}';
```

### Test 17: credit_purchased_tokens Function

```sql
-- Credit 3 team tokens
SELECT credit_purchased_tokens(
  '{TEAM_ID}'::uuid,
  'team',
  3
);

-- Verify token_balance
SELECT team_purchased_tokens_available, opponent_purchased_tokens_available
FROM token_balance
WHERE team_id = '{TEAM_ID}';
```

### Test 18: Token Transaction Logging

```sql
-- Check transactions are logged with game_type
SELECT id, transaction_type, amount, source, game_type, notes
FROM token_transactions
WHERE team_id = '{TEAM_ID}'
ORDER BY created_at DESC
LIMIT 10;

-- Verify game_type is populated for consume transactions
```

---

## Edge Cases

### Test 19: No Token Balance Record

1. Create a new team (no token_balance row exists)
2. Try to purchase tokens
3. **Verify**: Token balance record is created
4. **Verify**: Purchased tokens are credited correctly

### Test 20: Token Consumption Priority

1. Have both subscription and purchased tokens for a type
2. Consume a token
3. **Verify**: Subscription tokens are consumed first (before purchased)
4. **Verify**: Transaction log shows correct source

### Test 21: Insufficient Tokens

1. Set team tokens to 0 (use all)
2. Try to create a team game via Film page
3. **Verify**: Modal shows block message with link to purchase
4. Try API call to consume team token
5. **Verify**: Returns error "No team tokens available"

### Test 22: Invalid Game Type

```sql
-- Try invalid game_type
SELECT consume_designated_token(
  '{TEAM_ID}'::uuid,
  '{GAME_ID}'::uuid,
  'invalid',
  NULL
);

-- Should return: { "success": false, "error": "Invalid game_type..." }
```

---

## Regression Testing

### Test 23: Legacy Token Display

1. **Verify**: TokenBalanceCard component still works
2. **Verify**: useTokenBalance hook returns all expected fields

### Test 24: Schedule Page Games

1. Create a game from Schedule page (not Film page)
2. **Verify**: No token is consumed (schedule games don't consume tokens)
3. **Verify**: Game appears in Film page list

### Test 25: Subscription Renewal

```sql
-- Simulate subscription renewal
SELECT refresh_subscription_tokens(
  '{TEAM_ID}'::uuid,
  'plus',
  NOW(),
  NOW() + INTERVAL '30 days'
);

-- Verify both token types are refreshed
SELECT team_subscription_tokens_available, opponent_subscription_tokens_available
FROM token_balance
WHERE team_id = '{TEAM_ID}';
```

---

## Checklist Summary

- [ ] Migration 115 runs without errors
- [ ] Migration 116 runs without errors
- [ ] Token balance shows team/opponent split on Film page
- [ ] Team games consume only team tokens
- [ ] Opponent games consume only opponent tokens
- [ ] Addons page shows current token balance
- [ ] Can purchase team tokens
- [ ] Can purchase opponent tokens
- [ ] Token counts update immediately after purchase
- [ ] Blocking messages show when tokens exhausted
- [ ] Hints show availability of other token type
- [ ] Transaction logs include game_type
- [ ] Legacy totalAvailable still works for backward compatibility
