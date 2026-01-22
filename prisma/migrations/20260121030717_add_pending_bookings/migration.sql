-- CreateEnum
CREATE TYPE "PendingBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "sessions" RENAME CONSTRAINT "admin_sessions_pkey" TO "sessions_pkey";

-- AlterTable
ALTER TABLE "users" RENAME CONSTRAINT "admins_pkey" TO "users_pkey";

-- AlterTable
ALTER TABLE "workspace_integrations" RENAME CONSTRAINT "client_integrations_pkey" TO "workspace_integrations_pkey";

-- AlterTable
ALTER TABLE "workspaces" RENAME CONSTRAINT "clients_pkey" TO "workspaces_pkey";

-- CreateTable
CREATE TABLE "pending_bookings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_name" TEXT,
    "staff_id" TEXT,
    "staff_name" TEXT,
    "service_id" TEXT,
    "service_name" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "provider_data" JSONB,
    "token_hash" TEXT NOT NULL,
    "status" "PendingBookingStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "external_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_bookings_token_hash_key" ON "pending_bookings"("token_hash");

-- CreateIndex
CREATE INDEX "pending_bookings_token_hash_idx" ON "pending_bookings"("token_hash");

-- CreateIndex
CREATE INDEX "pending_bookings_workspace_id_customer_id_status_idx" ON "pending_bookings"("workspace_id", "customer_id", "status");

-- CreateIndex
CREATE INDEX "pending_bookings_workspace_id_provider_idx" ON "pending_bookings"("workspace_id", "provider");

-- CreateIndex
CREATE INDEX "pending_bookings_expires_at_idx" ON "pending_bookings"("expires_at");

-- RenameForeignKey
ALTER TABLE "events" RENAME CONSTRAINT "events_client_id_fkey" TO "events_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "idempotency_keys" RENAME CONSTRAINT "idempotency_keys_client_id_fkey" TO "idempotency_keys_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "leads" RENAME CONSTRAINT "leads_client_id_fkey" TO "leads_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "webhook_events" RENAME CONSTRAINT "webhook_events_client_id_fkey" TO "webhook_events_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "workflow_executions" RENAME CONSTRAINT "workflow_executions_client_id_fkey" TO "workflow_executions_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "workflows" RENAME CONSTRAINT "workflows_client_id_fkey" TO "workflows_workspace_id_fkey";

-- RenameForeignKey
ALTER TABLE "workspace_integrations" RENAME CONSTRAINT "client_integrations_client_id_fkey" TO "workspace_integrations_workspace_id_fkey";

-- AddForeignKey
ALTER TABLE "pending_bookings" ADD CONSTRAINT "pending_bookings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "admin_sessions_expires_at_idx" RENAME TO "sessions_expires_at_idx";

-- RenameIndex
ALTER INDEX "clients_slug_key" RENAME TO "workspaces_slug_key";
