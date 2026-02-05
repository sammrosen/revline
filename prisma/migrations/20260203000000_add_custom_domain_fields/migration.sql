-- Add custom domain fields to workspaces table
-- Used for white-label domain routing

-- Add columns
ALTER TABLE "workspaces" ADD COLUMN "custom_domain" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "domain_verify_token" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "domain_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN "domain_verified_at" TIMESTAMP(3);

-- Add unique constraint on custom_domain
CREATE UNIQUE INDEX "workspaces_custom_domain_key" ON "workspaces"("custom_domain");
