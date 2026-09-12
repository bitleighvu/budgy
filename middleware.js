import { NextResponse } from 'next/server';

// Two completely independent auth checks live here:
//  - the real dashboard (/, /api/* except the exclusions below) requires
//    SESSION_TOKEN, set via the real login (see pages/login.js).
//  - the guest demo (/guest, /api/guest/*) requires GUEST_SESSION_TOKEN,
//    set via the separate guest login (pages/guest-login.js) with its own
//    password (GUEST_PASSWORD). Neither cookie grants access to the
//    other's routes — a real session doesn't get you into /guest and
//    vice versa, kept deliberately simple and easy to reason about.
//
// Excluded entirely from any cookie check: Plaid's webhook and the daily
// reconciliation cron (both authenticate themselves — see webhook.js and
// reconcile.js), and both login pages/APIs (or nobody could ever reach
// the login forms to authenticate in the first place).
export const config = {
  matcher: [
    '/((?!api/plaid/webhook|api/plaid/reconcile|api/login|login|api/guest-login|guest-login|_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const isGuestRoute = pathname === '/guest' || pathname.startsWith('/api/guest');

  if (isGuestRoute) {
    const guestSession = req.cookies.get('budgy_guest_session');
    if (guestSession && guestSession.value === process.env.GUEST_SESSION_TOKEN) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/guest-login', req.url));
  }

  const session = req.cookies.get('budgy_session');
  if (session && session.value === process.env.SESSION_TOKEN) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', req.url));
}