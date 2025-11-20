import { describe, expect, it } from 'vitest';
import { SoundPrecache } from '../../src/audio/precache.js';
import { SoundRegistry } from '../../src/audio/registry.js';
import { AudioContextController } from '../../src/audio/context.js';
import { FakeAudioContext, createBuffer } from './fakes.js';

class FakeVfs {
  constructor(private readonly files: Record<string, Uint8Array>) {}

  stat(path: string) {
    const entry = this.files[path];
    if (!entry) return undefined;
    return { path, size: entry.byteLength, sourcePak: 'test.pak' };
  }

  async readFile(path: string): Promise<Uint8Array> {
    const entry = this.files[path];
    if (!entry) {
      throw new Error(`missing ${path}`);
    }
    return entry;
  }
}

describe('SoundPrecache', () => {
  it('decodes and registers sounds under the sound/ prefix, skipping already-loaded buffers', async () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const vfs = new FakeVfs({
      'sound/world/ambience/windfly.wav': new Uint8Array(4000),
      'sound/weapons/blaster/fire.wav': new Uint8Array(1000),
    });

    const precache = new SoundPrecache({ vfs, registry, context: controller });
    const report = await precache.precache(['world/ambience/windfly.wav', '/sound/weapons/blaster/fire.wav']);

    expect(report.loaded).toEqual([
      'sound/world/ambience/windfly.wav',
      'sound/weapons/blaster/fire.wav',
    ]);
    expect(report.skipped).toEqual([]);
    expect(report.missing).toEqual([]);
    expect(Object.keys(report.errors)).toHaveLength(0);

    const alreadyLoaded = await precache.precache(['world/ambience/windfly.wav']);
    expect(alreadyLoaded.skipped).toEqual(['sound/world/ambience/windfly.wav']);
    expect(registry.find('sound/world/ambience/windfly.wav')).toBeDefined();
    expect(fakeContext.lastDecoded).toBeInstanceOf(ArrayBuffer);
  });

  it('reports missing files and decode errors without aborting the rest of the queue', async () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const vfs = new FakeVfs({ 'sound/player/pain.wav': new Uint8Array(200) });

    const precache = new SoundPrecache({
      vfs,
      registry,
      context: controller,
      decodeAudio: () => {
        throw new Error('decode failed');
      },
    });

    const report = await precache.precache(['player/pain.wav', 'missing.wav']);

    expect(report.loaded).toEqual([]);
    expect(report.missing).toEqual(['sound/missing.wav']);
    expect(Object.keys(report.errors)).toEqual(['sound/player/pain.wav']);
  });

  it('fills placeholders created through soundindex without re-decoding existing buffers', async () => {
    const fakeContext = new FakeAudioContext();
    const controller = new AudioContextController(() => fakeContext);
    const registry = new SoundRegistry();
    const placeholderIndex = registry.registerName('sound/player/pain100_1.wav');
    registry.register('sound/world/wind.wav', createBuffer(0.1));

    const vfs = new FakeVfs({ 'sound/player/pain100_1.wav': new Uint8Array(500) });
    const precache = new SoundPrecache({ vfs, registry, context: controller });
    const report = await precache.precache(['sound/world/wind.wav', 'player/pain100_1.wav']);

    expect(report.loaded).toEqual(['sound/player/pain100_1.wav']);
    expect(report.skipped).toEqual(['sound/world/wind.wav']);
    expect(registry.has(placeholderIndex)).toBe(true);
  });
});
