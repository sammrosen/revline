-- Convert LeadStage enum to plain text column
-- Existing values (CAPTURED, BOOKED, PAID, DEAD) are preserved as strings

-- Step 1: Drop the existing default (it references the enum type)
ALTER TABLE "leads" ALTER COLUMN "stage" DROP DEFAULT;

-- Step 2: Convert the stage column from enum to text
ALTER TABLE "leads" ALTER COLUMN "stage" TYPE TEXT;

-- Step 3: Drop the enum type (no longer needed)
DROP TYPE "LeadStage";

-- Step 4: Re-add the default as text
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'CAPTURED';

-- Step 5: Add lead_stages JSON config to workspaces
ALTER TABLE "workspaces" ADD COLUMN "lead_stages" JSONB NOT NULL DEFAULT '[{"key":"CAPTURED","label":"Captured","color":"#6B7280"},{"key":"BOOKED","label":"Booked","color":"#3B82F6"},{"key":"PAID","label":"Paid","color":"#10B981"},{"key":"DEAD","label":"Dead","color":"#EF4444"}]';
