'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@/components/TopNav';
import { safeNext } from '@/lib/auth/next';

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Не удалось войти');
      setBusy(false);
      return;
    }
    router.replace(safeNext(sp.get('next')));
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="panel w-full max-w-[360px] p-6">
      <div className="mb-6"><Wordmark /></div>
      <h1 className="mb-1 text-[20px] font-bold">Вход</h1>
      <p className="mb-5 text-[12.5px] text-mute">Приложение закрыто паролем.</p>
      <input
        data-testid="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        className="mb-3 w-full rounded-lg border border-line bg-panel-2 px-3.5 py-2.5 text-[14px] outline-none focus:border-brand/60"
      />
      {error && <div data-testid="login-error" className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-2 disabled:opacity-50"
      >
        {busy ? 'Проверяю…' : 'Войти'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
