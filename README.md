# devonte.design analytics

First-party, cookieless web analytics: a tracker snippet, a serverless collector,
Neon Postgres storage, and a password-gated dashboard.

## Pieces
| File | Role |
|------|------|
| `public/track.js` | Tracker snippet loaded by the site. Sends pageview / heartbeat / exit. |
| `api/collect.js` | `POST /api/collect` — validates + stores each event. |
| `api/stats.js` | `GET /api/stats?key=…&days=7` — aggregated JSON (password-gated). |
| `api/_lib.js` | Shared helpers: DB, cookieless session hash, geo, UA parsing. |
| `public/dashboard.html` | Dashboard UI (`/dashboard.html?key=…`). |
| `schema.sql` | Database table + indexes. |

## What it captures
- Pages viewed + **time on page** (heartbeats every 15s + exit beacon).
- Approximate **geo** (country/region/city) from Vercel edge headers — no IP stored.
- **Device / browser / OS** from the user-agent.
- **Referrer / source**.
- **Sessions** via a cookieless daily hash `sha256(ip + ua + day + salt)`.

Respects `navigator.doNotTrack`. No cookies, so no consent banner required.

## Setup
1. **Database** — create a free project at [neon.tech](https://neon.tech), open the
   SQL editor, and run the contents of `schema.sql`.
2. **Env vars** — copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` (Neon pooled connection string)
   - `TRACK_SALT` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `DASHBOARD_PASSWORD`
3. **Install** — `npm install`.

## Test locally
```
npm run dev          # http://localhost:3001
```
- Load a page, then watch the Network panel: a `pageview` POST to `/api/collect`,
  followed by `heartbeat`s, then an `exit` on tab hide. (Geo will be empty locally —
  those headers only exist on Vercel.)
- Open `http://localhost:3001/dashboard.html?key=YOUR_DASHBOARD_PASSWORD`.

## Deploy
1. Push this repo and import it into Vercel (or `vercel` CLI).
2. Add the three env vars in **Vercel → Project → Settings → Environment Variables**.
3. Deploy. The collector lives at `https://devonte.design/api/collect`, the dashboard
   at `https://devonte.design/dashboard.html?key=…`.

## Add the tracker to the live site
Put this one line in the site's `<head>` (Vercel project / framework head config):
```html
<script defer src="https://devonte.design/track.js"></script>
```

## Notes / later
- Exclude your own visits: add an IP/localStorage opt-out check in `track.js`.
- Bot filtering and a retention-cleanup cron can be added in `api/`.
