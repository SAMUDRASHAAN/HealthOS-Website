const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDb } = require('./db');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Security & parsing middleware ---
app.use(helmet({
  contentSecurityPolicy: false // relaxed for the inline <style>/<script> single-file frontend; tighten if you split assets out
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '100kb' }));

// --- Rate limiting on write endpoints ---
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});
app.use('/api/contact', writeLimiter);
app.use('/api/demo-request', writeLimiter);

// --- DB init ---
initDb();

// --- API routes ---
app.use('/api', contactRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'healthos-website', time: new Date().toISOString() });
});

// --- Static frontend (single self-contained page) ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HealthOS website running at http://localhost:${PORT}`);
});
