'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, Upload, Camera, Calendar, Loader2, AlertCircle, Check, Users, Target, ShoppingCart } from 'lucide-react';

interface PricingTier {
  min: number;
  max: number | null;
  price_cents: number;
}

interface AddonConfig {
  unit_name: string;
  unit_value?: number;
  tiers: PricingTier[];
}

interface AddonPricing {
  tokens: AddonConfig;
  cameras: AddonConfig;
  retention: AddonConfig;
}

interface TeamAddons {
  additional_tokens: number;
  additional_cameras: number;
  additional_retention_days: number;
  monthly_cost_cents: number;
}

interface EffectiveLimits {
  max_coaches: number;
  ai_credits: number;
  storage_gb: number;
  addon_cost_cents: number;
}

interface TierLimits {
  monthlyTeamTokens: number;
  monthlyOpponentTokens: number;
  videoRetentionDays: number;
}

interface AddonData {
  pricing: AddonPricing;
  addons: TeamAddons | null;
  limits: EffectiveLimits;
  tier: string;
  isOwner: boolean;
  tierLimits?: TierLimits;
}

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
};

export default function AddonsPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<AddonData | null>(null);

  // Editable quantities
  const [tokens, setTokens] = useState(0);
  const [cameras, setCameras] = useState(0);
  const [retentionDays, setRetentionDays] = useState(0);

  // Token purchase state
  const [teamTokensToPurchase, setTeamTokensToPurchase] = useState(0);
  const [opponentTokensToPurchase, setOpponentTokensToPurchase] = useState(0);
  const [purchasingTokens, setPurchasingTokens] = useState(false);
  const [tokenPurchaseSuccess, setTokenPurchaseSuccess] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<{
    teamAvailable: number;
    opponentAvailable: number;
  } | null>(null);

  // Token pricing (cents)
  const TOKEN_PRICING = {
    team: 1200,      // $12.00 per team token
    opponent: 1200,  // $12.00 per opponent token
  };

  // Fetch current add-ons data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/teams/${teamId}/addons`);
        if (!response.ok) {
          if (response.status === 403) {
            setError('You do not have permission to view this page.');
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch add-ons data');
        }

        const addonData: AddonData = await response.json();
        setData(addonData);

        // Initialize form values from current add-ons
        if (addonData.addons) {
          setTokens(addonData.addons.additional_tokens);
          setCameras(addonData.addons.additional_cameras);
          setRetentionDays(addonData.addons.additional_retention_days);
        }
      } catch (err) {
        console.error('Error fetching add-ons:', err);
        setError('Failed to load add-ons data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [teamId]);

  // Fetch token balance
  useEffect(() => {
    async function fetchTokenBalance() {
      try {
        const response = await fetch(`/api/tokens?team_id=${teamId}`);
        if (response.ok) {
          const data = await response.json();
          setTokenBalance({
            teamAvailable: data.balance?.teamAvailable ?? 0,
            opponentAvailable: data.balance?.opponentAvailable ?? 0,
          });
        }
      } catch (err) {
        console.error('Error fetching token balance:', err);
      }
    }

    fetchTokenBalance();
  }, [teamId]);

  // Handle token purchase
  const handleTokenPurchase = async (tokenType: 'team' | 'opponent') => {
    const quantity = tokenType === 'team' ? teamTokensToPurchase : opponentTokensToPurchase;
    if (quantity < 1) return;

    setPurchasingTokens(true);
    setError(null);
    setTokenPurchaseSuccess(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/tokens/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_type: tokenType,
          quantity
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to purchase tokens');
      }

      const result = await response.json();

      // Update local token balance
      if (result.balance) {
        setTokenBalance({
          teamAvailable: result.balance.teamAvailable,
          opponentAvailable: result.balance.opponentAvailable,
        });
      }

      // Reset quantity and show success
      if (tokenType === 'team') {
        setTeamTokensToPurchase(0);
      } else {
        setOpponentTokensToPurchase(0);
      }

      const tokenLabel = tokenType === 'team' ? 'team film' : 'opponent scouting';
      setTokenPurchaseSuccess(`Successfully purchased ${quantity} ${tokenLabel} token${quantity !== 1 ? 's' : ''}!`);
      setTimeout(() => setTokenPurchaseSuccess(null), 5000);
    } catch (err) {
      console.error('Error purchasing tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to purchase tokens');
    } finally {
      setPurchasingTokens(false);
    }
  };

  // Calculate price for a given quantity and config
  const calculatePrice = useCallback((config: AddonConfig, quantity: number): { unitPrice: number; totalPrice: number; tierLabel: string } => {
    if (quantity <= 0) {
      return { unitPrice: 0, totalPrice: 0, tierLabel: 'No add-ons' };
    }

    const tier = config.tiers.find(t =>
      quantity >= t.min && (t.max === null || quantity <= t.max)
    ) || config.tiers[config.tiers.length - 1];

    let tierLabel: string;
    if (tier.max === null) {
      tierLabel = `${tier.min}+ units - $${(tier.price_cents / 100).toFixed(2)} each`;
    } else {
      tierLabel = `${tier.min}-${tier.max} units - $${(tier.price_cents / 100).toFixed(2)} each`;
    }

    return {
      unitPrice: tier.price_cents,
      totalPrice: quantity * tier.price_cents,
      tierLabel
    };
  }, []);

  // Calculate total monthly cost
  const calculateTotal = useCallback(() => {
    if (!data?.pricing) return 0;

    // Handle different pricing structures - the API may return different keys
    const tokenPricing = (data.pricing as Record<string, AddonConfig>).tokens;
    const cameraPricing = (data.pricing as Record<string, AddonConfig>).cameras;
    const retentionPricing = (data.pricing as Record<string, AddonConfig>).retention;

    const tokenCost = tokenPricing ? calculatePrice(tokenPricing, tokens).totalPrice : 0;
    const cameraCost = cameraPricing ? calculatePrice(cameraPricing, cameras).totalPrice : 0;

    // Convert retention days to 30-day increments
    const retentionUnits = retentionPricing
      ? Math.ceil(retentionDays / (retentionPricing.unit_value || 30))
      : 0;
    const retentionCost = retentionPricing ? calculatePrice(retentionPricing, retentionUnits).totalPrice : 0;

    return tokenCost + cameraCost + retentionCost;
  }, [data?.pricing, tokens, cameras, retentionDays, calculatePrice]);

  // Check if values have changed
  const hasChanges = data?.addons
    ? tokens !== data.addons.additional_tokens ||
      cameras !== data.addons.additional_cameras ||
      retentionDays !== data.addons.additional_retention_days
    : tokens > 0 || cameras > 0 || retentionDays > 0;

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/teams/${teamId}/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          additional_tokens: tokens,
          additional_cameras: cameras,
          additional_retention_days: retentionDays
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save add-ons');
      }

      const result = await response.json();

      // Update local data
      setData(prev => prev ? {
        ...prev,
        addons: result.addons,
        limits: result.limits
      } : null);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving add-ons:', err);
      setError(err instanceof Error ? err.message : 'Failed to save add-ons');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Loading add-ons...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Team
          </Link>
        </div>
      </div>
    );
  }

  if (!data?.isOwner) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Owner Access Required</h1>
          <p className="text-gray-600 mb-6">
            Only team owners can purchase add-ons. Contact your head coach to increase your team&apos;s limits.
          </p>
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Team
          </Link>
        </div>
      </div>
    );
  }

  const totalCost = calculateTotal();
  const currentCost = data.addons?.monthly_cost_cents || 0;
  const costDiff = totalCost - currentCost;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Team
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Manage Add-ons</h1>
          <p className="text-gray-600 mt-1">
            Purchase additional resources for your team beyond your {TIER_LABELS[data.tier] || data.tier} plan limits.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-green-800">Add-ons updated successfully!</p>
          </div>
        )}
        {tokenPurchaseSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-green-800">{tokenPurchaseSuccess}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Current Token Balance */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Token Balance</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-gray-700">Team Film Tokens</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{tokenBalance?.teamAvailable ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">For uploading your team&apos;s game film</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-medium text-gray-700">Opponent Scouting Tokens</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{tokenBalance?.opponentAvailable ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">For uploading opponent scouting film</p>
            </div>
          </div>
        </div>

        {/* Purchase Film Tokens */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gray-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Purchase Film Upload Tokens</h2>
              <p className="text-sm text-gray-500">Buy additional tokens to upload more games</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Team Tokens Purchase */}
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/50">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">Team Film Tokens</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                ${(TOKEN_PRICING.team / 100).toFixed(2)} per token
              </p>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setTeamTokensToPurchase(Math.max(0, teamTokensToPurchase - 1))}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
                  disabled={teamTokensToPurchase === 0}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-16 text-center">
                  <span className="text-2xl font-bold text-gray-900">{teamTokensToPurchase}</span>
                </div>
                <button
                  onClick={() => setTeamTokensToPurchase(teamTokensToPurchase + 1)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {teamTokensToPurchase > 0 && (
                <div className="mb-4 p-2 bg-white rounded border border-blue-200">
                  <p className="text-sm font-medium text-gray-900">
                    Total: ${((TOKEN_PRICING.team * teamTokensToPurchase) / 100).toFixed(2)}
                  </p>
                </div>
              )}

              <button
                onClick={() => handleTokenPurchase('team')}
                disabled={teamTokensToPurchase < 1 || purchasingTokens}
                className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {purchasingTokens ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Purchase Team Tokens</>
                )}
              </button>
            </div>

            {/* Opponent Tokens Purchase */}
            <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/50">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-orange-600" />
                <h3 className="font-medium text-gray-900">Opponent Scouting Tokens</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                ${(TOKEN_PRICING.opponent / 100).toFixed(2)} per token
              </p>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setOpponentTokensToPurchase(Math.max(0, opponentTokensToPurchase - 1))}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50"
                  disabled={opponentTokensToPurchase === 0}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-16 text-center">
                  <span className="text-2xl font-bold text-gray-900">{opponentTokensToPurchase}</span>
                </div>
                <button
                  onClick={() => setOpponentTokensToPurchase(opponentTokensToPurchase + 1)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {opponentTokensToPurchase > 0 && (
                <div className="mb-4 p-2 bg-white rounded border border-orange-200">
                  <p className="text-sm font-medium text-gray-900">
                    Total: ${((TOKEN_PRICING.opponent * opponentTokensToPurchase) / 100).toFixed(2)}
                  </p>
                </div>
              )}

              <button
                onClick={() => handleTokenPurchase('opponent')}
                disabled={opponentTokensToPurchase < 1 || purchasingTokens}
                className="w-full py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {purchasingTokens ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Purchase Opponent Tokens</>
                )}
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500 text-center">
            Purchased tokens never expire and are available immediately after purchase.
          </p>
        </div>

        {/* Current Plan Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan Limits</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Monthly Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {(data.tierLimits?.monthlyTeamTokens ?? 0) + (data.tierLimits?.monthlyOpponentTokens ?? 0)}/mo
              </p>
              <p className="text-xs text-gray-400">
                {data.tierLimits?.monthlyTeamTokens ?? 0} team + {data.tierLimits?.monthlyOpponentTokens ?? 0} opponent
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Video Retention</p>
              <p className="text-2xl font-bold text-gray-900">{data.tierLimits?.videoRetentionDays ?? 30} days</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Storage</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits?.storage_gb ?? '-'} GB</p>
            </div>
          </div>
        </div>

        {/* Other Add-ons Configuration - Only show if legacy pricing exists */}
        {data.pricing && (data.pricing as Record<string, AddonConfig>).tokens && (data.pricing as Record<string, AddonConfig>).cameras && (data.pricing as Record<string, AddonConfig>).retention && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Other Add-ons</h2>

          {/* Additional Upload Tokens (Legacy - Monthly Recurring) */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Upload className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Monthly Token Boost</h3>
                  <p className="text-sm text-gray-500">Extra tokens added to your monthly allocation</p>
                </div>
              </div>
              <div className="text-right">
                {tokens > 0 && (
                  <p className="text-lg font-semibold text-gray-900">
                    ${(calculatePrice(data.pricing.tokens, tokens).totalPrice / 100).toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setTokens(Math.max(0, tokens - 1))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={tokens === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-gray-900">{tokens}</span>
              </div>
              <button
                onClick={() => setTokens(tokens + 1)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-sm text-gray-500">
                {tokens > 0 ? (
                  <span className="text-green-600">
                    {calculatePrice(data.pricing.tokens, tokens).tierLabel}
                  </span>
                ) : (
                  <span>Starting at ${(data.pricing.tokens.tiers[0].price_cents / 100).toFixed(2)}/token/mo</span>
                )}
              </div>
            </div>
          </div>

          {/* Additional Cameras */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Camera className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Additional Camera Slots</h3>
                  <p className="text-sm text-gray-500">Add more camera angles per game</p>
                </div>
              </div>
              <div className="text-right">
                {cameras > 0 && (
                  <p className="text-lg font-semibold text-gray-900">
                    ${(calculatePrice(data.pricing.cameras, cameras).totalPrice / 100).toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setCameras(Math.max(0, cameras - 1))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={cameras === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-gray-900">{cameras}</span>
              </div>
              <button
                onClick={() => setCameras(cameras + 1)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-sm text-gray-500">
                {cameras > 0 ? (
                  <span className="text-green-600">
                    {cameras} additional camera{cameras !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span>Starting at ${(data.pricing.cameras.tiers[0].price_cents / 100).toFixed(2)}/camera/mo</span>
                )}
              </div>
            </div>
          </div>

          {/* Extended Retention */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Extended Retention</h3>
                  <p className="text-sm text-gray-500">Keep your games longer (sold in 30-day increments)</p>
                </div>
              </div>
              <div className="text-right">
                {retentionDays > 0 && (
                  <p className="text-lg font-semibold text-gray-900">
                    ${(calculatePrice(data.pricing.retention, Math.ceil(retentionDays / 30)).totalPrice / 100).toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setRetentionDays(Math.max(0, retentionDays - 30))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={retentionDays === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-24 text-center">
                <span className="text-2xl font-bold text-gray-900">{retentionDays}</span>
                <span className="text-sm text-gray-500 ml-1">days</span>
              </div>
              <button
                onClick={() => setRetentionDays(retentionDays + 30)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-sm text-gray-500">
                {retentionDays > 0 ? (
                  <span className="text-green-600">
                    +{Math.ceil(retentionDays / 30)} month{Math.ceil(retentionDays / 30) !== 1 ? 's' : ''} extra retention
                  </span>
                ) : (
                  <span>Starting at ${(data.pricing.retention.tiers[0].price_cents / 100).toFixed(2)}/30 days/mo</span>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Summary and Save - Only show if legacy pricing exists */}
        {data.pricing && (data.pricing as Record<string, AddonConfig>).tokens && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Monthly Add-on Cost</h2>
              {hasChanges && (
                <p className="text-sm text-gray-500">
                  {costDiff > 0
                    ? `+$${(costDiff / 100).toFixed(2)}/mo from current`
                    : costDiff < 0
                    ? `-$${(Math.abs(costDiff) / 100).toFixed(2)}/mo from current`
                    : 'No change'}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">${(totalCost / 100).toFixed(2)}</p>
              <p className="text-sm text-gray-500">per month</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Subscription'
            )}
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            Changes will be reflected on your next billing cycle. You can adjust add-ons at any time.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
