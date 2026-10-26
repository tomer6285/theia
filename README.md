# Dion Touch (`dion-tc`)

> Touch-first, cross-platform port of [Dion](https://github.com/tomer6285/dion) targeting **React Native (Android APK)**, **Web (PWA)**, and **Desktop (Electron)** from a unified monorepo.

---

## Architecture Overview

```text
dion-tc/
├── packages/
│   ├── core/                  # Pure TypeScript business logic (Zero UI dependencies)
│   │   ├── src/
│   │   │   ├── metadata/      # Stremio Cinemeta client (search, details, series)
│   │   │   ├── providers/     # VidLink, VixSrc, Vidora scrapers & stream manager
│   │   │   ├── crypto/        # XSalsa20-Poly1305 encryption & decryption (tweetnacl)
│   │   │   ├── subtitles/     # WebVTT / SRT parser & ±50ms offset sync stepper
│   │   │   ├── storage/       # Zustand vanilla state & persistent watch resume store
│   │   │   └── types/         # Media, Episode, StreamSource, and Settings interfaces
│   ├── ui/                    # Universal UI components (modern dark theme)
│   │   ├── src/
│   │   │   ├── components/    # MediaCard, EpisodeSheet, SearchBar, TouchPill, TouchSlider, SubtitleStepper
│   │   │   └── theme/         # Colors, dark surface elevation, typography
│   └── player/                # Platform-adaptive video engine
│       ├── src/
│       │   ├── VideoPlayer.tsx         # Universal platform resolver
│       │   ├── VideoPlayer.native.tsx  # React Native ExoPlayer implementation
│       │   ├── VideoPlayer.web.tsx     # Web/Electron implementation (hls.js + HTML5)
│       │   └── gestures/               # Dual-zone volume/brightness, scrub, double-tap seek, screen lock
├── apps/
│   ├── mobile/                # React Native / Expo app (builds standalone Android APK)
│   ├── web/                   # Vite PWA with touch-first bottom navigation
│   └── electron/              # Electron wrapper with native header rewriting
└── services/
    └── edge-proxy/            # Cloudflare Worker for CORS & Referer spoofing
```

---

## Touch Gestures Matrix

| Gesture | Location | Action | Visual Feedback |
| :--- | :--- | :--- | :--- |
| **Horizontal Drag** | Center screen | Timeline scrub | Floating time badge (`+00:45` / `24:15`) |
| **Vertical Drag** | Left 35% of screen | Brightness adjust | Vertical slider overlay + sun icon |
| **Vertical Drag** | Right 35% of screen | Volume adjust | Vertical slider overlay + speaker icon |
| **Double-Tap** | Left edge (< 30%) | Seek backward 10s | Ripple effect + `◀◀ 10s` |
| **Double-Tap** | Right edge (> 70%) | Seek forward 10s | Ripple effect + `10s ▶▶` |
| **Double-Tap** | Center screen | Cycle aspect ratio | `Fit` ➔ `Fill` ➔ `16:9` toast |
| **Single Tap** | Center screen | Toggle controls HUD | Smooth fade of HUD (auto-hides after 4s) |
| **Screen Lock** | HUD button | Freeze touch input | Lock icon; prevents accidental touches |
| **Subtitle Stepper** | Subtitles icon | Fine-tune timing | Modal with `[-50ms]`, `[+50ms]` & slider |

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Tests
```bash
pnpm test
```
Runs the full Vitest suite in `@dion/core` verifying XSalsa20-Poly1305 encryption/decryption, Cinemeta parsing, Provider Manager failover, Subtitle cue offsetting, and Zustand state persistence.

### 3. Build All Packages
```bash
pnpm build
```
Uses **Turborepo** to build `@dion/core`, `@dion/ui`, `@dion/player`, `@dion/edge-proxy`, `@dion/web`, and `@dion/electron`.

### 4. Run Web Application
```bash
pnpm --filter @dion/web dev
```
Starts the Vite dev server at `http://localhost:3000`.

### 5. Run Electron Desktop App
```bash
pnpm --filter @dion/electron start
```

### 6. Build Android APK
```bash
cd apps/mobile
eas build -p android --profile preview
```
Configured via `apps/mobile/eas.json` and `apps/mobile/app.json`.
