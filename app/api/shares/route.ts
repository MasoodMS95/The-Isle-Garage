import { owner } from '@/lib/server/owner';
import {
  body,
  db,
  failure,
  HttpError,
  json,
  mutation,
} from '@/lib/server/runtime';
import {
  clientRecords,
  clientAccounts,
  getGarage,
  shareInput,
  shareView,
  type ShareRow,
} from '@/lib/server/garage';
export async function GET() {
  try {
    const id = await owner();
    const rows = await db()
      .prepare('SELECT * FROM shares WHERE owner_id=? ORDER BY updated_at DESC')
      .bind(id)
      .all<ShareRow>();
    return json({ shares: rows.results.map(shareView) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    mutation(request);
    const ownerId = await owner();
    const g = await getGarage(ownerId);
    if (!g) throw new HttpError(409, 'Save your garage before sharing');
    const input = shareInput(
      await body(request),
      clientRecords(g) || [],
      clientAccounts(g),
    );
    const count = await db()
      .prepare('SELECT COUNT(*) AS n FROM shares WHERE owner_id=? AND active=1')
      .bind(ownerId)
      .first<{ n: number }>();
    if ((count?.n || 0) >= 20)
      throw new HttpError(400, 'Revoke an existing link before creating more');
    const id = crypto.randomUUID().replaceAll('-', '');
    await db()
      .prepare(
        'INSERT INTO shares (id,owner_id,title,selected_ids,include_codes,include_photos,active,updated_at) VALUES (?,?,?,?,?,?,1,?)',
      )
      .bind(
        id,
        ownerId,
        input.title,
        JSON.stringify({
          ids: input.selectedIds,
          includeAccountLabels: input.includeAccountLabels,
        }),
        input.includeCodes,
        input.includePhotos,
        new Date().toISOString(),
      )
      .run();
    return json({ id }, 201);
  } catch (e) {
    return failure(e);
  }
}
