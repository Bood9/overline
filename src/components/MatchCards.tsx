import Link from 'next/link';
import clsx from 'clsx';
import TeamLogo from './TeamLogo';
import { scoreColor } from '@/lib/score';
import { kickoffLabel, timeHM, statusLabel, isLive } from '@/lib/util/time';
import type { FixtureCard } from '@/lib/queries';

const SEL_LABEL: Record<string, string> = { HOME: '1', DRAW: 'X', AWAY: '2' };

export function OddsRow({ odds, compact }: { odds?: FixtureCard['odds']; compact?: boolean }) {
  if (!odds?.length) {
    return <div className="rounded-md border border-dashed border-line px-3 py-2 text-center text-[11px] text-mute-2">линия не открыта</div>;
  }
  const best = Math.min(...odds.map((o) => o.price));
  return (
    <div className={clsx('grid gap-1.5', odds.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {odds.map((o) => (
        <div
          key={o.selection}
          className={clsx(
            'flex items-center justify-between rounded-md border px-2.5 py-1.5',
            o.price === best ? 'border-brand/50 bg-brand/10' : 'border-line bg-panel-2',
          )}
        >
          <span className="text-[10px] font-semibold text-mute-2">{SEL_LABEL[o.selection] ?? o.selection}</span>
          <span className={clsx('font-semibold tabular-nums', compact ? 'text-[12px]' : 'text-[14px]', o.price === best ? 'text-brand-3' : 'text-slate-100')}>
            {o.price.toFixed(2)}
          </span>
          {!compact && Math.abs(o.movement) >= 1 && (
            <span className={clsx('text-[9px] font-semibold tabular-nums', o.movement < 0 ? 'text-teal' : 'text-danger')}>
              {o.movement < 0 ? '↓' : '↑'}{Math.abs(o.movement).toFixed(0)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Wide horizontal card — deliberately not the centred VS block of the reference. */
export function TopMatchCard({ m }: { m: FixtureCard }) {
  const live = isLive(m.status);
  return (
    <Link href={`/match/${m.id}`} className="panel group block overflow-hidden p-0 transition hover:border-brand/45">
      <div className="edge-top" style={m.top_score ? { backgroundImage: `linear-gradient(90deg, ${scoreColor(m.top_score)}, transparent 60%)` } : undefined} />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <TeamLogo src={m.league_logo} alt={m.league_ru} size={14} />
          <span className="truncate font-semibold uppercase tracking-[0.08em] text-mute-2">{m.league_ru}</span>
          <span className={clsx('ml-auto shrink-0 font-semibold tabular-nums', live ? 'text-danger' : 'text-slate-300')}>
            {live ? statusLabel(m.status, m.minute) : kickoffLabel(m.kickoff)}
          </span>
        </div>

        <div className="mb-3.5 space-y-2">
          {[
            { logo: m.home_logo, name: m.home_ru, goals: m.goals_home },
            { logo: m.away_logo, name: m.away_ru, goals: m.goals_away },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <TeamLogo src={t.logo} alt={t.name} size={24} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t.name}</span>
              {t.goals !== null && (live || m.status === 'FT') && (
                <span className="display text-[16px] font-bold tabular-nums">{t.goals}</span>
              )}
            </div>
          ))}
        </div>

        <OddsRow odds={m.odds} />

        <div className="mt-3 flex items-center gap-2 text-[11px] text-mute-2">
          <span className="truncate">{m.venue ?? '—'}</span>
          {m.top_score != null && m.top_score >= 65 && (
            <span className="ml-auto shrink-0 rounded border border-line px-1.5 py-0.5 font-semibold" style={{ color: scoreColor(m.top_score) }}>
              схождение {m.top_score}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MatchRow({ m }: { m: FixtureCard }) {
  const live = isLive(m.status);
  return (
    <Link href={`/match/${m.id}`} className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5 transition last:border-0 hover:bg-white/[.035]">
      <div className="w-12 shrink-0">
        {live ? (
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-danger">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-danger" />
            {statusLabel(m.status, m.minute)}
          </span>
        ) : (
          <span className="text-[12.5px] font-semibold tabular-nums text-mute">
            {m.status === 'FT' ? 'FT' : timeHM(m.kickoff)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {[
          { logo: m.home_logo, name: m.home_ru, goals: m.goals_home },
          { logo: m.away_logo, name: m.away_ru, goals: m.goals_away },
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <TeamLogo src={t.logo} alt={t.name} size={18} />
            <span className="truncate text-[13.5px] font-medium">{t.name}</span>
            {t.goals !== null && (live || m.status === 'FT') && (
              <span className={clsx('ml-auto pr-1 text-[13px] font-bold tabular-nums', live ? 'text-brand-3' : 'text-slate-300')}>{t.goals}</span>
            )}
          </div>
        ))}
      </div>

      {m.odds?.length ? <div className="hidden w-[190px] shrink-0 sm:block"><OddsRow odds={m.odds} compact /></div> : null}
    </Link>
  );
}
