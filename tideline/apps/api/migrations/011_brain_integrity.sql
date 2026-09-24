-- Case-insensitive tenant-local uniqueness prevents visually duplicated Brain data.
CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_restaurant_lower_name_uq ON menu_categories (restaurant_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_restaurant_lower_name_uq ON menu_items (restaurant_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS modifier_groups_item_lower_name_uq ON modifier_groups (restaurant_id, menu_item_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS modifier_options_group_lower_name_uq ON modifier_options (restaurant_id, modifier_group_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS faqs_restaurant_lower_question_uq ON faqs (restaurant_id, lower(question));
ALTER TABLE special_closures ADD CONSTRAINT special_closures_interval_check CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time));
