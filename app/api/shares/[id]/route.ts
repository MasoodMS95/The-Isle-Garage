import { owner } from '@/lib/server/owner';
import { failure, json, mutation } from '@/lib/server/runtime';
async function retired(request: Request) {
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
export const PATCH = retired;
export const DELETE = retired;
