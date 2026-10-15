import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { ingestFixtures, ingestStats, dateRange } from '../src/lib/ingest/fixtures';
import { rebuildTeamForm, rebuildReferees } from '../src/lib/ingest/aggregates';

/** National-team history so the model has form for international windows. */
async function main() {
  const slugs = ['uefa.nations', 'fifa.friendly', 'fifa.world', 'concacaf.nations.league'];
  const r = await ingestFixtures(dateRange(-110, -1), slugs);
  console.log('national-team fixtures:', r.fixtures, 'errors:', r.errors.length, r.errors.slice(0, 2));
  let stats = 0;
  for (let i = 0; i < 10; i++) {
    const s = await ingestStats(40);
    stats += s.done;
    if (!s.done) break;
  }
  console.log('box scores:', stats, '| team form:', rebuildTeamForm(), '| referees:', rebuildReferees());
}
main().catch((e) => { console.error(e); process.exit(1); });
