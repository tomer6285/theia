import streamProxy from '../../services/edge-proxy/src/worker';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function streamProxyPlugin(): Plugin {
  return {
    name: 'stream-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const controller = new AbortController();
        res.on('close', () => controller.abort());
        try {
          const requestUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost:3000'}`);
          requestUrl.pathname = '/api/proxy';
          const request = new Request(requestUrl, {
            method: req.method || 'GET',
            headers: Object.fromEntries(Object.entries(req.headers).filter((entry): entry is [string, string] =>
              typeof entry[1] === 'string')),
            signal: controller.signal,
          });
          const response = await streamProxy.fetch(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          if (response.body) {
            const { Readable } = await import('node:stream');
            const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
            body.on('error', () => res.destroy());
            body.pipe(res);
          } else res.end();
        } catch {
          if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy request failed' }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { rollupOptions: { output: { manualChunks: (id) => id.includes('/hls.js/') ? 'hls' : undefined } } },
  resolve: {
    alias: {
      '@theia/core': path.resolve(__dirname, '../../packages/core/src'),
      '@theia/player': path.resolve(__dirname, '../../packages/player/src'),
      '@theia/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  plugins: [react(), streamProxyPlugin()],
  server: {
    port: 3000,
    host: '127.0.0.1',
  },
});
