const lifetime = 10 * 60 * 1000;
const identifier = /^[A-Za-z0-9_-]{43}$/;
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

type Result = { code: string } | { error: string };
type Attempt = { claim: string; expiresAt: number; result?: Result };

function empty(status: number) {
  return new Response(null, { status, headers });
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function relayTrakt(request: Request, attempts: DurableObjectNamespace | undefined) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname === '/trakt/return' && request.method === 'GET') {
    return new Response('Return to Theia to see your Trakt sign-in status.', {
      headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const callback = pathname === '/trakt/callback' && request.method === 'GET';
  const desktop = pathname === '/trakt/attempt' && ['POST', 'PUT', 'DELETE'].includes(request.method);
  if (!callback && !desktop) return empty(405);
  if (!attempts) return empty(503);
  const state = callback ? url.searchParams.get('state') : request.headers.get('X-Trakt-State');
  if (!state || !identifier.test(state)) return empty(400);
  return attempts.get(attempts.idFromName(state)).fetch(request);
}

export class TraktAttempt {
  constructor(private readonly context: DurableObjectState) {}

  async fetch(request: Request) {
    const claim = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    const claimHash = claim ? await digest(claim) : undefined;
    const url = new URL(request.url);

    return this.context.blockConcurrencyWhile(async () => {
      const storage = this.context.storage;
      const attempt = await storage.get<Attempt>('attempt');
      if (request.method === 'POST') {
        if (!claimHash) return empty(401);
        if (attempt) return empty(409);
        const expiresAt = Date.now() + lifetime;
        await storage.setAlarm(expiresAt);
        await storage.put<Attempt>('attempt', { claim: claimHash, expiresAt });
        return empty(201);
      }

      if (!attempt || attempt.expiresAt <= Date.now()) return empty(410);
      if (request.method === 'GET') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (attempt.result) return empty(409);
        if ((!code && !error) || (code && error) || (code && code.length > 4096)) return empty(400);
        const result: Result = code ? { code } : { error: error === 'access_denied' ? error : 'authorization_failed' };
        await storage.put<Attempt>('attempt', { ...attempt, result });
        return new Response(null, { status: 303, headers: { ...headers, Location: '/trakt/return' } });
      }

      if (claimHash !== attempt.claim) return empty(401);
      if (request.method === 'DELETE') {
        await storage.delete('attempt');
        return empty(204);
      }
      if (!attempt.result) return empty(204);
      await storage.delete('attempt');
      return Response.json(attempt.result, { headers });
    });
  }

  async alarm() {
    await this.context.storage.deleteAll();
  }
}
