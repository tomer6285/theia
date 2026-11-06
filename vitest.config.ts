import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@theia/core': path.resolve('packages/core/src'),
      '@theia/ui': path.resolve('packages/ui/src'),
      '@theia/player': path.resolve('packages/player/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: { include: ['packages/*/test/**/*.test.{ts,tsx}', 'services/*/test/**/*.test.ts', 'apps/web/test/**/*.test.tsx'], restoreMocks: true },
});
