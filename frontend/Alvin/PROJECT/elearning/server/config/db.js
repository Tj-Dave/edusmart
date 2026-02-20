// server/config/db.js
// PostgreSQL connection pool using the 'pg' library.

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'edusmart',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Connection pool settings
  max:             10,   // max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  PostgreSQL connection failed:', err.message);
    process.exit(1);
  }
  release();
  console.log(`✅  PostgreSQL connected → ${process.env.DB_NAME || 'edusmart'}`);
});

// Helper: run a parameterised query
const query = (text, params) => pool.query(text, params);

// Helper: get a dedicated client for transactions
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };