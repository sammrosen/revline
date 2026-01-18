-- Multi-user support migration
-- Renames Admin → User, AdminSession → Session, adds WorkspaceMember join table

-- Step 1: Create the WorkspaceRole enum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- Step 2: Add email and name columns to admins table (before rename)
ALTER TABLE "admins" ADD COLUMN "email" TEXT;
ALTER TABLE "admins" ADD COLUMN "name" TEXT;

-- Step 3: Rename admins table to users
ALTER TABLE "admins" RENAME TO "users";

-- Step 4: Make email NOT NULL and UNIQUE (after setting a default for existing row)
-- This will be handled by the backfill script, but we need the constraint
-- For now, set a placeholder that must be updated
UPDATE "users" SET "email" = 'admin@placeholder.local' WHERE "email" IS NULL;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- Step 5: Drop the foreign key constraint on admin_sessions before renaming
ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "admin_sessions_admin_id_fkey";

-- Step 6: Rename admin_sessions table to sessions
ALTER TABLE "admin_sessions" RENAME TO "sessions";

-- Step 7: Rename admin_id column to user_id in sessions
ALTER TABLE "sessions" RENAME COLUMN "admin_id" TO "user_id";

-- Step 8: Recreate the foreign key constraint with new names
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Add created_by_id to workspaces
ALTER TABLE "workspaces" ADD COLUMN "created_by_id" TEXT;

-- Step 10: Create workspace_members table
CREATE TABLE "workspace_members" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'ADMIN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- Step 11: Add unique constraint and indexes to workspace_members
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_workspace_id_key" UNIQUE ("user_id", "workspace_id");
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- Step 12: Add foreign key constraints to workspace_members
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" 
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
