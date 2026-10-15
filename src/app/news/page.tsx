/* eslint-disable @next/next/no-img-element */
import { Suspense } from 'react';
import { PageHeader, Empty } from '@/components/ui';
import NewsFilters from '@/components/NewsFilters';
import { getNews, getNewsSources } from '@/lib/queries';
import { relative } from '@/lib/util/time';
import { IconClock, IconNews } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function NewsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const source = sp.source ?? 'all';
  const q = sp.q ?? '';
  const rows = getNews({ source, q, limit: 80 });
  const sources = getNewsSources();

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Новости" subtitle={`${rows.length} материалов из российских спортивных лент`} />
      <Suspense><NewsFilters sources={sources} active={source} q={q} /></Suspense>

      {!rows.length ? (
        <Empty>Ничего не найдено. Запусти <code className="text-brand-3">npm run ingest news</code>.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="panel flex items-center gap-4 p-3 transition hover:border-brand/45">
              {n.image ? (
                <img src={n.image} alt="" className="h-[64px] w-[88px] shrink-0 rounded-md object-cover" loading="lazy" />
              ) : (
                <div className="flex h-[64px] w-[88px] shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 text-mute-2">
                  <IconNews className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[14.5px] font-semibold leading-snug">{n.title}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-mute-2">
                  <IconClock className="h-3.5 w-3.5" />
                  {relative(n.published_at)} · {n.source}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
