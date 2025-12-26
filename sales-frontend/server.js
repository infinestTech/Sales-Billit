require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3020;
const root = __dirname;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);

  // Dev-friendly: never cache static assets so UI/routing changes reflect immediately
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
  };
  
  // Handle dynamic environment config
  if (urlPath === '/src/config/env.js') {
    const configContent = `// Environment configuration for sales frontend
// This file provides environment variables globally

window.ENV_CONFIG = {
  SALES_API_URL: '${process.env.VITE_SALES_API_URL || 'http://127.0.0.1:9000'}',
  AUTH_API_URL: '${process.env.VITE_AUTH_API_URL || 'http://127.0.0.1:7000'}',
  WHATSAPP_WEB_URL: '${process.env.VITE_WHATSAPP_WEB_URL || 'https://web.whatsapp.com'}'
};

// For backward compatibility, also set SALES_URL
window.SALES_URL = window.ENV_CONFIG.SALES_API_URL;

console.log('🔧 Environment config loaded:', window.ENV_CONFIG);`;

    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', ...noCacheHeaders });
    return res.end(configContent);
  }
  
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);

  // Prevent path traversal
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, noCacheHeaders);
      return res.end('Not found');
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, noCacheHeaders);
        return res.end('Server error');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', ...noCacheHeaders });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`JSX demo server running on http://localhost:${PORT}`);
});
