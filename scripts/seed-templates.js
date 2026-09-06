// Seed the email_templates table. Idempotent - can run multiple times.
// Run: node scripts/seed-templates.js
// Also usable from the app's /api/setup/init endpoint (shared data module).
require('dotenv').config();
const pool = require('../db/pool');
const templates = require('./seed-templates-data');

(async () => {
  try {
    console.log(`Seeding ${templates.length} templates...`);
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
    }
    console.log('Templates seeded.');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
