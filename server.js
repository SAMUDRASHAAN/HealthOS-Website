const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ============================================
// Email configuration (Nodemailer)
// ============================================
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify email connection
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter.verify((error, success) => {
    if (error) {
      console.log('Email transporter error:', error);
    } else {
      console.log('Email transporter is ready');
    }
  });
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
app.post('/api/demo-request', async (req, res) => {
  try {
    const { name, email, phone, company, message, requestedDate } = req.body;

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
    };

    // Save to Supabase
    const { data, error } = await supabase
      .from('demo_requests')
      .insert([demoRequest])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save demo request to database',
        error: error.message,
      });
    }

    console.log('Demo request saved:', data);

    // Send email notification to team
    if (process.env.EMAIL_USER) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.TEAM_EMAIL || process.env.EMAIL_USER,
        subject: `New Demo Request: ${name}`,
        html: `
          <h2>New Demo Request</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Company:</strong> ${company || 'Not provided'}</p>
          <p><strong>Message:</strong> ${message || 'No message'}</p>
          <p><strong>Requested Date:</strong> ${requestedDate || 'Not specified'}</p>
          <hr>
          <p><small>Status: Pending | Received: ${new Date().toISOString()}</small></p>
        `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error sending demo request email:', error);
        } else {
          console.log('Demo request email sent:', info.response);
        }
      });
    }

    res.json({
      success: true,
      message: 'Demo request received. We will contact you soon!',
      demoRequest: data[0],
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
app.post('/api/track-visitor', async (req, res) => {
  try {
    const { page, referrer, userAgent, timestamp } = req.body;

    const visitorRecord = {
      page: page || '/',
      referrer: referrer || '',
      user_agent: userAgent || req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: timestamp || new Date().toISOString(),
    };

    // Save to Supabase
    const { data, error } = await supabase
      .from('visitors')
      .insert([visitorRecord])
      .select();

    if (error) {
      console.error('Supabase visitor insert error:', error);
      // Don't fail the response for tracking - it's not critical
    }

    console.log('Visitor tracked:', visitorRecord);

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
// 3. GET VISITOR ANALYTICS
// ============================================
app.get('/api/analytics/visitors', async (req, res) => {
  try {
    // Get total visitors count
    const { count, error: countError } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    // Get recent visitors (last 100)
    const { data: recentVisitors, error: dataError } = await supabase
      .from('visitors')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (dataError) {
      throw dataError;
    }

    // Get top pages
    const { data: pageData, error: pageError } = await supabase
      .from('visitors')
      .select('page, count(*)')
      .group_by('page')
      .order('count', { ascending: false })
      .limit(10);

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
app.get('/api/demo-requests', async (req, res) => {
  try {
    const { data, error } = await supabase
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
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

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
    };

    // Save to Supabase
    const { data, error } = await supabase
      .from('contacts')
      .insert([contactMessage])
      .select();

    if (error) {
      console.error('Supabase contact insert error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save contact message to database',
        error: error.message,
      });
    }

    console.log('Contact message saved:', data);

    // Send confirmation email
    if (process.env.EMAIL_USER) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.TEAM_EMAIL || process.env.EMAIL_USER,
        subject: `New Contact: ${subject || 'General Inquiry'}`,
        html: `
          <h2>New Contact Message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
          <p><strong>Message:</strong> ${message}</p>
          <hr>
          <p><small>Received: ${new Date().toISOString()}</small></p>
        `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error sending contact email:', error);
        } else {
          console.log('Contact email sent:', info.response);
        }
      });
    }

    res.json({
      success: true,
      message: 'Message received. Thank you for contacting us!',
      contactMessage: data[0],
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
