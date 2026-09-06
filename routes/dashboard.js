const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// GET /api/dashboard - aggregated view for the landing page
router.get('/', async (req, res) => {
  try {
    const byTier = await pool.query(`
      SELECT COALESCE(priority, 'Unassigned') AS priority, COUNT(*)::int AS n
      FROM organisations GROUP BY priority
    `);
    const byStatus = await pool.query(`
      SELECT COALESCE(status, 'Unassigned') AS status, COUNT(*)::int AS n
      FROM organisations GROUP BY status
    `);

    // Tier 1 orgs still 'Not started'
    const tier1NotStarted = await pool.query(`
      SELECT id, name, category, country, city, why_relevant, email, contact_name
      FROM organisations
      WHERE priority = 'Tier 1' AND (status = 'Not started' OR status IS NULL OR status = '')
      ORDER BY name
    `);

    // Next actions due in the next 14 days
    const nextActions = await pool.query(`
      SELECT id, name, next_action, next_action_date, priority, status
      FROM organisations
      WHERE next_action_date IS NOT NULL
        AND next_action_date <= (CURRENT_DATE + INTERVAL '14 days')
      ORDER BY next_action_date ASC
    `);

    // Stale conversations: last_contact 30+ days ago and status is engaged
    const stale = await pool.query(`
      SELECT id, name, priority, status, last_contact,
             (CURRENT_DATE - last_contact) AS days_since
      FROM organisations
      WHERE last_contact IS NOT NULL
        AND (CURRENT_DATE - last_contact) >= 30
        AND status IN ('Contact made', 'In dialogue', 'Meeting scheduled', 'Met', 'Partner active')
      ORDER BY last_contact ASC
      LIMIT 20
    `);

    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM organisations`);

    res.json({
      total: total.rows[0].n,
      by_tier: byTier.rows,
      by_status: byStatus.rows,
      tier1_not_started: tier1NotStarted.rows,
      next_actions: nextActions.rows,
      stale: stale.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
