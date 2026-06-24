const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3001;
const ROOT = __dirname;

// --- Minimal .env loader (no dependency) ---------------------------------
try {
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    });
  }
} catch (e) { /* ignore */ }

// --- Express-ish response adapter so the serverless handlers run locally --
function adapt(res) {
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (obj) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res;
}

// Lazy-load handlers so a missing DATABASE_URL doesn't crash static serving.
function loadHandler(name) {
  try { return require('./api/' + name); }
  catch (e) { return null; }
}
const apiRoutes = {
  '/api/collect': () => loadHandler('collect'),
  '/api/stats':   () => loadHandler('stats'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // API routes -> serverless handlers.
  if (apiRoutes[urlPath]) {
    const handler = apiRoutes[urlPath]();
    if (!handler) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end('{"error":"handler not loaded (run npm install?)"}');
    }
    return Promise.resolve(handler(req, adapt(res))).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end('{"error":"server"}');
    });
  }

  if (urlPath === '/') urlPath = '/index.html';

  // Serve tracker + dashboard from /public, fall back to project root.
  let filePath = path.join(ROOT, 'public', urlPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT, urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
