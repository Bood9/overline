import { Suspense } from 'react';
import { PageHeader, Empty } from '@/components/ui';
import MatchesFilters from '@/components/MatchesFilters';
import LeagueGroup from '@/components/LeagueGroup';
import AutoRefresh from '@/components/AutoRefresh';
import { getMatchesByDate, getSportCounts } from '@/lib/queries';
import { todayISO, fullDate } from '@/lib/util/time';

export const dynamic = 'force-dynamic';

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const date = sp.date ?? todayISO();
  const league = sp.league ?? '';
  const liveOnly = sp.live === '1';
  const sport = sp.sport ?? 'football';

  let groups = getMatchesByDate(date, null, liveOnly, sport);
  if (league) groups = groups.filter((g) => g.league_ru === league);
  const total = groups.reduce((a, g) => a + g.matches.length, 0);

  return (
    <div className="mx-auto max-w-[1200px]">
      <AutoRefresh seconds={60} enabled={groups.some((g) => g.matches.some((m) => ['1H','2H','HT','ET'].includes(m.status)))} />
      <PageHeader
        title="Матчи"
        subtitle={`${date === todayISO() ? 'Сегодня · ' : ''}${fullDate(`${date}T12:00:00Z`)} · ${total} в расписании`}
      />

      <Suspense>
        <MatchesFilters
          date={date} league={league} liveOnly={liveOnly}
          sport={sport} sportCounts={getSportCounts(date)}
        />
      </Suspense>

      {total === 0 ? (
        <Empty>{liveOnly ? 'Live матчей сейчас нет.' : 'На эту дату матчей не найдено.'}</Empty>
      ) : (
        groups.map((g) => <LeagueGroup key={g.league_id} g={g} />)
      )}
    </div>
  );
}
