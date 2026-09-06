const express = require('express');
const pool = require('../db/pool');
const ExcelJS = require('exceljs');
const router = express.Router();

// Utility: mark backup date in settings
async function stampBackup() {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('last_backup_at', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [new Date().toISOString()]
  );
}

// GET /api/backup/json - full JSON dump
router.get('/json', async (req, res) => {
  try {
    const orgs = await pool.query(`SELECT * FROM organisations ORDER BY id`);
    const logs = await pool.query(`SELECT * FROM outreach_log ORDER BY id`);
    const templates = await pool.query(`SELECT * FROM email_templates ORDER BY id`);
    const settings = await pool.query(`SELECT * FROM settings ORDER BY key`);
    await stampBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=lwp-crm-backup-${new Date().toISOString().slice(0,10)}.json`);
    res.send(JSON.stringify({
      exported_at: new Date().toISOString(),
      version: 1,
      organisations: orgs.rows,
      outreach_log: logs.rows,
      email_templates: templates.rows,
      settings: settings.rows,
    }, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup/json/restore - restore from JSON
router.post('/json/restore', express.json({ limit: '15mb' }), async (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.organisations)) {
      return res.status(400).json({ error: 'Invalid backup file' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM outreach_log');
      await client.query('DELETE FROM organisations');
      // orgs
      for (const o of data.organisations) {
        await client.query(
          `INSERT INTO organisations (id, name, category, country, city, priority, status,
            contact_name, contact_role, email, phone, website, why_relevant, source_intro_path, notes,
            next_action, next_action_date, last_contact, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [
            o.id, o.name, o.category, o.country, o.city, o.priority, o.status,
            o.contact_name, o.contact_role, o.email, o.phone, o.website, o.why_relevant, o.source_intro_path, o.notes,
            o.next_action, o.next_action_date, o.last_contact, o.created_at || new Date(), o.updated_at || new Date()
          ]
        );
      }
      // logs
      if (Array.isArray(data.outreach_log)) {
        for (const l of data.outreach_log) {
          await client.query(
            `INSERT INTO outreach_log (id, organisation_id, entry_date, channel, entry_type, summary,
              follow_up_needed, follow_up_date, status_update, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [l.id, l.organisation_id, l.entry_date, l.channel, l.entry_type, l.summary,
             l.follow_up_needed, l.follow_up_date, l.status_update, l.created_at || new Date()]
          );
        }
      }
      // reset sequences
      await client.query(`SELECT setval('organisations_id_seq', COALESCE((SELECT MAX(id) FROM organisations), 1))`);
      await client.query(`SELECT setval('outreach_log_id_seq', COALESCE((SELECT MAX(id) FROM outreach_log), 1))`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true, restored: data.organisations.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/backup/xlsx - export current CRM to Excel matching the original workbook
router.get('/xlsx', async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LWP CRM';
    wb.created = new Date();

    const orgs = await pool.query(`SELECT * FROM organisations ORDER BY category, priority, name`);
    const logs = await pool.query(`
      SELECT l.*, o.name AS organisation_name
      FROM outreach_log l JOIN organisations o ON o.id = l.organisation_id
      ORDER BY l.entry_date DESC, l.id DESC
    `);

    const HEADERS = [
      'Organisation', 'Category', 'Country / Region', 'City', 'Why relevant for LWP',
      'Priority', 'Status', 'Contact name', 'Role', 'Email', 'Phone', 'Website',
      'Source / Intro path', 'Last contact', 'Next action', 'Next action date', 'Notes'
    ];
    const HEADER_KEYS = [
      'name','category','country','city','why_relevant',
      'priority','status','contact_name','contact_role','email','phone','website',
      'source_intro_path','last_contact','next_action','next_action_date','notes'
    ];

    // Sheet per category
    const byCategory = {};
    orgs.rows.forEach(o => {
      const cat = o.category || 'Uncategorised';
      (byCategory[cat] = byCategory[cat] || []).push(o);
    });

    // Excel worksheet names can't contain any of: / \ ? * : [ ]
    // and must be <= 31 chars. Also must be unique.
    const usedSheetNames = new Set();
    function safeSheetName(raw) {
      let n = String(raw).replace(/[\/\\?*:\[\]]/g, '-').slice(0, 31).trim();
      if (!n) n = 'Sheet';
      let final = n;
      let i = 2;
      while (usedSheetNames.has(final)) {
        const suffix = ` ${i}`;
        final = n.slice(0, 31 - suffix.length) + suffix;
        i++;
      }
      usedSheetNames.add(final);
      return final;
    }

    // One "All organisations" sheet + category sheets
    function addOrgSheet(name, rows) {
      const ws = wb.addWorksheet(safeSheetName(name));
      ws.addRow(HEADERS);
      const header = ws.getRow(1);
      header.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1530' } };
      header.alignment = { vertical: 'middle', wrapText: true };
      header.height = 30;
      rows.forEach(o => {
        ws.addRow(HEADER_KEYS.map(k => o[k] ?? ''));
      });
      HEADERS.forEach((_, i) => {
        ws.getColumn(i + 1).width = [30,22,20,16,50,10,16,22,26,28,16,36,28,14,35,14,40][i];
      });
      // freeze
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    addOrgSheet('All organisations', orgs.rows);
    Object.entries(byCategory).forEach(([cat, rows]) => addOrgSheet(cat, rows));

    // Log sheet
    const log = wb.addWorksheet('Outreach Log');
    const LOG_HDR = ['Date', 'Organisation', 'Channel', 'Type', 'Summary', 'Follow-up date', 'Status update'];
    log.addRow(LOG_HDR);
    log.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    log.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1530' } };
    log.getRow(1).height = 30;
    logs.rows.forEach(l => {
      log.addRow([l.entry_date, l.organisation_name, l.channel, l.entry_type, l.summary, l.follow_up_date, l.status_update]);
    });
    LOG_HDR.forEach((_, i) => { log.getColumn(i + 1).width = [12, 26, 12, 12, 60, 14, 20][i]; });
    log.views = [{ state: 'frozen', ySplit: 1 }];

    await stampBackup();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=lwp-crm-${new Date().toISOString().slice(0,10)}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
