import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { one } from '../src/lib/db';
import { analyzeFixture } from '../src/lib/ai/gemini';

async function main() {
  const id = Number(process.argv[2]) ||
    one<{ id: number }>(`SELECT fixture_id id FROM insights ORDER BY score DESC LIMIT 1`)!.id;
  const f = one<any>(
    `SELECT th.name_ru h, ta.name_ru a, l.name_ru l FROM fixtures f
       JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
       LEFT JOIN leagues l ON l.id=f.league_id WHERE f.id=@id`, { id },
  );
  console.log(`=== ${f.h} — ${f.a} · ${f.l} (id ${id})\n`);
  const p = await analyzeFixture(id, true);
  console.log('VERDICT:', p.verdict, `| confidence ${p.confidence} | expected score ${p.expected_score ?? '-'}`);
  console.log('\nANALYSIS:', p.analysis);
  console.log('\nPICKS:');
  for (const x of p.picks) console.log(` • ${x.market} → ${x.selection} (${x.confidence}, value: ${x.value ?? '—'})\n   ${x.reason}`);
  if (p.risks?.length) console.log('\nRISKS:', p.risks.join(' | '));
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
