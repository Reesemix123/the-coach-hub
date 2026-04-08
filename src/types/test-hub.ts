/**
 * Test Hub TypeScript Types
 * Matches database schema from migration 168
 */

export type SuiteStatus = 'draft' | 'active' | 'archived';
export type CaseStatus = 'draft' | 'pending_review' | 'active' | 'archived';
export type CheckoutMode = 'exclusive' | 'parallel';
export type StepType = 'setup' | 'test';
export type SessionStatus = 'active' | 'completed' | 'released';
export type StepCompletionStatus = 'pending' | 'pass' | 'fail' | 'skip';

export interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  status: SuiteStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  suite_id: string;
  title: string;
  description: string | null;
  category: string;
  display_order: number;
  checkout_mode: CheckoutMode;
  status: CaseStatus;
  auto_generated: boolean;
  source_feature_key: string | null;
  sport: string;
  created_at: string;
  updated_at: string;
}

export interface TestStep {
  id: string;
  test_case_id: string;
  step_type: StepType;
  display_order: number;
  instruction: string;
  expected_outcome: string | null;
}

export interface TestSession {
  id: string;
  test_case_id: string;
  tester_id: string;
  status: SessionStatus;
  checked_out_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface TestStepCompletion {
  id: string;
  session_id: string;
  step_id: string;
  status: StepCompletionStatus;
  notes: string | null;
  flagged_issue: boolean;
  completed_at: string | null;
}

export interface TimeLog {
  id: string;
  session_id: string;
  tester_id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}
