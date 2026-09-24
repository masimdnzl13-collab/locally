-- Supports the worker's lease predicate and FIFO ordering without changing semantics.
CREATE INDEX IF NOT EXISTS outbox_ready_fifo_idx ON outbox_events(status, available_at, created_at) WHERE status IN ('PENDING','FAILED','PROCESSING');
-- Notification processing and provider callbacks both use these tenant-safe lookups.
CREATE INDEX IF NOT EXISTS messages_notification_created_idx ON messages(notification_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_provider_message_idx ON messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_provider_message_idx ON notifications(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservation_events_reservation_created_idx ON reservation_events(reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_events_order_created_idx ON order_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS special_closures_tenant_date_active_idx ON special_closures(restaurant_id, closure_date) WHERE active=true;
