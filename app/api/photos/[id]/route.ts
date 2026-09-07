import { json } from '@/lib/server/runtime';
// Retired endpoint: never retrieve legacy private uploads.
export async function GET() {
  return json({ error: 'Image unavailable' }, 404);
}
