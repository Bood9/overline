import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { ingestFixtures } from '../src/lib/ingest/fixtures';
import { settlePredictions, getTrackRecord } from '../src/lib/analytics/track-record';
import { settlePending } from '../src/lib/analytics/earnings';

async function main() {
  const days = Number(process.argv[2] ?? 4);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const r = await ingestFixtures(dates);
  console.log('fixtures updated:', r.fixtures, '| errors:', r.errors.length);
  console.log('predictions:', settlePredictions(), '| bet journal:', settlePending());
  const t = getTrackRecord();
  console.log('settled:', t.overall.n, '| pending:', t.pending);
}
main().catch((e) => { console.error(e); process.exit(1); });
