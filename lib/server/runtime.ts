import { env } from 'cloudflare:workers';
export function db() {
  if (!env.DB) throw new Error('Database unavailable');
  return env.DB;
}
export function files() {
  if (!env.FILES) throw new Error('Image storage unavailable');
  return env.FILES;
}
export const noStore = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  return json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : 'The request could not be completed. Try again.',
    },
    error instanceof HttpError ? error.status : 500,
  );
}
export function origin() {
  return env.SITE_ORIGIN || 'https://isle-garage-design.masoodms.chatgpt.site';
}
export function mutation(request: Request) {
  const source = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  if (!source || source !== expected)
    throw new HttpError(403, 'Same-origin request required');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'JSON required');
}
export async function body(request: Request, max = 1600000) {
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'Request too large');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
export function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Invalid data');
  return value as Record<string, unknown>;
}
export function str(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max)
    throw new HttpError(400, 'Invalid text field');
  return value;
}
