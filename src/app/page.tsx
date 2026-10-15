import Link from 'next/link';
import TopBar from '@/components/TopBar';
import AutoRefresh from '@/components/AutoRefresh';
import { TopMatchCard, MatchRow } from '@/components/MatchCards';
import { SectionTitle, Empty, Meter, SignalChip, Stat } from '@/components/ui';
import { IconTarget, IconCalc, IconWhistle, IconMoney, IconTrend, IconArrow } from '@/components/Icons';
import { getTopMatches, getLiveMatches, getInsights, getNews, getInsightStats, getHealth } from '@/lib/queries';
import { kickoffLabel, relative } from '@/lib/util/time';
import { marketLabel } from '@/lib/types';
import TeamLogo from '@/components/TeamLogo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TOOLS = [
  { href: '/tools/insights', title: 'Схождение', desc: 'Сигналы, смотрящие в одну сторону', icon: IconTarget },
  { href: '/tools/moneyway', title: 'Движение денег', desc: 'Где концентрируется объём', icon: IconMoney },
  { href: '/tools/dropping', title: 'Движение линии', desc: 'Кэфы, просевшие от открытия', icon: IconTrend },
  { href: '/tools/referees', title: 'Арбитры', desc: 'Фолы, ЖК и КК по судьям', icon: IconWhistle },
  { href: '/tools/arb', title: 'Вилки', desc: 'Разложить банк по исходам', icon: IconCalc },
];

export default function HomePage() {
  const top = getTopMatches(9);
  const live = getLiveMatches();
  const insights = getInsights({ day: 'today', limit: 4 });
  const news = getNews({ limit: 5 });
  const stats = getInsightStats('today');
  const health = getHealth();

  return (
    <div>
      <AutoRefresh seconds={60} enabled={live.length > 0} />

      <section className="mb-7">
        <h1 className="mb-1 text-[30px] font-bold leading-tight">Обзор дня</h1>
        <p className="mb-5 max-w-2xl text-[14px] text-mute">
          Линия, деньги и статистика по матчам в одном месте — и оценка того, где сигналы сходятся.
        </p>
        <TopBar />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat value={stats.matches} label="матчей сегодня" />
          <Stat value={stats.hot} label="сильных схождений" />
          <Stat value={live.length} label="сейчас в игре" />
          <Stat value={health.referees} label="профилей арбитров" />
        </div>
      </section>

      {live.length > 0 && (
        <section className="mb-7">
          <SectionTitle title="В игре" href="/matches?live=1" />
          <div className="panel overflow-hidden">
            {live.slice(0, 6).map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </section>
      )}

      <div className="mb-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionTitle title="Ближайшие матчи" href="/matches" hint="топ-турниры в порядке начала" />
          {top.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {top.map((m) => <TopMatchCard key={m.id} m={m} />)}
            </div>
          ) : (
            <Empty>Расписание ещё не загружено. Запусти <code className="text-brand-3">npm run ingest</code>.</Empty>
          )}
        </section>

        <div className="space-y-6">
          <section>
            <SectionTitle title="Схождение" href="/tools/insights" />
            {insights.length ? (
              <div className="panel divide-y divide-line/70">
                {insights.map((i) => (
                  <Link key={i.id} href={`/match/${i.fixture_id}`} className="flex items-start gap-3.5 px-4 py-3.5 transition hover:bg-white/[.035]">
                    <Meter value={i.score} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <TeamLogo src={i.home_logo} alt={i.home_ru} size={15} />
                        <TeamLogo src={i.away_logo} alt={i.away_ru} size={15} />
                        <span className="truncate text-[13px] font-semibold">{i.home_ru} — {i.away_ru}</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="display text-[15px] font-bold text-brand-3">{i.label}</span>
                        <span className="text-[11px] text-mute-2">{marketLabel(i.market)}</span>
                        <span className="ml-auto text-[11px] text-mute-2">{kickoffLabel(i.kickoff)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {i.signals.slice(0, 3).map((s: any, k: number) => <SignalChip key={k} source={s.source} />)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>Сегодня нет матчей с достаточным набором сигналов.</Empty>
            )}
          </section>

          <section>
            <SectionTitle title="Новости" href="/news" />
            <div className="panel divide-y divide-line/70">
              {news.map((n) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-white/[.035]">
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">{n.title}</div>
                  <div className="mt-1 text-[11px] text-mute-2">{n.source} · {relative(n.published_at)}</div>
                </a>
              ))}
              {!news.length && <div className="px-4 py-6 text-center text-sm text-mute">Новости ещё не загружены.</div>}
            </div>
          </section>
        </div>
      </div>

      <section>
        <SectionTitle title="Инструменты" href="/tools" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {TOOLS.map(({ href, title, desc, icon: Icon }) => (
            <Link key={href} href={href} className="panel group flex flex-col gap-3 p-4 transition hover:border-brand/45">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel-2 text-brand-3 transition group-hover:border-brand/50">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold">{title}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-mute">{desc}</p>
              </div>
              <IconArrow className="mt-auto h-4 w-4 text-mute-2 transition group-hover:translate-x-1 group-hover:text-brand-3" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
