-- ============================================================================
-- Migration 184: Game lineups — per-game roster snapshots
-- ============================================================================
-- APPEND-ONLY TABLE: Every lineup change is a new INSERT with recorded_at
-- defaulting to now(). Never UPDATE or DELETE existing rows — this preserves
-- a full history of lineup changes throughout a game.
-- ============================================================================

CREATE TABLE game_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  depth INTEGER NOT NULL CHECK (depth BETWEEN 1 AND 4),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE game_lineups IS 'Append-only per-game lineup snapshots. Each row records a player/position/depth assignment at a point in time. Use latest_game_lineup() to get the current state.';

-- Indexes
CREATE INDEX idx_game_lineups_game_team ON game_lineups(game_id, team_id);
CREATE INDEX idx_game_lineups_game_player ON game_lineups(game_id, player_id);
CREATE INDEX idx_game_lineups_recorded ON game_lineups(game_id, recorded_at);

-- RLS
ALTER TABLE game_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team game lineups"
  ON game_lineups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = game_lineups.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create game lineups for their teams"
  ON game_lineups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = game_lineups.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies — this table is append-only by design.

-- Helper function: get the most recent lineup snapshot for a game.
-- Returns one row per player_id with the latest recorded_at.
CREATE OR REPLACE FUNCTION latest_game_lineup(game_id_param UUID, team_id_param UUID)
RETURNS TABLE (
  player_id UUID,
  position TEXT,
  depth INTEGER,
  recorded_at TIMESTAMPTZ
) AS $$
  SELECT DISTINCT ON (gl.player_id)
    gl.player_id,
    gl.position,
    gl.depth,
    gl.recorded_at
  FROM game_lineups gl
  WHERE gl.game_id = game_id_param
    AND gl.team_id = team_id_param
  ORDER BY gl.player_id, gl.recorded_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
