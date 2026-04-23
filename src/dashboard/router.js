'use strict';

const path = require('path');
const fs = require('fs');

function dashboardRouter(adapter, mountPath) {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const mp = mountPath.replace(/\/$/, '');

  return async function dashboardHandler(req, res) {
    const subpath = req.path.slice(mp.length) || '/';

    // GET / → serve index.html
    if (req.method === 'GET' && (subpath === '/' || subpath === '')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(fs.readFileSync(htmlPath, 'utf8'));
    }

    // GET /api/endpoints
    if (req.method === 'GET' && subpath === '/api/endpoints') {
      try {
        const endpoints = await adapter.getAllEndpoints();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(endpoints));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // GET /api/history/:endpoint (base64-encoded, possibly URL-encoded path)
    const histMatch = subpath.match(/^\/api\/history\/([^/]+)$/);
    if (req.method === 'GET' && histMatch) {
      try {
        const raw = decodeURIComponent(histMatch[1]);
        const endpointPath = Buffer.from(raw, 'base64').toString('utf8');
        process.stdout.write('[router] getHistory: raw=' + JSON.stringify(histMatch[1]) + ' decoded=' + JSON.stringify(raw) + ' path=' + JSON.stringify(endpointPath) + '\n');
        const history = await adapter.getHistory(endpointPath);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(history));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // GET /api/diff/:endpoint (base64-encoded, possibly URL-encoded path)
    const diffMatch = subpath.match(/^\/api\/diff\/([^/]+)$/);
    if (req.method === 'GET' && diffMatch) {
      try {
        const raw = decodeURIComponent(diffMatch[1]);
        const endpointPath = Buffer.from(raw, 'base64').toString('utf8');
        const latestDiff = await adapter.getLatestDiff(endpointPath);
        res.setHeader('Content-Type', 'application/json');
        if (latestDiff) {
          return res.end(JSON.stringify({
            diff: JSON.parse(latestDiff.diff),
            detected_at: latestDiff.detected_at,
          }));
        }
        return res.end(JSON.stringify({ diff: null }));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    res.statusCode = 404;
    res.end('Not found');
  };
}

module.exports = dashboardRouter;
