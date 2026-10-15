import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { runSchedule, runLiveTick, runOddsTick, ingestNews, ingestStats, ingestSports, rebuildReferees, rebuildTeamForm, dateRange } from '../src/lib/ingest/run';
import { ingestXg, mapFixtures, freeWindow } from '../src/lib/ingest/xg';
import { afEnabled } from '../src/lib/providers/apiFootball';

const MIN = 60_000;
const every = (ms: number, name: string, fn: () => Promise<unknown>) => {
  const tick = async () => {
    try {
      const r = await fn();
      console.log(`[${new Date().toISOString()}] ${name}`, JSON.stringify(r).slice(0, 300));
    } catch (e: any) {
      console.error(`[${new Date().toISOString()}] ${name} FAILED:`, e?.message ?? e);
    }
  };
  setInterval(tick, ms);
  return tick;
};

async function main() {
  console.log('Overline worker started');
  const live = every(Number(process.env.LIVE_INTERVAL_MIN || 1) * MIN, 'live', runLiveTick);
  const odds = every(Number(process.env.ODDS_INTERVAL_MIN || 15) * MIN, 'odds', runOddsTick);
  const news = every(Number(process.env.NEWS_INTERVAL_MIN || 10) * MIN, 'news', ingestNews);
  const sched = every(Number(process.env.SCHEDULE_INTERVAL_MIN || 180) * MIN, 'schedule', runSchedule);
  every(Number(process.env.SPORTS_INTERVAL_MIN || 20) * MIN, 'sports', () => ingestSports(72));
  if (afEnabled()) {
    // 100 requests a day — spread them out instead of burning them in one pass
    every(Number(process.env.XG_INTERVAL_MIN || 180) * MIN, 'xg', async () => {
      await mapFixtures(freeWindow());
      const r = await ingestXg(20);
      rebuildTeamForm();
      return r;
    });
  }
  every(Number(process.env.STATS_INTERVAL_MIN || 30) * MIN, 'stats', async () => {
    const r = await ingestStats(40);
    rebuildTeamForm();
    rebuildReferees();
    return r;
  });
  await sched();
  await live();
  await news();
  void odds;
}
main().catch((e) => { console.error(e); process.exit(1); });
