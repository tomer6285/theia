// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { TraktSettings } from '../src/components/TraktSettings';
import { initializeTrakt } from '../src/trakt';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete window.theiaElectron;
});

it('shows Connect Trakt in the desktop app without build variables', async () => {
  vi.stubEnv('VITE_TRAKT_CLIENT_ID', '');
  vi.stubEnv('VITE_TRAKT_DESKTOP_REDIRECT_URI', '');
  vi.stubGlobal('crypto', webcrypto);
  window.theiaElectron = {
    isElectron: true,
    platform: 'darwin',
    trakt: {
      authorize: vi.fn(),
      request: vi.fn(),
      credentials: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
    },
  };

  await initializeTrakt();
  render(<TraktSettings />);

  expect(screen.getByRole('button', { name: 'Connect Trakt' })).toBeTruthy();
});
