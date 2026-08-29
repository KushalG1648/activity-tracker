const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { sha256 } = require('../db');

router.post('/verify', (req, res) => {
  const { password } = req.body;
  if (!password) return res.json({ ok: false });
  const row = db.prepare("SELECT value FROM settings WHERE key='password_hash'").get();
  res.json({ ok: !!row && sha256(password) === row.value });
});

router.put('/password', (req, res) => {
  const { current, next } = req.body;
  if (!current || !next) return res.status(400).json({ error: 'Missing fields' });
  const row = db.prepare("SELECT value FROM settings WHERE key='password_hash'").get();
  if (!row || sha256(current) !== row.value) return res.status(401).json({ error: 'Wrong password' });
  db.prepare("UPDATE settings SET value=? WHERE key='password_hash'").run(sha256(next));
  res.json({ ok: true });
});

module.exports = router;
