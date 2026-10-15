/**
 * Derived money flow.
 *
 * There is no free public feed of real stake volume, so we *estimate* where the
 * money sits from what the market actually reveals: the de-margined implied
 * probability now vs. at open. A selection whose price collapses is where money
 * went. `volume` is a liquidity INDEX (not currency) — league tier, number of
 * books quoting and how far the line has travelled. Everything written here is
 * tagged source='derived' and labelled as an estimate in the UI.
 */
import { all, run, logIngest } from '@/lib/db';

interface Row {
  fixture_id: number; market: string; line: number; selection: string;
  open_price: number; price: number; books: number; tier: number; kickoff: string;
}

const devig = (prices: number[], market = '1X2') => {
  const raw = prices.map((p) => 1 / p);
  const s = raw.reduce((a, b) => a + b, 0) || 1;
  const target = market === 'DC' ? 2 : 1;  // the three DC selections sum to 2
  return raw.map((r) => (r / s) * target);
};

/**
 * Real money first: where the exchange shows an order book we use the observed
 * split of resting money. Ratios are exact regardless of the API's unit scale.
 */
function writeExchangeFlow(): Set<string> {
  const rows = all<{
    fixture_id: number; market: string; line: number; selection: string;
    back_money: number; matched_volume: number;
  }>(
    `SELECT e.fixture_id, e.market, e.line, e.selection, e.back_money, e.matched_volume
       FROM exchange e JOIN fixtures f ON f.id = e.fixture_id
      WHERE datetime(f.kickoff) > datetime('now','-4 hours')`,
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.fixture_id}|${r.market}|${r.line}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const covered = new Set<string>();
  for (const [k, g] of groups) {
    const total = g.reduce((a, r) => a + r.back_money, 0);
    if (g.length < 2 || total <= 0) continue;
    covered.add(k);
    for (const r of g) {
      run(
        `INSERT INTO money_flow(fixture_id,market,line,selection,share,volume,bets,source,updated_at)
         VALUES(@fixture_id,@market,@line,@selection,@share,@volume,NULL,'exchange',datetime('now'))
         ON CONFLICT(fixture_id,market,line,selection) DO UPDATE SET
           share=@share, volume=@volume, bets=NULL, source='exchange', updated_at=datetime('now')`,
        {
          fixture_id: r.fixture_id, market: r.market, line: r.line, selection: r.selection,
          share: +((r.back_money / total) * 100).toFixed(1),
          volume: Math.round(r.matched_volume),
        },
      );
    }
  }
  return covered;
}

export function rebuildMoneyFlow(): number {
  const t0 = Date.now();
  const rows = all<Row>(
    `SELECT oc.fixture_id, oc.market, oc.line, oc.selection, oc.open_price, oc.price, oc.books,
            COALESCE(l.tier,5) AS tier, f.kickoff
       FROM odds_current oc
       JOIN fixtures f ON f.id = oc.fixture_id
       LEFT JOIN leagues l ON l.id = f.league_id
      WHERE oc.phase='prematch' AND datetime(f.kickoff) > datetime('now','-4 hours')
        AND oc.market IN ('1X2','OU','BTTS','DC','AH')`,
  );

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.fixture_id}|${r.market}|${r.line}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }

  run(`DELETE FROM money_flow WHERE source='derived'`);
  const fromExchange = writeExchangeFlow();
  let n = 0;
  for (const [key, g] of groups) {
    if (g.length < 2) continue;
    if (fromExchange.has(key)) continue;  // real money beats an estimate
    const pNow = devig(g.map((r) => r.price), g[0].market);
    const pOpen = devig(g.map((r) => r.open_price), g[0].market);

    // tilt: probability gained since open, relative to its opening size
    const weights = g.map((r, i) => {
      const drift = (pNow[i] - pOpen[i]) / Math.max(0.03, pOpen[i]);
      return Math.max(0.01, pNow[i] * Math.exp(2.2 * drift));
    });
    const wSum = weights.reduce((a, b) => a + b, 0);

    const hoursOut = Math.max(0.5, (new Date(g[0].kickoff).getTime() - Date.now()) / 3.6e6);
    const tierW = [0, 100, 62, 38, 22, 12][Math.min(5, g[0].tier)] ?? 12;
    const travel = g.reduce((a, r) => a + Math.abs(r.price - r.open_price) / r.open_price, 0) / g.length;
    const liquidity = Math.round(tierW * (1 + travel * 4) * (1 + 2 / Math.sqrt(hoursOut)) * 10);

    g.forEach((r, i) => {
      const share = +((weights[i] / wSum) * 100).toFixed(1);
      run(
        `INSERT INTO money_flow(fixture_id,market,line,selection,share,volume,bets,source,updated_at)
         VALUES(@fixture_id,@market,@line,@selection,@share,@volume,@bets,'derived',datetime('now'))
         ON CONFLICT(fixture_id,market,line,selection) DO UPDATE SET
           share=@share, volume=@volume, bets=@bets, source='derived', updated_at=datetime('now')`,
        {
          fixture_id: r.fixture_id, market: r.market, line: r.line, selection: r.selection,
          share, volume: Math.round((liquidity * share) / 100),
          bets: Math.max(1, Math.round((liquidity * share) / 100 / 7)),
        },
      );
      n++;
    });
  }
  logIngest('moneyway', 'ok', `${groups.size} рынков, из них биржевых ${fromExchange.size}`, n, Date.now() - t0);
  return n;
}
