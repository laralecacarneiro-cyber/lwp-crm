const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../db/pool');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Column heading -> DB field
const COLMAP = {
  'Organisation': 'name',
  'Category': 'category',
  'Country / Region': 'country',
  'Country/Region': 'country',
  'City': 'city',
  'Why relevant for LWP': 'why_relevant',
  'Priority': 'priority',
  'Status': 'status',
  'Contact name': 'contact_name',
  'Role': 'contact_role',
  'Email': 'email',
  'Phone': 'phone',
  'Website': 'website',
  'Source / Intro path': 'source_intro_path',
  'Last contact': 'last_contact',
  'Next action': 'next_action',
  'Next action date': 'next_action_date',
  'Notes': 'notes'
};

// The category sheets we know about in the outreach CRM workbook
const KNOWN_SHEETS = new Set([
  'Existing Partners',
  'National Institutions PT',
  'Regional Institutions PT',
  'Sector Clusters PT',
  'Bilateral Chambers PT',
  'Foreign Institutions',
  'Other Partners'
]);

// Category label per sheet — used if the row's Category is blank
const SHEET_TO_CATEGORY = {
  'Existing Partners': 'Existing partner',
  'National Institutions PT': 'National institution',
  'Regional Institutions PT': 'Regional institution',
  'Sector Clusters PT': 'Sector cluster',
  'Bilateral Chambers PT': 'Bilateral chamber',
  'Foreign Institutions': 'Foreign institution',
  'Other Partners': 'Other partner'
};

function normalisePriority(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^tier\s*1$/i.test(s)) return 'Tier 1';
  if (/^tier\s*2$/i.test(s)) return 'Tier 2';
  if (/^tier\s*3$/i.test(s)) return 'Tier 3';
  return null;
}

function normaliseStatus(v) {
  if (!v) return null;
  const s = String(v).trim();
  const valid = ['Not started', 'Researching', 'Contact made', 'In dialogue',
                 'Meeting scheduled', 'Met', 'Partner active', 'On hold', 'Not a fit'];
  return valid.find(x => x.toLowerCase() === s.toLowerCase()) || null;
}

function normaliseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function looksLikePlaceholder(name) {
  const s = String(name || '').trim();
  return s.startsWith('[') && s.endsWith(']');
}

// POST /api/import/xlsx - upload the LWP_Outreach_CRM.xlsx
router.post('/xlsx', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const client = await pool.connect();
    let inserted = 0;
    let skipped = 0;
    let placeholders = 0;

    try {
      await client.query('BEGIN');
      for (const sheetName of wb.SheetNames) {
        if (!KNOWN_SHEETS.has(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        // Row 4 is the header row per our workbook layout
        const rows = XLSX.utils.sheet_to_json(ws, {
          range: 3, // skip title, subtitle, spacer -> header at row index 3
          defval: '',
          raw: false
        });
        for (const r of rows) {
          const rec = {};
          Object.keys(r).forEach(k => {
            const dbField = COLMAP[k.trim()];
            if (dbField) rec[dbField] = typeof r[k] === 'string' ? r[k].trim() : r[k];
          });
          if (!rec.name || !rec.name.trim()) { skipped++; continue; }
          if (looksLikePlaceholder(rec.name)) { placeholders++; continue; }

          rec.category = rec.category || SHEET_TO_CATEGORY[sheetName] || null;
          rec.priority = normalisePriority(rec.priority);
          rec.status = normaliseStatus(rec.status);
          rec.next_action_date = normaliseDate(rec.next_action_date);
          rec.last_contact = normaliseDate(rec.last_contact);

          // Deduplicate: skip if name already exists
          const dup = await client.query(`SELECT id FROM organisations WHERE LOWER(name) = LOWER($1)`, [rec.name]);
          if (dup.rowCount > 0) { skipped++; continue; }

          await client.query(
            `INSERT INTO organisations
             (name, category, country, city, priority, status, contact_name, contact_role,
              email, phone, website, why_relevant, source_intro_path, notes,
              next_action, next_action_date, last_contact)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              rec.name, rec.category, rec.country || null, rec.city || null,
              rec.priority, rec.status, rec.contact_name || null, rec.contact_role || null,
              rec.email || null, rec.phone || null, rec.website || null,
              rec.why_relevant || null, rec.source_intro_path || null, rec.notes || null,
              rec.next_action || null, rec.next_action_date, rec.last_contact
            ]
          );
          inserted++;
        }
      }

      await client.query(
        `INSERT INTO settings (key, value) VALUES ('excel_imported', 'true')
         ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true, inserted, skipped, placeholders_skipped: placeholders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
