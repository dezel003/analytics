// Shared helpers for the analytics serverless functions.
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

let _sql;
// Lazily create a single SQL client per warm lambda.
function db() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// Cookieless, daily-rotating session id. Cannot be reversed to an identity and
// does not link a visitor across days.
function sessionId(ip, ua) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const salt = process.env.TRACK_SALT || 'dev-salt';
  return crypto
    .createHash('sha256')
    .update(`${ip}|${ua}|${day}|${salt}`)
    .digest('hex')
    .slice(0, 32);
}

// Best-effort client IP from proxy headers (used only for hashing, never stored).
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '';
}

// Geo from Vercel edge headers (no external lookup). Values may be URL-encoded.
function geo(req) {
  const dec = (v) => {
    if (!v) return null;
    try { return decodeURIComponent(String(v)); } catch { return String(v); }
  };
  return {
    country: dec(req.headers['x-vercel-ip-country']),
    region: dec(req.headers['x-vercel-ip-country-region']),
    city: dec(req.headers['x-vercel-ip-city']),
  };
}

// Tiny user-agent parser — enough for device/browser/os buckets without a dep.
function parseUA(ua = '') {
  const u = ua.toLowerCase();
  let device = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))/.test(u)) device = 'tablet';
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(u)) device = 'mobile';

  let browser = 'other';
  if (/edg\//.test(u)) browser = 'Edge';
  else if (/opr\/|opera/.test(u)) browser = 'Opera';
  else if (/chrome|crios/.test(u)) browser = 'Chrome';
  else if (/firefox|fxios/.test(u)) browser = 'Firefox';
  else if (/safari/.test(u)) browser = 'Safari';

  let os = 'other';
  if (/windows/.test(u)) os = 'Windows';
  else if (/iphone|ipad|ipod|ios/.test(u)) os = 'iOS';
  else if (/mac os x|macintosh/.test(u)) os = 'macOS';
  else if (/android/.test(u)) os = 'Android';
  else if (/linux/.test(u)) os = 'Linux';

  return { device, browser, os };
}

// Read + JSON-parse a request body across runtimes (req.body may be pre-parsed).
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

module.exports = { db, sessionId, clientIp, geo, parseUA, readJson };
