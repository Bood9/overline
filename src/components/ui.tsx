'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { IconArrow, IconChevron } from './Icons';
import { scoreColor } from '@/lib/score';

export function PageHeader({
  title, subtitle, right, back,
}: { title: string; subtitle?: string; right?: React.ReactNode; back?: string }) {
  return (
    <header className="mb-6 flex items-center gap-3 border-b border-line pb-5">
      {back && (
        <Link href={back} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-mute hover:text-white">
          <IconChevron className="h-4 w-4 rotate-180" />
        </Link>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>}
      </div>
      <div className="ml-auto shrink-0">{right}</div>
    </header>
  );
}

export function Chip({
  active, children, onClick, className, count,
}: { active?: boolean; children: React.ReactNode; onClick?: () => void; className?: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition',
        active
          ? 'border-brand/60 bg-brand/15 text-brand-3'
          : 'border-line bg-panel-2 text-mute hover:border-line-2 hover:text-slate-200',
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <span className={clsx('rounded px-1 text-[10px]', active ? 'bg-brand/25 text-brand-3' : 'bg-white/5 text-mute-2')}>{count}</span>
      )}
    </button>
  );
}

export function SectionTitle({ title, href, action, hint }: { title: string; href?: string; action?: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-end gap-3">
      <div>
        <h2 className="text-[17px] font-bold uppercase tracking-[0.14em] text-slate-300">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-mute-2">{hint}</p>}
      </div>
      {href && (
        <Link href={href} className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-brand-3 hover:text-brand">
          {action ?? 'Все'} <IconChevron className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel-flat px-5 py-10 text-center text-sm text-mute">{children}</div>;
}

export function GreenButton({
  href, children, onClick, disabled, variant = 'solid',
}: { href?: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'solid' | 'ghost' }) {
  const cls = clsx(
    'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition disabled:opacity-50',
    variant === 'solid'
      ? 'bg-brand text-white hover:bg-brand-2'
      : 'border border-line bg-panel-2 text-slate-200 hover:border-brand/50 hover:text-white',
  );
  if (href) return <Link href={href} className={cls}>{children}<IconArrow className="h-4 w-4" /></Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}<IconArrow className="h-4 w-4" /></button>;
}

/** Segmented meter — the house gauge for a 0–100 convergence score. */
export function Meter({ value, label = 'СХОД', size = 'md' }: { value: number; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const v = Math.max(0, Math.min(100, value));
  const color = scoreColor(v);
  const segs = 10;
  const filled = Math.round((v / 100) * segs);
  const dims = { sm: 'text-[17px]', md: 'text-[22px]', lg: 'text-[30px]' }[size];
  return (
    <div className="shrink-0">
      <div className="flex items-baseline gap-1">
        <span className={clsx('display font-bold leading-none', dims)} style={{ color }}>{Math.round(v)}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-mute-2">{label}</span>
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {Array.from({ length: segs }).map((_, i) => (
          <span
            key={i}
            className="h-[5px] w-[6px] rounded-[1px] transition"
            style={{ background: i < filled ? color : '#272d42', opacity: i < filled ? 1 : 1 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Kept for compatibility with older call sites. */
export const Ring = ({ value, label }: { value: number; size?: number; label?: string }) => (
  <Meter value={value} label={label ?? 'СХОД'} />
);

export function SignalChip({ source }: { source: string }) {
  const map: Record<string, string> = {
    Moneyway: 'border-brand/50 bg-brand/15 text-brand-3',
    'Падение кэфов': 'border-teal/40 bg-teal/12 text-teal',
    Combined: 'border-accent/40 bg-accent/12 text-accent',
    Команды: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
    Арбитр: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300',
  };
  return (
    <span className={clsx('rounded border px-2 py-[3px] text-[10px] font-semibold', map[source] ?? 'border-line bg-white/5 text-mute')}>
      {source}
    </span>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={clsx('relative h-6 w-11 shrink-0 rounded-md border transition',
        on ? 'border-brand/60 bg-brand/30' : 'border-line bg-panel-2')}
    >
      <span className={clsx('absolute top-[3px] h-4 w-4 rounded-[3px] transition-all',
        on ? 'left-[26px] bg-brand-3' : 'left-[3px] bg-mute-2')} />
    </button>
  );
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="display truncate text-[22px] font-bold">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mute-2">{label}</div>
    </div>
  );
}
