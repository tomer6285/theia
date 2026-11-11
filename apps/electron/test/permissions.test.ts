import { describe, expect, it } from 'vitest';
import { allowPlayerPermission } from '../src/permissions';

describe('player permissions', () => {
  const appUrl = 'file:///C:/Theia/resources/web/index.html';
  const contents = (url = appUrl, destroyed = false) => ({ getURL: () => url, isDestroyed: () => destroyed });
  it('allows fullscreen in the packaged app, including requests from its embeds', () => {
    const app = contents(`${appUrl}#/watch`);
    expect(allowPlayerPermission('fullscreen', app, app, appUrl, false)).toBe(true);
  });
  it('denies unrelated permissions, windows, documents, and destroyed contents', () => {
    const app = contents();
    for (const permission of ['media', 'notifications', 'openExternal', 'geolocation', 'pointerLock']) {
      expect(allowPlayerPermission(permission, app, app, appUrl, false)).toBe(false);
    }
    expect(allowPlayerPermission('fullscreen', contents(), app, appUrl, false)).toBe(false);
    expect(allowPlayerPermission('fullscreen', null, null, appUrl, false)).toBe(false);
    for (const url of ['https://provider.example', 'file:///C:/other.html', 'invalid']) {
      const other = contents(url);
      expect(allowPlayerPermission('fullscreen', other, other, appUrl, false)).toBe(false);
    }
    const dead = contents(appUrl, true);
    expect(allowPlayerPermission('fullscreen', dead, dead, appUrl, false)).toBe(false);
  });
  it('allows the development server only during development', () => {
    const app = contents('http://localhost:3000/watch');
    expect(allowPlayerPermission('fullscreen', app, app, appUrl, true)).toBe(true);
    expect(allowPlayerPermission('fullscreen', app, app, appUrl, false)).toBe(false);
  });
});
