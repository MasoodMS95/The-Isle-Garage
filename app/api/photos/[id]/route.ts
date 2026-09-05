import { owner } from '@/lib/server/owner';
import { files, failure, json, noStore } from '@/lib/server/runtime';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ownerId = await owner();
    const id = (await params).id;
    if (!/^[a-f0-9-]{36}$/.test(id))
      return json({ error: 'Image unavailable' }, 404);
    const object = await files().get(`${ownerId}/${id}`);
    if (!object) return json({ error: 'Image unavailable' }, 404);
    return new Response(object.body, {
      headers: {
        ...noStore,
        'Content-Type':
          object.httpMetadata?.contentType || 'application/octet-stream',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
