-- Migration 149: Add image_url column to direct_messages for photo attachments
--
-- The message-attachments Storage bucket is created via the Supabase dashboard
-- or Storage API. Bucket name: message-attachments (public reads, authenticated writes).

ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
