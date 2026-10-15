'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { PageHeader, Chip, Empty, SignalChip, Meter } from '@/components/ui';
import { IconCalc, IconShield, IconArrow } from '@/components/Icons';
import { timeHM } from '@/lib/util/time';

const money = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' ₽';

const CARDS = [
  { key: 'aggressive', name: 'Агрессивная', risk: 'высокий', accent: 'text-danger border-danger/40 bg-danger/10',
    bullets: ['2–4 ставки в день', 'кэфы 1.7–3.5', 'половина Келли, до 20% банка'] },
  { key: 'balanced', name: 'Баланс', risk: 'средний', accent: 'text-accent border-accent/40 bg-accent/10',
    bullets: ['3–6 ставок', 'кэфы 1.5–2.6', 'четверть Келли, до 8% банка'] },
  { key: 'light', name: 'Лайт · поток', risk: 'низкий', accent: 'text-teal border-teal/40 bg-teal/10',
    bullets: ['до 12 ставок', 'кэфы 1.18–1.6', 'фикс 4% банка'] },
] as const;

export default function BankrollPage() {
  const [bank, setBank] = useState('10000');
  const [strategy, setStrategy] = useState<'aggressive' | 'balanced' | 'light'>('balanced');
  const [goal, setGoal] = useState(2);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const b = Number(String(bank).replace(/[^\d]/g, '')) || 10000;
      const r = await fetch(`/api/bankroll?bank=${b}&strategy=${strategy}&goal=${goal}&day=${day}`).then((x) => x.json());
      setPlan(r.plan ?? null);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [bank, strategy, goal, day]);

  const sim = plan?.simulation;

  return (
    <div>
      <PageHeader
        title="Банкролл"
        subtitle="Депозит, стратегия и план ставок на сегодняшние схождения"
        back="/tools"
        right={<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3"><IconCalc className="h-[18px] w-[18px]" /></span>}
      />

      <div className="panel mb-4 grid gap-4 p-4 md:grid-cols-[minmax(0,260px)_auto_auto]">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Депозит</div>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2.5">
            <input value={bank} onChange={(e) => setBank(e.target.value)} inputMode="numeric"
              className="w-full bg-transparent text-[19px] font-semibold tabular-nums outline-none" />
            <span className="text-[15px] text-mute-2">₽</span>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Цель</div>
          <div className="flex gap-2">
            {[2, 3, 5].map((g) => (
              <Chip key={g} active={goal === g} onClick={() => setGoal(g)}>×{g}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">День</div>
          <div className="flex gap-2">
            <Chip active={day === 'today'} onClick={() => setDay('today')}>Сегодня</Chip>
            <Chip active={day === 'tomorrow'} onClick={() => setDay('tomorrow')}>Завтра</Chip>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {CARDS.map((c) => (
          <button key={c.key} onClick={() => setStrategy(c.key)}
            className={clsx('panel p-4 text-left transition', strategy === c.key ? 'border-brand/60' : 'hover:border-line-2')}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-[16px] font-bold">{c.name}</h3>
              <span className={clsx('ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold', c.accent)}>
                риск {c.risk}
              </span>
            </div>
            <ul className="space-y-1 text-[12px] text-mute">
              {c.bullets.map((b) => <li key={b}>· {b}</li>)}
            </ul>
          </button>
        ))}
      </div>

      {loading && <div className="panel-flat px-5 py-10 text-center text-sm text-mute">Считаю план…</div>}

      {!loading && plan && (
        <>
          <p className="mb-4 rounded-lg border border-line bg-panel-2/60 px-3.5 py-2.5 text-[12px] leading-relaxed text-mute">
            {plan.strategy.description}
          </p>

          {!plan.picks.length ? (
            <Empty>{plan.note}</Empty>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { v: money(plan.totalStake), l: `в игре · ${plan.totalStakeShare}% банка` },
                  { v: money(plan.bestCase), l: 'если зайдёт всё' },
                  { v: money(plan.worstCase), l: 'если не зайдёт ничего' },
                  { v: (plan.expectedValue >= 0 ? '+' : '') + money(plan.expectedValue), l: 'матожидание за день' },
                ].map((s, i) => (
                  <div key={i} className="panel px-4 py-3">
                    <div className={clsx('display truncate text-[20px] font-bold tabular-nums',
                      i === 3 && (plan.expectedValue >= 0 ? 'text-teal' : 'text-danger'))}>{s.v}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute-2">{s.l}</div>
                  </div>
                ))}
              </div>

              {sim && (
                <div className="panel mb-4 overflow-hidden">
                  <div className="edge-top" />
                  <div className="p-4">
                    <h3 className="mb-1 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Симуляция</h3>
                    <p className="mb-4 text-[12px] text-mute-2">
                      {sim.runs.toLocaleString('ru-RU')} прогонов по 20 дней с этим же набором ставок и долей от текущего банка.
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      {[
                        { v: `${sim.pGoal}%`, l: `дошли до ×${goal}`, good: sim.pGoal > 30 },
                        { v: `${sim.pProfit}%`, l: 'в плюсе', good: sim.pProfit > 50 },
                        { v: `${sim.pHalved}%`, l: 'потеряли половину', bad: sim.pHalved > 15 },
                        { v: money(sim.median), l: 'медианный банк' },
                        { v: sim.roundsToGoal ? `${sim.roundsToGoal} дн.` : '—', l: 'дней до цели' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-lg border border-line bg-panel-2 px-3 py-2.5">
                          <div className={clsx('display text-[18px] font-bold tabular-nums',
                            s.good && 'text-teal', s.bad && 'text-danger')}>{s.v}</div>
                          <div className="text-[10px] text-mute-2">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11.5px] text-mute-2">
                      <span>10% худших исходов: {money(sim.p10)}</span>
                      <span className="h-1 flex-1 rounded-sm bg-panel-2">
                        <span className="block h-full rounded-sm bg-brand"
                          style={{ width: `${Math.min(100, (sim.median / sim.p90) * 100)}%` }} />
                      </span>
                      <span>10% лучших: {money(sim.p90)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="panel overflow-hidden">
                <div className="hidden grid-cols-[1fr_7rem_4.5rem_4.5rem_5.5rem_5.5rem] items-center gap-3 border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute-2 md:grid">
                  <span>Матч</span><span>Ставка</span><span className="text-right">Кэф</span>
                  <span className="text-right">Шанс</span><span className="text-right">Сумма</span><span className="text-right">Выигрыш</span>
                </div>
                {plan.picks.map((p: any) => (
                  <div key={p.insight_id} className="grid grid-cols-2 gap-2 border-b border-line/70 px-4 py-3 last:border-0 md:grid-cols-[1fr_7rem_4.5rem_4.5rem_5.5rem_5.5rem] md:items-center md:gap-3">
                    <Link href={`/match/${p.fixture_id}`} className="col-span-2 min-w-0 md:col-span-1">
                      <div className="truncate text-[13.5px] font-semibold">{p.home} — {p.away}</div>
                      <div className="truncate text-[11px] text-mute-2">{timeHM(p.kickoff)} · {p.league}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.signals.slice(0, 2).map((s: any, k: number) => <SignalChip key={k} source={s.source} />)}
                      </div>
                    </Link>
                    <div>
                      <div className="text-[13px] font-semibold text-brand-3">{p.label}</div>
                      <div className="text-[10px] text-mute-2">{p.marketRu}</div>
                    </div>
                    <div className="text-right text-[14px] font-semibold tabular-nums">{p.price.toFixed(2)}</div>
                    <div className="text-right text-[13px] tabular-nums text-mute">{Math.round(p.usedProb * 100)}%</div>
                    <div className="text-right">
                      <div className="text-[14px] font-semibold tabular-nums">{money(p.stake)}</div>
                      <div className="text-[10px] text-mute-2">{p.stakeShare}%</div>
                    </div>
                    <div className="text-right text-[13px] font-semibold tabular-nums text-teal">+{money(p.toWin)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="panel mt-4 flex items-start gap-3 p-4 text-[12px] leading-relaxed text-mute">
            <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div>
              <p className="mb-1.5 font-semibold text-slate-300">Что здесь важно понимать</p>
              <p className="mb-1">{plan.note}</p>
              <p className="mb-1">
                Симуляция исходит из того, что наши вероятности верны. Если модель ошибается в свою пользу,
                реальный результат будет хуже показанного — поэтому доля Келли всегда дробная, а вероятности сжаты к рынку.
              </p>
              <p>Это аналитический инструмент, а не финансовый совет и не гарантия дохода.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
