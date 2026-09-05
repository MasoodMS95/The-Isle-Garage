import { garageImage } from '@/lib/server/og';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return garageImage((await params).id);
}
