-- TCPA opt-out (Prompt AM): a caller who texts STOP to a restaurant's number must never get
-- another SMS from it. customer_sms_preferences.consent=false already suppresses sends
-- (notification-service.ts); these columns record why and when, so an opt-out can be shown
-- and audited, and a later START knows what it is undoing.
ALTER TABLE customer_sms_preferences ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;
-- 'owner' (set in the dashboard), 'sms_keyword' (STOP/START texted by the customer),
-- 'carrier' (Twilio refused the send with 21610: the number is unsubscribed on Twilio's side).
ALTER TABLE customer_sms_preferences ADD COLUMN IF NOT EXISTS consent_source TEXT NOT NULL DEFAULT 'owner';
