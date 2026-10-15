'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconRefresh, IconShield, IconChevron } from '@/components/Icons';
import clsx from 'clsx';

const money = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(v);

export default function ArbPage() {
  const [outcomes, setOutcomes] = useState(2);
  const [bank, setBank] = useState('10000');
  const [odds, setOdds] = useState(['2.10', '2.10', '']);

  const calc = useMemo(() => {
    const o = odds.slice(0, outcomes).map((x) => Number(String(x).replace(',', '.')) || 0);
    const valid = o.every((x) => x > 1);
    const b = Number(String(bank).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    if (!valid || b <= 0) return null;
    const sum = o.reduce((a, x) => a + 1 / x, 0);
    const stakes = o.map((x) => (b / x / sum));
    const payout = stakes[0] * o[0];
    return { o, sum, stakes, payout, profit: payout - b, roi: (1 / sum - 1) * 100, bank: b, arb: sum < 1 };
  }, [odds, outcomes, bank]);

  const setOdd = (i: number, v: string) => setOdds((p) => p.map((x, k) => (k === i ? v : x)));
  const reset = () => { setOdds(['2.10', '2.10', '']); setBank('10000'); setOutcomes(2); };

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-6 flex items-center gap-3 border-b border-line pb-5">
        <Link href="/tools" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute hover:text-white">
          <IconChevron className="h-4 w-4 rotate-180" />
        </Link>
        <div>
          <h1 className="text-[26px] font-bold">Калькулятор вилок</h1>
          <p className="mt-0.5 text-[13px] text-mute">Лучшие коэффициенты разных букмекеров — проверка вилки и разбивка банка</p>
        </div>
        <button onClick={reset} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute hover:text-white">
          <IconRefresh className="h-4 w-4" />
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="mb-5 flex gap-1.5 rounded-lg border border-line bg-panel-2 p-1">
              {[2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setOutcomes(n)}
                  className={clsx(
                    'flex-1 rounded-md py-2.5 text-[13px] font-semibold transition',
                    outcomes === n ? 'bg-brand text-white' : 'text-mute hover:text-slate-200',
                  )}
                >
                  {n} исхода
                </button>
              ))}
            </div>

            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Общий банк</div>
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-3">
              <input
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent text-[20px] font-semibold tabular-nums outline-none"
              />
              <span className="text-[16px] font-semibold text-mute-2">₽</span>
            </div>

            <div className={clsx('grid gap-3', outcomes === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
              {Array.from({ length: outcomes }).map((_, i) => (
                <div key={i}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Исход {i + 1}</div>
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-3">
                    <span className="text-[10px] font-bold text-mute-2">КФ</span>
                    <input
                      value={odds[i]}
                      onChange={(e) => setOdd(i, e.target.value)}
                      inputMode="decimal"
                      className="w-full bg-transparent text-right text-[18px] font-semibold tabular-nums outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          {!calc ? (
            <div className="py-20 text-center text-sm text-mute">Введите банк и коэффициенты больше 1.00</div>
          ) : (
            <>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className={clsx('mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]', calc.arb ? 'text-teal' : 'text-danger')}>
                    {calc.arb ? 'Вилка найдена' : 'Вилки нет'}
                  </div>
                  <div className={clsx('display text-[32px] font-bold leading-none tabular-nums', calc.arb ? 'text-slate-50' : 'text-danger')}>
                    {calc.profit >= 0 ? '+' : ''}{money(calc.profit)}
                  </div>
                  <div className="mt-1 text-[12px] text-mute">
                    {calc.arb ? 'гарантированная прибыль' : 'убыток при любом исходе'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={clsx('display text-[22px] font-bold tabular-nums', calc.arb ? 'text-teal' : 'text-danger')}>
                    {calc.roi.toFixed(2)}%
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">доход</div>
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="font-semibold text-mute">Сумма вероятностей</span>
                  <span className="font-semibold tabular-nums">{(calc.sum * 100).toFixed(2)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-panel-2">
                  <div
                    className={clsx('h-full rounded-sm', calc.arb ? 'bg-teal' : 'bg-danger')}
                    style={{ width: `${Math.min(100, calc.sum * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mb-2 text-[14px] font-semibold">Распределение банка</div>
              <div className="mb-4 text-[12px] text-mute">Выплата по каждому исходу: {money(calc.payout)}</div>

              <div className="space-y-4">
                {calc.stakes.map((s, i) => (
                  <div key={i}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="font-semibold">Исход {i + 1} · КФ {calc.o[i].toFixed(2)}</span>
                      <span className="font-semibold tabular-nums">{money(s)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-sm bg-panel-2">
                      <div className="h-full rounded-sm bg-brand" style={{ width: `${(s / calc.bank) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-start gap-2 rounded-lg border border-line bg-panel-2/60 px-3 py-2.5 text-[11px] text-mute-2">
                <IconShield className="mt-px h-4 w-4 shrink-0 text-mute-2" />
                Расчёт предполагает, что коэффициенты не изменятся до размещения всех ставок.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
