ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_status_values') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_status_values CHECK (status IN ('QUEUED','SENDING','SENT','DELIVERED','FAILED','UNDELIVERED'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS outbox_processing_recovery_idx ON outbox_events(status,available_at) WHERE status='PROCESSING';
CREATE INDEX IF NOT EXISTS notifications_event_idx ON notifications(restaurant_id,outbox_event_id);
