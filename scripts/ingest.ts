import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { normalizeTeamNames } from '../src/lib/ai/names';
import { ingestExchange } from '../src/lib/ingest/exchange';
import { deriveDoubleChance } from '../src/lib/analytics/derived-markets';
import { ingestSports } from '../src/lib/ingest/sports';
import { ingestXg, mapFixtures, xgCoverage, freeWindow } from '../src/lib/ingest/xg';
import { runSchedule, runBackfill, runLiveTick, runOddsTick, ingestNews, ingestStats, rebuildReferees, rebuildTeamForm, rebuildMoneyFlow, rebuildInsights } from '../src/lib/ingest/run';

const task = process.argv[2] ?? 'schedule';
const arg = process.argv[3];

async function main() {
  const t = Date.now();
  let out: unknown;
  switch (task) {
    case 'schedule': out = await runSchedule(); break;
    case 'backfill': out = await runBackfill(Number(arg ?? 30)); break;
    case 'live': out = await runLiveTick(); break;
    case 'odds': out = await runOddsTick(); break;
    case 'news': out = await ingestNews(); break;
    case 'xg': {
      const mapped = await mapFixtures(freeWindow());
      const pulled = await ingestXg(60);
      out = { mapped, pulled, coverage: xgCoverage() };
      break;
    }
    case 'sports': out = await ingestSports(Number(arg ?? 72)); break;
    case 'exchange': out = await ingestExchange(Number(arg ?? 60)); break;
    case 'names': out = await normalizeTeamNames(Number(arg ?? 120)); break;
    case 'stats': out = await ingestStats(Number(arg ?? 40)); break;
    case 'aggregate':
      out = { form: rebuildTeamForm(), refs: rebuildReferees(), dc: deriveDoubleChance(), money: rebuildMoneyFlow(), insights: rebuildInsights() };
      break;
    default:
      console.error(`unknown task: ${task}`);
      process.exit(1);
  }
  console.log(JSON.stringify(out, null, 2));
  console.log(`done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
main().catch((e) => { console.error(e); process.exit(1); });
