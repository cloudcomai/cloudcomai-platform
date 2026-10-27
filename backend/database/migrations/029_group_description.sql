-- Add persistent group descriptions (up to 256 Unicode characters).
-- Existing installations: apply this migration once.
ALTER TABLE chats ADD COLUMN group_description VARCHAR(256) NOT NULL DEFAULT '' AFTER group_category;
