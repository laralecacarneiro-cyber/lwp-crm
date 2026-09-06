const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/templates?lang=en|pt
router.get('/', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const { rows } = await pool.query(
      `SELECT id, purpose, language, purpose_label, subject, body, sort_order
       FROM email_templates
       WHERE language = $1
       ORDER BY sort_order`,
      [lang]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/templates/:id - allow user to edit templates in-app
router.put('/:id', async (req, res) => {
  try {
    const { subject, body } = req.body || {};
    if (!subject || !body) return res.status(400).json({ error: 'subject and body required' });
    const { rows } = await pool.query(
      `UPDATE email_templates SET subject = $1, body = $2 WHERE id = $3 RETURNING *`,
      [subject, body, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
