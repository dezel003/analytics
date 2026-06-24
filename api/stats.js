// GET /api/stats?key=...&days=7 — aggregated analytics as JSON (password-gated).
const { db } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = new URL(req.url, 'http://localhost');
  const key = url.searchParams.get('key') || '';
  const expected = process.env.DASHBOARD_PASSWORD || '';
  if (!expected || key !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const days = Math.max(1, Math.min(parseInt(url.searchParams.get('days') || '7', 10), 365));
  const since = `${days} days`;

  try {
    const sql = db();

    // Per-session duration: sum the gaps captured by heartbeat/exit events.
    const [totals, topPages, geoRows, devices, browsers, oses, referrers, daily, durations] =
      await Promise.all([
        sql`select count(distinct session_id)::int as visitors,
                   count(*) filter (where type = 'pageview')::int as pageviews
            from events where ts > now() - ${since}::interval`,
        sql`select path,
                   count(*) filter (where type = 'pageview')::int as views,
                   round(avg(duration_ms) filter (where duration_ms is not null))::int as avg_ms
            from events where ts > now() - ${since}::interval
            group by path order by views desc limit 20`,
        sql`select coalesce(country,'?') as country, coalesce(city,'?') as city,
                   count(distinct session_id)::int as visitors
            from events where ts > now() - ${since}::interval
            group by country, city order by visitors desc limit 20`,
        sql`select coalesce(device,'?') as k, count(distinct session_id)::int as v
            from events where ts > now() - ${since}::interval group by device order by v desc`,
        sql`select coalesce(browser,'?') as k, count(distinct session_id)::int as v
            from events where ts > now() - ${since}::interval group by browser order by v desc`,
        sql`select coalesce(os,'?') as k, count(distinct session_id)::int as v
            from events where ts > now() - ${since}::interval group by os order by v desc`,
        sql`select coalesce(nullif(referrer,''),'(direct)') as referrer,
                   count(distinct session_id)::int as visitors
            from events where ts > now() - ${since}::interval and type = 'pageview'
            group by referrer order by visitors desc limit 20`,
        sql`select to_char(date_trunc('day', ts), 'YYYY-MM-DD') as day,
                   count(distinct session_id)::int as visitors,
                   count(*) filter (where type='pageview')::int as pageviews
            from events where ts > now() - ${since}::interval
            group by day order by day`,
        // Avg session length: per session, max(duration_ms) approximates time engaged.
        sql`select round(avg(s))::int as avg_session_ms from (
               select session_id, max(duration_ms) as s
               from events where ts > now() - ${since}::interval and duration_ms is not null
               group by session_id) t`,
      ]);

    return res.status(200).json({
      range_days: days,
      totals: totals[0] || { visitors: 0, pageviews: 0 },
      avg_session_ms: (durations[0] && durations[0].avg_session_ms) || 0,
      top_pages: topPages,
      geo: geoRows,
      devices,
      browsers,
      os: oses,
      referrers,
      daily,
    });
  } catch (err) {
    console.error('stats error', err);
    return res.status(500).json({ error: 'server' });
  }
};
