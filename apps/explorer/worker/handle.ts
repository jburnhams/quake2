// What the Cloudflare Worker in front of the site (wrangler.jsonc, worker/index.ts) does. Every path
// is a static asset except the demo archive, which this serves.
//
// id's demo licence lets the demo be passed on only as the original archive, q2-314-demo-x86.exe,
// and the page unpacks it (src/library/demo.ts). The archive is 39 MB, over Cloudflare's 25 MiB
// limit for one static asset, and the page cannot fetch it from the repo's demo-paks release
// itself, because GitHub's release downloads send no CORS header. So the Worker fetches it from the
// release, passes the bytes through unchanged (the page checks their SHA-256) and keeps the
// response in Cloudflare's cache, so GitHub is asked about once per data centre, not per visitor.

export const ARCHIVE_PATH = '/q2-314-demo-x86.exe';
export const RELEASE_URL = 'https://github.com/jburnhams/quake2/releases/download/demo-paks/q2-314-demo-x86.exe';

/** The parts of the Workers runtime this uses, so the Worker can be tested without it. */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
export interface Context {
  waitUntil(promise: Promise<unknown>): void;
}
export interface Runtime {
  fetch(input: string, init?: RequestInit): Promise<Response>;
  cache: { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
}

const ARCHIVE_HEADERS = {
  'content-type': 'application/octet-stream',
  // The file never changes (its name is the release's and the page pins its hash).
  'cache-control': 'public, max-age=31536000, immutable',
};

export async function handle(request: Request, env: Env, ctx: Context, runtime: Runtime): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== ARCHIVE_PATH) return env.ASSETS.fetch(request);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Only GET and HEAD.', { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  // One cache key for GET and HEAD, without the query string.
  const key = new Request(url.origin + ARCHIVE_PATH);
  let response = await runtime.cache.match(key);
  if (!response) {
    const upstream = await runtime.fetch(RELEASE_URL, { redirect: 'follow' });
    if (!upstream.ok || !upstream.body) {
      return new Response(`The demo archive could not be fetched from GitHub (${upstream.status}).`, {
        status: 502,
        headers: { 'cache-control': 'no-store' },
      });
    }
    const headers = new Headers(ARCHIVE_HEADERS);
    const length = upstream.headers.get('content-length');
    if (length) headers.set('content-length', length);
    response = new Response(upstream.body, { status: 200, headers });
    ctx.waitUntil(runtime.cache.put(key, response.clone()));
  }
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}
