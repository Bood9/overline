'use client';
import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import TeamLogo from './TeamLogo';
import { Meter, SignalChip } from './ui';
import { scoreColor } from '@/lib/score';
import { IconSpark, IconChevron } from './Icons';
import { timeHM } from '@/lib/util/time';
import { marketLabel } from '@/lib/types';
import type { InsightCard as T } from '@/lib/queries';

export default function InsightCard({ i }: { i: T }) {
  const [open, setOpen] = useState(false);
  const color = scoreColor(i.score);

  return (
    <article className="panel overflow-hidden">
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, transparent 70%)` }} />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] text-mute-2">
          <span className="font-semibold tabular-nums text-slate-300">{timeHM(i.kickoff)}</span>
          <span className="truncate">{i.league_ru}</span>
          <span className="ml-auto shrink-0"><Meter value={i.score} /></span>
        </div>

        <Link href={`/match/${i.fixture_id}`} className="mb-3 flex items-center gap-2 hover:text-white">
          <TeamLogo src={i.home_logo} alt={i.home_ru} size={18} />
          <TeamLogo src={i.away_logo} alt={i.away_ru} size={18} />
          <span className="truncate text-[14px] font-semibold">{i.home_ru} — {i.away_ru}</span>
        </Link>

        <div className="mb-3 flex items-end gap-3 border-y border-line/70 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">{marketLabel(i.market)}</div>
            <div className="display text-[24px] font-bold leading-tight">{i.label}</div>
          </div>
          <div className="text-right">
            {i.price ? (
              <>
                <div className="display text-[20px] font-bold tabular-nums">{i.price.toFixed(2)}</div>
                {i.edge != null && (
                  <div className={clsx('text-[11px] font-semibold tabular-nums', i.edge > 0 ? 'text-teal' : 'text-mute-2')}>
                    {i.edge > 0 ? '+' : ''}{i.edge} п.п.
                  </div>
                )}
              </>
            ) : (
              <div className="text-[11px] text-mute-2">нет котировки</div>
            )}
          </div>
        </div>

        <p className="mb-2.5 text-[12.5px] leading-relaxed text-mute">{i.headline}</p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {i.signals.map((s: any, k: number) => <SignalChip key={k} source={s.source} />)}
        </div>

        {i.signals.length > 0 && (
          <div className="space-y-1.5">
            {i.signals.slice(0, open ? 99 : 2).map((s: any, k: number) => (
              <div key={k} className="flex gap-2 rounded-md bg-panel-2 px-2.5 py-1.5 text-[11.5px] text-slate-300">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full" style={{ background: color }} />
                {s.text}
              </div>
            ))}
          </div>
        )}

        {i.alternatives.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {i.alternatives.map((a, k) => (
              <span key={k} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px]">
                <span className="font-semibold">{a.label}</span>
                <span className="tabular-nums text-mute-2">{a.score}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex items-center gap-3 border-t border-line/70 pt-3">
          {i.signals.length > 2 && (
            <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[12.5px] font-semibold text-mute hover:text-white">
              {open ? 'Свернуть' : 'Все сигналы'}
              <IconChevron className={clsx('h-3.5 w-3.5 transition', open && 'rotate-90')} />
            </button>
          )}
          <Link href={`/match/${i.fixture_id}#ai`} className="ml-auto flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-[12px] font-semibold text-brand-3 hover:bg-brand/20">
            <IconSpark className="h-3.5 w-3.5" /> Разбор ИИ
          </Link>
        </div>
      </div>
    </article>
  );
}
