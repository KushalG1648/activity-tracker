const express = require('express');
const router  = express.Router();
const pool    = require('../db');

function r2(n) { return Math.round(n * 100) / 100; }

router.get('/:slug', async (req, res) => {
  try {
    const { rows: acts } = await pool.query('SELECT id FROM activities WHERE slug=$1', [req.params.slug]);
    if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
    const { rows } = await pool.query(
      'SELECT * FROM activity_expenses WHERE activity_id=$1 ORDER BY date DESC, created_at DESC',
      [acts[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:slug', async (req, res) => {
  try {
    const { rows: acts } = await pool.query('SELECT id FROM activities WHERE slug=$1', [req.params.slug]);
    if (!acts.length) return res.status(404).json({ error: 'Activity not found' });
    const actId = acts[0].id;

    const { date, category, amount, description } = req.body;
    if (!date || !category || amount == null)
      return res.status(400).json({ error: 'date, category, and amount are required' });

    const { rows } = await pool.query(
      'INSERT INTO activity_expenses (activity_id, date, category, amount, description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [actId, date, category, r2(parseFloat(amount) || 0), description || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM activity_expenses WHERE id=$1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
