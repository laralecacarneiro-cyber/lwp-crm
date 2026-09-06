// One-shot database initialiser. Run: node scripts/init-db.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

(async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf-8');
    console.log('Applying schema...');
    await pool.query(schema);
    console.log('Schema applied.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to apply schema:', err.message);
    process.exit(1);
  }
})();
