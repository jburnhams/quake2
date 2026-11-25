import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderRoutes } from 'strata-react/testing';
import { routes } from '../src/routes';
import { ARCHIVE_MEMBER, demoSource, fetchDemoPak } from '../src/library/demo';
import { listZip, readZipMember, ZipError } from '../src/library/zip';
import { demoPak, server } from './setup';

/** A ZIP of `files` (deflated unless `store`), behind `stub` bytes as a self-extractor has. */
function zip(files: Record<string, Uint8Array>, { stub = 0, store = false } = {}): ArrayBuffer {
  const locals: Buffer[] = [];
  const dir: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const body = store ? Buffer.from(data) : deflateRawSync(data);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(store ? 0 : 8, 10);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    dir.push(entry, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  const out = Buffer.concat([Buffer.alloc(stub, 0x4d), ...locals, directory, end]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

const text = (s: string) => new TextEncoder().encode(s);

describe('reading a ZIP', () => {
  it('reads a deflated member behind a self-extractor stub', async () => {
    const archive = zip({ 'readme.txt': text('hello'), 'a/b.txt': text('quake '.repeat(500)) }, { stub: 4096 });
    expect(listZip(archive).map((m) => m.name)).toEqual(['readme.txt', 'a/b.txt']);
    expect(new TextDecoder().decode(await readZipMember(archive, 'a/b.txt'))).toBe('quake '.repeat(500));
  });

  it('reads a stored member', async () => {
    const archive = zip({ 'x.bin': text('stored') }, { store: true });
    expect(new TextDecoder().decode(await readZipMember(archive, 'x.bin'))).toBe('stored');
  });

  it('says which member is missing, and when a file is not a ZIP', async () => {
    await expect(readZipMember(zip({ 'a.txt': text('a') }), 'b.txt')).rejects.toThrow('b.txt is not in the archive.');
    expect(() => listZip(new ArrayBuffer(100))).toThrow(ZipError);
  });
});

describe('the demo archive', () => {
  const env = { BASE_URL: '/quake2/', VITE_DEMO_ARCHIVE: 'q2-314-demo-x86.exe' };

  it('is used when the build names it, and the committed PAK otherwise', () => {
    expect(demoSource(env)).toEqual({ kind: 'archive', url: '/quake2/q2-314-demo-x86.exe', name: 'pak0.pak' });
    expect(demoSource({ BASE_URL: '/' })).toEqual({ kind: 'pak', url: '/pak.pak', name: 'pak.pak' });
  });

  it('refuses an archive that is not the original', async () => {
    const fake = zip({ [ARCHIVE_MEMBER]: new Uint8Array(demoPak) }, { stub: 512 });
    expect(createHash('sha256').update(new Uint8Array(fake)).digest('hex')).not.toMatch(/^7ace5a/);
    server.use(http.get('*/q2-314-demo-x86.exe', () => HttpResponse.arrayBuffer(fake)));
    await expect(fetchDemoPak(demoSource(env))).rejects.toThrow(/not the original archive/);
  });

  it('says why when the archive cannot be downloaded', async () => {
    server.use(http.get('*/q2-314-demo-x86.exe', () => new HttpResponse(null, { status: 404, statusText: 'Not Found' })));
    await expect(fetchDemoPak(demoSource(env))).rejects.toThrow('The Quake 2 demo could not be downloaded (404 Not Found).');
  });
});

// The real archive, when scripts/fetch-paks.sh has kept it (CI's demo-paks action does).
const realArchive = resolve(import.meta.dirname, '../../../.paks/q2-314-demo-x86.exe');

describe.skipIf(!existsSync(realArchive))('the real demo archive', () => {
  it('gives the pinned pak0.pak', async () => {
    const bytes = readFileSync(realArchive);
    const pak = await readZipMember(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, ARCHIVE_MEMBER);
    expect(createHash('sha256').update(new Uint8Array(pak)).digest('hex')).toBe('cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09');
  });
});

describe('the intro', () => {
  it('says what the project is and leads to the explorer', async () => {
    renderRoutes(routes, { route: '/', toasts: false });
    expect(screen.getByRole('heading', { level: 1, name: /Quake 2, in TypeScript/ })).toBeInTheDocument();
    const goTo = screen.getByRole('list', { name: 'Go to' });
    expect(within(goTo).getByRole('link', { name: /Explorer/ })).toHaveAttribute('href', '/explore');
    expect(screen.getByRole('link', { name: /Explore the demo's files/ })).toHaveAttribute('href', '/explore');
  });
});
