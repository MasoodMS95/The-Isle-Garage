import { publicData } from '@/lib/server/garage';
import { json } from '@/lib/server/runtime';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const data = await publicData((await params).id);
  return data ? json(data) : json({ error: 'Share unavailable' }, 404);
}
