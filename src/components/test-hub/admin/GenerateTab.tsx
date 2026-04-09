'use client';

// src/components/test-hub/admin/GenerateTab.tsx
// Admin Generate Tab — feature-driven test generation and scenario suite creation.
// Auth is handled by the parent page. This component fetches only the data it needs.

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { APP_FEATURES } from '@/content/features';

// ============================================
// TYPES
// ============================================

interface ScenarioStep {
  instruction: string;
  expected_outcome: string | null;
}

interface ScenarioPreview {
  suiteName: string;
  precondition: string;
  setupSteps: ScenarioStep[];
  testSteps: ScenarioStep[];
}

interface Suite {
  id: string;
  name: string;
  status: string;
}

type GenerationStatus = 'pending' | 'generating' | 'done' | 'error';

interface GenerationResults {
  created: number;
  failed: string[];
}

// ============================================
// PROPS
// ============================================

export interface GenerateTabProps {
  /** Auto-select this suite in the dropdown on mount. */
  preSelectedSuiteId?: string | null;
  /** Display name for the pre-selected suite (used in the highlight label). */
  preSelectedSuiteName?: string | null;
  /** Called after feature-driven generation or scenario save completes. */
  onGenerationComplete: (createdCount: number) => void;
}

// ============================================
// HELPERS
// ============================================

function buildFlatFeatures() {
  return APP_FEATURES.flatMap(cat =>
    cat.features.map(f => ({
      key: `${cat.id}:${f.name}`,
      categoryId: cat.id,
      categoryName: cat.name,
      name: f.name,
      description: f.description,
    }))
  );
}

const ALL_FEATURES = buildFlatFeatures();

// ============================================
// COMPONENT
// ============================================

export function GenerateTab({
  preSelectedSuiteId,
  preSelectedSuiteName,
  onGenerationComplete,
}: GenerateTabProps) {
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [coveredKeys, setCoveredKeys] = useState<Set<string>>(new Set());
  const [suites, setSuites] = useState<Suite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState(preSelectedSuiteId ?? '');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Map<string, GenerationStatus>>(new Map());
  const [results, setResults] = useState<GenerationResults | null>(null);

  // Inline new-suite form inside the dropdown flow
  const [showInlineSuiteForm, setShowInlineSuiteForm] = useState(false);
  const [inlineSuiteName, setInlineSuiteName] = useState('');
  const [inlineCreating, setInlineCreating] = useState(false);
  const [inlineSuiteError, setInlineSuiteError] = useState<string | null>(null);

  // Highlight animation for pre-selected suite
  const [highlightSuite, setHighlightSuite] = useState(!!preSelectedSuiteId);

  useEffect(() => {
    if (highlightSuite) {
      const timer = setTimeout(() => setHighlightSuite(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightSuite]);

  // Scenario generation state
  const [scenarioDesc, setScenarioDesc] = useState('');
  const [scenarioCategory, setScenarioCategory] = useState('');
  const [scenarioSuiteName, setScenarioSuiteName] = useState('');
  const [scenarioGenerating, setScenarioGenerating] = useState(false);
  const [scenarioPreview, setScenarioPreview] = useState<ScenarioPreview | null>(null);
  const [scenarioSaving, setScenarioSaving] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      // Find already-covered feature keys
      const { data: existingCases } = await supabase
        .from('test_cases')
        .select('source_feature_key')
        .in('status', ['active', 'pending_review'])
        .not('source_feature_key', 'is', null);

      const covered = new Set(
        (existingCases ?? [])
          .map(c => c.source_feature_key as string | null)
          .filter((k): k is string => k !== null)
      );
      setCoveredKeys(covered);

      // Fetch suites for dropdown
      const { data: suitesData } = await supabase
        .from('test_suites')
        .select('id, name, status')
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false });

      const suiteList = suitesData ?? [];
      setSuites(suiteList);

      // Apply pre-selection or fall back to first suite
      if (preSelectedSuiteId) {
        setSelectedSuiteId(preSelectedSuiteId);
      } else if (suiteList.length > 0 && !selectedSuiteId) {
        setSelectedSuiteId(suiteList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [preSelectedSuiteId]); // eslint-disable-line react-hooks/exhaustive-deps
  // selectedSuiteId intentionally excluded — it's only used for the fallback
  // default on first load and would cause an infinite re-fetch loop.

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep selectedSuiteId in sync if parent changes preSelectedSuiteId after mount
  useEffect(() => {
    if (preSelectedSuiteId) {
      setSelectedSuiteId(preSelectedSuiteId);
      setHighlightSuite(true);
    }
  }, [preSelectedSuiteId]);

  // ============================================
  // INLINE SUITE CREATION
  // ============================================

  async function handleInlineCreateSuite() {
    if (!inlineSuiteName.trim()) return;
    setInlineCreating(true);
    setInlineSuiteError(null);
    try {
      const res = await fetch('/api/test-hub/suites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inlineSuiteName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'Failed to create suite');
      }

      const newSuite = await res.json() as { id: string; name: string; status: string };

      // Add to local list and select it
      setSuites(prev => [newSuite, ...prev]);
      setSelectedSuiteId(newSuite.id);
      setInlineSuiteName('');
      setShowInlineSuiteForm(false);
    } catch (err) {
      setInlineSuiteError(err instanceof Error ? err.message : 'Failed to create suite');
    } finally {
      setInlineCreating(false);
    }
  }

  function handleSuiteSelectChange(value: string) {
    if (value === '__new__') {
      setShowInlineSuiteForm(true);
      // Keep previous selection until creation succeeds
    } else {
      setSelectedSuiteId(value);
      setShowInlineSuiteForm(false);
    }
  }

  // ============================================
  // FEATURE GENERATION
  // ============================================

  function handleToggleFeature(key: string) {
    if (coveredKeys.has(key)) return;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSelectAllUncovered() {
    const uncovered = ALL_FEATURES
      .filter(f => !coveredKeys.has(f.key))
      .map(f => f.key);
    setSelectedKeys(new Set(uncovered));
  }

  async function handleGenerate() {
    if (!selectedSuiteId || selectedKeys.size === 0) return;
    setGenerating(true);
    setResults(null);

    const initialProgress = new Map<string, GenerationStatus>();
    selectedKeys.forEach(k => initialProgress.set(k, 'pending'));
    setProgress(initialProgress);

    try {
      const res = await fetch('/api/test-hub/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureKeys: Array.from(selectedKeys),
          suiteId: selectedSuiteId,
        }),
      });

      const data = await res.json() as {
        created?: number;
        failed?: string[];
        results?: Array<{ key: string; success: boolean }>;
      };

      const nextProgress = new Map<string, GenerationStatus>();
      selectedKeys.forEach(k => nextProgress.set(k, 'done'));

      if (data.results) {
        for (const r of data.results) {
          nextProgress.set(r.key, r.success ? 'done' : 'error');
        }
      }

      setProgress(nextProgress);

      const finalResults: GenerationResults = {
        created: data.created ?? 0,
        failed: data.failed ?? [],
      };
      setResults(finalResults);

      onGenerationComplete(finalResults.created);
    } catch {
      const errorProgress = new Map<string, GenerationStatus>();
      selectedKeys.forEach(k => errorProgress.set(k, 'error'));
      setProgress(errorProgress);
      const finalResults: GenerationResults = {
        created: 0,
        failed: Array.from(selectedKeys),
      };
      setResults(finalResults);
      onGenerationComplete(0);
    } finally {
      setGenerating(false);
    }
  }

  // ============================================
  // SCENARIO GENERATION
  // ============================================

  async function handleScenarioGenerate() {
    if (!scenarioDesc.trim() || !scenarioCategory || !scenarioSuiteName.trim()) return;
    setScenarioGenerating(true);
    setScenarioError(null);
    setScenarioPreview(null);
    try {
      const res = await fetch('/api/test-hub/generate/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: scenarioDesc.trim(),
          featureCategoryId: scenarioCategory,
          suiteName: scenarioSuiteName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'Generation failed');
      }
      const data = await res.json() as ScenarioPreview;
      setScenarioPreview(data);
    } catch (err) {
      setScenarioError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setScenarioGenerating(false);
    }
  }

  async function handleScenarioSave() {
    if (!scenarioPreview) return;
    setScenarioSaving(true);
    try {
      const res = await fetch('/api/test-hub/generate/scenario/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suiteName: scenarioPreview.suiteName,
          precondition: scenarioPreview.precondition,
          category: scenarioCategory,
          setupSteps: scenarioPreview.setupSteps,
          testSteps: scenarioPreview.testSteps,
        }),
      });
      if (!res.ok) throw new Error('Save failed');

      setScenarioPreview(null);
      setScenarioDesc('');
      setScenarioSuiteName('');
      setScenarioCategory('');
      setResults({ created: 1, failed: [] });

      onGenerationComplete(1);
    } catch (err) {
      setScenarioError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setScenarioSaving(false);
    }
  }

  // ============================================
  // DERIVED VALUES
  // ============================================

  const featsByCategory = APP_FEATURES.map(cat => ({
    categoryId: cat.id,
    categoryName: cat.name,
    features: cat.features.map(f => ({
      key: `${cat.id}:${f.name}`,
      name: f.name,
      description: f.description,
    })),
  }));

  const uncoveredCount = ALL_FEATURES.filter(f => !coveredKeys.has(f.key)).length;

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div>

      {/* ---- Generate from app features ---- */}
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Generate from app features</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: feature selection */}
        <div className="lg:col-span-2">

          {/* Suite selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Suite <span className="text-red-500">*</span>
            </label>

            {preSelectedSuiteId && preSelectedSuiteName && (
              <p className="text-xs text-blue-600 mb-2">
                Pre-selected: {preSelectedSuiteName}
              </p>
            )}

            <select
              value={selectedSuiteId}
              onChange={e => handleSuiteSelectChange(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm transition-all ${
                highlightSuite
                  ? 'border-blue-400 ring-2 ring-blue-400 ring-offset-2'
                  : 'border-gray-300'
              }`}
            >
              <option value="__new__">+ New Suite</option>
              {suites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Inline new suite creation */}
            {showInlineSuiteForm && (
              <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700">Create a new suite</p>
                <input
                  type="text"
                  value={inlineSuiteName}
                  onChange={e => {
                    setInlineSuiteName(e.target.value);
                    setInlineSuiteError(null);
                  }}
                  placeholder="Suite name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
                {inlineSuiteError && (
                  <p className="text-xs text-red-600">{inlineSuiteError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInlineCreateSuite}
                    disabled={inlineCreating || !inlineSuiteName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inlineCreating && <Loader2 size={14} className="animate-spin" />}
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowInlineSuiteForm(false);
                      setInlineSuiteName('');
                      setInlineSuiteError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selection controls */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleSelectAllUncovered}
              disabled={uncoveredCount === 0}
              className="text-sm text-gray-600 hover:text-gray-900 underline disabled:no-underline disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Select All Uncovered ({uncoveredCount})
            </button>
            <p className="text-sm text-gray-500">
              {selectedKeys.size} selected
            </p>
          </div>

          {/* Feature list by category */}
          {featsByCategory.map(cat => (
            <div key={cat.categoryId}>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
                {cat.categoryName}
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {cat.features.map((feat, idx) => {
                  const isCovered = coveredKeys.has(feat.key);
                  const isSelected = selectedKeys.has(feat.key);

                  return (
                    <label
                      key={feat.key}
                      className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors ${
                        idx < cat.features.length - 1 ? 'border-b border-gray-100' : ''
                      } ${
                        isCovered
                          ? 'opacity-50 cursor-not-allowed bg-gray-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isCovered}
                        onChange={() => handleToggleFeature(feat.key)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isCovered ? 'text-gray-500' : 'text-gray-900'}`}>
                            {feat.name}
                          </span>
                          {isCovered && (
                            <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                              Covered
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {feat.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Generate button */}
          <div className="mt-8">
            <button
              onClick={handleGenerate}
              disabled={!selectedSuiteId || selectedSuiteId === '__new__' || selectedKeys.size === 0 || generating}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating && <Loader2 size={16} className="animate-spin" />}
              Generate Selected ({selectedKeys.size})
            </button>
          </div>
        </div>

        {/* Right: progress / results */}
        <div className="lg:col-span-1">
          {(generating || results) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {generating ? 'Generating...' : 'Results'}
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Array.from(selectedKeys).map(key => {
                  const status = progress.get(key) ?? 'pending';
                  const featureName = key.split(':').slice(1).join(':');
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}
                      {status === 'generating' && (
                        <Loader2 size={16} className="animate-spin text-gray-500 flex-shrink-0" />
                      )}
                      {status === 'done' && (
                        <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                      )}
                      {status === 'error' && (
                        <XCircle size={16} className="text-red-500 flex-shrink-0" />
                      )}
                      <span className="text-sm text-gray-700 truncate">{featureName}</span>
                    </div>
                  );
                })}
              </div>

              {results && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-900 font-medium">
                    Created {results.created} test case{results.created !== 1 ? 's' : ''}.
                    {results.failed.length > 0 && (
                      <span className="text-red-600 ml-1">{results.failed.length} failed.</span>
                    )}
                  </p>
                  <Link
                    href="/test-hub/admin/review"
                    className="mt-3 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Go to Review Queue
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Divider ---- */}
      <div className="border-t border-gray-200 my-10" />

      {/* ---- Generate a scenario suite ---- */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Generate a scenario suite</h2>
        <p className="text-sm text-gray-500 mb-6">
          Describe a specific scenario to test. The AI will create setup steps that establish
          the precondition and test steps to verify the behavior.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suite name</label>
            <input
              type="text"
              value={scenarioSuiteName}
              onChange={e => setScenarioSuiteName(e.target.value)}
              placeholder="Multi-team setup scenario"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related feature area</label>
            <select
              value={scenarioCategory}
              onChange={e => setScenarioCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
            >
              <option value="">Select a category...</option>
              {APP_FEATURES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Describe the scenario you want to test
            </label>
            <textarea
              value={scenarioDesc}
              onChange={e => setScenarioDesc(e.target.value)}
              placeholder="Test team setup when the coach already has an existing team and wants to create a second team with a different subscription tier"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm resize-none"
            />
          </div>

          {scenarioError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {scenarioError}
            </div>
          )}

          {!scenarioPreview && (
            <button
              onClick={handleScenarioGenerate}
              disabled={
                scenarioGenerating ||
                !scenarioDesc.trim() ||
                !scenarioCategory ||
                !scenarioSuiteName.trim()
              }
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scenarioGenerating && <Loader2 size={16} className="animate-spin" />}
              Generate Scenario Suite
            </button>
          )}
        </div>

        {/* Scenario preview */}
        {scenarioPreview && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{scenarioPreview.suiteName}</h3>

            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                Precondition
              </p>
              <p className="text-sm text-amber-700">{scenarioPreview.precondition}</p>
            </div>

            {scenarioPreview.setupSteps.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Setup Steps
                </h4>
                <ol className="space-y-2">
                  {scenarioPreview.setupSteps.map((step, i) => (
                    <li key={i} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-900">{step.instruction}</p>
                      {step.expected_outcome && (
                        <p className="text-xs text-gray-500 italic mt-1">{step.expected_outcome}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Test Steps
              </h4>
              <ol className="space-y-2">
                {scenarioPreview.testSteps.map((step, i) => (
                  <li key={i} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900">{step.instruction}</p>
                    {step.expected_outcome && (
                      <p className="text-xs text-gray-500 italic mt-1">{step.expected_outcome}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={handleScenarioSave}
                disabled={scenarioSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {scenarioSaving && <Loader2 size={14} className="animate-spin" />}
                Save to Review Queue
              </button>
              <button
                onClick={() => setScenarioPreview(null)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
