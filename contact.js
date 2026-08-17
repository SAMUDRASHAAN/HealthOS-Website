const express = require('express');
const { db } = require('../db');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(v, maxLen = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

// POST /api/contact
router.post('/contact', (req, res) => {
  const { name, email, organisation, role, message } = req.body || {};

  if (!isNonEmptyString(name, 120)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid name.' });
  }
  if (!isNonEmptyString(email, 160) || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }
  if (organisation && !isNonEmptyString(organisation, 200)) {
    return res.status(400).json({ success: false, error: 'Organisation name is too long.' });
  }
  if (message && !isNonEmptyString(message, 2000)) {
    return res.status(400).json({ success: false, error: 'Message is too long.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO leads (name, email, organisation, role, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      name.trim(),
      email.trim().toLowerCase(),
      (organisation || '').trim(),
      (role || '').trim(),
      (message || '').trim()
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('DB insert error:', err.message);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/leads — protected by a simple admin API key for internal use
router.get('/leads', (req, res) => {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 200').all();
  return res.json({ success: true, leads: rows });
});

module.exports = router;
