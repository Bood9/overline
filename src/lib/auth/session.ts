/**
 * Single-user password gate.
 *
 * The password is stored only as a scrypt hash (APP_PASSWORD_HASH). A session is
 * an HMAC-signed cookie carrying its expiry and a fingerprint of the current
 * password hash — changing the password therefore logs out every device.
 */
import crypto from 'node:crypto';

export const COOKIE = 'ol_session';
export const SESSION_DAYS = 30;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  // ':' not '$' — Next.js expands $VAR inside .env files and would mangle the hash
  return `scrypt:${SCRYPT.N}:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string | undefined | null): boolean {
  if (!stored) return false;
  const [algo, n, saltB64, hashB64] = stored.split(':');
  if (algo !== 'scrypt' || !n || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64url'), expected.length, {
    N: Number(n), r: SCRYPT.r, p: SCRYPT.p,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export interface AuthConfig { passwordHash: string; secret: string }

/** null when the app has no password yet — callers must then refuse access. */
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig | null {
  const passwordHash = env.APP_PASSWORD_HASH?.trim();
  const secret = env.AUTH_SECRET?.trim();
  if (!passwordHash || !secret || secret.length < 32) return null;
  return { passwordHash, secret };
}

const fingerprint = (passwordHash: string) =>
  crypto.createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16);

const sign = (data: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function createToken(cfg: AuthConfig, now = Date.now(), days = SESSION_DAYS): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: now + days * 86400_000, fp: fingerprint(cfg.passwordHash) }),
  ).toString('base64url');
  return `${payload}.${sign(payload, cfg.secret)}`;
}

export function verifyToken(token: string | undefined | null, cfg: AuthConfig | null, now = Date.now()): boolean {
  if (!token || !cfg) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload, cfg.secret);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp, fp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > now && fp === fingerprint(cfg.passwordHash);
  } catch {
    return false;
  }
}

/**
 * Brute-force brake: after `max` wrong passwords from one address the address is
 * locked for `lockMs`. In-memory is enough for a single-process, single-user app.
 */
export class LoginLimiter {
  private fails = new Map<string, { count: number; first: number; lockedUntil: number }>();
  constructor(private max = 5, private windowMs = 15 * 60_000, private lockMs = 15 * 60_000) {}

  lockedFor(ip: string, now = Date.now()): number {
    const e = this.fails.get(ip);
    return e && e.lockedUntil > now ? e.lockedUntil - now : 0;
  }
  fail(ip: string, now = Date.now()) {
    const e = this.fails.get(ip);
    if (!e || now - e.first > this.windowMs) {
      this.fails.set(ip, { count: 1, first: now, lockedUntil: 0 });
      return;
    }
    e.count++;
    if (e.count >= this.max) e.lockedUntil = now + this.lockMs;
  }
  success(ip: string) {
    this.fails.delete(ip);
  }
}

/** Parse our cookie from a raw Cookie header (route handlers and scripts). */
export function tokenFromCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Defence in depth for route handlers that change data. */
export function isAuthorized(req: { headers: Headers }): boolean {
  return verifyToken(tokenFromCookieHeader(req.headers.get('cookie')), authConfig());
}
