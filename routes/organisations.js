const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// Fields we accept from the client (whitelist for safety)
const FIELDS = [
  'name', 'category', 'country', 'city', 'priority', 'status',
  'contact_name', 'contact_role', 'email', 'phone', 'website',
  'why_relevant', 'source_intro_path', 'notes',
  'next_action', 'next_action_date', 'last_contact'
];

// GET /api/organisations - list with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, priority, status, country, search } = req.query;
    const clauses = [];
    const params = [];

    if (category) { params.push(category); clauses.push(`category = $${params.length}`); }
    if (priority) { params.push(priority); clauses.push(`priority = $${params.length}`); }
    if (status)   { params.push(status);   clauses.push(`status = $${params.length}`); }
    if (country)  { params.push(country);  clauses.push(`country = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      clauses.push(`(
        LOWER(name) LIKE $${params.length}
        OR LOWER(COALESCE(contact_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(why_relevant, '')) LIKE $${params.length}
        OR LOWER(COALESCE(notes, '')) LIKE $${params.length}
        OR LOWER(COALESCE(city, '')) LIKE $${params.length}
      )`);
    }

    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const sql = `
      SELECT id, name, category, country, city, priority, status,
             contact_name, contact_role, email, phone, website,
             why_relevant, source_intro_path, notes,
             next_action, next_action_date, last_contact,
             created_at, updated_at
      FROM organisations
      ${where}
      ORDER BY
        CASE priority WHEN 'Tier 1' THEN 1 WHEN 'Tier 2' THEN 2 WHEN 'Tier 3' THEN 3 ELSE 4 END,
        name ASC
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/organisations/facets - distinct values for filter dropdowns
router.get('/facets', async (req, res) => {
  try {
    const cats = await pool.query(`SELECT DISTINCT category FROM organisations WHERE category IS NOT NULL AND category <> '' ORDER BY category`);
    const countries = await pool.query(`SELECT DISTINCT country FROM organisations WHERE country IS NOT NULL AND country <> '' ORDER BY country`);
    res.json({
      categories: cats.rows.map(r => r.category),
      countries: countries.rows.map(r => r.country),
      priorities: ['Tier 1', 'Tier 2', 'Tier 3'],
      statuses: ['Not started', 'Researching', 'Contact made', 'In dialogue',
                 'Meeting scheduled', 'Met', 'Partner active', 'On hold', 'Not a fit']
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/organisations/:id - one org
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM organisations WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/organisations - create
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const cols = [];
    const vals = [];
    const params = [];
    FIELDS.forEach(f => {
      if (body[f] !== undefined) {
        cols.push(f);
        params.push(body[f] === '' && (f === 'next_action_date' || f === 'last_contact') ? null : body[f]);
        vals.push(`$${params.length}`);
      }
    });
    const { rows } = await pool.query(
      `INSERT INTO organisations (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`,
      params
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/organisations/:id - update
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const sets = [];
    const params = [];
    FIELDS.forEach(f => {
      if (body[f] !== undefined) {
        params.push(body[f] === '' && (f === 'next_action_date' || f === 'last_contact') ? null : body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    });
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE organisations SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/organisations/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM organisations WHERE id = $1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
