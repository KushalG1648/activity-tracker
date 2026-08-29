const express = require('express');
const router = express.Router();
const db = require('../db');

function r2(n) { return Math.round(n * 100) / 100; }

// GET /:slug — list all expenses for an activity
router.get('/:slug', (req, res) => {
  const act = db.prepare('SELECT id FROM activities WHERE slug=?').get(req.params.slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });

  const expenses = db.prepare(
    'SELECT * FROM activity_expenses WHERE activity_id=? ORDER BY date DESC, created_at DESC'
  ).all(act.id);
  res.json(expenses);
});

// POST /:slug — add expense
router.post('/:slug', (req, res) => {
  const act = db.prepare('SELECT id FROM activities WHERE slug=?').get(req.params.slug);
  if (!act) return res.status(404).json({ error: 'Activity not found' });

  const { date, category, amount, description } = req.body;
  if (!date || !category || amount == null) {
    return res.status(400).json({ error: 'date, category, and amount are required' });
  }

  const result = db.prepare(
    'INSERT INTO activity_expenses (activity_id, date, category, amount, description) VALUES (?,?,?,?,?)'
  ).run(act.id, date, category, r2(parseFloat(amount) || 0), description || null);

  const expense = db.prepare('SELECT * FROM activity_expenses WHERE id=?').get(result.lastInsertRowid);
  res.json(expense);
});

// DELETE /:id — delete an expense
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM activity_expenses WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
