import { PageHeader } from '@/components/ui';
import FlowBoard from '@/components/FlowBoard';
import { getMarketCounts, getFilterOptions } from '@/lib/queries';
import { IconMoney } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default function MoneywayPage() {
  return (
    <div>
      <PageHeader
        title="Движение денег"
        subtitle="Где концентрируется объём внутри линии и как на это реагируют коэффициенты"
        back="/tools"
        right={
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3">
            <IconMoney className="h-[18px] w-[18px]" />
          </span>
        }
      />
      <p className="mb-4 rounded-lg border border-line bg-panel-2/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-mute-2">
        Доля считается из де-маржинализированной вероятности и того, насколько цена ушла от открытия;
        «индекс» — относительная ликвидность рынка, а не сумма в валюте. ★ — самый низкий коэффициент в линии.
      </p>
      <FlowBoard mode="money" counts={getMarketCounts()} options={getFilterOptions()} />
    </div>
  );
}
