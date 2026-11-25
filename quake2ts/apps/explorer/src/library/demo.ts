// Where the demo's files come from. id's demo licence lets the demo be passed on only as the
// original, unmodified archive, so the public site serves q2-314-demo-x86.exe itself (the same file
// as the repo's demo-paks release, whose download sends no CORS header and cannot be fetched from a
// page) and the browser takes baseq2/pak0.pak out of it. The archive is kept in Cache Storage, so a
// second visit reads nothing from the network. Development and the tests use the committed pak.pak
// (demo1 and what it needs), which is the default when VITE_DEMO_ARCHIVE is not set at build time.
import { readZipMember } from './zip';

export const ARCHIVE_MEMBER = 'Install/Data/baseq2/pak0.pak';
/** SHA-256 of q2-314-demo-x86.exe, as pinned in quake2ts/scripts/demo-paks.sha256. */
export const ARCHIVE_SHA256 = '7ace5a43983f10d6bdc9d9b6e17a1032ba6223118d389bd170df89b945a04a1e';
const CACHE = 'quake2-demo-archive-v1';

export type DemoSource = { kind: 'pak'; url: string; name: 'pak.pak' } | { kind: 'archive'; url: string; name: 'pak0.pak' };

/** The archive when the build names one (the Pages site), otherwise the committed demo PAK. */
export function demoSource(env: { BASE_URL: string; VITE_DEMO_ARCHIVE?: string } = import.meta.env): DemoSource {
  const archive = env.VITE_DEMO_ARCHIVE;
  return archive
    ? { kind: 'archive', url: `${env.BASE_URL}${archive}`, name: 'pak0.pak' }
    : { kind: 'pak', url: `${env.BASE_URL}pak.pak`, name: 'pak.pak' };
}

export type Progress = { received: number; total: number | null };

/** The demo PAK's bytes, reporting download progress. Throws an Error whose message says what failed. */
export async function fetchDemoPak(source: DemoSource, onProgress: (p: Progress) => void = () => {}): Promise<ArrayBuffer> {
  const url = new URL(source.url, document.baseURI).href;
  if (source.kind === 'pak') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The demo PAK could not be fetched (${response.status} ${response.statusText}).`);
    return response.arrayBuffer();
  }
  const archive = await fetchArchive(url, onProgress);
  return readZipMember(archive, ARCHIVE_MEMBER);
}

async function fetchArchive(url: string, onProgress: (p: Progress) => void): Promise<ArrayBuffer> {
  const cache = await openCache();
  const kept = await cache?.match(url);
  if (kept) {
    const buffer = await kept.arrayBuffer();
    if ((await sha256(buffer)) === ARCHIVE_SHA256) return buffer;
    await cache?.delete(url);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The Quake 2 demo could not be downloaded (${response.status} ${response.statusText}).`);
  const buffer = await readWithProgress(response, onProgress);
  if ((await sha256(buffer)) !== ARCHIVE_SHA256) throw new Error('The downloaded Quake 2 demo is not the original archive (its SHA-256 differs).');
  await cache?.put(url, new Response(buffer, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  return buffer;
}

async function readWithProgress(response: Response, onProgress: (p: Progress) => void): Promise<ArrayBuffer> {
  const length = Number(response.headers.get('content-length'));
  const total = Number.isFinite(length) && length > 0 ? length : null;
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ received, total });
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out.buffer;
}

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE);
  } catch {
    return null; // A private window or blocked storage: download every visit.
  }
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
