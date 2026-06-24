// POST /api/collect — ingests one tracking event.
const { db, sessionId, clientIp, geo, parseUA, readJson } = require('./_lib');

const TYPES = new Set(['pageview', 'heartbeat', 'exit']);

module.exports = async function handler(req, res) {
  // Tracker is loaded same-origin, but allow beacons regardless.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  try {
    const body = await readJson(req);
    const type = String(body.type || '');
    if (!TYPES.has(type)) return res.status(400).json({ error: 'type' });

    const path = String(body.path || '/').slice(0, 1024);
    const referrer = body.referrer ? String(body.referrer).slice(0, 1024) : null;
    const durationMs = Number.isFinite(body.duration_ms)
      ? Math.max(0, Math.min(body.duration_ms | 0, 6 * 60 * 60 * 1000)) // cap 6h
      : null;
    const screenW = Number.isFinite(body.screen_w) ? body.screen_w | 0 : null;
    const screenH = Number.isFinite(body.screen_h) ? body.screen_h | 0 : null;

    const ua = req.headers['user-agent'] || '';
    const sid = sessionId(clientIp(req), ua);
    const g = geo(req);
    const { device, browser, os } = parseUA(ua);

    const sql = db();
    await sql`
      insert into events
        (session_id, type, path, referrer, duration_ms,
         country, region, city, device, browser, os, screen_w, screen_h)
      values
        (${sid}, ${type}, ${path}, ${referrer}, ${durationMs},
         ${g.country}, ${g.region}, ${g.city}, ${device}, ${browser}, ${os},
         ${screenW}, ${screenH})
    `;

    return res.status(204).end();
  } catch (err) {
    console.error('collect error', err);
    return res.status(500).json({ error: 'server' });
  }
};
