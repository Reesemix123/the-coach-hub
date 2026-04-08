// /api/admin/testing/coverage - Feature Coverage Report API
// Computes test coverage by matching APP_FEATURES against test_cases.source_feature_key.
// Requires platform admin authentication.

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { APP_FEATURES } from '@/content/features';

// ---------------------------------------------------------------------------
// source_feature_key format handling
//
// Two formats exist due to a mismatch between the generate page and API:
//   Page sends:  "categoryId:featureName"  (e.g. "film:Video Upload")
//   API expects: "categoryId/featureIndex" (e.g. "film/0")
//
// The generate API's resolveFeatureKey() splits on "/" and uses an integer
// index, but the page constructs keys with ":" and the feature name.
// Whichever format is stored in the DB, we match against both here.
// ---------------------------------------------------------------------------

interface FeatureRef {
  categoryId: string;
  featureName: string;
}

interface TestCaseRow {
  source_feature_key: string | null;
  status: string | null;
}

interface CategoryCoverage {
  category_id: string;
  category_name: string;
  total: number;
  covered: number;
  pending_review: number;
  not_covered: number;
}

/**
 * GET /api/admin/testing/coverage
 * Returns feature coverage totals and a per-category breakdown.
 * "covered" = at least one active test case for the feature.
 * "pending_review" = at least one pending_review test case but no active one.
 * "not_covered" = no test cases at all.
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { serviceClient } = auth;

  try {
    // Build lookup maps for both key formats
    const featuresByColonKey = new Map<string, FeatureRef>();
    const featuresBySlashKey = new Map<string, FeatureRef>();

    for (const cat of APP_FEATURES) {
      cat.features.forEach((f, idx) => {
        const colonKey = `${cat.id}:${f.name}`;
        const slashKey = `${cat.id}/${idx}`;
        const ref: FeatureRef = { categoryId: cat.id, featureName: f.name };
        featuresByColonKey.set(colonKey, ref);
        featuresBySlashKey.set(slashKey, ref);
      });
    }

    // Query all test cases that have a source_feature_key
    const { data: testCases, error: testCasesError } = await serviceClient
      .from('test_cases')
      .select('source_feature_key, status')
      .not('source_feature_key', 'is', null);

    if (testCasesError) {
      console.error('Failed to fetch test cases for coverage:', testCasesError);
      return NextResponse.json(
        { error: 'Failed to fetch test cases' },
        { status: 500 }
      );
    }

    const testCaseList = (testCases ?? []) as TestCaseRow[];

    // For each feature, track whether it has an active test case or a
    // pending_review test case. Key: "categoryId:featureName"
    const coveredFeatures = new Set<string>();
    const pendingFeatures = new Set<string>();

    for (const tc of testCaseList) {
      if (!tc.source_feature_key) continue;

      // Try colon format first, then slash format
      const ref =
        featuresByColonKey.get(tc.source_feature_key) ??
        featuresBySlashKey.get(tc.source_feature_key);

      if (!ref) continue;

      const featureKey = `${ref.categoryId}:${ref.featureName}`;

      if (tc.status === 'active') {
        coveredFeatures.add(featureKey);
      } else if (tc.status === 'pending_review') {
        pendingFeatures.add(featureKey);
      }
    }

    // Build per-category breakdown
    const byCategoryMap = new Map<
      string,
      { name: string; total: number; covered: number; pending_review: number; not_covered: number }
    >();

    for (const cat of APP_FEATURES) {
      byCategoryMap.set(cat.id, {
        name: cat.name,
        total: cat.features.length,
        covered: 0,
        pending_review: 0,
        not_covered: 0,
      });
    }

    let totalFeatures = 0;
    let totalCovered = 0;
    let totalPending = 0;

    for (const cat of APP_FEATURES) {
      const stats = byCategoryMap.get(cat.id)!;

      for (const f of cat.features) {
        totalFeatures++;
        const featureKey = `${cat.id}:${f.name}`;

        if (coveredFeatures.has(featureKey)) {
          stats.covered++;
          totalCovered++;
        } else if (pendingFeatures.has(featureKey)) {
          // Only count as pending_review if there is no active test case
          stats.pending_review++;
          totalPending++;
        } else {
          stats.not_covered++;
        }
      }
    }

    const totalNotCovered = totalFeatures - totalCovered - totalPending;
    const coveragePercentage =
      totalFeatures > 0 ? Math.round((totalCovered / totalFeatures) * 100) : 0;

    // Sort by coverage percentage ascending (least covered first)
    const byCategory: CategoryCoverage[] = [...byCategoryMap.entries()]
      .map(([category_id, stats]) => ({
        category_id,
        category_name: stats.name,
        total: stats.total,
        covered: stats.covered,
        pending_review: stats.pending_review,
        not_covered: stats.not_covered,
      }))
      .sort((a, b) => {
        const pctA = a.total > 0 ? a.covered / a.total : 0;
        const pctB = b.total > 0 ? b.covered / b.total : 0;
        return pctA - pctB;
      });

    return NextResponse.json({
      totals: {
        total_features: totalFeatures,
        covered: totalCovered,
        pending_review: totalPending,
        not_covered: totalNotCovered,
        coverage_percentage: coveragePercentage,
      },
      by_category: byCategory,
    });
  } catch (error) {
    console.error('Error computing feature coverage:', error);
    return NextResponse.json(
      { error: 'Server error while computing coverage' },
      { status: 500 }
    );
  }
}
