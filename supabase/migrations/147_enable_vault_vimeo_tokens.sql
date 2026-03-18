-- Migration 147: Vault wrapper functions for encrypted Vimeo token storage
--
-- Supabase Vault is enabled via the Dashboard (Integrations > Vault), not via SQL.
-- These wrapper functions use vault.create_secret() and vault.decrypted_secrets
-- to store and retrieve tokens. Only the service_role can call them.

-- Function to store a secret in the vault
-- Returns the vault secret UUID
create or replace function insert_secret(name text, secret text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return vault.create_secret(secret, name);
end;
$$;

-- Function to read a decrypted secret from the vault by name
create or replace function read_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  into secret;
  return secret;
end;
$$;

-- Function to delete a secret from the vault by name
create or replace function delete_secret(secret_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from vault.decrypted_secrets where name = secret_name;
end;
$$;

-- Restrict access to service_role only
revoke execute on function insert_secret from public;
revoke execute on function insert_secret from anon;
revoke execute on function insert_secret from authenticated;
grant execute on function insert_secret to service_role;

revoke execute on function read_secret from public;
revoke execute on function read_secret from anon;
revoke execute on function read_secret from authenticated;
grant execute on function read_secret to service_role;

revoke execute on function delete_secret from public;
revoke execute on function delete_secret from anon;
revoke execute on function delete_secret from authenticated;
grant execute on function delete_secret to service_role;
