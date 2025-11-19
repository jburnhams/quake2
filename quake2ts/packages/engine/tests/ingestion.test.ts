import { describe, expect, it, vi } from 'vitest';
import { ingestPaks, PakIngestionError } from '../src/assets/ingestion.js';
import { VirtualFileSystem } from '../src/assets/vfs.js';
import { PakArchive } from '../src/assets/pak.js';
import { buildPak, textData } from './helpers/pakBuilder.js';

describe('ingestPaks', () => {
  it('mounts multiple PAK sources and reports progress', async () => {
    const pakBuffers = [
      buildPak([{ path: 'maps/base1.bsp', data: textData('world') }]),
      buildPak([{ path: 'sound/explosion.wav', data: textData('boom') }]),
    ];
    const sources = pakBuffers.map((buffer, index) => ({ name: `pak${index}.pak`, data: buffer }));
    const vfs = new VirtualFileSystem();
    const onProgress = vi.fn();

    const results = await ingestPaks(vfs, sources, { onProgress });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.mounted)).toBe(true);
    expect(vfs.hasFile('maps/base1.bsp')).toBe(true);
    expect(vfs.hasFile('sound/explosion.wav')).toBe(true);
    expect(onProgress).toHaveBeenCalled();
  });

  it('ingests from Blob streams with incremental progress', async () => {
    const blobPak = buildPak([{ path: 'textures/wall.wal', data: textData('wal') }]);
    const blob = new Blob([new Uint8Array(blobPak.slice(0, blobPak.byteLength / 2)), new Uint8Array(blobPak.slice(blobPak.byteLength / 2))]);
    const source = { name: 'blob.pak', data: blob };
    const vfs = new VirtualFileSystem();
    const onProgress = vi.fn();
    const onError = vi.fn();

    const [result] = await ingestPaks(vfs, [source], { onProgress, onError, stopOnError: true });

    expect(result.archive).toBeInstanceOf(PakArchive);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'blob.pak', state: 'parsed' }),
    );
    expect(onError).not.toHaveBeenCalled();
    expect(onProgress.mock.calls.some(([progress]) => progress.state === 'reading')).toBe(true);
    await expect(vfs.readFile('textures/wall.wal').then((data) => new TextDecoder().decode(data))).resolves.toBe('wal');
  });

  it('continues ingesting after an invalid pak when stopOnError=false', async () => {
    const goodPak = buildPak([{ path: 'textures/good.wal', data: textData('ok') }]);
    const sources = [
      { name: 'bad.pak', data: new ArrayBuffer(8) },
      { name: 'good.pak', data: goodPak },
    ];
    const vfs = new VirtualFileSystem();
    const onError = vi.fn();
    const onProgress = vi.fn();

    const results = await ingestPaks(vfs, sources, { onError, onProgress });

    expect(results).toHaveLength(1);
    expect(results[0].archive).toBeInstanceOf(PakArchive);
    expect(vfs.hasFile('textures/good.wal')).toBe(true);
    expect(onError).toHaveBeenCalledWith('bad.pak', expect.anything());
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'bad.pak', state: 'error' }),
    );
  });

  it('throws PakIngestionError when stopOnError=true', async () => {
    const sources = [{ name: 'broken.pak', data: new ArrayBuffer(4) }];
    const vfs = new VirtualFileSystem();

    await expect(ingestPaks(vfs, sources, { stopOnError: true })).rejects.toBeInstanceOf(PakIngestionError);
  });
});
