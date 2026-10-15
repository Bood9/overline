import { ingestFixtures, ingestLive, ingestStats, dateRange } from './fixtures';
import { ingestNews } from './news';
import { rebuildReferees, rebuildTeamForm } from './aggregates';
import { rebuildMoneyFlow } from '@/lib/analytics/moneyway';
import { deriveDoubleChance } from '@/lib/analytics/derived-markets';
import { ingestExchange } from './exchange';
import { ingestSports } from './sports';
import { settlePending } from '@/lib/analytics/earnings';
import { settlePredictions } from '@/lib/analytics/track-record';
import { rebuildInsights } from '@/lib/analytics/insights';
import { logIngest } from '@/lib/db';

export async function runSchedule() {
  const t0 = Date.now();
  const fx = await ingestFixtures(dateRange(-1, 7));
  const st = await ingestStats(30);
  rebuildTeamForm();
  rebuildReferees();
  deriveDoubleChance();
  const ex = await ingestExchange();
  const sports = await ingestSports();
  rebuildMoneyFlow();
  const ins = rebuildInsights();
  const news = await ingestNews();
  logIngest('schedule', 'ok', 'full pass', fx.fixtures, Date.now() - t0);
  return { fixtures: fx.fixtures, stats: st.done, exchange: ex.rows,
    sports: Object.fromEntries(Object.entries(sports).map(([k, v]) => [k, v.fixtures])),
    insights: ins, news: news.items, errors: [...fx.errors, ...news.errors] };
}

/** Deep back-fill: several weeks of results so referee/team profiles have a base. */
export async function runBackfill(days = 30) {
  const t0 = Date.now();
  const dates = dateRange(-days, 7);
  const fx = await ingestFixtures(dates);
  let done = 0;
  for (let i = 0; i < 12; i++) {
    const r = await ingestStats(40);
    done += r.done;
    if (!r.done) break;
  }
  rebuildTeamForm();
  rebuildReferees();
  rebuildMoneyFlow();
  const ins = rebuildInsights();
  logIngest('backfill', 'ok', `${days} days`, fx.fixtures, Date.now() - t0);
  return { fixtures: fx.fixtures, stats: done, insights: ins, errors: fx.errors };
}

export async function runLiveTick() {
  const r = await ingestLive();
  rebuildMoneyFlow();
  const earn = settlePending();
  const preds = settlePredictions();
  return { ...r, earnSettled: earn.settled + earn.voided, predictionsSettled: preds.settled + preds.voided };
}

export async function runOddsTick() {
  const today = dateRange(0, 2);
  const r = await ingestFixtures(today);
  deriveDoubleChance();
  const ex = await ingestExchange();
  rebuildMoneyFlow();
  const ins = rebuildInsights();
  return { ...r, exchange: ex.rows, insights: ins };
}

export { settlePending, ingestSports, ingestExchange, deriveDoubleChance, ingestFixtures, ingestLive, ingestStats, ingestNews, rebuildReferees, rebuildTeamForm, rebuildMoneyFlow, rebuildInsights, dateRange };
