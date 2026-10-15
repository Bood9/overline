import { Suspense } from 'react';
import { PageHeader, Empty, Stat } from '@/components/ui';
import RefereeFilters from '@/components/RefereeFilters';
import { getReferees, getRefereeLeagues, getRefereeCount } from '@/lib/queries';
import { IconWhistle } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function RefereesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const league = sp.league ?? 'all';
  const sort = (sp.sort ?? 'yellow') as any;
  const rows = getReferees({ league, sort, limit: 90 });
  const leagues = getRefereeLeagues();
  const total = getRefereeCount();
  const maxY = Math.max(6, ...rows.map((r) => r.yellow_avg));

  return (
    <div>
      <PageHeader
        title="Арбитры"
        subtitle="Средние показатели судей по матчам, протоколы которых собрала платформа"
        back="/tools"
        right={
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3">
            <IconWhistle className="h-[18px] w-[18px]" />
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat value={total} label="в базе" />
        <Stat value={rows.length} label="в выборке" />
        <Stat value={leagues.length} label="турниров" />
      </div>

      <Suspense><RefereeFilters leagues={leagues} league={league} sort={sort} /></Suspense>

      {!rows.length ? (
        <Empty>Пока нет статистики. Запусти <code className="text-brand-3">npm run ingest stats</code>.</Empty>
      ) : (
        <div className="panel overflow-hidden">
          <div className="hidden grid-cols-[2.2rem_minmax(0,1fr)_minmax(0,9rem)_3.5rem_1fr_4rem_4rem_1fr] items-center gap-3 border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute-2 md:grid">
            <span>#</span><span>Арбитр</span><span>Турнир</span><span className="text-right">Матчи</span>
            <span>Жёлтые за матч</span><span className="text-right">Фолы</span><span className="text-right">КК</span>
            <span className="text-right">Текущий сезон</span>
          </div>
          {rows.map((r, idx) => (
            <div key={r.id} className="grid grid-cols-2 items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0 hover:bg-white/[.03] md:grid-cols-[2.2rem_minmax(0,1fr)_minmax(0,9rem)_3.5rem_1fr_4rem_4rem_1fr]">
              <span className="text-[11.5px] tabular-nums text-mute-2">{String(idx + 1).padStart(2, '0')}</span>
              <span className="truncate text-[13.5px] font-semibold">{r.name}</span>
              <span className="truncate text-[11.5px] text-mute-2">{r.league ?? '—'}</span>
              <span className="text-right text-[12.5px] tabular-nums text-mute">{r.matches}</span>
              <span className="col-span-2 flex items-center gap-2 md:col-span-1">
                <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-panel-2">
                  <span className="block h-full rounded-sm bg-brand" style={{ width: `${(r.yellow_avg / maxY) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-[13px] font-semibold tabular-nums">{r.yellow_avg.toFixed(1)}</span>
              </span>
              <span className="text-right text-[12.5px] tabular-nums text-mute">{r.fouls_avg.toFixed(1)}</span>
              <span className="text-right text-[12.5px] tabular-nums text-mute">{r.red_avg.toFixed(2)}</span>
              <span className="col-span-2 text-right text-[11.5px] tabular-nums text-mute-2 md:col-span-1">
                {r.season_matches} м · {r.season_yellow.toFixed(1)} ЖК · {r.season_fouls.toFixed(1)} фола
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
