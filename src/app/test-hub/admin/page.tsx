'use client';

// src/app/test-hub/admin/page.tsx
// Test Hub Admin Dashboard - tabbed container for Suites, Generate, and Review

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SuitesTab } from '@/components/test-hub/admin/SuitesTab';
import { GenerateTab } from '@/components/test-hub/admin/GenerateTab';
import { ReviewTab } from '@/components/test-hub/admin/ReviewTab';

// ============================================
// TYPES
// ============================================

type ActiveTab = 'suites' | 'generate' | 'review';

// ============================================
// INNER COMPONENT (requires useSearchParams)
// ============================================

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'generate' || tab === 'review' || tab === 'suites') return tab;
    return 'suites';
  });
  const [preSelectedSuiteId, setPreSelectedSuiteId] = useState<string | null>(null);
  const [preSelectedSuiteName, setPreSelectedSuiteName] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [uncoveredCount, setUncoveredCount] = useState(0);

  const fetchBadgeCounts = useCallback(async () => {
    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_platform_admin) {
        router.push('/test-hub');
        return;
      }

      // Fetch pending review count
      const { count: pendingCount } = await supabase
        .from('test_cases')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review');

      setReviewCount(pendingCount ?? 0);

      // Fetch uncovered count from coverage API
      try {
        const res = await fetch('/api/admin/testing/coverage');
        if (res.ok) {
          const data = await res.json() as { totals?: { not_covered?: number } };
          setUncoveredCount(data.totals?.not_covered ?? 0);
        }
      } catch {
        // Coverage API is non-critical — leave uncoveredCount at 0
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBadgeCounts();
  }, [fetchBadgeCounts]);

  function handleTabChange(tab: ActiveTab) {
    if (tab !== 'generate') {
      setPreSelectedSuiteId(null);
      setPreSelectedSuiteName(null);
    }
    setActiveTab(tab);
  }

  const tabs: { key: ActiveTab; label: string; badge: number }[] = [
    { key: 'suites', label: 'Suites', badge: 0 },
    { key: 'generate', label: 'Generate', badge: uncoveredCount },
    { key: 'review', label: 'Review', badge: reviewCount },
  ];

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="p-8 pb-0">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Test Hub Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Manage test suites, generate test cases, and review the queue.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mt-6">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.badge > 0 && (
                  <span className="ml-2 bg-gray-900 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'suites' && (
            <SuitesTab
              onSuiteCreated={(id, name) => {
                setPreSelectedSuiteId(id);
                setPreSelectedSuiteName(name);
                setActiveTab('generate');
              }}
            />
          )}
          {activeTab === 'generate' && (
            <GenerateTab
              preSelectedSuiteId={preSelectedSuiteId}
              preSelectedSuiteName={preSelectedSuiteName}
              onGenerationComplete={(count) => {
                setReviewCount(prev => prev + count);
                setPreSelectedSuiteId(null);
                setPreSelectedSuiteName(null);
                setActiveTab('review');
              }}
            />
          )}
          {activeTab === 'review' && (
            <ReviewTab
              onCountChange={(count) => setReviewCount(count)}
              onAllApproved={() => setReviewCount(0)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE (Suspense wrapper required for useSearchParams)
// ============================================

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    }>
      <AdminPageInner />
    </Suspense>
  );
}
