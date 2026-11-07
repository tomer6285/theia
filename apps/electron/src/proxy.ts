import { createServer, Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import streamProxy from '../../../services/edge-proxy/src/worker';

/** A private, per-launch endpoint; never listen on the LAN. */
export async function startDesktopProxy(): Promise<{ url: string; close: () => void }> {
  const route = `/api/proxy/${randomBytes(32).toString('hex')}`;
  const server: Server = createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Proxy unavailable');
      const url = new URL(req.url || '/', `http://127.0.0.1:${address.port}`);
      if (url.pathname !== route) { res.writeHead(404).end(); return; }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
      }
      const response = await streamProxy.fetch(new Request(url, {
        method: req.method, headers, signal: controller.signal,
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
        body.on('error', () => res.destroy());
        body.pipe(res);
      } else res.end();
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proxy unavailable');
  return {
    url: `http://127.0.0.1:${address.port}${route}`,
    close: () => { server.close(); server.closeAllConnections(); },
  };
}
