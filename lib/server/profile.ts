import { databasePool } from './database.ts';
export type ProfileRow = {
  owner_id: string;
  public_id: string;
  is_public: boolean;
  version: number;
  legacy_links_revoked: boolean;
  updated_at: Date;
};
export async function ensureProfile(ownerId: string): Promise<ProfileRow> {
  const existing = await databasePool().query(
    'SELECT * FROM garage_profiles WHERE owner_id=$1',
    [ownerId],
  );
  if (existing.rowCount) return existing.rows[0];
  return (
    await databasePool().query(
      'INSERT INTO garage_profiles(owner_id) VALUES($1) ON CONFLICT(owner_id) DO UPDATE SET owner_id=EXCLUDED.owner_id RETURNING *',
      [ownerId],
    )
  ).rows[0];
}
export function profileView(profile: ProfileRow) {
  return {
    id: profile.public_id,
    visibility: profile.is_public ? 'public' : 'private',
    version: profile.version,
    legacyLinksRevoked: profile.legacy_links_revoked,
  };
}
