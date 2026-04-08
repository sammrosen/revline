-- Multi-channel agents: add channels JSON array to agents
ALTER TABLE "agents" ADD COLUMN "channels" JSONB NOT NULL DEFAULT '[]';

-- Backfill channels from deprecated single-channel fields
UPDATE "agents"
SET "channels" = jsonb_build_array(
  jsonb_build_object(
    'channel', "channel_type",
    'integration', "channel_integration",
    'address', "channel_address"
  )
)
WHERE "channel_type" IS NOT NULL AND "channel_integration" IS NOT NULL;

-- Add channel_integration to conversations for sendReply decoupling
ALTER TABLE "conversations" ADD COLUMN "channel_integration" TEXT;

-- Backfill conversation channel_integration from channel field
UPDATE "conversations" SET "channel_integration" = 'TWILIO' WHERE "channel" = 'SMS' AND "channel_integration" IS NULL;
UPDATE "conversations" SET "channel_integration" = 'RESEND' WHERE "channel" = 'EMAIL' AND "channel_integration" IS NULL;

-- Create webchat_configs table
CREATE TABLE "webchat_configs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_color" TEXT NOT NULL DEFAULT '#2563eb',
    "chat_name" TEXT NOT NULL DEFAULT 'Chat',
    "collect_email" BOOLEAN NOT NULL DEFAULT true,
    "collect_phone" BOOLEAN NOT NULL DEFAULT false,
    "greeting" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webchat_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webchat_configs_workspace_id_idx" ON "webchat_configs"("workspace_id");

ALTER TABLE "webchat_configs" ADD CONSTRAINT "webchat_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webchat_configs" ADD CONSTRAINT "webchat_configs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
