# Pushing HealthOS Backend to GitHub

Follow these steps to add the backend files to your GitHub repository.

## Step 1: Navigate to Your Repository

```bash
cd /path/to/HealthOS-Website
```

## Step 2: Copy Backend Files

Copy all the backend files to your repo root:

```bash
# Copy main server file
cp server.js .

# Copy package.json (merge with existing if you have one)
cp package.json .

# Copy environment example
cp .env.example .

# Copy frontend client
cp healthos-api-client.js .

# Copy documentation
cp README.md README_BACKEND.md
cp BACKEND_SETUP.md .

# Copy integration example
cp api-integration-example.html .

# Copy .gitignore (merge with existing)
cp .gitignore .
```

## Step 3: Install Dependencies

```bash
npm install
```

This will:
- Install all required packages (Express, Supabase, Nodemailer, etc.)
- Create `node_modules/` folder
- Create `package-lock.json`

## Step 4: Configure Environment

```bash
# Copy example to actual .env
cp .env.example .env

# Edit .env with your credentials
nano .env
# or use your favorite editor
```

**Important:** Never commit `.env` to GitHub (it's in .gitignore)

## Step 5: Commit to Git

```bash
# Add all files to staging
git add .

# Commit with a message
git commit -m "Add HealthOS backend API with Supabase integration

- Express.js server with demo requests, visitor tracking, and contact forms
- Supabase database integration (demo_requests, visitors, contacts tables)
- Nodemailer email notifications
- Frontend JavaScript API client
- Complete setup documentation and integration examples"

# Push to GitHub
git push origin main
```

## Step 6: Update Render Deployment

Your Render service will auto-detect changes and redeploy:

1. Go to Render Dashboard
2. Open your HealthOS-Website service
3. Watch "Deploys" section for automatic build

The deployment should:
- ✅ Download latest code
- ✅ Run `npm install`
- ✅ Start with `node server.js`
- ✅ Use environment variables from Render settings

## Step 7: Verify Deployment

Once Render finishes deploying:

```bash
# Test health endpoint
curl https://healthos-website-1.onrender.com/api/health

# Should return:
# {"status":"ok","timestamp":"2024-12-20T..."}
```

## Complete File Structure After Push

```
HealthOS-Website/
├── public/
│   ├── index.html
│   └── ... (your frontend files)
├── server.js                    ← NEW: Main backend
├── healthos-api-client.js      ← NEW: Frontend API client
├── package.json                 ← UPDATED: Added backend deps
├── package-lock.json            ← AUTO: Dependency lock
├── .env.example                 ← NEW: Environment template
├── .gitignore                   ← UPDATED: Node.js ignores
├── README.md                    ← UPDATED: Backend docs
├── README_BACKEND.md            ← NEW: Backend setup guide
├── BACKEND_SETUP.md             ← NEW: Detailed instructions
├── api-integration-example.html ← NEW: Integration example
├── node_modules/                ← AUTO: Ignored in git
└── ... (other existing files)
```

## Troubleshooting

### "Port already in use" error
- Render auto-assigns PORT - you don't set it manually
- If running locally, use: `npm run dev`

### "npm install fails"
- Delete `node_modules/` and `package-lock.json`
- Run `npm install` again
- Check internet connection

### "Git push rejected"
```bash
# Update local repo with remote changes
git pull origin main

# Resolve any conflicts
git add .
git commit -m "Merge conflicts"
git push origin main
```

### "Render still showing old code"
- Force refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Check Render deployment logs
- Redeploy manually in Render dashboard

## Next Steps After Deployment

1. **Configure Email Notifications:**
   - Set `EMAIL_USER` and `EMAIL_PASSWORD` in Render environment
   - Set `TEAM_EMAIL` for notifications

2. **Test Demo Request:**
   ```bash
   curl -X POST https://your-service.onrender.com/api/demo-request \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "phone": "1234567890"
     }'
   ```

3. **Integrate Frontend:**
   - Add `healthos-api-client.js` to your HTML
   - Update forms to use HealthOSAPI
   - Change API URL to your Render service URL

4. **Monitor Analytics:**
   ```bash
   curl https://your-service.onrender.com/api/analytics/visitors
   ```

## File Descriptions

| File | Purpose |
|------|---------|
| `server.js` | Main Express backend with all API endpoints |
| `healthos-api-client.js` | Frontend JavaScript client for calling API |
| `package.json` | Node.js dependencies (Express, Supabase, Nodemailer) |
| `.env.example` | Template for environment variables |
| `.gitignore` | Git ignore rules for Node.js |
| `README.md` | Backend documentation |
| `BACKEND_SETUP.md` | Detailed setup guide |
| `api-integration-example.html` | Complete working example |

## Support

If you have issues:
1. Check Render deployment logs
2. Check `.env` variables in Render settings
3. Test locally: `npm run dev`
4. Check browser console for frontend errors

Questions? Review the documentation or check the integration example!
