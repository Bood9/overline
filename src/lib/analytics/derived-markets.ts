/**
 * Double chance is not quoted by our odds source, but it is a faithful transform
 * of the 1X2 market: de-vig the three prices, add the two probabilities, then put
 * the book's own overround back so the number matches what a board would show.
 */
import { all, run, logIngest } from '@/lib/db';

interface Row { fixture_id: number; selection: string; price: number; open_price: number }

const COMBOS: [string, string[]][] = [
  ['HOME_DRAW', ['HOME', 'DRAW']],
  ['HOME_AWAY', ['HOME', 'AWAY']],
  ['DRAW_AWAY', ['DRAW', 'AWAY']],
];

export function deriveDoubleChance(): number {
  const t0 = Date.now();
  const rows = all<Row>(
    `SELECT oc.fixture_id, oc.selection, oc.price, oc.open_price
       FROM odds_current oc JOIN fixtures f ON f.id = oc.fixture_id
      WHERE oc.market='1X2' AND oc.phase='prematch'
        AND datetime(f.kickoff) > datetime('now','-3 hours')`,
  );
  const byFixture = new Map<number, Row[]>();
  for (const r of rows) {
    if (!byFixture.has(r.fixture_id)) byFixture.set(r.fixture_id, []);
    byFixture.get(r.fixture_id)!.push(r);
  }

  let n = 0;
  for (const [fixtureId, g] of byFixture) {
    if (g.length !== 3) continue;
    const price = (sel: string) => g.find((x) => x.selection === sel)?.price ?? 0;
    const open = (sel: string) => g.find((x) => x.selection === sel)?.open_price ?? 0;
    if (['HOME', 'DRAW', 'AWAY'].some((s) => price(s) <= 1)) continue;

    const overround = ['HOME', 'DRAW', 'AWAY'].reduce((a, s) => a + 1 / price(s), 0);
    const openOverround = ['HOME', 'DRAW', 'AWAY'].reduce((a, s) => a + 1 / (open(s) || price(s)), 0);

    for (const [sel, parts] of COMBOS) {
      const fair = parts.reduce((a, s) => a + 1 / price(s) / overround, 0);
      const fairOpen = parts.reduce((a, s) => a + 1 / (open(s) || price(s)) / openOverround, 0);
      // put the same margin back, split across the two outcomes
      const quoted = +(1 / (fair * overround ** (2 / 3))).toFixed(2);
      const quotedOpen = +(1 / (fairOpen * openOverround ** (2 / 3))).toFixed(2);
      if (!Number.isFinite(quoted) || quoted <= 1.01) continue;

      run(
        `INSERT INTO odds_current(fixture_id,market,line,selection,open_price,price,best_price,best_book,books,movement,opened_at,updated_at,phase)
         VALUES(@fx,'DC',0,@sel,@open,@price,@price,'Расчёт из 1X2',1,
           ROUND((@price-@open)/@open*100,2), datetime('now'), datetime('now'), 'prematch')
         ON CONFLICT(fixture_id,market,line,selection,phase) DO UPDATE SET
           price=@price, open_price=@open, best_price=@price,
           movement=ROUND((@price-@open)/@open*100,2), updated_at=datetime('now')`,
        { fx: fixtureId, sel, price: quoted, open: quotedOpen > 1.01 ? quotedOpen : quoted },
      );
      n++;
    }
  }
  logIngest('derived_dc', 'ok', `${byFixture.size} матчей`, n, Date.now() - t0);
  return n;
}
