// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ARCHIVE_PATH, RELEASE_URL, handle, type Runtime } from '../worker/handle';

const ORIGIN = 'https://quake2.example';
const BYTES = new Uint8Array([0x4d, 0x5a, 1, 2, 3]);

function setup(upstream: () => Response = () => new Response(BYTES, { headers: { 'content-length': String(BYTES.length) } })) {
  const stored = new Map<string, Response>();
  const fetched: string[] = [];
  const pending: Promise<unknown>[] = [];
  const runtime: Runtime = {
    fetch: async (input) => {
      fetched.push(input);
      return upstream();
    },
    cache: {
      match: async (request) => stored.get(request.url)?.clone(),
      put: async (request, response) => {
        stored.set(request.url, new Response(await response.arrayBuffer(), response));
      },
    },
  };
  const assets: string[] = [];
  const env = { ASSETS: { fetch: async (request: Request) => (assets.push(new URL(request.url).pathname), new Response('asset')) } };
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  const get = async (path: string, method = 'GET') => {
    const response = await handle(new Request(ORIGIN + path, { method }), env, ctx, runtime);
    await Promise.all(pending);
    return response;
  };
  return { get, fetched, assets };
}

describe('the site Worker', () => {
  it('leaves every other path to the static assets', async () => {
    const { get, fetched, assets } = setup();
    expect(await (await get('/explore')).text()).toBe('asset');
    expect(assets).toEqual(['/explore']);
    expect(fetched).toEqual([]);
  });

  it('passes the release archive through unchanged and asks GitHub only once', async () => {
    const { get, fetched } = setup();
    const first = await get(ARCHIVE_PATH);
    expect(first.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(BYTES);
    expect(first.headers.get('content-length')).toBe(String(BYTES.length));
    expect(first.headers.get('cache-control')).toContain('immutable');
    const second = await get(`${ARCHIVE_PATH}?again`);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(BYTES);
    expect(fetched).toEqual([RELEASE_URL]);
  });

  it('answers HEAD without a body', async () => {
    const { get } = setup();
    const response = await get(ARCHIVE_PATH, 'HEAD');
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('says GitHub failed, and keeps nothing, when the release download fails', async () => {
    const { get, fetched } = setup(() => new Response('gone', { status: 404 }));
    const response = await get(ARCHIVE_PATH);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain('404');
    await get(ARCHIVE_PATH);
    expect(fetched).toHaveLength(2);
  });

  it('refuses writes to the archive', async () => {
    const { get, fetched } = setup();
    expect((await get(ARCHIVE_PATH, 'POST')).status).toBe(405);
    expect(fetched).toEqual([]);
  });
});
