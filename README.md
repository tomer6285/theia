# Theia

A touch-friendly media browser and player for web, Electron, and Android, built with TypeScript and React.

## Workspace

- `packages/core`: metadata, provider discovery, provider token compatibility, subtitles, and persisted watch state.
- `packages/ui`: web components, dark theme, accessible controls, and dialogs.
- `packages/player`: HLS/HTML video player for web; Expo AV and WebView player for React Native.
- `apps/web`: Vite app with search, movie/show catalogs, favorites, history, and settings.
- `apps/mobile`: Expo Router Android app with native playback and AsyncStorage persistence.
- `apps/electron`: sandboxed desktop wrapper and application packaging.
- `services/edge-proxy`: Cloudflare Worker for provider discovery and media routing. The development web server uses the same implementation.

App source is included in version control; generated bundles, installers, native build folders, and dependencies are ignored.

## Development

Use Node.js 22 and the pnpm version declared in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @theia/web dev
```

The web app runs at `http://localhost:3000` and listens on all network interfaces, so other devices can use `http://<this-machine-lan-ip>:3000`. Shared packages build before their dependents. `pnpm build` compiles the shared packages, Worker, web app, and Electron wrapper; it does not create an Android APK or desktop installer.

```bash
pnpm test       # Core, proxy, player, UI, app-flow and dependency compatibility tests
pnpm typecheck  # Checks all seven packages/apps, including mobile
pnpm lint       # Currently runs type checks; no separate style linter is configured
```

CI runs these checks and exports the Android JavaScript bundle.

## Playback proxy

Browser requests to some providers and media CDNs need a proxy because of CORS. The local Vite app automatically uses its same-origin `/api/proxy`, including when opened over a LAN IP. Leaving **Settings → Playback proxy address** blank uses this automatic route; a custom endpoint overrides it. Static production builds use a direct connection until a proxy is configured.

For a hosted web app, deploy `services/edge-proxy` and enter its full HTTPS address. Static Vite output does not include a proxy server. Electron bundles the same proxy implementation and starts a private loopback endpoint automatically; no separately hosted proxy is needed. Leave the playback proxy setting blank to use it, or enter a custom endpoint to override it. Desktop playback still requires internet access to metadata and streaming providers.

The Worker handles GET/HEAD and byte ranges, preserves cancellation, follows validated redirects, and rewrites HLS playlist references, alternate tracks, initialization files, and encryption keys. Provider HTML can be fetched for discovery but is served as inert text. Application cookies and authorization headers are not forwarded upstream.

Before exposing a proxy publicly, configure the Worker's `ALLOWED_HOSTS` binding with a comma-separated list of trusted provider/CDN hostnames. `*.example.com` allows subdomains. Configure deployment access and rate limits for your environment. The hostname checks reject local addresses and non-HTTP URLs, but do not independently resolve DNS; an allowlist should contain hosts you control or trust.

## Desktop

```bash
pnpm build:electron
pnpm start:electron
pnpm dist:electron:linux
```

Other `dist:electron:*` scripts select Windows/macOS and architecture targets. The packaged app copies the web bundle into its resources and uses relative asset paths. Platform installers/signing require the corresponding build environment and credentials.

## Android

Native launcher/splash images derive from the web SVG mark. Run `pnpm assets:mobile` to regenerate them after updating the logo.

```bash
pnpm --filter @theia/mobile start
pnpm --filter @theia/mobile exec expo export --platform android --output-dir dist --no-bytecode --max-workers 2
```

From `apps/mobile`, `eas build -p android --profile preview` creates an APK after EAS setup. The native entry points resolve shared source, so Metro does not require prebuilt shared `dist` folders.

Direct streams use Expo AV with native controls, saved resume positions, request headers, and automatic next-episode resolution. Embeds use WebView. Keep-awake and landscape orientation are scoped to the player screen. AsyncStorage hydrates before the app mounts.

## Playback behavior and limits

Web playback supports timeline/keyboard seeking, brightness and volume gestures, a control lock, server switching, HLS audio language selection, and automatic subtitles with timing adjustments. The web player chooses full captions in your preferred language (English by default), discovers HLS/native-browser and external SRT/WebVTT tracks, and remembers explicit language/Off choices for subsequent episodes. VixSrc discovery consumes its short-lived embed token immediately and extracts a signed HLS playlist for the built-in player; it does not load a sandbox-incompatible iframe. Preferences control resume and automatic next-episode playback. Next episodes resolve fresh streams.

Third-party embeds manage their own playback, captions, and progress. Theia cannot inspect their cross-origin playback state, so external embeds do not provide Theia watch-progress tracking or reliable automatic next-episode playback. Native external subtitle synchronization and the custom web gesture HUD are not implemented. Provider availability depends on external services and is not guaranteed by the local tests.

The web manifest supports a standalone presentation; offline media and service-worker caching are not implemented.

See [AUDIT.md](AUDIT.md) for audit findings, verification, dependency risks, and validation limits.
