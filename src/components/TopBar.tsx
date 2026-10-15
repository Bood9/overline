'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconSearch } from './Icons';
import TeamLogo from './TeamLogo';
import { kickoffLabel } from '@/lib/util/time';

export default function TopBar() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((x) => x.json());
      setResults(r.results ?? []);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={box} className="relative mb-6">
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-panel px-4 py-3 focus-within:border-brand/50">
        <IconSearch className="h-[18px] w-[18px] text-mute-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Команда, турнир или матч"
          className="w-full bg-transparent text-sm outline-none placeholder:text-mute-2"
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-mute-2 sm:block">поиск</kbd>
      </div>
      {open && results.length > 0 && (
        <div className="panel absolute inset-x-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto p-1.5">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/match/${r.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/5"
            >
              <TeamLogo src={r.home_logo} alt={r.home_ru} size={20} />
              <TeamLogo src={r.away_logo} alt={r.away_ru} size={20} />
              <span className="flex-1 truncate text-sm font-semibold">{r.home_ru} — {r.away_ru}</span>
              <span className="text-xs text-mute-2">{kickoffLabel(r.kickoff)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
