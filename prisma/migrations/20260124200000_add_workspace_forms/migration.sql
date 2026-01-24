-- Workspace Forms for External Capture
-- Enables workspace-scoped form capture from external websites

CREATE TABLE "workspace_forms" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" VARCHAR(128) NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "security" JSONB NOT NULL DEFAULT '{"mode":"browser","allowedOrigins":[],"rateLimitPerIp":10}',
  "allowed_targets" JSONB NOT NULL DEFAULT '["email"]',
  "trigger_name" TEXT NOT NULL DEFAULT 'form_captured',
  "capture_count" INTEGER NOT NULL DEFAULT 0,
  "last_capture_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for workspace lookups
CREATE INDEX "idx_workspace_forms_workspace" ON "workspace_forms"("workspace_id");
