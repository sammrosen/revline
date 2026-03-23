-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('MARKETING', 'TRANSACTIONAL');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('WEB_FORM', 'SMS_KEYWORD', 'IN_PERSON', 'API');

-- AlterTable (Agent - add follow-up and encoding fields)
ALTER TABLE "agents" ADD COLUMN "allow_unicode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agents" ADD COLUMN "follow_up_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agents" ADD COLUMN "follow_up_ai_generated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "agents" ADD COLUMN "follow_up_sequence" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "contact_address" TEXT NOT NULL,
    "channel_address" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "skip_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "message_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contact_address" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "consent_type" "ConsentType" NOT NULL DEFAULT 'MARKETING',
    "method" "ConsentMethod" NOT NULL DEFAULT 'WEB_FORM',
    "language_presented" TEXT NOT NULL DEFAULT '',
    "ip_address" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_ups_workspace_id_idx" ON "follow_ups"("workspace_id");
CREATE INDEX "follow_ups_conversation_id_status_idx" ON "follow_ups"("conversation_id", "status");
CREATE INDEX "follow_ups_status_scheduled_at_idx" ON "follow_ups"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_workspace_id_contact_address_channel_key" ON "consent_records"("workspace_id", "contact_address", "channel");
CREATE INDEX "consent_records_workspace_id_idx" ON "consent_records"("workspace_id");
CREATE INDEX "consent_records_workspace_id_contact_address_idx" ON "consent_records"("workspace_id", "contact_address");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
