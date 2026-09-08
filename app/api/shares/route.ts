import { owner } from '@/lib/server/owner';
import { failure, json, mutation } from '@/lib/server/runtime';
export async function GET() {
  try {
    await owner();
    return json({ shares: [], retired: true });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    mutation(request);
    await owner();
    return json(
      {
        error:
          'Selected links are retired. Use your garage visibility settings.',
      },
      410,
    );
  } catch (e) {
    return failure(e);
  }
}
