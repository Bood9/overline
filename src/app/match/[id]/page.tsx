import Link from 'next/link';
import { notFound } from 'next/navigation';
import clsx from 'clsx';
import TeamLogo from '@/components/TeamLogo';
import AiPanel from '@/components/AiPanel';
import { Meter, SignalChip } from '@/components/ui';
import { IconChevron, IconClock, IconWhistle } from '@/components/Icons';
import { getFixture } from '@/lib/queries';
import { cachedPrediction, geminiEnabled } from '@/lib/ai/gemini';
import { kickoffLabel, statusLabel, isLive } from '@/lib/util/time';
import { marketLabel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getFixture(Number(id));
  if (!data) notFound();
  const { fixture: f, odds, money, insights, stats, h2h, form, referee } = data;
  const live = isLive(f.status);
  const prediction = cachedPrediction(Number(id));

  const byMarket = odds.reduce((acc: Record<string, any[]>, o: any) => {
    const k = `${o.market}${o.line ? ` ${o.line}` : ''}`;
    (acc[k] ??= []).push(o);
    return acc;
  }, {});

  const homeStats = stats.find((s: any) => s.team_id === (f as any).home_id);
  const awayStats = stats.find((s: any) => s.team_id === (f as any).away_id);

  return (
    <div>
      <header className="mb-5 flex items-center gap-3 border-b border-line pb-4">
        <Link href="/matches" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute hover:text-white">
          <IconChevron className="h-4 w-4 rotate-180" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-mute-2">{f.league_ru}</div>
          <h1 className="truncate text-[20px] font-bold">{f.home_ru} — {f.away_ru}</h1>
        </div>
        <span className={clsx('ml-auto shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold',
          live ? 'border-danger/40 bg-danger/10 text-danger' : 'border-line bg-panel-2 text-slate-300')}>
          {live ? statusLabel(f.status, f.minute) : f.status === 'FT' ? 'Завершён' : kickoffLabel(f.kickoff)}
        </span>
      </header>

      <div className="panel mb-4 overflow-hidden">
        <div className="edge-top" />
        <div className="grid items-stretch gap-0 sm:grid-cols-[1fr_auto_1fr]">
          {[
            { logo: f.home_logo, name: f.home_ru, goals: f.goals_home, form: form.home?.form, side: 'left' },
          ].map((t) => (
            <div key="h" className="flex items-center gap-3 p-5">
              <TeamLogo src={t.logo} alt={t.name} size={44} />
              <div className="min-w-0">
                <div className="truncate text-[16px] font-bold">{t.name}</div>
                {t.form && <div className="text-[11px] tracking-[0.2em] text-mute-2">{t.form.slice(0, 5)}</div>}
              </div>
              {f.goals_home !== null && (live || f.status === 'FT') && (
                <span className="display ml-auto text-[30px] font-bold tabular-nums">{f.goals_home}</span>
              )}
            </div>
          ))}
          <div className="hidden w-px bg-line sm:block" />
          <div className="flex items-center gap-3 border-t border-line p-5 sm:border-t-0">
            <TeamLogo src={f.away_logo} alt={f.away_ru} size={44} />
            <div className="min-w-0">
              <div className="truncate text-[16px] font-bold">{f.away_ru}</div>
              {form.away?.form && <div className="text-[11px] tracking-[0.2em] text-mute-2">{form.away.form.slice(0, 5)}</div>}
            </div>
            {f.goals_away !== null && (live || f.status === 'FT') && (
              <span className="display ml-auto text-[30px] font-bold tabular-nums">{f.goals_away}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-5 py-3 text-[11.5px] text-mute-2">
          {f.venue && <span>{f.venue}</span>}
          {f.referee && (
            <span className="flex items-center gap-1.5">
              <IconWhistle className="h-3.5 w-3.5" />
              {f.referee}
              {referee ? ` · ${referee.yellow_avg.toFixed(1)} ЖК · ${referee.fouls_avg.toFixed(1)} фола` : ''}
            </span>
          )}
          <span className="ml-auto">{kickoffLabel(f.kickoff)}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <section className="panel p-5">
            <h3 className="mb-4 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Схождение сигналов</h3>
            {insights.length ? (
              <div className="space-y-3">
                {insights.slice(0, 7).map((i: any) => (
                  <div key={i.id} className="flex gap-3.5 rounded-lg border border-line bg-panel-2/50 p-3">
                    <Meter value={i.score} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="display text-[17px] font-bold">{i.label}</span>
                        <span className="text-[11px] text-mute-2">{marketLabel(i.market)}</span>
                        {i.price && <span className="ml-auto text-[13px] font-semibold tabular-nums text-brand-3">{i.price.toFixed(2)}</span>}
                      </div>
                      <p className="mt-0.5 text-[12px] text-mute">{i.headline}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {i.signals.map((s: any, k: number) => <SignalChip key={k} source={s.source} />)}
                      </div>
                      {i.signals.slice(0, 2).map((s: any, k: number) => (
                        <div key={k} className="mt-1.5 text-[11.5px] text-slate-400">{s.text}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mute">Сигналов для этого матча пока нет.</p>
            )}
          </section>

          <section className="panel p-5">
            <h3 className="mb-4 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Коэффициенты и движение</h3>
            {Object.keys(byMarket).length ? (
              <div className="space-y-4">
                {Object.entries(byMarket).map(([k, list]) => (
                  <div key={k}>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">
                      {marketLabel(k.split(' ')[0])}{k.includes(' ') ? ` ${k.split(' ')[1]}` : ''}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(list as any[]).map((o) => (
                        <div key={o.selection} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-mute-2">{o.label}</span>
                            {Math.abs(o.movement) >= 0.5 && (
                              <span className={clsx('text-[10px] font-semibold tabular-nums', o.movement < 0 ? 'text-teal' : 'text-danger')}>
                                {o.movement < 0 ? '↓' : '↑'}{Math.abs(o.movement).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            {o.open_price !== o.price && (
                              <span className="text-[11px] text-mute-2 line-through">{o.open_price.toFixed(2)}</span>
                            )}
                            <span className="text-[17px] font-semibold tabular-nums">{o.price.toFixed(2)}</span>
                          </div>
                          {o.best_book && <div className="text-[10px] text-mute-2">{o.best_book}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mute">Линия ещё не опубликована.</p>
            )}
          </section>

          {money.length > 0 && (
            <section className="panel p-5">
              <h3 className="mb-1 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Движение денег</h3>
              <p className="mb-4 text-[11px] text-mute-2">Оценка распределения объёма по движению линии.</p>
              <div className="space-y-3">
                {money.filter((m: any) => m.market === '1X2' || m.market === 'OU').slice(0, 8).map((m: any, i: number) => (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="font-semibold">{marketLabel(m.market)} · {m.label}</span>
                      <span className="font-extrabold">{m.share.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-sm bg-panel-2">
                      <div className="h-full rounded-sm bg-brand" style={{ width: `${m.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <AiPanel fixtureId={Number(id)} initial={prediction as any} enabled={geminiEnabled()} />

          {(form.home || form.away) && (
            <section className="panel p-5">
              <h3 className="mb-4 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Форма команд</h3>
              <div className="space-y-2 text-[12.5px]">
                {[
                  { l: 'Матчей', h: form.home?.played, a: form.away?.played },
                  { l: 'Забивает', h: form.home?.gf, a: form.away?.gf },
                  { l: 'Пропускает', h: form.home?.ga, a: form.away?.ga },
                  { l: 'xG за', h: form.home?.xg_for ?? null, a: form.away?.xg_for ?? null },
                  { l: 'Угловые', h: form.home?.corners_for, a: form.away?.corners_for },
                  { l: 'ЖК', h: form.home?.cards_for, a: form.away?.cards_for },
                  { l: 'Фолы', h: form.home?.fouls_for, a: form.away?.fouls_for },
                  { l: 'ОЗ %', h: form.home?.btts_pct, a: form.away?.btts_pct },
                  { l: 'ТБ 2.5 %', h: form.home?.over25_pct, a: form.away?.over25_pct },
                ].filter((r) => r.h != null || r.a != null).map((r) => (
                  <div key={r.l} className="flex items-center gap-2">
                    <span className="w-12 text-right font-semibold tabular-nums">{r.h ?? '—'}</span>
                    <span className="flex-1 text-center text-[11px] text-mute-2">{r.l}</span>
                    <span className="w-12 font-semibold tabular-nums">{r.a ?? '—'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(homeStats || awayStats) && (
            <section className="panel p-5">
              <h3 className="mb-4 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Статистика матча</h3>
              <div className="space-y-2 text-[12.5px]">
                {[
                  { l: 'Владение %', k: 'possession' }, { l: 'Удары', k: 'shots' },
                  { l: 'В створ', k: 'shots_on' }, { l: 'Угловые', k: 'corners' },
                  { l: 'Фолы', k: 'fouls' }, { l: 'ЖК', k: 'yellow' }, { l: 'КК', k: 'red' },
                ].map((r) => (
                  <div key={r.k} className="flex items-center gap-2">
                    <span className="w-12 text-right font-semibold tabular-nums">{homeStats?.[r.k] ?? '—'}</span>
                    <span className="flex-1 text-center text-[11px] text-mute-2">{r.l}</span>
                    <span className="w-12 font-semibold tabular-nums">{awayStats?.[r.k] ?? '—'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {h2h.length > 0 && (
            <section className="panel p-5">
              <h3 className="mb-4 text-[15px] font-bold uppercase tracking-[0.12em] text-slate-300">Личные встречи</h3>
              <div className="space-y-2">
                {h2h.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-[12.5px]">
                    <IconClock className="h-3.5 w-3.5 text-mute-2" />
                    <span className="text-mute-2">{m.kickoff.slice(0, 10)}</span>
                    <span className="ml-auto truncate font-semibold">{m.home}</span>
                    <span className="font-semibold tabular-nums text-brand-3">{m.goals_home}:{m.goals_away}</span>
                    <span className="truncate font-semibold">{m.away}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
