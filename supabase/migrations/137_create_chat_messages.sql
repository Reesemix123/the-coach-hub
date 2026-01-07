-- Migration: Create chat_messages table for AI Assistant conversation logging
-- Purpose: Store chat interactions for quality improvement, usage analysis, and AI training

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Classification metadata (from intent classifier)
  intent TEXT, -- 'help', 'coaching', 'general'
  topic TEXT, -- 'tendencies', 'plays', 'opponent_scouting', etc.

  -- Context
  session_id UUID, -- Groups messages in same conversation session

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_team_id ON chat_messages(team_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_intent ON chat_messages(intent);
CREATE INDEX idx_chat_messages_topic ON chat_messages(topic);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own chat messages
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chat messages
CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access to chat messages"
  ON chat_messages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Comment on table
COMMENT ON TABLE chat_messages IS 'Stores AI Assistant chat interactions for quality improvement and usage analysis';
COMMENT ON COLUMN chat_messages.intent IS 'Classified intent: help (documentation), coaching (team data), general';
COMMENT ON COLUMN chat_messages.topic IS 'Extracted topic: tendencies, plays, opponent_scouting, schedule, practice, etc.';
COMMENT ON COLUMN chat_messages.session_id IS 'Groups messages from the same conversation session';
