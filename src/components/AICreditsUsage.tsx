'use client';

import { useState, useEffect } from 'react';
import { Video, MessageSquare, Zap, ShoppingCart, Clock, AlertTriangle } from 'lucide-react';

interface AICreditsData {
  team_id: string;
  video_minutes_monthly: number;
  video_minutes_remaining: number;
  video_minutes_purchased: number;
  video_minutes_total: number;
  text_actions_monthly: number;
  text_actions_remaining: number;
  is_text_unlimited: boolean;
  priority_processing: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  video_minutes_used_this_period: number;
  text_actions_used_this_period: number;
}

interface Package {
  id: string;
  minutes: number;
  price_cents: number;
  price_display: string;
  price_per_minute: number;
  is_best_value: boolean;
}

interface PurchaseData {
  packages: Package[];
  purchase_history: Array<{
    id: string;
    minutes_purchased: number;
    minutes_remaining: number;
    price_cents: number;
    purchased_at: string;
    expires_at: string;
  }>;
  active_purchases: Array<{
    id: string;
    minutes_remaining: number;
    expires_at: string;
  }>;
  total_active_minutes: number;
  can_purchase: boolean;
}

interface AICreditsUsageProps {
  teamId: string;
  isOwner: boolean;
}

export default function AICreditsUsage({ teamId, isOwner }: AICreditsUsageProps) {
  const [credits, setCredits] = useState<AICreditsData | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [creditsRes, purchaseRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/ai-credits`),
        fetch(`/api/teams/${teamId}/ai-credits/purchase`)
      ]);

      if (creditsRes.ok) {
        setCredits(await creditsRes.json());
      }

      if (purchaseRes.ok) {
        setPurchaseData(await purchaseRes.json());
      }
    } catch (err) {
      console.error('Error fetching AI credits:', err);
      setError('Failed to load AI credits data');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    setPurchasing(packageId);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/ai-credits/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start purchase');
      }

      // Redirect to Stripe checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start purchase');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading AI credits...</div>
      </div>
    );
  }

  const videoUsedPercent = credits?.video_minutes_monthly
    ? Math.round((credits.video_minutes_used_this_period / credits.video_minutes_monthly) * 100)
    : 0;

  const textUsedPercent = credits?.text_actions_monthly && credits.text_actions_monthly > 0
    ? Math.round((credits.text_actions_used_this_period / credits.text_actions_monthly) * 100)
    : 0;

  const lowVideoMinutes = credits?.video_minutes_total !== undefined && credits.video_minutes_total < 10;
  const lowTextActions = !credits?.is_text_unlimited && credits?.text_actions_remaining !== undefined && credits.text_actions_remaining < 10;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">AI Credits</h2>
        <p className="text-gray-600">
          Manage your AI video minutes and text actions.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Current Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Video Minutes */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Video className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">AI Video Minutes</h3>
            {credits?.priority_processing && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                <Zap className="h-3 w-3" />
                Priority
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Available</span>
                <span className="font-medium text-gray-900">
                  {credits?.video_minutes_total || 0} minutes
                </span>
              </div>
              {lowVideoMinutes && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  Running low on video minutes
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly allocation</span>
                <span className="text-gray-700">{credits?.video_minutes_monthly || 0} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining from subscription</span>
                <span className="text-gray-700">{credits?.video_minutes_remaining || 0} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Purchased (active)</span>
                <span className="text-gray-700">{credits?.video_minutes_purchased || 0} min</span>
              </div>
            </div>

            {credits?.current_period_end && (
              <div className="text-xs text-gray-500">
                Resets {new Date(credits.current_period_end).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Text Actions */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">AI Text Actions</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Available</span>
                <span className="font-medium text-gray-900">
                  {credits?.is_text_unlimited ? (
                    <span className="text-purple-600">Unlimited</span>
                  ) : (
                    `${credits?.text_actions_remaining || 0} actions`
                  )}
                </span>
              </div>
              {lowTextActions && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  Running low on text actions
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly allocation</span>
                <span className="text-gray-700">
                  {credits?.text_actions_monthly === -1 ? 'Unlimited' : `${credits?.text_actions_monthly || 0} actions`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Used this period</span>
                <span className="text-gray-700">{credits?.text_actions_used_this_period || 0} actions</span>
              </div>
            </div>

            {credits?.current_period_end && (
              <div className="text-xs text-gray-500">
                Resets {new Date(credits.current_period_end).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase More Minutes */}
      {purchaseData?.can_purchase && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Purchase More Video Minutes</h3>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Need more AI video analysis? Purchase additional minutes anytime. Valid for 90 days.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {purchaseData?.packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative border rounded-lg p-4 text-center transition-all hover:border-gray-400 ${
                  pkg.is_best_value ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                }`}
              >
                {pkg.is_best_value && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded-full">
                      Best Value
                    </span>
                  </div>
                )}

                <div className="text-2xl font-bold text-gray-900">{pkg.minutes}</div>
                <div className="text-sm text-gray-500 mb-2">minutes</div>
                <div className="text-lg font-semibold text-gray-900">{pkg.price_display}</div>
                <div className="text-xs text-gray-500 mb-3">${pkg.price_per_minute.toFixed(2)}/min</div>

                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                  className="w-full px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                >
                  {purchasing === pkg.id ? 'Loading...' : 'Buy Now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Purchases */}
      {purchaseData?.active_purchases && purchaseData.active_purchases.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Active Purchased Minutes</h3>
          </div>

          <div className="space-y-3">
            {purchaseData.active_purchases.map((purchase) => {
              const expiresDate = new Date(purchase.expires_at);
              const daysRemaining = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="font-medium text-gray-900">{purchase.minutes_remaining} minutes</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className={`text-sm ${daysRemaining < 14 ? 'text-amber-600' : 'text-gray-500'}`}>
                      Expires in {daysRemaining} days
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {expiresDate.toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Purchase History */}
      {purchaseData?.purchase_history && purchaseData.purchase_history.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase History</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Minutes</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Price</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Remaining</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {purchaseData.purchase_history.slice(0, 10).map((purchase) => (
                  <tr key={purchase.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 text-gray-900">
                      {new Date(purchase.purchased_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-900">{purchase.minutes_purchased}</td>
                    <td className="py-3 text-gray-900">${(purchase.price_cents / 100).toFixed(2)}</td>
                    <td className="py-3 text-gray-900">{purchase.minutes_remaining}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(purchase.expires_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Credits Info */}
      {!credits?.video_minutes_monthly && !credits?.text_actions_monthly && !purchaseData?.active_purchases?.length && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No AI credits on your current plan</p>
          <p className="text-sm text-gray-400">
            Upgrade to Plus or higher to get monthly AI video minutes and text actions.
          </p>
        </div>
      )}
    </div>
  );
}
