type FetchOpts = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  as?: 'json' | 'text';
};

export async function fetchWithRetry<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const { headers = {}, timeoutMs = 15000, retries = 2, as = 'json' } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Overline/1.0', ...headers },
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(t);
      if (res.status === 429) throw new Error(`rate-limited ${url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (as === 'json' ? await res.json() : await res.text()) as T;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1) ** 2));
    }
  }
  throw lastErr;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
