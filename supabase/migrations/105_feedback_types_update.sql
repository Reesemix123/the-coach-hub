-- Migration: 105_feedback_types_update.sql
-- Add feature_request and praise as feedback type options

-- Drop existing constraint if it exists
ALTER TABLE feedback_reports
DROP CONSTRAINT IF EXISTS feedback_reports_type_check;

-- Add new constraint with all feedback types
ALTER TABLE feedback_reports
ADD CONSTRAINT feedback_reports_type_check
CHECK (type IN ('bug', 'confusing', 'missing', 'suggestion', 'feature_request', 'praise'));

-- Update comment
COMMENT ON COLUMN feedback_reports.type IS
'Type of feedback: bug, confusing, missing, suggestion, feature_request, praise';
