/**
 * Analytics Advanced - DEPRECATED
 *
 * This page has been replaced by the new Analytics and Reporting system.
 * Users are automatically redirected to /analytics-reporting
 */

'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyticsAdvancedRedirect({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();

  useEffect(() => {
    // Redirect to new analytics-reporting page
    router.replace(`/teams/${teamId}/analytics-reporting`);
  }, [teamId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Analytics and Reporting...</p>
      </div>
    </div>
  );
}
