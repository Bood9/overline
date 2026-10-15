'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { IconHome, IconCalendar, IconNews, IconTools, IconUser, IconWallet, IconCalc } from './Icons';
import { relative } from '@/lib/util/time';

/** Shows when the pipeline last actually wrote something, not a decorative label. */
function FreshnessBadge() {
  const [last, setLast] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => setLast(d?.data?.jobs?.[0]?.created_at ?? null))
        .catch(() => setFailed(true));
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (failed) return null;
  // ingest_log stores SQLite UTC ("YYYY-MM-DD HH:MM:SS")
  const iso = last ? `${last.replace(' ', 'T')}Z` : null;
  const ageMin = iso ? (Date.now() - new Date(iso).getTime()) / 60000 : null;
  const stale = ageMin === null || ageMin > 45;

  return (
    <span
      title={iso ? `последняя запись в базу: ${new Date(iso).toLocaleString('ru-RU')}` : 'воркер не запускался'}
      className={clsx(
        'hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold lg:flex',
        stale ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line bg-panel-2 text-mute',
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', stale ? 'bg-warn' : 'bg-teal')} />
      {iso ? `обновлено ${relative(iso)}` : 'нет загрузок'}
    </span>
  );
}

const NAV = [
  { href: '/', label: 'Обзор', icon: IconHome },
  { href: '/matches', label: 'Матчи', icon: IconCalendar },
  { href: '/news', label: 'Новости', icon: IconNews },
  { href: '/earnings', label: 'Заработок', icon: IconWallet },
  { href: '/bankroll', label: 'Банкролл', icon: IconCalc },
  { href: '/tools', label: 'Инструменты', icon: IconTools },
];

export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-3 to-brand-2">
        <span className="h-[9px] w-[9px] rounded-[2px] bg-ink-900" />
      </span>
      <span className={clsx('display font-bold tracking-tight', size === 'md' ? 'text-[19px]' : 'text-[16px]')}>
        over<span className="text-brand-3">line</span>
      </span>
    </span>
  );
}

export default function TopNav() {
  const path = usePathname();
  if (path === '/login') return null;
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-40 -mx-4 mb-6 border-b border-line bg-ink-900/85 px-4 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="mx-auto flex h-16 max-w-[1560px] items-center gap-6">
          <Link href="/"><Wordmark /></Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition',
                  isActive(href) ? 'nav-active' : 'text-mute hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <Icon className="h-[17px] w-[17px]" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <FreshnessBadge />
            <Link
              href="/profile"
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-lg border border-line transition',
                isActive('/profile') ? 'border-brand/60 bg-brand/15 text-brand-3' : 'bg-panel-2 text-mute hover:text-white',
              )}
            >
              <IconUser className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-line bg-ink-850/95 px-2 py-1.5 backdrop-blur md:hidden">
        {[...NAV, { href: '/profile', label: 'Профиль', icon: IconUser }].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold',
              isActive(href) ? 'text-brand-3' : 'text-mute-2',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
