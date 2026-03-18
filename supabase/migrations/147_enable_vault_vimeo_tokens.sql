-- Migration 147: Enable Supabase Vault for encrypted Vimeo token storage
--
-- Vault stores sensitive data (API tokens) encrypted at rest.
-- We create helper functions so application code never touches raw tokens directly.

-- Enable the vault extension
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Function to store a Vimeo access token in the vault
-- Returns the vault secret ID (UUID) for storing in coach_external_accounts
CREATE OR REPLACE FUNCTION store_vimeo_token(p_coach_id UUID, p_access_token TEXT)
RETURNS UUID AS $$
DECLARE
  secret_id UUID;
  secret_name TEXT;
BEGIN
  secret_name := 'vimeo_token_' || p_coach_id::TEXT;

  -- Delete existing secret if any (update scenario)
  DELETE FROM vault.secrets WHERE name = secret_name;

  -- Insert new secret
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (secret_name, p_access_token, 'Vimeo access token for coach ' || p_coach_id::TEXT)
  RETURNING id INTO secret_id;

  RETURN secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retrieve a decrypted Vimeo token from the vault
CREATE OR REPLACE FUNCTION get_vimeo_token(p_vault_id UUID)
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  SELECT decrypted_secret INTO token
  FROM vault.decrypted_secrets
  WHERE id = p_vault_id;

  RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a Vimeo token from the vault
CREATE OR REPLACE FUNCTION delete_vimeo_token(p_vault_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_vault_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (functions are SECURITY DEFINER so they run as owner)
GRANT EXECUTE ON FUNCTION store_vimeo_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_vimeo_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_vimeo_token(UUID) TO authenticated;
