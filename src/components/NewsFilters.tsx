'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chip } from './ui';
import { IconSearch } from './Icons';

export default function NewsFilters({ sources, active, q }: { sources: string[]; active: string; q: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [text, setText] = useState(q);
  const [open, setOpen] = useState(!!q);

  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null || v === '' ? p.delete(k) : p.set(k, v);
    router.push(`/news?${p.toString()}`);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="hide-scroll flex flex-1 gap-2 overflow-x-auto">
          <Chip active={active === 'all'} onClick={() => push({ source: null })}>Все</Chip>
          {sources.map((s) => (
            <Chip key={s} active={active === s} onClick={() => push({ source: s })}>{s}</Chip>
          ))}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute hover:text-white"
        >
          <IconSearch className="h-[18px] w-[18px]" />
        </button>
      </div>
      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); push({ q: text }); }}
          className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-2.5"
        >
          <IconSearch className="h-4 w-4 text-mute-2" />
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Поиск по новостям..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-mute-2"
          />
        </form>
      )}
    </div>
  );
}
