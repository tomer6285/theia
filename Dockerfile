FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm install --global pnpm@12.15.0 && \
    pnpm --filter '@theia/web...' --filter @theia/edge-proxy install --frozen-lockfile
ARG VITE_TRAKT_CLIENT_ID
ARG VITE_TRAKT_WEB_REDIRECT_URI
RUN pnpm --filter @theia/edge-proxy build && \
    VITE_PLAYBACK_PROXY_URL=/api/proxy pnpm --filter '@theia/web...' build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/apps/web/dist ./public
COPY --from=build /app/services/edge-proxy/dist/worker.js ./worker.mjs
COPY apps/web/self-host.mjs ./self-host.mjs
USER node
EXPOSE 3000
CMD ["node", "self-host.mjs"]
