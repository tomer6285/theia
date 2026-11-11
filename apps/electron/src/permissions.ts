interface PermissionContents {
  getURL(): string;
  isDestroyed(): boolean;
}

/** Fullscreen is available to the player and its embeds only in our app window. */
export function allowPlayerPermission(
  permission: string,
  contents: PermissionContents | null,
  appContents: PermissionContents | null,
  appDocumentUrl: string,
  allowDevServer: boolean,
): boolean {
  if (permission !== 'fullscreen' || !contents || contents !== appContents || contents.isDestroyed()) return false;
  try {
    const url = new URL(contents.getURL());
    const appUrl = new URL(appDocumentUrl);
    return (url.protocol === 'file:' && url.host === appUrl.host && url.pathname === appUrl.pathname && url.search === appUrl.search)
      || (allowDevServer && url.origin === 'http://localhost:3000');
  } catch {
    return false;
  }
}
