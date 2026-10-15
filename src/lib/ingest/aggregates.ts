import { db, logIngest, run } from '@/lib/db';

/** Referee profiles aggregated from what we actually collected. */
export function rebuildReferees() {
  const t0 = Date.now();
  const season = new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0);
  db().exec('DELETE FROM referees');
  const n = run(
    `INSERT INTO referees(name,league,league_logo,matches,fouls_avg,yellow_avg,red_avg,pens_avg,
        season_matches,season_fouls,season_yellow,season_red,updated_at)
     SELECT f.referee,
            (SELECT l2.name FROM fixtures f2 JOIN leagues l2 ON l2.id=f2.league_id
              WHERE f2.referee=f.referee GROUP BY l2.id ORDER BY COUNT(*) DESC LIMIT 1),
            (SELECT l3.logo FROM fixtures f3 JOIN leagues l3 ON l3.id=f3.league_id
              WHERE f3.referee=f.referee GROUP BY l3.id ORDER BY COUNT(*) DESC LIMIT 1),
            COUNT(DISTINCT f.id),
            ROUND(COALESCE(SUM(s.fouls),0)*1.0/MAX(COUNT(DISTINCT f.id),1),1),
            ROUND(COALESCE(SUM(s.yellow),0)*1.0/MAX(COUNT(DISTINCT f.id),1),1),
            ROUND(COALESCE(SUM(s.red),0)*1.0/MAX(COUNT(DISTINCT f.id),1),2),
            0,
            COUNT(DISTINCT CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN f.id END),
            ROUND(COALESCE(SUM(CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN s.fouls END),0)*1.0
                 / MAX(COUNT(DISTINCT CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN f.id END),1),1),
            ROUND(COALESCE(SUM(CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN s.yellow END),0)*1.0
                 / MAX(COUNT(DISTINCT CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN f.id END),1),1),
            ROUND(COALESCE(SUM(CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN s.red END),0)*1.0
                 / MAX(COUNT(DISTINCT CASE WHEN datetime(f.kickoff) > datetime('now','-120 days') THEN f.id END),1),2),
            datetime('now')
       FROM fixtures f LEFT JOIN fixture_stats s ON s.fixture_id = f.id
      WHERE f.referee IS NOT NULL AND f.referee <> ''
      GROUP BY f.referee`,
  ).changes;
  logIngest('referees', 'ok', `season ${season}`, n, Date.now() - t0);
  return n;
}

/** Rolling team profile from the last N finished matches we have stats for. */
export function rebuildTeamForm(window = 20) {
  const t0 = Date.now();
  db().exec('DELETE FROM team_form');
  const n = run(
    `WITH m AS (
       SELECT f.id, f.kickoff, f.league_id, f.home_id AS team, f.away_id AS opp,
              f.goals_home AS gf, f.goals_away AS ga, 'home' AS side
         FROM fixtures f WHERE f.status IN ('FT','AET','PEN') AND f.goals_home IS NOT NULL
       UNION ALL
       SELECT f.id, f.kickoff, f.league_id, f.away_id, f.home_id,
              f.goals_away, f.goals_home, 'away'
         FROM fixtures f WHERE f.status IN ('FT','AET','PEN') AND f.goals_home IS NOT NULL
     ), r AS (
       SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.team ORDER BY m.kickoff DESC) rn
         FROM m
     ), w AS (SELECT * FROM r WHERE rn <= @window)
     INSERT INTO team_form(team_id,league_id,played,wins,draws,losses,gf,ga,xg_for,xg_against,
        corners_for,corners_against,cards_for,fouls_for,btts_pct,over25_pct,form,updated_at)
     SELECT w.team, MAX(w.league_id), COUNT(*),
            SUM(CASE WHEN w.gf>w.ga THEN 1 ELSE 0 END),
            SUM(CASE WHEN w.gf=w.ga THEN 1 ELSE 0 END),
            SUM(CASE WHEN w.gf<w.ga THEN 1 ELSE 0 END),
            ROUND(AVG(w.gf),2), ROUND(AVG(w.ga),2),
            ROUND(AVG(s.xg),2), ROUND(AVG(so.xg),2),
            ROUND(COALESCE(AVG(s.corners),0),2), ROUND(COALESCE(AVG(so.corners),0),2),
            ROUND(COALESCE(AVG(s.yellow),0),2), ROUND(COALESCE(AVG(s.fouls),0),2),
            ROUND(AVG(CASE WHEN w.gf>0 AND w.ga>0 THEN 100.0 ELSE 0 END),1),
            ROUND(AVG(CASE WHEN w.gf+w.ga>2 THEN 100.0 ELSE 0 END),1),
            GROUP_CONCAT(CASE WHEN w.gf>w.ga THEN 'W' WHEN w.gf=w.ga THEN 'D' ELSE 'L' END,''),
            datetime('now')
       FROM w
       LEFT JOIN fixture_stats s  ON s.fixture_id = w.id AND s.team_id = w.team
       LEFT JOIN fixture_stats so ON so.fixture_id = w.id AND so.team_id = w.opp
      GROUP BY w.team`,
    { window },
  ).changes;
  logIngest('team_form', 'ok', `window ${window}`, n, Date.now() - t0);
  return n;
}
