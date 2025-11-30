import { describe, it, expect, vi } from 'vitest';
import { createClient, ClientImports, ClientExports } from '../src/index.js';
import { EntityState, Mat4 } from '@quake2ts/shared';
import { Md2Model } from '@quake2ts/engine';
import { ClientConfigStrings } from '../src/configStrings.js';

describe('Entity Interpolation', () => {
  const mockEngine = {
    assets: {
      getMd2Model: vi.fn(),
      getMd3Model: vi.fn(),
      getMap: vi.fn(),
    },
    renderer: {
      width: 800,
      height: 600,
      renderFrame: vi.fn(),
    },
    trace: vi.fn(),
  };

  const mockImports: ClientImports = {
    engine: mockEngine as any,
  };

  const createMockEntity = (number: number, origin: any, frame: number): EntityState => ({
    number,
    modelIndex: 1,
    modelIndex2: 0,
    modelIndex3: 0,
    modelIndex4: 0,
    frame,
    skinnum: 0,
    effects: 0,
    renderfx: 0,
    origin,
    old_origin: origin,
    angles: { x: 0, y: 0, z: 0 },
    sound: 0,
    event: 0,
    solid: 0,
    bits: 0,
    alpha: 0,
    scale: 0,
    instanceBits: 0,
    loopVolume: 0,
    loopAttenuation: 0,
    owner: 0,
    oldFrame: 0,
  });

  it('should interpolate scale and alpha', () => {
    const client = createClient(mockImports);

    // Mock MD2 model
    const mockModel: Md2Model = {
      header: { magic: 844121161 } as any,
      frames: [],
      triangles: [],
      skins: [],
      glCommands: new Int32Array(0),
    };
    mockEngine.assets.getMd2Model.mockReturnValue(mockModel);

    // Set up config string for model
    client.configStrings.set(33, 'models/test.md2'); // CS_MODELS (32) + 1

    // Entity 1:
    // Frame A: scale=1, alpha=255
    // Frame B: scale=2, alpha=0
    // Alpha=0.5 -> expected scale=1.5, alpha=127.5 (normalized ~0.5)

    const entityA = createMockEntity(1, { x: 0, y: 0, z: 0 }, 0);
    entityA.scale = 1.0;
    entityA.alpha = 255;

    const entityB = createMockEntity(1, { x: 10, y: 0, z: 0 }, 1);
    entityB.scale = 2.0;
    entityB.alpha = 0;

    const sample = {
      alpha: 0.5,
      latest: {
        timeMs: 100,
        state: {
           packetEntities: [entityB],
           origin: {x:0, y:0, z:0},
           velocity: {x:0, y:0, z:0},
           viewAngles: {x:0, y:0, z:0},
           pmFlags: 0,
           waterLevel: 0,
           blend: [0, 0, 0, 0],
           damageAlpha: 0
        } as any // Mock PredictionState
      },
      previous: {
        timeMs: 0,
        state: {
           packetEntities: [entityA],
           origin: {x:0, y:0, z:0},
           velocity: {x:0, y:0, z:0},
           viewAngles: {x:0, y:0, z:0},
           pmFlags: 0,
           waterLevel: 0,
           blend: [0, 0, 0, 0],
           damageAlpha: 0
        } as any
      }
    };

    client.render(sample as any);

    expect(mockEngine.renderer.renderFrame).toHaveBeenCalled();
    const call = mockEngine.renderer.renderFrame.mock.calls[0];
    const renderEntities = call[1]; // 2nd argument is entities list

    expect(renderEntities).toHaveLength(1);
    const ent = renderEntities[0];
    expect(ent.type).toBe('md2');

    // Check Alpha Interpolation (255 to 0 at 0.5 = 127.5)
    // Assuming normalization 0-255 -> 0-1
    expect(ent.alpha).toBeCloseTo(0.5, 1);

    // Check Scale Interpolation (1.0 to 2.0 at 0.5 = 1.5)
    // Scale is applied to transform matrix.
    const mat = ent.transform;
    const expectedScale = 1.5;
    // Inspect diagonal elements: [0]=xx, [5]=yy, [10]=zz
    expect(mat[0]).toBeCloseTo(expectedScale, 0.1);
    expect(mat[5]).toBeCloseTo(expectedScale, 0.1);
    expect(mat[10]).toBeCloseTo(expectedScale, 0.1);
  });
});
