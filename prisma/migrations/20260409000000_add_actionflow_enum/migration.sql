-- Add ACTIONFLOW to IntegrationType and EventSystem enums.

ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'ACTIONFLOW';
ALTER TYPE "EventSystem" ADD VALUE IF NOT EXISTS 'ACTIONFLOW';
