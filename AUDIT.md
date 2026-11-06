# Codebase audit — 2026-11-06

## Scope

Reviewed the tracked shared packages and Worker plus the previously Git-ignored web, mobile, and Electron application source. Started from a clean worktree. Reviewed metadata and provider discovery, playback/session transitions, persistent state, subtitle conversion, touch/keyboard controls, catalog and library views, proxy requests, desktop isolation, native entry points, workspace scripts, packaging, and dependency advisories.

This is a source audit with automated verification. It is not a claim that every external provider, physical device, browser layout, or installer has been exercised.

## Fixes

### Repository and verification

- Removed the blanket `apps/` ignore rule so application source/configuration/assets can be reviewed and preserved. Build output, node_modules, and installers remain ignored.
- Added an actual workspace type-check command. The former lint command successfully did nothing because no package had a lint task; it now runs the type checks and is documented accurately.
- Expanded tests from 11 core checks to coverage of core failure paths, proxy handling, accessible UI, player lifecycle, app episode transitions, and dependency compatibility.
- Added CI for install, tests, build, type checks, and Android JS export.
- Added the missing Expo runtime/assets/font dependencies and package extensions for undeclared Expo Router imports, verified through Metro bundling.
- Native core/player entry points resolve source so clean native builds do not rely on ignored generated packages.

### Playback and provider discovery

- Next-episode navigation resolves the next episode's sources instead of retaining the previous episode's URL, on web and native. Back navigation aborts pending resolution and resolution failure provides a retry.
- Resume positions apply after media metadata loads, honor the auto-resume preference, and survive server changes. Progress saves on pause, page hide, regular intervals, and player teardown.
- HLS fatal errors have bounded recovery attempts and visible recovery actions. Autoplay rejection no longer leaves optimistic playing state or an endless loading indicator.
- Subtitle selections now fetch SRT/VTT, convert to WebVTT, apply offsets, attach actual tracks, cancel stale requests, and revoke object URLs. Subtitle timestamp rounding carries across minute/hour boundaries; fully clipped cues are removed and cue positioning settings are preserved.
- Implemented native Expo AV/WebView playback in place of DOM elements in the native player. Added native persistence hydration and guarded invalid playback links.
- Gesture volume/brightness use the starting values rather than compounding on each move. Double taps no longer also toggle controls; pending gestures and transient timers are cleaned up. Controls do not trigger background gestures.
- Provider aggregate timeouts cancel underlying requests and release timers/listeners. Per-request deadlines include body consumption. Invalid/non-HTTP stream URLs and duplicate sources are rejected.
- Configured proxies apply to provider discovery as well as media playback. Series without an episode no longer resolve movie routes. Cinemeta accepts IDs without `imdb_id`, filters invalid episode numbers, keeps specials after normal seasons, and has bounded network requests.
- Token encoding works without relying on TextEncoder/TextDecoder globals on the supported native runtime.

### Persistence

- Validated saved state shapes and merged only known settings rather than allowing JSON to replace store actions.
- Async storage adapters hydrate before mobile renders. Async writes serialize to prevent older writes overwriting newer state; browser storage writes stay synchronous so page-exit saves are retained.
- History moves revisited episodes to the front; series lookup finds the latest episode. Selecting an individual continue/history entry opens that episode.
- Invalid/nonfinite playback progress is rejected. Storage-denied browser sessions retain an in-memory fallback.

### Interface

- Replaced duplicate movie/show views with a shared responsive catalog, consistent spacing/type hierarchy, loading states, empty states, reload actions, and deduplicated rails. Removed the unused discovery screen.
- Removed misleading “top rated” labels from popular-catalog pages; retained the existing dark palette and rounded component style.
- Favorites/history/navigation badges subscribe to store changes. Older searches cannot overwrite newer/cleared native queries.
- Added keyboard controls and accessible state to switches/sliders/cards/pills/navigation, visible focus, search labels, and reduced-motion styles. Re-enabled browser zoom and normal text selection.
- Dialogs trap focus, restore focus, support Escape, and share nested scroll locks. Episode sheets use saved progress and selection closes the sheet.
- Improved narrow layouts for episode rows/player actions, constrained wide dialogs, removed remote placeholder-image dependencies, and added poster failure fallbacks.
- Settings validate proxy addresses, expose auto-resume, and describe the actual autoplay behavior without implementation details.

### Proxy and Electron

- Unified Vite development and Worker proxy behavior. Rewrites include HLS keys, audio/subtitle renditions, maps and other URI attributes using the final redirect URL; transformed playlists do not retain stale content lengths/ETags.
- Restricted methods to GET/HEAD/OPTIONS, kept range headers, removed application credentials from upstream requests, added response header exposure, rejected local/literal-IP and non-HTTP targets, and validated each redirect. Optional `ALLOWED_HOSTS` restricts both initial requests and redirects.
- Upstream active documents are served as sandboxed text with `nosniff`, including during provider discovery. Dev proxy disconnects cancel upstream requests.
- Restored Electron web security, enabled sandboxing, denied popups/permission requests, constrained top-level navigation, and matched provider domains structurally.
- Packaged web assets use relative URLs and explicit Electron resources.
- Replaced one-pixel native icon/splash placeholders with 1024px renders of the existing SVG logo, including a transparent adaptive foreground with safe margins. `pnpm assets:mobile` regenerates them.

## Dependency audit

`pnpm audit --prod` initially reported **49 advisories**, including one critical. After targeted upgrades/overrides for PostCSS, node-forge, tar, xmldom and the query-string decoder, it reports **6 advisories: 0 critical, 2 high, 3 moderate, 1 low**.

The query-string patch adapts its CommonJS import to the fixed ESM decoder; it is tracked under `patches/`. Dedicated tests exercise Expo's archive create/extract APIs, plist serialization/parsing, and query parsing with malformed percent-encoding. Node.js 22 is the validated toolchain.

Remaining findings are through the older Expo/React Native toolchain:

| Dependency | Severity | Remaining issue |
| --- | --- | --- |
| image-size 1.x | High (2) | Malformed JXL/HEIF/ICNS image parsers can loop during asset processing. Metro calls its legacy CommonJS function API; the fixed 2.x API changes require a coordinated toolchain update. |
| uuid 7/8 | Moderate | Caller-supplied-buffer bounds checking in older UUID variants. |
| glob 10 | Moderate | Traversal may continue after an AbortSignal timeout. |
| minimatch 9 | Moderate | Pattern expansion can consume excessive resources. |
| deepmerge 4 | Low | Prototype poisoning; the advisory lists no patched version. |

These remain unresolved. A supported Expo/React Native upgrade should replace the legacy dependency chains and be verified on devices. Avoid processing untrusted project assets/configuration with the current native toolchain.

## Verification

- Frozen-lockfile install succeeds.
- `pnpm test`: regression/component/app tests and three real dependency compatibility tests pass.
- `pnpm typecheck`: all seven workspace packages/apps pass.
- `pnpm build`: shared packages, Worker, Electron wrapper and web app compile. Playback/HLS are lazy chunks; the full HLS library still produces Vite's >500 kB chunk warning.
- Android Metro export succeeds with the native player included.
- `git diff --check` passes.

No signed APK or desktop installer was built. No physical device, interactive browser layout check, deployed Worker, or live third-party playback was tested. Browser-specific media policies, native subtitle parity, upstream provider changes, desktop installer behavior, and device gestures still need real environment testing. The proxy hostname validation is not a DNS resolver; production deployments should set trusted `ALLOWED_HOSTS` and their own access/rate limits. The web manifest does not implement offline caching.
