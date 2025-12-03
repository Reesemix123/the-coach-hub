-- Migration 067: Team Add-ons System
-- Allows teams to purchase additional coaches, AI credits, and storage beyond their tier limits

-- Create team_addons table
CREATE TABLE IF NOT EXISTS team_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,

  -- Purchased add-on quantities
  additional_coaches INTEGER DEFAULT 0 CHECK (additional_coaches >= 0),
  additional_ai_credits INTEGER DEFAULT 0 CHECK (additional_ai_credits >= 0),
  additional_storage_gb INTEGER DEFAULT 0 CHECK (additional_storage_gb >= 0),

  -- Stripe tracking
  stripe_subscription_item_id TEXT,

  -- Computed monthly cost (stored for reference, in cents)
  monthly_cost_cents INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(team_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_team_addons_team_id ON team_addons(team_id);

-- Enable RLS
ALTER TABLE team_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_addons
-- Users can view addons for teams they own or are members of
CREATE POLICY "Users can view team addons" ON team_addons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_addons.team_id
      AND (
        t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM team_memberships tm
          WHERE tm.team_id = t.id
          AND tm.user_id = auth.uid()
        )
      )
    )
  );

-- Only team owners can insert/update/delete addons
CREATE POLICY "Team owners can manage addons" ON team_addons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_addons.team_id
      AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_addons.team_id
      AND t.user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_team_addons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_addons_updated_at
  BEFORE UPDATE ON team_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_team_addons_updated_at();

-- Insert default addon_pricing configuration into platform_config
-- Volume-tiered pricing: cheaper per unit as quantity increases
INSERT INTO platform_config (key, value, description)
VALUES (
  'addon_pricing',
  '{
    "coaches": {
      "unit_name": "coach",
      "tiers": [
        { "min": 1, "max": 4, "price_cents": 500 },
        { "min": 5, "max": 9, "price_cents": 400 },
        { "min": 10, "max": null, "price_cents": 300 }
      ]
    },
    "ai_credits": {
      "unit_name": "100 credits",
      "unit_value": 100,
      "tiers": [
        { "min": 1, "max": 4, "price_cents": 1000 },
        { "min": 5, "max": 9, "price_cents": 800 },
        { "min": 10, "max": null, "price_cents": 600 }
      ]
    },
    "storage": {
      "unit_name": "10GB",
      "unit_value": 10,
      "tiers": [
        { "min": 1, "max": 4, "price_cents": 500 },
        { "min": 5, "max": 9, "price_cents": 400 },
        { "min": 10, "max": null, "price_cents": 300 }
      ]
    }
  }'::jsonb,
  'Pricing configuration for add-ons with volume discounts. Each add-on type has tiered pricing where higher quantities get lower per-unit prices.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Grant access to authenticated users
GRANT SELECT ON team_addons TO authenticated;
GRANT INSERT, UPDATE, DELETE ON team_addons TO authenticated;

COMMENT ON TABLE team_addons IS 'Stores purchased add-ons for teams (additional coaches, AI credits, storage)';
COMMENT ON COLUMN team_addons.additional_coaches IS 'Number of extra coach seats purchased beyond tier limit';
COMMENT ON COLUMN team_addons.additional_ai_credits IS 'Extra AI credits purchased (in units of 100)';
COMMENT ON COLUMN team_addons.additional_storage_gb IS 'Extra storage purchased (in units of 10GB)';
COMMENT ON COLUMN team_addons.monthly_cost_cents IS 'Computed monthly add-on cost in cents';
