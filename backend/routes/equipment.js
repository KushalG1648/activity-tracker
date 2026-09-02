const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/:slug', async (req, res) => {
  try {
    const { rows: acts } = await pool.query('SELECT * FROM activities WHERE slug=$1', [req.params.slug]);
    if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
    const { rows } = await pool.query(
      'SELECT * FROM equipment WHERE activity_id=$1 ORDER BY id', [acts[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:slug/:name', async (req, res) => {
  try {
    const { rows: acts } = await pool.query('SELECT * FROM activities WHERE slug=$1', [req.params.slug]);
    if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
    const act = acts[0];

    const { rows: items } = await pool.query(
      'SELECT * FROM equipment WHERE activity_id=$1 AND name=$2', [act.id, req.params.name]
    );
    if (!items.length) return res.status(404).json({ error: 'Equipment not found' });

    const { total_cost, units_per_pack, hours_per_unit, amort_sessions } = req.body;
    const { rows } = await pool.query(`
      UPDATE equipment SET
        total_cost     = COALESCE($1, total_cost),
        units_per_pack = COALESCE($2, units_per_pack),
        hours_per_unit = COALESCE($3, hours_per_unit),
        amort_sessions = COALESCE($4, amort_sessions)
      WHERE activity_id=$5 AND name=$6
      RETURNING *
    `, [
      total_cost     ?? null,
      units_per_pack ?? null,
      hours_per_unit ?? null,
      amort_sessions ?? null,
      act.id,
      req.params.name,
    ]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
