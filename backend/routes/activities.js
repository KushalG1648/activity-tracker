const express = require('express');
const router = express.Router();
const db = require('../db');
const { RESERVED_SLUGS } = require('../db');

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM activities ORDER BY sort_order, id').all());
});

router.post('/', (req, res) => {
  const { display_name, emoji, color } = req.body;
  if (!display_name || !emoji || !color) {
    return res.status(400).json({ error: 'display_name, emoji, and color are required' });
  }
  const slug = slugify(display_name);
  if (!slug) return res.status(400).json({ error: 'Invalid name' });
  if (RESERVED_SLUGS.includes(slug)) {
    return res.status(409).json({ error: `"${slug}" is a reserved name` });
  }
  const existing = db.prepare('SELECT id FROM activities WHERE slug=?').get(slug);
  if (existing) return res.status(409).json({ error: 'An activity with that name already exists' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM activities').get().m;
  const result = db.prepare(
    'INSERT INTO activities (slug, display_name, emoji, color, sort_order) VALUES (?,?,?,?,?)'
  ).run(slug, display_name, emoji, color, maxOrder + 1);
  res.status(201).json(db.prepare('SELECT * FROM activities WHERE id=?').get(result.lastInsertRowid));
});

router.put('/:slug', (req, res) => {
  const { slug } = req.params;
  const act = db.prepare('SELECT * FROM activities WHERE slug=?').get(slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });

  const { display_name, emoji, color, enabled, sort_order } = req.body;
  db.prepare(`
    UPDATE activities SET
      display_name = COALESCE(?, display_name),
      emoji        = COALESCE(?, emoji),
      color        = COALESCE(?, color),
      enabled      = COALESCE(?, enabled),
      sort_order   = COALESCE(?, sort_order)
    WHERE slug = ?
  `).run(display_name ?? null, emoji ?? null, color ?? null,
         enabled != null ? (enabled ? 1 : 0) : null,
         sort_order ?? null, slug);
  res.json(db.prepare('SELECT * FROM activities WHERE slug=?').get(slug));
});

router.delete('/:slug', (req, res) => {
  const { slug } = req.params;
  if (RESERVED_SLUGS.includes(slug)) {
    return res.status(403).json({ error: 'Default activities cannot be deleted' });
  }
  const act = db.prepare('SELECT * FROM activities WHERE slug=?').get(slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });

  const sessionCount = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE activity_id=?').get(act.id).n;
  if (sessionCount > 0) {
    return res.status(409).json({ error: `Cannot delete: ${sessionCount} session(s) exist for this activity` });
  }
  db.prepare('DELETE FROM equipment WHERE activity_id=?').run(act.id);
  db.prepare('DELETE FROM activities WHERE slug=?').run(slug);
  res.json({ message: 'Deleted' });
});

module.exports = router;
