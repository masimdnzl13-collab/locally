-- Automatic Twilio number provisioning (see services/phone-provisioning-service.ts).
-- external_ref: the Locally business id a restaurant was provisioned for, so the
-- self-serve onboarding call is idempotent (a retried request returns the same restaurant).
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_external_ref_key ON restaurants(external_ref);
-- A failed purchase still gets a row (status='pending_manual', no number yet, active=false)
-- so it lands in an admin queue instead of silently blocking onboarding. Voice routing only
-- ever matches active rows, so a pending row can never receive a call.
ALTER TABLE restaurant_phone_numbers ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE restaurant_phone_numbers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE restaurant_phone_numbers ADD COLUMN IF NOT EXISTS provider_sid TEXT;
ALTER TABLE restaurant_phone_numbers ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE restaurant_phone_numbers ADD CONSTRAINT restaurant_phone_number_status CHECK (status IN ('active','pending_manual'));
ALTER TABLE restaurant_phone_numbers ADD CONSTRAINT restaurant_phone_number_present CHECK (status = 'pending_manual' OR phone_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS restaurant_phone_numbers_status_idx ON restaurant_phone_numbers(status);
