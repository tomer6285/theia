# Theia

Theia is a touch-friendly app for browsing and watching movies and shows on the web, desktop, and Android—complete with watch-progress tracking, custom lists, and Trakt sync.

## Download

Grab ready-to-run desktop installers and Android APKs from the [Releases page](https://github.com/tomer6285/theia/releases).

If you’d rather run the web app on your own hardware, you can self-host it in a couple of minutes with Docker Compose.

## Self-host with Docker Compose

Clone the repo and start Theia using the included [Docker Compose file](docker-compose.yml):

```bash
git clone https://github.com/tomer6285/theia.git
cd theia
docker compose up -d --build
```

Then open **http://localhost:3000** on the host machine. The built-in playback proxy works automatically as long as **Settings → Playback proxy address** is left blank.

### Access from other devices on your network

By default, Theia binds only to `127.0.0.1`. To watch from phones, tablets, or TVs on your home network, create a `.env` file next to `docker-compose.yml` with your host machine’s LAN IP:

```dotenv
THEIA_BIND_IP=192.168.1.50
```

Restart the container and open `http://<host-lan-ip>:3000` from any device on your network:

```bash
docker compose up -d
```

### Exposing Theia to the internet

If you make your instance reachable outside your home network:

- Put it behind an **HTTPS reverse proxy** with authentication and rate limiting.
- Set `ALLOWED_HOSTS` in `.env` to a comma-separated list of trusted streaming provider and CDN hostnames (including any CDN domains your streams redirect to) so the built-in proxy only fetches from hosts you allow.

### Using Trakt on a self-hosted instance

Playback works fine over plain HTTP on your LAN, but Trakt sign-in from other devices requires **HTTPS**. (Opening the app directly at `http://localhost:3000` can also use the default local Trakt development setup.)

To enable Trakt on your domain (for example, `https://theia.example.com`):

1. Register that origin and callback URL in your Trakt API app.
2. Add your Trakt client ID and callback URL to `.env`:

   ```dotenv
   VITE_TRAKT_CLIENT_ID=your-trakt-client-id
   VITE_TRAKT_WEB_REDIRECT_URI=https://theia.example.com/
   ```

3. Rebuild and restart the container, then connect your account in **Settings**:

   ```bash
   docker compose up -d --build
   ```

## Tips for watching & syncing

- **Switch servers anytime:** If a stream fails or buffers, pick another server from the player.
- **Subtitles & audio:** Use the built-in player controls to switch audio tracks or adjust subtitles. External embedded players manage their own controls and won’t update your watch progress in Theia.
- **Back up your library:** Go to **Settings → Watch backup** to export or import your watch history, resume positions, favorites, and custom lists as JSON (credentials and proxy settings are never included).
- **Sync across devices:** Sign in to **Trakt** in **Settings** to keep your watch history, progress, and favorites in sync everywhere.

## Build installers & APKs with `release.sh`

You can package desktop installers or an Android APK yourself using [`release.sh`](release.sh). Make sure you have **Node.js 22**, the **pnpm** version specified in [`package.json`](package.json), and dependencies installed first:

```bash
pnpm install --frozen-lockfile
```

Run `./release.sh` with no flags to run the core unit tests and build desktop packages for your current OS and CPU architecture:

```bash
./release.sh
```

Desktop artifacts (Linux AppImage / `.deb` / `.rpm`, Windows installer, or macOS `.dmg`) are written to `apps/electron/release/`.

### Common options

| Flag | What it builds / does |
| --- | --- |
| `--linux-only` | Build Linux AppImage, `.deb`, and `.rpm` (if `rpmbuild` is installed) |
| `--win-only` | Build Windows installers |
| `--mac-only` | Build macOS `.dmg` (must be run on macOS) |
| `--android-only` | Build a signed Android APK via Expo EAS |
| `--x64` / `--arm64` / `--all-arch` | Target `x64`, `arm64`, or both architectures for desktop builds |
| `--skip-rpm` / `--rpm-only` | Skip RPM packaging, or build only `.rpm` packages |
| `--dir` | Output unpacked desktop app folders instead of installers |
| `--skip-tests` | Skip the core unit tests before packaging |
| `-h`, `--help` | Show all supported options |

**Examples:**

```bash
# Build Linux packages for both x64 and ARM64
./release.sh --linux-only --all-arch

# Build a signed Android APK with Expo EAS (sign in first with: npx eas-cli@latest login)
./release.sh --android-only
```

## Run from source

For local development (Node.js 22 and pnpm as declared in [`package.json`](package.json)):

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @theia/web dev
```

- **Web:** Open `http://localhost:3000`
- **Desktop:** Run `pnpm start:electron` after `pnpm build`
- **Android:** Run `pnpm --filter @theia/mobile start`
