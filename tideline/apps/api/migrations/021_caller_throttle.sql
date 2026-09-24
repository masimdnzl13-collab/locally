-- Per-caller abuse guard (voice/telephony-routes.ts): counts a caller's recent calls
-- to one restaurant on every incoming call, so it needs a matching index.
CREATE INDEX IF NOT EXISTS calls_restaurant_caller_started_idx
  ON calls(restaurant_id, caller_phone_number, started_at DESC);
