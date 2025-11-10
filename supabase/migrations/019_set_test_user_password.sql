-- Set password for test user account
-- This ensures the test account can log in with password authentication

-- Update the test user's password
-- Replace 'titanfirstread@gmail.com' if you used a different email
UPDATE auth.users
SET
  encrypted_password = crypt('Test1!', gen_salt('bf')),
  email_confirmed_at = NOW(),
  confirmation_token = '',
  recovery_token = ''
WHERE email = 'titanfirstread@gmail.com';

-- Verify the update
SELECT id, email, email_confirmed_at, encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = 'titanfirstread@gmail.com';
