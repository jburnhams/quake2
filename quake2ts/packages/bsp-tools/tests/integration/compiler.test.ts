import { describe, it, expect } from 'vitest';
import { BspCompiler } from '../../src/compiler/BspCompiler.js';
import { box } from '../../src/builder/primitives.js';
import { CONTENTS_SOLID } from '@quake2ts/shared';
import type { BrushDef, EntityDef } from '../../src/builder/types.js';

describe('BspCompiler Integration', () => {
  it('compiles a simple map with overlapping brushes', () => {
    // Brush 1: Base cube at origin
    const b1 = box({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 },
      contents: CONTENTS_SOLID
    });

    // Brush 2: Overlapping cube shifted by 32
    const b2 = box({
      origin: { x: 32, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 },
      contents: CONTENTS_SOLID
    });

    const brushes: BrushDef[] = [b1, b2];
    const entities: EntityDef[] = [
      { classname: 'worldspawn', properties: {} },
      { classname: 'info_player_start', properties: { origin: '0 0 128' } }
    ];

    const compiler = new BspCompiler({ verbose: false });
    const result = compiler.compile(brushes, entities);

    expect(result.bsp).toBeDefined();
    expect(result.stats.planes).toBeGreaterThan(0);
    expect(result.stats.nodes).toBeGreaterThan(0);
    expect(result.stats.leafs).toBeGreaterThan(0);
    expect(result.stats.faces).toBeGreaterThan(0);
    expect(result.stats.edges).toBeGreaterThan(0);
    expect(result.stats.vertices).toBeGreaterThan(0);

    // Verify BSP header
    expect(result.bsp.header.version).toBe(38);

    // Verify Entities
    expect(result.bsp.entities.raw).toContain('worldspawn');
    expect(result.bsp.entities.raw).toContain('info_player_start');

    // Verify Geometry
    // We expect some faces and edges due to the cubes.
    // Overlapping cubes should result in merged faces or at least valid geometry.
    // 6 faces per cube usually, but CSG might split them.
    // B1: 6 faces. B2: 6 faces.
    // Overlap removes hidden faces.
    // B1 right face (x=32) is inside B2? No, B1 max X is 32. B2 min X is 0.
    // Overlap region is x in [0, 32].
    // Faces at x=32 might be removed or split.
  });

  it('compiles a hollow room', () => {
    // Floor
    const floor = box({
      origin: { x: 0, y: 0, z: -64 },
      size: { x: 256, y: 256, z: 16 }
    });
    // Ceiling
    const ceiling = box({
      origin: { x: 0, y: 0, z: 64 },
      size: { x: 256, y: 256, z: 16 }
    });
    // Walls (4)
    // ... simpler just use large box minus inner box (subtraction via CSG?)
    // BspCompiler supports additive brushes.
    // So 6 walls.
    const wall1 = box({ origin: { x: -120, y: 0, z: 0 }, size: { x: 16, y: 256, z: 128 } });
    const wall2 = box({ origin: { x: 120, y: 0, z: 0 }, size: { x: 16, y: 256, z: 128 } });
    const wall3 = box({ origin: { x: 0, y: -120, z: 0 }, size: { x: 224, y: 16, z: 128 } }); // Adjusted width to avoid overlap for simplicity
    const wall4 = box({ origin: { x: 0, y: 120, z: 0 }, size: { x: 224, y: 16, z: 128 } });

    const brushes = [floor, ceiling, wall1, wall2, wall3, wall4];
    const entities: EntityDef[] = [{ classname: 'worldspawn', properties: {} }];

    const compiler = new BspCompiler();
    const result = compiler.compile(brushes, entities);

    expect(result.bsp.nodes.length).toBeGreaterThan(0);
    // Should have valid leafs
    const solidLeafs = result.bsp.leafs.filter(l => l.contents === CONTENTS_SOLID);
    const emptyLeafs = result.bsp.leafs.filter(l => l.contents === 0);

    expect(solidLeafs.length).toBeGreaterThan(0);
    expect(emptyLeafs.length).toBeGreaterThan(0);
  });
});
