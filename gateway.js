/**
 * gateway.js — Unified Reverse Proxy Gateway for MRF Campus Maintenance System
 * Runs on Port 80 (http://localhost/)
 *
 * Routing Table:
 *   http://localhost/issue       → Issue Portal       (http://localhost:5174/issue/)
 *   http://localhost/admin       → Admin Portal       (http://localhost:5175/admin/)
 *   http://localhost/superadmin  → Super Admin Portal (http://localhost:5177/superadmin/)
 *   http://localhost/api         → Backend REST API   (http://localhost:5000/api)
 *   http://localhost/            → Redirects to /issue/
 */

import http from 'http';
import net from 'net';

const PORT = process.env.PORT || 80;

const ROUTES = [
  { prefix: '/issue', targetPort: 5174, targetHost: 'localhost' },
  { prefix: '/api', targetPort: 5000, targetHost: 'localhost' },
];

function findRoute(url) {
  for (const route of ROUTES) {
    if (url === route.prefix || url.startsWith(route.prefix + '/') || url.startsWith(route.prefix + '?')) {
      return route;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // Root path handler
  if (url === '/' || url === '') {
    res.writeHead(302, { Location: '/issue/' });
    res.end();
    return;
  }

  // Handle direct portal shortcuts
  if (url === '/admin' || url === '/admin/' || url.startsWith('/admin?')) {
    res.writeHead(302, { Location: '/issue/admin' });
    res.end();
    return;
  }

  if (url === '/superadmin' || url === '/superadmin/' || url.startsWith('/superadmin?')) {
    res.writeHead(302, { Location: '/issue/super-admin' });
    res.end();
    return;
  }

  // Exact prefix redirect without trailing slash for portal roots
  for (const route of ROUTES) {
    if (route.prefix !== '/api' && (url === route.prefix || url === `${route.prefix}?`)) {
      res.writeHead(301, { Location: `${route.prefix}/` });
      res.end();
      return;
    }
  }

  const route = findRoute(url);

  if (!route) {
    // If not matched, check if Referer has a portal prefix
    const referer = req.headers['referer'] || '';
    let fallbackRoute = null;
    for (const r of ROUTES) {
      if (referer.includes(r.prefix)) {
        fallbackRoute = r;
        break;
      }
    }

    if (fallbackRoute) {
      proxyHttpRequest(req, res, fallbackRoute.targetHost, fallbackRoute.targetPort);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>MRF Portal Gateway</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; text-align: center; }
          .card { max-width: 600px; margin: 40px auto; background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h1 { font-size: 24px; color: #38bdf8; margin-bottom: 20px; }
          .links { display: flex; flex-direction: column; gap: 12px; margin-top: 24px; }
          a { display: block; padding: 12px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; transition: background 0.2s; }
          a:hover { background: #1d4ed8; }
          .api { background: #059669; }
          .api:hover { background: #047857; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>MRF Portal Gateway</h1>
          <p>The requested path was not found. Please choose a portal:</p>
          <div class="links">
            <a href="/issue/">📋 Issue Portal (/issue)</a>
            <a href="/admin/">🛡️ Admin Portal (/admin)</a>
            <a href="/superadmin/">👑 Super Admin Portal (/superadmin)</a>
            <a href="/api/tickets" class="api">🔌 Backend API (/api/tickets)</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  proxyHttpRequest(req, res, route.targetHost, route.targetPort);
});

function proxyHttpRequest(req, res, targetHost, targetPort) {
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${targetHost}:${targetPort}`,
      'x-forwarded-host': req.headers.host || 'localhost',
      'x-forwarded-proto': 'http',
      'x-forwarded-for': req.socket.remoteAddress,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Gateway Proxy Error] target ${targetHost}:${targetPort} - ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Bad Gateway',
        message: `Unable to connect to service on ${targetHost}:${targetPort}`,
        service: req.url,
      }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

// WebSocket / HMR Proxy Support
server.on('upgrade', (req, socket, head) => {
  const route = findRoute(req.url);
  const targetHost = route ? route.targetHost : 'localhost';
  const targetPort = route ? route.targetPort : 5174;

  const targetSocket = net.connect(targetPort, targetHost, () => {
    // Send standard HTTP upgrade request to target server
    let rawHeaders = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      let key = req.rawHeaders[i];
      let val = req.rawHeaders[i + 1];
      if (key.toLowerCase() === 'host') {
        val = `${targetHost}:${targetPort}`;
      }
      rawHeaders += `${key}: ${val}\r\n`;
    }
    rawHeaders += '\r\n';

    targetSocket.write(rawHeaders);
    if (head && head.length > 0) {
      targetSocket.write(head);
    }

    targetSocket.pipe(socket);
    socket.pipe(targetSocket);
  });

  targetSocket.on('error', (err) => {
    console.error(`[Gateway WS Error] ${err.message}`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    targetSocket.destroy();
  });
});

server.on('error', (err) => {
  if (err.code === 'EACCES') {
    console.error(`[Gateway Error] Port ${PORT} requires administrative privileges on Windows.`);
  } else if (err.code === 'EADDRINUSE') {
    console.error(`[Gateway Error] Port ${PORT} is already in use by another process.`);
  } else {
    console.error('[Gateway Error]', err);
  }
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MRF Gateway Running on http://localhost:${PORT}`);
  console.log(`==================================================`);
  console.log(`  📋 Issue Portal       → http://localhost/issue/`);
  console.log(`  🛡️ Admin Portal       → http://localhost/admin/`);
  console.log(`  👑 Super Admin Portal → http://localhost/superadmin/`);
  console.log(`  🔌 Backend REST API   → http://localhost/api/`);
  console.log(`==================================================\n`);
});
