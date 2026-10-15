# Overline

A self-hosted football analytics workbench. It collects fixtures, odds, exchange
order books, box scores and news from free public sources, scores where several
independent signals agree, sizes stakes with fractional Kelly, and then keeps an
honest record of how its own advice actually performed.

It is **not** a bookmaker, a bot or a tipping service. It never places a bet and
never connects to an account. It shows what the data supports — and says so
plainly when the data supports nothing.

The interface is in Russian; the code, docs and CLI are in English.

![sports](https://img.shields.io/badge/sports-football%20%7C%20hockey%20%7C%20basketball%20%7C%20esports-blue)
![tests](https://img.shields.io/badge/tests-75-green)

---

## What it does

| Section | What you get |
|---|---|
| **Matches** | Schedule and live scores for four sports, prices, filters by day and competition |
| **Convergence** | Five independent signals folded into one 0–100 score per pick |
| **Money flow** | Where volume sits — real exchange order book where available, an estimate elsewhere (labelled) |
| **Line movement** | Prices that drifted from their opening number |
| **Referees** | Fouls, yellows and reds per referee, aggregated from collected box scores |
| **AI review** | Per-match verdict, expected score, market-by-market reasoning and a separate risk block |
| **Bankroll** | Three risk profiles with fractional-Kelly staking and a Monte-Carlo projection |
| **Earnings mode** | Enter a bank and a minimum daily profit; get a staking plan, the odds of hitting it, and a journal that settles itself from final scores |
| **Track record** | Hit rate and ROI of every published pick, settled by real results |

---

## Data sources

Everything runs on free, key-less sources by default.

| What | Source | Key |
|---|---|---|
| Fixtures, live scores, box scores, referees, opening/closing prices | ESPN public JSON (`cdn.espn.com`, `site.api.espn.com` as fallback) | none |
| Exchange prices, order book, matched volume | Smarkets v3 public API | none |
| Hockey, basketball, esports (schedule + prices + money) | Smarkets v3 | none |
| Double chance | derived from 1X2, preserving the book's margin | — |
| Line history | our own snapshots in `odds_snapshots` | — |
| News | RSS: Championat, Sports.ru | none |
| Match analysis, club-name normalisation | Google Gemini | `GEMINI_API_KEY` |
| xG *(optional)* | API-Football | `API_FOOTBALL_KEY` |
| Extra bookmakers *(optional)* | The Odds API | `ODDS_API_KEY` |

Both free hosts answer `403`/`429` when polled hard. `src/lib/util/throttle.ts`
keeps one serialised queue per host with exponential backoff, and a blocked host
aborts the pass instead of hammering it further.

---

## Getting started

```bash
npm install
cp .env.example .env.local
npm run set-password          # sets the login password (stored as a scrypt hash)
npm run ingest backfill 28    # first load, ~10 minutes
npm run dev                   # http://localhost:3000
npm run worker                # separate terminal: background updates
```

The worker refreshes live scores every minute, prices every 15, news every 10,
box scores every 30 and runs a full pass every 3 hours.

---

## How the convergence score works

Five independent signals are mapped onto the same 0–100 scale and weighted:

| Signal | Weight |
|---|---|
| Poisson model vs. the market price | 0.30 |
| Money (exchange order-book pressure) | 0.22 |
| Price movement since opening | 0.22 |
| Team profile over recent matches | 0.16 |
| Referee profile, for cards and fouls | 0.10 |

The result is damped by how much evidence actually exists: a lone signal cannot
score highly, and a pick the market never quoted is capped at 72.

### Trusting the model less than the market

A public-data model that disagrees with a liquid market by twenty points is far
more likely to be wrong than right. `credibleProb()` therefore decays trust with
the size of the disagreement — the credited edge peaks at **2.5 percentage
points** and shrinks beyond that, and a longshot is never credited with more than
25% above its market probability. Both the bankroll and earnings modes stake on
that shrunk number, not on the raw model output.

---

## Earnings mode

Enter a bank and a minimum daily profit. The app scales a fractional-Kelly
portfolio until its expected profit covers the target, under hard caps:

- at most 50% of full Kelly
- at most 10% of the bank on one bet
- at most 35% of the bank at risk per day
- one bet per match (the maths assumes independence)
- only markets settleable from a final score: 1X2, double chance, totals, BTTS, handicaps

If the target does not fit inside those caps, the plan says so and reports the
bank that *would* reach it. **There is no chasing**: after a losing day stakes are
recomputed from the smaller bank, never increased to win it back.

Alongside the plan you get the probability of hitting the target today, a 30-day
projection, and a stress test showing what happens **if the model has no edge at
all**.

Committing a plan records it as paper trading. The worker settles each bet from
the final score; extra time and abandoned matches are refunded.

---

## Track record

`insights` is a working table that is rewritten on every pass, so published advice
used to vanish before it could be checked. `prediction_log` now keeps one
immutable row per pick, with the price that was on screen at publication, and
settles it from the final score.

A back-test over the logged picks is available from the CLI:

```bash
npx tsx scripts/backtest.ts
```

It replays every strategy day by day with a compounding bank and reports final
bank, ROI, hit rate and maximum drawdown — using only prices recorded before
kick-off, so nothing is chosen with hindsight.

---

## What the data cannot tell you

- **Money is real in some places and an estimate in others.** Where a match is
  listed on the exchange, shares come from the observed order book
  (`source='exchange'`). Elsewhere they are derived from price drift
  (`source='derived'`) and carry half weight so they do not double-count the
  movement signal. The exchange's own volume figure is printed without a currency
  symbol because its unit could not be verified.
- **xG needs an API-Football key**, and its free tier only answers for a rolling
  yesterday–tomorrow window, so xG accumulates going forward and cannot be
  back-filled. Without it, `xg_*` stays empty and is shown as "no data" rather
  than as zero.
- **Hockey, basketball and esports have no box-score feed here.** They get
  market-based analytics only: no Poisson model, no referee profile. The
  interface says so on the page.
- **Box scores arrive in batches**, so recently finished matches may briefly lack
  fouls, cards and referee.

---

## Commands

```bash
npm run dev                # development server
npm run build && npm start # production build
npm run worker             # background collector
npm test                   # 75 tests (node:test)
npm run set-password       # set or change the login password

npm run ingest schedule    # full pass: fixtures, box scores, aggregates, news
npm run ingest backfill 30 # load N days of history
npm run ingest live        # live scores only
npm run ingest odds        # prices and signal rebuild
npm run ingest stats       # box scores of finished matches
npm run ingest exchange    # exchange prices and order book
npm run ingest sports      # hockey, basketball, esports
npm run ingest news
npm run ingest aggregate   # team form, referees, money flow, convergence
npm run ingest xg          # xG via API-Football (needs a key)
npm run ingest names       # Russian club names via Gemini (needs a key)
npm run ai                 # AI review of the strongest convergence (key check)
```

The same jobs are reachable over HTTP at
`/api/cron?job=live` with `Authorization: Bearer $CRON_SECRET`.
`vercel.json` already carries a cron schedule for deployment.

---

## Authentication

The whole app — pages and API — sits behind a password.

```bash
npm run set-password
```

The password is entered with hidden input and stored only as a scrypt hash in
`.env.local` (mode 600). A session is an HMAC-signed, HttpOnly, SameSite=Lax
cookie valid for 30 days; changing the password invalidates every device. Five
wrong attempts from one address lock it out for 15 minutes.

If no password is configured the app is **closed**, not open. `/api/cron` accepts
either a session or a real shared secret. The worker talks to the database
directly and needs no password.

> The development server listens on the local network over plain HTTP. That is
> fine at home; on a shared network the password can be sniffed.

---

## Two traps worth knowing about

Both were found by auditing real output, and both are easy to reintroduce:

1. **ISO timestamps vs. `datetime('now')`.** Kick-offs are stored as
   `2026-09-17T19:45:00.000Z`; SQLite's `datetime('now')` returns
   `2026-09-17 10:39:34`. Compared as strings, `T` sorts above a space, so every
   same-day fixture looked like it was in the future. Always wrap:
   `datetime(f.kickoff) > datetime('now')`.
2. **De-vigging assumes selections sum to 1.** Double chance has three selections
   each covering two of three outcomes, so they sum to **2**. Normalising to 1
   halved every probability and invented edges of forty points.
   `marketTotal(market)` carries the right target.

---

## Layout

```
src/lib/providers   source adapters (espn, smarkets, apiFootball, theOddsApi)
src/lib/ingest      fetching, upserts, aggregates, orchestrator
src/lib/analytics   Poisson model, money flow, convergence, staking, settlement
src/lib/ai          match context, Gemini review, name normalisation
src/lib/auth        password hashing and session cookies
src/lib/queries.ts  everything the interface reads
src/app             pages and API routes
src/proxy.ts        auth gate in front of every route
scripts             CLI: ingest, worker, backtest, set-password
tests               node:test suites
```

---

## Deployment

SQLite suits a single machine. For a hosted deployment replace `src/lib/db` with
Postgres — the SQL is standard apart from `datetime('now')` and `ON CONFLICT`.
`vercel.json` already describes the cron schedule.

---

## Licence

MIT — see [LICENSE](LICENSE).

Predictions are analytical output, not betting advice, and not a promise of
profit.
