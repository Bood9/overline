import { Suspense } from 'react';
import { PageHeader, Empty, Stat } from '@/components/ui';
import InsightCard from '@/components/InsightCard';
import InsightFilters from '@/components/InsightFilters';
import { getInsights, getInsightStats } from '@/lib/queries';
import { IconTarget } from '@/components/Icons';
import { fullDate, todayISO, shiftISO } from '@/lib/util/time';

export const dynamic = 'force-dynamic';

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const day = (sp.day === 'tomorrow' ? 'tomorrow' : 'today') as 'today' | 'tomorrow';
  const category = sp.category ?? 'all';
  const rows = getInsights({ day, category, limit: 60 });
  const stats = getInsightStats(day);
  const date = day === 'today' ? todayISO() : shiftISO(todayISO(), 1);

  return (
    <div>
      <PageHeader
        title="Схождение сигналов"
        subtitle="Модель против линии, деньги, движение кэфа, форма команд и профиль арбитра — в одной оценке"
        back="/tools"
        right={
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3">
            <IconTarget className="h-[18px] w-[18px]" />
          </span>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat value={stats.matches} label="матчей" />
        <Stat value={stats.hot} label="сильных схождений" />
        <Stat value={fullDate(`${date}T12:00:00Z`).replace(' г.', '')} label="дата" />
      </div>

      <Suspense><InsightFilters day={day} category={category} /></Suspense>

      {!rows.length ? (
        <Empty>
          Нет матчей с рассчитанными сигналами на эту дату. Запусти <code className="text-brand-3">npm run ingest aggregate</code>.
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((i) => <InsightCard key={i.id} i={i} />)}
        </div>
      )}
    </div>
  );
}
