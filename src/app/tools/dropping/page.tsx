import { PageHeader } from '@/components/ui';
import FlowBoard from '@/components/FlowBoard';
import { getMarketCounts, getFilterOptions } from '@/lib/queries';
import { IconTrend } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default function DroppingPage() {
  return (
    <div>
      <PageHeader
        title="Движение линии"
        subtitle="Матчи, где коэффициент заметно ушёл от цены открытия"
        back="/tools"
        right={
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3">
            <IconTrend className="h-[18px] w-[18px]" />
          </span>
        }
      />
      <p className="mb-4 rounded-lg border border-line bg-panel-2/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-mute-2">
        ↓ падение · ↑ рост. Сравнение идёт с ценой открытия рынка и с нашими собственными срезами линии.
      </p>
      <FlowBoard mode="drop" counts={getMarketCounts()} options={getFilterOptions()} />
    </div>
  );
}
