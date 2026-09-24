CREATE TABLE restaurant_phone_numbers (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'AI', active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restaurant_phone_number_type CHECK (type IN ('PRIMARY','AI','OTHER')),
  UNIQUE(phone_number)
);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS voice_config JSONB NOT NULL DEFAULT '{}';
CREATE INDEX restaurant_phone_numbers_restaurant_id_idx ON restaurant_phone_numbers(restaurant_id);
CREATE INDEX restaurant_phone_numbers_active_phone_idx ON restaurant_phone_numbers(phone_number) WHERE active;
CREATE TABLE calls (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL, provider_call_id TEXT NOT NULL, caller_phone_number TEXT, called_phone_number TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'INBOUND', status TEXT NOT NULL DEFAULT 'RINGING', started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, duration_seconds INTEGER, language TEXT, initial_intent TEXT,
  termination_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT call_direction CHECK (direction IN ('INBOUND','OUTBOUND')),
  CONSTRAINT call_status CHECK (status IN ('RINGING','IN_PROGRESS','COMPLETED','FAILED','NO_ANSWER','BUSY','TRANSFERRED')),
  UNIQUE(provider, provider_call_id)
);
CREATE INDEX calls_restaurant_id_idx ON calls(restaurant_id); CREATE INDEX calls_started_at_idx ON calls(started_at); CREATE INDEX calls_status_idx ON calls(status);
-- 002 already creates call_sessions for the AI orchestration model. Extend that
-- table in place so fresh and already-migrated databases converge on the voice
-- model without a duplicate-table failure.
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS call_id UUID;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'INITIALIZING';
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS detected_language TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS conversation_metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS active_intent TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS termination_reason TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The pre-voice orchestration row has no provider call id. Voice sessions are
-- keyed by call_id instead, so keep the legacy column for existing data but do
-- not require it for new voice sessions.
ALTER TABLE call_sessions ALTER COLUMN provider_call_id DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_sessions_call_id_key') THEN
    ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_call_id_key UNIQUE (call_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_sessions_call_id_fkey') THEN
    ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_call_id_fkey FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS call_sessions_restaurant_id_idx ON call_sessions(restaurant_id);
CREATE TABLE call_events (
  id UUID PRIMARY KEY, call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE, session_id UUID REFERENCES call_sessions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT, event_type TEXT NOT NULL, provider_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}', occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_event_id)
);
CREATE INDEX call_events_restaurant_id_idx ON call_events(restaurant_id); CREATE INDEX call_events_call_id_idx ON call_events(call_id); CREATE INDEX call_events_occurred_at_idx ON call_events(occurred_at);
