require('dotenv').config();
const { Pool, types } = require('pg');
const crypto = require('crypto');

// Return DATE and TIMESTAMP columns as plain strings instead of JS Date objects.
// Keeps the same 'YYYY-MM-DD' format the app already expects everywhere.
types.setTypeParser(1082, v => v); // DATE
types.setTypeParser(1114, v => v); // TIMESTAMP
types.setTypeParser(1184, v => v); // TIMESTAMPTZ

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err);
});

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

const RESERVED_SLUGS = [
  'activities', 'sessions', 'settings', 'api',
  'badminton', 'swimming', 'gym', 'run', 'cricket',
];

module.exports = pool;
module.exports.sha256 = sha256;
module.exports.RESERVED_SLUGS = RESERVED_SLUGS;
