-- Add metadata JSON column to events table for rich debugging context
ALTER TABLE "events" ADD COLUMN "metadata" JSONB;
