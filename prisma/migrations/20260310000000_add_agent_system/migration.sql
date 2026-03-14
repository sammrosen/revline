-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ESCALATED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "EventSystem" ADD VALUE 'TWILIO';
ALTER TYPE "EventSystem" ADD VALUE 'OPENAI';
ALTER TYPE "EventSystem" ADD VALUE 'ANTHROPIC';
ALTER TYPE "EventSystem" ADD VALUE 'AGENT';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'TWILIO';
ALTER TYPE "IntegrationType" ADD VALUE 'OPENAI';
ALTER TYPE "IntegrationType" ADD VALUE 'ANTHROPIC';

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel_type" TEXT,
    "channel_integration" TEXT,
    "channel_address" TEXT,
    "ai_integration" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "initial_message" TEXT,
    "model_override" TEXT,
    "temperature_override" DOUBLE PRECISION,
    "max_tokens_override" INTEGER,
    "max_messages_per_conversation" INTEGER NOT NULL DEFAULT 50,
    "max_tokens_per_conversation" INTEGER NOT NULL DEFAULT 100000,
    "conversation_timeout_minutes" INTEGER NOT NULL DEFAULT 1440,
    "response_delay_seconds" INTEGER NOT NULL DEFAULT 0,
    "auto_resume_minutes" INTEGER NOT NULL DEFAULT 60,
    "rate_limit_per_hour" INTEGER NOT NULL DEFAULT 10,
    "fallback_message" TEXT,
    "escalation_pattern" TEXT,
    "faq_overrides" JSONB,
    "allowed_events" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_files" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "text_content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "channel" TEXT NOT NULL,
    "contact_address" TEXT NOT NULL,
    "channel_address" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMP(3),
    "paused_by" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opt_out_records" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contact_address" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'agent',
    "agent_id" TEXT,
    "conversation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opt_out_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_workspace_id_active_idx" ON "agents"("workspace_id", "active");

-- CreateIndex
CREATE INDEX "agent_files_agent_id_idx" ON "agent_files"("agent_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_status_idx" ON "conversations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "conversations_agent_id_status_idx" ON "conversations"("agent_id", "status");

-- CreateIndex
CREATE INDEX "conversations_contact_address_channel_address_status_idx" ON "conversations"("contact_address", "channel_address", "status");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_created_at_idx" ON "conversation_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "opt_out_records_workspace_id_contact_address_key" ON "opt_out_records"("workspace_id", "contact_address");

-- CreateIndex
CREATE INDEX "opt_out_records_workspace_id_idx" ON "opt_out_records"("workspace_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_files" ADD CONSTRAINT "agent_files_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opt_out_records" ADD CONSTRAINT "opt_out_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
