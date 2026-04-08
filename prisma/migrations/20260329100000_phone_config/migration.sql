-- Phone config for missed-call handling (notification or AI agent mode)
CREATE TABLE "phone_configs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "twilio_number_key" TEXT NOT NULL,
  "forwarding_number" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'NOTIFICATION',
  "agent_id" TEXT REFERENCES "agents"("id") ON DELETE SET NULL,
  "auto_text_template" TEXT NOT NULL DEFAULT 'Hey! Sorry I missed your call. How can I help?',
  "voice_greeting" TEXT NOT NULL DEFAULT 'Thanks for calling. We''ll text you right away.',
  "notification_template" TEXT NOT NULL DEFAULT 'Missed call from {{callerPhone}}. Text them back!',
  "blocklist" JSONB NOT NULL DEFAULT '[]',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "phone_configs_workspace_id_idx" ON "phone_configs"("workspace_id");
CREATE UNIQUE INDEX "phone_configs_workspace_id_twilio_number_key_key"
  ON "phone_configs"("workspace_id", "twilio_number_key");
