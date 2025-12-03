'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, Users, Zap, HardDrive, Loader2, AlertCircle, Check } from 'lucide-react';

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
  coaches: AddonConfig;
  ai_credits: AddonConfig;
  storage: AddonConfig;
}

interface TeamAddons {
  additional_coaches: number;
  additional_ai_credits: number;
  additional_storage_gb: number;
  monthly_cost_cents: number;
}

interface EffectiveLimits {
  max_coaches: number;
  ai_credits: number;
  storage_gb: number;
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
  ai_powered: 'AI Powered'
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
  const [coaches, setCoaches] = useState(0);
  const [aiCredits, setAiCredits] = useState(0);
  const [storageGb, setStorageGb] = useState(0);

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
          setCoaches(addonData.addons.additional_coaches);
          setAiCredits(addonData.addons.additional_ai_credits);
          setStorageGb(addonData.addons.additional_storage_gb);
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

    const coachCost = calculatePrice(data.pricing.coaches, coaches).totalPrice;

    // Convert storage to units (10GB each)
    const storageUnits = Math.ceil(storageGb / (data.pricing.storage.unit_value || 10));
    const storageCost = calculatePrice(data.pricing.storage, storageUnits).totalPrice;

    // Convert AI credits to units (100 each)
    const aiUnits = Math.ceil(aiCredits / (data.pricing.ai_credits.unit_value || 100));
    const aiCost = calculatePrice(data.pricing.ai_credits, aiUnits).totalPrice;

    return coachCost + storageCost + aiCost;
  }, [data?.pricing, coaches, storageGb, aiCredits, calculatePrice]);

  // Check if values have changed
  const hasChanges = data?.addons
    ? coaches !== data.addons.additional_coaches ||
      aiCredits !== data.addons.additional_ai_credits ||
      storageGb !== data.addons.additional_storage_gb
    : coaches > 0 || aiCredits > 0 || storageGb > 0;

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
          additional_coaches: coaches,
          additional_ai_credits: aiCredits,
          additional_storage_gb: storageGb
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
              <p className="text-sm text-gray-500">Coaches</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits.max_coaches}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">AI Credits</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits.ai_credits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Storage</p>
              <p className="text-2xl font-bold text-gray-900">{data.limits.storage_gb} GB</p>
            </div>
          </div>
        </div>

        {/* Add-ons Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Purchase Add-ons</h2>

          {/* Coaches */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Additional Coaches</h3>
                  <p className="text-sm text-gray-500">Add extra coach seats beyond your plan limit</p>
                </div>
              </div>
              <div className="text-right">
                {coaches > 0 && (
                  <p className="text-lg font-semibold text-gray-900">
                    ${(calculatePrice(data.pricing.coaches, coaches).totalPrice / 100).toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setCoaches(Math.max(0, coaches - 1))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={coaches === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-gray-900">{coaches}</span>
              </div>
              <button
                onClick={() => setCoaches(coaches + 1)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-sm text-gray-500">
                {coaches > 0 ? (
                  <span className="text-green-600">
                    {calculatePrice(data.pricing.coaches, coaches).tierLabel}
                  </span>
                ) : (
                  <span>Starting at ${(data.pricing.coaches.tiers[0].price_cents / 100).toFixed(2)}/coach/mo</span>
                )}
              </div>
            </div>

            {/* Volume discount note */}
            {coaches > 0 && coaches < 5 && (
              <p className="mt-2 text-xs text-gray-500">
                Add {5 - coaches} more to unlock volume discount ($4/coach/mo)
              </p>
            )}
          </div>

          {/* AI Credits */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Zap className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Additional AI Credits</h3>
                  <p className="text-sm text-gray-500">Sold in packs of 100 credits</p>
                </div>
              </div>
              <div className="text-right">
                {aiCredits > 0 && (
                  <p className="text-lg font-semibold text-gray-900">
                    ${(calculatePrice(data.pricing.ai_credits, Math.ceil(aiCredits / 100)).totalPrice / 100).toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setAiCredits(Math.max(0, aiCredits - 100))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={aiCredits === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-gray-900">{aiCredits}</span>
              </div>
              <button
                onClick={() => setAiCredits(aiCredits + 100)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-sm text-gray-500">
                {aiCredits > 0 ? (
                  <span className="text-green-600">
                    {Math.ceil(aiCredits / 100)} pack{Math.ceil(aiCredits / 100) !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span>Starting at ${(data.pricing.ai_credits.tiers[0].price_cents / 100).toFixed(2)}/pack/mo</span>
                )}
              </div>
            </div>
          </div>

          {/* Storage */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <HardDrive className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Additional Storage</h3>
                  <p className="text-sm text-gray-500">Sold in blocks of 10GB</p>
                </div>
              </div>
              <div className="text-right">
                {storageGb > 0 && (
                  <p className="text-lg font-semibold text-gray-900">
                    ${(calculatePrice(data.pricing.storage, Math.ceil(storageGb / 10)).totalPrice / 100).toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setStorageGb(Math.max(0, storageGb - 10))}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={storageGb === 0}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-20 text-center">
                <span className="text-2xl font-bold text-gray-900">{storageGb}</span>
                <span className="text-sm text-gray-500 ml-1">GB</span>
              </div>
              <button
                onClick={() => setStorageGb(storageGb + 10)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-sm text-gray-500">
                {storageGb > 0 ? (
                  <span className="text-green-600">
                    {Math.ceil(storageGb / 10)} block{Math.ceil(storageGb / 10) !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span>Starting at ${(data.pricing.storage.tiers[0].price_cents / 100).toFixed(2)}/10GB/mo</span>
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
