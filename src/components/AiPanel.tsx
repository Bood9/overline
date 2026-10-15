'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { IconSpark, IconRefresh } from './Icons';
import { relative } from '@/lib/util/time';

interface Pick { market: string; selection: string; confidence: number; value?: string; reason: string }
interface Prediction {
  verdict: string; confidence: number; expected_score?: string; analysis: string;
  picks: Pick[]; risks?: string[]; model?: string; created_at?: string;
}

export default function AiPanel({ fixtureId, initial, enabled }: { fixtureId: number; initial: Prediction | null; enabled: boolean }) {
  const [data, setData] = useState<Prediction | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (force = false) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fixture: fixtureId, force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ошибка запроса');
      setData(json.prediction);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось получить разбор');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="ai" className="panel overflow-hidden">
      <div className="edge-top" />
      <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/40 bg-brand/15 text-brand-3">
          <IconSpark className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="text-[16px] font-bold">Разбор ИИ</h3>
          <p className="text-[11px] text-mute-2">
            {data?.model ? `${data.model}${data.created_at ? ` · ${relative(data.created_at)}` : ''}` : 'Gemini анализирует данные матча'}
          </p>
        </div>
        {data && (
          <button onClick={() => run(true)} disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute hover:text-white disabled:opacity-40">
            <IconRefresh className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
        )}
      </div>

      {!enabled && (
        <div className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-[12.5px] text-warn">
          Ключ Gemini не задан. Добавь <code>GEMINI_API_KEY</code> в <code>.env.local</code> и перезапусти сервер.
        </div>
      )}

      {enabled && !data && (
        <button onClick={() => run(false)} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-2 disabled:opacity-50">
          {loading ? 'ИИ анализирует матч…' : 'Получить разбор матча'}
        </button>
      )}

      {error && <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-[12.5px] text-danger">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-2 flex items-start gap-3">
              <div className="flex-1 text-[15px] font-semibold leading-snug">{data.verdict}</div>
              <div className="shrink-0 text-right">
                <div className="display text-[20px] font-bold tabular-nums text-brand-3">{data.confidence}</div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-mute-2">увер.</div>
              </div>
            </div>
            {data.expected_score && (
              <div className="text-[12px] text-mute">Ожидаемый счёт: <span className="font-bold text-slate-200">{data.expected_score}</span></div>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{data.analysis}</p>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Рекомендации</div>
            <div className="space-y-2">
              {data.picks?.map((p, i) => (
                <div key={i} className="rounded-lg border border-line bg-panel-2/60 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded border border-brand/40 bg-brand/12 px-2 py-0.5 text-[12.5px] font-semibold text-brand-3">{p.selection}</span>
                    <span className="text-[11px] text-mute-2">{p.market}</span>
                    {p.value && (
                      <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold',
                        p.value === 'есть' ? 'bg-teal/15 text-teal' : 'bg-white/8 text-mute-2')}>
                        value: {p.value}
                      </span>
                    )}
                    <span className="ml-auto text-[13px] font-semibold tabular-nums">{p.confidence}</span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-slate-300">{p.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {!!data.risks?.length && (
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Риски</div>
              <ul className="space-y-1.5">
                {data.risks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-mute">
                    <span className="text-warn">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-mute-2">
            Разбор сгенерирован по собранным данным и не является призывом делать ставки.
          </p>
        </div>
      )}
      </div>
    </section>
  );
}
