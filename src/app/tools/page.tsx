import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { IconTarget, IconCalc, IconWhistle, IconMoney, IconTrend, IconArrow } from '@/components/Icons';

const TOOLS = [
  { href: '/tools/insights', title: 'Схождение', cta: 'Открыть', icon: IconTarget, desc: 'Где независимые сигналы смотрят в одну сторону' },
  { href: '/track', title: 'Как отрабатывают прогнозы', cta: 'Смотреть результаты', icon: IconTrend, desc: 'Точность и ROI опубликованных рекомендаций по итоговым счетам' },
  { href: '/earnings', title: 'Заработок', cta: 'Задать цель', icon: IconCalc, desc: 'Баланс и минимум в день — план ставок и журнал результатов' },
  { href: '/bankroll', title: 'Банкролл и стратегии', cta: 'Собрать план', icon: IconCalc, desc: 'Депозит, три профиля риска и план ставок на день' },
  { href: '/tools/arb', title: 'Калькулятор вилок', cta: 'Рассчитать', icon: IconCalc, desc: 'Одинаковая выплата при любом исходе' },
  { href: '/tools/referees', title: 'Арбитры', cta: 'Открыть', icon: IconWhistle, desc: 'Фолы, жёлтые и красные по судьям' },
  { href: '/tools/moneyway', title: 'Движение денег', cta: 'Смотреть', icon: IconMoney, desc: 'Куда смещается объём внутри линии' },
  { href: '/tools/dropping', title: 'Движение линии', cta: 'Открыть', icon: IconTrend, desc: 'Матчи, где линия заметно просела' },
];

export default function ToolsPage() {
  return (
    <div>
      <PageHeader title="Инструменты" subtitle="Пять срезов по одному и тому же массиву данных" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map(({ href, title, cta, icon: Icon, desc }) => (
          <Link key={href} href={href} className="panel group flex flex-col p-5 transition hover:border-brand/45">
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3 transition group-hover:border-brand/50">
              <Icon className="h-[19px] w-[19px]" />
            </span>
            <h3 className="mb-1.5 text-[18px] font-bold">{title}</h3>
            <p className="mb-5 text-[13px] leading-relaxed text-mute">{desc}</p>
            <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand-3">
              {cta} <IconArrow className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
