-- Add custom lead property schema to workspaces
-- Defines what custom properties leads in this workspace can have
-- JSON array of { key, label, type, required }
ALTER TABLE "workspaces" ADD COLUMN "lead_property_schema" JSONB;

-- Add custom properties to leads
-- Stores actual property values, validated against workspace.lead_property_schema
ALTER TABLE "leads" ADD COLUMN "properties" JSONB;
