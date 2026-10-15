import { all, one } from '@/lib/db';
import { selectionLabel, marketLabel } from '@/lib/types';
import { getForm, goalLambdas, goalProbs, secondaryExpectations } from '@/lib/analytics/model';

export interface AiContext { fixture: any; text: string }

const SPORT_RU: Record<string, string> = {
  hockey: 'хоккей', basketball: 'баскетбол', esports: 'киберспорт',
};

/** Market-only brief: prices, their movement and the exchange order book. */
function buildMarketContext(f: any): AiContext {
  const odds = all<any>(
    `SELECT market,line,selection,price,open_price,movement FROM odds_current
      WHERE fixture_id=@id AND phase='prematch' ORDER BY market, line`, { id: f.id },
  );
  const ex = all<any>(
    `SELECT market,line,selection,back_price,lay_price,mid_price,back_money,lay_money,matched_volume
       FROM exchange WHERE fixture_id=@id ORDER BY market, line`, { id: f.id },
  );
  const text = [
    `МАТЧ: ${f.home_ru || f.home} — ${f.away_ru || f.away}`,
    `Вид спорта: ${SPORT_RU[f.sport] ?? f.sport}. Турнир: ${f.league_ru || f.league || '—'}, начало ${f.kickoff} UTC.`,
    '',
    'ВАЖНО: по этому виду спорта у нас нет статистики команд, составов и результатов —',
    'только биржевые цены и стакан. Не выдумывай форму, травмы и прошлые матчи.',
    '',
    odds.length
      ? `ЦЕНЫ (открытие → текущая, движение %):\n${odds
          .map((o) => `${marketLabel(o.market)} ${selectionLabel(o.market, o.line, o.selection)}: ${o.open_price} → ${o.price} (${o.movement > 0 ? '+' : ''}${o.movement}%)`)
          .join('\n')}`
      : 'ЦЕНЫ: нет данных',
    '',
    ex.length
      ? `СТАКАН БИРЖИ (деньги на ставку / против ставки):\n${ex
          .map((e) => `${marketLabel(e.market)} ${selectionLabel(e.market, e.line, e.selection)}: back ${e.back_price ?? '—'} / lay ${e.lay_price ?? '—'}, денег за ${Math.round(e.back_money)} против ${Math.round(e.lay_money)}`)
          .join('\n')}`
      : '',
  ].filter(Boolean).join('\n');
  return { fixture: f, text };
}

/** Everything the model is allowed to reason over, as compact text. */
export function buildFixtureContext(fixtureId: number): AiContext | null {
  const f = one<any>(
    `SELECT f.*, th.name AS home, th.name_ru AS home_ru, ta.name AS away, ta.name_ru AS away_ru,
            l.name AS league, l.name_ru AS league_ru, l.country
       FROM fixtures f JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
       LEFT JOIN leagues l ON l.id=f.league_id WHERE f.id=@id`,
    { id: fixtureId },
  );
  if (!f) return null;
  // Hockey, basketball and esports have no box-score feed here, so the football
  // model must never touch them — they get a market-only brief instead.
  if (f.sport && f.sport !== 'football') return buildMarketContext(f);

  const hf = getForm(f.home_id), af = getForm(f.away_id);
  const ref = f.referee
    ? one<any>('SELECT * FROM referees WHERE name=@n', { n: f.referee })
    : null;
  const lam = goalLambdas(hf, af);
  const gp = goalProbs(lam);
  const sec = secondaryExpectations(hf, af, ref);

  const odds = all<any>(
    `SELECT market,line,selection,price,open_price,movement FROM odds_current
      WHERE fixture_id=@id AND phase='prematch' ORDER BY market, line`, { id: fixtureId },
  );
  const money = all<any>(
    `SELECT market,line,selection,share,volume FROM money_flow WHERE fixture_id=@id ORDER BY volume DESC`,
    { id: fixtureId },
  );
  const insights = all<any>(
    `SELECT label,market,line,selection,score,headline,signals FROM insights
      WHERE fixture_id=@id ORDER BY score DESC LIMIT 12`, { id: fixtureId },
  );
  const h2h = all<any>(
    `SELECT f.kickoff, th.name AS home, ta.name AS away, f.goals_home, f.goals_away
       FROM fixtures f JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
      WHERE f.status IN ('FT','AET','PEN')
        AND ((f.home_id=@h AND f.away_id=@a) OR (f.home_id=@a AND f.away_id=@h))
      ORDER BY f.kickoff DESC LIMIT 5`,
    { h: f.home_id, a: f.away_id },
  );
  const news = all<any>(
    `SELECT title, source, published_at FROM news
      WHERE datetime(published_at) > datetime('now','-3 days')
        AND (title LIKE @h OR title LIKE @a) ORDER BY published_at DESC LIMIT 6`,
    { h: `%${(f.home_ru || f.home).split(' ')[0]}%`, a: `%${(f.away_ru || f.away).split(' ')[0]}%` },
  );

  const formLine = (t: any, name: string) =>
    t
      ? [
          `${name}: ${t.played} матчей, форма ${t.form ?? '—'}`,
          `забивает ${t.gf}, пропускает ${t.ga}`,
          t.xg_for ? `xG ${t.xg_for}/${t.xg_against}` : 'xG — данных нет',
          t.corners_for ? `угловые ${t.corners_for}/${t.corners_against}` : 'угловые — данных нет',
          t.cards_for ? `ЖК ${t.cards_for}` : 'ЖК — данных нет',
          t.fouls_for ? `фолы ${t.fouls_for}` : 'фолы — данных нет',
          `ОЗ ${t.btts_pct}%, ТБ2.5 ${t.over25_pct}%`,
        ].join(', ')
      : `${name}: статистики недостаточно`;

  const text = [
    `МАТЧ: ${f.home_ru || f.home} — ${f.away_ru || f.away}`,
    `Турнир: ${f.league_ru || f.league || '—'} (${f.country ?? '—'}), начало ${f.kickoff} UTC, стадион ${f.venue ?? '—'}`,
    f.referee ? `Арбитр: ${f.referee}${ref ? ` — ${ref.matches} матчей, ${ref.yellow_avg} ЖК, ${ref.fouls_avg} фола, ${ref.red_avg} КК за матч` : ''}` : 'Арбитр: не назначен/неизвестен',
    '',
    'ФОРМА КОМАНД (последние матчи, средние за игру):',
    formLine(hf, f.home_ru || f.home),
    formLine(af, f.away_ru || f.away),
    '',
    `МОДЕЛЬ (Пуассон по силе атаки и обороны; xG используется, только если он есть): ожидаемые голы ${lam.home.toFixed(2)} — ${lam.away.toFixed(2)} (тотал ${gp.exp.toFixed(2)})`,
    `П1 ${(gp.home * 100).toFixed(1)}% | X ${(gp.draw * 100).toFixed(1)}% | П2 ${(gp.away * 100).toFixed(1)}%`,
    `ТБ2.5 ${(gp.over['2.5'] * 100).toFixed(1)}% | ТМ2.5 ${(gp.under['2.5'] * 100).toFixed(1)}% | ОЗ ${(gp.bttsYes * 100).toFixed(1)}%`,
    `Ожидания: угловые ${sec.corners}, жёлтые ${sec.cards}, фолы ${sec.fouls} (коэффициент арбитра ${sec.refFactor})`,
    '',
    odds.length
      ? `КОЭФФИЦИЕНТЫ (открытие → текущий, движение %):\n${odds
          .map((o) => `${marketLabel(o.market)} ${selectionLabel(o.market, o.line, o.selection)}: ${o.open_price} → ${o.price} (${o.movement > 0 ? '+' : ''}${o.movement}%)`)
          .join('\n')}`
      : 'КОЭФФИЦИЕНТЫ: нет данных',
    '',
    money.length
      ? `MONEYWAY (оценка доли объёма по движению линии):\n${money
          .map((m) => `${marketLabel(m.market)} ${selectionLabel(m.market, m.line, m.selection)}: ${m.share}% (индекс объёма ${m.volume})`)
          .join('\n')}`
      : '',
    insights.length
      ? `\nСХОЖДЕНИЕ СИГНАЛОВ (наш скоринг 0-100):\n${insights
          .map((i) => `${i.label} — ${i.score}: ${i.headline ?? ''} ${(JSON.parse(i.signals || '[]') as any[]).map((s) => s.text).join('; ')}`)
          .join('\n')}`
      : '',
    h2h.length
      ? `\nЛИЧНЫЕ ВСТРЕЧИ:\n${h2h.map((m) => `${m.kickoff.slice(0, 10)} ${m.home} ${m.goals_home}:${m.goals_away} ${m.away}`).join('\n')}`
      : '',
    news.length ? `\nНОВОСТИ ПО КОМАНДАМ:\n${news.map((n) => `[${n.source}] ${n.title}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  return { fixture: f, text };
}
