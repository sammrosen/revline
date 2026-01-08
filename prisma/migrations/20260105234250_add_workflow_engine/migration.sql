-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "EventSystem" ADD VALUE 'WORKFLOW';

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger_adapter" TEXT NOT NULL,
    "trigger_operation" TEXT NOT NULL,
    "trigger_filter" JSONB,
    "actions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "trigger_adapter" TEXT NOT NULL,
    "trigger_operation" TEXT NOT NULL,
    "trigger_payload" JSONB NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "action_results" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_client_id_enabled_idx" ON "workflows"("client_id", "enabled");

-- CreateIndex
CREATE INDEX "workflows_client_id_trigger_adapter_trigger_operation_idx" ON "workflows"("client_id", "trigger_adapter", "trigger_operation");

-- CreateIndex
CREATE INDEX "workflow_executions_client_id_started_at_idx" ON "workflow_executions"("client_id", "started_at");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_started_at_idx" ON "workflow_executions"("workflow_id", "started_at");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
