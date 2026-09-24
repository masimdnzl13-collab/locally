ALTER TABLE action_idempotency ALTER COLUMN response DROP NOT NULL;
ALTER TABLE action_idempotency ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PROCESSING','COMPLETED'));
ALTER TABLE action_idempotency ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE action_idempotency ADD COLUMN IF NOT EXISTS claim_id UUID;
ALTER TABLE action_idempotency ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
ALTER TABLE action_idempotency DROP CONSTRAINT IF EXISTS action_idempotency_pkey;
ALTER TABLE action_idempotency ADD CONSTRAINT action_idempotency_pkey PRIMARY KEY (restaurant_id, action, idempotency_key);
CREATE INDEX IF NOT EXISTS action_idempotency_processing_idx ON action_idempotency(status, updated_at) WHERE status='PROCESSING';
