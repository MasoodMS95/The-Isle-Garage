import { NextResponse, type NextRequest } from 'next/server';
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
export const config = { matcher: ['/', '/api/:path*', '/s/:path*'] };
