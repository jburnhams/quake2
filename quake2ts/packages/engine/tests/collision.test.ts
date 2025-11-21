import { describe, it, expect } from 'vitest';
import { loadCollisionModel, trace, pointContents } from '../src/collision';
import { BspMap, parseBsp, BspLump } from '../src/assets/bsp';
import { Vec3, CONTENTS_SOLID } from '@quake2ts/shared';
import { buildBsp } from './helpers/bsp';

describe('collision', () => {
    const planesLump = new ArrayBuffer(6 * 20);
    const planesView = new DataView(planesLump);
    // Plane 0: X = 16
    planesView.setFloat32(0, 1, true); planesView.setFloat32(4, 0, true); planesView.setFloat32(8, 0, true); planesView.setFloat32(12, 16, true);
    // Plane 1: X = -16
    planesView.setFloat32(20, -1, true); planesView.setFloat32(24, 0, true); planesView.setFloat32(28, 0, true); planesView.setFloat32(32, -16, true);
    // Plane 2: Y = 16
    planesView.setFloat32(40, 0, true); planesView.setFloat32(44, 1, true); planesView.setFloat32(48, 0, true); planesView.setFloat32(52, 16, true);
    // Plane 3: Y = -16
    planesView.setFloat32(60, 0, true); planesView.setFloat32(64, -1, true); planesView.setFloat32(68, 0, true); planesView.setFloat32(72, -16, true);
    // Plane 4: Z = 16
    planesView.setFloat32(80, 0, true); planesView.setFloat32(84, 0, true); planesView.setFloat32(88, 1, true); planesView.setFloat32(92, 16, true);
    // Plane 5: Z = -16
    planesView.setFloat32(100, 0, true); planesView.setFloat32(104, 0, true); planesView.setFloat32(108, -1, true); planesView.setFloat32(112, -16, true);

    const nodesLump = new ArrayBuffer(1 * 36);
    const nodesView = new DataView(nodesLump);
    nodesView.setInt32(0, 0, true);
    nodesView.setInt32(4, -1, true);
    nodesView.setInt32(8, -2, true);

    const leafsLump = new ArrayBuffer(2 * 28);
    const leafsView = new DataView(leafsLump);
    leafsView.setInt32(0, CONTENTS_SOLID, true);
    leafsView.setUint16(24, 0, true); // firstLeafBrush
    leafsView.setUint16(26, 1, true); // numLeafBrushes
    leafsView.setInt32(28, 0, true);

    const leafBrushesLump = new ArrayBuffer(1 * 2);
    const leafBrushesView = new DataView(leafBrushesLump);
    leafBrushesView.setUint16(0, 0, true); // brush 0

    const brushesLump = new ArrayBuffer(1 * 12);
    const brushesView = new DataView(brushesLump);
    brushesView.setInt32(0, 0, true); // firstSide
    brushesView.setInt32(4, 6, true); // numSides
    brushesView.setInt32(8, CONTENTS_SOLID, true); // contents

    const brushSidesLump = new ArrayBuffer(6 * 8);
    const brushSidesView = new DataView(brushSidesLump);
    brushSidesView.setUint16(0, 0, true);
    brushSidesView.setUint16(8, 1, true);
    brushSidesView.setUint16(16, 2, true);
    brushSidesView.setUint16(24, 3, true);
    brushSidesView.setUint16(32, 4, true);
    brushSidesView.setUint16(40, 5, true);

    const mockBsp = buildBsp({
        [BspLump.Planes]: planesLump,
        [BspLump.Nodes]: nodesLump,
        [BspLump.Leafs]: leafsLump,
        [BspLump.LeafBrushes]: leafBrushesLump,
        [BspLump.Brushes]: brushesLump,
        [BspLump.BrushSides]: brushSidesLump,
    });

    const mockBspMap = parseBsp(mockBsp);

    it('should load a collision model from a bsp map', () => {
        loadCollisionModel(mockBspMap);
    });

    it('should perform a trace that hits a solid', () => {
        loadCollisionModel(mockBspMap);
        const start: Vec3 = { x: 0, y: 0, z: 0 };
        const end: Vec3 = { x: 20, y: 0, z: 0 };
        const result = trace(start, end, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        expect(result.fraction).toBeLessThan(1.0);
        expect(result.endpos.x).toBeCloseTo(16);
    });

    it('should perform a trace that does not hit a solid', () => {
        loadCollisionModel(mockBspMap);
        const start: Vec3 = { x: -32, y: 0, z: 0 };
        const end: Vec3 = { x: 0, y: 0, z: 0 };
        const result = trace(start, end, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        expect(result.fraction).toBe(1.0);
    });

    it('should get point contents for a solid point', () => {
        loadCollisionModel(mockBspMap);
        const point: Vec3 = { x: 0, y: 0, z: 0 };
        const contents = pointContents(point);
        expect(contents).toBe(CONTENTS_SOLID);
    });

    it('should get point contents for an empty point', () => {
        loadCollisionModel(mockBspMap);
        const point: Vec3 = { x: -20, y: 0, z: 0 };
        const contents = pointContents(point);
        expect(contents).toBe(0);
    });
});
