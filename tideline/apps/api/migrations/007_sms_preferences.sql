CREATE TABLE IF NOT EXISTS customer_sms_preferences (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'EN' CHECK(language IN ('EN','ES')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (restaurant_id, phone)
);
CREATE INDEX IF NOT EXISTS messages_restaurant_created_idx ON messages(restaurant_id, created_at DESC);
