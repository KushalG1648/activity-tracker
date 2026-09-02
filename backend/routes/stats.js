const express = require('express');
const router  = express.Router();
const pool    = require('../db');

function r2(n) { return Math.round(n * 100) / 100; }

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
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
      const prev = new Date(check + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      check = prev.toISOString().slice(0, 10);
    } else if (d < check) break;
  }
  return streak;
}

async function periodStats(from) {
  const [{ rows: r1 }, { rows: r2 }] = await Promise.all([
    pool.query('SELECT COUNT(*) AS n FROM sessions WHERE date>=$1', [from]),
    pool.query('SELECT COALESCE(SUM(total_cost),0) AS s FROM sessions WHERE date>=$1', [from]),
  ]);
  return { sessions: Number(r1[0].n), spend: r2(Number(r2[0].s)) };
}

async function activityPeriodStats(actId, from) {
  const [{ rows: r1 }, { rows: r2 }] = await Promise.all([
    pool.query('SELECT COUNT(*) AS n FROM sessions WHERE activity_id=$1 AND date>=$2', [actId, from]),
    pool.query('SELECT COALESCE(SUM(total_cost),0) AS s FROM sessions WHERE activity_id=$1 AND date>=$2', [actId, from]),
  ]);
  return { sessions: Number(r1[0].n), spend: r2(Number(r2[0].s)) };
}

async function getHeatmapDates() {
  const { rows } = await pool.query(`
    SELECT s.date, a.color, a.slug
    FROM sessions s JOIN activities a ON a.id = s.activity_id
    ORDER BY s.date ASC
  `);
  return rows;
}

// ── Overall dashboard stats ───────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const monday     = getMonday();
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const yearStart  = new Date().getFullYear() + '-01-01';

    const [
      { rows: [totals] },
      { rows: actCount },
      { rows: byAct },
      { rows: spendByAct },
      { rows: recentRows },
      { rows: allDateRows },
      weekStats, monthStats, yearStats,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total_sessions, COALESCE(SUM(total_cost),0) AS total_spend FROM sessions'),
      pool.query("SELECT COUNT(*) AS n FROM activities WHERE enabled=true"),
      pool.query(`
        SELECT a.slug, a.emoji, a.color, a.display_name, COUNT(s.id) AS count
        FROM activities a LEFT JOIN sessions s ON s.activity_id = a.id
        WHERE a.enabled=true GROUP BY a.id ORDER BY count DESC
      `),
      pool.query(`
        SELECT a.slug, a.emoji, a.color, a.display_name, COALESCE(SUM(s.total_cost),0) AS total
        FROM activities a LEFT JOIN sessions s ON s.activity_id = a.id
        WHERE a.enabled=true GROUP BY a.id ORDER BY total DESC
      `),
      pool.query(`
        SELECT s.id, s.date, s.duration_minutes, s.transport_cost, s.total_cost, s.notes, s.data,
          a.slug AS act_slug, a.emoji AS act_emoji, a.color AS act_color, a.display_name AS act_name
        FROM sessions s JOIN activities a ON a.id = s.activity_id
        ORDER BY s.date DESC, s.created_at DESC LIMIT 10
      `),
      pool.query('SELECT DISTINCT date FROM sessions ORDER BY date ASC'),
      periodStats(monday),
      periodStats(monthStart),
      periodStats(yearStart),
    ]);

    const allDates = allDateRows.map(r => r.date);
    const current_streak = computeStreak(allDates);

    const recent_sessions = recentRows.map(row => ({
      id:               row.id,
      date:             row.date,
      duration_minutes: row.duration_minutes,
      transport_cost:   row.transport_cost,
      total_cost:       row.total_cost,
      notes:            row.notes,
      data:             row.data || {},
      activity: { slug: row.act_slug, emoji: row.act_emoji, color: row.act_color, display_name: row.act_name },
    }));

    const heatmap_dates = await getHeatmapDates();

    res.json({
      total_sessions:      Number(totals.total_sessions),
      total_spend:         r2(Number(totals.total_spend)),
      active_activities:   Number(actCount[0].n),
      this_week_sessions:  weekStats.sessions,
      current_streak,
      period_stats:        { week: weekStats, month: monthStats, year: yearStats },
      sessions_by_activity: byAct.map(r => ({ ...r, count: Number(r.count) })),
      spend_by_activity:   spendByAct.map(r => ({ ...r, total: r2(Number(r.total)) })),
      recent_sessions,
      heatmap_dates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Per-activity stats ────────────────────────────────────────

router.get('/:slug', async (req, res) => {
  try {
    const { rows: acts } = await pool.query('SELECT * FROM activities WHERE slug=$1', [req.params.slug]);
    if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
    const act = acts[0];

    const monday     = getMonday();
    const monthStart = new Date().toISOString().slice(0, 7) + '-01';
    const yearStart  = new Date().getFullYear() + '-01-01';

    const [
      { rows: dateRows },
      { rows: monthly },
      weekStats, monthStats, yearStats,
      heatmap_dates,
    ] = await Promise.all([
      pool.query('SELECT date FROM sessions WHERE activity_id=$1 ORDER BY date ASC', [act.id]),
      pool.query(`
        SELECT to_char(date, 'YYYY-MM') AS month,
               COUNT(*) AS sessions,
               ROUND(SUM(total_cost)::numeric, 2) AS total,
               ROUND(AVG(total_cost)::numeric, 2) AS avg_session,
               ROUND(SUM(duration_minutes)::numeric, 0) AS total_minutes
        FROM sessions WHERE activity_id=$1
        GROUP BY to_char(date, 'YYYY-MM')
        ORDER BY month DESC
      `, [act.id]),
      activityPeriodStats(act.id, monday),
      activityPeriodStats(act.id, monthStart),
      activityPeriodStats(act.id, yearStart),
      getHeatmapDates(),
    ]);

    const dates = dateRows.map(r => r.date);
    const ps = { week: weekStats, month: monthStats, year: yearStats };
    const monthlyNorm = monthly.map(m => ({
      ...m,
      sessions: Number(m.sessions),
      total: Number(m.total),
      avg_session: Number(m.avg_session),
      total_minutes: Number(m.total_minutes),
    }));

    // ── Badminton ────────────────────────────────────────────
    if (act.slug === 'badminton') {
      const [
        { rows: equipment },
        { rows: [rec] },
        { rows: [courtRow] },
        { rows: [avgPlayersRow] },
      ] = await Promise.all([
        pool.query('SELECT * FROM equipment WHERE activity_id=$1', [act.id]),
        pool.query(`
          SELECT
            COALESCE(SUM((data->>'racket_charge')::numeric), 0) AS total_racket,
            COALESCE(SUM((data->>'shoe_charge')::numeric),   0) AS total_shoe
          FROM sessions WHERE activity_id=$1
        `, [act.id]),
        pool.query(`
          SELECT ROUND(COALESCE(SUM((data->>'court_cost')::numeric),0)::numeric, 2) AS v
          FROM sessions WHERE activity_id=$1
        `, [act.id]),
        pool.query(`
          SELECT ROUND(AVG((data->>'num_other_players')::numeric)::numeric, 1) AS v
          FROM sessions WHERE activity_id=$1
        `, [act.id]),
      ]);

      const racket = equipment.find(e => e.name === 'racket');
      const shoe   = equipment.find(e => e.name === 'shoe');

      function makeRecovery(equip, recovered) {
        if (!equip) return null;
        return {
          total_cost:     equip.total_cost,
          recovered:      r2(recovered),
          remaining:      r2(Math.max(0, equip.total_cost - recovered)),
          pct:            Math.min(100, r2((recovered / equip.total_cost) * 100)),
          amort_sessions: equip.amort_sessions,
        };
      }

      return res.json({
        recovery: {
          racket: makeRecovery(racket, Number(rec.total_racket)),
          shoe:   makeRecovery(shoe,   Number(rec.total_shoe)),
        },
        monthly: monthlyNorm,
        total_court:  Number(courtRow.v),
        avg_players:  Number(avgPlayersRow.v) || 0,
        dates,
        equipment,
        period_stats: ps,
        heatmap_dates,
      });
    }

    // ── Swimming ─────────────────────────────────────────────
    if (act.slug === 'swimming') {
      const [
        { rows: [swimTotals] },
        { rows: strokeRows },
      ] = await Promise.all([
        pool.query(`
          SELECT
            COALESCE(SUM((data->>'distance_m')::numeric), 0) AS total_distance_m,
            ROUND(AVG((data->>'laps')::numeric)::numeric, 1) AS avg_laps,
            COALESCE(SUM((data->>'entry_fee')::numeric), 0)  AS total_fees
          FROM sessions WHERE activity_id=$1
        `, [act.id]),
        pool.query(`
          SELECT data->>'stroke_type' AS stroke, COUNT(*) AS count
          FROM sessions WHERE activity_id=$1 GROUP BY data->>'stroke_type'
        `, [act.id]),
      ]);

      return res.json({
        total_distance_km: r2(Number(swimTotals.total_distance_m || 0) / 1000),
        avg_laps:          Number(swimTotals.avg_laps) || 0,
        total_fees:        r2(Number(swimTotals.total_fees) || 0),
        stroke_breakdown:  strokeRows.map(r => ({ ...r, count: Number(r.count) })),
        monthly: monthlyNorm, dates, period_stats: ps, heatmap_dates,
      });
    }

    // ── Gym ──────────────────────────────────────────────────
    if (act.slug === 'gym') {
      const [
        { rows: typeRows },
        { rows: [avgDur] },
      ] = await Promise.all([
        pool.query(`
          SELECT data->>'session_type' AS session_type, COUNT(*) AS count
          FROM sessions WHERE activity_id=$1 GROUP BY data->>'session_type'
        `, [act.id]),
        pool.query(
          'SELECT ROUND(AVG(duration_minutes)::numeric, 0) AS v FROM sessions WHERE activity_id=$1', [act.id]
        ),
      ]);

      return res.json({
        session_type_breakdown: typeRows.map(r => ({ ...r, count: Number(r.count) })),
        streak: computeStreak(dates),
        avg_duration_min: Number(avgDur.v) || 0,
        monthly: monthlyNorm, dates, period_stats: ps, heatmap_dates,
      });
    }

    // ── Run ──────────────────────────────────────────────────
    if (act.slug === 'run') {
      const { rows: runRows } = await pool.query(
        'SELECT data, duration_minutes FROM sessions WHERE activity_id=$1', [act.id]
      );
      let total_distance = 0, longest = 0;
      const paces = [];
      const runTypes = {};
      for (const s of runRows) {
        const d   = s.data || {};
        const dist = parseFloat(d.distance_km) || 0;
        const secs = parseFloat(d.elapsed_seconds) || 0;
        total_distance += dist;
        if (dist > longest) longest = dist;
        if (dist && secs) paces.push(r2(secs / dist));
        const rt = d.run_type || 'training';
        runTypes[rt] = (runTypes[rt] || 0) + 1;
      }
      return res.json({
        total_distance_km:    r2(total_distance),
        avg_pace_sec_per_km:  paces.length ? r2(paces.reduce((a, b) => a + b, 0) / paces.length) : null,
        best_pace_sec_per_km: paces.length ? Math.min(...paces) : null,
        longest_run_km:       r2(longest),
        run_type_breakdown:   Object.entries(runTypes).map(([run_type, count]) => ({ run_type, count })),
        monthly: monthlyNorm, dates, period_stats: ps, heatmap_dates,
      });
    }

    // ── Cricket ──────────────────────────────────────────────
    if (act.slug === 'cricket') {
      const [
        { rows: equipment },
        { rows: [cricRec] },
        { rows: matchTypeRows },
        { rows: [cricTotals] },
      ] = await Promise.all([
        pool.query('SELECT * FROM equipment WHERE activity_id=$1', [act.id]),
        pool.query(`
          SELECT
            COALESCE(SUM((data->>'ball_cost')::numeric),  0) AS total_ball,
            COALESCE(SUM((data->>'bat_charge')::numeric), 0) AS total_bat
          FROM sessions WHERE activity_id=$1
        `, [act.id]),
        pool.query(`
          SELECT data->>'match_type' AS match_type, COUNT(*) AS count
          FROM sessions WHERE activity_id=$1 GROUP BY data->>'match_type'
        `, [act.id]),
        pool.query(`
          SELECT
            COALESCE(SUM((data->>'overs')::numeric), 0)       AS total_overs,
            COALESCE(SUM((data->>'ground_cost')::numeric), 0) AS total_ground_fees
          FROM sessions WHERE activity_id=$1
        `, [act.id]),
      ]);

      const bat = equipment.find(e => e.name === 'bat');
      function makeRecovery(equip, recovered) {
        if (!equip) return null;
        return {
          total_cost: equip.total_cost, recovered: r2(recovered),
          remaining:  r2(Math.max(0, equip.total_cost - recovered)),
          pct:        Math.min(100, r2((recovered / equip.total_cost) * 100)),
          amort_sessions: equip.amort_sessions,
        };
      }

      return res.json({
        recovery: { bat: makeRecovery(bat, Number(cricRec.total_bat)), ball: null },
        match_type_breakdown: matchTypeRows.map(r => ({ ...r, count: Number(r.count) })),
        total_overs:       Math.round(Number(cricTotals.total_overs) || 0),
        total_ground_fees: r2(Number(cricTotals.total_ground_fees) || 0),
        monthly: monthlyNorm, dates, equipment, period_stats: ps, heatmap_dates,
      });
    }

    // ── Custom activity ──────────────────────────────────────
    res.json({ monthly: monthlyNorm, dates, period_stats: ps, heatmap_dates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
