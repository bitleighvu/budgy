import { NextResponse } from 'next/server';

// Protects everything except: Plaid's webhook (Plaid's servers can't log
// in), and the login page/API themselves (or nobody could ever reach the
// login form to authenticate in the first place).
export const config = {
  matcher: ['/((?!api/plaid/webhook|api/login|login|_next/static|_next/image|favicon.ico).*)'],
};

export function proxy(req) {
  const session = req.cookies.get('budgy_session');
  if (session && session.value === process.env.SESSION_TOKEN) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', req.url));
}