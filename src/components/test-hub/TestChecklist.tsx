'use client';

import { useMemo } from 'react';
import { StepItem } from './StepItem';

// ============================================
// TYPES
// ============================================

type StepType = 'setup' | 'test';
type StepStatus = 'pending' | 'pass' | 'fail' | 'skip';

interface ChecklistStep {
  id: string;
  step_type: StepType;
  display_order: number;
  instruction: string;
  expected_outcome: string | null;
}

interface StepCompletion {
  id: string;
  status: StepStatus;
  notes: string | null;
  flagged_issue: boolean;
}

interface TestChecklistProps {
  steps: ChecklistStep[];
  sessionId: string;
  completions: Map<string, StepCompletion>;
  onUpdate: (
    stepId: string,
    data: { status: string; notes?: string; flagged_issue?: boolean }
  ) => void;
}

// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
      {label}
    </p>
  );
}

// ============================================
// COMPONENT
// ============================================

export function TestChecklist({
  steps,
  completions,
  onUpdate,
}: TestChecklistProps) {
  const { setupSteps, testSteps } = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.display_order - b.display_order);
    return {
      setupSteps: sorted.filter((s) => s.step_type === 'setup'),
      testSteps: sorted.filter((s) => s.step_type === 'test'),
    };
  }, [steps]);

  const renderStep = (step: ChecklistStep) => (
    <StepItem
      key={step.id}
      step={step}
      completion={completions.get(step.id) ?? null}
      onUpdate={onUpdate}
    />
  );

  return (
    <div>
      {setupSteps.length > 0 && (
        <div className="mb-6">
          <SectionHeader label="Setup" />
          {setupSteps.map(renderStep)}
        </div>
      )}

      <div>
        <SectionHeader label="Test Steps" />
        {testSteps.map(renderStep)}

        {testSteps.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No test steps defined.
          </p>
        )}
      </div>
    </div>
  );
}
