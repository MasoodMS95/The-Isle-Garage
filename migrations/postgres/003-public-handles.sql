ALTER TABLE garage_profiles ADD COLUMN IF NOT EXISTS initial_handle TEXT;
ALTER TABLE garage_profiles ADD COLUMN IF NOT EXISTS handle TEXT;
UPDATE garage_profiles SET initial_handle='garage-' || public_id WHERE initial_handle IS NULL;
ALTER TABLE garage_profiles ALTER COLUMN initial_handle SET DEFAULT ('garage-' || replace(gen_random_uuid()::text,'-',''));
ALTER TABLE garage_profiles ALTER COLUMN initial_handle SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS garage_profile_initial_handle_unique ON garage_profiles(initial_handle);
CREATE UNIQUE INDEX IF NOT EXISTS garage_profile_handle_unique ON garage_profiles(lower(handle));
