# Dion Touch (dion-tc) — Implementation Plan

A touch-first, cross-platform port of [Dion](https://github.com/tomer6285/dion) targeting **React Native (Android APK)**, **Web (PWA)**, and **Desktop (Electron)** from a unified monorepo.

---

## 1. Architecture & Monorepo Structure

We will use **Turborepo** with **pnpm** and **Expo (React Native)**. To support both native mobile (with hardware-accelerated ExoPlayer) and Web/Electron without duplicating business logic, the codebase is split into modular packages:

```text
dion-tc/
├── packages/
│   ├── core/                  # Pure TypeScript business logic (Zero UI dependencies)
│   │   ├── src/
│   │   │   ├── metadata/      # Stremio Cinemeta & IMDb metadata client
│   │   │   ├── providers/     # VidLink, VixSrc, Vidora scrapers & stream resolvers
│   │   │   ├── crypto/        # XSalsa20-Poly1305 encryption (tweetnacl)
│   │   │   ├── subtitles/     # OpenSubtitles API & stream subtitle parser
│   │   │   ├── storage/       # Watch progress, history & user settings schemas
│   │   │   └── types/         # TypeScript interfaces (MediaItem, StreamSource, etc.)
│   ├── ui/                    # Universal UI components (NativeWind v4 / Tailwind CSS)
│   │   ├── src/
│   │   │   ├── components/    # MediaCard, EpisodeSheet, SearchBar, TouchPill, TouchSlider, SubtitleStepper
│   │   │   └── theme/         # Colors, spacing, typography
│   └── player/                # Platform-adaptive video engine
│       ├── src/
│       │   ├── VideoPlayer.tsx         # Universal player interface & gesture coordinator
│       │   ├── VideoPlayer.native.tsx  # React Native implementation (react-native-video / ExoPlayer)
│       │   ├── VideoPlayer.web.tsx     # Web/Electron implementation (hls.js + HTML5 Video)
│       │   └── gestures/               # Swipe, double-tap, scrub, and lock gesture handlers
├── apps/
│   ├── mobile/                # Expo / React Native Android app (builds APK & future TV builds)
│   ├── web/                   # Web site (React / Vite or Expo Web PWA)
│   └── electron/              # Electron wrapper for desktop
└── services/
    └── edge-proxy/            # Minimal Cloudflare Worker for web stream CORS & Referer spoofing
```

---

## 2. Shared Core (`packages/core`)

Port Dion's Python backend (`dion/`) to modular TypeScript:

### 2.1 Metadata Client (`metadata/cinemeta.ts`)
- Replaces Python's `cinemeta.py`.
- Queries the zero-config Stremio Cinemeta API:
  - Search: `https://v3-cinemeta.strem.io/catalog/{movie|series}/top/search={query}.json`
  - Details: `https://v3-cinemeta.strem.io/meta/{movie|series}/{imdb_id}.json`
  - Series Episodes: Parses season and episode arrays.

### 2.2 Providers & Scrapers (`providers/`)
- **VidLink Provider (`vidlink.ts`):**
  - Dion uses `pynacl` in Python for VidLink Pro API tokens.
  - In TypeScript, implement `encrypt_vidlink_token` and `decrypt_vidlink_payload` with `tweetnacl` (XSalsa20-Poly1305).
- **VixSrc Provider (`vixsrc.ts`):**
  - Scrapes stream embeds and extracts `.m3u8` playlists and subtitles.
- **Vidora Provider (`vidora.ts`):**
  - Secondary fallback provider.
- **Provider Manager (`manager.ts`):**
  - Parallel stream resolution, server failover, and best-server auto-selection.

### 2.3 Cross-Platform State (`storage/`)
- Built on `zustand` with persistence adapter:
  - Mobile: `react-native-mmkv` for ultra-fast native persistence.
  - Web/Electron: `idb-keyval` (IndexedDB).
- Stores:
  - Watch resume position (persisted every 5s and on pause).
  - Watch history & binge tracking.
  - Subtitle delay offsets per title.
  - User preferences (default player, preferred languages, server priority).

---

## 3. Platform-Adaptive Video Engine (`packages/player`)

To keep the application future-proof while solving the web/native player difference, the player layer exports a single universal `<VideoPlayer />` component that resolves via React Native's platform extensions (`.native.tsx` vs `.web.tsx`):

### 3.1 Mobile Native (`VideoPlayer.native.tsx`)
- Uses **`react-native-video`** (backed by **ExoPlayer** on Android).
- Advantages:
  - Direct header injection: `headers: { Referer: "https://vixsrc.to/" }` (bypasses browser CORS natively).
  - Native hardware acceleration & decoding.
  - Native Picture-in-Picture (PiP) and background audio.
  - Native screen sleep prevention via `expo-keep-awake`.
  - Android TV / remote control ready.

### 3.2 Web & Electron (`VideoPlayer.web.tsx`)
- Uses **`hls.js`** inside HTML5 `<video>`.
- In Electron: Network requests are rewritten directly via Electron `webRequest` to attach required headers.
- On Web: Routes streams through `services/edge-proxy` when headers are required.

### 3.3 Touch Gesture Matrix (Both Platforms)
Powered by `react-native-gesture-handler` (mobile) and `@use-gesture/react` / pointer events (web):

| Gesture | Location | Action | Visual Feedback |
| :--- | :--- | :--- | :--- |
| **Horizontal Drag** | Center screen | Timeline scrub | Floating time badge (`+00:45` / `24:15`) |
| **Vertical Drag** | Left 35% of screen | Brightness adjust | Vertical slider overlay + sun icon |
| **Vertical Drag** | Right 35% of screen | Volume adjust | Vertical slider overlay + speaker icon |
| **Double-Tap** | Left edge | Seek backward 10s | Ripple effect + `◀◀ 10s` |
| **Double-Tap** | Right edge | Seek forward 10s | Ripple effect + `10s ▶▶` |
| **Pinch-to-Zoom** | Video surface | Cycle aspect ratio | `Fit` ➔ `Fill` ➔ `16:9` toast |
| **Single Tap** | Center screen | Toggle controls | Smooth fade of HUD (auto-hides after 4s) |
| **Screen Lock** | HUD button | Freeze touch input | Lock icon; prevents accidental touches |

---

## 4. Handling Stream CORS & Anti-Hotlinking

Streaming providers often check `Origin`, `Referer`, and `User-Agent`:

1. **Android APK (React Native):**
   - ExoPlayer in `react-native-video` sends headers directly in socket requests; no browser sandbox or CORS applies.
2. **Electron App:**
   - Intercept outgoing HTTP traffic in the main process using `session.defaultSession.webRequest.onBeforeSendHeaders` to inject `Referer: https://vixsrc.to/`.
3. **Web Browser:**
   - Deploy `services/edge-proxy` (Cloudflare Worker):
     - Takes `?url=<m3u8_url>&referer=<target>`
     - Rewrites sub-manifest and chunk URLs
     - Adds `Access-Control-Allow-Origin: *`

---

## 5. Touch-First UI & Experience Design (`packages/ui`)

- **Bottom Navigation:**
  - 🔍 **Discover:** Trending media, search bar with touch debouncing, genre chips.
  - ⏱️ **Continue Watching:** Quick resume cards with progress percentage bar.
  - 📚 **Library & History:** Watched titles and favorites.
  - ⚙️ **Settings:** Server selection, subtitle languages, proxy configuration.
- **Episode & Season Drawer:**
  - Thumb-friendly bottom sheet (using `gorhom/bottom-sheet` on native, `vaul` on web).
  - Auto-scrolls to the next unwatched episode.
  - "Watch Next Episode" overlay appearing 30s before episode finish.
- **Subtitle Sync Stepper:**
  - Floating modal with `[-50ms]` and `[+50ms]` buttons and a fine-tune slider (replacing Dion's CLI `z`/`x` hotkeys).

---

## 6. Phased Implementation Roadmap

### Phase 1: Workspace & Core Port
- [x] Initialize Turborepo with pnpm workspaces.
- [x] Set up `packages/core` with TypeScript.
- [x] Implement `CinemetaClient` (search, media details, series episode listing).
- [x] Implement `VidLinkProvider` with `tweetnacl` (XSalsa20-Poly1305 encryption).
- [x] Implement `VixSrcProvider` & `VidoraProvider`.
- [x] Write unit tests for provider resolution and decryption.

### Phase 2: Design System & Universal Primitives
- [x] Configure Tailwind / styling in `packages/ui`.
- [x] Build touch components: `MediaCard`, `EpisodeSheet`, `TouchSlider`, `TouchPill`, `SearchBar`, `SubtitleStepper`.
- [x] Create persistent store in `packages/core/storage` (Zustand vanilla store + adapters).

### Phase 3: Player Layer Abstraction
- [x] Create `packages/player` interface.
- [x] Implement `VideoPlayer.native.tsx` (ExoPlayer bridge + gestures).
- [x] Implement `VideoPlayer.web.tsx` (`hls.js` + full gesture HUD overlay).
- [x] Implement dual-zone vertical volume/brightness and horizontal scrub gestures.
- [x] Add subtitle sync stepper & screen lock overlay.

### Phase 4: Mobile Android App (`apps/mobile`)
- [x] Initialize Expo app in `apps/mobile`.
- [x] Wire navigation (`expo-router`).
- [x] Integrate `packages/player` with native ExoPlayer.
- [x] Add `expo-keep-awake` and landscape auto-rotation.
- [x] Configure EAS / Gradle to build standalone Android APK (`eas.json`).

### Phase 5: Web App & CORS Edge Proxy
- [x] Set up `apps/web` (Vite PWA).
- [x] Deploy `services/edge-proxy` (Cloudflare Worker) for CORS rewriting.
- [x] Test HLS playback and responsive touch navigation in mobile browsers.

### Phase 6: Electron Desktop Wrapper (`apps/electron`)
- [x] Scaffold Electron wrapper loading the web build.
- [x] Configure `webRequest.onBeforeSendHeaders` for native header manipulation.
- [x] Package desktop binaries for Linux, macOS, and Windows with `electron-builder`.

### Phase 7: Polish & Future Capabilities
- [x] Touch gesture coordinators and double-tap seek feedback.
- [x] Persistent watch history & resume state tracking.
- [x] Build pipeline with Turborepo and Vitest unit testing.
