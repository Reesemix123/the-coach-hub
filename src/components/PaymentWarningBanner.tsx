'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CreditCard, X } from 'lucide-react';

interface PaymentStatus {
  status: 'current' | 'past_due' | 'suspended' | 'none';
  gracePeriodDaysRemaining: number | null;
  pastDueSince: string | null;
}

export default function PaymentWarningBanner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const teamId = params?.teamId as string | undefined;
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pages that should NOT redirect when suspended (allow access to billing/payment pages)
  const exemptPaths = ['/payment-suspended', '/console/billing', '/console', '/pricing'];
  const isExemptPath = exemptPaths.some(path => pathname?.startsWith(path));

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    // Check if user has dismissed this warning recently (within 24 hours)
    const dismissedKey = `payment-warning-dismissed-${teamId}`;
    const dismissedAt = localStorage.getItem(dismissedKey);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < twentyFourHours) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    }

    async function fetchPaymentStatus() {
      try {
        const response = await fetch(`/api/teams/${teamId}/payment-status`);
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data);

          // Redirect to suspended page if payment is suspended (unless on exempt path)
          if (data.status === 'suspended' && !isExemptPath) {
            router.push('/payment-suspended');
          }
        }
      } catch (error) {
        console.error('Failed to fetch payment status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPaymentStatus();
  }, [teamId, isExemptPath, router]);

  const handleDismiss = () => {
    if (teamId) {
      const dismissedKey = `payment-warning-dismissed-${teamId}`;
      localStorage.setItem(dismissedKey, Date.now().toString());
    }
    setDismissed(true);
  };

  // Don't show anything while loading, if dismissed, or if payment is current
  if (loading || dismissed || !paymentStatus) return null;
  if (paymentStatus.status === 'current' || paymentStatus.status === 'none') return null;

  // Past due - warning banner
  if (paymentStatus.status === 'past_due') {
    const daysRemaining = paymentStatus.gracePeriodDaysRemaining ?? 0;

    return (
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Payment failed.</span>{' '}
                {daysRemaining > 0 ? (
                  <>
                    Please update your payment method within{' '}
                    <span className="font-semibold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>{' '}
                    to avoid service interruption.
                  </>
                ) : (
                  <>Your access may be suspended soon. Please update your payment method immediately.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/console/billing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Update Payment
              </Link>
              <button
                onClick={handleDismiss}
                className="p-1 text-amber-600 hover:text-amber-800 transition-colors"
                aria-label="Dismiss warning"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Suspended - redirect to suspended page (handled in useEffect)
  // On exempt paths, we just don't show any banner since we're already on billing pages
  if (paymentStatus.status === 'suspended') {
    return null;
  }

  return null;
}
