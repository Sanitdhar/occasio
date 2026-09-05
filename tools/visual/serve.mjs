import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * Static server with an SPA fallback.
 *
 * `web.output` is "single", so every unknown path has to serve index.html — exactly what a
 * host has to be configured to do in production. A plain file server 404s on /e/some-event,
 * which would make the whole harness test nothing but the index route.
 */
export const serve = (root, port = 0) =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let file = join(root, normalize(decodeURIComponent(url.pathname)));
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1', () =>
      resolve({ port: server.address().port, close: () => new Promise((r) => server.close(r)) }),
    );
  });
