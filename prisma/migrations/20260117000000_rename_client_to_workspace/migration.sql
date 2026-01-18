-- Rename Client -> Workspace throughout the schema
-- This migration renames all client-related tables, columns, and enums to workspace

-- Step 1: Rename the ClientStatus enum to WorkspaceStatus
ALTER TYPE "ClientStatus" RENAME TO "WorkspaceStatus";

-- Step 2: Rename the clients table to workspaces
ALTER TABLE "clients" RENAME TO "workspaces";

-- Step 3: Rename the client_integrations table to workspace_integrations
ALTER TABLE "client_integrations" RENAME TO "workspace_integrations";

-- Step 4: Rename client_id columns to workspace_id in all tables

-- workspace_integrations (formerly client_integrations)
ALTER TABLE "workspace_integrations" RENAME COLUMN "client_id" TO "workspace_id";

-- leads
ALTER TABLE "leads" RENAME COLUMN "client_id" TO "workspace_id";

-- events
ALTER TABLE "events" RENAME COLUMN "client_id" TO "workspace_id";

-- workflows
ALTER TABLE "workflows" RENAME COLUMN "client_id" TO "workspace_id";

-- workflow_executions
ALTER TABLE "workflow_executions" RENAME COLUMN "client_id" TO "workspace_id";

-- webhook_events
ALTER TABLE "webhook_events" RENAME COLUMN "client_id" TO "workspace_id";

-- idempotency_keys
ALTER TABLE "idempotency_keys" RENAME COLUMN "client_id" TO "workspace_id";

-- Step 5: Rename foreign key constraints (PostgreSQL auto-renames with columns, but let's be explicit about indexes)
-- Note: PostgreSQL handles FK constraint renames automatically when table/column names change

-- Step 6: Rename indexes that reference "client" in their names
-- workspace_integrations indexes
ALTER INDEX IF EXISTS "client_integrations_client_id_integration_key" RENAME TO "workspace_integrations_workspace_id_integration_key";

-- leads indexes  
ALTER INDEX IF EXISTS "leads_client_id_email_key" RENAME TO "leads_workspace_id_email_key";
ALTER INDEX IF EXISTS "leads_client_id_stage_idx" RENAME TO "leads_workspace_id_stage_idx";
ALTER INDEX IF EXISTS "leads_client_id_last_event_at_idx" RENAME TO "leads_workspace_id_last_event_at_idx";

-- events indexes
ALTER INDEX IF EXISTS "events_client_id_created_at_idx" RENAME TO "events_workspace_id_created_at_idx";

-- workflows indexes
ALTER INDEX IF EXISTS "workflows_client_id_enabled_idx" RENAME TO "workflows_workspace_id_enabled_idx";
ALTER INDEX IF EXISTS "workflows_client_id_trigger_adapter_trigger_operation_idx" RENAME TO "workflows_workspace_id_trigger_adapter_trigger_operation_idx";

-- workflow_executions indexes
ALTER INDEX IF EXISTS "workflow_executions_client_id_started_at_idx" RENAME TO "workflow_executions_workspace_id_started_at_idx";

-- webhook_events indexes
ALTER INDEX IF EXISTS "webhook_events_client_id_provider_provider_event_id_key" RENAME TO "webhook_events_workspace_id_provider_provider_event_id_key";

-- idempotency_keys indexes
ALTER INDEX IF EXISTS "idempotency_keys_client_id_key_key" RENAME TO "idempotency_keys_workspace_id_key_key";
