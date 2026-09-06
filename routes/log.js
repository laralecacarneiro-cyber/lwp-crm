const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/log?org_id=X  -- entries for one org, most recent first
// GET /api/log            -- all entries across all orgs (feed)
router.get('/', async (req, res) => {
  try {
    const { org_id } = req.query;
    let sql, params;
    if (org_id) {
      sql = `
        SELECT l.*, o.name AS org_name
        FROM outreach_log l
        JOIN organisations o ON o.id = l.organisation_id
        WHERE l.organisation_id = $1
        ORDER BY l.entry_date DESC, l.id DESC
      `;
      params = [org_id];
    } else {
      sql = `
        SELECT l.*, o.name AS org_name
        FROM outreach_log l
        JOIN organisations o ON o.id = l.organisation_id
        ORDER BY l.entry_date DESC, l.id DESC
        LIMIT 200
      `;
      params = [];
    }
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/log - add an entry
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.organisation_id) return res.status(400).json({ error: 'organisation_id required' });
    if (!b.summary || !b.summary.trim()) return res.status(400).json({ error: 'summary required' });
    const { rows } = await pool.query(
      `INSERT INTO outreach_log (organisation_id, entry_date, channel, entry_type, summary, follow_up_needed, follow_up_date, status_update)
       VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, COALESCE($6, false), $7, $8)
       RETURNING *`,
      [b.organisation_id, b.entry_date || null, b.channel || null, b.entry_type || null,
       b.summary.trim(), b.follow_up_needed || false, b.follow_up_date || null, b.status_update || null]
    );

    // update last_contact on the org
    await pool.query(
      `UPDATE organisations SET last_contact = COALESCE($1, CURRENT_DATE) WHERE id = $2`,
      [b.entry_date || null, b.organisation_id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/log/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM outreach_log WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
