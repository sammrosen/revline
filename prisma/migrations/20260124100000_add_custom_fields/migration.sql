-- Custom Field Definitions per Workspace
-- Allows workspaces to define their own fields for leads (e.g., barcode, membershipType)

-- Create custom field definitions table
CREATE TABLE "lead_custom_field_definitions" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "key" VARCHAR(64) NOT NULL,
  "label" VARCHAR(128) NOT NULL,
  "field_type" VARCHAR(16) NOT NULL DEFAULT 'TEXT',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "default_value" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Field type must be one of: TEXT, NUMBER, DATE
  CONSTRAINT "valid_field_type" CHECK ("field_type" IN ('TEXT', 'NUMBER', 'DATE')),
  -- Key must start with letter, contain only alphanumeric and underscore, max 63 chars
  CONSTRAINT "valid_key_format" CHECK ("key" ~ '^[a-zA-Z][a-zA-Z0-9_]{0,62}$'),
  -- Unique key per workspace
  UNIQUE("workspace_id", "key")
);

-- Index for efficient workspace lookups
CREATE INDEX "idx_custom_field_defs_workspace" ON "lead_custom_field_definitions"("workspace_id");

-- Add custom data column to leads for storing custom field values
-- JSONB allows efficient querying and indexing of JSON data
ALTER TABLE "leads" ADD COLUMN "custom_data" JSONB;
