import proxy from './worker';
import { relayTrakt } from './trakt';

export { TraktAttempt } from './trakt';

type Env = { ALLOWED_HOSTS?: string; TRAKT_ATTEMPTS?: DurableObjectNamespace };

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname.startsWith('/trakt/')) {
      return relayTrakt(request, env.TRAKT_ATTEMPTS);
    }
    return proxy.fetch(request, env);
  },
};
