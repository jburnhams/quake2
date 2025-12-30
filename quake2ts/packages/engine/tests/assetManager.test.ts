import { describe, expect, it } from 'vitest';
import { AssetDependencyError, AssetManager } from '../src/assets/manager.js';
import { PakArchive } from '../src/assets/pak.js';
import { VirtualFileSystem } from '../src/assets/vfs.js';
import { buildPak, textData } from '@quake2ts/test-utils'; // pakBuilder.js';
import { buildMd2 } from '@quake2ts/test-utils'; // md2Builder.js';
import { buildWav } from '@quake2ts/test-utils'; // wavBuilder.js';

const preparedTexture = {
  width: 1,
  height: 1,
  source: 'wal' as const,
  levels: [{ level: 0, width: 1, height: 1, rgba: new Uint8Array([255, 0, 0, 255]) }],
};

function makeMd2Pak(): PakArchive {
  const md2Buffer = buildMd2({
    skins: ['soldier'],
    texCoords: [
      { s: 0, t: 0 },
      { s: 16, t: 16 },
      { s: 32, t: 32 },
    ],
    triangles: [{ vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] }],
    frames: [
      {
        name: 'idle',
        vertices: [
          { position: { x: 0, y: 0, z: 0 }, normalIndex: 0 },
          { position: { x: 1, y: 0, z: 0 }, normalIndex: 0 },
          { position: { x: 0, y: 1, z: 0 }, normalIndex: 0 },
        ],
      },
    ],
  });

  const wav = buildWav({ sampleRate: 11025, channels: 1, samples: [0, 0.1, -0.1] });

  const pakBuffer = buildPak([
    { path: 'models/player/tris.md2', data: new Uint8Array(md2Buffer) },
    { path: 'sound/player/step.wav', data: new Uint8Array(wav) },
    { path: 'textures/player/walk.wal', data: textData('dummy texture placeholder') },
  ]);
  return PakArchive.fromArrayBuffer('assets.pak', pakBuffer);
}

describe('AssetManager and dependency tracking', () => {
  it('requires textures before loading models', async () => {
    const pak = makeMd2Pak();
    const vfs = new VirtualFileSystem([pak]);
    const manager = new AssetManager(vfs, { textureCacheCapacity: 4 });

    await expect(manager.loadMd2Model('models/player/tris.md2', ['textures/player/walk.wal']))
      .rejects.toBeInstanceOf(AssetDependencyError);

    manager.registerTexture('textures/player/walk.wal', preparedTexture);
    const model = await manager.loadMd2Model('models/player/tris.md2', ['textures/player/walk.wal']);

    expect(model.frames.length).toBeGreaterThan(0);
    expect(manager.isAssetLoaded('model', 'models/player/tris.md2')).toBe(true);
  });

  it('clears caches and dependency state on level change', async () => {
    const pak = makeMd2Pak();
    const vfs = new VirtualFileSystem([pak]);
    const manager = new AssetManager(vfs, { textureCacheCapacity: 2, audioCacheSize: 2 });

    manager.registerTexture('textures/player/walk.wal', preparedTexture);
    await manager.loadSound('sound/player/step.wav');
    expect(manager.isAssetLoaded('sound', 'sound/player/step.wav')).toBe(true);

    manager.resetForLevelChange();

    expect(manager.textures.size).toBe(0);
    expect(manager.audio.size).toBe(0);
    expect(manager.isAssetLoaded('sound', 'sound/player/step.wav')).toBe(false);
    await expect(manager.loadMd2Model('models/player/tris.md2', ['textures/player/walk.wal']))
      .rejects.toBeInstanceOf(AssetDependencyError);
  });
});
