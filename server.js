// LWP CRM — Express server entry
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3000;

// --- middleware -------------------------------------------------
app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Session with cookie-based storage; sessions kept in memory since it's single-user
// If Render restarts, user re-logs in (not a big deal for one person).
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-please',
  name: 'lwp.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Simple in-process rate limit for /api/login (prevents password brute-force)
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
function loginLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  req._loginTrack = { ip, entry };
  next();
}

// --- auth guard -------------------------------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorised' });
  return res.redirect('/login.html');
}

// --- login endpoints (unauthenticated) --------------------------
app.post('/api/login', loginLimit, async (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  const { ip, entry } = req._loginTrack;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server' });
  }
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password required' });
  }

  // constant-time compare
  const ok = password.length === expected.length && bcrypt.compareSync(password, bcrypt.hashSync(expected, 4));
  // Because bcrypt.hashSync of the same expected produces different hashes, we can't use it that way.
  // Simple safe compare instead:
  const equal = (a, b) => {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  };
  const good = equal(password, expected);

  if (!good) {
    entry.count += 1;
    if (entry.count >= 5) {
      entry.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
      entry.count = 0;
    }
    loginAttempts.set(ip, entry);
    return res.status(401).json({ error: 'Incorrect password' });
  }

  loginAttempts.delete(ip);
  req.session.authed = true;
  req.session.loginTime = Date.now();
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authed: !!(req.session && req.session.authed) });
});

// --- public assets not requiring auth (login page + brand mark) ---
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'style.css')));
app.get('/mark.svg', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mark.svg')));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/manifest.webmanifest', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sw.js')));

// Setup page requires auth but NOT the database (it's what creates the database)
app.get('/setup.html', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'setup.html')));
app.use('/api/setup', requireAuth, require('./routes/setup'));

// Middleware: if DB not initialised, redirect to /setup.html for HTML requests
// and return a friendly error for API requests
let dbReadyCache = { ready: false, checkedAt: 0 };
global.__lwpDbReadyReset = () => { dbReadyCache = { ready: false, checkedAt: 0 }; };
async function checkDbReady() {
  const now = Date.now();
  // Cache for 30s to avoid hammering the DB
  if (dbReadyCache.ready && (now - dbReadyCache.checkedAt) < 30000) return true;
  try {
    const r = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organisations'
      ) AS has_schema
    `);
    dbReadyCache = { ready: r.rows[0].has_schema, checkedAt: now };
    return dbReadyCache.ready;
  } catch (err) {
    return false;
  }
}

async function requireDbReady(req, res, next) {
  const ready = await checkDbReady();
  if (ready) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ error: 'Database not set up. Visit /setup.html first.' });
  }
  return res.redirect('/setup.html');
}

// --- API routes (auth + DB ready required) ---------------------------------
app.use('/api', requireAuth);
app.use('/api/organisations', requireDbReady, require('./routes/organisations'));
app.use('/api/log', requireDbReady, require('./routes/log'));
app.use('/api/templates', requireDbReady, require('./routes/templates'));
app.use('/api/dashboard', requireDbReady, require('./routes/dashboard'));
app.use('/api/settings', requireDbReady, require('./routes/settings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/backup', requireDbReady, require('./routes/backup'));
app.use('/api/import', requireDbReady, require('./routes/import'));

// --- static app pages (auth required, redirects to setup if DB not ready) ---
app.use(requireAuth, requireDbReady, express.static(path.join(__dirname, 'public')));

// Health
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- error handler ----------------------------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'server error' });
});

app.listen(PORT, () => {
  console.log(`LWP CRM listening on port ${PORT}`);
});
