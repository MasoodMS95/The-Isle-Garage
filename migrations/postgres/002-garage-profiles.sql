CREATE TABLE IF NOT EXISTS garage_profiles (
  owner_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  is_public BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 0,
  legacy_links_revoked BOOLEAN NOT NULL DEFAULT false,
  discord_status TEXT NOT NULL DEFAULT 'not_configured',
  next_attempt DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO garage_profiles(owner_id) SELECT id FROM "user" ON CONFLICT(owner_id) DO NOTHING;
UPDATE garage_profiles p SET legacy_links_revoked=true WHERE EXISTS(SELECT 1 FROM shares s WHERE s.owner_id=p.owner_id AND s.active=1);
UPDATE shares SET active=0 WHERE active=1;
