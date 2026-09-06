import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp =
    "default-src 'self'; script-src 'self' 'nonce-" +
    nonce +
    "' 'strict-dynamic'" +
    (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
    "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production')
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
