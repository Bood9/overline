'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chip, Toggle } from './ui';
import { IconCalendar } from './Icons';
import { shiftISO, todayISO } from '@/lib/util/time';

const LEAGUES = ['Все', 'АПЛ', 'Ла Лига', 'Серия А', 'Бундеслига', 'Лига 1', 'Лига чемпионов', 'Лига Европы', 'Лига конференций'];

const SPORTS = [
  { key: 'football', label: 'Футбол' },
  { key: 'hockey', label: 'Хоккей' },
  { key: 'basketball', label: 'Баскетбол' },
  { key: 'esports', label: 'Киберспорт' },
];

export default function MatchesFilters({
  date, league, liveOnly, sport, sportCounts,
}: {
  date: string; league: string; liveOnly: boolean;
  sport: string; sportCounts: { sport: string; n: number }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
    router.push(`/matches?${p.toString()}`);
  };

  const quick = [
    { d: shiftISO(todayISO(), -1), t: 'Вчера' },
    { d: todayISO(), t: 'Сегодня' },
    { d: shiftISO(todayISO(), 1), t: 'Завтра' },
  ];

  return (
    <div className="mb-5 space-y-3">
      <div className="hide-scroll flex gap-2 overflow-x-auto pb-1">
        {SPORTS.map((sp2) => (
          <Chip
            key={sp2.key}
            active={sport === sp2.key}
            onClick={() => push({ sport: sp2.key === 'football' ? null : sp2.key, league: null })}
            count={sportCounts.find((c) => c.sport === sp2.key)?.n}
          >
            {sp2.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {quick.map((q) => (
          <Chip key={q.d} active={date === q.d} onClick={() => push({ date: q.d })}>{q.t}</Chip>
        ))}
        <label className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] font-semibold">
          <IconCalendar className="h-4 w-4 text-brand-3" />
          <input
            type="date"
            value={date}
            onChange={(e) => push({ date: e.target.value })}
            className="bg-transparent outline-none [color-scheme:dark]"
          />
        </label>
        <label className="ml-auto flex items-center gap-2.5 rounded-lg border border-line bg-panel-2 px-3 py-2">
          <span className="text-[12.5px] font-semibold text-mute">только live</span>
          <Toggle on={liveOnly} onChange={(v) => push({ live: v ? '1' : null })} />
        </label>
      </div>

      {sport === 'football' && (
        <div className="hide-scroll flex gap-2 overflow-x-auto pb-1">
          {LEAGUES.map((l) => (
            <Chip key={l} active={league === l || (l === 'Все' && !league)} onClick={() => push({ league: l === 'Все' ? null : l })}>
              {l}
            </Chip>
          ))}
        </div>
      )}
      {sport !== 'football' && (
        <p className="rounded-lg border border-line bg-panel-2/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-mute-2">
          По этому виду спорта данные идут с биржи Smarkets: расписание, цены и реальный стакан.
          Протоколов матчей и модели по форме здесь нет — аналитика только рыночная.
        </p>
      )}
    </div>
  );
}
