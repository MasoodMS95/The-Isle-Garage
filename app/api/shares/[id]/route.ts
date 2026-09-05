import { owner } from '@/lib/server/owner';
import { body, db, failure, json, mutation } from '@/lib/server/runtime';
import {
  clientRecords,
  clientAccounts,
  getGarage,
  ownedShare,
  shareInput,
} from '@/lib/server/garage';
import { syncDiscord } from '@/lib/server/discord';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    mutation(request);
    const ownerId = await owner();
    const { id } = await params;
    const submitted = await body(request);
    await ownedShare(id, ownerId);
    const g = await getGarage(ownerId);
    const input = shareInput(
      submitted,
      clientRecords(g) || [],
      clientAccounts(g),
    );
    await db()
      .prepare(
        'UPDATE shares SET title=?,selected_ids=?,include_codes=?,include_photos=?,updated_at=? WHERE id=? AND owner_id=? AND active=1',
      )
      .bind(
        input.title,
        JSON.stringify({
          ids: input.selectedIds,
          includeAccountLabels: input.includeAccountLabels,
        }),
        input.includeCodes,
        input.includePhotos,
        new Date().toISOString(),
        id,
        ownerId,
      )
      .run();
    return json({ ok: true, discord: await syncDiscord(ownerId) });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    mutation(request);
    const ownerId = await owner();
    const { id } = await params;
    await body(request);
    await ownedShare(id, ownerId);
    await db()
      .prepare(
        'UPDATE shares SET active=0,updated_at=? WHERE id=? AND owner_id=?',
      )
      .bind(new Date().toISOString(), id, ownerId)
      .run();
    return json({ ok: true, discord: await syncDiscord(ownerId) });
  } catch (e) {
    return failure(e);
  }
}
