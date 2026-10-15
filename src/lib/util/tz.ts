import { TZ } from './time';

/** UTC offset of a timezone at a given instant, in minutes (Moscow -> 180). */
export function offsetMinutes(tz = TZ, at = new Date()): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = part.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

const sqliteTs = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** A local calendar day as a UTC window in SQLite's own timestamp format. */
export function dayBoundsUtc(day: string, tz = TZ): { start: string; end: string } {
  const noon = new Date(`${day}T12:00:00Z`);
  const off = offsetMinutes(tz, noon);
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - off * 60_000);
  const end = new Date(start.getTime() + 24 * 3.6e6);
  return { start: sqliteTs(start), end: sqliteTs(end) };
}
