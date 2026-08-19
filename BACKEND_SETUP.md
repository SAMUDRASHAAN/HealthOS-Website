# HealthOS Website Backend Setup Guide

This is the backend API for the HealthOS website, handling demo requests, visitor tracking, and lead generation.

## Features

1. **Demo Request Management** - Capture and track demo booking requests
2. **Visitor Tracking** - Log and analyze website visitor data
3. **Lead Capture** - Store visitor information and inquiries
4. **Email Notifications** - Alert your team of new demo requests and inquiries
5. **Analytics Endpoints** - Query visitor data and engagement metrics

## Prerequisites

- Node.js 18+ (already on Render)
- Supabase account with project created
- Gmail account (or other email service) for notifications

## Installation

1. **Clone the repository and add backend files:**
   ```bash
   git clone https://github.com/SAMUDRASHAAN/HealthOS-Website
   cd HealthOS-Website
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in the following:

   ```bash
   # Your Supabase credentials
   SUPABASE_URL=https://hfaryhdnwhwvsiootewc.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_avRJJGqM1ikliXbdzkzymA_S_w-nf0r

   # Email settings (Gmail example)
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   TEAM_EMAIL=team@healthos.com
   ```

## Setting Up Gmail for Email Notifications

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Create an "App Password" for Gmail
4. Use that app-specific password in the `.env` file

## API Endpoints

### Health Check
```
GET /api/health
Response: { status: "ok", timestamp: "..." }
```

### Demo Request
```
POST /api/demo-request
Body: {
  "name": "string",
  "email": "string",
  "phone": "string",
  "company": "string (optional)",
  "message": "string (optional)",
  "requestedDate": "ISO date (optional)"
}
```

### Track Visitor
```
POST /api/track-visitor
Body: {
  "page": "string",
  "referrer": "string",
  "userAgent": "string",
  "timestamp": "ISO date"
}
```

### Get Visitor Analytics
```
GET /api/analytics/visitors
Response: { 
  "success": true,
  "totalVisitors": 0,
  "pageViews": 0,
  "topPages": [],
  "data": []
}
```

### Get All Demo Requests
```
GET /api/demo-requests
Response: { 
  "success": true,
  "demoRequests": []
}
```

### Contact Form
```
POST /api/contact
Body: {
  "name": "string",
  "email": "string",
  "subject": "string (optional)",
  "message": "string"
}
```

## Running Locally

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Deploying to Render

1. Update your `package.json` start command if needed
2. In Render dashboard, set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `EMAIL_USER`
   - `EMAIL_PASSWORD`
   - `TEAM_EMAIL`
   - `NODE_ENV=production`

3. Push to GitHub and Render will auto-deploy

## Database Schema (To Be Created in Supabase)

### demo_requests table
```sql
CREATE TABLE demo_requests (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT,
  message TEXT,
  requested_date TIMESTAMP,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### visitors table
```sql
CREATE TABLE visitors (
  id BIGSERIAL PRIMARY KEY,
  page TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### contacts table
```sql
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Next Steps

1. Create the three tables in Supabase (SQL provided above)
2. Update the backend code to uncomment the Supabase client lines
3. Test each endpoint with Postman or curl
4. Add visitor tracking script to your frontend HTML
5. Integrate demo request form to send to `/api/demo-request`

## Troubleshooting

**Email not sending:**
- Check that 2FA is enabled on Gmail
- Verify you're using an App-specific password, not your regular password
- Check TEAM_EMAIL is set in .env

**Supabase connection fails:**
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check that your Supabase project is running
- Ensure tables are created in Supabase

**CORS errors on frontend:**
- Backend already has CORS enabled for all origins
- If issues persist, update CORS configuration in server.js

## Support

For issues or questions, check the HealthOS project docs or contact the team.
