const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { sha256 } = require('../db');

router.post('/verify', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.json({ ok: false });
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='password_hash'");
    const row = rows[0];
    res.json({ ok: !!row && sha256(password) === row.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/password', async (req, res) => {
  try {
    const { current, next } = req.body;
    if (!current || !next) return res.status(400).json({ error: 'Missing fields' });
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='password_hash'");
    const row = rows[0];
    if (!row || sha256(current) !== row.value) return res.status(401).json({ error: 'Wrong password' });
    await pool.query("UPDATE settings SET value=$1 WHERE key='password_hash'", [sha256(next)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
