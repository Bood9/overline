/**
 * Where to send the user after login. Only same-site relative paths are allowed,
 * so a crafted link like /login?next=//evil.com cannot bounce someone off-site.
 */
const CONTROL_CHARS = /[\x00-\x1f]/;

export function safeNext(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (CONTROL_CHARS.test(next)) return '/';
  try {
    const u = new URL(next, 'http://local.invalid');
    if (u.origin !== 'http://local.invalid') return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/';
  }
}
