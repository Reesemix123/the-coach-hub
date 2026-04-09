'use client';

// src/components/test-hub/admin/ReviewTab.tsx
// Extracted review queue panel — used inside the admin tabbed layout.
// Auth/admin guard is handled by the parent page; this component only fetches data.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle, ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// ============================================
// TYPES
// ============================================

interface TestStep {
  id: string;
  test_case_id: string;
  step_type: 'setup' | 'test';
  display_order: number;
  instruction: string;
  expected_outcome: string | null;
}

interface TestCase {
  id: string;
  title: string;
  description: string | null;
  category: string;
  suite_id: string;
  source_feature_key: string | null;
  auto_generated: boolean;
  status: string;
  steps: TestStep[];
}

interface SuiteOption {
  id: string;
  name: string;
}

interface VariantStep {
  instruction: string;
  expected_outcome: string | null;
}

interface VariantState {
  phase: 'form' | 'generating' | 'preview' | 'saving' | 'success';
  description: string;
  suiteChoice: 'existing' | 'new';
  selectedSuiteId: string;
  newSuiteName: string;
  preview: {
    suiteName: string;
    precondition: string;
    setupSteps: VariantStep[];
    testSteps: VariantStep[];
  } | null;
  savedSuiteName: string | null;
  error: string | null;
}

interface EditedFields {
  title?: string;
  description?: string;
  steps: Record<string, { instruction?: string; expected_outcome?: string }>;
}

interface StepRowProps {
  step: TestStep;
  isEditing: boolean;
  editedStep?: { instruction?: string; expected_outcome?: string };
  onUpdate: (field: 'instruction' | 'expected_outcome', value: string) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export interface ReviewTabProps {
  /** Called when the queue becomes empty after an approve or reject action. */
  onAllApproved?: () => void;
  /** Called whenever the pending count changes (after fetch and after each approve/reject). */
  onCountChange?: (count: number) => void;
}

// ============================================
// HELPERS
// ============================================

function getCategoryBadgeClass(category: string): string {
  const map: Record<string, string> = {
    teams: 'bg-blue-100 text-blue-700',
    film: 'bg-purple-100 text-purple-700',
    playbook: 'bg-green-100 text-green-700',
    analytics: 'bg-orange-100 text-orange-700',
    general: 'bg-gray-100 text-gray-600',
  };
  return map[category] ?? 'bg-gray-100 text-gray-600';
}

function formatCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    teams: 'Teams',
    film: 'Film',
    playbook: 'Playbook',
    analytics: 'Analytics',
    'communication-hub': 'Communication',
    subscriptions: 'Subscriptions',
    roles: 'Roles',
    practice: 'Practice',
    'game-week': 'Game Planning',
    'player-profiles': 'Players',
    general: 'General',
  };
  return map[category] ?? category;
}

// ============================================
// SUB-COMPONENT: StepRow
// ============================================

function StepRow({
  step,
  isEditing,
  editedStep,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: StepRowProps) {
  const instruction = editedStep?.instruction ?? step.instruction;
  const expected = editedStep?.expected_outcome ?? (step.expected_outcome ?? '');

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2 group">
      {isEditing ? (
        <div className="flex gap-2">
          {/* Move arrows */}
          <div className="flex flex-col gap-0.5 self-center">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Move up"
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Move down"
            >
              <ArrowDown size={12} />
            </button>
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={instruction}
              onChange={e => onUpdate('instruction', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Instruction"
            />
            <input
              type="text"
              value={expected}
              onChange={e => onUpdate('expected_outcome', e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Expected outcome (optional)"
            />
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="self-start p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="Delete step"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-900">{step.instruction}</p>
          {step.expected_outcome && (
            <p className="text-xs text-gray-500 italic">{step.expected_outcome}</p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ReviewTab({ onAllApproved, onCountChange }: ReviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Map<string, EditedFields>>(new Map());
  const [approving, setApproving] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [addingStepTo, setAddingStepTo] = useState<{ caseId: string; type: 'setup' | 'test' } | null>(null);
  const [newStepInstruction, setNewStepInstruction] = useState('');
  const [newStepExpected, setNewStepExpected] = useState('');
  const [suites, setSuites] = useState<SuiteOption[]>([]);
  const [variantState, setVariantState] = useState<Map<string, VariantState>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const { data: casesData, error: casesError } = await supabase
        .from('test_cases')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false });

      if (casesError) throw new Error(`Failed to fetch cases: ${casesError.message}`);

      if (!casesData || casesData.length === 0) {
        setCases([]);
        onCountChange?.(0);
        return;
      }

      const caseIds = casesData.map(c => c.id);

      const { data: stepsData, error: stepsError } = await supabase
        .from('test_steps')
        .select('*')
        .in('test_case_id', caseIds)
        .order('step_type')
        .order('display_order');

      if (stepsError) throw new Error(`Failed to fetch steps: ${stepsError.message}`);

      const stepsByCase = new Map<string, TestStep[]>();
      for (const step of stepsData ?? []) {
        const existing = stepsByCase.get(step.test_case_id) ?? [];
        existing.push(step);
        stepsByCase.set(step.test_case_id, existing);
      }

      const enriched: TestCase[] = casesData.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description ?? null,
        category: c.category,
        suite_id: c.suite_id,
        source_feature_key: c.source_feature_key ?? null,
        auto_generated: c.auto_generated ?? false,
        status: c.status,
        steps: stepsByCase.get(c.id) ?? [],
      }));

      setCases(enriched);
      onCountChange?.(enriched.length);

      // Fetch suites for dropdown
      const { data: suitesData } = await supabase
        .from('test_suites')
        .select('id, name')
        .order('created_at', { ascending: false });
      setSuites((suitesData ?? []) as SuiteOption[]);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Returns the current edited fields for a case, defaulting to original values.
   */
  function getEditedCase(caseId: string, tc: TestCase): EditedFields {
    return editedFields.get(caseId) ?? {
      title: tc.title,
      description: tc.description ?? '',
      steps: {},
    };
  }

  function updateEditedField(caseId: string, tc: TestCase, field: 'title' | 'description', value: string) {
    setEditedFields(prev => {
      const next = new Map(prev);
      const current = getEditedCase(caseId, tc);
      next.set(caseId, { ...current, [field]: value });
      return next;
    });
  }

  function updateEditedStep(
    caseId: string,
    tc: TestCase,
    stepId: string,
    field: 'instruction' | 'expected_outcome',
    value: string,
  ) {
    setEditedFields(prev => {
      const next = new Map(prev);
      const current = getEditedCase(caseId, tc);
      next.set(caseId, {
        ...current,
        steps: {
          ...current.steps,
          [stepId]: { ...current.steps[stepId], [field]: value },
        },
      });
      return next;
    });
  }

  /**
   * Persists any edited case title/description and step fields to the API.
   */
  async function saveEdits(caseId: string, tc: TestCase, edited: EditedFields) {
    const patchBody: Record<string, string | null> = {};
    if (edited.title !== undefined && edited.title !== tc.title) patchBody.title = edited.title;
    if (edited.description !== undefined && edited.description !== (tc.description ?? '')) {
      patchBody.description = edited.description || null;
    }

    if (Object.keys(patchBody).length > 0) {
      await fetch(`/api/test-hub/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
    }

    for (const [stepId, stepEdits] of Object.entries(edited.steps)) {
      if (Object.keys(stepEdits).length > 0) {
        await fetch(`/api/test-hub/steps/${stepId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stepEdits),
        });
      }
    }
  }

  async function handleApprove(caseId: string, tc: TestCase) {
    setApproving(caseId);
    try {
      const edited = editedFields.get(caseId);

      // If in edit mode, save changes before approving
      if (editingCase === caseId && edited) {
        await saveEdits(caseId, tc, edited);
      }

      const res = await fetch(`/api/test-hub/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!res.ok) throw new Error('Failed to approve');

      setEditingCase(null);
      setCases(prev => {
        const next = prev.filter(c => c.id !== caseId);
        onCountChange?.(next.length);
        if (next.length === 0) onAllApproved?.();
        return next;
      });
    } finally {
      setApproving(null);
    }
  }

  async function handleReject(caseId: string) {
    const res = await fetch(`/api/test-hub/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });

    if (res.ok) {
      setCases(prev => {
        const next = prev.filter(c => c.id !== caseId);
        onCountChange?.(next.length);
        if (next.length === 0) onAllApproved?.();
        return next;
      });
    }
  }

  async function handleBulkApprove() {
    if (cases.length === 0) return;
    setBulkApproving(true);
    try {
      await Promise.all(
        cases.map(tc =>
          fetch(`/api/test-hub/cases/${tc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' }),
          })
        )
      );
      setCases([]);
      onCountChange?.(0);
      onAllApproved?.();
    } finally {
      setBulkApproving(false);
    }
  }

  async function handleAddStep(caseId: string, stepType: 'setup' | 'test') {
    if (!newStepInstruction.trim()) return;
    try {
      const res = await fetch('/api/test-hub/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_case_id: caseId,
          step_type: stepType,
          instruction: newStepInstruction.trim(),
          expected_outcome: newStepExpected.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add step');
      setAddingStepTo(null);
      setNewStepInstruction('');
      setNewStepExpected('');
      await fetchData();
    } catch (err) {
      console.error('Error adding step:', err);
    }
  }

  async function handleDeleteStep(stepId: string) {
    try {
      const res = await fetch(`/api/test-hub/steps/${stepId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete step');
      setCases(prev =>
        prev.map(tc => ({
          ...tc,
          steps: tc.steps.filter(s => s.id !== stepId),
        }))
      );
    } catch (err) {
      console.error('Error deleting step:', err);
    }
  }

  async function handleMoveStep(caseId: string, stepId: string, direction: 'up' | 'down') {
    const tc = cases.find(c => c.id === caseId);
    if (!tc) return;

    const step = tc.steps.find(s => s.id === stepId);
    if (!step) return;

    // Get steps of the same type, sorted by display_order
    const sameTypeSteps = tc.steps
      .filter(s => s.step_type === step.step_type)
      .sort((a, b) => a.display_order - b.display_order);

    const idx = sameTypeSteps.findIndex(s => s.id === stepId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sameTypeSteps.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const current = sameTypeSteps[idx];
    const neighbor = sameTypeSteps[swapIdx];

    // Optimistic swap
    setCases(prev =>
      prev.map(c => {
        if (c.id !== caseId) return c;
        return {
          ...c,
          steps: c.steps.map(s => {
            if (s.id === current.id) return { ...s, display_order: neighbor.display_order };
            if (s.id === neighbor.id) return { ...s, display_order: current.display_order };
            return s;
          }),
        };
      })
    );

    // Persist
    await Promise.all([
      fetch(`/api/test-hub/steps/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: neighbor.display_order }),
      }),
      fetch(`/api/test-hub/steps/${neighbor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: current.display_order }),
      }),
    ]);
  }

  // ------------------------------------------------------------------
  // Suite reassignment
  // ------------------------------------------------------------------
  async function handleSuiteChange(caseId: string, newSuiteId: string) {
    const res = await fetch(`/api/test-hub/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite_id: newSuiteId }),
    });
    if (res.ok) {
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, suite_id: newSuiteId } : c));
    }
  }

  // ------------------------------------------------------------------
  // Variant generation
  // ------------------------------------------------------------------
  function openVariantForm(tc: TestCase) {
    setVariantState(prev => {
      const next = new Map(prev);
      next.set(tc.id, {
        phase: 'form',
        description: '',
        suiteChoice: 'existing',
        selectedSuiteId: tc.suite_id,
        newSuiteName: `${tc.title} — Variant`,
        preview: null,
        savedSuiteName: null,
        error: null,
      });
      return next;
    });
  }

  function closeVariant(caseId: string) {
    setVariantState(prev => {
      const next = new Map(prev);
      next.delete(caseId);
      return next;
    });
  }

  function updateVariantField(caseId: string, field: 'description', value: string) {
    setVariantState(prev => {
      const next = new Map(prev);
      const current = next.get(caseId);
      if (current) next.set(caseId, { ...current, [field]: value });
      return next;
    });
  }

  async function handleVariantGenerate(tc: TestCase) {
    const vs = variantState.get(tc.id);
    if (!vs || !vs.description.trim()) return;
    const effectiveSuiteName = vs.suiteChoice === 'new' ? vs.newSuiteName.trim() : (suites.find(s => s.id === vs.selectedSuiteId)?.name || 'Variant');
    if (vs.suiteChoice === 'new' && !vs.newSuiteName.trim()) return;

    setVariantState(prev => {
      const next = new Map(prev);
      next.set(tc.id, { ...vs, phase: 'generating', error: null });
      return next;
    });

    try {
      const res = await fetch('/api/test-hub/generate/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: vs.description.trim(),
          featureCategoryId: tc.category,
          suiteName: effectiveSuiteName,
          sourceTestCaseId: tc.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Generation failed');
      }

      const preview = await res.json();
      setVariantState(prev => {
        const next = new Map(prev);
        next.set(tc.id, { ...vs, phase: 'preview', preview, error: null });
        return next;
      });
    } catch (err) {
      setVariantState(prev => {
        const next = new Map(prev);
        next.set(tc.id, {
          ...vs,
          phase: 'form',
          error: err instanceof Error ? err.message : 'Generation failed',
        });
        return next;
      });
    }
  }

  async function handleVariantSave(caseId: string) {
    const vs = variantState.get(caseId);
    if (!vs?.preview) return;

    const tc = cases.find(c => c.id === caseId);

    setVariantState(prev => {
      const next = new Map(prev);
      next.set(caseId, { ...vs, phase: 'saving', error: null });
      return next;
    });

    try {
      const saveBody: Record<string, unknown> = {
        suiteName: vs.preview.suiteName,
        precondition: vs.preview.precondition,
        category: tc?.category || 'general',
        setupSteps: vs.preview.setupSteps,
        testSteps: vs.preview.testSteps,
      };
      // If using an existing suite, pass suiteId so the save route doesn't create a new one
      if (vs.suiteChoice === 'existing' && vs.selectedSuiteId) {
        saveBody.suiteId = vs.selectedSuiteId;
      }

      const res = await fetch('/api/test-hub/generate/scenario/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveBody),
      });

      if (!res.ok) throw new Error('Save failed');

      setVariantState(prev => {
        const next = new Map(prev);
        next.set(caseId, {
          ...vs,
          phase: 'success',
          savedSuiteName: vs.preview?.suiteName || vs.newSuiteName || (suites.find(s => s.id === vs.selectedSuiteId)?.name) || 'Suite',
          error: null,
        });
        return next;
      });

      // Refresh to pick up new counts
      await fetchData();
    } catch (err) {
      setVariantState(prev => {
        const next = new Map(prev);
        next.set(caseId, {
          ...vs,
          phase: 'preview',
          error: err instanceof Error ? err.message : 'Save failed',
        });
        return next;
      });
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-gray-500">
            {cases.length} case{cases.length !== 1 ? 's' : ''} pending review
          </p>
          {cases.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkApproving}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm transition-colors disabled:opacity-50"
            >
              {bulkApproving && <Loader2 size={14} className="animate-spin" />}
              Approve All ({cases.length})
            </button>
          )}
        </div>

        {/* Empty state */}
        {cases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckCircle size={48} className="text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up</h3>
            <p className="text-sm text-gray-500 mb-4">No tests pending review.</p>
            <Link
              href="/test-hub"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View tester dashboard →
            </Link>
          </div>
        )}

        {/* Cases list */}
        <div className="space-y-4">
          {cases.map(tc => {
            const isExpanded = expandedCase === tc.id;
            const isEditing = editingCase === tc.id;
            const edited = editedFields.get(tc.id);
            const setupSteps = tc.steps
              .filter(s => s.step_type === 'setup')
              .sort((a, b) => a.display_order - b.display_order);
            const testSteps = tc.steps
              .filter(s => s.step_type === 'test')
              .sort((a, b) => a.display_order - b.display_order);

            return (
              <div key={tc.id} className="bg-white rounded-xl border border-gray-200">

                {/* Card header */}
                <div className="p-6">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={edited?.title ?? tc.title}
                          onChange={e => updateEditedField(tc.id, tc, 'title', e.target.value)}
                          className="w-full text-base font-semibold border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      ) : (
                        <h3 className="text-base font-semibold text-gray-900">{tc.title}</h3>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadgeClass(tc.category)}`}>
                        {formatCategoryLabel(tc.category)}
                      </span>
                      {tc.auto_generated && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          Auto-generated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {isEditing ? (
                    <textarea
                      value={edited?.description ?? (tc.description ?? '')}
                      onChange={e => updateEditedField(tc.id, tc, 'description', e.target.value)}
                      rows={2}
                      className="w-full mt-2 text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                    />
                  ) : (
                    tc.description && (
                      <p className="text-sm text-gray-600 mt-1">{tc.description}</p>
                    )
                  )}

                  {/* Source key */}
                  {tc.source_feature_key && (
                    <p className="text-xs text-gray-400 mt-2 font-mono">{tc.source_feature_key}</p>
                  )}

                  {/* Suite dropdown + Variant button */}
                  {(() => {
                    const vs = variantState.get(tc.id);
                    const isSuccess = vs?.phase === 'success';
                    return (
                      <>
                        {!isSuccess && (
                          <div className="flex items-center gap-2 mt-3">
                            <label className="text-xs text-gray-500">Suite:</label>
                            <select
                              value={tc.suite_id}
                              onChange={e => handleSuiteChange(tc.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                            >
                              {suites.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            {!vs && (
                              <button
                                onClick={() => openVariantForm(tc)}
                                className="px-2.5 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
                              >
                                + Variant
                              </button>
                            )}
                          </div>
                        )}

                        {/* Variant form */}
                        {vs?.phase === 'form' && (
                          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">What&apos;s different about this scenario?</label>
                              <textarea
                                value={vs.description}
                                onChange={e => updateVariantField(tc.id, 'description', e.target.value)}
                                placeholder="e.g. Coach already has an existing team"
                                rows={2}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Feature area</label>
                              <p className="text-sm text-gray-600">{formatCategoryLabel(tc.category)}</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Add to suite</label>
                              <select
                                value={vs.suiteChoice === 'new' ? '__new__' : vs.selectedSuiteId}
                                onChange={e => {
                                  const val = e.target.value;
                                  setVariantState(prev => {
                                    const next = new Map(prev);
                                    if (val === '__new__') {
                                      next.set(tc.id, { ...vs, suiteChoice: 'new' });
                                    } else {
                                      next.set(tc.id, { ...vs, suiteChoice: 'existing', selectedSuiteId: val });
                                    }
                                    return next;
                                  });
                                }}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                              >
                                {suites.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                                <option value="__new__">+ New Suite</option>
                              </select>
                              {vs.suiteChoice === 'new' && (
                                <input
                                  type="text"
                                  value={vs.newSuiteName}
                                  onChange={e => {
                                    setVariantState(prev => {
                                      const next = new Map(prev);
                                      next.set(tc.id, { ...vs, newSuiteName: e.target.value });
                                      return next;
                                    });
                                  }}
                                  placeholder="New suite name"
                                  className="w-full mt-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                />
                              )}
                            </div>
                            {vs.error && (
                              <p className="text-sm text-red-600">{vs.error}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVariantGenerate(tc)}
                                disabled={!vs.description.trim() || (vs.suiteChoice === 'new' && !vs.newSuiteName.trim())}
                                className="px-4 py-2 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                              >
                                Generate Preview
                              </button>
                              <button
                                onClick={() => closeVariant(tc.id)}
                                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Generating state */}
                        {vs?.phase === 'generating' && (
                          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
                            <Loader2 size={16} className="animate-spin text-gray-400" />
                            <span className="text-sm text-gray-600">Generating variant...</span>
                          </div>
                        )}

                        {/* Preview */}
                        {vs?.phase === 'preview' && vs.preview && (
                          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">{vs.preview.suiteName}</h4>
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                              <span className="font-semibold">Precondition:</span> {vs.preview.precondition}
                            </div>
                            <p className="text-xs text-gray-500">
                              {vs.preview.setupSteps.length} setup steps, {vs.preview.testSteps.length} test steps
                            </p>
                            {vs.error && <p className="text-sm text-red-600">{vs.error}</p>}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVariantSave(tc.id)}
                                className="px-4 py-2 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                              >
                                Save to Review Queue
                              </button>
                              <button
                                onClick={() => closeVariant(tc.id)}
                                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs transition-colors"
                              >
                                Discard
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Saving state */}
                        {vs?.phase === 'saving' && (
                          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
                            <Loader2 size={16} className="animate-spin text-gray-400" />
                            <span className="text-sm text-gray-600">Saving variant suite...</span>
                          </div>
                        )}

                        {/* Success */}
                        {vs?.phase === 'success' && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle size={14} className="text-green-600" />
                              <span className="text-sm text-green-800">
                                Variant suite created: &ldquo;{vs.savedSuiteName}&rdquo;
                              </span>
                            </div>
                            <button
                              onClick={() => closeVariant(tc.id)}
                              className="text-xs text-green-600 hover:text-green-800 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedCase(isExpanded ? null : tc.id)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-3 transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Hide' : 'Show'} steps ({tc.steps.length})
                  </button>
                </div>

                {/* Expanded steps */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-6 py-4 space-y-4">
                    {/* Setup Steps */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Setup Steps{' '}
                        {setupSteps.length === 0 && !isEditing && (
                          <span className="font-normal normal-case">(none)</span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {setupSteps.map((step, idx) => (
                          <StepRow
                            key={step.id}
                            step={step}
                            isEditing={isEditing}
                            editedStep={edited?.steps[step.id]}
                            onUpdate={(field, value) =>
                              updateEditedStep(tc.id, tc, step.id, field, value)
                            }
                            onDelete={isEditing ? () => handleDeleteStep(step.id) : undefined}
                            onMoveUp={isEditing ? () => handleMoveStep(tc.id, step.id, 'up') : undefined}
                            onMoveDown={isEditing ? () => handleMoveStep(tc.id, step.id, 'down') : undefined}
                            isFirst={idx === 0}
                            isLast={idx === setupSteps.length - 1}
                          />
                        ))}
                      </div>
                      {isEditing && (
                        addingStepTo?.caseId === tc.id && addingStepTo.type === 'setup' ? (
                          <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
                            <input
                              type="text"
                              value={newStepInstruction}
                              onChange={e => setNewStepInstruction(e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                              placeholder="Step instruction"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={newStepExpected}
                              onChange={e => setNewStepExpected(e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900"
                              placeholder="Expected outcome (optional)"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddStep(tc.id, 'setup')}
                                disabled={!newStepInstruction.trim()}
                                className="px-3 py-1 bg-black text-white rounded text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setAddingStepTo(null);
                                  setNewStepInstruction('');
                                  setNewStepExpected('');
                                }}
                                className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingStepTo({ caseId: tc.id, type: 'setup' });
                              setNewStepInstruction('');
                              setNewStepExpected('');
                            }}
                            className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <Plus size={12} /> Add setup step
                          </button>
                        )
                      )}
                    </div>

                    {/* Test Steps */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Test Steps{' '}
                        {testSteps.length === 0 && !isEditing && (
                          <span className="font-normal normal-case">(none)</span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {testSteps.map((step, idx) => (
                          <StepRow
                            key={step.id}
                            step={step}
                            isEditing={isEditing}
                            editedStep={edited?.steps[step.id]}
                            onUpdate={(field, value) =>
                              updateEditedStep(tc.id, tc, step.id, field, value)
                            }
                            onDelete={isEditing ? () => handleDeleteStep(step.id) : undefined}
                            onMoveUp={isEditing ? () => handleMoveStep(tc.id, step.id, 'up') : undefined}
                            onMoveDown={isEditing ? () => handleMoveStep(tc.id, step.id, 'down') : undefined}
                            isFirst={idx === 0}
                            isLast={idx === testSteps.length - 1}
                          />
                        ))}
                      </div>
                      {isEditing && (
                        addingStepTo?.caseId === tc.id && addingStepTo.type === 'test' ? (
                          <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
                            <input
                              type="text"
                              value={newStepInstruction}
                              onChange={e => setNewStepInstruction(e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                              placeholder="Step instruction"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={newStepExpected}
                              onChange={e => setNewStepExpected(e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900"
                              placeholder="Expected outcome (optional)"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddStep(tc.id, 'test')}
                                disabled={!newStepInstruction.trim()}
                                className="px-3 py-1 bg-black text-white rounded text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setAddingStepTo(null);
                                  setNewStepInstruction('');
                                  setNewStepExpected('');
                                }}
                                className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingStepTo({ caseId: tc.id, type: 'test' });
                              setNewStepInstruction('');
                              setNewStepExpected('');
                            }}
                            className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <Plus size={12} /> Add test step
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center gap-2 px-6 pb-5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleApprove(tc.id, tc)}
                        disabled={approving === tc.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        {approving === tc.id && <Loader2 size={14} className="animate-spin" />}
                        Save & Approve
                      </button>
                      <button
                        onClick={() => {
                          setEditingCase(null);
                          setEditedFields(prev => {
                            const next = new Map(prev);
                            next.delete(tc.id);
                            return next;
                          });
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(tc.id, tc)}
                        disabled={approving === tc.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        {approving === tc.id && <Loader2 size={14} className="animate-spin" />}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setEditingCase(tc.id);
                          setExpandedCase(tc.id);
                          setEditedFields(prev => {
                            const next = new Map(prev);
                            if (!next.has(tc.id)) {
                              next.set(tc.id, {
                                title: tc.title,
                                description: tc.description ?? '',
                                steps: {},
                              });
                            }
                            return next;
                          });
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleReject(tc.id)}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
