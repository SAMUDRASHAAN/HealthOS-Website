# HealthOS Website Backend

Production-ready Node.js/Express backend for the HealthOS website. Handles demo requests, visitor tracking, and lead generation with Supabase database integration.

## Features

✨ **Core Features:**
- 📅 Demo Request Management - Capture and track booking requests
- 👥 Visitor Tracking - Log and analyze website traffic
- 📬 Contact Form - Store inquiries and feedback
- 📊 Analytics Endpoints - Query visitor data in real-time
- 📧 Email Notifications - Automatic alerts for demo requests

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.18
- **Database:** Supabase (PostgreSQL)
- **Email:** Nodemailer + Gmail SMTP
- **Deployment:** Render

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Supabase account with project created
- Gmail account (for email notifications)

### Installation

1. **Clone or download the backend files to your repo:**
   ```bash
   git clone https://github.com/SAMUDRASHAAN/HealthOS-Website
   cd HealthOS-Website
   npm install
   ```

2. **Create `.env` file with your credentials:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and fill in your details:**
   ```env
   PORT=5000
   NODE_ENV=production
   
   # Your Supabase credentials
   SUPABASE_URL=https://hfaryhdnwhwvsiootewc.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_avRJJGqM1ikliXbdzkzymA_S_w-nf0r
   
   # Your email configuration
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   TEAM_EMAIL=team@healthos.com
   ```

### Gmail Setup (for Email Notifications)

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Generate "App Password" for Gmail
4. Use that password in `.env` as `EMAIL_PASSWORD`

### Running Locally

```bash
npm run dev
```

Server starts on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /api/health
```
Returns: `{ status: "ok", timestamp: "..." }`

### Demo Request (POST)
```
POST /api/demo-request
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "Acme Hospital",
  "message": "Interested in scheduling a demo",
  "requestedDate": "2024-12-25"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Demo request received. We will contact you soon!",
  "demoRequest": { ... }
}
```

### Track Visitor (POST)
```
POST /api/track-visitor
Content-Type: application/json

{
  "page": "/pricing",
  "referrer": "google.com",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2024-12-20T10:30:00Z"
}
```

### Get Visitor Analytics (GET)
```
GET /api/analytics/visitors
```

Returns visitor counts, top pages, and recent activity.

### Get Demo Requests (GET)
```
GET /api/demo-requests
```

Returns all demo requests (admin endpoint).

### Contact Form (POST)
```
POST /api/contact
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Question about pricing",
  "message": "I have a question..."
}
```

## Frontend Integration

### 1. Add the API Client Script

```html
<script src="healthos-api-client.js"></script>
<script>
  HealthOSAPI.init({
    apiUrl: 'https://your-render-url.onrender.com'
  });
</script>
```

### 2. Use in Your Forms

```html
<form onsubmit="submitDemo(event)">
  <input type="text" id="name" placeholder="Your Name" required>
  <input type="email" id="email" placeholder="Your Email" required>
  <input type="tel" id="phone" placeholder="Your Phone" required>
  <button type="submit">Request Demo</button>
</form>

<script>
  async function submitDemo(event) {
    event.preventDefault();
    
    const result = await HealthOSAPI.submitDemoRequest({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
    });
    
    if (result.success) {
      alert('Demo request submitted!');
    }
  }
</script>
```

### 3. Track Visitors (Automatic)

Visitor tracking is automatic when you initialize the API client:

```html
<script src="healthos-api-client.js"></script>
<script>
  HealthOSAPI.init({
    apiUrl: 'https://your-render-url.onrender.com'
  });
  // Visitor is automatically tracked on page load
</script>
```

## Deployment to Render

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Add HealthOS backend"
git push origin main
```

### 2. Deploy to Render

1. Go to https://render.com
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Set build command: `npm install`
5. Set start command: `node server.js`
6. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `EMAIL_USER`
   - `EMAIL_PASSWORD`
   - `TEAM_EMAIL`
   - `NODE_ENV=production`

7. Deploy

Your backend will be live at: `https://your-service.onrender.com`

## Database Schema

### demo_requests
```sql
{
  id: BIGINT PRIMARY KEY,
  name: TEXT,
  email: TEXT,
  phone: TEXT,
  company: TEXT,
  message: TEXT,
  requested_date: TIMESTAMP,
  status: TEXT,
  created_at: TIMESTAMP
}
```

### visitors
```sql
{
  id: BIGINT PRIMARY KEY,
  page: TEXT,
  referrer: TEXT,
  user_agent: TEXT,
  ip: TEXT,
  timestamp: TIMESTAMP
}
```

### contacts
```sql
{
  id: BIGINT PRIMARY KEY,
  name: TEXT,
  email: TEXT,
  subject: TEXT,
  message: TEXT,
  created_at: TIMESTAMP
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | Environment (development/production) |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase public/anon key |
| `EMAIL_SERVICE` | No | Email provider (default: gmail) |
| `EMAIL_USER` | Yes | Email address for sending |
| `EMAIL_PASSWORD` | Yes | Email app password |
| `TEAM_EMAIL` | Yes | Email to receive notifications |

## Error Handling

All endpoints return consistent JSON responses:

**Success:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Technical error details"
}
```

## Troubleshooting

### Email not sending
- ✅ Enable 2FA on Gmail
- ✅ Use app-specific password (not regular password)
- ✅ Check TEAM_EMAIL is set
- ✅ Check firewall/antivirus allows SMTP

### Supabase connection fails
- ✅ Verify URL and key are correct
- ✅ Check project is active in Supabase dashboard
- ✅ Ensure tables exist (demo_requests, visitors, contacts)
- ✅ Check CORS settings in Supabase

### CORS errors
- ✅ Backend has CORS enabled for all origins
- ✅ Check your frontend is sending requests to correct API URL
- ✅ Verify API URL doesn't have trailing slash

### Forms not submitting
- ✅ Check browser console for errors
- ✅ Verify API URL in HealthOSAPI.init()
- ✅ Check network tab for API requests
- ✅ Ensure backend is running

## Performance & Scaling

- **Indexing:** All tables have indexes on frequently queried columns
- **Rate Limiting:** Consider adding rate limiting for production
- **Caching:** API responses can be cached at CDN level
- **Pagination:** Implement pagination for large datasets

## Security Considerations

- ✅ Input validation on all endpoints
- ✅ Email format validation
- ✅ Environment variables for secrets
- ✅ CORS enabled
- ✅ SQL injection prevention (Supabase client)

**To Improve:**
- Add API key authentication for admin endpoints
- Add rate limiting middleware
- Add input sanitization for HTML/XSS
- Use HTTPS only (handled by Render)

## Files Structure

```
├── server.js                      # Main Express server
├── healthos-api-client.js        # Frontend JavaScript client
├── package.json                   # Dependencies
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── README.md                      # This file
├── BACKEND_SETUP.md              # Detailed setup guide
└── api-integration-example.html  # Complete integration example
```

## Support & Help

For issues or questions:
1. Check the troubleshooting section above
2. Review API response messages
3. Check browser console for errors
4. Check server logs: `npm run dev`

## Next Steps

1. ✅ Backend deployed to Render
2. ✅ Database tables created in Supabase
3. ⬜ Add email configuration
4. ⬜ Integrate forms in frontend
5. ⬜ Test with sample requests
6. ⬜ Set up analytics dashboard

## License

MIT - See your project for details
