const express = require('express');
const router = express.Router();
const db = require('../db');

function r2(n) { return Math.round(n * 100) / 100; }

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function computeStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let check = today;
  for (const d of sorted) {
    if (d === check) {
      streak++;
      const prev = new Date(check);
      prev.setDate(prev.getDate() - 1);
      check = prev.toISOString().slice(0, 10);
    } else if (d < check) break;
  }
  return streak;
}

function periodStats(actId, from) {
  const sessions = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE activity_id=? AND date>=?').get(actId, from).n;
  const spend    = r2(db.prepare('SELECT COALESCE(SUM(total_cost),0) AS s FROM sessions WHERE activity_id=? AND date>=?').get(actId, from).s);
  return { sessions, spend };
}

// All-activity heatmap (used by both overall and per-activity endpoints)
function getHeatmapDates() {
  return db.prepare(`
    SELECT s.date, a.color, a.slug
    FROM sessions s JOIN activities a ON a.id = s.activity_id
    ORDER BY s.date ASC
  `).all();
}

// Overall dashboard stats
router.get('/', (req, res) => {
  const monday     = getMonday();
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const yearStart  = new Date().getFullYear() + '-01-01';

  const total_sessions    = db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
  const total_spend       = db.prepare('SELECT COALESCE(SUM(total_cost),0) AS s FROM sessions').get().s;
  const active_activities = db.prepare("SELECT COUNT(*) AS n FROM activities WHERE enabled=1").get().n;

  const sessions_by_activity = db.prepare(`
    SELECT a.slug, a.emoji, a.color, a.display_name, COUNT(s.id) AS count
    FROM activities a
    LEFT JOIN sessions s ON s.activity_id = a.id
    WHERE a.enabled=1
    GROUP BY a.id ORDER BY count DESC
  `).all();

  const spend_by_activity = db.prepare(`
    SELECT a.slug, a.emoji, a.color, a.display_name,
           COALESCE(SUM(s.total_cost),0) AS total
    FROM activities a
    LEFT JOIN sessions s ON s.activity_id = a.id
    WHERE a.enabled=1
    GROUP BY a.id ORDER BY total DESC
  `).all();

  const recentRows = db.prepare(`
    SELECT s.*, a.slug AS act_slug, a.emoji AS act_emoji, a.color AS act_color, a.display_name AS act_name
    FROM sessions s JOIN activities a ON a.id = s.activity_id
    ORDER BY s.date DESC, s.created_at DESC LIMIT 10
  `).all();

  const recent_sessions = recentRows.map(row => {
    const data = JSON.parse(row.data || '{}');
    return {
      id: row.id,
      date: row.date,
      duration_minutes: row.duration_minutes,
      transport_cost: row.transport_cost,
      total_cost: row.total_cost,
      notes: row.notes,
      data,
      activity: { slug: row.act_slug, emoji: row.act_emoji, color: row.act_color, display_name: row.act_name },
    };
  });

  const allDates = db.prepare('SELECT DISTINCT date FROM sessions ORDER BY date ASC').all().map(r => r.date);
  const current_streak = computeStreak(allDates);

  // Period-specific all-activity stats
  const pStats = (from) => ({
    sessions: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE date>=?').get(from).n,
    spend:    r2(db.prepare('SELECT COALESCE(SUM(total_cost),0) AS s FROM sessions WHERE date>=?').get(from).s),
  });

  res.json({
    total_sessions,
    total_spend: r2(total_spend),
    active_activities,
    this_week_sessions: pStats(monday).sessions,
    current_streak,
    period_stats: {
      week:  pStats(monday),
      month: pStats(monthStart),
      year:  pStats(yearStart),
    },
    sessions_by_activity,
    spend_by_activity,
    recent_sessions,
    heatmap_dates: getHeatmapDates(),
  });
});

// Per-activity stats
router.get('/:slug', (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE slug=?').get(req.params.slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });

  const dates = db.prepare(
    'SELECT date FROM sessions WHERE activity_id=? ORDER BY date ASC'
  ).all(act.id).map(r => r.date);

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month,
           COUNT(*) AS sessions,
           ROUND(SUM(total_cost), 2) AS total,
           ROUND(AVG(total_cost), 2) AS avg_session,
           ROUND(SUM(duration_minutes), 0) AS total_minutes
    FROM sessions WHERE activity_id=?
    GROUP BY month ORDER BY month DESC
  `).all(act.id);

  const monday     = getMonday();
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const yearStart  = new Date().getFullYear() + '-01-01';

  const ps = {
    week:  periodStats(act.id, monday),
    month: periodStats(act.id, monthStart),
    year:  periodStats(act.id, yearStart),
  };

  const heatmap_dates = getHeatmapDates();

  if (act.slug === 'badminton') {
    const equipment = db.prepare('SELECT * FROM equipment WHERE activity_id=?').all(act.id);
    const racket = equipment.find(e => e.name === 'racket');
    const shoe   = equipment.find(e => e.name === 'shoe');

    const { total_racket, total_shoe } = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(json_extract(data,'$.racket_charge') AS REAL)), 0) AS total_racket,
        COALESCE(SUM(CAST(json_extract(data,'$.shoe_charge')   AS REAL)), 0) AS total_shoe
      FROM sessions WHERE activity_id=?
    `).get(act.id);

    const makeRecovery = (equip, recovered) => equip ? {
      total_cost: equip.total_cost,
      recovered:  r2(recovered),
      remaining:  r2(Math.max(0, equip.total_cost - recovered)),
      pct:        Math.min(100, r2((recovered / equip.total_cost) * 100)),
      amort_sessions: equip.amort_sessions,
    } : null;

    const total_court = db.prepare(`
      SELECT ROUND(COALESCE(SUM(CAST(json_extract(data,'$.court_cost') AS REAL)),0),2) AS v
      FROM sessions WHERE activity_id=?
    `).get(act.id).v;

    const avg_players = db.prepare(`
      SELECT ROUND(AVG(CAST(json_extract(data,'$.num_other_players') AS REAL)),1) AS v
      FROM sessions WHERE activity_id=?
    `).get(act.id).v;

    return res.json({
      recovery: {
        racket: makeRecovery(racket, total_racket),
        shoe:   makeRecovery(shoe, total_shoe),
      },
      monthly, total_court, avg_players: avg_players || 0, dates, equipment,
      period_stats: ps, heatmap_dates,
    });
  }

  if (act.slug === 'swimming') {
    const { total_distance_m, avg_laps, total_fees } = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(json_extract(data,'$.distance_m') AS REAL)), 0) AS total_distance_m,
        ROUND(AVG(CAST(json_extract(data,'$.laps') AS REAL)), 1) AS avg_laps,
        COALESCE(SUM(CAST(json_extract(data,'$.entry_fee') AS REAL)), 0) AS total_fees
      FROM sessions WHERE activity_id=?
    `).get(act.id);

    const strokeRows = db.prepare(`
      SELECT json_extract(data,'$.stroke_type') AS stroke, COUNT(*) AS count
      FROM sessions WHERE activity_id=?
      GROUP BY stroke
    `).all(act.id);

    return res.json({
      total_distance_km: r2((total_distance_m || 0) / 1000),
      avg_laps: avg_laps || 0,
      total_fees: r2(total_fees || 0),
      stroke_breakdown: strokeRows,
      monthly, dates, period_stats: ps, heatmap_dates,
    });
  }

  if (act.slug === 'gym') {
    const typeRows = db.prepare(`
      SELECT json_extract(data,'$.session_type') AS session_type, COUNT(*) AS count
      FROM sessions WHERE activity_id=?
      GROUP BY session_type
    `).all(act.id);

    const avg_duration = db.prepare(
      'SELECT ROUND(AVG(duration_minutes),0) AS v FROM sessions WHERE activity_id=?'
    ).get(act.id).v || 0;

    return res.json({
      session_type_breakdown: typeRows,
      streak: computeStreak(dates),
      avg_duration_min: avg_duration,
      monthly, dates, period_stats: ps, heatmap_dates,
    });
  }

  if (act.slug === 'run') {
    const sessions = db.prepare('SELECT data, duration_minutes FROM sessions WHERE activity_id=?').all(act.id);
    let total_distance = 0;
    let longest = 0;
    const paces = [];
    const runTypes = {};
    for (const s of sessions) {
      const d = JSON.parse(s.data || '{}');
      const dist = parseFloat(d.distance_km) || 0;
      const secs = parseFloat(d.elapsed_seconds) || 0;
      total_distance += dist;
      if (dist > longest) longest = dist;
      if (dist && secs) paces.push(r2(secs / dist));
      const rt = d.run_type || 'training';
      runTypes[rt] = (runTypes[rt] || 0) + 1;
    }
    const avg_pace = paces.length ? r2(paces.reduce((a, b) => a + b, 0) / paces.length) : null;
    const best_pace = paces.length ? Math.min(...paces) : null;

    return res.json({
      total_distance_km: r2(total_distance),
      avg_pace_sec_per_km: avg_pace,
      best_pace_sec_per_km: best_pace,
      longest_run_km: r2(longest),
      run_type_breakdown: Object.entries(runTypes).map(([run_type, count]) => ({ run_type, count })),
      monthly, dates, period_stats: ps, heatmap_dates,
    });
  }

  if (act.slug === 'cricket') {
    const equipment = db.prepare('SELECT * FROM equipment WHERE activity_id=?').all(act.id);
    const bat  = equipment.find(e => e.name === 'bat');

    const { total_ball, total_bat } = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(json_extract(data,'$.ball_cost')  AS REAL)), 0) AS total_ball,
        COALESCE(SUM(CAST(json_extract(data,'$.bat_charge') AS REAL)), 0) AS total_bat
      FROM sessions WHERE activity_id=?
    `).get(act.id);

    const makeRecovery = (equip, recovered) => equip ? {
      total_cost: equip.total_cost, recovered: r2(recovered),
      remaining: r2(Math.max(0, equip.total_cost - recovered)),
      pct: Math.min(100, r2((recovered / equip.total_cost) * 100)),
      amort_sessions: equip.amort_sessions,
    } : null;

    const matchTypeRows = db.prepare(`
      SELECT json_extract(data,'$.match_type') AS match_type, COUNT(*) AS count
      FROM sessions WHERE activity_id=? GROUP BY match_type
    `).all(act.id);

    const { total_overs, total_ground_fees } = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(json_extract(data,'$.overs') AS REAL)),0) AS total_overs,
        COALESCE(SUM(CAST(json_extract(data,'$.ground_cost') AS REAL)),0) AS total_ground_fees
      FROM sessions WHERE activity_id=?
    `).get(act.id);

    return res.json({
      recovery: { bat: makeRecovery(bat, total_bat), ball: null },
      match_type_breakdown: matchTypeRows,
      total_overs: Math.round(total_overs || 0),
      total_ground_fees: r2(total_ground_fees || 0),
      monthly, dates, equipment, period_stats: ps, heatmap_dates,
    });
  }

  // Custom activity
  res.json({ monthly, dates, period_stats: ps, heatmap_dates });
});

module.exports = router;
