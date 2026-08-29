const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:slug', (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE slug=?').get(req.params.slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });
  res.json(db.prepare('SELECT * FROM equipment WHERE activity_id=? ORDER BY id').all(act.id));
});

router.put('/:slug/:name', (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE slug=?').get(req.params.slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });

  const item = db.prepare('SELECT * FROM equipment WHERE activity_id=? AND name=?').get(act.id, req.params.name);
  if (!item) return res.status(404).json({ error: 'Equipment not found' });

  const { total_cost, units_per_pack, hours_per_unit, amort_sessions } = req.body;
  db.prepare(`
    UPDATE equipment SET
      total_cost     = COALESCE(?, total_cost),
      units_per_pack = COALESCE(?, units_per_pack),
      hours_per_unit = COALESCE(?, hours_per_unit),
      amort_sessions = COALESCE(?, amort_sessions)
    WHERE activity_id=? AND name=?
  `).run(total_cost ?? null, units_per_pack ?? null, hours_per_unit ?? null,
         amort_sessions ?? null, act.id, req.params.name);

  res.json(db.prepare('SELECT * FROM equipment WHERE activity_id=? AND name=?').get(act.id, req.params.name));
});

module.exports = router;
