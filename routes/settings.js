const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM settings`);
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    // env vars override for sender defaults if unset in db
    out.sender_name = out.sender_name || process.env.LWP_SENDER_NAME || 'Lara';
    out.sender_role = out.sender_role || process.env.LWP_SENDER_ROLE || 'Head of Business Development';
    out.sender_email = out.sender_email || process.env.LWP_SENDER_EMAIL || 'info@leadingwithppl.com';
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings - upsert a key/value
router.put('/', async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key required' });
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value == null ? '' : String(value)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
