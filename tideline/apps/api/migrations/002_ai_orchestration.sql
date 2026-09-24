CREATE TABLE call_sessions (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider_call_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', caller_phone_redacted TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ, UNIQUE(restaurant_id, provider_call_id)
);
CREATE INDEX call_sessions_restaurant_started_idx ON call_sessions(restaurant_id, started_at DESC);

CREATE TABLE restaurant_brain (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  greeting JSONB NOT NULL DEFAULT '{"en":"Hello, how can I help you?","es":"Hola, ¿cómo puedo ayudarle?"}',
  hours JSONB NOT NULL DEFAULT '{}', menu JSONB NOT NULL DEFAULT '[]', policies JSONB NOT NULL DEFAULT '{}',
  ai_instructions TEXT, seasonal_status TEXT NOT NULL DEFAULT 'ACTIVE', seasonal_closed_message JSONB NOT NULL DEFAULT '{}',
  human_transfer JSONB NOT NULL DEFAULT '{"enabled":false}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE, language TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
  state JSONB NOT NULL DEFAULT '{}', metadata JSONB NOT NULL DEFAULT '{}', started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ,
  UNIQUE(call_session_id)
);
CREATE INDEX conversations_restaurant_created_idx ON conversations(restaurant_id, started_at DESC);
CREATE INDEX conversations_call_session_idx ON conversations(call_session_id);
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('SYSTEM','USER','ASSISTANT','TOOL')), content TEXT NOT NULL, sequence INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(conversation_id, sequence)
);
CREATE INDEX conversation_messages_conversation_idx ON conversation_messages(conversation_id, sequence);
CREATE TABLE conversation_turns (
  id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, turn_number INTEGER NOT NULL,
  transcript TEXT NOT NULL, intent TEXT NOT NULL, confidence REAL NOT NULL, reasoning_summary TEXT, language TEXT,
  processing_started_at TIMESTAMPTZ NOT NULL, processing_completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(conversation_id, turn_number)
);
CREATE INDEX conversation_turns_intent_idx ON conversation_turns(intent); CREATE INDEX conversation_turns_conversation_created_idx ON conversation_turns(conversation_id, created_at);
CREATE TABLE conversation_tool_calls (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  turn_id UUID NOT NULL REFERENCES conversation_turns(id) ON DELETE CASCADE, tool_name TEXT NOT NULL, arguments JSONB NOT NULL, result JSONB, status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, duration_ms INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(idempotency_key)
);
CREATE INDEX conversation_tool_calls_conversation_idx ON conversation_tool_calls(conversation_id, created_at);
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  turn_id UUID REFERENCES conversation_turns(id) ON DELETE SET NULL, request_id TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL, estimated_cost NUMERIC(12,6), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_usage_restaurant_created_idx ON ai_usage(restaurant_id, created_at DESC);
