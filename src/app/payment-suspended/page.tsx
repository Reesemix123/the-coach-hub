'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, CreditCard, HelpCircle, ArrowRight } from 'lucide-react';

export default function PaymentSuspendedPage() {
  const router = useRouter();
  const [portalLoading, setPortalLoading] = useState(false);

  async function openStripePortal() {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/console/billing/stripe/portal', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        // Fallback to billing page if portal fails
        router.push('/console/billing');
      }
    } catch (error) {
      console.error('Failed to open Stripe portal:', error);
      router.push('/console/billing');
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-semibold text-gray-900 mb-4">
          Account Suspended
        </h1>

        {/* Description */}
        <p className="text-lg text-gray-600 mb-8">
          Your payment method has failed and the 7-day grace period has expired.
          Please update your payment information to restore access to your team.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={openStripePortal}
            disabled={portalLoading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-5 h-5" />
            {portalLoading ? 'Opening...' : 'Update Payment Method'}
          </button>
          <Link
            href="/console/billing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Billing Details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Info Card */}
        <div className="bg-gray-50 rounded-lg p-6 text-left">
          <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">1</span>
              <span>Update your payment method via Stripe&apos;s secure portal</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">2</span>
              <span>We&apos;ll automatically retry your payment</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-medium">3</span>
              <span>Once successful, your access will be restored immediately</span>
            </li>
          </ul>
        </div>

        {/* Help Link */}
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
          <HelpCircle className="w-4 h-4" />
          <span>Need help?</span>
          <Link href="/guide/support/providing-feedback" className="text-gray-900 underline hover:no-underline">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
