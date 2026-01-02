import { describe, expect, it, vi } from 'vitest';
import { AudioRegistry, AudioRegistryError } from '../../src/assets/audio.js';
import { buildPak } from '@quake2ts/test-utils'; // pakBuilder.js';
import { PakArchive } from '../../src/assets/pak.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';
import { buildWav } from '@quake2ts/test-utils'; // wavBuilder.js';
import type { OggAudio } from '../../src/assets/ogg.js';

const mockOgg: OggAudio = {
  sampleRate: 22050,
  channels: 2,
  bitDepth: 16,
  channelData: [
    new Float32Array([0, 0.25, -0.25, 0.5]),
    new Float32Array([0, -0.25, 0.25, -0.5]),
  ],
};

vi.mock('../../src/assets/ogg.js', () => ({
  decodeOgg: vi.fn(async () => mockOgg),
}));

describe('Audio registry', () => {
  const wavBuffer = buildWav({ sampleRate: 11025, channels: 1, samples: [0, 0.25, -0.25] });
  const oggBuffer = new Uint8Array([
    // Minimal Ogg Vorbis header bytes are unnecessary for the mocked decoder, but we
    // keep the extension realistic for registry resolution.
    0x4f, 0x67, 0x67, 0x53, // "OggS" capture pattern
    0x00,
  ]);
  const pakBuffer = buildPak([
    { path: 'sound/weapons/blaster.wav', data: new Uint8Array(wavBuffer) },
    { path: 'music/example.ogg', data: oggBuffer },
  ]);
  const pak = PakArchive.fromArrayBuffer('base.pak', pakBuffer);
  const vfs = new VirtualFileSystem([pak]);
  const registry = new AudioRegistry(vfs, { cacheSize: 4 });

  it('loads wav and ogg assets with caching', async () => {
    const wav = await registry.load('sound/WEAPONS/BLASTER.WAV');
    expect(wav.sampleRate).toBe(11025);
    expect(wav.channelData[0]?.length).toBeGreaterThan(0);

    const ogg = await registry.load('MUSIC/example.ogg');
    expect(ogg.channels).toBeGreaterThan(0);
    registry.release('sound/weapons/blaster.wav');
    registry.release('music/example.ogg');
  });

  it('rejects unknown audio formats', async () => {
    const badPak = PakArchive.fromArrayBuffer('bad.pak', buildPak([{ path: 'sound/bad.txt', data: new Uint8Array([1, 2, 3]) }]));
    const badVfs = new VirtualFileSystem([badPak]);
    const badRegistry = new AudioRegistry(badVfs);
    await expect(badRegistry.load('sound/bad.txt')).rejects.toBeInstanceOf(AudioRegistryError);
  });

  it('clears cache and refcounts when requested', async () => {
    await registry.load('sound/weapons/blaster.wav');
    registry.clearAll();
    expect(registry.size).toBe(0);
    await expect(registry.load('sound/weapons/blaster.wav')).resolves.toBeDefined();
  });
});
