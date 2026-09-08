import { garageImage } from '@/lib/server/og';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  return garageImage((await params).handle, true);
}
