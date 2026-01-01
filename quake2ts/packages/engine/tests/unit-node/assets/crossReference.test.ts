
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetCrossReference } from '../../../src/assets/crossReference.js';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';
import { AssetManager } from '../../../src/assets/manager.js';

// We will mock the parser functions from crossReference.ts imports
vi.mock('../../../src/assets/bsp.js', () => ({
  parseBsp: vi.fn((buffer: ArrayBuffer) => {
    const text = new TextDecoder().decode(buffer);
    const data = JSON.parse(text);
    return data;
  }),
  // We need to export BspLoader as well if we want to mock it completely, or let it fail?
  // AssetManager uses BspLoader.
  BspLoader: class {
      constructor(vfs: any) {}
      load(path: string) { return {}; }
  }
}));

// Mock MD2 module completely, including parsing and Loader
vi.mock('../../../src/assets/md2.js', () => ({
  parseMd2: vi.fn((buffer: ArrayBuffer) => {
      // Dummy mock that returns a fixed structure or assumes buffer is something we control
      // In the test we pass a dummy buffer.
      return {
          skins: [{ name: 'textures/e1u1/wall1' }] // Simulate finding a texture
      };
  }),
  Md2Loader: class {
      constructor(vfs: any) {}
      load(path: string) { return {}; }
      get(path: string) { return {}; }
  }
}));

vi.mock('../../../src/assets/md3.js', () => ({
    parseMd3: vi.fn((buffer: ArrayBuffer) => {
        return {
            surfaces: [{
                shaders: [{ name: 'textures/e1u1/wall1' }]
            }]
        };
    }),
    Md3Loader: class {
        constructor(vfs: any) {}
        load(path: string) { return {}; }
        get(path: string) { return {}; }
    }
}));

vi.mock('../../../src/assets/sprite.js', () => ({
    parseSprite: vi.fn(),
    SpriteLoader: class {
        constructor(vfs: any) {}
        load(path: string) { return {}; }
    }
}));


describe('AssetCrossReference', () => {
  let vfs: VirtualFileSystem;
  let assetManager: AssetManager;
  let xref: AssetCrossReference;

  beforeEach(() => {
    vfs = new VirtualFileSystem([]);
    assetManager = new AssetManager(vfs, {} as any);
    xref = new AssetCrossReference(vfs, assetManager);

    // Mock VFS readFile to return JSON string of mock data for testing
    // Since we mocked parseBsp to read JSON
    vi.spyOn(vfs, 'readFile').mockImplementation(async (path) => {
       if (path.endsWith('.bsp')) {
           const data = {
               texInfo: [
                   { texture: 'textures/e1u1/wall1' },
                   { texture: 'textures/e1u1/floor' }
               ],
               entities: {
                   entities: [
                       { properties: { classname: 'worldspawn' } },
                       { properties: { classname: 'func_door', model: '*1', sound: 'doors/dr1_strt.wav' } },
                       { properties: { classname: 'misc_model', model: 'models/objects/box.md2' } }
                   ]
               }
           };
           return new TextEncoder().encode(JSON.stringify(data));
       }
       if (path.endsWith('.md2')) {
           return new Uint8Array([0]); // Dummy
       }
       if (path.endsWith('.md3')) {
           return new Uint8Array([0]); // Dummy
       }
       throw new Error(`File not found: ${path}`);
    });

    // Mock listing
    vi.spyOn(vfs, 'findByExtension').mockImplementation((ext) => {
        if (ext === 'bsp') {
            return [
                { path: 'maps/q2dm1.bsp', size: 100, sourcePak: 'pak0' },
                { path: 'maps/q2dm2.bsp', size: 100, sourcePak: 'pak0' }
            ];
        }
        if (ext === 'md2') {
            return [
                { path: 'models/objects/box.md2', size: 100, sourcePak: 'pak0' }
            ];
        }
        if (ext === 'md3') {
             return [
                 { path: 'models/objects/box.md3', size: 100, sourcePak: 'pak0' }
             ];
        }
        return [];
    });
  });

  it('getMapDependencies returns dependencies', async () => {
    const deps = await xref.getMapDependencies('maps/q2dm1.bsp');
    expect(deps.textures).toContain('textures/e1u1/wall1');
    expect(deps.models).toContain('models/objects/box.md2');
    expect(deps.sounds).toContain('doors/dr1_strt.wav');
  });

  it('getMapsUsingModel finds maps using a model', async () => {
      // Setup: q2dm1 uses 'models/objects/box.md2' (via mock above)
      // q2dm2 also uses it (same mock)
      const maps = await xref.getMapsUsingModel('models/objects/box.md2');
      expect(maps).toContain('maps/q2dm1.bsp');
      expect(maps).toContain('maps/q2dm2.bsp');
  });

  it('getModelsUsingTexture finds models using a texture', async () => {
      // The MD2 mock returns 'textures/e1u1/wall1' as skin
      // The MD3 mock returns 'textures/e1u1/wall1' as shader
      const models = await xref.getModelsUsingTexture('textures/e1u1/wall1');
      expect(models).toContain('models/objects/box.md2');
      expect(models).toContain('models/objects/box.md3');
  });

  it('getEntitiesUsingSound finds entities using a sound', async () => {
      const entities = await xref.getEntitiesUsingSound('doors/dr1_strt.wav');
      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].properties['sound']).toBe('doors/dr1_strt.wav');
  });
});
