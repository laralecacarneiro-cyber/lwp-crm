const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

// Trim invisible characters that sometimes creep in from copy-paste
// (leading/trailing whitespace, newlines, BOM, zero-width chars)
const dbUrlRaw = process.env.DATABASE_URL
  .trim()
  .replace(/^\uFEFF/, '')
  .replace(/[\u200B-\u200D]/g, '');

// Parse URL manually so we control exactly what gets passed to pg,
// and so we can produce a clear error if the string is malformed.
let config;
try {
  const url = new URL(dbUrlRaw);
  config = {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: parseInt(url.port || '5432', 10),
    database: url.pathname.replace(/^\//, '') || 'postgres',
  };
} catch (err) {
  console.error('FATAL: DATABASE_URL is not a valid URL:', err.message);
  console.error('Value shape (redacted):', dbUrlRaw.replace(/:([^:@/]+)@/, ':<PASSWORD>@'));
  process.exit(1);
}

// SSL only when connecting to remote hosts. Locally we skip SSL.
const isLocalhost = /^(localhost|127\.0\.0\.1|::1)$/.test(config.host);
if (!isLocalhost) {
  config.ssl = {
    rejectUnauthorized: false,
    // Explicit SNI so the pooler receives the correct hostname
    // (some Node/pg combinations skip SNI when rejectUnauthorized is false)
    servername: config.host,
  };
}

config.max = 5;
config.idleTimeoutMillis = 30000;
config.connectionTimeoutMillis = 10000;

// Log parsed config (redacted) so we can debug from Render logs if needed
console.log('[db] Connecting as %s to %s:%s/%s (ssl: %s)',
  config.user, config.host, config.port, config.database, config.ssl ? 'yes' : 'no');

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err);
});

module.exports = pool;
