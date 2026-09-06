const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/setup/status - check if database is initialised
router.get('/status', async (req, res) => {
  try {
    // Check if the organisations table exists
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'organisations'
      ) AS has_schema
    `);
    const hasSchema = check.rows[0].has_schema;

    let hasTemplates = false;
    if (hasSchema) {
      const tplCheck = await pool.query(`SELECT COUNT(*)::int AS n FROM email_templates`);
      hasTemplates = tplCheck.rows[0].n >= 14;
    }

    res.json({
      has_schema: hasSchema,
      has_templates: hasTemplates,
      ready: hasSchema && hasTemplates
    });
  } catch (err) {
    // If the connection itself fails, that's a bigger problem
    res.status(500).json({ error: err.message, ready: false });
  }
});

// POST /api/setup/init - run schema + seed templates in one go
router.post('/init', async (req, res) => {
  const results = { schema: null, templates: null };
  try {
    // 1. Apply schema
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    results.schema = 'ok';

    // 2. Seed templates (inline, so we don't depend on the scripts file)
    const templates = require('../scripts/seed-templates-data');
    let seeded = 0;
    for (const t of templates) {
      await pool.query(
        `INSERT INTO email_templates (purpose, language, purpose_label, subject, body, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (purpose, language) DO UPDATE
         SET purpose_label = EXCLUDED.purpose_label,
             subject = EXCLUDED.subject,
             body = EXCLUDED.body,
             sort_order = EXCLUDED.sort_order`,
        [t.purpose, t.language, t.purpose_label, t.subject, t.body, t.sort_order]
      );
      seeded++;
    }
    results.templates = `${seeded} seeded`;

    // Signal to any db-ready caches that things changed (they'll re-check on next request)
    if (global.__lwpDbReadyReset) global.__lwpDbReadyReset();

    res.json({ ok: true, results });
  } catch (err) {
    console.error('Setup failed:', err);
    res.status(500).json({ error: err.message, results });
  }
});

module.exports = router;
