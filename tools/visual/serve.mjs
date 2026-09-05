import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/**
 * Static server with an SPA fallback.
 *
 * `web.output` is "single", so every unknown path has to serve index.html — exactly what a host
 * has to be configured to do in production. A plain file server 404s on /e/some-event, which
 * would make the harness test nothing but the index route.
 *
 * Two robustness details, both learned the hard way: the shell is read once at startup rather
 * than re-opened per request (a rebuild mid-run otherwise makes it vanish), and stream errors
 * are answered rather than thrown — an unhandled 'error' event takes down the whole process and
 * surfaces as a confusing route failure instead of a server failure.
 */
export const serve = (root, port = 0) => {
  const shellPath = join(root, 'index.html');
  if (!existsSync(shellPath)) {
    throw new Error(`No ${shellPath}. Run the web build before capturing.`);
  }
  const shell = readFileSync(shellPath);

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const file = join(root, normalize(decodeURIComponent(url.pathname)));

      const isFile = file.startsWith(root) && existsSync(file) && !statSync(file).isDirectory();
      if (!isFile) {
        res.writeHead(200, { 'content-type': TYPES['.html'] });
        res.end(shell);
        return;
      }

      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      const stream = createReadStream(file);
      stream.on('error', () => {
        res.end();
      });
      stream.pipe(res);
    });
    server.listen(port, '127.0.0.1', () =>
      resolve({ port: server.address().port, close: () => new Promise((r) => server.close(r)) }));
  });
};
