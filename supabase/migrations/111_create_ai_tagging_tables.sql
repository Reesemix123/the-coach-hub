-- Migration: 111_create_ai_tagging_tables.sql
-- Purpose: Create tables for AI-assisted film tagging
-- Features:
--   - Film quality assessments (one per video)
--   - AI tag predictions with confidence scores
--   - Correction tracking for training data
--   - Gemini file URI cache for video uploads

-- ============================================================================
-- GEMINI FILE CACHE
-- Caches Gemini File API URIs to avoid re-uploading videos
-- Files are valid for 48 hours in Gemini's system
-- ============================================================================

CREATE TABLE IF NOT EXISTS gemini_file_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,

  -- Gemini File API response
  file_uri TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT DEFAULT 'video/mp4',

  -- Expiration tracking (Gemini files expire after 48 hours)
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '47 hours'), -- 1 hour buffer

  -- Metadata
  file_size_bytes BIGINT,
  upload_duration_ms INTEGER,

  UNIQUE(video_id)
);

CREATE INDEX idx_gemini_cache_video ON gemini_file_cache(video_id);
CREATE INDEX idx_gemini_cache_expires ON gemini_file_cache(expires_at);

-- ============================================================================
-- FILM QUALITY ASSESSMENTS
-- One-time assessment per video to determine AI capabilities
-- ============================================================================

CREATE TABLE IF NOT EXISTS film_quality_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Visual quality
  camera_angle TEXT CHECK (camera_angle IN ('sideline', 'endzone', 'elevated', 'drone', 'mixed', 'unknown')),
  stability TEXT CHECK (stability IN ('steady', 'moderate', 'shaky', 'unknown')),
  field_visibility TEXT CHECK (field_visibility IN ('full', 'partial', 'limited', 'unknown')),
  quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),

  -- Audio quality
  audio_available BOOLEAN DEFAULT false,
  audio_quality TEXT CHECK (audio_quality IN ('good', 'moderate', 'poor', 'none')),
  can_hear_whistle BOOLEAN DEFAULT false,
  can_hear_cadence BOOLEAN DEFAULT false,

  -- AI capability assessment (what AI can reliably detect)
  ai_capabilities JSONB DEFAULT '{}'::jsonb,
  /* Structure:
  {
    "play_type": { "expected_confidence": "high", "notes": "" },
    "direction": { "expected_confidence": "medium", "notes": "" },
    "formation": { "expected_confidence": "low", "notes": "Distance limits detail" },
    ...
  }
  */

  -- Improvement suggestions for coach
  improvement_tips JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT,

  UNIQUE(video_id)
);

CREATE INDEX idx_film_quality_video ON film_quality_assessments(video_id);
CREATE INDEX idx_film_quality_team ON film_quality_assessments(team_id);

-- ============================================================================
-- AI TAG PREDICTIONS
-- Stores AI predictions for each play with confidence scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_tag_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_instance_id UUID REFERENCES play_instances(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Which tier/model was used
  tagging_tier TEXT NOT NULL CHECK (tagging_tier IN ('quick', 'standard', 'comprehensive')),
  model_used TEXT NOT NULL, -- 'gemini-2.0-flash', 'gemini-2.0-pro', etc.

  -- Clip timestamps (seconds)
  clip_start_seconds DECIMAL NOT NULL,
  clip_end_seconds DECIMAL NOT NULL,

  -- Predictions with confidence (0-100)
  predictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  /* Structure:
  {
    "play_type": { "value": "pass", "confidence": 85 },
    "direction": { "value": "right", "confidence": 72 },
    "formation": { "value": "shotgun", "confidence": 65 },
    "result": { "value": "complete", "confidence": 90 },
    "yards_gained": { "value": 8, "confidence": 45 },
    ...
  }
  */

  -- Summary metrics
  overall_confidence INTEGER CHECK (overall_confidence BETWEEN 0 AND 100),
  fields_analyzed TEXT[] DEFAULT '{}',
  fields_uncertain TEXT[] DEFAULT '{}', -- Fields with confidence < 50

  -- Cost tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,

  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_video ON ai_tag_predictions(video_id);
CREATE INDEX idx_predictions_play ON ai_tag_predictions(play_instance_id);
CREATE INDEX idx_predictions_team ON ai_tag_predictions(team_id);
CREATE INDEX idx_predictions_tier ON ai_tag_predictions(tagging_tier);
CREATE INDEX idx_predictions_status ON ai_tag_predictions(status);

-- ============================================================================
-- AI TAG CORRECTIONS
-- Training data: captures when coaches correct AI predictions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_tag_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES ai_tag_predictions(id) ON DELETE CASCADE,
  play_instance_id UUID REFERENCES play_instances(id) ON DELETE CASCADE,

  -- The correction
  field_name TEXT NOT NULL,
  ai_value TEXT, -- What AI predicted
  ai_confidence INTEGER, -- AI's confidence (0-100)
  coach_value TEXT NOT NULL, -- What coach corrected to

  -- Context for future training (denormalized for analysis)
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  clip_start_seconds DECIMAL,
  clip_end_seconds DECIMAL,

  -- Film characteristics
  film_quality_score INTEGER,
  camera_angle TEXT,
  audio_available BOOLEAN,

  -- Team context (for team-specific patterns)
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_level TEXT, -- '8U', '10U', '12U', 'Middle School', 'High School', etc.

  -- Attribution
  corrected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_prediction ON ai_tag_corrections(prediction_id);
CREATE INDEX idx_corrections_field ON ai_tag_corrections(field_name);
CREATE INDEX idx_corrections_team ON ai_tag_corrections(team_id);
CREATE INDEX idx_corrections_user ON ai_tag_corrections(corrected_by);

-- ============================================================================
-- AI TAGGING USAGE TRACKING
-- Track AI tagging usage per team for billing/limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_tagging_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Usage period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Counts
  plays_analyzed INTEGER DEFAULT 0,
  quick_tier_count INTEGER DEFAULT 0,
  standard_tier_count INTEGER DEFAULT 0,
  comprehensive_tier_count INTEGER DEFAULT 0,

  -- Costs
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- Quality metrics
  total_corrections INTEGER DEFAULT 0,
  correction_rate DECIMAL(5, 4), -- corrections / plays_analyzed

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, period_start)
);

CREATE INDEX idx_usage_team ON ai_tagging_usage(team_id);
CREATE INDEX idx_usage_period ON ai_tagging_usage(period_start, period_end);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE gemini_file_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tag_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tag_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tagging_usage ENABLE ROW LEVEL SECURITY;

-- Gemini file cache: Team members can access their team's cached files
CREATE POLICY "Team members can view gemini cache" ON gemini_file_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM videos v
      JOIN games g ON v.game_id = g.id
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE v.id = gemini_file_cache.video_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert gemini cache" ON gemini_file_cache
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos v
      JOIN games g ON v.game_id = g.id
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE v.id = video_id
      AND tm.user_id = auth.uid()
    )
  );

-- Film quality assessments: Team members can view/create
CREATE POLICY "Team members can view film quality" ON film_quality_assessments
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert film quality" ON film_quality_assessments
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

-- AI predictions: Team members can view/create
CREATE POLICY "Team members can view predictions" ON ai_tag_predictions
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert predictions" ON ai_tag_predictions
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

-- Corrections: Team members can view, anyone can insert their own
CREATE POLICY "Team members can view corrections" ON ai_tag_corrections
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own corrections" ON ai_tag_corrections
  FOR INSERT WITH CHECK (
    corrected_by = auth.uid()
  );

-- Usage: Team members can view their team's usage
CREATE POLICY "Team members can view usage" ON ai_tagging_usage
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTION: Clean expired Gemini cache entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_gemini_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM gemini_file_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE gemini_file_cache IS 'Caches Gemini File API URIs to avoid re-uploading videos (48-hour expiry)';
COMMENT ON TABLE film_quality_assessments IS 'One-time AI assessment of video quality and detection capabilities';
COMMENT ON TABLE ai_tag_predictions IS 'AI predictions for play tagging with confidence scores';
COMMENT ON TABLE ai_tag_corrections IS 'Training data: coach corrections to AI predictions';
COMMENT ON TABLE ai_tagging_usage IS 'AI tagging usage tracking per team for billing';
