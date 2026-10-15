'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chip } from './ui';

const CATS = [
  { k: 'all', t: 'Все' }, { k: 'outcome', t: 'Исходы' }, { k: 'goals', t: 'Голы' },
  { k: 'cards', t: 'Карточки' }, { k: 'fouls', t: 'Фолы' }, { k: 'corners', t: 'Угловые' },
];

export default function InsightFilters({ day, category }: { day: string; category: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
    router.push(`/tools/insights?${p.toString()}`);
  };
  return (
    <>
      <div className="mb-3 flex gap-2">
        <Chip active={day === 'today'} onClick={() => push({ day: null })}>Сегодня</Chip>
        <Chip active={day === 'tomorrow'} onClick={() => push({ day: 'tomorrow' })}>Завтра</Chip>
      </div>
      <div className="hide-scroll mb-5 flex gap-2 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <Chip key={c.k} active={category === c.k} onClick={() => push({ category: c.k === 'all' ? null : c.k })}>{c.t}</Chip>
        ))}
      </div>
    </>
  );
}
