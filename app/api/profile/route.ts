import { publicHandle } from '@/lib/server/public-handle';
import { syncDiscord } from '@/lib/server/discord';
import { after } from 'next/server';
import { owner } from '@/lib/server/owner';
import {
  body,
  failure,
  json,
  mutation,
  obj,
  HttpError,
} from '@/lib/server/runtime';
import {
  ensureProfile,
  profileView,
  type ProfileRow,
} from '@/lib/server/profile';
import { databasePool } from '@/lib/server/database';
export async function GET() {
  try {
    return json(profileView(await ensureProfile(await owner())));
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    mutation(request);
    const ownerId = await owner();
    const input = obj(await body(request, 1024));
    if ('handle' in input) {
      const handle = publicHandle(input.handle);
      if (!Number.isInteger(input.version) || Number(input.version) < 0)
        throw new HttpError(400, 'Reload settings before choosing a username.');
      await ensureProfile(ownerId);
      try {
        const changed = await databasePool().query(
          'UPDATE garage_profiles SET handle=$1,version=version+1,updated_at=NOW() WHERE owner_id=$2 AND version=$3 AND handle IS NULL RETURNING *',
          [handle, ownerId, input.version],
        );
        if (!changed.rowCount)
          throw new HttpError(
            409,
            'A username has already been chosen or settings changed in another tab. Reload settings.',
          );
        return json(profileView(changed.rows[0] as ProfileRow));
      } catch (error) {
        if ((error as { code?: string }).code === '23505')
          throw new HttpError(
            409,
            'That public username is already taken. Choose another.',
          );
        throw error;
      }
    }
    if (
      !['private', 'public'].includes(String(input.visibility)) ||
      !Number.isInteger(input.version) ||
      Number(input.version) < 0
    )
      throw new HttpError(
        400,
        'Choose Public or Private with a current version',
      );
    await ensureProfile(ownerId);
    const result = await databasePool().query(
      'UPDATE garage_profiles SET is_public=$1,version=version+1,updated_at=NOW() WHERE owner_id=$2 AND version=$3 RETURNING *',
      [input.visibility === 'public', ownerId, input.version],
    );
    if (!result.rowCount)
      throw new HttpError(
        409,
        'Visibility changed in another tab. Reload settings before trying again.',
      );
    after(async () => {
      await syncDiscord(ownerId);
    });
    return json(profileView(result.rows[0] as ProfileRow));
  } catch (error) {
    return failure(error);
  }
}
