-- Add PIPEDRIVE to IntegrationType and EventSystem enums.
-- This migration backfills schema drift from Pipedrive Phases 1+2 which
-- added the enum values in schema.prisma without a corresponding migration.

ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'PIPEDRIVE';
ALTER TYPE "EventSystem" ADD VALUE IF NOT EXISTS 'PIPEDRIVE';
