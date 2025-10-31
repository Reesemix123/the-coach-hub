-- First, drop ALL existing policies on these tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on games table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'games') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON games';
    END LOOP;

    -- Drop all policies on videos table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'videos') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON videos';
    END LOOP;

    -- Drop all policies on play_instances table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'play_instances') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON play_instances';
    END LOOP;
END $$;

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_instances ENABLE ROW LEVEL SECURITY;

-- GAMES POLICIES
CREATE POLICY "games_select_policy"
  ON games FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "games_insert_policy"
  ON games FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "games_update_policy"
  ON games FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "games_delete_policy"
  ON games FOR DELETE
  USING (auth.uid() = user_id);

-- VIDEOS POLICIES
CREATE POLICY "videos_select_policy"
  ON videos FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

CREATE POLICY "videos_insert_policy"
  ON videos FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

CREATE POLICY "videos_update_policy"
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

CREATE POLICY "videos_delete_policy"
  ON videos FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = videos.game_id
      AND games.user_id = auth.uid()
    )
  );

-- PLAY INSTANCES POLICIES
CREATE POLICY "play_instances_select_policy"
  ON play_instances FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "play_instances_insert_policy"
  ON play_instances FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "play_instances_update_policy"
  ON play_instances FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "play_instances_delete_policy"
  ON play_instances FOR DELETE
  USING (auth.uid() IS NOT NULL);
