import { describe, it, expect } from 'vitest';
import { SimpleCompiler } from '../../../src/compiler/SimpleCompiler.js';
import { box } from '../../../src/builder/primitives.js';
import { BspLump } from '../../../src/types/bsp.js';

describe('SimpleCompiler', () => {
  it('compiles a single box', () => {
    const b = box({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 },
      texture: 'test'
    });

    const compiler = new SimpleCompiler([b], []);
    const result = compiler.compile();

    expect(result.stats.brushes).toBe(1);
    expect(result.stats.planes).toBeGreaterThan(0);
    expect(result.stats.nodes).toBeGreaterThan(0);
    expect(result.stats.leafs).toBeGreaterThan(1);
    expect(result.stats.faces).toBeGreaterThan(0);

    // Verify BSP structure
    const bsp = result.bsp;
    expect(bsp.header.version).toBe(38);
    expect(bsp.nodes.length).toBeGreaterThan(0);
    expect(bsp.faces.length).toBeGreaterThan(0);
    expect(bsp.texInfo.length).toBeGreaterThan(0);
  });

  it('compiles two disjoint boxes', () => {
     const b1 = box({
       origin: { x: -100, y: 0, z: 0 },
       size: { x: 64, y: 64, z: 64 },
       texture: 'box1'
     });
     const b2 = box({
       origin: { x: 100, y: 0, z: 0 },
       size: { x: 64, y: 64, z: 64 },
       texture: 'box2'
     });

     const compiler = new SimpleCompiler([b1, b2], []);
     const result = compiler.compile();

     expect(result.stats.brushes).toBe(2);
     // Minimum 2 leaf nodes for brushes + 1 or more for outside space
     expect(result.stats.leafs).toBeGreaterThan(2);

     // Should have nodes separating them
     expect(result.stats.nodes).toBeGreaterThan(1);

     const bsp = result.bsp;
     expect(bsp.texInfo.length).toBe(2); // Two different textures
  });
});
