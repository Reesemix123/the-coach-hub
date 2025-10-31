-- Enable Row Level Security on tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_instances ENABLE ROW LEVEL SECURITY;

-- Games policies
-- Allow users to view all games for their teams
CREATE POLICY "Users can view games for their teams"
  ON games FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to insert games
CREATE POLICY "Users can create games"
  ON games FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own games
CREATE POLICY "Users can update their own games"
  ON games FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own games
CREATE POLICY "Users can delete their own games"
  ON games FOR DELETE
  USING (auth.uid() = user_id);

-- Videos policies
-- Allow users to view videos for games they own
CREATE POLICY "Users can view videos"
  ON videos FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

-- Allow users to insert videos for their games
CREATE POLICY "Users can create videos"
  ON videos FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

-- Allow users to update videos for their games
CREATE POLICY "Users can update videos"
  ON videos FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

-- Allow users to delete videos for their games
CREATE POLICY "Users can delete videos"
  ON videos FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

-- Play instances policies
-- Allow users to view play instances
CREATE POLICY "Users can view play instances"
  ON play_instances FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to create play instances
CREATE POLICY "Users can create play instances"
  ON play_instances FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update play instances
CREATE POLICY "Users can update play instances"
  ON play_instances FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to delete play instances
CREATE POLICY "Users can delete play instances"
  ON play_instances FOR DELETE
  USING (auth.uid() IS NOT NULL);
