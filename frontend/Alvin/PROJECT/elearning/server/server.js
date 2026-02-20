// server/server.js
require('dotenv').config();
require('./config/db');   // connect on startup

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/student');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ──────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/student', studentRoutes);

// ── Health ──────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── 404 ─────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `${req.method} ${req.path} not found.` }));

// ── Error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀  EduSmart API  →  http://localhost:${PORT}`);
  console.log(`    Mode: ${process.env.NODE_ENV || 'development'}\n`);
});