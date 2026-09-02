const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { RESERVED_SLUGS } = require('../db');

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM activities ORDER BY sort_order, id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { display_name, emoji, color } = req.body;
    if (!display_name || !emoji || !color)
      return res.status(400).json({ error: 'display_name, emoji, and color are required' });

    const slug = slugify(display_name);
    if (!slug) return res.status(400).json({ error: 'Invalid name' });
    if (RESERVED_SLUGS.includes(slug))
      return res.status(409).json({ error: `"${slug}" is a reserved name` });

    const { rows: existing } = await pool.query('SELECT id FROM activities WHERE slug=$1', [slug]);
    if (existing.length) return res.status(409).json({ error: 'An activity with that name already exists' });

    const { rows: [{ m: maxOrder }] } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM activities'
    );

    const { rows } = await pool.query(
      'INSERT INTO activities (slug, display_name, emoji, color, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [slug, display_name, emoji, color, Number(maxOrder) + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { rows: existing } = await pool.query('SELECT * FROM activities WHERE slug=$1', [slug]);
    if (!existing.length) return res.status(404).json({ error: 'Activity not found' });

    const { display_name, emoji, color, enabled, sort_order } = req.body;
    const { rows } = await pool.query(`
      UPDATE activities SET
        display_name = COALESCE($1, display_name),
        emoji        = COALESCE($2, emoji),
        color        = COALESCE($3, color),
        enabled      = COALESCE($4, enabled),
        sort_order   = COALESCE($5, sort_order)
      WHERE slug = $6
      RETURNING *
    `, [
      display_name ?? null,
      emoji        ?? null,
      color        ?? null,
      enabled != null ? Boolean(enabled) : null,
      sort_order   ?? null,
      slug,
    ]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (RESERVED_SLUGS.includes(slug))
      return res.status(403).json({ error: 'Default activities cannot be deleted' });

    const { rows } = await pool.query('SELECT * FROM activities WHERE slug=$1', [slug]);
    if (!rows.length) return res.status(404).json({ error: 'Activity not found' });
    const act = rows[0];

    const { rows: [{ n }] } = await pool.query(
      'SELECT COUNT(*) AS n FROM sessions WHERE activity_id=$1', [act.id]
    );
    if (Number(n) > 0)
      return res.status(409).json({ error: `Cannot delete: ${n} session(s) exist for this activity` });

    await pool.query('DELETE FROM equipment WHERE activity_id=$1', [act.id]);
    await pool.query('DELETE FROM activities WHERE slug=$1', [slug]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
