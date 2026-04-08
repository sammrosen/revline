-- AlterTable
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "guardrails" JSONB NOT NULL DEFAULT '{}';
