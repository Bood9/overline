'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { PageHeader, Empty } from '@/components/ui';
import { IconTrend, IconShield } from '@/components/Icons';
import { timeHM, dayMonth, plural } from '@/lib/util/time';

const RESULT: Record<string, { t: string; c: string }> = {
  won: { t: 'зашла', c: 'text-teal' },
  half_won: { t: 'половина', c: 'text-teal' },
  lost: { t: 'мимо', c: 'text-danger' },
  half_lost: { t: 'полумимо', c: 'text-danger' },
  void: { t: 'возврат', c: 'text-mute' },
};

const signed = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);

export default function TrackPage() {
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/track-record').then((r) => r.json()).then((d) => { setRec(d.record); setLoading(false); });
  }, []);

  if (loading) return <div className="panel-flat px-5 py-10 text-center text-sm text-mute">Считаю…</div>;

  const o = rec?.overall;
  const enough = (o?.n ?? 0) >= 30;

  return (
    <div>
      <PageHeader
        title="Как отрабатывают прогнозы"
        subtitle="Каждая опубликованная рекомендация записывается с той ценой, что была на экране, и считается по итоговому счёту"
        back="/tools"
        right={<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3"><IconTrend className="h-[18px] w-[18px]" /></span>}
      />

      {!o?.n ? (
        <Empty>
          Пока нечего показывать: {rec?.pending ?? 0} {plural(rec?.pending ?? 0, 'прогноз ждёт', 'прогноза ждут', 'прогнозов ждут')} результата.
          Первые цифры появятся после того, как сыграют матчи.
        </Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { v: o.n, l: 'рассчитано ставок' },
              { v: `${o.hitRate}%`, l: 'зашло' },
              { v: signed(o.roi), l: 'ROI при равных ставках', c: (o.roi ?? 0) >= 0 ? 'text-teal' : 'text-danger' },
              { v: o.avgPrice, l: 'средний коэффициент' },
              { v: rec.pending, l: 'ждут результата' },
            ].map((s: any, i) => (
              <div key={i} className="panel px-4 py-3">
                <div className={clsx('display truncate text-[20px] font-bold tabular-nums', s.c)}>{s.v}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute-2">{s.l}</div>
              </div>
            ))}
          </div>

          {!enough && (
            <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-[12.5px] text-warn">
              Выборка ещё маленькая — {o.n} {plural(o.n, 'ставка', 'ставки', 'ставок')}. На таком объёме ROI почти ничего не значит:
              одна зашедшая ставка на высоком коэффициенте переворачивает картину. Осмысленные выводы начинаются от нескольких сотен.
            </div>
          )}

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <Table title="По силе схождения" rows={rec.byScore} />
            <Table title="По рынкам" rows={rec.byMarket} />
          </div>

          <div className="panel mb-4 p-4">
            <h3 className="mb-1 text-[13px] font-bold uppercase tracking-[0.12em] text-slate-300">Только лучшая ставка матча</h3>
            <p className="mb-3 text-[11.5px] text-mute-2">То, что показано первым в карточке матча — обычно именно по ней и ставят.</p>
            <div className="flex flex-wrap gap-4 text-[13px]">
              <span>ставок: <b>{rec.topPickOnly.n}</b></span>
              <span>зашло: <b>{rec.topPickOnly.hitRate ?? '—'}%</b></span>
              <span>ROI: <b className={(rec.topPickOnly.roi ?? 0) >= 0 ? 'text-teal' : 'text-danger'}>{signed(rec.topPickOnly.roi)}</b></span>
            </div>
          </div>

          {rec.recent?.length > 0 && (
            <div className="panel overflow-hidden">
              <div className="hidden grid-cols-[6rem_1fr_8rem_3.5rem_4rem_5rem] gap-3 border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute-2 md:grid">
                <span>Матч</span><span>Команды</span><span>Ставка</span><span className="text-right">Кэф</span>
                <span className="text-right">Скор</span><span className="text-right">Итог</span>
              </div>
              {rec.recent.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-2 gap-2 border-b border-line/70 px-4 py-2.5 text-[12.5px] last:border-0 md:grid-cols-[6rem_1fr_8rem_3.5rem_4rem_5rem] md:items-center md:gap-3">
                  <span className="text-mute-2">{dayMonth(r.kickoff)} {timeHM(r.kickoff)}</span>
                  <span className="truncate">{r.home} — {r.away} {r.goals && <b className="text-slate-300">{r.goals}</b>}</span>
                  <span className="font-semibold text-brand-3">{r.label}</span>
                  <span className="tabular-nums text-mute md:text-right">{r.price?.toFixed(2)}</span>
                  <span className="tabular-nums text-mute-2 md:text-right">{r.score}</span>
                  <span className={clsx('font-semibold md:text-right', RESULT[r.result]?.c)}>{RESULT[r.result]?.t ?? r.result}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="panel mt-4 flex items-start gap-3 p-4 text-[12px] leading-relaxed text-mute">
        <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <div>
          <p className="mb-1.5 font-semibold text-slate-300">Как это считается</p>
          <p className="mb-1">Ставка фиксируется в момент публикации вместе с ценой, которая была тогда на экране — задним числом ничего не подставляется.</p>
          <p className="mb-1">ROI считается при одинаковой ставке на каждую рекомендацию. Возвраты не учитываются ни в плюс, ни в минус.</p>
          <p>Учёт начался {rec?.firstLogged ? dayMonth(rec.firstLogged.replace(' ', 'T') + 'Z') : '—'}. Всё, что было до этого, измерить уже нельзя — старые рекомендации не сохранялись.</p>
        </div>
      </div>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: any[] }) {
  if (!rows?.length) return null;
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-2.5 text-[13px] font-bold uppercase tracking-[0.12em] text-slate-300">{title}</div>
      <div className="grid grid-cols-[1fr_3rem_3.5rem_4rem] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute-2">
        <span />
        <span className="text-right">n</span><span className="text-right">зашло</span><span className="text-right">ROI</span>
      </div>
      {rows.map((b: any) => (
        <div key={b.label} className="grid grid-cols-[1fr_3rem_3.5rem_4rem] gap-2 border-t border-line/60 px-4 py-2 text-[12.5px]">
          <span className="truncate">{b.label}</span>
          <span className="text-right tabular-nums text-mute">{b.n}</span>
          <span className="text-right tabular-nums">{b.hitRate}%</span>
          <span className={clsx('text-right tabular-nums font-semibold', (b.roi ?? 0) >= 0 ? 'text-teal' : 'text-danger')}>
            {b.roi > 0 ? '+' : ''}{b.roi}%
          </span>
        </div>
      ))}
    </div>
  );
}
