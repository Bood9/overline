export const TZ = process.env.NEXT_PUBLIC_TZ || 'Europe/Moscow';

const fmt = (opts: Intl.DateTimeFormatOptions, tz = TZ) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: tz, ...opts });

export const timeHM = (iso: string, tz = TZ) => fmt({ hour: '2-digit', minute: '2-digit' }, tz).format(new Date(iso));
export const dayMonth = (iso: string, tz = TZ) => fmt({ day: 'numeric', month: 'short' }, tz).format(new Date(iso));
export const weekdayShort = (iso: string, tz = TZ) => fmt({ weekday: 'short' }, tz).format(new Date(iso));
export const fullDate = (iso: string, tz = TZ) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }, tz).format(new Date(iso));

/** yyyy-mm-dd of "now" in the display timezone */
export function todayISO(tz = TZ): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return p.format(new Date());
}
export function shiftISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Сегодня, 21:30" / "Завтра, 19:45" / "18 сент., 22:00" */
export function kickoffLabel(iso: string, tz = TZ): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const today = todayISO(tz);
  const t = timeHM(iso, tz);
  if (day === today) return `Сегодня, ${t}`;
  if (day === shiftISO(today, 1)) return `Завтра, ${t}`;
  if (day === shiftISO(today, -1)) return `Вчера, ${t}`;
  return `${dayMonth(iso, tz)}, ${t}`;
}

export function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
  const d = Math.round(h / 24);
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const isLive = (status: string) => ['1H', '2H', 'HT', 'ET', 'PEN', 'LIVE', 'BT'].includes(status);
export const isDone = (status: string) => ['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO'].includes(status);

export function statusLabel(status: string, minute: number | null): string {
  if (status === 'HT') return 'Перерыв';
  if (status === 'FT' || status === 'AET') return 'Завершён';
  if (status === 'PST') return 'Отложен';
  if (status === 'CANC') return 'Отменён';
  if (isLive(status)) return minute ? `${minute}'` : 'Live';
  return '';
}
