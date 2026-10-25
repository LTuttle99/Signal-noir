import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const production = process.argv.includes('--production');
const root = resolve(import.meta.dirname, '..', production ? 'dist' : '.');
const port = Number(process.env.PORT || 8020);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const publicDirectories = new Set(['site', 'tools', 'dashboards', ...(!production ? ['tests', 'server'] : [])]);
const publicFiles = new Set(['index.html', '404.html', 'connect.html', 'dashboards.html', 'getting-started.html', 'library.html', 'organization.html', 'settings.html', 'tailwind.css', 'signal-pages.css', 'signal-noir-icon.svg', 'manifest.webmanifest', 'service-worker.js']);
createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'connected_unavailable', message: 'Connected Mode requires a separately configured API. Local Mode is available.' }));
      return;
    }
    const relative = pathname.replace(/^\/+/, '') || 'index.html';
    const segments = relative.split('/');
    if (segments.some(part => part.startsWith('.') || part === '..') || (!publicFiles.has(relative) && !publicDirectories.has(segments[0])) || (segments[0] === 'server' && !/^server\/(worker\.js|lib\/[^/]+\.js|shared\/[^/]+\.js)$/.test(relative))) {
      response.writeHead(404).end(); return;
    }
    let path = resolve(root, relative);
    if (!path.startsWith(root + sep)) { response.writeHead(404).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(await readFile(resolve(root, '404.html')).catch(() => 'Not found'));
  }
}).listen(port, '127.0.0.1', () => console.log(`Signal Noir: http://127.0.0.1:${port} (${production ? 'production build' : 'development'})`));
