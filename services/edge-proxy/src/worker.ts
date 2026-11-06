const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Accept, If-None-Match, If-Modified-Since',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Reject local services, credentials, and non-HTTP schemes, including redirects. */
export function publicUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || !host.includes('.') || host.endsWith('.') || host.endsWith('.local') || host.endsWith('.localhost')
    || host.endsWith('.internal') || host.includes(':')
    || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error('A public HTTP(S) hostname is required');
  }
  return url;
}

export function rewritePlaylist(content: string, upstream: string, proxy: URL, referer: string): string {
  const route = (uri: string) => {
    const resolved = new URL(uri, upstream);
    // Leave non-network URIs (e.g. data: keys) in the player.
    if (!['http:', 'https:'].includes(resolved.protocol)) return uri;
    const result = new URL(proxy);
    result.searchParams.set('url', resolved.href);
    result.searchParams.set('referer', referer);
    return result.href;
  };
  return content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      // Keys, audio/subtitle renditions, initialization maps and iframe playlists.
      return line.replace(/\bURI="([^"]+)"/g, (_, uri: string) => `URI="${route(uri)}"`);
    }
    return route(trimmed);
  }).join('\n');
}

export default {
  async fetch(request: Request, env?: { ALLOWED_HOSTS?: string }): Promise<Response> {
    const allowedHosts = env?.ALLOWED_HOSTS?.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
    const isAllowed = (target: URL) => !allowedHosts?.length || allowedHosts.some((host) =>
      target.hostname === host || (host.startsWith('*.') && target.hostname.endsWith(host.slice(1))));
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Max-Age': '86400' } });
    }
    if (!['GET', 'HEAD'].includes(request.method)) return errorResponse('Method not allowed', 405);
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return errorResponse('Missing "url" query parameter', 400);

    let targetUrl: URL;
    let referer: URL;
    try {
      targetUrl = publicUrl(target);
      referer = publicUrl(url.searchParams.get('referer') || 'https://vixsrc.to/');
      if (!isAllowed(targetUrl)) return errorResponse('Upstream host is not allowed', 403);
    } catch {
      return errorResponse('Invalid target or referer URL', 400);
    }

    try {
      // Forward only playback headers. Never send app cookies or authorization upstream.
      const headers = new Headers({ Referer: referer.href, Origin: referer.origin });
      for (const name of ['Range', 'Accept', 'If-None-Match', 'If-Modified-Since']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      let response: Response | undefined;
      for (let redirects = 0; redirects <= 5; redirects++) {
        response = await fetch(targetUrl.href, {
          method: request.method, headers, redirect: 'manual', signal: request.signal,
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 5) throw new Error('Invalid upstream redirect');
        targetUrl = publicUrl(new URL(location, targetUrl).href);
        if (!isAllowed(targetUrl)) return errorResponse('Upstream host is not allowed', 403);
      }
      if (!response) throw new Error('Missing upstream response');
      const responseHeaders = new Headers(cors);
      for (const name of ['Content-Type', 'Content-Range', 'Accept-Ranges', 'Cache-Control', 'ETag', 'Last-Modified']) {
        const value = response.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      if (!/^(?:video\/|audio\/|application\/(?:[^;]*mpegurl|octet-stream|json|x-subrip)|text\/(?:vtt|plain))/.test(contentType)) {
        // Discovery may read provider HTML, but it must never execute on the app origin.
        responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
        responseHeaders.set('Content-Disposition', 'attachment');
        responseHeaders.set('Content-Security-Policy', "default-src 'none'; sandbox");
      }
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      const isPlaylist = targetUrl.pathname.endsWith('.m3u8') || contentType.includes('mpegurl');
      if (request.method === 'HEAD' || [204, 205, 304].includes(response.status)) {
        return new Response(null, { status: response.status, headers: responseHeaders });
      }
      if (isPlaylist && response.ok) {
        const rewritten = rewritePlaylist(await response.text(), targetUrl.href, url, referer.href);
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        responseHeaders.delete('ETag');
        return new Response(rewritten, { status: response.status, headers: responseHeaders });
      }
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch {
      return errorResponse('Failed to fetch stream target', 502);
    }
  },
};
