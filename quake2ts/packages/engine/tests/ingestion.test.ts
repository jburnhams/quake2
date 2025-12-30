import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ingestPaks, PakIngestionError } from '../src/assets/ingestion.js';
import { VirtualFileSystem } from '../src/assets/vfs.js';
import { PakArchive } from '../src/assets/pak.js';
import { PakIndexStore } from '../src/assets/pakIndexStore.js';
import { PakValidator } from '../src/assets/pakValidation.js';
import { buildPak, textData } from '@quake2ts/test-utils'; // pakBuilder.js';

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

  it('persists indexes when a PakIndexStore is provided', async () => {
    const pakBuffers = [buildPak([{ path: 'maps/base1.bsp', data: textData('world') }])];
    const sources = [{ name: 'pak0.pak', data: pakBuffers[0]! }];
    const vfs = new VirtualFileSystem();
    const store = new PakIndexStore('ingestion-persist-test');
    await store.clear();

    await ingestPaks(vfs, sources, { pakIndexStore: store });

    const [entry] = await store.list();
    expect(entry.name).toBe('pak0.pak');
    expect(entry.entries[0]?.name).toBe('maps/base1.bsp');
  });

  it('rejects mounts when validation fails', async () => {
    const pakBuffer = buildPak([{ path: 'maps/base1.bsp', data: textData('world') }]);
    const vfs = new VirtualFileSystem();
    const validator = new PakValidator([{ name: 'pak0.pak', checksum: 0 }]);

    await expect(
      ingestPaks(vfs, [{ name: 'pak0.pak', data: pakBuffer }], { validator, stopOnError: true }),
    ).rejects.toBeInstanceOf(PakIngestionError);
    expect(vfs.hasFile('maps/base1.bsp')).toBe(false);
  });

  it('continues ingesting after a validation mismatch when stopOnError defaults to false', async () => {
    const mismatched = buildPak([{ path: 'textures/bad.wal', data: textData('x') }]);
    const valid = buildPak([{ path: 'textures/good.wal', data: textData('ok') }]);
    const vfs = new VirtualFileSystem();
    const validator = new PakValidator([{ name: 'pak0.pak', checksum: 1234 }]);

    const results = await ingestPaks(
      vfs,
      [
        { name: 'pak0.pak', data: mismatched },
        { name: 'pak1.pak', data: valid },
      ],
      { validator },
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(
      expect.objectContaining({ mounted: false, validation: expect.objectContaining({ status: 'mismatch' }) }),
    );
    expect(results[1]).toEqual(expect.objectContaining({ mounted: true }));
    expect(vfs.hasFile('textures/bad.wal')).toBe(false);
    expect(vfs.hasFile('textures/good.wal')).toBe(true);
  });

  it('reports unknown validation outcomes while still mounting when allowed', async () => {
    const pakBuffer = buildPak([{ path: 'textures/wall.wal', data: textData('wal') }]);
    const vfs = new VirtualFileSystem();
    const validator = new PakValidator([{ name: 'different.pak', checksum: 123 }]);
    const onValidation = vi.fn();

    const [result] = await ingestPaks(vfs, [{ name: 'pak0.pak', data: pakBuffer }], {
      validator,
      allowUnknownPaks: true,
      onValidationResult: onValidation,
    });

    expect(result.validation?.status).toBe('unknown');
    expect(onValidation).toHaveBeenCalled();
    expect(vfs.hasFile('textures/wall.wal')).toBe(true);
  });
});
