import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { ingestStats } from '../src/lib/ingest/fixtures';
import { rebuildTeamForm, rebuildReferees } from '../src/lib/ingest/aggregates';
import { rebuildMoneyFlow } from '../src/lib/analytics/moneyway';
import { rebuildInsights } from '../src/lib/analytics/insights';

async function main() {
  const passes = Number(process.argv[2] ?? 12);
  let total = 0;
  for (let i = 0; i < passes; i++) {
    const r = await ingestStats(40);
    total += r.done;
    console.log(`pass ${i + 1}: +${r.done} (errors ${r.errors.length})`);
    if (!r.done) break;
  }
  console.log('team form:', rebuildTeamForm());
  console.log('referees:', rebuildReferees());
  console.log('moneyway:', rebuildMoneyFlow());
  console.log('insights:', rebuildInsights());
  console.log('box scores pulled in total:', total);
}
main().catch((e) => { console.error(e); process.exit(1); });
