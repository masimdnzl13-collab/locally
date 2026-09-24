ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IS NULL OR result IN ('SUCCESS','FAILED','SUPPRESSED'));
CREATE INDEX IF NOT EXISTS audit_events_tenant_correlation_idx ON audit_events(restaurant_id, correlation_id);
