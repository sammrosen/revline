/*
  Warnings:

  - You are about to drop the column `encrypted_secret` on the `client_integrations` table. All the data in the column will be lost.
  - Made the column `timezone` on table `clients` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "recovery_codes" JSONB,
ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_key_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totp_secret" TEXT;

-- AlterTable
ALTER TABLE "client_integrations" DROP COLUMN "encrypted_secret",
ADD COLUMN     "secrets" JSONB;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "timezone" SET NOT NULL,
ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';
