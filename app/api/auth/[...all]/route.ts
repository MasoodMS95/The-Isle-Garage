import { readLimitedText, failure } from '@/lib/server/runtime';
import { createHmac, createHash } from 'node:crypto';
import { getAuth } from '@/lib/auth';
import { appOrigin, mailConfigured } from '@/lib/server/config';
import { databasePool } from '@/lib/server/database';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const path = new URL(request.url).pathname;
  if (request.method === 'POST') {
    if (request.headers.get('origin') !== appOrigin())
      return Response.json(
        { error: 'Same-origin request required' },
        { status: 403 },
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return Response.json({ error: 'JSON required' }, { status: 415 });
    const text = await readLimitedText(request, 16384);
    if (text.length > 16384)
      return Response.json({ error: 'Request too large' }, { status: 413 });
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    if (
      /sign-up|request-password-reset|send-verification-email/.test(path) &&
      !mailConfigured()
    )
      return Response.json(
        {
          error:
            'Email delivery is not configured. Registration and recovery are unavailable.',
        },
        { status: 503 },
      );
    if (typeof body.email === 'string') {
      const key = createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
        .update(path + ':' + body.email.trim().toLowerCase())
        .digest('hex');
      const count = await databasePool().query(
        "INSERT INTO auth_throttle(key,count,expires_at) VALUES($1,1,NOW()+INTERVAL '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_throttle.expires_at<NOW() THEN 1 ELSE auth_throttle.count+1 END,expires_at=CASE WHEN auth_throttle.expires_at<NOW() THEN NOW()+INTERVAL '1 minute' ELSE auth_throttle.expires_at END RETURNING count",
        [key],
      );
      if (count.rows[0].count > 5)
        return Response.json(
          { error: 'Please wait before trying again.' },
          { status: 429, headers: { 'Retry-After': '60' } },
        );
    }
    request = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: text,
    });
  }
  if (request.method === 'GET' && path.endsWith('/verify-email')) {
    const token = new URL(request.url).searchParams.get('token') || '';
    const consumed = await databasePool().query(
      'DELETE FROM auth_verification_uses WHERE hash=$1 AND expires_at>NOW() RETURNING hash',
      [createHash('sha256').update(token).digest('hex')],
    );
    if (!consumed.rowCount)
      return Response.json(
        { error: 'Verification link invalid or expired' },
        { status: 400 },
      );
  }
  const headers = new Headers(request.headers);
  // Do not trust arbitrary client/proxy IP headers. Until a proxy boundary is
  // verified, the library applies a conservative shared durable bucket.
  headers.set('x-garage-rate-ip', '127.0.0.1');
  for (const header of [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'oai-authenticated-user-id',
    'oai-authenticated-user-email',
  ])
    headers.delete(header);
  const response = await getAuth().handler(new Request(request, { headers }));
  const safeHeaders = new Headers(response.headers);
  // oxlint-disable-next-line unicorn/no-useless-spread -- Snapshot before deleting headers from the iterator.
  for (const key of [...safeHeaders.keys()])
    if (key.startsWith('access-control-')) safeHeaders.delete(key);
  safeHeaders.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    headers: safeHeaders,
  });
}
async function safeHandle(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    return failure(error);
  }
}
export const GET = safeHandle;
export const POST = safeHandle;
export function OPTIONS() {
  return new Response(null, { status: 403 });
}
