-- Add index on agent_id FK to avoid sequential scans when querying phone configs by agent
CREATE INDEX "phone_configs_agent_id_idx" ON "phone_configs"("agent_id");
