'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { PageHeader, Chip, SignalChip } from '@/components/ui';
import { IconShield, IconWallet, IconRefresh } from '@/components/Icons';
import { timeHM, todayISO, shiftISO, dayMonth, plural } from '@/lib/util/time';

const rub = (v: number, sign = false) =>
  (sign && v > 0 ? '+' : '') + new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' ₽';
const pct = (v: number) => `${Math.round(v * 100)}%`;

const STATUS: Record<string, { t: string; c: string }> = {
  pending: { t: 'ждёт', c: 'border-line text-mute' },
  won: { t: 'выигрыш', c: 'border-teal/40 bg-teal/10 text-teal' },
  half_won: { t: 'полувыигрыш', c: 'border-teal/40 bg-teal/10 text-teal' },
  lost: { t: 'проигрыш', c: 'border-danger/40 bg-danger/10 text-danger' },
  half_lost: { t: 'полупроигрыш', c: 'border-danger/40 bg-danger/10 text-danger' },
  void: { t: 'возврат', c: 'border-line bg-white/5 text-mute' },
};

const VERDICT_STYLE: Record<string, string> = {
  realistic: 'border-teal/50 text-teal',
  stretch: 'border-accent/50 text-accent',
  aggressive: 'border-danger/50 text-danger',
  unreachable: 'border-danger/50 text-danger',
  no_picks: 'border-line text-mute',
};

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
}

export default function EarningsPage() {
  const [balance, setBalance] = useState('');
  const [target, setTarget] = useState('');
  const days = useMemo(() => { const t = todayISO(); return [t, shiftISO(t, 1), shiftISO(t, 2)]; }, []);
  const [day, setDay] = useState(days[0]);
  const [plan, setPlan] = useState<any>(null);
  const [journal, setJournal] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadJournal = useCallback(async () => {
    const r = await fetch('/api/earnings/journal').then((x) => x.json());
    setJournal(r.journal);
    return r.journal;
  }, []);

  // first load: journal balance wins, then what the user typed last time
  useEffect(() => {
    (async () => {
      const j = await loadJournal();
      const saved = load<{ balance?: string; target?: string }>('overline:earn', {});
      setBalance(j?.currentBalance ? String(Math.round(j.currentBalance)) : saved.balance ?? '10000');
      setTarget(saved.target ?? '100');
    })();
  }, [loadJournal]);

  const b = Number(balance.replace(/[^\d]/g, '')) || 0;
  const t = Number(target.replace(/[^\d]/g, '')) || 0;

  useEffect(() => {
    if (!b || !t) { setPlan(null); return; }
    save('overline:earn', { balance, target });
    const id = setTimeout(async () => {
      setLoading(true); setError(null);
      const res = await fetch(`/api/earnings?balance=${b}&target=${t}&day=${day}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error); setPlan(null); } else setPlan(json.plan);
      setLoading(false);
    }, 350);
    return () => clearTimeout(id);
  }, [b, t, day, balance, target]);

  const commit = async () => {
    setBusy(true); setNotice(null); setError(null);
    const res = await fetch('/api/earnings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ balance: b, target: t, day }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else {
      setNotice(`План на ${dayMonth(`${day}T12:00:00Z`)} зафиксирован: ${json.day.bets.length} ${plural(json.day.bets.length, 'ставка', 'ставки', 'ставок')}. Результаты посчитаются сами по итоговым счетам.`);
      await loadJournal();
      const p = await fetch(`/api/earnings?balance=${b}&target=${t}&day=${day}`).then((x) => x.json());
      setPlan(p.plan);
    }
    setBusy(false);
  };

  const removeDay = async (d: string) => {
    if (!confirm('Удалить план этого дня из журнала?')) return;
    const res = await fetch(`/api/earnings/journal?day=${d}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    await loadJournal();
  };
  const resetAll = async () => {
    if (!confirm('Очистить весь журнал? Это нельзя отменить.')) return;
    await fetch('/api/earnings/journal?all=1', { method: 'DELETE' });
    await loadJournal();
  };

  const sol = plan?.solution;
  const sim = plan?.daySim;
  const month = plan?.monthSim;
  const committed = plan?.committed;
  const roiDay = b ? (t / b) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Заработок"
        subtitle="Баланс и минимальный заработок в день — план ставок под эту цель и журнал результатов"
        right={<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3"><IconWallet className="h-[18px] w-[18px]" /></span>}
      />

      {/* inputs */}
      <div className="panel mb-4 grid gap-4 p-4 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_1fr]">
        <label className="block">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Баланс</div>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2.5 focus-within:border-brand/50">
            <input data-testid="balance" value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="numeric"
              className="w-full bg-transparent text-[19px] font-semibold tabular-nums outline-none" />
            <span className="text-mute-2">₽</span>
          </div>
          {journal?.currentBalance != null && Math.round(journal.currentBalance) !== b && (
            <button onClick={() => setBalance(String(Math.round(journal.currentBalance)))}
              className="mt-1.5 text-[11px] text-brand-3 hover:underline">
              взять из журнала: {rub(journal.currentBalance)}
            </button>
          )}
        </label>
        <label className="block">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Мин. заработок в день</div>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2.5 focus-within:border-brand/50">
            <input data-testid="target" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric"
              className="w-full bg-transparent text-[19px] font-semibold tabular-nums outline-none" />
            <span className="text-mute-2">₽</span>
          </div>
          {b > 0 && (
            <div className="mt-1.5 flex gap-1.5">
              {[0.005, 0.01, 0.02].map((f) => (
                <button key={f} onClick={() => setTarget(String(Math.round(b * f)))}
                  className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-mute hover:text-white">
                  {(f * 100).toFixed(1).replace('.0', '')}% · {rub(b * f)}
                </button>
              ))}
            </div>
          )}
        </label>
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">День</div>
          <div className="flex flex-wrap gap-2">
            {days.map((d, i) => (
              <Chip key={d} active={day === d} onClick={() => setDay(d)}>
                {['Сегодня', 'Завтра', 'Послезавтра'][i]} · {dayMonth(`${d}T12:00:00Z`)}
              </Chip>
            ))}
          </div>
          {b > 0 && t > 0 && (
            <p className="mt-2 text-[11.5px] text-mute-2">
              Цель — <span className={clsx('font-semibold', roiDay > 3 ? 'text-danger' : roiDay > 1 ? 'text-accent' : 'text-teal')}>
                {roiDay.toFixed(2)}% банка в день</span>
              {roiDay > 1 && ' · для ставок это очень много: профессионалы считают удачей 1–3% оборота за месяц'}
            </p>
          )}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger">{error}</div>}
      {notice && <div className="mb-4 rounded-lg border border-teal/40 bg-teal/10 px-4 py-3 text-[13px] text-teal">{notice}</div>}
      {loading && !plan && <div className="panel-flat mb-4 px-5 py-8 text-center text-sm text-mute">Считаю план…</div>}

      {plan && (
        <>
          {/* verdict */}
          <div data-testid="verdict" className={clsx('panel mb-4 border-l-4 p-4', VERDICT_STYLE[plan.verdict.verdict])}>
            <div className="text-[16px] font-bold">{plan.verdict.title}</div>
            <p className="mt-1 text-[13px] text-slate-300">{plan.verdict.text}</p>
            <p className="mt-1.5 text-[11.5px] text-mute-2">
              Матчей с перевесом на этот день: {plan.candidates}. В план взято не больше {plan.limits.maxBets},
              по одной ставке на матч.
            </p>
          </div>

          {sol.picks.length > 0 && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { v: rub(sol.expectedProfit, true), l: 'ожидаемый заработок', c: sol.expectedProfit >= t ? 'text-teal' : 'text-accent' },
                  { v: sim ? pct(sim.pHitTarget) : '—', l: `шанс заработать ≥ ${rub(t)} за день`, c: '' },
                  { v: sim ? pct(sim.pLoss) : '—', l: 'шанс уйти в минус за день', c: 'text-danger' },
                  { v: `${rub(sol.exposure)} · ${((sol.exposure / b) * 100).toFixed(1)}%`, l: 'в игре от баланса', c: '' },
                ].map((s, i) => (
                  <div key={i} className="panel px-4 py-3">
                    <div className={clsx('display truncate text-[20px] font-bold tabular-nums', s.c)}>{s.v}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute-2">{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="panel mb-4 overflow-hidden">
                <div className="edge-top" />
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-slate-300">Этот день</h3>
                    <ul className="space-y-1 text-[12.5px] text-mute">
                      <li>Если зайдёт всё: <b className="text-teal">{rub(sim.best, true)}</b></li>
                      <li>Если не зайдёт ничего: <b className="text-danger">{rub(sim.worst)}</b> ({pct(sim.pAllLost)} шанс)</li>
                      <li>Медиана дня: <b className="text-slate-200">{rub(sim.median, true)}</b>, 80% дней между {rub(sim.p10, true)} и {rub(sim.p90, true)}</li>
                      <li>Доля Келли: <b className="text-slate-200">{Math.round(sol.lambda * 100)}%</b> (не больше {Math.round(plan.limits.kellyMax * 100)}%)</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-slate-300">Если так 30 дней</h3>
                    <ul className="space-y-1 text-[12.5px] text-mute">
                      <li>Цель выполнится в среднем в <b className="text-slate-200">{month.avgDaysHit} днях из 30</b></li>
                      <li>Медианный баланс через месяц: <b className="text-slate-200">{rub(month.medianFinal)}</b></li>
                      <li>10% худших сценариев: <b className="text-danger">{rub(month.p10Final)}</b></li>
                      <li>Риск просесть до половины банка: <b className={month.pDrawdown50 > 0.1 ? 'text-danger' : 'text-slate-200'}>{pct(month.pDrawdown50)}</b></li>
                    </ul>
                    {plan.monthSimNoEdge && (
                      <div data-testid="stress" className="mt-3 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-[12px] text-mute">
                        <b className="text-warn">Если модель ошибается</b> и её вероятности не лучше рыночных:
                        через месяц медиана {rub(plan.monthSimNoEdge.medianFinal)}, в плюсе {pct(plan.monthSimNoEdge.pAboveStart)} сценариев,
                        цель в среднем в {plan.monthSimNoEdge.avgDaysHit} днях из 30.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="panel mb-4 overflow-hidden">
                <div className="hidden grid-cols-[1fr_8rem_4rem_4rem_6rem_6rem] gap-3 border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute-2 md:grid">
                  <span>Матч</span><span>Ставка</span><span className="text-right">Кэф</span><span className="text-right">Шанс</span>
                  <span className="text-right">Сумма</span><span className="text-right">Ожидание</span>
                </div>
                {sol.picks.map((p: any) => (
                  <div key={p.id} data-testid="pick" className="grid grid-cols-2 gap-2 border-b border-line/70 px-4 py-3 last:border-0 md:grid-cols-[1fr_8rem_4rem_4rem_6rem_6rem] md:items-center md:gap-3">
                    <Link href={`/match/${p.fixtureId}`} className="col-span-2 min-w-0 md:col-span-1">
                      <div className="truncate text-[13.5px] font-semibold">{p.meta.home} — {p.meta.away}</div>
                      <div className="truncate text-[11px] text-mute-2">{timeHM(p.meta.kickoff)} · {p.meta.league}</div>
                      <div className="mt-1 flex flex-wrap gap-1">{p.meta.signals.slice(0, 2).map((s: any, k: number) => <SignalChip key={k} source={s.source} />)}</div>
                    </Link>
                    <div>
                      <div className="text-[13px] font-semibold text-brand-3">{p.meta.label}</div>
                      <div className="text-[10px] text-mute-2">{p.meta.marketRu}</div>
                    </div>
                    <div className="text-right text-[14px] font-semibold tabular-nums">{p.price.toFixed(2)}</div>
                    <div className="text-right text-[13px] tabular-nums text-mute">{pct(p.prob)}</div>
                    <div className="text-right text-[14px] font-semibold tabular-nums">{rub(p.stake)}</div>
                    <div className={clsx('text-right text-[13px] tabular-nums', p.ev >= 0 ? 'text-teal' : 'text-danger')}>{rub(p.ev, true)}</div>
                  </div>
                ))}
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button data-testid="commit" onClick={commit} disabled={busy || plan.verdict.verdict === 'no_picks'}
                  className="rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-2 disabled:opacity-50">
                  {busy ? 'Фиксирую…' : committed ? 'Пересобрать план на этот день' : 'Зафиксировать план на день'}
                </button>
                <span className="text-[11.5px] text-mute-2">
                  Фиксация — это учёт на бумаге: платформа ставок не делает, а записывает план и сама считает результат по итоговым счетам.
                </span>
              </div>
            </>
          )}
        </>
      )}

      {/* journal */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[17px] font-bold uppercase tracking-[0.14em] text-slate-300">Журнал</h2>
          <button onClick={loadJournal} className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-mute hover:text-white" title="Обновить">
            <IconRefresh className="h-3.5 w-3.5" />
          </button>
          {journal?.days?.length > 0 && (
            <button onClick={resetAll} className="ml-auto text-[12px] text-danger hover:underline">Очистить журнал</button>
          )}
        </div>

        {!journal?.days?.length ? (
          <div className="panel-flat px-5 py-8 text-center text-sm text-mute">
            Журнал пуст. Зафиксируй план на день — после матчей здесь появятся результаты.
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { v: rub(journal.currentBalance), l: 'текущий баланс' },
                { v: rub(journal.totalPnl, true), l: 'итог', c: journal.totalPnl >= 0 ? 'text-teal' : 'text-danger' },
                { v: `${journal.daysHitTarget} / ${journal.settledDays}`, l: 'дней с выполненной целью' },
                { v: `${journal.bets.won}–${journal.bets.lost}${journal.bets.void ? ` · ${journal.bets.void} возвр.` : ''}`, l: `ставки · ждут ${journal.bets.pending}` },
                { v: journal.roi == null ? '—' : `${journal.roi > 0 ? '+' : ''}${journal.roi}%`, l: 'ROI рассчитанных ставок', c: (journal.roi ?? 0) >= 0 ? 'text-teal' : 'text-danger' },
              ].map((s: any, i) => (
                <div key={i} className="panel px-4 py-3">
                  <div className={clsx('display truncate text-[19px] font-bold tabular-nums', s.c)}>{s.v}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute-2">{s.l}</div>
                </div>
              ))}
            </div>

            <BalanceChart days={journal.days} />

            <div className="space-y-2.5">
              {journal.days.map((d: any) => (
                <div key={d.day} data-testid="journal-day" className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3">
                    <span className="text-[14px] font-bold">{dayMonth(`${d.day}T12:00:00Z`)}</span>
                    <span className="text-[12px] text-mute-2">баланс {rub(d.balance_start)} · цель {rub(d.target)}</span>
                    <span className={clsx('ml-auto text-[14px] font-bold tabular-nums', d.pnl > 0 ? 'text-teal' : d.pnl < 0 ? 'text-danger' : 'text-mute')}>
                      {rub(d.pnl, true)}
                    </span>
                    <span className={clsx('rounded border px-2 py-0.5 text-[10.5px] font-semibold',
                      d.status !== 'settled' ? 'border-line text-mute'
                        : d.hitTarget ? 'border-teal/40 bg-teal/10 text-teal' : 'border-danger/40 bg-danger/10 text-danger')}>
                      {d.status !== 'settled' ? `идёт · ждут ${d.pending}` : d.hitTarget ? 'цель выполнена' : 'цель не выполнена'}
                    </span>
                    {d.bets.every((x: any) => Date.parse(x.kickoff) > Date.now() || x.status !== 'pending') && (
                      <button onClick={() => removeDay(d.day)} className="text-[11px] text-mute-2 hover:text-danger">удалить</button>
                    )}
                  </div>
                  {d.bets.map((x: any) => (
                    <div key={x.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-line/60 px-4 py-2 text-[12.5px] last:border-0 md:grid-cols-[1fr_7rem_3.5rem_5.5rem_7rem_5.5rem] md:items-center">
                      <div className="min-w-0 truncate">
                        <span className="text-mute-2">{timeHM(x.kickoff)}</span> {x.home} — {x.away}
                        {x.goals_home != null && x.fixture_status !== 'NS' && (
                          <span className="ml-1.5 font-semibold tabular-nums text-slate-300">{x.goals_home}:{x.goals_away}</span>
                        )}
                      </div>
                      <div className="font-semibold text-brand-3">{x.label}</div>
                      <div className="tabular-nums text-mute md:text-right">{x.price.toFixed(2)}</div>
                      <div className="tabular-nums md:text-right">{rub(x.stake)}</div>
                      <div className="md:text-right">
                        <span className={clsx('rounded border px-1.5 py-0.5 text-[10.5px] font-semibold', STATUS[x.status]?.c)} title={x.note ?? ''}>
                          {STATUS[x.status]?.t ?? x.status}
                        </span>
                      </div>
                      <div className={clsx('tabular-nums md:text-right', x.payout == null ? 'text-mute-2' : x.payout - x.stake > 0 ? 'text-teal' : x.payout - x.stake < 0 ? 'text-danger' : 'text-mute')}>
                        {x.payout == null ? '—' : rub(x.payout - x.stake, true)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="panel mt-6 flex items-start gap-3 p-4 text-[12px] leading-relaxed text-mute">
        <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <div>
          <p className="mb-1.5 font-semibold text-slate-300">Как это работает и чего не делает</p>
          <p className="mb-1">Цель на день достигается масштабированием доли Келли, а не догоном: после проигрышного дня ставки не увеличиваются, а пересчитываются от нового баланса.</p>
          <p className="mb-1">Если цель требует больше половины Келли или больше 35% банка в игре — план говорит, что она недостижима, и показывает, какой нужен баланс.</p>
          <p className="mb-1">Ожидаемый заработок ≥ цели не значит, что цель выполняется каждый день: смотри шанс дня и прогон на 30 дней.</p>
          <p>Это аналитический инструмент, а не финансовый совет и не гарантия дохода.</p>
        </div>
      </div>
    </div>
  );
}

function BalanceChart({ days }: { days: any[] }) {
  const pts = [...days].reverse();
  if (pts.length < 2) return null;
  const values = [pts[0].balance_start, ...pts.map((d) => d.balance_start + d.pnl)];
  const lo = Math.min(...values), hi = Math.max(...values);
  const W = 600, H = 90, pad = 6;
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <div className="panel mb-3 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none">
        <line x1={pad} x2={W - pad} y1={y(values[0])} y2={y(values[0])} stroke="#272d42" strokeDasharray="4 4" />
        <path d={path} fill="none" stroke={up ? '#2fd4a7' : '#ff6b7a'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
