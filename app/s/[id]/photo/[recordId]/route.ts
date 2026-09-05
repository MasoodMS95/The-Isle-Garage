import { publicPhoto } from '@/lib/server/garage';
import { json, noStore } from '@/lib/server/runtime';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  const { id, recordId } = await params;
  const object = await publicPhoto(id, recordId);
  return object
    ? new Response(object.body, {
        headers: {
          ...noStore,
          'Content-Type':
            object.httpMetadata?.contentType || 'application/octet-stream',
        },
      })
    : json({ error: 'Image unavailable' }, 404);
}
