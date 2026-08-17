# HealthOS Website

A full-stack marketing website for HealthOS — animated, motion-driven frontend
plus a real Express + SQLite backend for capturing demo requests and contact
form leads.

## What's inside

```
healthos-website/
├── server.js           # Express app — serves the site + API
├── db.js                # SQLite setup (better-sqlite3, zero external DB needed)
├── routes/contact.js    # POST /api/contact, GET /api/leads (admin)
├── public/index.html    # The entire frontend — single self-contained file
├── package.json
└── healthos.db          # created automatically on first run
```

The frontend is one deliberately self-contained HTML file (inline CSS + JS,
no build step) so it is trivial to preview, host anywhere, or hand to a
designer to theme further. It includes:

- An animated hero network graph (SVG) showing Hospital / Pharmacy / Lab /
  Patient / Bank nodes connected by live traveling data packets — the
  platform's core metaphor, not a decorative gradient.
- A hand-drawn ECG "pulse line" that draws itself in as you scroll between
  sections.
- Scroll-triggered reveals (IntersectionObserver, no external animation
  library required).
- A stat counter that animates up on scroll.
- Fully responsive down to mobile, with a working hamburger menu.
- `prefers-reduced-motion` respected — all animation is disabled for users
  who've asked their OS to reduce motion.
- Visible keyboard focus states on every interactive element.

## Running it locally

```bash
npm install
npm start
```

Then open **http://localhost:4000** — the same server serves both the
website and the API, so the contact form works immediately with no extra
configuration.

## Environment variables (optional)

Create a `.env` file (not required to run locally, but recommended for
production):

```
PORT=4000
ALLOWED_ORIGIN=https://your-production-domain.com
ADMIN_API_KEY=choose-a-long-random-string
```

`ADMIN_API_KEY` protects the `GET /api/leads` endpoint. Without it, that
route is disabled entirely (returns 401 to everyone) — it will not work
until you set a key.

## Viewing submitted leads

```bash
curl -H "x-admin-key: your-key-here" http://localhost:4000/api/leads
```

Returns the most recent 200 submissions as JSON. For real production use,
swap this for a proper admin dashboard or wire it into a CRM — this
endpoint is intentionally minimal.

## Deploying

This is one Node process serving both the static site and the API, so it
deploys as a single unit. It runs cleanly on:

- **Render / Railway / Fly.io** — push the repo, set the start command to
  `npm start`, add your environment variables.
- **A VPS** — `npm install --production && npm start`, put it behind Nginx
  or Caddy with a TLS certificate, and use a process manager like `pm2` to
  keep it running.
- **AWS EC2 / Lightsail** — matches the same AWS Mumbai (ap-south-1) region
  used across the rest of the HealthOS platform, keeping all data
  in-country.

If you outgrow SQLite (heavy traffic, multiple server instances), swap
`db.js` for a PostgreSQL connection — the query surface is small enough
that this is a same-day change.

## Extending the frontend

Because everything lives in one file, the easiest way to grow this into a
multi-page site is:

1. Duplicate `public/index.html` into `public/security.html`,
   `public/pricing.html`, etc.
2. Keep the shared `<style>` block identical across pages so the design
   language stays consistent — consider extracting it to `public/styles.css`
   once you have 3+ pages.
3. Update `server.js`'s catch-all route if you add client-side routing;
   right now every unmatched path falls back to `index.html`.

## Notes on the copy

The statistics and figures in the "problem" section reflect the numbers
already used across the HealthOS pitch deck and DPR (paper records, out-of-
pocket spend, duplicate diagnostics). Update `data-count` attributes in
`public/index.html` if these are refined with sourced figures before
public launch — they are currently illustrative marketing figures, not
independently cited statistics.
