import { database } from './database';
import { appOrigin } from './config';
export const db = database;
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
  return appOrigin();
}
export function mutation(request: Request) {
  const source = request.headers.get('origin');
  const expected = appOrigin();
  if (!source || source !== expected)
    throw new HttpError(403, 'Same-origin request required');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'JSON required');
}
export async function body(request: Request, max = 1600000) {
  const text = await readLimitedText(request, max);
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

export async function readLimitedText(request: Request, max: number) {
  const length = request.headers.get('content-length');
  if (length && (!Number.isFinite(Number(length)) || Number(length) > max))
    throw new HttpError(413, 'Request too large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, 'Request too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
