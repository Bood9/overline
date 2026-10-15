'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { MatchRow } from './MatchCards';
import TeamLogo from './TeamLogo';
import { IconChevron } from './Icons';
import type { DayGroup } from '@/lib/queries';
import { plural } from '@/lib/util/time';

export default function LeagueGroup({ g, defaultOpen = true }: { g: DayGroup; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel mb-2.5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-3 text-left hover:bg-white/[.03]">
        <TeamLogo src={g.league_logo} alt={g.league_ru} size={18} />
        <span className="truncate text-[13.5px] font-semibold">{g.league_ru}</span>
        <span className="truncate text-[11.5px] text-mute-2">{g.country ?? '—'}</span>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="text-[11.5px] text-mute-2">
            {g.matches.length} {plural(g.matches.length, 'матч', 'матча', 'матчей')}
          </span>
          <IconChevron className={clsx('h-4 w-4 text-mute-2 transition', open && 'rotate-90')} />
        </span>
      </button>
      {open && <div>{g.matches.map((m) => <MatchRow key={m.id} m={m} />)}</div>}
    </div>
  );
}
