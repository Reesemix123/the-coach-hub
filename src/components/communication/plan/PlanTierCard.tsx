'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface PlanTierCardProps {
  tier: string;
  name: string;
  price: number;
  maxParents: number | null;
  isRecommended?: boolean;
  teamId: string;
}

const FEATURES = [
  '10 team video shares/season',
  'Unlimited individual player clips',
  'Full player reports',
  'SMS + email notifications',
  'Family-based RSVP',
  'Announcement targeting',
] as const;

/**
 * Displays a single communication plan tier with pricing and a purchase button.
 * Redirects to Stripe checkout via /api/communication/plan/checkout.
 */
export function PlanTierCard({
  tier,
  name,
  price,
  maxParents,
  isRecommended,
  teamId,
}: PlanTierCardProps) {
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      const res = await fetch('/api/communication/plan/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, planTier: tier }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert((data as { error?: string }).error ?? 'Failed to start checkout');
        return;
      }

      const { url } = data as { url?: string };
      if (url) {
        window.location.href = url;
      }
    } catch {
      alert('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 p-6 flex flex-col ${
        isRecommended ? 'border-gray-900 shadow-lg' : 'border-gray-200'
      }`}
    >
      {isRecommended && (
        <div className="text-xs font-semibold text-white bg-gray-900 rounded-full px-3 py-1 w-fit mb-4">
          Most Popular
        </div>
      )}

      <h3 className="text-xl font-bold text-gray-900">{name}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {maxParents ? `Up to ${maxParents} parents` : 'Unlimited parents'}
      </p>

      <div className="mt-4 mb-6">
        <span className="text-4xl font-bold text-gray-900">${price}</span>
        <span className="text-gray-500 text-sm">/season</span>
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={handlePurchase}
        disabled={loading}
        className={`
          w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
          disabled:opacity-50
          ${
            isRecommended
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }
        `}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Get Started
      </button>
    </div>
  );
}
