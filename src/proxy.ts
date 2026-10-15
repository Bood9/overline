import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, authConfig, verifyToken } from '@/lib/auth/session';

/** Reachable without a session. Everything else needs the password. */
const PUBLIC = ['/login', '/api/auth/login'];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  // cron is called by schedulers with a shared secret, checked inside the route
  if (pathname === '/api/cron' && req.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  const cfg = authConfig();
  if (verifyToken(req.cookies.get(COOKIE)?.value, cfg)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Нужен вход' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // skip Next internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)'],
};
