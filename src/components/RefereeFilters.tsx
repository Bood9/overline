'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chip } from './ui';

const SORTS = [{ k: 'yellow', t: 'ЖК' }, { k: 'fouls', t: 'Фолы' }, { k: 'red', t: 'КК' }, { k: 'matches', t: 'Матчи' }];

export default function RefereeFilters({ leagues, league, sort }: { leagues: string[]; league: string; sort: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
    router.push(`/tools/referees?${p.toString()}`);
  };
  return (
    <div className="panel mb-4 grid gap-4 p-4 md:grid-cols-[minmax(0,300px)_1fr]">
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Лига</div>
        <select
          value={league}
          onChange={(e) => push({ league: e.target.value === 'all' ? null : e.target.value })}
          className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] font-semibold outline-none"
        >
          <option value="all">Все лиги</option>
          {leagues.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">Сортировать</div>
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <Chip key={s.k} active={sort === s.k} onClick={() => push({ sort: s.k })} className="flex-1 justify-center">{s.t}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
