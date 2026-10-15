import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, SESSION_DAYS, authConfig, createToken, verifyPassword, LoginLimiter } from '@/lib/auth/session';
export const dynamic = 'force-dynamic';

const limiter = new LoginLimiter();
const clientIp = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';

export async function POST(req: NextRequest) {
  const cfg = authConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: 'Пароль ещё не задан. Выполни в терминале: npm run set-password' },
      { status: 503 },
    );
  }
  const ip = clientIp(req);
  const locked = limiter.lockedFor(ip);
  if (locked > 0) {
    return NextResponse.json(
      { error: `Слишком много попыток. Повтори через ${Math.ceil(locked / 60000)} мин.` },
      { status: 429 },
    );
  }

  const { password } = await req.json().catch(() => ({ password: '' }));
  if (typeof password !== 'string' || !verifyPassword(password, cfg.passwordHash)) {
    limiter.fail(ip);
    await new Promise((r) => setTimeout(r, 400)); // slows guessing a little more
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  limiter.success(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, createToken(cfg), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
