-- Cost guard ledger: one row per restaurant, billing period (YYYY-MM) and action.
-- The primary key is the dedup claim, so a threshold alert (or a future automatic
-- action) fires at most once per restaurant per month even with several workers.
-- Internal/admin table: not tenant-scoped, never exposed through tenant routes.
CREATE TABLE IF NOT EXISTS cost_alerts (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  action TEXT NOT NULL,
  total_usd NUMERIC(12,4) NOT NULL,
  threshold_usd NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (restaurant_id, period, action)
);
