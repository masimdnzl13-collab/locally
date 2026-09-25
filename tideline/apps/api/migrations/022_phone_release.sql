-- Releasing a restaurant's Twilio number when its Locally subscription ends (see
-- PhoneProvisioningService.release). A released row keeps its history: the number moves to
-- released_phone_number and phone_number becomes NULL, so UNIQUE(phone_number) does not block
-- the same number being bought again later (Twilio recycles released numbers).
ALTER TABLE restaurant_phone_numbers ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE restaurant_phone_numbers ADD COLUMN IF NOT EXISTS released_phone_number TEXT;
ALTER TABLE restaurant_phone_numbers DROP CONSTRAINT IF EXISTS restaurant_phone_number_status;
ALTER TABLE restaurant_phone_numbers ADD CONSTRAINT restaurant_phone_number_status CHECK (status IN ('active','pending_manual','released'));
ALTER TABLE restaurant_phone_numbers DROP CONSTRAINT IF EXISTS restaurant_phone_number_present;
ALTER TABLE restaurant_phone_numbers ADD CONSTRAINT restaurant_phone_number_present CHECK (status <> 'active' OR phone_number IS NOT NULL);
