import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import proxy from './worker.mjs';

const webRoot = fileURLToPath(new URL('./public', import.meta.url));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
const proxyOptions = {
  ALLOWED_HOSTS: process.env.ALLOWED_HOSTS,
  relativePlaylistUrls: true,
};

createServer(async (req, res) => {
  const { method } = req;
  if (!req.url?.startsWith('/')) {
    res.writeHead(400).end();
    return;
  }
  const url = new URL('http://localhost:3000' + req.url);
  if (url.pathname === '/api/proxy') {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }).end();
      return;
    }
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    try {
      const response = await proxy.fetch(new Request(url, {
        method,
        headers: req.headers,
        signal: controller.signal,
      }), proxyOptions);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(webRoot, '.' + pathname);
    const info = file.startsWith(webRoot + sep) ? await stat(file) : undefined;
    if (!info?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
    });
    if (method === 'HEAD') res.end();
    else await pipeline(createReadStream(file), res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400);
    res.end();
  }
}).listen(3000, '0.0.0.0');
