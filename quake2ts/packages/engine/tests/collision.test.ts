import { describe, it, expect } from 'vitest';
import { loadCollisionModel, trace, pointContents } from '../src/collision';
import { BspMap, parseBsp } from '../src/assets/bsp';
import { Vec3, CONTENTS_SOLID } from '@quake2ts/shared';
import { buildBsp } from './helpers/bsp';

describe('collision', () => {
    const planes = new Float32Array([
        1, 0, 0, 16,
        -1, 0, 0, 16,
        0, 1, 0, 16,
        0, -1, 0, 16,
        0, 0, 1, 16,
        0, 0, -1, 16,
    ]);

    const nodes = new Int32Array([
        0, 1, 2,
        1, -1, -1,
    ]);

    const leafs = new Int32Array([
        CONTENTS_SOLID, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
    ]);

    const brushes = new Int32Array([
        0, 6, CONTENTS_SOLID,
    ]);

    const brushSides = new Int16Array([
        0, 0,
        1, 0,
        2, 0,
        3, 0,
        4, 0,
        5, 0,
    ]);

    const mockBsp = buildBsp({
        1: planes.buffer,
        4: nodes.buffer,
        8: leafs.buffer,
        14: brushes.buffer,
        15: brushSides.buffer,
    });

    const mockBspMap = parseBsp(mockBsp);

    it('should load a collision model from a bsp map', () => {
        loadCollisionModel(mockBspMap);
    });

    it('should perform a trace', () => {
        loadCollisionModel(mockBspMap);
        const start: Vec3 = { x: 0, y: 0, z: 0 };
        const end: Vec3 = { x: 20, y: 0, z: 0 };
        const result = trace(start, end, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        expect(result.fraction).toBeLessThan(1.0);
    });

    it('should get point contents', () => {
        loadCollisionModel(mockBspMap);
        const point: Vec3 = { x: 0, y: 0, z: 0 };
        const contents = pointContents(point);
        expect(contents).toBe(CONTENTS_SOLID);
    });
});
