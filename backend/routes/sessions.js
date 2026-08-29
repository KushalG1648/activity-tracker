const express = require('express');
const router = express.Router();
const db = require('../db');

function r2(n) { return Math.round(n * 100) / 100; }

function getEquipmentForActivity(activityId) {
  return db.prepare('SELECT * FROM equipment WHERE activity_id=?').all(activityId);
}

function getBadmintonRecoveryTotals(activityId) {
  return db.prepare(`
    SELECT
      COALESCE(SUM(CAST(json_extract(data,'$.racket_charge') AS REAL)), 0) AS total_racket,
      COALESCE(SUM(CAST(json_extract(data,'$.shoe_charge')   AS REAL)), 0) AS total_shoe
    FROM sessions WHERE activity_id=?
  `).get(activityId);
}

function getCricketRecoveryTotals(activityId) {
  return db.prepare(`
    SELECT
      COALESCE(SUM(CAST(json_extract(data,'$.ball_charge') AS REAL)), 0) AS total_ball,
      COALESCE(SUM(CAST(json_extract(data,'$.bat_charge')  AS REAL)), 0) AS total_bat
    FROM sessions WHERE activity_id=?
  `).get(activityId);
}

function computeBadmintonCharges(equipment, duration_minutes, recovered_racket, recovered_shoe) {
  const shuttle = equipment.find(e => e.name === 'shuttle');
  const racket  = equipment.find(e => e.name === 'racket');
  const shoe    = equipment.find(e => e.name === 'shoe');
  const duration_hours = duration_minutes / 60;

  const shuttle_cost = shuttle
    ? r2((shuttle.total_cost / shuttle.units_per_pack) / shuttle.hours_per_unit * duration_hours)
    : 0;

  const racket_per = racket ? r2(racket.total_cost / racket.amort_sessions) : 0;
  const racket_rem = racket ? Math.max(0, racket.total_cost - recovered_racket) : 0;
  const racket_charge = racket_rem > 0 ? Math.min(racket_per, racket_rem) : 0;

  const shoe_per = shoe ? r2(shoe.total_cost / shoe.amort_sessions) : 0;
  const shoe_rem = shoe ? Math.max(0, shoe.total_cost - recovered_shoe) : 0;
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

  const bat_per = bat ? r2(bat.total_cost / bat.amort_sessions) : 0;
  const bat_rem = bat ? Math.max(0, bat.total_cost - recovered_bat) : 0;
  const bat_charge = bat_rem > 0 ? Math.min(bat_per, bat_rem) : 0;

  return { ball_cost, bat_charge: r2(bat_charge) };
}

function enrichSession(s) {
  const activity = db.prepare('SELECT * FROM activities WHERE id=?').get(s.activity_id);
  const data = typeof s.data === 'string' ? JSON.parse(s.data || '{}') : (s.data || {});

  const base = {
    ...s,
    data,
    activity: activity ? { slug: activity.slug, display_name: activity.display_name, emoji: activity.emoji, color: activity.color } : null,
  };

  // Activity-specific computed fields
  if (activity?.slug === 'badminton' || activity?.slug === 'cricket') {
    const N = data.num_other_players ?? data.num_players ?? 0;
    return {
      ...base,
      per_player_fair: N >= 0 ? r2(s.total_cost / (N + 1)) : null,
      per_player_adv:  N > 0  ? r2(s.total_cost / N) : null,
    };
  }

  if (activity?.slug === 'run') {
    const d = data.distance_km;
    const t = data.elapsed_seconds;
    return {
      ...base,
      pace_sec_per_km: d && t ? r2(t / d) : null,
    };
  }

  return base;
}

router.get('/', (req, res) => {
  const { activity } = req.query;
  let rows;
  if (activity) {
    const act = db.prepare('SELECT * FROM activities WHERE slug=?').get(activity);
    if (!act) return res.status(404).json({ error: 'Activity not found' });
    rows = db.prepare('SELECT * FROM sessions WHERE activity_id=? ORDER BY date DESC, created_at DESC').all(act.id);
  } else {
    rows = db.prepare('SELECT * FROM sessions ORDER BY date DESC, created_at DESC').all();
  }
  res.json(rows.map(enrichSession));
});

router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(enrichSession(session));
});

router.post('/', (req, res) => {
  const {
    activity_id,
    date,
    duration_minutes = 60,
    transport_cost = 0,
    notes,
    activityData = {}
  } = req.body;

  if (!activity_id || !date) {
    return res.status(400).json({ error: 'activity_id and date are required' });
  }

  const activity = db.prepare('SELECT * FROM activities WHERE id=?').get(activity_id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  let data = { ...activityData };
  let total_cost = transport_cost;

  if (activity.slug === 'badminton') {
    const equipment = getEquipmentForActivity(activity_id);
    const { total_racket, total_shoe } = getBadmintonRecoveryTotals(activity_id);
    const charges = computeBadmintonCharges(equipment, duration_minutes, total_racket, total_shoe);
    data = { ...data, ...charges };
    const court_cost = parseFloat(activityData.court_cost) || 0;
    total_cost = r2(transport_cost + court_cost + charges.shuttle_cost + charges.racket_charge + charges.shoe_charge);

  } else if (activity.slug === 'cricket') {
    const equipment = getEquipmentForActivity(activity_id);
    const { total_ball, total_bat } = getCricketRecoveryTotals(activity_id);
    const charges = computeCricketCharges(equipment, duration_minutes, total_ball, total_bat);
    data = { ...data, ...charges };
    const ground_cost = parseFloat(activityData.ground_cost) || 0;
    total_cost = r2(transport_cost + ground_cost + charges.ball_cost + charges.bat_charge);

  } else if (activity.slug === 'swimming') {
    const entry_fee = parseFloat(activityData.entry_fee) || 0;
    total_cost = r2(transport_cost + entry_fee);

  } else if (activity.slug === 'gym') {
    const entry_fee = parseFloat(activityData.entry_fee) || 0;
    total_cost = r2(transport_cost + entry_fee);

  } else if (activity.slug === 'marathon') {
    const entry_fee = parseFloat(activityData.entry_fee) || 0;
    total_cost = r2(transport_cost + entry_fee);

  } else {
    const entry_fee = parseFloat(activityData.entry_fee) || 0;
    total_cost = r2(transport_cost + entry_fee);
  }

  const result = db.prepare(`
    INSERT INTO sessions (activity_id, date, duration_minutes, transport_cost, total_cost, data, notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(activity_id, date, duration_minutes, transport_cost, total_cost,
         JSON.stringify(data), notes || null);

  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json(enrichSession(session));
});

router.delete('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  db.prepare('DELETE FROM sessions WHERE id=?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
