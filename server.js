const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Requests arrive through Cloudflare and then Render's internal mesh, so
// x-forwarded-for looks like "<client>, <cloudflare>, <render-internal>".
// Counting 3 hops back from the socket lands on the real client; counting
// from the right is also what makes it unspoofable, since anything a client
// puts in the header themselves is pushed further left and ignored.
// With the previous value of 1, req.ip was Render's internal address, which
// both wasted the visitors.ip column and made express-rate-limit bucket by
// proxy node instead of by visitor.
app.set('trust proxy', 3);

// Middleware
app.use(helmet({
  // the frontend is one self-contained page with inline <style>/<script>
  contentSecurityPolicy: false,
}));

// Same-origin by default - this app serves the frontend itself. Set
// ALLOWED_ORIGIN (comma-separated) only if another origin must call the API.
const allowedOrigin = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : false;
app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST', 'PATCH'] }));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Public write endpoints are unauthenticated, so cap how often they can be hit.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Tracking fires on every page view, so it gets a much higher ceiling.
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// Supabase Configuration
// ============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: Supabase credentials not configured. Database features will not work.');
  console.warn('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// The anon key is public (it ships in the frontend), so with RLS enabled it can
// only insert. Reading lead data needs the service-role key, which bypasses RLS
// and must never reach the browser. It is optional: without it the admin
// endpoints refuse outright rather than silently falling back to the anon key.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

if (!serviceRoleKey) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set - admin endpoints disabled.');
}
if (!process.env.ADMIN_API_KEY) {
  console.warn('WARNING: ADMIN_API_KEY not set - admin endpoints disabled.');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Fails closed: anything unconfigured means no admin access at all.
function requireAdmin(req, res, next) {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured || !supabaseAdmin) {
    return res.status(503).json({
      success: false,
      message: 'Admin endpoints are disabled. Set ADMIN_API_KEY and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  const header = req.get('authorization') || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!presented || !safeEqual(presented, configured)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  return next();
}

// User input is interpolated into notification emails; escape it so a lead
// cannot inject markup, and keep header fields on a single line.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Bump when the consent wording changes, so old records keep their own version.
const CONSENT_VERSION = process.env.CONSENT_VERSION || '2026-08-20.v1';

// Pull campaign attribution off a submission. Trimmed and length-capped so a
// crafted payload cannot stuff the column.
function sourceFields(body) {
  var cap = function (v) {
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null;
  };
  return {
    referrer: cap(body.referrer),
    landing_page: cap(body.landingPage),
    utm_source: cap(body.utmSource),
    utm_medium: cap(body.utmMedium),
    utm_campaign: cap(body.utmCampaign),
  };
}

// Bots fill every field they find. A real person never sees this one.
function isBot(body) {
  return typeof body.website === 'string' && body.website.trim() !== '';
}

function singleLine(value) {
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

// ============================================
// Email configuration (Resend HTTPS API)
// ============================================
// Render's free plan blocks outbound SMTP (ports 25, 465 and 587), so SMTP
// clients time out before they ever authenticate. Notifications therefore go
// out over HTTPS on 443, which is not blocked. Node has global fetch, so this
// needs no extra dependency.
const resendApiKey = process.env.RESEND_API_KEY;
const teamEmail = process.env.TEAM_EMAIL;

// Resend lets you send from onboarding@resend.dev without owning a domain.
// Until a domain is verified it will only deliver to the address the Resend
// account was registered with - which is fine here, because every notification
// goes to TEAM_EMAIL rather than to the person who filled in the form.
const mailFrom = process.env.MAIL_FROM || 'HealthOS <onboarding@resend.dev>';

if (!resendApiKey) {
  console.warn('WARNING: RESEND_API_KEY not set - notification emails are disabled.');
}
if (!teamEmail) {
  console.warn('WARNING: TEAM_EMAIL not set - notification emails are disabled.');
}

// Never throws: a submission must still succeed when notification fails.
async function sendNotification(subject, html) {
  if (!resendApiKey || !teamEmail) return;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: mailFrom, to: [teamEmail], subject, html }),
    });

    if (!response.ok) {
      console.error(`Notification email failed (${response.status}):`, await response.text());
      return;
    }

    const result = await response.json();
    console.log('Notification email sent:', result.id);
  } catch (error) {
    console.error('Notification email error:', error.message);
  }
}

// ============================================
// Routes
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// 1. DEMO REQUEST ENDPOINT
// ============================================
app.post('/api/demo-request', writeLimiter, async (req, res) => {
  try {
    const { name, email, phone, company, message, requestedDate, consent } = req.body;

    // Silently accept and discard: telling a bot it failed teaches it to adapt.
    if (isBot(req.body)) {
      return res.json({ success: true, message: 'Demo request received. We will contact you soon!' });
    }

    if (consent !== true) {
      return res.status(400).json({
        success: false,
        message: 'Please agree to be contacted before submitting.',
      });
    }

    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    const demoRequest = {
      name,
      email,
      phone,
      company: company || 'Not provided',
      message: message || '',
      requested_date: requestedDate || new Date().toISOString(),
      status: 'pending',
      consent_given: true,
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
      ...sourceFields(req.body),
    };

    // Save to Supabase
    // No .select(): RETURNING needs a SELECT policy, and anon is insert-only.
    const { error } = await supabase
      .from('demo_requests')
      .insert([demoRequest]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save demo request to database',
        error: error.message,
      });
    }

    console.log('Demo request saved for:', email);

    // Send email notification to team
    {
      const notification = {
        subject: singleLine(`New Demo Request: ${name}`),
        html: `
          <h2>New Demo Request</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Company:</strong> ${escapeHtml(company || 'Not provided')}</p>
          <p><strong>Message:</strong> ${escapeHtml(message || 'No message')}</p>
          <p><strong>Requested Date:</strong> ${escapeHtml(requestedDate || 'Not specified')}</p>
          <hr>
          <p><small>Status: Pending | Received: ${new Date().toISOString()}</small></p>
        `,
      };

      sendNotification(notification.subject, notification.html);
    }

    res.json({
      success: true,
      message: 'Demo request received. We will contact you soon!',
      demoRequest,
    });
  } catch (error) {
    console.error('Error processing demo request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process demo request',
      error: error.message,
    });
  }
});

// ============================================
// 2. VISITOR TRACKING ENDPOINT
// ============================================
app.post('/api/track-visitor', trackingLimiter, async (req, res) => {
  try {
    const { page, referrer, userAgent, timestamp, visitorId } = req.body;

    const visitorRecord = {
      page: page || '/',
      referrer: referrer || '',
      user_agent: userAgent || req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: timestamp || new Date().toISOString(),
      visitor_id: typeof visitorId === 'string' ? visitorId.slice(0, 64) : null,
    };

    // Save to Supabase
    const { error } = await supabase
      .from('visitors')
      .insert([visitorRecord]);

    if (error) {
      console.error('Supabase visitor insert error:', error);
      // Don't fail the response for tracking - it's not critical
    }

    console.log('Visitor tracked:', visitorRecord.page);

    res.json({
      success: true,
      message: 'Visitor tracked',
    });
  } catch (error) {
    console.error('Error tracking visitor:', error);
    // Don't fail the response - tracking is not critical
    res.json({
      success: true,
      message: 'Visitor tracked (with error)',
    });
  }
});

// ============================================
// 2b. PAGE EVENTS (funnel steps + section engagement)
// ============================================
// Whitelisted so the table cannot be filled with arbitrary event names.
const TRACKED_EVENTS = [
  'section_view',
  'demo_form_view',
  'contact_form_view',
  'demo_submit',
  'contact_submit',
];

app.post('/api/track-event', trackingLimiter, async (req, res) => {
  try {
    const { event, detail, visitorId } = req.body;

    if (!TRACKED_EVENTS.includes(event)) {
      return res.status(400).json({ success: false, message: 'Unknown event' });
    }

    const { error } = await supabase.from('page_events').insert([{
      visitor_id: typeof visitorId === 'string' ? visitorId.slice(0, 64) : null,
      event,
      detail: typeof detail === 'string' ? detail.slice(0, 120) : null,
    }]);

    if (error) console.error('Supabase page_event insert error:', error);

    // Tracking is never allowed to surface as a failure to the visitor.
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.json({ success: true });
  }
});

// ============================================
// 3. GET VISITOR ANALYTICS
// ============================================
app.get('/api/analytics/visitors', requireAdmin, async (req, res) => {
  try {
    // Get total visitors count
    const { count, error: countError } = await supabaseAdmin
      .from('visitors')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    // Get recent visitors (last 100)
    const { data: recentVisitors, error: dataError } = await supabaseAdmin
      .from('visitors')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (dataError) {
      throw dataError;
    }

    // Top pages are derived from recentVisitors below. The Supabase client has
    // no .group_by(), so the previous call here threw on every request.
    // Calculate page views per page
    let topPages = [];
    if (recentVisitors) {
      const pageCounts = {};
      recentVisitors.forEach(v => {
        pageCounts[v.page] = (pageCounts[v.page] || 0) + 1;
      });
      topPages = Object.entries(pageCounts)
        .map(([page, views]) => ({ page, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
    }

    res.json({
      success: true,
      totalVisitors: count || 0,
      pageViews: count || 0,
      topPages,
      recentData: recentVisitors,
    });
  } catch (error) {
    console.error('Error fetching visitor analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor analytics',
      error: error.message,
    });
  }
});

// ============================================
// 4. GET ALL DEMO REQUESTS (for admin)
// ============================================
app.get('/api/demo-requests', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('demo_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      demoRequests: data || [],
    });
  } catch (error) {
    console.error('Error fetching demo requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch demo requests',
      error: error.message,
    });
  }
});

// ============================================
// 5. CONTACT FORM ENDPOINT
// ============================================
app.post('/api/contact', writeLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, consent } = req.body;

    if (isBot(req.body)) {
      return res.json({ success: true, message: 'Message received. Thank you for contacting us!' });
    }

    if (consent !== true) {
      return res.status(400).json({
        success: false,
        message: 'Please agree to be contacted before submitting.',
      });
    }

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required',
      });
    }

    const contactMessage = {
      name,
      email,
      subject: subject || 'General Inquiry',
      message,
      consent_given: true,
      consent_version: CONSENT_VERSION,
      consent_at: new Date().toISOString(),
      ...sourceFields(req.body),
    };

    // Save to Supabase
    const { error } = await supabase
      .from('contacts')
      .insert([contactMessage]);

    if (error) {
      console.error('Supabase contact insert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save contact message to database',
        error: error.message,
      });
    }

    console.log('Contact message saved from:', email);

    // Send email notification to team
    {
      const notification = {
        subject: singleLine(`New Contact: ${subject || 'General Inquiry'}`),
        html: `
          <h2>New Contact Message</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject || 'General Inquiry')}</p>
          <p><strong>Message:</strong> ${escapeHtml(message)}</p>
          <hr>
          <p><small>Received: ${new Date().toISOString()}</small></p>
        `,
      };

      sendNotification(notification.subject, notification.html);
    }

    res.json({
      success: true,
      message: 'Message received. Thank you for contacting us!',
      contactMessage,
    });
  } catch (error) {
    console.error('Error processing contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process contact message',
      error: error.message,
    });
  }
});

// ============================================
// Admin portal API
// ============================================
const DEMO_STATUSES = ['pending', 'contacted', 'scheduled', 'closed'];
const CONTACT_STATUSES = ['open', 'handled'];

// Dashboard tiles. "Live" is anyone whose last page view was in the past
// 5 minutes - the tracker fires once per page load, so this is activity, not
// a persistent connection.
app.get('/api/admin/summary', requireAdmin, async (req, res) => {
  try {
    const now = Date.now();
    const since = (ms) => new Date(now - ms).toISOString();
    const countOf = (table) =>
      supabaseAdmin.from(table).select('*', { count: 'exact', head: true });

    const [live, today, totalVisits, openLeads, openQueries] = await Promise.all([
      countOf('visitors').gte('timestamp', since(5 * 60 * 1000)),
      countOf('visitors').gte('timestamp', since(24 * 60 * 60 * 1000)),
      countOf('visitors'),
      countOf('demo_requests').eq('status', 'pending'),
      countOf('contacts').eq('status', 'open'),
    ]);

    const failed = [live, today, totalVisits, openLeads, openQueries].find((r) => r.error);
    if (failed) throw failed.error;

    res.json({
      success: true,
      liveVisitors: live.count || 0,
      visitorsToday: today.count || 0,
      totalVisits: totalVisits.count || 0,
      openLeads: openLeads.count || 0,
      openQueries: openQueries.count || 0,
    });
  } catch (error) {
    console.error('Error building admin summary:', error);
    res.status(500).json({ success: false, message: 'Failed to build summary', error: error.message });
  }
});

// Contact messages, newest first.
app.get('/api/admin/contacts', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, contacts: data || [] });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts', error: error.message });
  }
});

function statusUpdater(table, allowed, label) {
  return async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
      }
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${allowed.join(', ')}`,
        });
      }

      const { data, error } = await supabaseAdmin
        .from(table)
        .update({ status })
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ success: false, message: `No such ${label}` });
      }

      res.json({ success: true, record: data[0] });
    } catch (error) {
      console.error(`Error updating ${label} status:`, error);
      res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
    }
  };
}

app.patch('/api/admin/demo-requests/:id', requireAdmin, statusUpdater('demo_requests', DEMO_STATUSES, 'demo request'));
app.patch('/api/admin/contacts/:id', requireAdmin, statusUpdater('contacts', CONTACT_STATUSES, 'contact'));

// ============================================
// Static frontend
// ============================================
// The API client is documented as living at the repo root, so serve it from there
app.get('/healthos-api-client.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'healthos-api-client.js'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Unmatched /api/* requests get a JSON 404, never the HTML shell
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `No such endpoint: ${req.method} ${req.originalUrl}`,
  });
});

// Everything else falls back to the single-page frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// Error handling middleware
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

// ============================================
// Start server
// ============================================
app.listen(PORT, () => {
  console.log(`HealthOS Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supabase connected: ${supabaseUrl ? 'yes' : 'no'}`);
});
