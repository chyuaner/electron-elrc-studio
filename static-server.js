const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

/**
 * Serve a static directory on 127.0.0.1 (required for Next.js export absolute paths).
 * @param {string} root
 * @returns {Promise<{ server: import('http').Server, port: number, url: string, close: () => Promise<void> }>}
 */
function startStaticServer(root) {
  const rootResolved = path.resolve(root);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) {
          pathname += 'index.html';
        }

        const filePath = path.normalize(path.join(rootResolved, pathname));
        if (!filePath.startsWith(rootResolved)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.stat(filePath, (err, stat) => {
          if (err) {
            const fallback = path.join(rootResolved, '404.html');
            fs.readFile(fallback, (fbErr, data) => {
              if (fbErr) {
                res.writeHead(404);
                res.end('Not Found');
                return;
              }
              res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(data);
            });
            return;
          }

          if (stat.isDirectory()) {
            const indexPath = path.join(filePath, 'index.html');
            fs.readFile(indexPath, (indexErr, data) => {
              if (indexErr) {
                res.writeHead(404);
                res.end('Not Found');
                return;
              }
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(data);
            });
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
              res.writeHead(500);
              res.end('Internal Server Error');
              return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
          });
        });
      } catch {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}/`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((closeErr) => (closeErr ? closeReject(closeErr) : closeResolve()));
          }),
      });
    });
  });
}

module.exports = { startStaticServer };
