import { NextResponse } from 'next/server';

// Protects everything except Plaid's webhook (Plaid's servers call that
// directly and can't send your Basic Auth credentials) and Next's own
// static assets.
export const config = {
  matcher: ['/((?!api/plaid/webhook|_next/static|_next/image|favicon.ico).*)'],
};

export function proxy(req) {
  const expectedUser = process.env.AUTH_USER;
  const expectedPass = process.env.AUTH_PASSWORD;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6));
    const sep = decoded.indexOf(':');
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (user === expectedUser && pass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Budgy"' },
  });
}