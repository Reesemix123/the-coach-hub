'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, Upload, Camera, Calendar, Loader2, AlertCircle, Check } from 'lucide-react';

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
  upload_tokens: number;
  cameras_per_game: number;
  retention_days: number;
  addon_cost_cents: number;
}

interface AddonData {
  pricing: AddonPricing;
  addons: TeamAddons | null;
  limits: EffectiveLimits;
  tier: string;
  isOwner: boolean;
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

    const tokenCost = calculatePrice(data.pricing.tokens, tokens).totalPrice;
    const cameraCost = calculatePrice(data.pricing.cameras, cameras).totalPrice;

    // Convert retention days to 30-day increments
    const retentionUnits = Math.ceil(retentionDays / (data.pricing.retention.unit_value || 30));
    const retentionCost = calculatePrice(data.pricing.retention, retentionUnits).totalPrice;

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
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Current Plan Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan Limits</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Upload Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits.upload_tokens}/mo</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cameras per Game</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits.cameras_per_game}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Retention</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits.retention_days} days</p>
            </div>
          </div>
        </div>

        {/* Add-ons Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Purchase Add-ons</h2>

          {/* Upload Tokens */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Upload className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Additional Upload Tokens</h3>
                  <p className="text-sm text-gray-500">Extra tokens for uploading more games each month</p>
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

        {/* Summary and Save */}
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
      </div>
    </div>
  );
}
