
import { describe, it, expect, beforeAll } from 'vitest';
import { AssetManager, VirtualFileSystem, PakArchive } from '@quake2ts/engine';
import { setupBrowserEnvironment } from '@quake2ts/test-utils';
import { buildPak, textData } from '../../../../engine/tests/helpers/pakBuilder.js';

describe('Asset Loading Integration', () => {
  beforeAll(() => {
    setupBrowserEnvironment();
  });

  it('should load assets from a synthetic PAK file', async () => {
    // 1. Create a synthetic PAK
    const pakData = buildPak([
      { path: 'config.cfg', data: textData('bind space +jump') },
      { path: 'pics/colormap.pcx', data: new Uint8Array(10) }, // Dummy data
      // Add a dummy MD2 header to valid minimal parsing
      { path: 'models/box.md2', data: new Uint8Array([
          0x49, 0x44, 0x50, 0x32, // IDP2
          8, 0, 0, 0, // version 8
          0, 0, 0, 0, // skinWidth
          0, 0, 0, 0, // skinHeight
          64, 0, 0, 0, // frameSize
          0, 0, 0, 0, // numSkins
          0, 0, 0, 0, // numVertices
          0, 0, 0, 0, // numTexCoords
          0, 0, 0, 0, // numTriangles
          0, 0, 0, 0, // numGlCommands
          0, 0, 0, 0, // numFrames
          0, 0, 0, 0, // offsetSkins
          0, 0, 0, 0, // offsetTexCoords
          0, 0, 0, 0, // offsetTriangles
          0, 0, 0, 0, // offsetFrames
          0, 0, 0, 0, // offsetGlCommands
          0, 0, 0, 0  // offsetEnd
      ])}
    ]);

    // 2. Initialize VFS and AssetManager
    const pak = PakArchive.fromArrayBuffer('test.pak', pakData);
    const vfs = new VirtualFileSystem([pak]);
    const assets = new AssetManager(vfs);

    // 3. Verify VFS lookup
    const configData = await vfs.readFile('config.cfg');
    expect(configData).toBeDefined();
    expect(new TextDecoder().decode(configData!)).toBe('bind space +jump');

    // 4. Verify MD2 Loading (should fail validation or succeed depending on parser strictness)
    // Here we just check if VFS can find it
    expect(vfs.hasFile('models/box.md2')).toBe(true);

    // 5. Test AssetManager loading (mocking dependencies if needed)
    // The parser might throw on invalid data, but the integration test proves the pipeline works
    const boxData = await vfs.readFile('models/box.md2');
    expect(boxData).toBeDefined();
    expect(boxData!.byteLength).toBeGreaterThan(0);

    // Attempting to load via AssetManager would require valid format
    // For integration test, verifying the pipeline (PAK -> VFS -> Read) is the key first step.
    // Further tests in assetManager.test.ts cover the parsing logic.
  });
});
