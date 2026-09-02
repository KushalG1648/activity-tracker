const express = require('express');
const router  = express.Router();
const pool    = require('../db');

function r2(n) { return Math.round(n * 100) / 100; }

// ── Query helpers ─────────────────────────────────────────────

async function getEquipmentForActivity(activityId) {
  const { rows } = await pool.query('SELECT * FROM equipment WHERE activity_id=$1', [activityId]);
  return rows;
}

async function getBadmintonRecoveryTotals(activityId) {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM((data->>'racket_charge')::numeric), 0) AS total_racket,
      COALESCE(SUM((data->>'shoe_charge')::numeric),   0) AS total_shoe
    FROM sessions WHERE activity_id=$1
  `, [activityId]);
  return rows[0];
}

async function getCricketRecoveryTotals(activityId) {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(SUM((data->>'ball_charge')::numeric), 0) AS total_ball,
      COALESCE(SUM((data->>'bat_charge')::numeric),  0) AS total_bat
    FROM sessions WHERE activity_id=$1
  `, [activityId]);
  return rows[0];
}

function computeBadmintonCharges(equipment, duration_minutes, recovered_racket, recovered_shoe) {
  const shuttle = equipment.find(e => e.name === 'shuttle');
  const racket  = equipment.find(e => e.name === 'racket');
  const shoe    = equipment.find(e => e.name === 'shoe');
  const duration_hours = duration_minutes / 60;

  const shuttle_cost = shuttle
    ? r2((shuttle.total_cost / shuttle.units_per_pack) / shuttle.hours_per_unit * duration_hours)
    : 0;

  const racket_per    = racket ? r2(racket.total_cost / racket.amort_sessions) : 0;
  const racket_rem    = racket ? Math.max(0, racket.total_cost - recovered_racket) : 0;
  const racket_charge = racket_rem > 0 ? Math.min(racket_per, racket_rem) : 0;

  const shoe_per    = shoe ? r2(shoe.total_cost / shoe.amort_sessions) : 0;
  const shoe_rem    = shoe ? Math.max(0, shoe.total_cost - recovered_shoe) : 0;
  const shoe_charge = shoe_rem > 0 ? Math.min(shoe_per, shoe_rem) : 0;

  return { shuttle_cost, racket_charge: r2(racket_charge), shoe_charge: r2(shoe_charge) };
}

function computeCricketCharges(equipment, duration_minutes, recovered_ball, recovered_bat) {
  const ball = equipment.find(e => e.name === 'ball');
  const bat  = equipment.find(e => e.name === 'bat');
  const duration_hours = duration_minutes / 60;

  const ball_cost = ball
    ? r2((ball.total_cost / ball.units_per_pack) / ball.hours_per_unit * duration_hours)
    : 0;

  const bat_per    = bat ? r2(bat.total_cost / bat.amort_sessions) : 0;
  const bat_rem    = bat ? Math.max(0, bat.total_cost - recovered_bat) : 0;
  const bat_charge = bat_rem > 0 ? Math.min(bat_per, bat_rem) : 0;

  return { ball_cost, bat_charge: r2(bat_charge) };
}

// Builds a plain response object from a joined session+activity row.
// pg returns JSONB data as a parsed JS object — no JSON.parse needed.
function enrichRow(row) {
  const data = row.data || {};
  const activity = {
    slug:         row.act_slug,
    display_name: row.act_display_name,
    emoji:        row.act_emoji,
    color:        row.act_color,
  };

  const base = {
    id:               row.id,
    activity_id:      row.activity_id,
    date:             row.date,
    duration_minutes: row.duration_minutes,
    transport_cost:   row.transport_cost,
    total_cost:       row.total_cost,
    data,
    notes:            row.notes,
    created_at:       row.created_at,
    activity,
  };

  if (activity.slug === 'badminton' || activity.slug === 'cricket') {
    const N = data.num_other_players ?? data.num_players ?? 0;
    return {
      ...base,
      per_player_fair: N >= 0 ? r2(row.total_cost / (N + 1)) : null,
      per_player_adv:  N > 0  ? r2(row.total_cost / N)       : null,
    };
  }

  if (activity.slug === 'run') {
    const d = data.distance_km;
    const t = data.elapsed_seconds;
    return { ...base, pace_sec_per_km: d && t ? r2(t / d) : null };
  }

  return base;
}

const SESSION_JOIN = `
  SELECT s.*,
    a.slug         AS act_slug,
    a.display_name AS act_display_name,
    a.emoji        AS act_emoji,
    a.color        AS act_color
  FROM sessions s
  JOIN activities a ON a.id = s.activity_id
`;

// ── Routes ────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { activity } = req.query;
    let rows;
    if (activity) {
      const { rows: acts } = await pool.query('SELECT * FROM activities WHERE slug=$1', [activity]);
      if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
      ({ rows } = await pool.query(
        SESSION_JOIN + ' WHERE s.activity_id=$1 ORDER BY s.date DESC, s.created_at DESC',
        [acts[0].id]
      ));
    } else {
      ({ rows } = await pool.query(SESSION_JOIN + ' ORDER BY s.date DESC, s.created_at DESC'));
    }
    res.json(rows.map(enrichRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      SESSION_JOIN + ' WHERE s.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json(enrichRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      activity_id,
      date,
      duration_minutes = 60,
      transport_cost   = 0,
      notes,
      activityData     = {},
    } = req.body;

    if (!activity_id || !date)
      return res.status(400).json({ error: 'activity_id and date are required' });

    const { rows: acts } = await pool.query('SELECT * FROM activities WHERE id=$1', [activity_id]);
    if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
    const activity = acts[0];

    let data = { ...activityData };
    let total_cost = Number(transport_cost);

    if (activity.slug === 'badminton') {
      const equipment = await getEquipmentForActivity(activity_id);
      const { total_racket, total_shoe } = await getBadmintonRecoveryTotals(activity_id);
      const charges = computeBadmintonCharges(equipment, duration_minutes, Number(total_racket), Number(total_shoe));
      data = { ...data, ...charges };
      const court_cost = parseFloat(activityData.court_cost) || 0;
      total_cost = r2(Number(transport_cost) + court_cost + charges.shuttle_cost + charges.racket_charge + charges.shoe_charge);

    } else if (activity.slug === 'cricket') {
      const equipment = await getEquipmentForActivity(activity_id);
      const { total_ball, total_bat } = await getCricketRecoveryTotals(activity_id);
      const charges = computeCricketCharges(equipment, duration_minutes, Number(total_ball), Number(total_bat));
      data = { ...data, ...charges };
      const ground_cost = parseFloat(activityData.ground_cost) || 0;
      total_cost = r2(Number(transport_cost) + ground_cost + charges.ball_cost + charges.bat_charge);

    } else {
      const entry_fee = parseFloat(activityData.entry_fee) || 0;
      total_cost = r2(Number(transport_cost) + entry_fee);
    }

    const { rows: inserted } = await pool.query(`
      INSERT INTO sessions (activity_id, date, duration_minutes, transport_cost, total_cost, data, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [activity_id, date, duration_minutes, transport_cost, total_cost, data, notes || null]);

    const { rows } = await pool.query(
      SESSION_JOIN + ' WHERE s.id=$1', [inserted[0].id]
    );
    res.status(201).json(enrichRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      SESSION_JOIN + ' WHERE s.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found' });
    await pool.query('DELETE FROM sessions WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
