-- Add pages_config to workspaces
-- Replaces the old REVLINE integration meta for page configuration
-- Stores forms, branding, copy, theme config as a built-in workspace feature
ALTER TABLE "workspaces" ADD COLUMN "pages_config" JSONB;
