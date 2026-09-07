import { owner } from '@/lib/server/owner';
import {
  body,
  db,
  failure,
  HttpError,
  json,
  mutation,
  obj,
} from '@/lib/server/runtime';
import {
  clientRecords,
  clientAccounts,
  validateAccounts,
  getGarage,
  validateRecords,
} from '@/lib/server/garage';
import { syncDiscord } from '@/lib/server/discord';
export async function GET() {
  try {
    const id = await owner();
    const g = await getGarage(id);
    return json({
      records: clientRecords(g),
      accounts: clientAccounts(g),
      version: g?.version || 0,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    mutation(request);
    const id = await owner();
    const data = obj(await body(request, 16000000));
    if (!Number.isInteger(data.version) || Number(data.version) < 0)
      throw new HttpError(400, 'Version required');
    const old = await getGarage(id);
    if ((old?.version || 0) !== data.version)
      throw new HttpError(
        409,
        'Your garage changed in another tab. Reload before saving.',
      );
    const accounts = validateAccounts(data.accounts, clientAccounts(old));
    const records = await validateRecords(
      data.records,
      id,
      clientRecords(old) || [],
      accounts,
    );
    const now = new Date().toISOString();
    await db()
      .prepare(
        'INSERT INTO garages (owner_id,records,version,updated_at) VALUES (?, ?, 0, ?) ON CONFLICT (owner_id) DO NOTHING',
      )
      .bind(id, '[]', now)
      .run();
    const updated = await db()
      .prepare(
        'UPDATE garages SET records=?, version=version+1, updated_at=? WHERE owner_id=? AND version=? RETURNING version',
      )
      .bind(
        JSON.stringify({ accounts, servers: records }),
        now,
        id,
        data.version,
      )
      .first<{ version: number }>();
    if (!updated)
      throw new HttpError(
        409,
        'Your garage changed in another tab. Reload before saving.',
      );
    const discord = await syncDiscord(id);
    return json({ records, accounts, version: updated.version, discord });
  } catch (e) {
    return failure(e);
  }
}
