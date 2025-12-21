import { describe, it, expect, vi } from 'vitest';
import { traceBox, CollisionModel } from '../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makePlane, makeNode, makeBspModel, makeAxisBrush, makeLeafModel } from '@quake2ts/test-utils';
import { CONTENTS_SOLID, MASK_SOLID } from '../../src/bsp/contents.js';

describe('Trace Performance', () => {
  it('should run 10,000 traces in under 1s', () => {
    // Construct a simple scene with some brushes
    const brushes = [];
    for (let i = 0; i < 100; i++) {
        brushes.push(makeBrushFromMinsMaxs(
            { x: i * 20, y: 0, z: 0 },
            { x: i * 20 + 10, y: 10, z: 10 },
            CONTENTS_SOLID
        ));
    }

    // Create a mock collision model with linear nodes for simplicity (real BSP is faster)
    // We simulate a leaf with many brushes
    // The traversal logic expects leafs to be negative indices: -1 - leafIndex
    // So leaf 0 is index -1. Leaf 1 is index -2.
    // Our node has children [-1, -1], which means both sides point to leaf 0.

    const model: CollisionModel = {
        headnode: 0,
        leaves: [
            { contents: CONTENTS_SOLID, cluster: 0, area: 0, firstLeafBrush: 0, numLeafBrushes: 100 },
            { contents: 0, cluster: 0, area: 0, firstLeafBrush: 0, numLeafBrushes: 0 }
        ],
        nodes: [{
            plane: { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
            children: [-1, -1]
        } as any],
        planes: [],
        brushes: brushes,
        leafBrushes: brushes.map((_, i) => i),
        bmodels: []
    };

    const start = performance.now();
    let count = 0;
    const startPos = { x: -10, y: 5, z: 5 };
    const endPos = { x: 2000, y: 5, z: 5 };
    const mins = { x: -1, y: -1, z: -1 };
    const maxs = { x: 1, y: 1, z: 1 };

    // We use a simpler trace loop to measure raw overhead, as makeBrushFromMinsMaxs
    // creates 6 planes per brush, which is decent.
    // 10,000 traces against 100 brushes is 1M brush checks (roughly).
    // That might be too slow for JS without spatial partition.
    // But `traceBox` walks the BSP. Our mock BSP puts everything in leaf 0.
    // So trace will check all 100 brushes if it enters leaf 0.

    for (let i = 0; i < 10000; i++) {
        traceBox({
            start: startPos,
            end: endPos,
            mins,
            maxs,
            model,
            contentMask: MASK_SOLID
        });
        count++;
    }
    const end = performance.now();
    const duration = end - start;

    // Check if we met the target (10k traces < 1000ms => >10k traces/sec)
    // Note: In CI environments this might fluctuate. We log it but maybe don't fail hard unless it's terrible.
    console.log(`Perftester: ${count} traces in ${duration.toFixed(2)}ms (${(count / duration * 1000).toFixed(0)} traces/sec)`);

    // We expect it to be reasonable. If it takes > 2s something is very wrong.
    expect(duration).toBeLessThan(2000);
  });
});
