'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Chip } from './ui';
import { IconSearch } from './Icons';
import { kickoffLabel } from '@/lib/util/time';
import { marketLabel } from '@/lib/types';

const MARKETS = [
  { k: '1X2', t: '1X2' }, { k: 'OU', t: 'Тотал' }, { k: 'BTTS', t: 'Обе забьют' },
  { k: 'DC', t: 'Двойной шанс' }, { k: 'AH', t: 'Фора' },
];
const SORTS = [
  { k: 'share', t: 'Доля' }, { k: 'move', t: 'Движение' }, { k: 'volume', t: 'Объём' }, { k: 'date', t: 'Дата' },
];

export default function FlowBoard({
  mode, counts, options,
}: {
  mode: 'money' | 'drop';
  counts: { market: string; n: number }[];
  options: { countries: string[]; leagues: string[] };
}) {
  const [market, setMarket] = useState('1X2');
  const [sort, setSort] = useState(mode === 'drop' ? 'move' : 'share');
  const [country, setCountry] = useState('');
  const [league, setLeague] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const p = new URLSearchParams({ mode, market, sort, limit: '60' });
      if (country) p.set('country', country);
      if (league) p.set('league', league);
      if (q) p.set('q', q);
      const r = await fetch(`/api/moneyway?${p}`).then((x) => x.json());
      setRows(r.rows ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [mode, market, sort, country, league, q]);

  const countOf = (m: string) => counts.find((c) => c.market === m)?.n;

  return (
    <>
      <div className="panel mb-4 p-4">
        <div className="hide-scroll mb-3 flex gap-2 overflow-x-auto pb-1">
          {MARKETS.map((m) => (
            <Chip key={m.k} active={market === m.k} onClick={() => setMarket(m.k)} count={countOf(m.k)}>{m.t}</Chip>
          ))}
        </div>

        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Страна</div>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] font-semibold outline-none">
              <option value="">Все страны</option>
              {options.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Лига</div>
            <select value={league} onChange={(e) => setLeague(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] font-semibold outline-none">
              <option value="">Все лиги</option>
              {options.leagues.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Сортировать</div>
            <div className="flex gap-2">
              {SORTS.map((s) => (
                <Chip key={s.k} active={sort === s.k} onClick={() => setSort(s.k)} className="flex-1 justify-center">{s.t}</Chip>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
          <IconSearch className="h-4 w-4 text-mute-2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Команда, лига или страна"
            className="w-full bg-transparent text-sm outline-none placeholder:text-mute-2" />
        </div>
      </div>

      <div className="mb-3 px-1 text-[12px] text-mute-2">
        {loading ? 'Загрузка…' : `${rows.length} матчей · ${mode === 'drop' ? 'Падение коэффициентов' : 'Moneyway'} · ${marketLabel(market)}`}
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((g) => (
          <Link key={`${g.fixture_id}-${g.line}`} href={`/match/${g.fixture_id}`}
            className="panel p-3.5 transition hover:border-brand/45">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[10px] font-bold uppercase tracking-wider text-mute-2">
                  {g.country ?? '—'} · {g.league_ru}
                </div>
              </div>
              <div className="shrink-0 rounded border border-line px-1.5 py-0.5 text-right">
                <span className="text-[12px] font-semibold tabular-nums text-brand-3">{g.volume}</span>
                <span className="ml-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-mute-2">индекс</span>
              </div>
            </div>
            <div className="mb-1 line-clamp-2 text-[14.5px] font-semibold leading-tight">{g.home_ru} — {g.away_ru}</div>
            <div className="mb-3 text-[11px] text-mute-2">
              {kickoffLabel(g.kickoff)} · {marketLabel(g.market)}{g.line ? ` ${g.line}` : ''}
            </div>

            <div className={clsx('grid gap-2', g.rows.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {g.rows.map((r: any) => {
                const drop = r.movement < -0.5;
                const rise = r.movement > 0.5;
                return (
                  <div key={r.selection}
                    className={clsx('rounded-md border px-2 py-1.5',
                      r.best ? 'border-brand/50 bg-brand/10' : 'border-line bg-panel-2')}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-mute-2">{r.label}{r.best ? ' ★' : ''}</span>
                      {mode === 'drop' ? (
                        <span className={clsx('text-[9px] font-semibold tabular-nums', drop ? 'text-teal' : rise ? 'text-danger' : 'text-mute-2')}>
                          {drop ? '↓' : rise ? '↑' : '·'} {Math.abs(r.movement).toFixed(1)}%
                        </span>
                      ) : (
                        <span className={clsx('rounded px-1 text-[9px] font-semibold tabular-nums',
                          r.share >= 55 ? 'bg-brand/25 text-brand-3' : 'text-mute-2')}>
                          {r.share.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      {mode === 'drop' && r.open_price > 0 && r.open_price !== r.price && (
                        <span className="text-[10px] text-mute-2 line-through">{r.open_price.toFixed(2)}</span>
                      )}
                      <span className={clsx('text-[15px] font-semibold tabular-nums', r.best ? 'text-brand-3' : 'text-slate-100')}>
                        {r.price > 0 ? r.price.toFixed(2) : '—'}
                      </span>
                    </div>
                    {mode === 'money' && (
                      <div className="mt-1 h-1 overflow-hidden rounded-sm bg-black/40">
                        <div className="h-full rounded-sm bg-brand" style={{ width: `${r.share}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Link>
        ))}
      </div>

      {!loading && !rows.length && (
        <div className="panel-flat px-5 py-8 text-center text-sm text-mute">
          Нет данных под эти фильтры.
        </div>
      )}
    </>
  );
}
