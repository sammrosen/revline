-- Add unique constraint on (client_id, email) to prevent duplicate leads
-- First, remove any existing duplicates (keep the most recent one per client+email)

-- Delete duplicates, keeping the one with the latest last_event_at
DELETE FROM leads
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY client_id, email ORDER BY last_event_at DESC) as rn
    FROM leads
  ) t
  WHERE rn > 1
);

-- Add unique constraint
ALTER TABLE leads ADD CONSTRAINT leads_client_id_email_key UNIQUE (client_id, email);

