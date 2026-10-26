export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const targetUrl = url.searchParams.get('url');
    const targetReferer = url.searchParams.get('referer') || 'https://vixsrc.to/';

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing "url" query parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const headers = new Headers(request.headers);
      headers.set('Referer', targetReferer);
      headers.set('Origin', new URL(targetReferer).origin);
      headers.set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      // Remove CF and host headers
      headers.delete('Host');

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
      });

      const contentType = response.headers.get('content-type') || '';
      const isM3U8 =
        targetUrl.includes('.m3u8') ||
        contentType.includes('mpegurl') ||
        contentType.includes('application/x-mpegURL');

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      if (isM3U8) {
        const text = await response.text();
        const baseUrl = new URL(targetUrl);
        const proxyBase = `${url.origin}${url.pathname}?referer=${encodeURIComponent(targetReferer)}&url=`;

        // Rewrite relative and absolute URLs in M3U8 playlist
        const rewritten = text
          .split('\n')
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
              // Handle URI in tags like #EXT-X-KEY:METHOD=AES-128,URI="..."
              if (trimmed.startsWith('#EXT-X-KEY:') && trimmed.includes('URI="')) {
                return trimmed.replace(/URI="([^"]+)"/, (_, keyUri) => {
                  const resolved = new URL(keyUri, baseUrl).toString();
                  return `URI="${proxyBase}${encodeURIComponent(resolved)}"`;
                });
              }
              return line;
            }

            // Segment or sub-playlist URL
            const resolved = new URL(trimmed, baseUrl).toString();
            return `${proxyBase}${encodeURIComponent(resolved)}`;
          })
          .join('\n');

        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        return new Response(rewritten, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      // Pass-through TS chunks, video binaries, subtitles, etc.
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to fetch stream target' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
