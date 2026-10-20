ALTER TABLE sports ADD COLUMN image_data bytea;
ALTER TABLE sports ADD COLUMN image_content_type varchar(20);
ALTER TABLE sports ADD COLUMN admin_created boolean NOT NULL DEFAULT false;
ALTER TABLE sports DROP CONSTRAINT sports_fixed_catalog;
ALTER TABLE sports ADD CONSTRAINT sports_fixed_catalog CHECK (
  canonical_id IS NOT NULL OR (registry_code IS NOT NULL AND is_custom=false)
  OR (registry_code IS NULL AND is_custom=true AND normalized_name='другое')
  OR (admin_created=true AND canonical_id IS NULL AND registry_code IS NULL AND is_custom=false)
);
