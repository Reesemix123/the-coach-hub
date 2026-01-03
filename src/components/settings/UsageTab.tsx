'use client';

import { useState, useEffect } from 'react';
import { Upload, Film, Play, Users, Plus, Minus, Loader2, Check, AlertCircle, ShoppingCart } from 'lucide-react';

interface TokenBalance {
  subscription_tokens_available: number;
  subscription_tokens_used_this_period: number;
  purchased_tokens_available: number;
  // Designated token breakdown
  teamAvailable: number;
  teamUsedThisPeriod: number;
  opponentAvailable: number;
  opponentUsedThisPeriod: number;
  monthlyTeamAllocation: number;
  monthlyOpponentAllocation: number;
}

interface UsageStats {
  games_count: number;
  plays_count: number;
  players_count: number;
  members_count: number;
}

interface UsageTabProps {
  teamId: string;
  isOwner: boolean;
}

const TOKEN_PRICE_CENTS = 1200; // $12.00 per token

export default function UsageTab({ teamId, isOwner }: UsageTabProps) {
  const [loading, setLoading] = useState(true);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [tokenAllocation, setTokenAllocation] = useState(4);

  // Purchase state
  const [tokensToPurchase, setTokensToPurchase] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      // Fetch both endpoints in parallel for faster loading
      const [teamResponse, tokenResponse] = await Promise.all([
        fetch(`/api/console/teams/${teamId}`),
        fetch(`/api/tokens?team_id=${teamId}`),
      ]);

      if (teamResponse.ok) {
        const data = await teamResponse.json();
        setUsage(data.usage);
        setTokenAllocation(data.upload_tokens?.allocation || 4);
      }

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        setTokenBalance({
          subscription_tokens_available: tokenData.balance?.subscriptionAvailable ?? 0,
          subscription_tokens_used_this_period: tokenData.balance?.subscriptionUsed ?? 0,
          purchased_tokens_available: tokenData.balance?.purchasedAvailable ?? 0,
          // Designated token breakdown
          teamAvailable: tokenData.balance?.teamAvailable ?? 0,
          teamUsedThisPeriod: tokenData.balance?.teamUsedThisPeriod ?? 0,
          opponentAvailable: tokenData.balance?.opponentAvailable ?? 0,
          opponentUsedThisPeriod: tokenData.balance?.opponentUsedThisPeriod ?? 0,
          monthlyTeamAllocation: tokenData.balance?.monthlyTeamAllocation ?? 0,
          monthlyOpponentAllocation: tokenData.balance?.monthlyOpponentAllocation ?? 0,
        });
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (tokensToPurchase < 1) return;

    setPurchasing(true);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/tokens/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_type: 'team',
          quantity: tokensToPurchase,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to purchase tokens');
      }

      const result = await response.json();

      // Check if we need to redirect to Stripe checkout
      if (result.redirect && result.url) {
        // Redirect to Stripe checkout page
        window.location.href = result.url;
        return;
      }

      // Billing was waived - tokens credited directly
      // Update token balance
      if (result.balance) {
        setTokenBalance({
          subscription_tokens_available: result.balance.subscriptionAvailable ?? tokenBalance?.subscription_tokens_available ?? 0,
          subscription_tokens_used_this_period: result.balance.subscriptionUsed ?? tokenBalance?.subscription_tokens_used_this_period ?? 0,
          purchased_tokens_available: result.balance.purchasedAvailable ?? 0,
          // Designated token breakdown
          teamAvailable: result.balance.teamAvailable ?? tokenBalance?.teamAvailable ?? 0,
          teamUsedThisPeriod: tokenBalance?.teamUsedThisPeriod ?? 0,
          opponentAvailable: result.balance.opponentAvailable ?? tokenBalance?.opponentAvailable ?? 0,
          opponentUsedThisPeriod: tokenBalance?.opponentUsedThisPeriod ?? 0,
          monthlyTeamAllocation: tokenBalance?.monthlyTeamAllocation ?? 0,
          monthlyOpponentAllocation: tokenBalance?.monthlyOpponentAllocation ?? 0,
        });
      }

      setPurchaseSuccess(`Successfully added ${tokensToPurchase} film upload${tokensToPurchase !== 1 ? 's' : ''}! (Billing waived)`);
      setTokensToPurchase(1);

      setTimeout(() => setPurchaseSuccess(null), 5000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to purchase tokens';
      setPurchaseError(errorMessage);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-48 bg-gray-100 rounded-lg"></div>
        <div className="h-32 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  const subscriptionTokens = tokenBalance?.subscription_tokens_available ?? 0;
  const purchasedTokens = tokenBalance?.purchased_tokens_available ?? 0;
  const usedTokens = tokenBalance?.subscription_tokens_used_this_period ?? 0;
  const totalAvailable = subscriptionTokens + purchasedTokens;
  const usagePercentage = tokenAllocation > 0 ? Math.min((usedTokens / tokenAllocation) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Usage & Tokens</h2>
        <p className="text-gray-600 mt-1">
          Track your film uploads and manage your token balance
        </p>
      </div>

      {/* Token Balance Card */}
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Film Upload Tokens</h3>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-gray-400" />
            <span className="text-2xl font-bold text-gray-900">{totalAvailable}</span>
            <span className="text-gray-500">available</span>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">This billing period</span>
            <span className="font-medium text-gray-900">
              {usedTokens} of {tokenAllocation} plan tokens used
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercentage >= 90 ? 'bg-red-500' : usagePercentage >= 70 ? 'bg-amber-500' : 'bg-gray-900'
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
        </div>

        {/* Token Breakdown by Type */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Team Film Tokens */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Film className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">Team Film</p>
            </div>
            <p className="text-2xl font-bold text-blue-900">{tokenBalance?.teamAvailable ?? 0}</p>
            <p className="text-xs text-blue-600">available</p>
            {(tokenBalance?.monthlyTeamAllocation ?? 0) > 0 && (
              <p className="text-xs text-blue-500 mt-1">
                {tokenBalance?.teamUsedThisPeriod ?? 0} of {tokenBalance?.monthlyTeamAllocation ?? 0} used this period
              </p>
            )}
          </div>

          {/* Opponent Scouting Tokens */}
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Film className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">Opponent Scouting</p>
            </div>
            <p className="text-2xl font-bold text-amber-900">{tokenBalance?.opponentAvailable ?? 0}</p>
            <p className="text-xs text-amber-600">available</p>
            {(tokenBalance?.monthlyOpponentAllocation ?? 0) > 0 && (
              <p className="text-xs text-amber-500 mt-1">
                {tokenBalance?.opponentUsedThisPeriod ?? 0} of {tokenBalance?.monthlyOpponentAllocation ?? 0} used this period
              </p>
            )}
          </div>
        </div>

        {/* Subscription vs Purchased Breakdown */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Subscription Tokens</p>
            <p className="text-xl font-semibold text-gray-900">{subscriptionTokens}</p>
            <p className="text-xs text-gray-400">Refreshes each billing period</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Purchased Tokens</p>
            <p className="text-xl font-semibold text-gray-900">{purchasedTokens}</p>
            <p className="text-xs text-gray-400">Never expire</p>
          </div>
        </div>

        {/* How Tokens Work */}
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Upload tokens</strong> are used when you create a new game in the Film section.
            Each game uses one token from the appropriate pool.
          </p>
          <p>
            <strong>Team Film tokens</strong> are for uploading your own team's game footage.
            <strong> Opponent Scouting tokens</strong> are for uploading opponent film for scouting purposes.
          </p>
          <p>
            Your subscription tokens refresh at the start of each billing period.
            Purchased tokens never expire and are used after subscription tokens run out.
          </p>
        </div>
      </div>

      {/* Purchase Tokens (Owner Only) */}
      {isOwner && (
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Purchase Additional Tokens</h3>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Need more film uploads? Purchase additional tokens that never expire.
          </p>

          {/* Success Message */}
          {purchaseSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-700">{purchaseSuccess}</p>
            </div>
          )}

          {/* Error Message */}
          {purchaseError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">{purchaseError}</p>
            </div>
          )}

          <div className="flex items-center gap-6">
            {/* Quantity Selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTokensToPurchase(Math.max(1, tokensToPurchase - 1))}
                disabled={tokensToPurchase <= 1 || purchasing}
                className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-16 text-center">
                <span className="text-2xl font-bold text-gray-900">{tokensToPurchase}</span>
              </div>
              <button
                onClick={() => setTokensToPurchase(tokensToPurchase + 1)}
                disabled={purchasing}
                className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Price */}
            <div className="flex-1">
              <p className="text-sm text-gray-500">Price per token</p>
              <p className="text-lg font-semibold text-gray-900">
                ${(TOKEN_PRICE_CENTS / 100).toFixed(2)}
              </p>
            </div>

            {/* Total & Purchase Button */}
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Total</p>
              <p className="text-xl font-bold text-gray-900 mb-2">
                ${((tokensToPurchase * TOKEN_PRICE_CENTS) / 100).toFixed(2)}
              </p>
              <button
                onClick={handlePurchase}
                disabled={purchasing || tokensToPurchase < 1}
                className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Purchase
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Tokens are charged immediately to your payment method on file.
          </p>
        </div>
      )}

      {/* Usage Stats */}
      {usage && (
        <div className="border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Activity</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <Film className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{usage.games_count}</p>
              <p className="text-sm text-gray-500">Games</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <Play className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{usage.plays_count}</p>
              <p className="text-sm text-gray-500">Plays Tagged</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <Users className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{usage.players_count}</p>
              <p className="text-sm text-gray-500">Players</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <Users className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{usage.members_count}</p>
              <p className="text-sm text-gray-500">Team Members</p>
            </div>
          </div>
        </div>
      )}

      {/* Non-owner message */}
      {!isOwner && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ShoppingCart className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900">Need more tokens?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Contact the team owner to purchase additional film upload tokens.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
