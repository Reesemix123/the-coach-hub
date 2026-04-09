-- Migration 170: Add precondition column to test_cases
-- Used for scenario-based test generation where a specific state must be
-- established before testing begins.

ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS precondition TEXT;

COMMENT ON COLUMN test_cases.precondition IS 'Precondition that must be established before testing. Used in scenario-based tests.';
