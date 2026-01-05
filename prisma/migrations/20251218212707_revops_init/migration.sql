-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('MAILERLITE', 'STRIPE', 'CALENDLY', 'MANYCHAT');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('CAPTURED', 'BOOKED', 'PAID', 'DEAD');

-- CreateEnum
CREATE TYPE "EventSystem" AS ENUM ('BACKEND', 'MAILERLITE', 'STRIPE', 'CALENDLY', 'MANYCHAT', 'CRON');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_integrations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "integration" "IntegrationType" NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "meta" JSONB,
    "health_status" "HealthStatus" NOT NULL DEFAULT 'GREEN',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'CAPTURED',
    "error_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "system" "EventSystem" NOT NULL,
    "event_type" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "client_integrations_client_id_integration_key" ON "client_integrations"("client_id", "integration");

-- CreateIndex
CREATE INDEX "leads_client_id_stage_idx" ON "leads"("client_id", "stage");

-- CreateIndex
CREATE INDEX "leads_client_id_last_event_at_idx" ON "leads"("client_id", "last_event_at");

-- CreateIndex
CREATE INDEX "events_client_id_created_at_idx" ON "events"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "events_success_created_at_idx" ON "events"("success", "created_at");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "client_integrations" ADD CONSTRAINT "client_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
