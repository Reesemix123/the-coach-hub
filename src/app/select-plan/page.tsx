'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { SubscriptionTier } from '@/types/admin';

interface PlanOption {
  id: SubscriptionTier;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  features: string[];
  popular?: boolean;
  aiPowered?: boolean;
}

const PLANS: PlanOption[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for youth leagues',
    price: 0,
    priceLabel: 'Free forever',
    features: [
      'Digital playbook builder',
      'Film upload & playback',
      'Roster management',
      'Game scheduling'
    ]
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Full analytics for competitive programs',
    price: 29,
    priceLabel: '/month',
    features: [
      'Everything in Basic',
      'Drive-by-drive analytics',
      'Player performance stats',
      'Game planning tools'
    ],
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced analytics for serious programs',
    price: 79,
    priceLabel: '/month',
    features: [
      'Everything in Plus',
      'O-Line grading & tracking',
      'Defensive player tracking',
      'Opponent scouting reports'
    ]
  },
  {
    id: 'ai_powered',
    name: 'AI Powered',
    description: 'AI-assisted coaching for elite programs',
    price: 199,
    priceLabel: '/month',
    features: [
      'Everything in Premium',
      'AI film analysis',
      'Custom AI training',
      'Advanced tendency analysis'
    ],
    aiPowered: true
  }
];

export default function SelectPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [processingPlan, setProcessingPlan] = useState<SubscriptionTier | null>(null);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in - redirect to pricing page
        router.push('/pricing');
        return;
      }

      // Check if user already has a team
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (teams && teams.length > 0) {
        // Already has a team - redirect to home
        router.push('/');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    setProcessingPlan(planId);

    if (planId === 'basic') {
      // Free tier - go directly to setup
      router.push('/setup?tier=basic');
    } else {
      // Paid tier - go to checkout
      router.push(`/checkout?tier=${planId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Select Your Plan
          </h1>
          <p className="mt-3 text-gray-600 max-w-xl mx-auto">
            Choose the plan that best fits your coaching program. You can upgrade or downgrade at any time.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 transition-all duration-200 hover:shadow-lg cursor-pointer ${
                selectedPlan === plan.id
                  ? 'border-gray-900 shadow-lg'
                  : 'border-gray-200 hover:border-gray-400'
              } ${plan.popular ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
                    Most Popular
                  </span>
                </div>
              )}

              {/* AI Powered badge */}
              {plan.aiPowered && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-medium text-white">
                    <Sparkles className="h-3 w-3" />
                    AI Powered
                  </span>
                </div>
              )}

              {/* Plan name and description */}
              <div className="mb-4 mt-2">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 text-sm">{plan.priceLabel}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="mb-6 flex-grow space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Select Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectPlan(plan.id);
                }}
                disabled={processingPlan !== null}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                  selectedPlan === plan.id
                    ? 'bg-gray-900 text-white'
                    : 'border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                }`}
              >
                {processingPlan === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : plan.id === 'basic' ? (
                  'Get Started Free'
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Help text */}
        <p className="text-center text-sm text-gray-500 mt-8">
          All plans include unlimited games, plays, and video uploads within your storage limit.
        </p>
      </div>
    </div>
  );
}
