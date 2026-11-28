# Theia

Theia is a touch-friendly app for browsing movies and shows, watching them, and keeping track of what you’ve seen. Use it in a browser or on desktop and Android.

## Get Theia

Look for desktop downloads and Android APKs on the [Releases page](https://github.com/tomer6285/theia/releases). To run Theia in a browser on your own network, use Docker Compose.

## Self-host with Docker Compose

Clone the repository and run the included [Compose file](docker-compose.yml) from the project folder.

```bash
git clone https://github.com/tomer6285/theia.git
cd theia
docker compose up -d --build
```

Open http://localhost:3000 on the Docker host. Leave **Settings → Playback proxy address** blank to use the built-in proxy.

To watch from other devices on your home network, set `THEIA_BIND_IP` to the Docker host’s LAN IP in a `.env` file next to the Compose file. Run `docker compose up -d` again, then open `http://<host-lan-ip>:3000` on your other devices.

If you expose Theia to the internet, put it behind an HTTPS reverse proxy with access controls and rate limits. Set `ALLOWED_HOSTS` in `.env` to a comma-separated list of trusted streaming provider and CDN hostnames. Include any CDN hostnames your streams need. The host list applies to playback requests made by the proxy.

### Trakt on a self-hosted site

Playback works over HTTP on your LAN. For Trakt sign-in from another device, open Theia at an HTTPS address. Register that origin and its callback URL with your Trakt app, then add the public client ID and the callback URL to `.env`. For example, if your site is at `https://theia.example.com`:

```dotenv
VITE_TRAKT_CLIENT_ID=your-trakt-client-id
VITE_TRAKT_WEB_REDIRECT_URI=https://theia.example.com/
```

Run `docker compose up -d --build` to apply those settings, then connect Trakt in **Settings**. When you open Theia at exactly `http://localhost:3000`, the default Trakt development setup can also work.

## Watching and keeping your progress

- Browse or search for a movie or show. Try another server if a stream fails.
- Use the player to choose subtitles or an audio track when available. External embedded players have their own controls and may not save progress in Theia.
- Use **Settings → Watch backup** to export or import your progress, history, favorites, and custom lists. The backup excludes credentials and playback settings.
- Connect Trakt in **Settings** to sync watch history, progress, and favorites across devices.

## Run from source

Use Node.js 22 and the pnpm version listed in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @theia/web dev
```

Open http://localhost:3000. For desktop, run `pnpm start:electron` after building. For Android development, run `pnpm --filter @theia/mobile start`.
